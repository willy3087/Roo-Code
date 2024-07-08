import { ClaudeMessage } from "@shared/ExtensionMessage"

/**
 * Combines sequences of command and command_output messages in an array of ClaudeMessages.
 *
 * This function processes an array of ClaudeMessage objects, looking for sequences
 * where a 'command' message is followed by one or more 'command_output' messages.
 * When such a sequence is found, it combines them into a single message, merging
 * their text contents.
 *
 * @param messages - An array of ClaudeMessage objects to process.
 * @returns A new array of ClaudeMessage objects with command sequences combined.
 *
 * @example
 * const messages: ClaudeMessage[] = [
 *   { type: 'ask', ask: 'command', text: 'ls', ts: 1625097600000 },
 *   { type: 'say', say: 'command_output', text: 'file1.txt', ts: 1625097601000 },
 *   { type: 'say', say: 'command_output', text: 'file2.txt', ts: 1625097602000 }
 * ];
 * const result = simpleCombineCommandSequences(messages);
 * // Result: [{ type: 'ask', ask: 'command', text: 'ls\nfile1.txt\nfile2.txt', ts: 1625097600000 }]
 */
export function combineCommandSequences(messages: ClaudeMessage[]): ClaudeMessage[] {
	const combinedCommands: ClaudeMessage[] = []

	// First pass: combine commands with their outputs
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].type === "ask" && messages[i].ask === "command") {
			let combinedText = messages[i].text || ""
			let j = i + 1

			while (j < messages.length) {
				if (messages[j].type === "ask" && messages[j].ask === "command") {
					// Stop if we encounter the next command
					break
				}
				if (messages[j].type === "say" && messages[j].say === "command_output") {
					combinedText += "\n" + (messages[j].text || "")
				}
				j++
			}

			combinedCommands.push({
				...messages[i],
				text: combinedText,
			})

			i = j - 1 // Move to the index just before the next command or end of array
		}
	}

	// Second pass: remove command_outputs and replace original commands with combined ones
	return messages
		.filter((msg) => !(msg.type === "say" && msg.say === "command_output"))
		.map((msg) => {
			if (msg.type === "ask" && msg.ask === "command") {
				const combinedCommand = combinedCommands.find((cmd) => cmd.ts === msg.ts)
				return combinedCommand || msg
			}
			return msg
		})
}
