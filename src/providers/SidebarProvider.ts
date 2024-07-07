import { getUri } from "../utilities/getUri"
import { getNonce } from "../utilities/getNonce"
//import * as weather from "weather-js"
import * as vscode from "vscode"
import { ExtensionMessage } from "../shared/ExtensionMessage"
import { WebviewMessage } from "../shared/WebviewMessage"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

type ExtensionSecretKey = "apiKey"
type ExtensionGlobalStateKey = "didOpenOnce" | "maxRequestsPerTask"

export class SidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "claude-dev.SidebarProvider"

	private _view?: vscode.WebviewView

	constructor(private readonly context: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		token: vscode.CancellationToken
	): void | Thenable<void> {
		this._view = webviewView

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}
		webviewView.webview.html = this.getHtmlContent(webviewView.webview)

		// Sets up an event listener to listen for messages passed from the webview view context
		// and executes code based on the message that is recieved
		this._setWebviewMessageListener(webviewView.webview)
	}

	// Send any JSON serializable data to the react app
	postMessageToWebview(message: ExtensionMessage) {
		this._view?.webview.postMessage(message)
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
	private _setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			switch (message.type) {
				case "webviewDidLaunch":
					await this.updateGlobalState("didOpenOnce", true)
					await this.postWebviewState()
					break
				case "text":
					// Code that should run in response to the hello message command
					vscode.window.showInformationMessage(message.text!)

					// Send a message to our webview.
					// You can send any JSON serializable data.
					// Could also do this in extension .ts
					this.postMessageToWebview({ type: "text", text: `Extension: ${Date.now()}` })
					break
				case "apiKey":
					await this.storeSecret("apiKey", message.text!)
					await this.postWebviewState()
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
					await this.postWebviewState()
					break
				// Add more switch case statements here as more webview message commands
				// are created within the webview context (i.e. inside media/main.js)
			}
		})
	}

	private async postWebviewState() {
		const [didOpenOnce, apiKey, maxRequestsPerTask] = await Promise.all([
			this.getGlobalState("didOpenOnce") as Promise<boolean | undefined>,
			this.getSecret("apiKey") as Promise<string | undefined>,
			this.getGlobalState("maxRequestsPerTask") as Promise<number | undefined>,
		])
		this.postMessageToWebview({
			type: "webviewState",
			webviewState: { didOpenOnce: !!didOpenOnce, apiKey: apiKey, maxRequestsPerTask: maxRequestsPerTask },
		})
	}

	/*
	Storage
	https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco
	https://www.eliostruyf.com/devhack-code-extension-storage-options/
	*/

	private async updateGlobalState(key: ExtensionGlobalStateKey, value: any) {
		await this.context.globalState.update(key, value)
	}

	private async getGlobalState(key: ExtensionGlobalStateKey) {
		return await this.context.globalState.get(key)
	}

	private async storeSecret(key: ExtensionSecretKey, value: any) {
		await this.context.secrets.store(key, value)
	}

	private async getSecret(key: ExtensionSecretKey) {
		return await this.context.secrets.get(key)
	}
}
