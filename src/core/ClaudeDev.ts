import { Anthropic } from "@anthropic-ai/sdk"
import delay from "delay"
import * as diff from "diff"
import fs from "fs/promises"
import os from "os"
import { SYSTEM_PROMPT } from "./prompts/system"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { serializeError } from "serialize-error"
import * as vscode from "vscode"
import { ApiHandler, buildApiHandler } from "../api"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../integrations/diagnostics"
import { formatContentBlockToMarkdown } from "../integrations/misc/export-markdown"
import { extractTextFromFile } from "../integrations/misc/extract-text"
import { TerminalManager } from "../integrations/terminal/TerminalManager"
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher"
import { listFiles } from "../services/glob/list-files"
import { regexSearchFiles } from "../services/ripgrep"
import { parseSourceCodeForDefinitionsTopLevel } from "../services/tree-sitter"
import { ApiConfiguration } from "../shared/api"
import { ClaudeRequestResult } from "../shared/ClaudeRequestResult"
import { combineApiRequests } from "../shared/combineApiRequests"
import { combineCommandSequences } from "../shared/combineCommandSequences"
import { ClaudeAsk, ClaudeMessage, ClaudeSay, ClaudeSayTool } from "../shared/ExtensionMessage"
import { getApiMetrics } from "../shared/getApiMetrics"
import { HistoryItem } from "../shared/HistoryItem"
import { ToolName } from "../shared/Tool"
import { ClaudeAskResponse } from "../shared/WebviewMessage"
import { findLast, findLastIndex } from "../utils/array"
import { arePathsEqual } from "../utils/path"
import { parseMentions } from "./mentions"
import { TOOLS } from "./prompts/tools"
import { truncateHalfConversation } from "./sliding-window"
import { ClaudeDevProvider } from "./webview/ClaudeDevProvider"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop") // may or may not exist but fs checking existence would immediately ask for permission which would be bad UX, need to come up with a better solution

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export class ClaudeDev {
	readonly taskId: string
	private api: ApiHandler
	private terminalManager: TerminalManager
	private urlContentFetcher: UrlContentFetcher
	private didEditFile: boolean = false
	private customInstructions?: string
	private alwaysAllowReadOnly: boolean
	apiConversationHistory: Anthropic.MessageParam[] = []
	claudeMessages: ClaudeMessage[] = []
	private askResponse?: ClaudeAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	private lastMessageTs?: number
	private consecutiveMistakeCount: number = 0
	private providerRef: WeakRef<ClaudeDevProvider>
	private abort: boolean = false

	constructor(
		provider: ClaudeDevProvider,
		apiConfiguration: ApiConfiguration,
		customInstructions?: string,
		alwaysAllowReadOnly?: boolean,
		task?: string,
		images?: string[],
		historyItem?: HistoryItem
	) {
		this.providerRef = new WeakRef(provider)
		this.api = buildApiHandler(apiConfiguration)
		this.terminalManager = new TerminalManager()
		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.customInstructions = customInstructions
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false

		if (historyItem) {
			this.taskId = historyItem.id
			this.resumeTaskFromHistory()
		} else if (task || images) {
			this.taskId = Date.now().toString()
			this.startTask(task, images)
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}
	}

	updateApi(apiConfiguration: ApiConfiguration) {
		this.api = buildApiHandler(apiConfiguration)
	}

	updateCustomInstructions(customInstructions: string | undefined) {
		this.customInstructions = customInstructions
	}

	updateAlwaysAllowReadOnly(alwaysAllowReadOnly: boolean | undefined) {
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	// storing task to disk for history

	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		this.apiConversationHistory.push(message)
		await this.saveApiConversationHistory()
	}

	private async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
		} catch (error) {
			// in the off chance this fails, we don't want to stop the task
			console.error("Failed to save API conversation history:", error)
		}
	}

	private async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	private async addToClaudeMessages(message: ClaudeMessage) {
		this.claudeMessages.push(message)
		await this.saveClaudeMessages()
	}

	private async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this.claudeMessages = newMessages
		await this.saveClaudeMessages()
	}

	private async saveClaudeMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			await fs.writeFile(filePath, JSON.stringify(this.claudeMessages))
			// combined as they are in ChatView
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.claudeMessages.slice(1))))
			const taskMessage = this.claudeMessages[0] // first message is always the task say
			const lastRelevantMessage =
				this.claudeMessages[
					findLastIndex(
						this.claudeMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
					)
				]
			await this.providerRef.deref()?.updateTaskHistory({
				id: this.taskId,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})
		} catch (error) {
			console.error("Failed to save claude messages:", error)
		}
	}

	async ask(
		type: ClaudeAsk,
		question?: string
	): Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }> {
		// If this ClaudeDev instance was aborted by the provider, then the only thing keeping us alive is a promise still running in the background, in which case we don't want to send its result to the webview as it is attached to a new instance of ClaudeDev now. So we can safely ignore the result of any active promises, and this class will be deallocated. (Although we set claudeDev = undefined in provider, that simply removes the reference to this instance, but the instance is still alive until this promise resolves or rejects.)
		if (this.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		const askTs = Date.now()
		this.lastMessageTs = askTs
		await this.addToClaudeMessages({ ts: askTs, type: "ask", ask: type, text: question })
		await this.providerRef.deref()?.postStateToWebview()
		await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
		if (this.lastMessageTs !== askTs) {
			throw new Error("Current ask promise was ignored") // could happen if we send multiple asks in a row i.e. with command_output. It's important that when we know an ask could fail, it is handled gracefully
		}
		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		return result
	}

	async say(type: ClaudeSay, text?: string, images?: string[]): Promise<undefined> {
		if (this.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		const sayTs = Date.now()
		this.lastMessageTs = sayTs
		await this.addToClaudeMessages({ ts: sayTs, type: "say", say: type, text: text, images })
		await this.providerRef.deref()?.postStateToWebview()
	}

	private async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (for API) and claudeMessages (for webview) need to be in sync
		// if the extension process were killed, then on restart the claudeMessages might not be empty, so we need to set it to [] when we create a new ClaudeDev client (otherwise webview would show stale messages from previous session)
		this.claudeMessages = []
		this.apiConversationHistory = []
		await this.providerRef.deref()?.postStateToWebview()

		await this.say("text", task, images)

		let imageBlocks: Anthropic.ImageBlockParam[] = this.formatImagesIntoBlocks(images)
		await this.initiateTaskLoop([
			{
				type: "text",
				text: `<task>\n${task}\n</task>`,
			},
			...imageBlocks,
		])
	}

	private async resumeTaskFromHistory() {
		const modifiedClaudeMessages = await this.getSavedClaudeMessages()

		// Need to modify claude messages for good ux, i.e. if the last message is an api_request_started, then remove it otherwise the user will think the request is still loading
		const lastApiReqStartedIndex = modifiedClaudeMessages.reduce(
			(lastIndex, m, index) => (m.type === "say" && m.say === "api_req_started" ? index : lastIndex),
			-1
		)
		const lastApiReqFinishedIndex = modifiedClaudeMessages.reduce(
			(lastIndex, m, index) => (m.type === "say" && m.say === "api_req_finished" ? index : lastIndex),
			-1
		)
		if (lastApiReqStartedIndex > lastApiReqFinishedIndex && lastApiReqStartedIndex !== -1) {
			modifiedClaudeMessages.splice(lastApiReqStartedIndex, 1)
		}

		// Remove any resume messages that may have been added before
		const lastRelevantMessageIndex = findLastIndex(
			modifiedClaudeMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClaudeMessages.splice(lastRelevantMessageIndex + 1)
		}

		await this.overwriteClaudeMessages(modifiedClaudeMessages)
		this.claudeMessages = await this.getSavedClaudeMessages()

		// Now present the claude messages to the user and ask if they want to resume

		const lastClaudeMessage = this.claudeMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")) // could be multiple resume tasks
		// const lastClaudeMessage = this.claudeMessages[lastClaudeMessageIndex]
		// could be a completion result with a command
		// const secondLastClaudeMessage = this.claudeMessages
		// 	.slice()
		// 	.reverse()
		// 	.find(
		// 		(m, index) =>
		// 			index !== lastClaudeMessageIndex && !(m.ask === "resume_task" || m.ask === "resume_completed_task")
		// 	)
		// (lastClaudeMessage?.ask === "command" && secondLastClaudeMessage?.ask === "completion_result")

		let askType: ClaudeAsk
		if (lastClaudeMessage?.ask === "completion_result") {
			askType = "resume_completed_task"
		} else {
			askType = "resume_task"
		}

		const { response, text, images } = await this.ask(askType) // calls poststatetowebview
		let responseText: string | undefined
		let responseImages: string[] | undefined
		if (response === "messageResponse") {
			await this.say("user_feedback", text, images)
			responseText = text
			responseImages = images
		}

		// need to make sure that the api conversation history can be resumed by the api, even if it goes out of sync with claude messages

		// if the last message is an assistant message, we need to check if there's tool use since every tool use has to have a tool response
		// if there's no tool use and only a text block, then we can just add a user message

		// if the last message is a user message, we can need to get the assistant message before it to see if it made tool calls, and if so, fill in the remaining tool responses with 'interrupted'

		const existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await this.getSavedApiConversationHistory()

		let modifiedOldUserContent: UserContent // either the last message if its user message, or the user message before the last (assistant) message
		let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[] // need to remove the last user message to replace with new modified user message
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory] // no changes
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage: Anthropic.Messages.MessageParam | undefined =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: UserContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use"
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result"
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id)
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1) // removes the last user message
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		let newUserContent: UserContent = [...modifiedOldUserContent]

		const agoText = (() => {
			const timestamp = lastClaudeMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		newUserContent.push({
			type: "text",
			text:
				`Task resumption: This autonomous coding task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now '${cwd.toPosix()}'. If the task has not been completed, retry the last step before interruption and proceed with completing the task.` +
				(responseText
					? `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`
					: ""),
		})

		if (responseImages && responseImages.length > 0) {
			newUserContent.push(...this.formatImagesIntoBlocks(responseImages))
		}

		await this.overwriteApiConversationHistory(modifiedApiConversationHistory)
		await this.initiateTaskLoop(newUserContent)
	}

	private async initiateTaskLoop(userContent: UserContent): Promise<void> {
		let nextUserContent = userContent
		let includeFileDetails = true
		while (!this.abort) {
			const { didEndLoop } = await this.recursivelyMakeClaudeRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false // we only need file details the first time

			//  The way this agentic loop works is that claude will be given a task that he then calls tools to complete. unless there's an attempt_completion call, we keep responding back to him with his tool's responses until he either attempt_completion or does not use anymore tools. If he does not use anymore tools, we ask him to consider if he's completed the task and then call attempt_completion, otherwise proceed with completing the task.
			// There is a MAX_REQUESTS_PER_TASK limit to prevent infinite requests, but Claude is prompted to finish the task as efficiently as he can.

			//const totalCost = this.calculateApiCost(totalInputTokens, totalOutputTokens)
			if (didEndLoop) {
				// For now a task never 'completes'. This will only happen if the user hits max requests and denies resetting the count.
				//this.say("task_completed", `Task completed. Total API usage cost: ${totalCost}`)
				break
			} else {
				// this.say(
				// 	"tool",
				// 	"Claude responded with only text blocks but has not called attempt_completion yet. Forcing him to continue with task..."
				// )
				nextUserContent = [
					{
						type: "text",
						text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
					},
				]
				this.consecutiveMistakeCount++
			}
		}
	}

	abortTask() {
		this.abort = true // will stop any autonomously running promises
		this.terminalManager.disposeAll()
		this.urlContentFetcher.closeBrowser()
	}

	async executeTool(toolName: ToolName, toolInput: any): Promise<[boolean, ToolResponse]> {
		switch (toolName) {
			case "write_to_file":
				return this.writeToFile(toolInput.path, toolInput.content)
			case "read_file":
				return this.readFile(toolInput.path)
			case "list_files":
				return this.listFiles(toolInput.path, toolInput.recursive)
			case "list_code_definition_names":
				return this.listCodeDefinitionNames(toolInput.path)
			case "search_files":
				return this.searchFiles(toolInput.path, toolInput.regex, toolInput.filePattern)
			case "execute_command":
				return this.executeCommand(toolInput.command)
			case "inspect_site":
				return this.inspectSite(toolInput.url)
			case "ask_followup_question":
				return this.askFollowupQuestion(toolInput.question)
			case "attempt_completion":
				return this.attemptCompletion(toolInput.result, toolInput.command)
			default:
				return [false, `Unknown tool: ${toolName}`]
		}
	}

	calculateApiCost(
		inputTokens: number,
		outputTokens: number,
		cacheCreationInputTokens?: number,
		cacheReadInputTokens?: number
	): number {
		const modelCacheWritesPrice = this.api.getModel().info.cacheWritesPrice
		let cacheWritesCost = 0
		if (cacheCreationInputTokens && modelCacheWritesPrice) {
			cacheWritesCost = (modelCacheWritesPrice / 1_000_000) * cacheCreationInputTokens
		}
		const modelCacheReadsPrice = this.api.getModel().info.cacheReadsPrice
		let cacheReadsCost = 0
		if (cacheReadInputTokens && modelCacheReadsPrice) {
			cacheReadsCost = (modelCacheReadsPrice / 1_000_000) * cacheReadInputTokens
		}
		const baseInputCost = (this.api.getModel().info.inputPrice / 1_000_000) * inputTokens
		const outputCost = (this.api.getModel().info.outputPrice / 1_000_000) * outputTokens
		const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
		return totalCost
	}

	// return is [didUserRejectTool, ToolResponse]
	async writeToFile(relPath?: string, newContent?: string): Promise<[boolean, ToolResponse]> {
		if (relPath === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("write_to_file", "path")]
		}
		if (newContent === undefined) {
			this.consecutiveMistakeCount++
			// Custom error message for this particular case
			await this.say(
				"error",
				`Claude tried to use write_to_file for '${relPath.toPosix()}' without value for required parameter 'content'. This is likely due to reaching the maximum output token limit. Retrying with suggestion to change response size...`
			)
			return [
				false,
				await this.formatToolError(
					`Missing value for required parameter 'content'. This may occur if the file is too large, exceeding output limits. Consider splitting into smaller files or reducing content size. Please retry with all required parameters.`
				),
			]
		}
		this.consecutiveMistakeCount = 0
		try {
			const absolutePath = path.resolve(cwd, relPath)
			const fileExists = await fs
				.access(absolutePath)
				.then(() => true)
				.catch(() => false)

			// if the file is already open, ensure it's not dirty before getting its contents
			if (fileExists) {
				const existingDocument = vscode.workspace.textDocuments.find((doc) =>
					arePathsEqual(doc.uri.fsPath, absolutePath)
				)
				if (existingDocument && existingDocument.isDirty) {
					await existingDocument.save()
				}
			}

			// get diagnostics before editing the file, we'll compare to diagnostics after editing to see if claude needs to fix anything
			const preDiagnostics = vscode.languages.getDiagnostics()

			let originalContent: string
			if (fileExists) {
				originalContent = await fs.readFile(absolutePath, "utf-8")
				// fix issue where claude always removes newline from the file
				const eol = originalContent.includes("\r\n") ? "\r\n" : "\n"
				if (originalContent.endsWith(eol) && !newContent.endsWith(eol)) {
					newContent += eol
				}
			} else {
				originalContent = ""
			}

			const fileName = path.basename(absolutePath)

			// for new files, create any necessary directories and keep track of new directories to delete if the user denies the operation

			// Keep track of newly created directories
			const createdDirs: string[] = await this.createDirectoriesForFile(absolutePath)
			// console.log(`Created directories: ${createdDirs.join(", ")}`)
			// make sure the file exists before we open it
			if (!fileExists) {
				await fs.writeFile(absolutePath, "")
			}

			// Open the existing file with the new contents
			const updatedDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath))

			// await updatedDocument.save()
			// const edit = new vscode.WorkspaceEdit()
			// const fullRange = new vscode.Range(
			// 	updatedDocument.positionAt(0),
			// 	updatedDocument.positionAt(updatedDocument.getText().length)
			// )
			// edit.replace(updatedDocument.uri, fullRange, newContent)
			// await vscode.workspace.applyEdit(edit)

			// Windows file locking issues can prevent temporary files from being saved or closed properly.
			// To avoid these problems, we use in-memory TextDocument objects with the `untitled` scheme.
			// This method keeps the document entirely in memory, bypassing the filesystem and ensuring
			// a consistent editing experience across all platforms. This also has the added benefit of not
			// polluting the user's workspace with temporary files.

			// Create an in-memory document for the new content
			// const inMemoryDocumentUri = vscode.Uri.parse(`untitled:${fileName}`) // untitled scheme is necessary to open a file without it being saved to disk
			// const inMemoryDocument = await vscode.workspace.openTextDocument(inMemoryDocumentUri)
			// const edit = new vscode.WorkspaceEdit()
			// edit.insert(inMemoryDocumentUri, new vscode.Position(0, 0), newContent)
			// await vscode.workspace.applyEdit(edit)

			// Show diff
			await vscode.commands.executeCommand(
				"vscode.diff",
				vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
					query: Buffer.from(originalContent).toString("base64"),
				}),
				updatedDocument.uri,
				`${fileName}: ${fileExists ? "Original ↔ Claude's Changes" : "New File"} (Editable)`
			)

			// if the file was already open, close it (must happen after showing the diff view since if it's the only tab the column will close)
			let documentWasOpen = false

			// close the tab if it's open
			const tabs = vscode.window.tabGroups.all
				.map((tg) => tg.tabs)
				.flat()
				.filter(
					(tab) =>
						tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath)
				)
			for (const tab of tabs) {
				await vscode.window.tabGroups.close(tab)
				// console.log(`Closed tab for ${absolutePath}`)
				documentWasOpen = true
			}

			// console.log(`Document was open: ${documentWasOpen}`)

			// edit needs to happen after we close the original tab
			const edit = new vscode.WorkspaceEdit()
			if (!fileExists) {
				edit.insert(updatedDocument.uri, new vscode.Position(0, 0), newContent)
			} else {
				const fullRange = new vscode.Range(
					updatedDocument.positionAt(0),
					updatedDocument.positionAt(updatedDocument.getText().length)
				)
				edit.replace(updatedDocument.uri, fullRange, newContent)
			}
			// Apply the edit, but without saving so this doesnt trigger a local save in timeline history
			await vscode.workspace.applyEdit(edit) // has the added benefit of maintaing the file's original EOLs

			// Find the first range where the content differs and scroll to it
			if (fileExists) {
				const diffResult = diff.diffLines(originalContent, newContent)
				for (let i = 0, lineCount = 0; i < diffResult.length; i++) {
					const part = diffResult[i]
					if (part.added || part.removed) {
						const startLine = lineCount + 1
						const endLine = lineCount + (part.count || 0)
						const activeEditor = vscode.window.activeTextEditor
						if (activeEditor) {
							try {
								activeEditor.revealRange(
									// + 3 to move the editor up slightly as this looks better
									new vscode.Range(
										new vscode.Position(startLine, 0),
										new vscode.Position(
											Math.min(endLine + 3, activeEditor.document.lineCount - 1),
											0
										)
									),
									vscode.TextEditorRevealType.InCenter
								)
							} catch (error) {
								console.error(`Error revealing range for ${absolutePath}: ${error}`)
							}
						}
						break
					}
					lineCount += part.count || 0
				}
			}

			// remove cursor from the document
			await vscode.commands.executeCommand("workbench.action.focusSideBar")

			let userResponse: {
				response: ClaudeAskResponse
				text?: string
				images?: string[]
			}
			if (fileExists) {
				userResponse = await this.ask(
					"tool",
					JSON.stringify({
						tool: "editedExistingFile",
						path: this.getReadablePath(relPath),
						diff: this.createPrettyPatch(relPath, originalContent, newContent),
					} satisfies ClaudeSayTool)
				)
			} else {
				userResponse = await this.ask(
					"tool",
					JSON.stringify({
						tool: "newFileCreated",
						path: this.getReadablePath(relPath),
						content: newContent,
					} satisfies ClaudeSayTool)
				)
			}
			const { response, text, images } = userResponse

			// const closeInMemoryDocAndDiffViews = async () => {
			// 	// ensure that the in-memory doc is active editor (this seems to fail on windows machines if its already active, so ignoring if there's an error as it's likely it's already active anyways)
			// 	// try {
			// 	// 	await vscode.window.showTextDocument(inMemoryDocument, {
			// 	// 		preview: false, // ensures it opens in non-preview tab (preview tabs are easily replaced)
			// 	// 		preserveFocus: false,
			// 	// 	})
			// 	// 	// await vscode.window.showTextDocument(inMemoryDocument.uri, { preview: true, preserveFocus: false })
			// 	// } catch (error) {
			// 	// 	console.log(`Could not open editor for ${absolutePath}: ${error}`)
			// 	// }
			// 	// await delay(50)
			// 	// // Wait for the in-memory document to become the active editor (sometimes vscode timing issues happen and this would accidentally close claude dev!)
			// 	// await pWaitFor(
			// 	// 	() => {
			// 	// 		return vscode.window.activeTextEditor?.document === inMemoryDocument
			// 	// 	},
			// 	// 	{ timeout: 5000, interval: 50 }
			// 	// )

			// 	// if (vscode.window.activeTextEditor?.document === inMemoryDocument) {
			// 	// 	await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor") // allows us to close the untitled doc without being prompted to save it
			// 	// }

			// 	await this.closeDiffViews()
			// }

			if (response !== "yesButtonTapped") {
				if (!fileExists) {
					if (updatedDocument.isDirty) {
						await updatedDocument.save()
					}
					await this.closeDiffViews()
					await fs.unlink(absolutePath)
					// Remove only the directories we created, in reverse order
					for (let i = createdDirs.length - 1; i >= 0; i--) {
						await fs.rmdir(createdDirs[i])
						console.log(`Directory ${createdDirs[i]} has been deleted.`)
					}
					console.log(`File ${absolutePath} has been deleted.`)
				} else {
					// revert document
					const edit = new vscode.WorkspaceEdit()
					const fullRange = new vscode.Range(
						updatedDocument.positionAt(0),
						updatedDocument.positionAt(updatedDocument.getText().length)
					)
					edit.replace(updatedDocument.uri, fullRange, originalContent)
					// Apply the edit and save, since contents shouldnt have changed this wont show in local history unless of course the user made changes and saved during the edit
					await vscode.workspace.applyEdit(edit)
					await updatedDocument.save()
					console.log(`File ${absolutePath} has been reverted to its original content.`)
					if (documentWasOpen) {
						await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
					}
					await this.closeDiffViews()
				}

				if (response === "messageResponse") {
					await this.say("user_feedback", text, images)
					return [true, this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)]
				}
				return [true, await this.formatToolDenied()]
			}

			// Save the changes
			const editedContent = updatedDocument.getText()
			if (updatedDocument.isDirty) {
				await updatedDocument.save()
			}
			this.didEditFile = true

			// Read the potentially edited content from the document

			// trigger an entry in the local history for the file
			// if (fileExists) {
			// 	await fs.writeFile(absolutePath, originalContent)
			// 	const editor = await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
			// 	const edit = new vscode.WorkspaceEdit()
			// 	const fullRange = new vscode.Range(
			// 		editor.document.positionAt(0),
			// 		editor.document.positionAt(editor.document.getText().length)
			// 	)
			// 	edit.replace(editor.document.uri, fullRange, editedContent)
			// 	// Apply the edit, this will trigger a local save and timeline history
			// 	await vscode.workspace.applyEdit(edit) // has the added benefit of maintaing the file's original EOLs
			// 	await editor.document.save()
			// }

			// if (!fileExists) {
			// 	await fs.mkdir(path.dirname(absolutePath), { recursive: true })
			// 	await fs.writeFile(absolutePath, "")
			// }
			// await closeInMemoryDocAndDiffViews()

			// await fs.writeFile(absolutePath, editedContent)

			// open file and add text to it, if it fails fallback to using writeFile
			// we try doing it this way since it adds to local history for users to see what's changed in the file's timeline
			// try {
			// 	const editor = await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
			// 	const edit = new vscode.WorkspaceEdit()
			// 	const fullRange = new vscode.Range(
			// 		editor.document.positionAt(0),
			// 		editor.document.positionAt(editor.document.getText().length)
			// 	)
			// 	edit.replace(editor.document.uri, fullRange, editedContent)
			// 	// Apply the edit, this will trigger a local save and timeline history
			// 	await vscode.workspace.applyEdit(edit) // has the added benefit of maintaing the file's original EOLs
			// 	await editor.document.save()
			// } catch (saveError) {
			// 	console.log(`Could not open editor for ${absolutePath}: ${saveError}`)
			// 	await fs.writeFile(absolutePath, editedContent)
			// 	// calling showTextDocument would sometimes fail even though changes were applied, so we'll ignore these one-off errors (likely due to vscode locking issues)
			// 	try {
			// 		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
			// 	} catch (openFileError) {
			// 		console.log(`Could not open editor for ${absolutePath}: ${openFileError}`)
			// 	}
			// }

			await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

			await this.closeDiffViews()

			/*
			Getting diagnostics before and after the file edit is a better approach than
			automatically tracking problems in real-time. This method ensures we only
			report new problems that are a direct result of this specific edit.
			Since these are new problems resulting from Claude's edit, we know they're
			directly related to the work he's doing. This eliminates the risk of Claude
			going off-task or getting distracted by unrelated issues, which was a problem
			with the previous auto-debug approach. Some users' machines may be slow to
			update diagnostics, so this approach provides a good balance between automation
			and avoiding potential issues where Claude might get stuck in loops due to
			outdated problem information. If no new problems show up by the time the user
			accepts the changes, they can always debug later using the '@problems' mention.
			This way, Claude only becomes aware of new problems resulting from his edits
			and can address them accordingly. If problems don't change immediately after
			applying a fix, Claude won't be notified, which is generally fine since the
			initial fix is usually correct and it may just take time for linters to catch up.
			*/
			const postDiagnostics = vscode.languages.getDiagnostics()
			const newProblems = diagnosticsToProblemsString(getNewDiagnostics(preDiagnostics, postDiagnostics), cwd) // will be empty string if no errors/warnings
			const newProblemsMessage =
				newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""
			// await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })

			// If the edited content has different EOL characters, we don't want to show a diff with all the EOL differences.
			const newContentEOL = newContent.includes("\r\n") ? "\r\n" : "\n"
			const normalizedEditedContent = editedContent.replace(/\r\n|\n/g, newContentEOL)
			const normalizedNewContent = newContent.replace(/\r\n|\n/g, newContentEOL) // just in case the new content has a mix of varying EOL characters
			if (normalizedEditedContent !== normalizedNewContent) {
				const userDiff = diff.createPatch(relPath.toPosix(), normalizedNewContent, normalizedEditedContent)
				await this.say(
					"user_feedback_diff",
					JSON.stringify({
						tool: fileExists ? "editedExistingFile" : "newFileCreated",
						path: this.getReadablePath(relPath),
						diff: this.createPrettyPatch(relPath, normalizedNewContent, normalizedEditedContent),
					} satisfies ClaudeSayTool)
				)
				return [
					false,
					await this.formatToolResult(
						`The user made the following updates to your content:\n\n${userDiff}\n\nThe updated content, which includes both your original modifications and the user's additional edits, has been successfully saved to ${relPath.toPosix()}. (Note this does not mean you need to re-write the file with the user's changes, as they have already been applied to the file.)${newProblemsMessage}`
					),
				]
			} else {
				return [
					false,
					await this.formatToolResult(
						`The content was successfully saved to ${relPath.toPosix()}.${newProblemsMessage}`
					),
				]
			}
		} catch (error) {
			const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error writing file:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	/**
	 * Asynchronously creates all non-existing subdirectories for a given file path
	 * and collects them in an array for later deletion.
	 *
	 * @param filePath - The full path to a file.
	 * @returns A promise that resolves to an array of newly created directories.
	 */
	async createDirectoriesForFile(filePath: string): Promise<string[]> {
		const newDirectories: string[] = []
		const normalizedFilePath = path.normalize(filePath) // Normalize path for cross-platform compatibility
		const directoryPath = path.dirname(normalizedFilePath)

		let currentPath = directoryPath
		const dirsToCreate: string[] = []

		// Traverse up the directory tree and collect missing directories
		while (!(await this.exists(currentPath))) {
			dirsToCreate.push(currentPath)
			currentPath = path.dirname(currentPath)
		}

		// Create directories from the topmost missing one down to the target directory
		for (let i = dirsToCreate.length - 1; i >= 0; i--) {
			await fs.mkdir(dirsToCreate[i])
			newDirectories.push(dirsToCreate[i])
		}

		return newDirectories
	}

	/**
	 * Helper function to check if a path exists.
	 *
	 * @param path - The path to check.
	 * @returns A promise that resolves to true if the path exists, false otherwise.
	 */
	async exists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	createPrettyPatch(filename = "file", oldStr: string, newStr: string) {
		const patch = diff.createPatch(filename.toPosix(), oldStr, newStr)
		const lines = patch.split("\n")
		const prettyPatchLines = lines.slice(4)
		return prettyPatchLines.join("\n")
	}

	async closeDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff && tab.input?.original?.scheme === "claude-dev-diff"
			)

		for (const tab of tabs) {
			// trying to close dirty views results in save popup
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
		}
	}

	async readFile(relPath?: string): Promise<[boolean, ToolResponse]> {
		if (relPath === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("read_file", "path")]
		}
		this.consecutiveMistakeCount = 0
		try {
			const absolutePath = path.resolve(cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const message = JSON.stringify({
				tool: "readFile",
				path: this.getReadablePath(relPath),
				content: absolutePath,
			} satisfies ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return [
							true,
							this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images),
						]
					}
					return [true, await this.formatToolDenied()]
				}
			}

			return [false, content]
		} catch (error) {
			const errorString = `Error reading file: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error reading file:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	async listFiles(relDirPath?: string, recursiveRaw?: string): Promise<[boolean, ToolResponse]> {
		if (relDirPath === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("list_files", "path")]
		}
		this.consecutiveMistakeCount = 0
		try {
			const recursive = recursiveRaw?.toLowerCase() === "true"
			const absolutePath = path.resolve(cwd, relDirPath)
			const [files, didHitLimit] = await listFiles(absolutePath, recursive, 200)
			const result = this.formatFilesList(absolutePath, files, didHitLimit)

			const message = JSON.stringify({
				tool: recursive ? "listFilesRecursive" : "listFilesTopLevel",
				path: this.getReadablePath(relDirPath),
				content: result,
			} satisfies ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return [
							true,
							this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images),
						]
					}
					return [true, await this.formatToolDenied()]
				}
			}

			return [false, await this.formatToolResult(result)]
		} catch (error) {
			const errorString = `Error listing files and directories: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error listing files and directories:\n${
					error.message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	getReadablePath(relPath: string): string {
		// path.resolve is flexible in that it will resolve relative paths like '../../' to the cwd and even ignore the cwd if the relPath is actually an absolute path
		const absolutePath = path.resolve(cwd, relPath)
		if (arePathsEqual(cwd, path.join(os.homedir(), "Desktop"))) {
			// User opened vscode without a workspace, so cwd is the Desktop. Show the full absolute path to keep the user aware of where files are being created
			return absolutePath.toPosix()
		}
		if (arePathsEqual(path.normalize(absolutePath), path.normalize(cwd))) {
			return path.basename(absolutePath).toPosix()
		} else {
			// show the relative path to the cwd
			const normalizedRelPath = path.relative(cwd, absolutePath)
			if (absolutePath.includes(cwd)) {
				return normalizedRelPath.toPosix()
			} else {
				// we are outside the cwd, so show the absolute path (useful for when claude passes in '../../' for example)
				return absolutePath.toPosix()
			}
		}
	}

	formatFilesList(absolutePath: string, files: string[], didHitLimit: boolean): string {
		const sorted = files
			.map((file) => {
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file).toPosix()
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that claude can then explore further.
			.sort((a, b) => {
				const aParts = a.split("/") // only works if we use toPosix first
				const bParts = b.split("/")
				for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
					if (aParts[i] !== bParts[i]) {
						// If one is a directory and the other isn't at this level, sort the directory first
						if (i + 1 === aParts.length && i + 1 < bParts.length) {
							return -1
						}
						if (i + 1 === bParts.length && i + 1 < aParts.length) {
							return 1
						}
						// Otherwise, sort alphabetically
						return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
					}
				}
				// If all parts are the same up to the length of the shorter path,
				// the shorter one comes first
				return aParts.length - bParts.length
			})
		if (didHitLimit) {
			return `${sorted.join(
				"\n"
			)}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`
		} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
			return "No files found."
		} else {
			return sorted.join("\n")
		}
	}

	async listCodeDefinitionNames(relDirPath?: string): Promise<[boolean, ToolResponse]> {
		if (relDirPath === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("list_code_definition_names", "path")]
		}
		this.consecutiveMistakeCount = 0
		try {
			const absolutePath = path.resolve(cwd, relDirPath)
			const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

			const message = JSON.stringify({
				tool: "listCodeDefinitionNames",
				path: this.getReadablePath(relDirPath),
				content: result,
			} satisfies ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return [
							true,
							this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images),
						]
					}
					return [true, await this.formatToolDenied()]
				}
			}

			return [false, await this.formatToolResult(result)]
		} catch (error) {
			const errorString = `Error parsing source code definitions: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error parsing source code definitions:\n${
					error.message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	async searchFiles(relDirPath: string, regex: string, filePattern?: string): Promise<[boolean, ToolResponse]> {
		if (relDirPath === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("search_files", "path")]
		}
		if (regex === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("search_files", "regex", relDirPath)]
		}
		this.consecutiveMistakeCount = 0
		try {
			const absolutePath = path.resolve(cwd, relDirPath)
			const results = await regexSearchFiles(cwd, absolutePath, regex, filePattern)

			const message = JSON.stringify({
				tool: "searchFiles",
				path: this.getReadablePath(relDirPath),
				regex: regex,
				filePattern: filePattern,
				content: results,
			} satisfies ClaudeSayTool)

			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return [
							true,
							this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images),
						]
					}
					return [true, await this.formatToolDenied()]
				}
			}

			return [false, await this.formatToolResult(results)]
		} catch (error) {
			const errorString = `Error searching files: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error searching files:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	async inspectSite(url?: string): Promise<[boolean, ToolResponse]> {
		if (url === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("inspect_site", "url")]
		}
		this.consecutiveMistakeCount = 0
		try {
			const message = JSON.stringify({
				tool: "inspectSite",
				path: url,
			} satisfies ClaudeSayTool)

			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return [
							true,
							this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images),
						]
					}
					return [true, await this.formatToolDenied()]
				}
			}

			await this.say("inspect_site_result", "") // no result, starts the loading spinner waiting for result
			await this.urlContentFetcher.launchBrowser()
			let result: {
				screenshot: string
				logs: string
			}
			try {
				result = await this.urlContentFetcher.urlToScreenshotAndLogs(url)
			} finally {
				await this.urlContentFetcher.closeBrowser()
			}
			const { screenshot, logs } = result
			await this.say("inspect_site_result", logs, [screenshot])

			return [
				false,
				this.formatToolResponseWithImages(
					`The site has been visited, with console logs captured and a screenshot taken for your analysis.\n\nConsole logs:\n${
						logs || "(No logs)"
					}`,
					[screenshot]
				),
			]
		} catch (error) {
			const errorString = `Error inspecting site: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error inspecting site:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return [false, await this.formatToolError(errorString)]
		}
	}

	async executeCommand(
		command?: string,
		returnEmptyStringOnSuccess: boolean = false
	): Promise<[boolean, ToolResponse]> {
		if (command === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("execute_command", "command")]
		}
		this.consecutiveMistakeCount = 0
		const { response, text, images } = await this.ask("command", command)
		if (response !== "yesButtonTapped") {
			if (response === "messageResponse") {
				await this.say("user_feedback", text, images)
				return [true, this.formatToolResponseWithImages(await this.formatToolDeniedFeedback(text), images)]
			}
			return [true, await this.formatToolDenied()]
		}

		try {
			const terminalInfo = await this.terminalManager.getOrCreateTerminal(cwd)
			terminalInfo.terminal.show() // weird visual bug when creating new terminals (even manually) where there's an empty space at the top.
			const process = this.terminalManager.runCommand(terminalInfo, command)

			let userFeedback: { text?: string; images?: string[] } | undefined
			let didContinue = false
			const sendCommandOutput = async (line: string): Promise<void> => {
				try {
					const { response, text, images } = await this.ask("command_output", line)
					if (response === "yesButtonTapped") {
						// proceed while running
					} else {
						userFeedback = { text, images }
					}
					didContinue = true
					process.continue() // continue past the await
				} catch {
					// This can only happen if this ask promise was ignored, so ignore this error
				}
			}

			let result = ""
			process.on("line", (line) => {
				result += line + "\n"
				if (!didContinue) {
					sendCommandOutput(line)
				} else {
					this.say("command_output", line)
				}
			})

			let completed = false
			process.once("completed", () => {
				completed = true
			})

			process.once("no_shell_integration", async () => {
				await this.say("shell_integration_warning")
			})

			await process

			// Wait for a short delay to ensure all messages are sent to the webview
			// This delay allows time for non-awaited promises to be created and
			// for their associated messages to be sent to the webview, maintaining
			// the correct order of messages (although the webview is smart about
			// grouping command_output messages despite any gaps anyways)
			await delay(50)

			result = result.trim()

			if (userFeedback) {
				await this.say("user_feedback", userFeedback.text, userFeedback.images)
				return [
					true,
					this.formatToolResponseWithImages(
						`Command is still running in the user's terminal.${
							result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
						}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`,
						userFeedback.images
					),
				]
			}

			// for attemptCompletion, we don't want to return the command output
			if (returnEmptyStringOnSuccess) {
				return [false, ""]
			}
			if (completed) {
				return [
					false,
					await this.formatToolResult(`Command executed.${result.length > 0 ? `\nOutput:\n${result}` : ""}`),
				]
			} else {
				return [
					false,
					await this.formatToolResult(
						`Command is still running in the user's terminal.${
							result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
						}\n\nYou will be updated on the terminal status and new output in the future.`
					),
				]
			}
		} catch (error) {
			let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
			const errorString = `Error executing command:\n${errorMessage}`
			await this.say("error", `Error executing command:\n${errorMessage}`)
			return [false, await this.formatToolError(errorString)]
		}
	}

	async askFollowupQuestion(question?: string): Promise<[boolean, ToolResponse]> {
		if (question === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("ask_followup_question", "question")]
		}
		this.consecutiveMistakeCount = 0
		const { text, images } = await this.ask("followup", question)
		await this.say("user_feedback", text ?? "", images)
		return [false, this.formatToolResponseWithImages(`<answer>\n${text}\n</answer>`, images)]
	}

	async attemptCompletion(result?: string, command?: string): Promise<[boolean, ToolResponse]> {
		// result is required, command is optional
		if (result === undefined) {
			this.consecutiveMistakeCount++
			return [false, await this.sayAndCreateMissingParamError("attempt_completion", "result")]
		}
		this.consecutiveMistakeCount = 0
		let resultToSend = result
		if (command) {
			await this.say("completion_result", resultToSend)
			// TODO: currently we don't handle if this command fails, it could be useful to let claude know and retry
			const [didUserReject, commandResult] = await this.executeCommand(command, true)
			// if we received non-empty string, the command was rejected or failed
			if (commandResult) {
				return [didUserReject, commandResult]
			}
			resultToSend = ""
		}
		const { response, text, images } = await this.ask("completion_result", resultToSend) // this prompts webview to show 'new task' button, and enable text input (which would be the 'text' here)
		if (response === "yesButtonTapped") {
			return [false, ""] // signals to recursive loop to stop (for now this never happens since yesButtonTapped will trigger a new task)
		}
		await this.say("user_feedback", text ?? "", images)
		return [
			true,
			this.formatToolResponseWithImages(
				`The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
				images
			),
		]
	}

	async attemptApiRequest(): Promise<Anthropic.Messages.Message> {
		try {
			let systemPrompt = await SYSTEM_PROMPT(cwd, this.api.getModel().info.supportsImages)
			if (this.customInstructions && this.customInstructions.trim()) {
				// altering the system prompt mid-task will break the prompt cache, but in the grand scheme this will not change often so it's better to not pollute user messages with it the way we have to with <potentially relevant details>
				systemPrompt += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
			}

			// If the last API request's total token usage is close to the context window, truncate the conversation history to free up space for the new request
			const lastApiReqFinished = findLast(this.claudeMessages, (m) => m.say === "api_req_finished")
			if (lastApiReqFinished && lastApiReqFinished.text) {
				const {
					tokensIn,
					tokensOut,
					cacheWrites,
					cacheReads,
				}: { tokensIn?: number; tokensOut?: number; cacheWrites?: number; cacheReads?: number } = JSON.parse(
					lastApiReqFinished.text
				)
				const totalTokens = (tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0)
				const contextWindow = this.api.getModel().info.contextWindow
				const maxAllowedSize = Math.max(contextWindow - 40_000, contextWindow * 0.8)
				if (totalTokens >= maxAllowedSize) {
					const truncatedMessages = truncateHalfConversation(this.apiConversationHistory)
					await this.overwriteApiConversationHistory(truncatedMessages)
				}
			}
			const { message, userCredits } = await this.api.createMessage(
				systemPrompt,
				this.apiConversationHistory,
				TOOLS(cwd, this.api.getModel().info.supportsImages)
			)
			if (userCredits !== undefined) {
				console.log("Updating credits", userCredits)
				// TODO: update credits
			}
			return message
		} catch (error) {
			const { response } = await this.ask(
				"api_req_failed",
				error.message ?? JSON.stringify(serializeError(error), null, 2)
			)
			if (response !== "yesButtonTapped") {
				// this will never happen since if noButtonTapped, we will clear current task, aborting this instance
				throw new Error("API request failed")
			}
			await this.say("api_req_retried")
			return this.attemptApiRequest()
		}
	}

	async recursivelyMakeClaudeRequests(
		userContent: UserContent,
		includeFileDetails: boolean = false
	): Promise<ClaudeRequestResult> {
		if (this.abort) {
			throw new Error("ClaudeDev instance aborted")
		}

		if (this.consecutiveMistakeCount >= 3) {
			const { response, text, images } = await this.ask(
				"mistake_limit_reached",
				this.api.getModel().id.includes("claude")
					? `This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").`
					: "Claude Dev uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.5 Sonnet for its advanced agentic coding capabilities."
			)
			if (response === "messageResponse") {
				userContent.push(
					...[
						{
							type: "text",
							text: `You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n${text}\n</feedback>`,
						} as Anthropic.Messages.TextBlockParam,
						...this.formatImagesIntoBlocks(images),
					]
				)
			}
			this.consecutiveMistakeCount = 0
		}

		// getting verbose details is an expensive operation, it uses globby to top-down build file structure of project which for large projects can take a few seconds
		// for the best UX we show a placeholder api_req_started message with a loading spinner as this happens
		await this.say(
			"api_req_started",
			JSON.stringify({
				request:
					userContent
						.map((block) => formatContentBlockToMarkdown(block, this.apiConversationHistory))
						.join("\n\n") + "\n\nLoading...",
			})
		)

		// potentially expensive operations
		const [parsedUserContent, environmentDetails] = await Promise.all([
			// Process userContent array, which contains various block types:
			// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
			// We need to apply parseMentions() to:
			// 1. All TextBlockParam's text (first user message with task)
			// 2. ToolResultBlockParam's content/context text arrays if it contains "<feedback>" (see formatToolDeniedFeedback, attemptCompletion, executeCommand, and consecutiveMistakeCount >= 3) or "<answer>" (see askFollowupQuestion), we place all user generated content in these tags so they can effectively be used as markers for when we should parse mentions)
			Promise.all(
				userContent.map(async (block) => {
					if (block.type === "text") {
						return {
							...block,
							text: await parseMentions(block.text, cwd, this.urlContentFetcher),
						}
					} else if (block.type === "tool_result") {
						const isUserMessage = (text: string) => text.includes("<feedback>") || text.includes("<answer>")
						if (typeof block.content === "string" && isUserMessage(block.content)) {
							return {
								...block,
								content: await parseMentions(block.content, cwd, this.urlContentFetcher),
							}
						} else if (Array.isArray(block.content)) {
							const parsedContent = await Promise.all(
								block.content.map(async (contentBlock) => {
									if (contentBlock.type === "text" && isUserMessage(contentBlock.text)) {
										return {
											...contentBlock,
											text: await parseMentions(contentBlock.text, cwd, this.urlContentFetcher),
										}
									}
									return contentBlock
								})
							)
							return {
								...block,
								content: parsedContent,
							}
						}
					}
					return block
				})
			),
			this.getEnvironmentDetails(includeFileDetails),
		])

		userContent = parsedUserContent

		// add environment details as its own text block, separate from tool results
		userContent.push({ type: "text", text: environmentDetails })

		await this.addToApiConversationHistory({ role: "user", content: userContent })

		// since we sent off a placeholder api_req_started message to update the webview while waiting to actually start the API request (to load potential details for example), we need to update the text of that message
		const lastApiReqIndex = findLastIndex(this.claudeMessages, (m) => m.say === "api_req_started")
		this.claudeMessages[lastApiReqIndex].text = JSON.stringify({
			request: userContent
				.map((block) => formatContentBlockToMarkdown(block, this.apiConversationHistory))
				.join("\n\n"),
		})
		await this.saveClaudeMessages()
		await this.providerRef.deref()?.postStateToWebview()

		try {
			const response = await this.attemptApiRequest()

			if (this.abort) {
				throw new Error("ClaudeDev instance aborted")
			}

			let assistantResponses: Anthropic.Messages.ContentBlock[] = []
			let inputTokens = response.usage.input_tokens
			let outputTokens = response.usage.output_tokens
			let cacheCreationInputTokens =
				(response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
					.cache_creation_input_tokens || undefined
			let cacheReadInputTokens =
				(response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
					.cache_read_input_tokens || undefined
			// @ts-ignore-next-line
			let totalCost = response.usage.total_cost

			await this.say(
				"api_req_finished",
				JSON.stringify({
					tokensIn: inputTokens,
					tokensOut: outputTokens,
					cacheWrites: cacheCreationInputTokens,
					cacheReads: cacheReadInputTokens,
					cost:
						totalCost ||
						this.calculateApiCost(
							inputTokens,
							outputTokens,
							cacheCreationInputTokens,
							cacheReadInputTokens
						),
				})
			)

			// A response always returns text content blocks (it's just that before we were iterating over the completion_attempt response before we could append text response, resulting in bug)
			for (const contentBlock of response.content) {
				// type can only be text or tool_use
				if (contentBlock.type === "text") {
					assistantResponses.push(contentBlock)
					await this.say("text", contentBlock.text)
				} else if (contentBlock.type === "tool_use") {
					assistantResponses.push(contentBlock)
				}
			}

			// need to save assistant responses to file before proceeding to tool use since user can exit at any moment and we wouldn't be able to save the assistant's response
			if (assistantResponses.length > 0) {
				await this.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
			} else {
				// this should never happen! it there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
				await this.say(
					"error",
					"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output."
				)
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Failure: I did not provide a response." }],
				})
			}

			let toolResults: Anthropic.ToolResultBlockParam[] = []
			let attemptCompletionBlock: Anthropic.Messages.ToolUseBlock | undefined
			let userRejectedATool = false
			for (const contentBlock of response.content) {
				if (contentBlock.type === "tool_use") {
					const toolName = contentBlock.name as ToolName
					const toolInput = contentBlock.input
					const toolUseId = contentBlock.id

					if (userRejectedATool) {
						toolResults.push({
							type: "tool_result",
							tool_use_id: toolUseId,
							content: "Skipping tool execution due to previous tool user rejection.",
						})
						continue
					}

					if (toolName === "attempt_completion") {
						attemptCompletionBlock = contentBlock
					} else {
						const [didUserReject, result] = await this.executeTool(toolName, toolInput)
						toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })

						if (didUserReject) {
							userRejectedATool = true
						}
					}
				}
			}

			let didEndLoop = false

			// attempt_completion is always done last, since there might have been other tools that needed to be called first before the job is finished
			// it's important to note that claude will order the tools logically in most cases, so we don't have to think about which tools make sense calling before others
			if (attemptCompletionBlock) {
				let [_, result] = await this.executeTool(
					attemptCompletionBlock.name as ToolName,
					attemptCompletionBlock.input
				)
				// this.say(
				// 	"tool",
				// 	`\nattempt_completion Tool Used: ${attemptCompletionBlock.name}\nTool Input: ${JSON.stringify(
				// 		attemptCompletionBlock.input
				// 	)}\nTool Result: ${result}`
				// )
				if (result === "") {
					didEndLoop = true
					result = "The user is satisfied with the result."
				}
				toolResults.push({ type: "tool_result", tool_use_id: attemptCompletionBlock.id, content: result })
			}

			if (toolResults.length > 0) {
				if (didEndLoop) {
					await this.addToApiConversationHistory({ role: "user", content: toolResults })
					await this.addToApiConversationHistory({
						role: "assistant",
						content: [
							{
								type: "text",
								text: "I am pleased you are satisfied with the result. Do you have a new task for me?",
							},
						],
					})
				} else {
					const {
						didEndLoop: recDidEndLoop,
						inputTokens: recInputTokens,
						outputTokens: recOutputTokens,
					} = await this.recursivelyMakeClaudeRequests(toolResults)
					didEndLoop = recDidEndLoop
					inputTokens += recInputTokens
					outputTokens += recOutputTokens
				}
			}

			return { didEndLoop, inputTokens, outputTokens }
		} catch (error) {
			// this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonTapped, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
			return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
		}
	}

	// Formatting responses to Claude

	private formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
		return images
			? images.map((dataUrl) => {
					// data:image/png;base64,base64string
					const [rest, base64] = dataUrl.split(",")
					const mimeType = rest.split(":")[1].split(";")[0]
					return {
						type: "image",
						source: { type: "base64", media_type: mimeType, data: base64 },
					} as Anthropic.ImageBlockParam
			  })
			: []
	}

	private formatToolResponseWithImages(text: string, images?: string[]): ToolResponse {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = this.formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	}

	async getEnvironmentDetails(includeFileDetails: boolean = false) {
		let details = ""

		// It could be useful for claude to know if the user went from one or no file to another between messages, so we always include this context
		details += "\n\n# VSCode Visible Files"
		const visibleFiles = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
			.join("\n")
		if (visibleFiles) {
			details += `\n${visibleFiles}`
		} else {
			details += "\n(No visible files)"
		}

		details += "\n\n# VSCode Open Tabs"
		const openTabs = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(cwd, absolutePath).toPosix())
			.join("\n")
		if (openTabs) {
			details += `\n${openTabs}`
		} else {
			details += "\n(No open tabs)"
		}

		const busyTerminals = this.terminalManager.getTerminals(true)
		const inactiveTerminals = this.terminalManager.getTerminals(false)
		// const allTerminals = [...busyTerminals, ...inactiveTerminals]

		if (busyTerminals.length > 0 && this.didEditFile) {
			//  || this.didEditFile
			await delay(300) // delay after saving file to let terminals catch up
		}

		// let terminalWasBusy = false
		if (busyTerminals.length > 0) {
			// wait for terminals to cool down
			// terminalWasBusy = allTerminals.some((t) => this.terminalManager.isProcessHot(t.id))
			await pWaitFor(() => busyTerminals.every((t) => !this.terminalManager.isProcessHot(t.id)), {
				interval: 100,
				timeout: 15_000,
			}).catch(() => {})
		}

		// we want to get diagnostics AFTER terminal cools down for a few reasons: terminal could be scaffolding a project, dev servers (compilers like webpack) will first re-compile and then send diagnostics, etc
		/*
		let diagnosticsDetails = ""
		const diagnostics = await this.diagnosticsMonitor.getCurrentDiagnostics(this.didEditFile || terminalWasBusy) // if claude ran a command (ie npm install) or edited the workspace then wait a bit for updated diagnostics
		for (const [uri, fileDiagnostics] of diagnostics) {
			const problems = fileDiagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
			if (problems.length > 0) {
				diagnosticsDetails += `\n## ${path.relative(cwd, uri.fsPath)}`
				for (const diagnostic of problems) {
					// let severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"
					const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
					const source = diagnostic.source ? `[${diagnostic.source}] ` : ""
					diagnosticsDetails += `\n- ${source}Line ${line}: ${diagnostic.message}`
				}
			}
		}
		*/
		this.didEditFile = false // reset, this lets us know when to wait for saved files to update terminals

		// waiting for updated diagnostics lets terminal output be the most up-to-date possible
		let terminalDetails = ""
		if (busyTerminals.length > 0) {
			// terminals are cool, let's retrieve their output
			terminalDetails += "\n\n# Active Terminals"
			for (const busyTerminal of busyTerminals) {
				terminalDetails += `\n## ${busyTerminal.lastCommand}`
				const newOutput = this.terminalManager.getUnretrievedOutput(busyTerminal.id)
				if (newOutput) {
					terminalDetails += `\n### New Output\n${newOutput}`
				} else {
					// details += `\n(Still running, no new output)` // don't want to show this right after running the command
				}
			}
		}
		// only show inactive terminals if there's output to show
		if (inactiveTerminals.length > 0) {
			const inactiveTerminalOutputs = new Map<number, string>()
			for (const inactiveTerminal of inactiveTerminals) {
				const newOutput = this.terminalManager.getUnretrievedOutput(inactiveTerminal.id)
				if (newOutput) {
					inactiveTerminalOutputs.set(inactiveTerminal.id, newOutput)
				}
			}
			if (inactiveTerminalOutputs.size > 0) {
				terminalDetails += "\n\n# Inactive Terminals"
				for (const [terminalId, newOutput] of inactiveTerminalOutputs) {
					const inactiveTerminal = inactiveTerminals.find((t) => t.id === terminalId)
					if (inactiveTerminal) {
						terminalDetails += `\n## ${inactiveTerminal.lastCommand}`
						terminalDetails += `\n### New Output\n${newOutput}`
					}
				}
			}
		}

		// details += "\n\n# VSCode Workspace Errors"
		// if (diagnosticsDetails) {
		// 	details += diagnosticsDetails
		// } else {
		// 	details += "\n(No errors detected)"
		// }

		if (terminalDetails) {
			details += terminalDetails
		}

		if (includeFileDetails) {
			details += `\n\n# Current Working Directory (${cwd.toPosix()}) Files\n`
			const isDesktop = arePathsEqual(cwd, path.join(os.homedir(), "Desktop"))
			if (isDesktop) {
				// don't want to immediately access desktop since it would show permission popup
				details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
			} else {
				const [files, didHitLimit] = await listFiles(cwd, true, 200)
				const result = this.formatFilesList(cwd, files, didHitLimit)
				details += result
			}
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}

	async formatToolDeniedFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
	}

	async formatToolDenied() {
		return `The user denied this operation.`
	}

	async formatToolResult(result: string) {
		return result // the successful result of the tool should never be manipulated, if we need to add details it should be as a separate user text block
	}

	async formatToolError(error?: string) {
		return `The tool execution failed with the following error:\n<error>\n${error}\n</error>`
	}

	async sayAndCreateMissingParamError(toolName: ToolName, paramName: string, relPath?: string) {
		await this.say(
			"error",
			`Claude tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ""
			} without value for required parameter '${paramName}'. Retrying...`
		)
		return await this.formatToolError(
			`Missing value for required parameter '${paramName}'. Please retry with complete response.`
		)
	}
}
