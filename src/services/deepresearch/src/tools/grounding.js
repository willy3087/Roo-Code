import { generateText } from "ai"
import { getModel } from "../config"
import { TokenTracker } from "../utils/token-tracker"
const model = getModel("searchGrounding")
export async function grounding(query, tracker) {
	try {
		const { text, experimental_providerMetadata, usage } = await generateText({
			model,
			prompt: `Current date is ${new Date().toISOString()}. Find the latest answer to the following question: 
<query>
${query}
</query>      
Must include the date and time of the latest answer.`,
		})
		const metadata = experimental_providerMetadata?.google
		const groundingMetadata = metadata?.groundingMetadata
		// Extract and concatenate all groundingSupport text into a single line
		const groundedText =
			groundingMetadata?.groundingSupports?.map((support) => support.segment.text).join(" ") || ""
		;(tracker || new TokenTracker()).trackUsage("grounding", usage)
		console.log("Grounding:", { text, groundedText })
		return text + "|" + groundedText
	} catch (error) {
		console.error("Error in search:", error)
		throw error
	}
}
//# sourceMappingURL=grounding.js.map
