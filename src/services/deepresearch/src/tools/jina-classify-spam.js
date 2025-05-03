import axios from "axios"
import { TokenTracker } from "../utils/token-tracker"
import { JINA_API_KEY } from "../config"
const JINA_API_URL = "https://api.jina.ai/v1/classify"
export async function classifyText(
	text,
	classifierId = "4a27dea0-381e-407c-bc67-250de45763dd", // Default spam classifier ID
	timeoutMs = 5000, // Default timeout of 5 seconds
	tracker,
) {
	try {
		if (!JINA_API_KEY) {
			throw new Error("JINA_API_KEY is not set")
		}
		const request = {
			classifier_id: classifierId,
			input: [text],
		}
		// Create a timeout promise
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Classification request timed out after ${timeoutMs}ms`)), timeoutMs)
		})
		// Make the API request with axios
		const apiRequestPromise = axios.post(JINA_API_URL, request, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${JINA_API_KEY}`,
			},
			timeout: timeoutMs, // Also set axios timeout
		})
		// Race the API request against the timeout
		const response = await Promise.race([apiRequestPromise, timeoutPromise])
		// Track token usage from the API
		;(tracker || new TokenTracker()).trackUsage("classify", {
			promptTokens: response.data.usage.total_tokens,
			completionTokens: 0,
			totalTokens: response.data.usage.total_tokens,
		})
		// Extract the prediction field and convert to boolean
		if (response.data.data && response.data.data.length > 0) {
			// Convert string "true"/"false" to actual boolean
			return response.data.data[0].prediction === "true"
		}
		return false // Default to false if no prediction is available
	} catch (error) {
		if (error instanceof Error && error.message.includes("timed out")) {
			console.error("Classification request timed out:", error.message)
		} else {
			console.error("Error in classifying text:", error)
		}
		return false // Default to false in case of error or timeout
	}
}
//# sourceMappingURL=jina-classify-spam.js.map
