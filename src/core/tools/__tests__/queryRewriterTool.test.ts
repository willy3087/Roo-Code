import { queryRewriterTool } from "../queryRewriterTool"

describe("queryRewriterTool", () => {
	it("deve retornar queries reescritas válidas da LLM (se OPENAI_API_KEY estiver definida)", async () => {
		if (!process.env.OPENAI_API_KEY) {
			console.warn("OPENAI_API_KEY não definida, pulando teste de integração real.")
			return
		}
		const result = await queryRewriterTool({
			query: "sustainable agriculture",
			think: "Quero saber as melhores práticas para agricultura sustentável.",
			context: "carbon sequestration, no-till, biochar, compost tea",
		})
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBeGreaterThan(0)
		expect(result[0]).toHaveProperty("q")
	})

	it("deve lançar erro se a query for vazia", async () => {
		await expect(queryRewriterTool({ query: "", think: "", context: "" })).rejects.toThrow()
	})
})
