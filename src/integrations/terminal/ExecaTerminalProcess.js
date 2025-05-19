import { execa, ExecaError } from "execa"
import psTree from "ps-tree"
import process from "process"
import { BaseTerminalProcess } from "./BaseTerminalProcess"
export class ExecaTerminalProcess extends BaseTerminalProcess {
	terminalRef
	aborted = false
	pid
	constructor(terminal) {
		super()
		this.terminalRef = new WeakRef(terminal)
		this.once("completed", () => {
			this.terminal.busy = false
		})
	}
	get terminal() {
		const terminal = this.terminalRef.deref()
		if (!terminal) {
			throw new Error("Unable to dereference terminal")
		}
		return terminal
	}
	async run(command) {
		this.command = command
		try {
			this.isHot = true
			const subprocess = execa({
				shell: true,
				cwd: this.terminal.getCurrentWorkingDirectory(),
				all: true,
			})`${command}`
			this.pid = subprocess.pid
			const stream = subprocess.iterable({ from: "all", preserveNewlines: true })
			this.terminal.setActiveStream(stream, subprocess.pid)
			for await (const line of stream) {
				if (this.aborted) {
					break
				}
				this.fullOutput += line
				const now = Date.now()
				if (this.isListening && (now - this.lastEmitTime_ms > 500 || this.lastEmitTime_ms === 0)) {
					this.emitRemainingBufferIfListening()
					this.lastEmitTime_ms = now
				}
				this.startHotTimer(line)
			}
			if (this.aborted) {
				let timeoutId
				const kill = new Promise((resolve) => {
					timeoutId = setTimeout(() => {
						try {
							subprocess.kill("SIGKILL")
						} catch (e) {}
						resolve()
					}, 5_000)
				})
				try {
					await Promise.race([subprocess, kill])
				} catch (error) {
					console.log(
						`[ExecaTerminalProcess] subprocess termination error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
				if (timeoutId) {
					clearTimeout(timeoutId)
				}
			}
			this.emit("shell_execution_complete", { exitCode: 0 })
		} catch (error) {
			if (error instanceof ExecaError) {
				console.error(`[ExecaTerminalProcess] shell execution error: ${error.message}`)
				this.emit("shell_execution_complete", { exitCode: error.exitCode ?? 0, signalName: error.signal })
			} else {
				console.error(
					`[ExecaTerminalProcess] shell execution error: ${error instanceof Error ? error.message : String(error)}`,
				)
				this.emit("shell_execution_complete", { exitCode: 1 })
			}
		}
		this.terminal.setActiveStream(undefined)
		this.emitRemainingBufferIfListening()
		this.stopHotTimer()
		this.emit("completed", this.fullOutput)
		this.emit("continue")
	}
	continue() {
		this.isListening = false
		this.removeAllListeners("line")
		this.emit("continue")
	}
	abort() {
		this.aborted = true
		if (this.pid) {
			psTree(this.pid, async (err, children) => {
				if (!err) {
					const pids = children.map((p) => parseInt(p.PID))
					for (const pid of pids) {
						try {
							process.kill(pid, "SIGINT")
						} catch (e) {
							console.warn(
								`[ExecaTerminalProcess] Failed to send SIGINT to child PID ${pid}: ${e instanceof Error ? e.message : String(e)}`,
							)
							// Optionally try SIGTERM or SIGKILL on failure, depending on desired behavior.
						}
					}
				} else {
					console.error(
						`[ExecaTerminalProcess] Failed to get process tree for PID ${this.pid}: ${err.message}`,
					)
				}
			})
			try {
				process.kill(this.pid, "SIGINT")
			} catch (e) {
				console.warn(
					`[ExecaTerminalProcess] Failed to send SIGINT to main PID ${this.pid}: ${e instanceof Error ? e.message : String(e)}`,
				)
			}
		}
	}
	hasUnretrievedOutput() {
		return this.lastRetrievedIndex < this.fullOutput.length
	}
	getUnretrievedOutput() {
		let output = this.fullOutput.slice(this.lastRetrievedIndex)
		let index = output.lastIndexOf("\n")
		if (index === -1) {
			return ""
		}
		index++
		this.lastRetrievedIndex += index
		// console.log(
		// 	`[ExecaTerminalProcess#getUnretrievedOutput] fullOutput.length=${this.fullOutput.length} lastRetrievedIndex=${this.lastRetrievedIndex}`,
		// 	output.slice(0, index),
		// )
		return output.slice(0, index)
	}
	emitRemainingBufferIfListening() {
		if (!this.isListening) {
			return
		}
		const output = this.getUnretrievedOutput()
		if (output !== "") {
			this.emit("line", output)
		}
	}
}
//# sourceMappingURL=ExecaTerminalProcess.js.map
