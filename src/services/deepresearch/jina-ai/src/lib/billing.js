import { HTTPService } from "civkit"
export class JinaEmbeddingsDashboardHTTP extends HTTPService {
	apiKey
	baseUri
	name = "JinaEmbeddingsDashboardHTTP"
	constructor(apiKey, baseUri = "https://embeddings-dashboard-api.jina.ai/api") {
		super(baseUri)
		this.apiKey = apiKey
		this.baseUri = baseUri
		this.baseOptions.timeout = 30_000 // 30 sec
	}
	async authorization(token) {
		const r = await this.get("/v1/authorization", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
			responseType: "json",
		})
		return r
	}
	async validateToken(token) {
		const r = await this.getWithSearchParams(
			"/v1/api_key/user",
			{
				api_key: token,
			},
			{
				responseType: "json",
			},
		)
		return r
	}
	async reportUsage(token, query) {
		const r = await this.postJson("/v1/usage", query, {
			headers: {
				Authorization: `Bearer ${token}`,
				"x-api-key": this.apiKey,
			},
			responseType: "text",
		})
		return r
	}
}
//# sourceMappingURL=billing.js.map
