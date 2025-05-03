import { checkExistKey } from "../checkExistApiConfig"
describe("checkExistKey", () => {
	it("should return false for undefined config", () => {
		expect(checkExistKey(undefined)).toBe(false)
	})
	it("should return false for empty config", () => {
		const config = {}
		expect(checkExistKey(config)).toBe(false)
	})
	it("should return true when one key is defined", () => {
		const config = {
			apiKey: "test-key",
		}
		expect(checkExistKey(config)).toBe(true)
	})
	it("should return true when multiple keys are defined", () => {
		const config = {
			apiKey: "test-key",
			glamaApiKey: "glama-key",
			openRouterApiKey: "openrouter-key",
		}
		expect(checkExistKey(config)).toBe(true)
	})
	it("should return true when only non-key fields are undefined", () => {
		const config = {
			apiKey: "test-key",
			apiProvider: undefined,
			anthropicBaseUrl: undefined,
			modelMaxThinkingTokens: undefined,
		}
		expect(checkExistKey(config)).toBe(true)
	})
	it("should return false when all key fields are undefined", () => {
		const config = {
			apiKey: undefined,
			glamaApiKey: undefined,
			openRouterApiKey: undefined,
			awsRegion: undefined,
			vertexProjectId: undefined,
			openAiApiKey: undefined,
			ollamaModelId: undefined,
			lmStudioModelId: undefined,
			geminiApiKey: undefined,
			openAiNativeApiKey: undefined,
			deepSeekApiKey: undefined,
			mistralApiKey: undefined,
			vsCodeLmModelSelector: undefined,
			requestyApiKey: undefined,
			unboundApiKey: undefined,
		}
		expect(checkExistKey(config)).toBe(false)
	})
})
//# sourceMappingURL=checkExistApiConfig.test.js.map
