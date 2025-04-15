import { jinaDedupTool } from "../jinaDedupTool"

describe("jinaDedupTool", () => {
	it("deve deduplicar queries semelhantes usando a API Jina (se JINA_API_KEY estiver definida)", async () => {
		if (!process.env.JINA_API_KEY) {
			console.warn("JINA_API_KEY não definida, pulando teste de integração real.")
			return
		}
		const result = await jinaDedupTool({
			newQueries: ["agricultura sustentável", "agricultura sustentável", "sustainable agriculture"],
			existingQueries: ["agricultura regenerativa"],
		})
		expect(Array.isArray(result.unique_queries)).toBe(true)
		expect(result.unique_queries.length).toBeGreaterThan(0)
		expect(result.unique_queries).toContain("agricultura sustentável")
	})

	it("deve retornar todas as queries se a API key não estiver definida", async () => {
		const original = process.env.JINA_API_KEY
		delete process.env.JINA_API_KEY
		const result = await jinaDedupTool({
			newQueries: ["a", "b"],
			existingQueries: [],
		})
		expect(result.unique_queries).toEqual(["a", "b"])
		if (original) process.env.JINA_API_KEY = original
	})
})
