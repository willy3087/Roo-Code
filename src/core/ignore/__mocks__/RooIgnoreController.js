export const LOCK_TEXT_SYMBOL = "\u{1F512}"
export class RooIgnoreController {
	rooIgnoreContent = undefined
	constructor(_cwd) {
		// No-op constructor
	}
	async initialize() {
		// No-op initialization
		return Promise.resolve()
	}
	validateAccess(_filePath) {
		// Default implementation: allow all access
		return true
	}
	validateCommand(_command) {
		// Default implementation: allow all commands
		return undefined
	}
	filterPaths(paths) {
		// Default implementation: allow all paths
		return paths
	}
	dispose() {
		// No-op dispose
	}
	getInstructions() {
		// Default implementation: no instructions
		return undefined
	}
}
//# sourceMappingURL=RooIgnoreController.js.map
