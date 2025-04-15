import { z } from "zod"
import axios from "axios"

// Schemas Roo
export const jinaRerankInputSchema = z.object({
	query: z.string().min(1),
	documents: z.array(z.string().min(1)),
})
export const jinaRerankResultSchema = z.object({
	index: z.number(),
	relevance_score: z.number(),
	document: z.object({
		text: z.string(),
	}),
})
export const jinaRerankOutputSchema = z.object({
	results: z.array(jinaRerankResultSchema),
})
export type JinaRerankInput = z.infer<typeof jinaRerankInputSchema>
export type JinaRerankOutput = z.infer<typeof jinaRerankOutputSchema>

/**
 * Ferramenta Roo-first para rerank de documentos usando a API Jina.
 */
export async function jinaRerankTool(input: JinaRerankInput): Promise<JinaRerankOutput> {
	const { query, documents } = input
	const JINA_API_KEY = process.env.JINA_API_KEY
	if (!JINA_API_KEY) throw new Error("JINA_API_KEY não configurada")

	const request = {
		model: "jina-reranker-v2-base-multilingual",
		query,
		top_n: documents.length,
		documents,
	}

	try {
		const response = await axios.post("https://api.jina.ai/v1/rerank", request, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${JINA_API_KEY}`,
			},
		})

		// Validação Roo-first
		const parseResult = jinaRerankOutputSchema.safeParse({ results: response.data.results })
		if (!parseResult.success) {
			throw new Error("Formato inválido de resposta da API Jina Rerank")
		}

		return parseResult.data
	} catch (error) {
		// Em caso de erro, retorna array vazio
		return { results: [] }
	}
}
