import { EventEmitter } from "events"
import pWaitFor from "p-wait-for"
import stripAnsi from "strip-ansi"
import * as vscode from "vscode"

/*
TerminalManager:
- Creates/reuses terminals
- Runs commands via runCommand(), returning a TerminalProcess
- Handles shell integration events

TerminalProcess extends EventEmitter and implements Promise:
- Emits 'line' events with output while promise is pending
- process.continue() resolves promise and stops event emission
- Allows real-time output handling or background execution

getUnretrievedOutput() fetches latest output for ongoing commands

Enables flexible command execution:
- Await for completion
- Listen to real-time events
- Continue execution in background
- Retrieve missed output later

Notes:
- it turns out some shellIntegration APIs are available on cursor, although not on older versions of vscode
- "By default, the shell integration script should automatically activate on supported shells launched from VS Code."
Supported shells:
Linux/macOS: bash, fish, pwsh, zsh
Windows: pwsh


Example:

const terminalManager = new TerminalManager(context);

// Run a command
const process = terminalManager.runCommand('npm install', '/path/to/project');

process.on('line', (line) => {
    console.log(line);
});

// To wait for the process to complete naturally:
await process;

// Or to continue execution even if the command is still running:
process.continue();

// Later, if you need to get the unretrieved output:
const unretrievedOutput = terminalManager.getUnretrievedOutput(terminalId);
console.log('Unretrieved output:', unretrievedOutput);

Resources:
- https://github.com/microsoft/vscode/issues/226655
- https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api
- https://code.visualstudio.com/docs/terminal/shell-integration
- https://code.visualstudio.com/api/references/vscode-api#Terminal
- https://github.com/microsoft/vscode-extension-samples/blob/main/terminal-sample/src/extension.ts
- https://github.com/microsoft/vscode-extension-samples/blob/main/shell-integration-sample/src/extension.ts
*/

/*
The new shellIntegration API gives us access to terminal command execution output handling.
However, we don't update our VSCode type definitions or engine requirements to maintain compatibility
with older VSCode versions. Users on older versions will automatically fall back to using sendText
for terminal command execution.
Interestingly, some environments like Cursor enable these APIs even without the latest VSCode engine.
This approach allows us to leverage advanced features when available while ensuring broad compatibility.
*/
declare module "vscode" {
	// https://github.com/microsoft/vscode/blob/f0417069c62e20f3667506f4b7e53ca0004b4e3e/src/vscode-dts/vscode.d.ts#L7442
	interface Terminal {
		shellIntegration?: {
			cwd?: vscode.Uri
			executeCommand?: (command: string) => {
				read: () => AsyncIterable<string>
			}
		}
	}
	// https://github.com/microsoft/vscode/blob/f0417069c62e20f3667506f4b7e53ca0004b4e3e/src/vscode-dts/vscode.d.ts#L10794
	interface Window {
		onDidEndTerminalShellExecution?: (
			listener: (e: any) => any,
			thisArgs?: any,
			disposables?: vscode.Disposable[]
		) => vscode.Disposable
	}
}

// Although vscode.window.terminals provides a list of all open terminals, there's no way to know whether they're busy or not (exitStatus does not provide useful information for most commands). In order to prevent creating too many terminals, we need to keep track of terminals through the life of the extension, as well as session specific terminals for the life of a task (to get latest unretrieved output).
// Since we have promises keeping track of terminal processes, we get the added benefit of keep track of busy terminals even after a task is closed.
class TerminalRegistry {
	private static terminals: TerminalInfo[] = []
	private static nextTerminalId = 1

	static createTerminal(cwd?: string | vscode.Uri | undefined): TerminalInfo {
		const terminal = vscode.window.createTerminal({
			cwd,
			name: "Claude Dev",
			iconPath: new vscode.ThemeIcon("robot"),
		})
		const newInfo: TerminalInfo = {
			terminal,
			busy: false,
			lastCommand: "",
			id: this.nextTerminalId++,
		}
		this.terminals.push(newInfo)
		return newInfo
	}

	static getTerminal(id: number): TerminalInfo | undefined {
		const terminalInfo = this.terminals.find((t) => t.id === id)
		if (terminalInfo && this.isTerminalClosed(terminalInfo.terminal)) {
			this.removeTerminal(id)
			return undefined
		}
		return terminalInfo
	}

	static updateTerminal(id: number, updates: Partial<TerminalInfo>) {
		const terminal = this.getTerminal(id)
		if (terminal) {
			Object.assign(terminal, updates)
		}
	}

	static removeTerminal(id: number) {
		this.terminals = this.terminals.filter((t) => t.id !== id)
	}

	static getAllTerminals(): TerminalInfo[] {
		this.terminals = this.terminals.filter((t) => !this.isTerminalClosed(t.terminal))
		return this.terminals
	}

	// The exit status of the terminal will be undefined while the terminal is active. (This value is set when onDidCloseTerminal is fired.)
	private static isTerminalClosed(terminal: vscode.Terminal): boolean {
		return terminal.exitStatus !== undefined
	}
}

export class TerminalManager {
	private terminalIds: Set<number> = new Set()
	private processes: Map<number, TerminalProcess> = new Map()
	private disposables: vscode.Disposable[] = []

	constructor() {
		// Listening to this reduces the # of empty terminal outputs!
		let disposable: vscode.Disposable | undefined
		try {
			disposable = (vscode.window as vscode.Window).onDidEndTerminalShellExecution?.(async (e) => {
				// console.log(`Terminal shell execution ended. Command line:`, e.execution.commandLine.value)
				const stream = e?.execution?.read()
				if (stream) {
					for await (let _ of stream) {
						// console.log(`from onDidEndTerminalShellExecution, read:`, data)
					}
				}
			})
		} catch (error) {
			// console.error("Error setting up onDidEndTerminalShellExecution", error)
		}
		if (disposable) {
			this.disposables.push(disposable)
		}
		// Oddly if we listen to `onDidStartTerminalShellExecution` or `onDidChangeTerminalShellIntegration` this hack doesn't work...
	}

	runCommand(terminalInfo: TerminalInfo, command: string): TerminalProcessResultPromise {
		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const process = new TerminalProcess()
		this.processes.set(terminalInfo.id, process)

		process.once("completed", () => {
			terminalInfo.busy = false
		})

		// if shell integration is not available, remove terminal so it does not get reused as it may be running a long-running process
		process.once("no_shell_integration", () => {
			console.log(`no_shell_integration received for terminal ${terminalInfo.id}`)
			// Remove the terminal so we can't reuse it (in case it's running a long-running process)
			TerminalRegistry.removeTerminal(terminalInfo.id)
			this.terminalIds.delete(terminalInfo.id)
			this.processes.delete(terminalInfo.id)
		})

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				console.error(`Error in terminal ${terminalInfo.id}:`, error)
				reject(error)
			})
		})

		// if shell integration is already active, run the command immediately
		if (terminalInfo.terminal.shellIntegration) {
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command)
		} else {
			// docs recommend waiting 3s for shell integration to activate
			pWaitFor(() => terminalInfo.terminal.shellIntegration !== undefined, { timeout: 4000 }).finally(() => {
				const existingProcess = this.processes.get(terminalInfo.id)
				if (existingProcess && existingProcess.waitForShellIntegration) {
					existingProcess.waitForShellIntegration = false
					existingProcess.run(terminalInfo.terminal, command)
				}
			})
		}

		return mergePromise(process, promise)
	}

	async getOrCreateTerminal(cwd: string): Promise<TerminalInfo> {
		// Find available terminal from our pool first (created for this task)
		const availableTerminal = TerminalRegistry.getAllTerminals().find((t) => {
			if (t.busy) {
				return false
			}
			const terminalCwd = t.terminal.shellIntegration?.cwd // one of claude's commands could have changed the cwd of the terminal
			if (!terminalCwd) {
				return false
			}
			return vscode.Uri.file(cwd).fsPath === terminalCwd.fsPath
		})
		if (availableTerminal) {
			this.terminalIds.add(availableTerminal.id)
			return availableTerminal
		}

		const newTerminalInfo = TerminalRegistry.createTerminal(cwd)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}

	getTerminals(busy: boolean): { id: number; lastCommand: string }[] {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t): t is TerminalInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, lastCommand: t.lastCommand }))
	}

	getUnretrievedOutput(terminalId: number): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput() : ""
	}

	isProcessHot(terminalId: number): boolean {
		const process = this.processes.get(terminalId)
		return process ? process.isHot : false
	}

	disposeAll() {
		// for (const info of this.terminals) {
		// 	//info.terminal.dispose() // dont want to dispose terminals when task is aborted
		// }
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
}

interface TerminalInfo {
	terminal: vscode.Terminal
	busy: boolean
	lastCommand: string
	id: number
}

interface TerminalProcessEvents {
	line: [line: string]
	continue: []
	completed: []
	error: [error: Error]
	no_shell_integration: []
}

// how long to wait after a process outputs anything before we consider it "cool" again
const PROCESS_HOT_TIMEOUT_NORMAL = 2_000
const PROCESS_HOT_TIMEOUT_COMPILING = 15_000

export class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
	waitForShellIntegration: boolean = true
	private isListening: boolean = true
	private buffer: string = ""
	private fullOutput: string = ""
	private lastRetrievedIndex: number = 0
	isHot: boolean = false
	private hotTimer: NodeJS.Timeout | null = null

	// constructor() {
	// 	super()

	async run(terminal: vscode.Terminal, command: string) {
		if (terminal.shellIntegration && terminal.shellIntegration.executeCommand) {
			const execution = terminal.shellIntegration.executeCommand(command)
			const stream = execution.read()
			// todo: need to handle errors
			let isFirstChunk = true
			let didOutputNonCommand = false
			let didEmitEmptyLine = false
			for await (let data of stream) {
				// 1. Process chunk and remove artifacts
				if (isFirstChunk) {
					/*
					The first chunk we get from this stream needs to be processed to be more human readable, ie remove vscode's custom escape sequences and identifiers, removing duplicate first char bug, etc.
					*/

					// bug where sometimes the command output makes its way into vscode shell integration metadata
					/*
					]633 is a custom sequence number used by VSCode shell integration:
					- OSC 633 ; A ST - Mark prompt start
					- OSC 633 ; B ST - Mark prompt end
					- OSC 633 ; C ST - Mark pre-execution (start of command output)
					- OSC 633 ; D [; <exitcode>] ST - Mark execution finished with optional exit code
					- OSC 633 ; E ; <commandline> [; <nonce>] ST - Explicitly set command line with optional nonce
					*/
					// if you print this data you might see something like "eecho hello worldo hello world;5ba85d14-e92a-40c4-b2fd-71525581eeb0]633;C" but this is actually just a bunch of escape sequences, ignore up to the first ;C
					/* ddateb15026-6a64-40db-b21f-2a621a9830f0]633;CTue Sep 17 06:37:04 EDT 2024 % ]633;D;0]633;P;Cwd=/Users/saoud/Repositories/test */
					// Gets output between ]633;C (command start) and ]633;D (command end)
					const outputBetweenSequences = this.removeLastLineArtifacts(
						data.match(/\]633;C([\s\S]*?)\]633;D/)?.[1] || ""
					).trim()

					// Once we've retrieved any potential output between sequences, we can remove everything up to end of the last sequence
					// https://code.visualstudio.com/docs/terminal/shell-integration#_vs-code-custom-sequences-osc-633-st
					const vscodeSequenceRegex = /\x1b\]633;.[^\x07]*\x07/g
					const lastMatch = [...data.matchAll(vscodeSequenceRegex)].pop()
					if (lastMatch && lastMatch.index !== undefined) {
						data = data.slice(lastMatch.index + lastMatch[0].length)
					}
					// Place output back after removing vscode sequences
					if (outputBetweenSequences) {
						data = outputBetweenSequences + "\n" + data
					}
					// remove ansi
					data = stripAnsi(data)
					// Split data by newlines
					let lines = data ? data.split("\n") : []
					// Remove non-human readable characters from the first line
					if (lines.length > 0) {
						lines[0] = lines[0].replace(/[^\x20-\x7E]/g, "")
					}
					// Check if first two characters are the same, if so remove the first character
					if (lines.length > 0 && lines[0].length >= 2 && lines[0][0] === lines[0][1]) {
						lines[0] = lines[0].slice(1)
					}
					// Remove everything up to the first alphanumeric character for first two lines
					if (lines.length > 0) {
						lines[0] = lines[0].replace(/^[^a-zA-Z0-9]*/, "")
					}
					if (lines.length > 1) {
						lines[1] = lines[1].replace(/^[^a-zA-Z0-9]*/, "")
					}
					// Join lines back
					data = lines.join("\n")
					isFirstChunk = false
				} else {
					data = stripAnsi(data)
				}

				// first few chunks could be the command being echoed back, so we must ignore
				// note this means that 'echo' commands wont work
				if (!didOutputNonCommand) {
					const lines = data.split("\n")
					for (let i = 0; i < lines.length; i++) {
						if (command.includes(lines[i].trim())) {
							lines.splice(i, 1)
							i-- // Adjust index after removal
						} else {
							didOutputNonCommand = true
							break
						}
					}
					data = lines.join("\n")
				}

				// FIXME: right now it seems that data chunks returned to us from the shell integration stream contains random commas, which from what I can tell is not the expected behavior. There has to be a better solution here than just removing all commas.
				data = data.replace(/,/g, "")

				// 2. Set isHot depending on the command
				// Set to hot to stall API requests until terminal is cool again
				this.isHot = true
				if (this.hotTimer) {
					clearTimeout(this.hotTimer)
				}
				// these markers indicate the command is some kind of local dev server recompiling the app, which we want to wait for output of before sending request to claude
				const compilingMarkers = ["compiling", "building", "bundling", "transpiling", "generating", "starting"]
				const markerNullifiers = [
					"compiled",
					"success",
					"finish",
					"complete",
					"succeed",
					"done",
					"end",
					"stop",
					"exit",
					"terminate",
					"error",
					"fail",
				]
				const isCompiling =
					compilingMarkers.some((marker) => data.toLowerCase().includes(marker.toLowerCase())) &&
					!markerNullifiers.some((nullifier) => data.toLowerCase().includes(nullifier.toLowerCase()))
				this.hotTimer = setTimeout(
					() => {
						this.isHot = false
					},
					isCompiling ? PROCESS_HOT_TIMEOUT_COMPILING : PROCESS_HOT_TIMEOUT_NORMAL
				)

				// For non-immediately returning commands we want to show loading spinner right away but this wouldnt happen until it emits a line break, so as soon as we get any output we emit "" to let webview know to show spinner
				if (!didEmitEmptyLine && !this.fullOutput && data) {
					this.emit("line", "") // empty line to indicate start of command output stream
					didEmitEmptyLine = true
				}

				this.fullOutput += data
				if (this.isListening) {
					this.emitIfEol(data)
					this.lastRetrievedIndex = this.fullOutput.length - this.buffer.length
				}
			}

			this.emitRemainingBufferIfListening()

			// for now we don't want this delaying requests since we don't send diagnostics automatically anymore (previous: "even though the command is finished, we still want to consider it 'hot' in case so that api request stalls to let diagnostics catch up")
			if (this.hotTimer) {
				clearTimeout(this.hotTimer)
			}
			this.isHot = false

			this.emit("completed")
			this.emit("continue")
		} else {
			terminal.sendText(command, true)
			// For terminals without shell integration, we can't know when the command completes
			// So we'll just emit the continue event after a delay
			this.emit("completed")
			this.emit("continue")
			this.emit("no_shell_integration")
			// setTimeout(() => {
			// 	console.log(`Emitting continue after delay for terminal`)
			// 	// can't emit completed since we don't if the command actually completed, it could still be running server
			// }, 500) // Adjust this delay as needed
		}
	}

	// Inspired by https://github.com/sindresorhus/execa/blob/main/lib/transform/split.js
	private emitIfEol(chunk: string) {
		this.buffer += chunk
		let lineEndIndex: number
		while ((lineEndIndex = this.buffer.indexOf("\n")) !== -1) {
			let line = this.buffer.slice(0, lineEndIndex).trimEnd() // removes trailing \r
			// Remove \r if present (for Windows-style line endings)
			// if (line.endsWith("\r")) {
			// 	line = line.slice(0, -1)
			// }
			this.emit("line", line)
			this.buffer = this.buffer.slice(lineEndIndex + 1)
		}
	}

	private emitRemainingBufferIfListening() {
		if (this.buffer && this.isListening) {
			const remainingBuffer = this.removeLastLineArtifacts(this.buffer)
			if (remainingBuffer) {
				this.emit("line", remainingBuffer)
			}
			this.buffer = ""
			this.lastRetrievedIndex = this.fullOutput.length
		}
	}

	continue() {
		this.emitRemainingBufferIfListening()
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}

	getUnretrievedOutput(): string {
		const unretrieved = this.fullOutput.slice(this.lastRetrievedIndex)
		this.lastRetrievedIndex = this.fullOutput.length
		return this.removeLastLineArtifacts(unretrieved)
	}

	// some processing to remove artifacts like '%' at the end of the buffer (it seems that since vsode uses % at the beginning of newlines in terminal, it makes its way into the stream)
	// This modification will remove '%', '$', '#', or '>' followed by optional whitespace
	removeLastLineArtifacts(output: string) {
		const lines = output.trimEnd().split("\n")
		if (lines.length > 0) {
			const lastLine = lines[lines.length - 1]
			// Remove prompt characters and trailing whitespace from the last line
			lines[lines.length - 1] = lastLine.replace(/[%$#>]\s*$/, "")
		}
		return lines.join("\n").trimEnd()
	}
}

export type TerminalProcessResultPromise = TerminalProcess & Promise<void>

// Similar to execa's ResultPromise, this lets us create a mixin of both a TerminalProcess and a Promise: https://github.com/sindresorhus/execa/blob/main/lib/methods/promise.js
function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise {
	const nativePromisePrototype = (async () => {})().constructor.prototype
	const descriptors = ["then", "catch", "finally"].map(
		(property) => [property, Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)] as const
	)
	for (const [property, descriptor] of descriptors) {
		if (descriptor) {
			const value = descriptor.value.bind(promise)
			Reflect.defineProperty(process, property, { ...descriptor, value })
		}
	}
	return process as TerminalProcessResultPromise
}
