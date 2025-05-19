import { Mistral } from "@mistralai/mistralai"
import { mistralDefaultModelId, mistralModels } from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { BaseProvider } from "./base-provider"
const MISTRAL_DEFAULT_TEMPERATURE = 0
export class MistralHandler extends BaseProvider {
	options
	client
	constructor(options) {
		super()
		if (!options.mistralApiKey) {
			throw new Error("Mistral API key is required")
		}
		// Set default model ID if not provided
		this.options = {
			...options,
			apiModelId: options.apiModelId || mistralDefaultModelId,
		}
		const baseUrl = this.getBaseUrl()
		console.debug(`[Roo Code] MistralHandler using baseUrl: ${baseUrl}`)
		this.client = new Mistral({
			serverURL: baseUrl,
			apiKey: this.options.mistralApiKey,
		})
	}
	getBaseUrl() {
		const modelId = this.options.apiModelId ?? mistralDefaultModelId
		console.debug(`[Roo Code] MistralHandler using modelId: ${modelId}`)
		if (modelId?.startsWith("codestral-")) {
			return this.options.mistralCodestralUrl || "https://codestral.mistral.ai"
		}
		return "https://api.mistral.ai"
	}
	async *createMessage(systemPrompt, messages) {
		const response = await this.client.chat.stream({
			model: this.options.apiModelId || mistralDefaultModelId,
			messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
			maxTokens: this.options.includeMaxTokens ? this.getModel().info.maxTokens : undefined,
			temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
		})
		for await (const chunk of response) {
			const delta = chunk.data.choices[0]?.delta
			if (delta?.content) {
				let content = ""
				if (typeof delta.content === "string") {
					content = delta.content
				} else if (Array.isArray(delta.content)) {
					content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
				}
				yield {
					type: "text",
					text: content,
				}
			}
			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
	}
	async completePrompt(prompt) {
		try {
			const response = await this.client.chat.complete({
				model: this.options.apiModelId || mistralDefaultModelId,
				messages: [{ role: "user", content: prompt }],
				temperature: this.options.modelTemperature ?? MISTRAL_DEFAULT_TEMPERATURE,
			})
			const content = response.choices?.[0]?.message.content
			if (Array.isArray(content)) {
				return content.map((c) => (c.type === "text" ? c.text : "")).join("")
			}
			return content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Mistral completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=mistral.js.map
