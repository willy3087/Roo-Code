import { z } from "zod"
import { logger } from "../../utils/logging"

// Schemas Roo para entrada e saída
export const codeSandboxInputSchema = z.object({
	problem: z.string().min(1, "Problema obrigatório"),
	context: z.record(z.any()).optional(),
	maxAttempts: z.number().min(1).max(10).default(3),
})

export const codeSandboxOutputSchema = z.object({
	solution: z.object({
		code: z.string(),
		output: z.any(),
	}),
	attempts: z.array(
		z.object({
			code: z.string(),
			error: z.string().optional(),
		}),
	),
})

export type CodeSandboxInput = z.infer<typeof codeSandboxInputSchema>
export type CodeSandboxOutput = z.infer<typeof codeSandboxOutputSchema>

/**
 * Ferramenta Roo-first para geração e execução de código JavaScript seguro a partir de um problema textual.
 * Não utiliza dependências herdadas, apenas Zod, logger Roo e contexto explícito.
 */
export async function codeSandboxTool(input: CodeSandboxInput): Promise<CodeSandboxOutput> {
	const { problem, context = {}, maxAttempts } = input
	logger.info("[codeSandboxTool] Iniciando", { problem, maxAttempts })

	// Função para gerar o prompt para o modelo (pode ser adaptada para integração com LLM Roo)
	function getPrompt(
		problem: string,
		availableVars: string,
		previousAttempts: Array<{ code: string; error?: string }> = [],
	) {
		const previousAttemptsContext = previousAttempts
			.map(
				(attempt, index) => `
<bad-attempt-${index + 1}>
${attempt.code}
${
	attempt.error
		? `Error: ${attempt.error}
</bad-attempt-${index + 1}>
`
		: ""
}
`,
			)
			.join("\n")

		return `You are an expert JavaScript programmer. Your task is to generate JavaScript code to solve the given problem.

<rules>
1. Generate plain JavaScript code that returns the result directly
2. You can access any of these available variables directly:
${availableVars}
3. You don't have access to any third party libraries that need to be installed, so you must write complete, self-contained code.
</rules>

${
	previousAttempts.length > 0
		? `Previous attempts and their errors:
${previousAttemptsContext}
`
		: ""
}

<example>
Available variables:
numbers (Array<number>) e.g. [1, 2, 3, 4, 5, 6]
threshold (number) e.g. 4

Problem: Sum all numbers above threshold

Response:
{
  "code": "return numbers.filter(n => n > threshold).reduce((a, b) => a + b, 0);"
}
</example>`
	}

	// Função para analisar a estrutura do contexto (para exibir variáveis disponíveis)
	function analyzeStructure(value: any, indent = ""): string {
		if (value === null) return "null"
		if (value === undefined) return "undefined"
		const type = typeof value
		if (type === "function") return "Function"
		if (type !== "object" || value instanceof Date) {
			return type
		}
		if (Array.isArray(value)) {
			if (value.length === 0) return "Array<unknown>"
			const sampleItem = value[0]
			return `Array<${analyzeStructure(sampleItem, indent + "  ")}>`
		}
		const entries = Object.entries(value)
		if (entries.length === 0) return "{}"
		const properties = entries
			.map(([key, val]) => {
				const analyzed = analyzeStructure(val, indent + "  ")
				return `${indent}  "${key}": ${analyzed}`
			})
			.join(",\n")
		return `{\n${properties}\n${indent}}`
	}

	// Lógica principal: gera código, executa e retorna tentativas
	const attempts: Array<{ code: string; error?: string }> = []
	let solution: { code: string; output: any } | null = null

	for (let i = 0; i < maxAttempts; i++) {
		// Aqui deveria ser feita a chamada ao modelo Roo para gerar o código JS
		// Exemplo: const code = await gerarCodigoComLLM(problem, context, tentativas);
		// Para Roo-first, o ideal é integrar com o pipeline Roo de LLMs
		// Por ora, lançamos erro para indicar que a integração deve ser feita aqui
		throw new Error(
			"Integração com LLM Roo não implementada. Adapte aqui para gerar código JS a partir do problema.",
		)
	}

	if (!solution) {
		throw new Error("Não foi possível gerar uma solução válida.")
	}

	logger.info("[codeSandboxTool] Finalizado", { solution, attempts })
	return codeSandboxOutputSchema.parse({ solution, attempts })
}
