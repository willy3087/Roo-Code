/**
 * @fileoverview Utility for robust object logging with special handling for various data types
 */

import * as vscode from "vscode"

/**
 * Formats and logs values to a VSCode output channel with special handling for various data types
 *
 * Features:
 * - Explicit handling for null and undefined values
 * - Special handling for Error objects to preserve stack traces
 * - Handles circular references in objects
 * - Properly formats special types like BigInt, functions, and symbols
 * - Pretty prints objects with indentation for better readability
 *
 * @param outputChannel - The VSCode output channel to log to
 * @param args - The values to log
 */
export function formatLog(outputChannel: vscode.OutputChannel, ...args: unknown[]): void {
	for (const arg of args) {
		if (arg === null) {
			outputChannel.appendLine("null")
		} else if (arg === undefined) {
			outputChannel.appendLine("undefined")
		} else if (typeof arg === "string") {
			outputChannel.appendLine(arg)
		} else if (arg instanceof Error) {
			// Special handling for Error objects to preserve stack traces
			outputChannel.appendLine(`Error: ${arg.message}\n${arg.stack || ""}`)
		} else {
			try {
				outputChannel.appendLine(
					JSON.stringify(
						arg,
						(key, value) => {
							// Handle special types that JSON.stringify doesn't handle well
							if (typeof value === "bigint") return `BigInt(${value})`
							if (typeof value === "function") return `Function: ${value.name || "anonymous"}`
							if (typeof value === "symbol") return value.toString()
							return value
						},
						2,
					),
				) // Pretty print with 2 spaces
			} catch (error) {
				// Handle circular references or other JSON.stringify errors
				outputChannel.appendLine(`[Non-serializable object: ${Object.prototype.toString.call(arg)}]`)
			}
		}
	}
}
