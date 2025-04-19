import { brokenChFixerTool, brokenChFixerInputSchema } from "../brokenChFixerTool"

describe("brokenChFixerTool", () => {
	it("corrige caracteres quebrados comuns", () => {
		const input = brokenChFixerInputSchema.parse({
			text: "OlÃ¡, vocÃª estÃ¡ testando um texto com Ã§ e Ã£ e Ã¡.",
		})
		const result = brokenChFixerTool(input)
		expect(result.fixedText).toContain("Olá")
		expect(result.fixedText).toContain("você")
		expect(result.fixedText).toContain("está")
		expect(result.fixedText).toContain("ç")
		expect(result.fixedText).toContain("ã")
		expect(result.fixedText).toContain("á")
	})

	it("mantém texto sem caracteres quebrados inalterado", () => {
		const input = brokenChFixerInputSchema.parse({
			text: "Texto limpo, sem problemas de encoding.",
		})
		const result = brokenChFixerTool(input)
		expect(result.fixedText).toBe("Texto limpo, sem problemas de encoding.")
	})

	it("lança erro se texto for vazio", () => {
		expect(() => brokenChFixerInputSchema.parse({ text: "" })).toThrow()
	})
})
