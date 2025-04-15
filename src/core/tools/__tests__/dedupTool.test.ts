import { dedupTool, dedupOutputSchema } from "../dedupTool"

describe("dedupTool (Roo-first)", () => {
	it("valida o schema de saída corretamente", () => {
		const output = {
			think: "Raciocínio estratégico sobre deduplicação.",
			unique_queries: ["query1", "query2"],
		}
		expect(() => dedupOutputSchema.parse(output)).not.toThrow()
	})

	it("lança erro de integração Roo-first ao executar", async () => {
		await expect(dedupTool(["query1", "query2"], ["query3"])).rejects.toThrow(
			"Integração com LLM Roo não implementada",
		)
	})
})
