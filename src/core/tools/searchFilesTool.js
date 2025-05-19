import path from "path"
import { getReadablePath } from "../../utils/path"
import { regexSearchFiles } from "../../services/ripgrep"
export async function searchFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag) {
	const relDirPath = block.params.path
	const regex = block.params.regex
	const filePattern = block.params.file_pattern
	const sharedMessageProps = {
		tool: "searchFiles",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex),
		filePattern: removeClosingTag("file_pattern", filePattern),
	}
	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" })
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!relDirPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("search_files")
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "path"))
				return
			}
			if (!regex) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("search_files")
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "regex"))
				return
			}
			cline.consecutiveMistakeCount = 0
			const absolutePath = path.resolve(cline.cwd, relDirPath)
			const results = await regexSearchFiles(
				cline.cwd,
				absolutePath,
				regex,
				filePattern,
				cline.rooIgnoreController,
			)
			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results })
			const didApprove = await askApproval("tool", completeMessage)
			if (!didApprove) {
				return
			}
			pushToolResult(results)
			return
		}
	} catch (error) {
		await handleError("searching files", error)
		return
	}
}
//# sourceMappingURL=searchFilesTool.js.map
