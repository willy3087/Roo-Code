import { groqDefaultModelId, groqModels } from "../../shared/api" // Updated imports for Groq
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
export class GroqHandler extends BaseOpenAiCompatibleProvider {
	constructor(options) {
		super({
			...options,
			providerName: "Groq",
			baseURL: "https://api.groq.com/openai/v1",
			apiKey: options.groqApiKey,
			defaultProviderModelId: groqDefaultModelId,
			providerModels: groqModels,
			defaultTemperature: 0.5,
		})
	}
}
//# sourceMappingURL=groq.js.map
