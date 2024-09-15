import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import DynamicTextArea from "react-textarea-autosize"
import { useEvent, useMount } from "react-use"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"
import { ClaudeAsk, ClaudeSayTool, ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { combineApiRequests } from "../../../src/shared/combineApiRequests"
import { combineCommandSequences } from "../../../src/shared/combineCommandSequences"
import { getApiMetrics } from "../../../src/shared/getApiMetrics"
import { useExtensionState } from "../context/ExtensionStateContext"
import { vscode } from "../utils/vscode"
import Announcement from "./Announcement"
import ChatRow from "./ChatRow"
import HistoryPreview from "./HistoryPreview"
import TaskHeader from "./TaskHeader"
import Thumbnails from "./Thumbnails"
import { normalizeApiConfiguration } from "./ApiOptions"

interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	hideAnnouncement: () => void
	showHistoryView: () => void
}

const MAX_IMAGES_PER_MESSAGE = 20 // Anthropic limits to 20 images

const ChatView = ({ isHidden, showAnnouncement, hideAnnouncement, showHistoryView }: ChatViewProps) => {
	const { version, claudeMessages: messages, taskHistory, apiConfiguration } = useExtensionState()

	//const task = messages.length > 0 ? (messages[0].say === "task" ? messages[0] : undefined) : undefined) : undefined
	const task = messages.length > 0 ? messages[0] : undefined // leaving this less safe version here since if the first message is not a task, then the extension is in a bad state and needs to be debugged (see ClaudeDev.abort)
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	// has to be after api_req_finished are all reduced into api_req_started messages
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])

	const [inputValue, setInputValue] = useState("")
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [isTextAreaFocused, setIsTextAreaFocused] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])
	const [thumbnailsHeight, setThumbnailsHeight] = useState(0)
	const [textAreaBaseHeight, setTextAreaBaseHeight] = useState<number | undefined>(undefined)

	// we need to hold on to the ask because useEffect > lastMessage will always let us know when an ask comes in and handle it, but by the time handleMessage is called, the last message might not be the ask anymore (it could be a say that followed)
	const [claudeAsk, setClaudeAsk] = useState<ClaudeAsk | undefined>(undefined)

	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const [isAtBottom, setIsAtBottom] = useState(false)
	const [didScrollFromApiReqTs, setDidScrollFromApiReqTs] = useState<number | undefined>(undefined)

	useEffect(() => {
		// if last message is an ask, show user ask UI

		// if user finished a task, then start a new task with a new conversation history since in this moment that the extension is waiting for user response, the user could close the extension and the conversation history would be lost.
		// basically as long as a task is active, the conversation history will be persisted

		const lastMessage = messages.at(-1)
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					switch (lastMessage.ask) {
						case "api_req_failed":
							setTextAreaDisabled(true)
							setClaudeAsk("api_req_failed")
							setEnableButtons(true)
							setPrimaryButtonText("Retry")
							setSecondaryButtonText("Start New Task")
							break
						case "mistake_limit_reached":
							setTextAreaDisabled(false)
							setClaudeAsk("mistake_limit_reached")
							setEnableButtons(true)
							setPrimaryButtonText("Proceed Anyways")
							setSecondaryButtonText("Start New Task")
							break
						case "followup":
							setTextAreaDisabled(false)
							setClaudeAsk("followup")
							setEnableButtons(false)
							// setPrimaryButtonText(undefined)
							// setSecondaryButtonText(undefined)
							break
						case "tool":
							setTextAreaDisabled(false)
							setClaudeAsk("tool")
							setEnableButtons(true)
							const tool = JSON.parse(lastMessage.text || "{}") as ClaudeSayTool
							switch (tool.tool) {
								case "editedExistingFile":
								case "newFileCreated":
									setPrimaryButtonText("Save")
									setSecondaryButtonText("Reject")
									break
								default:
									setPrimaryButtonText("Approve")
									setSecondaryButtonText("Reject")
									break
							}
							break
						case "command":
							setTextAreaDisabled(false)
							setClaudeAsk("command")
							setEnableButtons(true)
							setPrimaryButtonText("Run Command")
							setSecondaryButtonText("Reject")
							break
						case "command_output":
							setTextAreaDisabled(false)
							setClaudeAsk("command_output")
							setEnableButtons(true)
							setPrimaryButtonText("Proceed While Running")
							setSecondaryButtonText(undefined)
							break
						case "completion_result":
							// extension waiting for feedback. but we can just present a new task button
							setTextAreaDisabled(false)
							setClaudeAsk("completion_result")
							setEnableButtons(true)
							setPrimaryButtonText("Start New Task")
							setSecondaryButtonText(undefined)
							break
						case "resume_task":
							setTextAreaDisabled(false)
							setClaudeAsk("resume_task")
							setEnableButtons(true)
							setPrimaryButtonText("Resume Task")
							setSecondaryButtonText(undefined)
							break
						case "resume_completed_task":
							setTextAreaDisabled(false)
							setClaudeAsk("resume_completed_task")
							setEnableButtons(true)
							setPrimaryButtonText("Start New Task")
							setSecondaryButtonText(undefined)
							break
					}
					break
				case "say":
					// don't want to reset since there could be a "say" after an "ask" while ask is waiting for response
					switch (lastMessage.say) {
						case "api_req_started":
							if (messages.at(-2)?.ask === "command_output") {
								// if the last ask is a command_output, and we receive an api_req_started, then that means the command has finished and we don't need input from the user anymore (in every other case, the user has to interact with input field or buttons to continue, which does the following automatically)
								setInputValue("")
								setTextAreaDisabled(true)
								setSelectedImages([])
								setClaudeAsk(undefined)
								setEnableButtons(false)
							}
							break
						case "task":
						case "error":
						case "api_req_finished":
						case "text":
						case "command_output":
						case "completion_result":
						case "tool":
							break
					}
					break
			}
		} else {
			// this would get called after sending the first message, so we have to watch messages.length instead
			// No messages, so user has to submit a task
			// setTextAreaDisabled(false)
			// setClaudeAsk(undefined)
			// setPrimaryButtonText(undefined)
			// setSecondaryButtonText(undefined)
		}
	}, [messages])

	useEffect(() => {
		if (messages.length === 0) {
			setTextAreaDisabled(false)
			setClaudeAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages.length])

	const handleSendMessage = useCallback(() => {
		const text = inputValue.trim()
		if (text || selectedImages.length > 0) {
			if (messages.length === 0) {
				vscode.postMessage({ type: "newTask", text, images: selectedImages })
			} else if (claudeAsk) {
				switch (claudeAsk) {
					case "followup":
					case "tool":
					case "command": // user can provide feedback to a tool or command use
					case "command_output": // user can send input to command stdin
					case "completion_result": // if this happens then the user has feedback for the completion result
					case "resume_task":
					case "resume_completed_task":
					case "mistake_limit_reached":
						vscode.postMessage({
							type: "askResponse",
							askResponse: "messageResponse",
							text,
							images: selectedImages,
						})
						break
					// there is no other case that a textfield should be enabled
				}
			}
			setInputValue("")
			setTextAreaDisabled(true)
			setSelectedImages([])
			setClaudeAsk(undefined)
			setEnableButtons(false)
			// setPrimaryButtonText(undefined)
			// setSecondaryButtonText(undefined)
		}
	}, [inputValue, selectedImages, messages.length, claudeAsk])

	const startNewTask = useCallback(() => {
		vscode.postMessage({ type: "clearTask" })
	}, [])

	/*
	This logic depends on the useEffect[messages] above to set claudeAsk, after which buttons are shown and we then send an askResponse to the extension.
	*/
	const handlePrimaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "api_req_failed":
			case "command":
			case "command_output":
			case "tool":
			case "resume_task":
			case "mistake_limit_reached":
				vscode.postMessage({ type: "askResponse", askResponse: "yesButtonTapped" })
				break
			case "completion_result":
			case "resume_completed_task":
				// extension waiting for feedback. but we can just present a new task button
				startNewTask()
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
		// setPrimaryButtonText(undefined)
		// setSecondaryButtonText(undefined)
	}, [claudeAsk, startNewTask])

	const handleSecondaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "api_req_failed":
			case "mistake_limit_reached":
				startNewTask()
				break
			case "command":
			case "tool":
				// responds to the API with a "This operation failed" and lets it try again
				vscode.postMessage({ type: "askResponse", askResponse: "noButtonTapped" })
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
		// setPrimaryButtonText(undefined)
		// setSecondaryButtonText(undefined)
	}, [claudeAsk, startNewTask])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			const isComposing = event.nativeEvent?.isComposing ?? false
			if (event.key === "Enter" && !event.shiftKey && !isComposing) {
				event.preventDefault()
				handleSendMessage()
			}
		},
		[handleSendMessage]
	)

	const handleTaskCloseButtonClick = useCallback(() => {
		startNewTask()
	}, [startNewTask])

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	const selectImages = useCallback(() => {
		vscode.postMessage({ type: "selectImages" })
	}, [])

	const shouldDisableImages =
		!selectedModelInfo.supportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handlePaste = useCallback(
		async (e: React.ClipboardEvent) => {
			const items = e.clipboardData.items
			const acceptedTypes = ["png", "jpeg", "webp"] // supported by anthropic and openrouter (jpg is just a file extension but the image will be recognized as jpeg)
			const imageItems = Array.from(items).filter((item) => {
				const [type, subtype] = item.type.split("/")
				return type === "image" && acceptedTypes.includes(subtype)
			})
			if (!shouldDisableImages && imageItems.length > 0) {
				e.preventDefault()
				const imagePromises = imageItems.map((item) => {
					return new Promise<string | null>((resolve) => {
						const blob = item.getAsFile()
						if (!blob) {
							resolve(null)
							return
						}
						const reader = new FileReader()
						reader.onloadend = () => {
							if (reader.error) {
								console.error("Error reading file:", reader.error)
								resolve(null)
							} else {
								const result = reader.result
								resolve(typeof result === "string" ? result : null)
							}
						}
						reader.readAsDataURL(blob)
					})
				})
				const imageDataArray = await Promise.all(imagePromises)
				const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
				//.map((dataUrl) => dataUrl.split(",")[1]) // strip the mime type prefix, sharp doesn't need it
				if (dataUrls.length > 0) {
					setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
				} else {
					console.warn("No valid images were processed")
				}
			}
		},
		[shouldDisableImages, setSelectedImages]
	)

	useEffect(() => {
		if (selectedImages.length === 0) {
			setThumbnailsHeight(0)
		}
	}, [selectedImages])

	const handleThumbnailsHeightChange = useCallback((height: number) => {
		setThumbnailsHeight(height)
	}, [])

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			switch (message.type) {
				case "action":
					switch (message.action!) {
						case "didBecomeVisible":
							if (!isHidden && !textAreaDisabled && !enableButtons) {
								textAreaRef.current?.focus()
							}
							break
					}
					break
				case "selectedImages":
					const newImages = message.images ?? []
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE)
						)
					}
					break
			}
			// textAreaRef.current is not explicitly required here since react gaurantees that ref will be stable across re-renders, and we're not using its value but its reference.
		},
		[isHidden, textAreaDisabled, enableButtons]
	)

	useEvent("message", handleMessage)

	useMount(() => {
		// NOTE: the vscode window needs to be focused for this to work
		textAreaRef.current?.focus()
	})

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => {
			clearTimeout(timer)
		}
	}, [isHidden, textAreaDisabled, enableButtons])

	const visibleMessages = useMemo(() => {
		return modifiedMessages.filter((message) => {
			switch (message.ask) {
				case "completion_result":
					// don't show a chat row for a completion_result ask without text. This specific type of message only occurs if Claude wants to execute a command as part of its completion result, in which case we interject the completion_result tool with the execute_command tool.
					if (message.text === "") {
						return false
					}
					break
				case "api_req_failed": // this message is used to update the latest api_req_started that the request failed
				case "resume_task":
				case "resume_completed_task":
					return false
			}
			switch (message.say) {
				case "api_req_finished": // combineApiRequests removes this from modifiedMessages anyways
				case "api_req_retried": // this message is used to update the latest api_req_started that the request was retried
					return false
				case "text":
					// Sometimes Claude returns an empty text message, we don't want to render these. (We also use a say text for user messages, so in case they just sent images we still render that)
					if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
						return false
					}
					break
			}
			return true
		})
	}, [modifiedMessages])

	const toggleRowExpansion = useCallback(
		(ts: number) => {
			const isCollapsing = expandedRows[ts] ?? false
			const isLastMessage = visibleMessages.at(-1)?.ts === ts
			setExpandedRows((prev) => ({
				...prev,
				[ts]: !prev[ts],
			}))

			if (isCollapsing && isAtBottom) {
				const timer = setTimeout(() => {
					virtuosoRef.current?.scrollToIndex({
						index: visibleMessages.length - 1,
						align: "end",
					})
				}, 0)
				return () => clearTimeout(timer)
			} else if (isLastMessage) {
				if (isCollapsing) {
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: visibleMessages.length - 1,
							align: "end",
						})
					}, 0)
					return () => clearTimeout(timer)
				} else {
					const timer = setTimeout(() => {
						virtuosoRef.current?.scrollToIndex({
							index: visibleMessages.length - 1,
							align: "start",
						})
					}, 0)
					return () => clearTimeout(timer)
				}
			}
		},
		[isAtBottom, visibleMessages, expandedRows]
	)

	useEffect(() => {
		// dont scroll if we're just updating the api req started informational body
		const lastMessage = visibleMessages.at(-1)
		const isLastApiReqStarted = lastMessage?.say === "api_req_started"
		if (didScrollFromApiReqTs && isLastApiReqStarted && lastMessage?.ts === didScrollFromApiReqTs) {
			return
		}

		// We use a setTimeout to ensure new content is rendered before scrolling to the bottom. virtuoso's followOutput would scroll to the bottom before the new content could render.
		const timer = setTimeout(() => {
			// TODO: we can use virtuoso's isAtBottom to prevent scrolling if user is scrolled up, and show a 'scroll to bottom' button for better UX
			// NOTE: scroll to bottom may not work if you use margin, see virtuoso's troubleshooting
			virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
			setDidScrollFromApiReqTs(isLastApiReqStarted ? lastMessage?.ts : undefined) // need to do this in timer since this effect can get called a few times simultaneously
		}, 50)

		return () => clearTimeout(timer)
	}, [visibleMessages, didScrollFromApiReqTs])

	const placeholderText = useMemo(() => {
		const text = task ? "Type a message..." : "Type your task here..."
		return text
	}, [task])

	const itemContent = useCallback(
		(index: number, message: any) => (
			<ChatRow
				key={message.ts}
				message={message}
				isExpanded={expandedRows[message.ts] || false}
				onToggleExpand={() => toggleRowExpansion(message.ts)}
				lastModifiedMessage={modifiedMessages.at(-1)}
				isLast={index === visibleMessages.length - 1}
			/>
		),
		[expandedRows, modifiedMessages, visibleMessages.length, toggleRowExpansion]
	)

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: isHidden ? "none" : "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			{task ? (
				<TaskHeader
					task={task}
					tokensIn={apiMetrics.totalTokensIn}
					tokensOut={apiMetrics.totalTokensOut}
					doesModelSupportPromptCache={selectedModelInfo.supportsPromptCache}
					cacheWrites={apiMetrics.totalCacheWrites}
					cacheReads={apiMetrics.totalCacheReads}
					totalCost={apiMetrics.totalCost}
					onClose={handleTaskCloseButtonClick}
				/>
			) : (
				<div
					style={{
						flexGrow: 1,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
					}}>
					{showAnnouncement && <Announcement version={version} hideAnnouncement={hideAnnouncement} />}
					<div style={{ padding: "0 20px", flexShrink: 0 }}>
						<h2>What can I do for you?</h2>
						<p>
							Thanks to{" "}
							<VSCodeLink
								href="https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf"
								style={{ display: "inline" }}>
								Claude 3.5 Sonnet's agentic coding capabilities,
							</VSCodeLink>{" "}
							I can handle complex software development tasks step-by-step. With tools that let me create
							& edit files, explore complex projects, and execute terminal commands (after you grant
							permission), I can assist you in ways that go beyond simple code completion or tech support.
						</p>
					</div>
					{taskHistory.length > 0 && <HistoryPreview showHistoryView={showHistoryView} />}
				</div>
			)}
			{task && (
				<>
					<Virtuoso
						ref={virtuosoRef}
						className="scrollable"
						style={{
							flexGrow: 1,
							overflowY: "scroll", // always show scrollbar
						}}
						// followOutput={(isAtBottom) => {
						// 	const lastMessage = modifiedMessages.at(-1)
						// 	if (lastMessage && shouldShowChatRow(lastMessage)) {
						// 		return "smooth"
						// 	}
						// 	return false
						// }}
						// increasing top by 1_000 to prevent jumping around when user collapses a row
						increaseViewportBy={{ top: 1_000, bottom: Number.MAX_SAFE_INTEGER }} // hack to make sure the last message is always rendered to get truly perfect scroll to bottom animation when new messages are added (Number.MAX_SAFE_INTEGER is safe for arithmetic operations, which is all virtuoso uses this value for in src/sizeRangeSystem.ts)
						data={visibleMessages} // messages is the raw format returned by extension, modifiedMessages is the manipulated structure that combines certain messages of related type, and visibleMessages is the filtered structure that removes messages that should not be rendered
						itemContent={itemContent}
						atBottomStateChange={setIsAtBottom}
						atBottomThreshold={100}
					/>
					<div
						style={{
							opacity: primaryButtonText || secondaryButtonText ? (enableButtons ? 1 : 0.5) : 0,
							display: "flex",
							padding: "10px 15px 0px 15px",
						}}>
						{primaryButtonText && (
							<VSCodeButton
								appearance="primary"
								disabled={!enableButtons}
								style={{
									flex: secondaryButtonText ? 1 : 2,
									marginRight: secondaryButtonText ? "6px" : "0",
								}}
								onClick={handlePrimaryButtonClick}>
								{primaryButtonText}
							</VSCodeButton>
						)}
						{secondaryButtonText && (
							<VSCodeButton
								appearance="secondary"
								disabled={!enableButtons}
								style={{ flex: 1, marginLeft: "6px" }}
								onClick={handleSecondaryButtonClick}>
								{secondaryButtonText}
							</VSCodeButton>
						)}
					</div>
				</>
			)}

			<div
				style={{
					padding: "10px 15px",
					opacity: textAreaDisabled ? 0.5 : 1,
					position: "relative",
					display: "flex",
				}}>
				{!isTextAreaFocused && (
					<div
						style={{
							position: "absolute",
							inset: "10px 15px",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: 2,
							pointerEvents: "none",
						}}
					/>
				)}
				<DynamicTextArea
					ref={textAreaRef}
					value={inputValue}
					disabled={textAreaDisabled}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsTextAreaFocused(true)}
					onBlur={() => setIsTextAreaFocused(false)}
					onPaste={handlePaste}
					onHeightChange={(height, meta) => {
						if (textAreaBaseHeight === undefined || height < textAreaBaseHeight) {
							setTextAreaBaseHeight(height)
						}
						//virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" })
						virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "auto" })
					}}
					placeholder={placeholderText}
					maxRows={10}
					autoFocus={true}
					style={{
						width: "100%",
						boxSizing: "border-box",
						backgroundColor: "var(--vscode-input-background)",
						color: "var(--vscode-input-foreground)",
						//border: "1px solid var(--vscode-input-border)",
						borderRadius: 2,
						fontFamily: "var(--vscode-font-family)",
						fontSize: "var(--vscode-editor-font-size)",
						lineHeight: "var(--vscode-editor-line-height)",
						resize: "none",
						overflow: "hidden",
						// Since we have maxRows, when text is long enough it starts to overflow the bottom padding, appearing behind the thumbnails. To fix this, we use a transparent border to push the text up instead. (https://stackoverflow.com/questions/42631947/maintaining-a-padding-inside-of-text-area/52538410#52538410)
						borderTop: "9px solid transparent",
						borderBottom: `${thumbnailsHeight + 9}px solid transparent`,
						borderColor: "transparent",
						// borderRight: "54px solid transparent",
						// borderLeft: "9px solid transparent", // NOTE: react-textarea-autosize doesn't calculate correct height when using borderLeft/borderRight so we need to use horizontal padding instead
						// Instead of using boxShadow, we use a div with a border to better replicate the behavior when the textarea is focused
						// boxShadow: "0px 0px 0px 1px var(--vscode-input-border)",
						padding: "0 49px 0 9px",
						cursor: textAreaDisabled ? "not-allowed" : undefined,
						flex: 1,
					}}
				/>
				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						onHeightChange={handleThumbnailsHeightChange}
						style={{
							position: "absolute",
							paddingTop: 4,
							bottom: 14,
							left: 22,
							right: 67, // (54 + 9) + 4 extra padding
						}}
					/>
				)}
				<div
					style={{
						position: "absolute",
						right: 23,
						display: "flex",
						alignItems: "flex-center",
						height: textAreaBaseHeight || 31,
						bottom: 9, // should be 10 but doesnt look good on mac
					}}>
					<div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
						<div
							className={`input-icon-button ${
								shouldDisableImages ? "disabled" : ""
							} codicon codicon-device-camera`}
							onClick={() => {
								if (!shouldDisableImages) {
									selectImages()
								}
							}}
							style={{
								marginRight: 5.5,
								fontSize: 16.5,
							}}
						/>
						<div
							className={`input-icon-button ${textAreaDisabled ? "disabled" : ""} codicon codicon-send`}
							onClick={() => {
								if (!textAreaDisabled) {
									handleSendMessage()
								}
							}}
							style={{ fontSize: 15 }}></div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ChatView
