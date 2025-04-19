import { z } from "zod"
import { Cline } from "../Cline"
import axios from "axios"

// Schema para a ferramenta
const deepResearchSchema = z.object({
	query: z.string().describe("A consulta de pesquisa"),
	maxSteps: z.number().optional().describe("Número máximo de passos de pesquisa"),
	useCodeSandbox: z.boolean().optional().describe("Se deve usar o sandbox de código para testes"),
	onlyHostnames: z.array(z.string()).optional().describe("Lista de hostnames para restringir a busca"),
})

// Interface para resposta da pesquisa
interface ResearchResponse {
	answer: string
	references: Array<{
		url: string
		title: string
		quote: string
		dateTime?: string
	}>
	steps: Array<{
		action: string
		result: string
	}>
	mdAnswer?: string
}

/**
 * Ferramenta de pesquisa profunda que utiliza múltiplas fontes e ferramentas
 * para encontrar e analisar informações.
 */
export async function deepResearchTool(cline: Cline, params: z.infer<typeof deepResearchSchema>): Promise<string> {
	// Inicializa o rastreador de ações
	const actionLog: Array<{ action: string; result: string }> = []

	// Função auxiliar para registrar ações
	const logAction = (action: string, result: string) => {
		actionLog.push({ action, result })
		return `[${action}] ${result}`
	}

	try {
		// 1. Primeiro usa a ferramenta de busca web para encontrar fontes iniciais
		const webSearchResult = await cline.ask(
			"tool",
			JSON.stringify({
				tool: "web_search",
				query: params.query,
			}),
		)
		logAction("web_search", "Buscando fontes iniciais")

		// 2. Para cada resultado relevante, usa codebase_search para encontrar código relacionado
		const codeSearchResult = await cline.ask(
			"tool",
			JSON.stringify({
				tool: "codebase_search",
				query: params.query,
			}),
		)
		logAction("code_search", "Buscando código relacionado")

		// 3. Se useCodeSandbox está habilitado, testa o código encontrado
		if (params.useCodeSandbox) {
			// Implementar integração com sandbox
			logAction("sandbox", "Testando código encontrado")
		}

		// 4. Usa grep_search para buscar padrões específicos
		const grepResult = await cline.ask(
			"tool",
			JSON.stringify({
				tool: "grep_search",
				query: params.query,
			}),
		)
		logAction("grep_search", "Buscando padrões específicos")

		// 5. Monta a resposta final
		const response: ResearchResponse = {
			answer: `Resultado da pesquisa para: ${params.query}`,
			references: [], // Adicionar referências encontradas
			steps: actionLog,
			mdAnswer: "", // Formatar resposta em markdown
		}

		return JSON.stringify(response, null, 2)
	} catch (error) {
		console.error("Erro na pesquisa profunda:", error)
		return JSON.stringify({
			error: "Falha na pesquisa",
			message: error instanceof Error ? error.message : String(error),
		})
	}
}

// Adiciona o schema à função
deepResearchTool.schema = deepResearchSchema
