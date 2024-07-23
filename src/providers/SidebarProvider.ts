import { Uri, Webview } from "vscode"
//import * as weather from "weather-js"
import * as vscode from "vscode"
import { ClaudeMessage, ExtensionMessage } from "../shared/ExtensionMessage"
import { WebviewMessage } from "../shared/WebviewMessage"
import { ClaudeDev } from "../ClaudeDev"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

type ExtensionSecretKey = "apiKey"
type ExtensionGlobalStateKey = "didOpenOnce" | "maxRequestsPerTask"
type ExtensionWorkspaceStateKey = "claudeMessages"

export class SidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "claude-dev.SidebarProvider"

	private view?: vscode.WebviewView
	private claudeDev?: ClaudeDev

	constructor(private readonly context: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		token: vscode.CancellationToken
	): void | Thenable<void> {
		this.view = webviewView

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}
		webviewView.webview.html = this.getHtmlContent(webviewView.webview)

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is recieved
		this.setWebviewMessageListener(webviewView.webview)

		// Listen for when the panel becomes visible
		// https://github.com/microsoft/vscode-discussions/discussions/840
		webviewView.onDidChangeVisibility((e: any) => {
			if (e && e.visible) {
				// Your view is visible
				this.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
			} else {
				// Your view is hidden
			}
		})

		// Listen for when color changes
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("workbench.colorTheme")) {
				// Sends latest theme name to webview
				this.postStateToWebview()
			}
		})

		// if the extension is starting a new session, clear previous task state
		this.clearTask()
	}

	async tryToInitClaudeDevWithTask(task: string) {
		const [apiKey, maxRequestsPerTask] = await Promise.all([
			this.getSecret("apiKey") as Promise<string | undefined>,
			this.getGlobalState("maxRequestsPerTask") as Promise<number | undefined>,
		])
		if (this.view && apiKey) {
			this.claudeDev = new ClaudeDev(this, task, apiKey, maxRequestsPerTask)
		}
	}

	// Send any JSON serializable data to the react app
	async postMessageToWebview(message: ExtensionMessage) {
		await this.view?.webview.postMessage(message)
	}

	/**
	 * Defines and returns the HTML that should be rendered within the webview panel.
	 *
	 * @remarks This is also the place where references to the React webview build files
	 * are created and inserted into the webview HTML.
	 *
	 * @param webview A reference to the extension webview
	 * @param extensionUri The URI of the directory containing the extension
	 * @returns A template string literal containing the HTML that should be
	 * rendered within the webview panel
	 */
	private getHtmlContent(webview: vscode.Webview): string {
		// Get the local path to main script run in the webview,
		// then convert it to a uri we can use in the webview.

		// The CSS file from the React build output
		const stylesUri = getUri(webview, this.context.extensionUri, [
			"webview-ui",
			"build",
			"static",
			"css",
			"main.css",
		])
		// The JS file from the React build output
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "static", "js", "main.js"])

		// The codicon font from the React build output
		// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-codicons-sample/src/extension.ts
		// we installed this package in the extension so that we can access it how its intended from the extension (the font file is likely bundled in vscode), and we just import the css fileinto our react app we don't have access to it
		// don't forget to add font-src ${webview.cspSource};
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		// const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "assets", "main.js"))

		// const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "assets", "reset.css"))
		// const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "assets", "vscode.css"))

		// // Same for stylesheet
		// const stylesheetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "assets", "main.css"))

		// Use a nonce to only allow a specific script to be run.
		/*
        content security policy of your webview to only allow scripts that have a specific nonce
        create a content security policy meta tag so that only loading scripts with a nonce is allowed
        As your extension grows you will likely want to add custom styles, fonts, and/or images to your webview. If you do, you will need to update the content security policy meta tag to explicity allow for these resources. E.g.
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">


        in meta tag we add nonce attribute: A cryptographic nonce (only used once) to allow scripts. The server must generate a unique nonce value each time it transmits a policy. It is critical to provide a nonce that cannot be guessed as bypassing a resource's policy is otherwise trivial.
        */
		const nonce = getNonce()

		// Tip: Install the es6-string-html VS Code extension to enable code highlighting below
		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
            <title>Claude Dev</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is recieved.
	 *
	 * @param webview A reference to the extension webview
	 * @param context A reference to the extension context
	 */
	private setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			switch (message.type) {
				case "webviewDidLaunch":
					await this.updateGlobalState("didOpenOnce", true)
					await this.postStateToWebview()
					break
				case "newTask":
					// Code that should run in response to the hello message command
					//vscode.window.showInformationMessage(message.text!)

					// Send a message to our webview.
					// You can send any JSON serializable data.
					// Could also do this in extension .ts
					//this.postMessageToWebview({ type: "text", text: `Extension: ${Date.now()}` })
					// initializing new instance of ClaudeDev will make sure that any agentically running promises in old instance don't affect our new task. this essentially creates a fresh slate for the new task
					await this.tryToInitClaudeDevWithTask(message.text!)
					break
				case "apiKey":
					await this.storeSecret("apiKey", message.text!)
					this.claudeDev?.updateApiKey(message.text!)
					await this.postStateToWebview()
					break
				case "maxRequestsPerTask":
					let result: number | undefined = undefined
					if (message.text && message.text.trim()) {
						const num = Number(message.text)
						if (!isNaN(num)) {
							result = num
						}
					}
					await this.updateGlobalState("maxRequestsPerTask", result)
					this.claudeDev?.updateMaxRequestsPerTask(result)
					await this.postStateToWebview()
					break
				case "askResponse":
					this.claudeDev?.handleWebviewAskResponse(message.askResponse!, message.text)
					break
				case "clearTask":
					await this.clearTask()
					await this.postStateToWebview()
					break
				// Add more switch case statements here as more webview message commands
				// are created within the webview context (i.e. inside media/main.js)
			}
		})
	}

	async postStateToWebview() {
		const [didOpenOnce, apiKey, maxRequestsPerTask, claudeMessages] = await Promise.all([
			this.getGlobalState("didOpenOnce") as Promise<boolean | undefined>,
			this.getSecret("apiKey") as Promise<string | undefined>,
			this.getGlobalState("maxRequestsPerTask") as Promise<number | undefined>,
			this.getClaudeMessages(),
		])
		this.postMessageToWebview({
			type: "state",
			state: {
				didOpenOnce: !!didOpenOnce,
				apiKey,
				maxRequestsPerTask,
				themeName: vscode.workspace.getConfiguration("workbench").get<string>("colorTheme"),
				claudeMessages,
			},
		})
	}

	async clearTask() {
		if (this.claudeDev) {
			this.claudeDev.abort = true // will stop any agentically running promises
			this.claudeDev = undefined // removes reference to it, so once promises end it will be garbage collected
		}
		await this.setClaudeMessages([])
	}

	// client messages

	async getClaudeMessages(): Promise<ClaudeMessage[]> {
		const messages = (await this.getWorkspaceState("claudeMessages")) as ClaudeMessage[]
		return messages || []
	}

	async setClaudeMessages(messages: ClaudeMessage[] | undefined) {
		await this.updateWorkspaceState("claudeMessages", messages)
	}

	async addClaudeMessage(message: ClaudeMessage): Promise<ClaudeMessage[]> {
		const messages = await this.getClaudeMessages()
		messages.push(message)
		await this.setClaudeMessages(messages)
		return messages
	}

	// api conversation history

	// async getApiConversationHistory(): Promise<ClaudeMessage[]> {
	// 	const messages = (await this.getWorkspaceState("apiConversationHistory")) as ClaudeMessage[]
	// 	return messages || []
	// }

	// async setApiConversationHistory(messages: ClaudeMessage[] | undefined) {
	// 	await this.updateWorkspaceState("apiConversationHistory", messages)
	// }

	// async addMessageToApiConversationHistory(message: ClaudeMessage): Promise<ClaudeMessage[]> {
	// 	const messages = await this.getClaudeMessages()
	// 	messages.push(message)
	// 	await this.setClaudeMessages(messages)
	// 	return messages
	// }

	/*
	Storage
	https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco
	https://www.eliostruyf.com/devhack-code-extension-storage-options/
	*/

	// global

	private async updateGlobalState(key: ExtensionGlobalStateKey, value: any) {
		await this.context.globalState.update(key, value)
	}

	private async getGlobalState(key: ExtensionGlobalStateKey) {
		return await this.context.globalState.get(key)
	}

	// workspace

	private async updateWorkspaceState(key: ExtensionWorkspaceStateKey, value: any) {
		await this.context.workspaceState.update(key, value)
	}

	private async getWorkspaceState(key: ExtensionWorkspaceStateKey) {
		return await this.context.workspaceState.get(key)
	}

	// secrets

	private async storeSecret(key: ExtensionSecretKey, value: any) {
		await this.context.secrets.store(key, value)
	}

	private async getSecret(key: ExtensionSecretKey) {
		return await this.context.secrets.get(key)
	}
}

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
	let text = ""
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: Webview, extensionUri: Uri, pathList: string[]) {
	return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList))
}
