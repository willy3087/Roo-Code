import axios from "axios"
import { TokenTracker } from "../utils/token-tracker"
import { JINA_API_KEY } from "../config"
const JINA_API_URL = "https://api.jina.ai/v1/rerank"
/**
 * Reranks a list of documents based on relevance to a query
 * @param query The query to rank documents against
 * @param documents Array of documents to be ranked
 * @param topN Number of top results to return
 * @param tracker Optional token tracker for usage monitoring
 * @returns Array of reranked documents with their scores
 */
export async function rerankDocuments(query, documents, tracker) {
	try {
		if (!JINA_API_KEY) {
			throw new Error("JINA_API_KEY is not set")
		}
		const request = {
			model: "jina-reranker-v2-base-multilingual",
			query,
			top_n: documents.length,
			documents,
		}
		const response = await axios.post(JINA_API_URL, request, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${JINA_API_KEY}`,
			},
		})
		// Track token usage from the API
		;(tracker || new TokenTracker()).trackUsage("rerank", {
			promptTokens: response.data.usage.total_tokens,
			completionTokens: 0,
			totalTokens: response.data.usage.total_tokens,
		})
		return {
			results: response.data.results,
		}
	} catch (error) {
		console.error("Error in reranking documents:", error)
		// Return empty results if there is an error
		return {
			results: [],
		}
	}
}
//# sourceMappingURL=jina-rerank.js.map
