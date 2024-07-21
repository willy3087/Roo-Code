import React, { useEffect, useState } from "react"
import "./App.css"

import ChatView from "./components/ChatView"
import SettingsView from "./components/SettingsView"
import { ClaudeMessage, ExtensionMessage } from "@shared/ExtensionMessage"
import WelcomeView from "./components/WelcomeView"
import { vscode } from "./utilities/vscode"
//import { mockMessages } from "./utilities/mockMessages"

/*
The contents of webviews however are created when the webview becomes visible and destroyed when the webview is moved into the background. Any state inside the webview will be lost when the webview is moved to a background tab.

The best way to solve this is to make your webview stateless. Use message passing to save off the webview's state and then restore the state when the webview becomes visible again.


*/

const App: React.FC = () => {
	const [showSettings, setShowSettings] = useState(false)
	const [showWelcome, setShowWelcome] = useState<boolean>(false)
	const [apiKey, setApiKey] = useState<string>("")
	const [maxRequestsPerTask, setMaxRequestsPerTask] = useState<string>("")
	const [vscodeThemeName, setVscodeThemeName] = useState<string | undefined>(undefined)
	const [claudeMessages, setClaudeMessages] = useState<ClaudeMessage[]>([])

	useEffect(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })

		const handleMessage = (e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			// switch message.type
			switch (message.type) {
				case "state":
					const shouldShowWelcome = !message.state!.didOpenOnce || !message.state!.apiKey
					setShowWelcome(shouldShowWelcome)
					setApiKey(message.state!.apiKey || "")
					setMaxRequestsPerTask(
						message.state!.maxRequestsPerTask !== undefined
							? message.state!.maxRequestsPerTask.toString()
							: ""
					)
					setVscodeThemeName(message.state!.themeName)
					setClaudeMessages(message.state!.claudeMessages)
					break
				case "action":
					switch (message.action!) {
						case "settingsButtonTapped":
							setShowSettings(true)
							break
						case "plusButtonTapped":
							setShowSettings(false)
							break
					}
					break
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	return (
		<>
			{showWelcome ? (
				<WelcomeView apiKey={apiKey} setApiKey={setApiKey} />
			) : (
				<>
					{showSettings && (
						<SettingsView
							apiKey={apiKey}
							setApiKey={setApiKey}
							maxRequestsPerTask={maxRequestsPerTask}
							setMaxRequestsPerTask={setMaxRequestsPerTask}
							onDone={() => setShowSettings(false)}
						/>
					)}
					{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
					<ChatView messages={claudeMessages} isHidden={showSettings} vscodeThemeName={vscodeThemeName} />
				</>
			)}
		</>
	)
}

export default App
