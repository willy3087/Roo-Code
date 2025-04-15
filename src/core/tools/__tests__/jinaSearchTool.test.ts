import { jinaSearchTool } from "../jinaSearchTool"

describe("jinaSearchTool", () => {
	it("deve lançar erro se a query for vazia", async () => {
		await expect(jinaSearchTool({ query: "" })).rejects.toThrow("Query não pode ser vazia")
	})

	it("deve lançar erro se JINA_API_KEY não estiver definida", async () => {
		const original = process.env.JINA_API_KEY
		delete process.env.JINA_API_KEY
		await expect(jinaSearchTool({ query: "test" })).rejects.toThrow("JINA_API_KEY não configurada")
		if (original) process.env.JINA_API_KEY = original
	})

	// Teste de integração real (executa apenas se a key estiver presente)
	it("deve retornar resultados válidos da API Jina (se JINA_API_KEY estiver definida)", async () => {
		if (!process.env.JINA_API_KEY) {
			console.warn("JINA_API_KEY não definida, pulando teste de integração real.")
			return
		}
		const result = await jinaSearchTool({ query: "open source ai" })
		expect(Array.isArray(result.data)).toBe(true)
		expect(result.data.length).toBeGreaterThan(0)
		expect(result.data[0]).toHaveProperty("url")
	})
})
