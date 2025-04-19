import { groundingTool } from "../groundingTool"

describe("groundingTool", () => {
	it("retorna grounded: true quando o texto contém o contexto", async () => {
		const result = await groundingTool({
			text: "O contexto é importante para grounding.",
			context: "contexto",
		})
		expect(result.grounded).toBe(true)
		expect(result.reason).toBe("Texto considerado grounded.")
		expect(result.details).toBeUndefined()
	})

	it("retorna grounded: false quando o texto NÃO contém o contexto", async () => {
		const result = await groundingTool({
			text: "Texto sem relação.",
			context: "contexto",
		})
		expect(result.grounded).toBe(false)
		expect(result.reason).toBe("Texto não contém o contexto fornecido.")
		expect(result.details).toEqual({ missingContext: "contexto" })
	})

	it("retorna grounded: true quando não há contexto", async () => {
		const result = await groundingTool({
			text: "Qualquer texto.",
		})
		expect(result.grounded).toBe(true)
		expect(result.reason).toBe("Texto considerado grounded.")
		expect(result.details).toBeUndefined()
	})
})
