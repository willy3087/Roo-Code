import { z } from "zod"
// Schema de entrada para a ferramenta grounding
export const groundingInputSchema = z.object({
	text: z.string().min(1, "Texto de entrada obrigatório"),
	context: z.string().optional(),
})

// Schema de saída para a ferramenta grounding
export const groundingOutputSchema = z.object({
	grounded: z.boolean(),
	reason: z.string(),
	details: z.record(z.string(), z.any()).optional(),
})

export type GroundingInput = z.infer<typeof groundingInputSchema>
export type GroundingOutput = z.infer<typeof groundingOutputSchema>

/**
 * Ferramenta Roo-first para grounding.
 * Recebe um texto e (opcionalmente) contexto, e determina se o texto está "grounded" (ancorado em fatos/contexto).
 */
export async function groundingTool(input: GroundingInput): Promise<GroundingOutput> {
	// Exemplo de lógica simples: considera "grounded" se o texto contém o contexto (caso fornecido)
	let grounded = true
	let reason = "Texto considerado grounded."
	if (input.context && !input.text.includes(input.context)) {
		grounded = false
		reason = "Texto não contém o contexto fornecido."
	}

	return {
		grounded,
		reason,
		details: grounded ? undefined : { missingContext: input.context },
	}
}
