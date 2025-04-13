// Roo-first: Broken Character Fixer Tool
import { z } from "zod"
import { logger } from "../../../utils/logging"

// Schema de entrada
export const brokenChFixerInputSchema = z.object({
	text: z.string().min(1, "Texto obrigatório"),
})

// Schema de saída
export const brokenChFixerOutputSchema = z.object({
	fixedText: z.string(),
})

export type BrokenChFixerInput = z.infer<typeof brokenChFixerInputSchema>
export type BrokenChFixerOutput = z.infer<typeof brokenChFixerOutputSchema>

/**
 * Corrige caracteres quebrados em textos (ex: encoding, símbolos, etc).
 * Implementação Roo-first, sem dependências herdadas.
 */
export function brokenChFixerTool(input: BrokenChFixerInput): BrokenChFixerOutput {
	logger.info("[brokenChFixerTool] Corrigindo texto", { length: input.text.length })

	// Substituições para encoding UTF-8 quebrado (mais abrangente)
	let fixed = input.text
		.replace(/Ã¡/g, "á")
		.replace(/Ã¢/g, "â")
		.replace(/Ã£/g, "ã")
		.replace(/Ãª/g, "ê")
		.replace(/Ã©/g, "é")
		.replace(/Ã¨/g, "è")
		.replace(/Ã­/g, "í")
		.replace(/Ã³/g, "ó")
		.replace(/Ã´/g, "ô")
		.replace(/Ãº/g, "ú")
		.replace(/Ã¼/g, "ü")
		.replace(/Ã§/g, "ç")
		.replace(/Ã/g, "à")
		.replace(/â/g, "–")
		.replace(/â/g, "“")
		.replace(/â/g, "”")
		.replace(/â¢/g, "•")
		.replace(/â¦/g, "…")
		.replace(/â/g, "—")
		.replace(/â¦/g, "…")
		.replace(/àª/g, "ê")
		.replace(/à©/g, "é")
		.replace(/à¡/g, "á")
		.replace(/à³/g, "ó")
		.replace(/à§/g, "ç")
		.replace(/à£/g, "ã")
		.replace(/àº/g, "ú")
		.replace(/à­/g, "í")

	logger.info("[brokenChFixerTool] Texto corrigido", { length: fixed.length })
	return brokenChFixerOutputSchema.parse({ fixedText: fixed })
}
