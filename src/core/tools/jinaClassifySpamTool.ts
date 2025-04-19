import { z } from "zod"
import axios from "axios"

// Schemas Roo
export const jinaClassifySpamInputSchema = z.object({
	text: z.string().min(1),
	classifierId: z.string().default("4a27dea0-381e-407c-bc67-250de45763dd"),
	timeoutMs: z.number().default(5000),
})
export const jinaClassifySpamOutputSchema = z.object({
	isSpam: z.boolean(),
})
export type JinaClassifySpamInput = z.infer<typeof jinaClassifySpamInputSchema>
export type JinaClassifySpamOutput = z.infer<typeof jinaClassifySpamOutputSchema>

/**
 * Ferramenta Roo-first para classificar texto como spam usando a API Jina.
 */
export async function jinaClassifySpamTool(input: JinaClassifySpamInput): Promise<JinaClassifySpamOutput> {
	const { text, classifierId, timeoutMs } = input
	const JINA_API_KEY = process.env.JINA_API_KEY
	if (!JINA_API_KEY) throw new Error("JINA_API_KEY não configurada")

	const request = {
		classifier_id: classifierId,
		input: [text],
	}

	try {
		const response = await axios.post("https://api.jina.ai/v1/classify", request, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${JINA_API_KEY}`,
			},
			timeout: timeoutMs,
		})

		if (response.data.data && response.data.data.length > 0) {
			return {
				isSpam: response.data.data[0].prediction === "true",
			}
		}
		return { isSpam: false }
	} catch (error: any) {
		// Em caso de erro ou timeout, retorna false
		return { isSpam: false }
	}
}
