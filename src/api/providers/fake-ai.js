/**
 * API providers configuration is stored in the VSCode global state.
 * Therefore, when a new task is created, the FakeAI object in the configuration
 * is a new object not related to the original one, but with the same ID.
 *
 * We use the ID to lookup the original FakeAI object in the mapping.
 */
let fakeAiMap = new Map()
export class FakeAIHandler {
	ai
	constructor(options) {
		const optionsFakeAi = options.fakeAi
		if (!optionsFakeAi) {
			throw new Error("Fake AI is not set")
		}
		const id = optionsFakeAi.id
		let cachedFakeAi = fakeAiMap.get(id)
		if (cachedFakeAi === undefined) {
			cachedFakeAi = optionsFakeAi
			cachedFakeAi.removeFromCache = () => fakeAiMap.delete(id)
			fakeAiMap.set(id, cachedFakeAi)
		}
		this.ai = cachedFakeAi
	}
	async *createMessage(systemPrompt, messages) {
		yield* this.ai.createMessage(systemPrompt, messages)
	}
	getModel() {
		return this.ai.getModel()
	}
	countTokens(content) {
		return this.ai.countTokens(content)
	}
	completePrompt(prompt) {
		return this.ai.completePrompt(prompt)
	}
}
//# sourceMappingURL=fake-ai.js.map
