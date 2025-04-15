import { errorAnalyzerTool, errorAnalysisOutputSchema } from "../errorAnalyzerTool"

describe("errorAnalyzerTool (Roo-first)", () => {
	it("valida o schema de saída corretamente", () => {
		const output = {
			recap: "Resumo das ações.",
			blame: "Causa raiz.",
			improvement: "Sugestão de melhoria.",
		}
		expect(() => errorAnalysisOutputSchema.parse(output)).not.toThrow()
	})

	it("lança erro de integração Roo-first ao executar", async () => {
		await expect(errorAnalyzerTool(["step1", "step2"])).rejects.toThrow("Integração com LLM Roo não implementada")
	})
})
