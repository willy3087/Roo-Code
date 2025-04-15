import { z } from "zod"
import axios from "axios"

// Schemas Roo
export const jinaDedupInputSchema = z.object({
	newQueries: z.array(z.string().min(1)),
	existingQueries: z.array(z.string().min(1)).default([]),
})
export const jinaDedupOutputSchema = z.object({
	unique_queries: z.array(z.string()),
})
export type JinaDedupInput = z.infer<typeof jinaDedupInputSchema>
export type JinaDedupOutput = z.infer<typeof jinaDedupOutputSchema>

// Parâmetros da API Jina
const JINA_API_URL = "https://api.jina.ai/v1/embeddings"
const SIMILARITY_THRESHOLD = 0.86
const JINA_API_CONFIG = {
	MODEL: "jina-embeddings-v3",
	TASK: "text-matching",
	DIMENSIONS: 1024,
	EMBEDDING_TYPE: "float",
	LATE_CHUNKING: false,
} as const

// Similaridade cosseno
function cosineSimilarity(vecA: number[], vecB: number[]): number {
	const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
	const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
	const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
	return dotProduct / (normA * normB)
}

// Obtém embeddings para todas as queries
async function getEmbeddings(queries: string[]): Promise<number[][]> {
	const JINA_API_KEY = process.env.JINA_API_KEY
	if (!JINA_API_KEY) throw new Error("JINA_API_KEY não configurada")

	const request = {
		model: JINA_API_CONFIG.MODEL,
		task: JINA_API_CONFIG.TASK,
		late_chunking: JINA_API_CONFIG.LATE_CHUNKING,
		dimensions: JINA_API_CONFIG.DIMENSIONS,
		embedding_type: JINA_API_CONFIG.EMBEDDING_TYPE,
		input: queries,
	}

	const response = await axios.post(JINA_API_URL, request, {
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${JINA_API_KEY}`,
		},
	})

	if (!response.data.data || response.data.data.length !== queries.length) {
		throw new Error("Resposta inválida da API Jina")
	}

	// Ordena embeddings por índice
	return response.data.data.sort((a: any, b: any) => a.index - b.index).map((item: any) => item.embedding)
}

/**
 * Ferramenta Roo-first para deduplicação de queries usando embeddings Jina.
 */
export async function jinaDedupTool(input: JinaDedupInput): Promise<JinaDedupOutput> {
	const { newQueries, existingQueries } = input

	if (newQueries.length === 1 && existingQueries.length === 0) {
		return { unique_queries: newQueries }
	}

	const allQueries = [...newQueries, ...existingQueries]
	let allEmbeddings: number[][]
	try {
		allEmbeddings = await getEmbeddings(allQueries)
	} catch (e) {
		// Em caso de erro, retorna todas as novas queries
		return { unique_queries: newQueries }
	}

	const newEmbeddings = allEmbeddings.slice(0, newQueries.length)
	const existingEmbeddings = allEmbeddings.slice(newQueries.length)

	const uniqueQueries: string[] = []
	const usedIndices = new Set<number>()

	for (let i = 0; i < newQueries.length; i++) {
		let isUnique = true

		// Contra existentes
		for (let j = 0; j < existingQueries.length; j++) {
			const similarity = cosineSimilarity(newEmbeddings[i], existingEmbeddings[j])
			if (similarity >= SIMILARITY_THRESHOLD) {
				isUnique = false
				break
			}
		}

		// Contra já aceitas
		if (isUnique) {
			for (const usedIndex of usedIndices) {
				const similarity = cosineSimilarity(newEmbeddings[i], newEmbeddings[usedIndex])
				if (similarity >= SIMILARITY_THRESHOLD) {
					isUnique = false
					break
				}
			}
		}

		if (isUnique) {
			uniqueQueries.push(newQueries[i])
			usedIndices.add(i)
		}
	}

	return { unique_queries: uniqueQueries }
}
