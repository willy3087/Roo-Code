import * as fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"

import { RooCodeAPI } from "../../../../src/exports/roo-code.js"

import { IpcServer, ServerMessageType } from "@benchmark/ipc"
import { Language, createTask } from "@benchmark/db"

import { waitUntilReady, waitUntilCompleted, sleep } from "./utils.js"

export async function run() {
	/**
	 * Validate environment variables.
	 */

	const runId = process.env.RUN_ID ? parseInt(process.env.RUN_ID) : undefined
	const language = process.env.LANGUAGE as Language
	const exercise = process.env.EXERCISE
	const promptPath = process.env.PROMPT_PATH
	const workspacePath = process.env.WORKSPACE_PATH
	const openRouterApiKey = process.env.OPENROUTER_API_KEY
	const openRouterModelId = process.env.OPENROUTER_MODEL_ID

	if (!runId || !language || !exercise || !promptPath || !workspacePath || !openRouterApiKey || !openRouterModelId) {
		throw new Error("ENV not configured.")
	}

	const prompt = await fs.readFile(promptPath, "utf-8")

	/**
	 * Activate the extension.
	 */

	const extension = vscode.extensions.getExtension<RooCodeAPI>("RooVeterinaryInc.roo-cline")

	if (!extension) {
		throw new Error("Extension not found.")
	}

	const api = extension.isActive ? extension.exports : await extension.activate()

	/**
	 * Wait for the Roo Code to be ready to accept tasks.
	 */

	await waitUntilReady({ api })

	/**
	 * Configure Roo Code as needed.
	 *
	 * Use Claude 3.7 Sonnet via OpenRouter.
	 * Don't require approval for anything.
	 * Run any command without approval.
	 * Disable checkpoints (for performance).
	 */

	await api.setConfiguration({
		apiProvider: "openrouter",
		openRouterApiKey,
		openRouterModelId,
		autoApprovalEnabled: true,
		alwaysAllowReadOnly: true,
		alwaysAllowWrite: true,
		alwaysAllowExecute: true,
		alwaysAllowBrowser: true,
		alwaysApproveResubmit: true,
		alwaysAllowMcp: true,
		alwaysAllowModeSwitch: true,
		enableCheckpoints: false,
	})

	await vscode.workspace
		.getConfiguration("roo-cline")
		.update("allowedCommands", ["*"], vscode.ConfigurationTarget.Global)

	await sleep(1_000)

	/**
	 * Start the IPC server.
	 */

	const server = new IpcServer(`/tmp/benchmark-${runId}.sock`, () => {})
	server.listen()

	server.on("client", (id) => {
		server.send(id, {
			type: ServerMessageType.Data,
			data: {
				event: "client",
				runId,
				language,
				exercise,
				prompt,
				workspacePath,
			},
		})
	})

	api.on("taskStarted", (taskId) => {
		server.broadcast({ type: ServerMessageType.Data, data: { event: "taskStarted", taskId } })
	})

	api.on("message", ({ taskId, action, message }) => {
		server.broadcast({ type: ServerMessageType.Data, data: { event: "message", taskId, action, message } })
	})

	api.on("taskTokenUsageUpdated", (taskId, usage) => {
		server.broadcast({ type: ServerMessageType.Data, data: { event: "taskTokenUsageUpdated", taskId, usage } })
	})

	/**
	 * Run the task and wait up to 10 minutes for it to complete.
	 */

	const startTime = Date.now()
	const taskId = await api.startNewTask(prompt)
	let usage

	try {
		usage = (await waitUntilCompleted({ api, taskId, timeout: 5 * 60 * 1_000 })) || api.getTokenUsage(taskId)
	} catch (e: unknown) {
		usage = api.getTokenUsage(taskId)
		console.error(e)
	}

	const task = await createTask({
		runId,
		language,
		exercise,
		duration: Date.now() - startTime,
		tokensIn: usage.totalTokensIn,
		tokensOut: usage.totalTokensOut,
		tokensContext: usage.contextTokens,
		cacheWrites: usage.totalCacheWrites ?? 0,
		cacheReads: usage.totalCacheReads ?? 0,
		cost: usage.totalCost,
		passed: false,
	})

	await fs.writeFile(path.resolve(workspacePath, "usage.json"), JSON.stringify(task, null, 2))
}
