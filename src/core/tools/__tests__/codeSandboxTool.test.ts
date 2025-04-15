import { codeSandboxTool, codeSandboxInputSchema, codeSandboxOutputSchema } from "../codeSandboxTool"

describe("codeSandboxTool (Roo-first)", () => {
	it("valida o schema de entrada corretamente", () => {
		const input = {
			problem: "Some problem",
			context: { numbers: [1, 2, 3] },
			maxAttempts: 2,
		}
		expect(() => codeSandboxInputSchema.parse(input)).not.toThrow()
	})

	it("valida o schema de saída corretamente", () => {
		const output = {
			solution: { code: "return 42;", output: 42 },
			attempts: [],
		}
		expect(() => codeSandboxOutputSchema.parse(output)).not.toThrow()
	})

	it("lança erro de integração Roo-first ao executar", async () => {
		const input = {
			problem: "Some problem",
			context: { numbers: [1, 2, 3] },
			maxAttempts: 1,
		}
		await expect(codeSandboxTool(input)).rejects.toThrow("Integração com LLM Roo não implementada")
	})
})
