import { z } from "zod"
import { logger } from "../../../utils/logging"

// Schema Roo para resposta de análise de erro
export const errorAnalysisOutputSchema = z.object({
	recap: z.string().describe("Resumo das ações e padrões").max(1000),
	blame: z.string().describe("Causa raiz do erro").max(1000),
	improvement: z.string().describe("Sugestões de melhoria").max(1000),
})

export type ErrorAnalysisOutput = z.infer<typeof errorAnalysisOutputSchema>

/**
 * Gera o prompt para análise de passos de busca e raciocínio.
 */
function getPrompt(diaryContext: string[]): { system: string; user: string } {
	return {
		system: `You are an expert at analyzing search and reasoning processes. Your task is to analyze the given sequence of steps and identify what went wrong in the search process.

<rules>
1. The sequence of actions taken
2. The effectiveness of each step
3. The logic between consecutive steps
4. Alternative approaches that could have been taken
5. Signs of getting stuck in repetitive patterns
6. Whether the final answer matches the accumulated information

Analyze the steps and provide detailed feedback following these guidelines:
- In the recap: Summarize key actions chronologically, highlight patterns, and identify where the process started to go wrong
- In the blame: Point to specific steps or patterns that led to the inadequate answer
- In the improvement: Provide actionable suggestions that could have led to a better outcome
</rules>

<example>
[Exemplo removido para brevidade, use o exemplo do código original se necessário]
</example>`,
		user: `${diaryContext.join("\n")}`,
	}
}

/**
 * Ferramenta Roo-first para análise de passos de busca e raciocínio.
 * Integração com LLM Roo deve ser implementada no local indicado.
 */
export async function errorAnalyzerTool(diaryContext: string[]): Promise<ErrorAnalysisOutput> {
	logger.info("[errorAnalyzerTool] Iniciando análise de erro", { diaryContext })

	// Aqui deve ser feita a chamada ao pipeline Roo de LLMs para análise real
	// Exemplo: const result = await gerarAnaliseErroComLLM(diaryContext);
	// Para Roo-first, o ideal é integrar com o pipeline Roo de LLMs
	// Por ora, lançamos erro para indicar que a integração deve ser feita aqui
	throw new Error("Integração com LLM Roo não implementada. Adapte aqui para análise de erro real.")

	// logger.info("[errorAnalyzerTool] Análise concluída", { result });
	// return errorAnalysisOutputSchema.parse(result);
}
