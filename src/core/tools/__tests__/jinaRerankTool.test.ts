import { jinaRerankTool } from "../jinaRerankTool"

describe("jinaRerankTool", () => {
	it("deve reranquear documentos usando a API Jina (se JINA_API_KEY estiver definida)", async () => {
		if (!process.env.JINA_API_KEY) {
			console.warn("JINA_API_KEY não definida, pulando teste de integração real.")
			return
		}
		const result = await jinaRerankTool({
			query: "agricultura sustentável",
			documents: [
				"A agricultura sustentável visa preservar o meio ambiente.",
				"A agricultura convencional utiliza muitos agrotóxicos.",
				"A pecuária intensiva é um dos maiores emissores de CO2.",
			],
		})
		expect(Array.isArray(result.results)).toBe(true)
		expect(result.results.length).toBeGreaterThan(0)
		expect(result.results[0]).toHaveProperty("relevance_score")
		expect(result.results[0]).toHaveProperty("document")
	})

	it("deve lançar erro se a API key não estiver definida", async () => {
		const original = process.env.JINA_API_KEY
		delete process.env.JINA_API_KEY
		await expect(
			jinaRerankTool({
				query: "a",
				documents: ["a", "b"],
			}),
		).rejects.toThrow()
		if (original) process.env.JINA_API_KEY = original
	})
})
