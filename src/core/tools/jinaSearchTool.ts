import https from "https"
import { z } from "zod"

// Schema de entrada para a ferramenta Jina Search
export const jinaSearchInputSchema = z.object({
	query: z.string().min(1, "Query não pode ser vazia"),
})

// Schema de item de resultado da Jina API
export const jinaSearchResultItemSchema = z.object({
	title: z.string().optional(),
	url: z.string(),
	snippet: z.string().optional(),
	usage: z
		.object({
			tokens: z.number().optional(),
		})
		.optional(),
})

// Schema de resposta da Jina API
export const jinaSearchResponseSchema = z.object({
	data: z.array(jinaSearchResultItemSchema),
	code: z.number().optional(),
	message: z.string().optional(),
})

export type JinaSearchInput = z.infer<typeof jinaSearchInputSchema>
export type JinaSearchResponse = z.infer<typeof jinaSearchResponseSchema>

/**
 * Ferramenta Roo-first para busca Jina.
 * Faz uma requisição à API Jina Search e retorna os resultados.
 */
export async function jinaSearchTool(input: JinaSearchInput): Promise<JinaSearchResponse> {
	const { query } = input

	if (!query.trim()) {
		throw new Error("Query não pode ser vazia")
	}

	// TODO: Substitua pela forma Roo de obter secrets/configs, se necessário
	const JINA_API_KEY = process.env.JINA_API_KEY
	if (!JINA_API_KEY) {
		throw new Error("JINA_API_KEY não configurada")
	}

	const options = {
		hostname: "s.jina.ai",
		port: 443,
		path: `/?q=${encodeURIComponent(query)}`,
		method: "GET",
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${JINA_API_KEY}`,
			"X-Respond-With": "no-content",
		},
		timeout: 30000,
	}

	return new Promise<JinaSearchResponse>((resolve, reject) => {
		const req = https.request(options, (res) => {
			let responseData = ""

			res.on("data", (chunk) => (responseData += chunk))

			res.on("end", () => {
				if (res.statusCode && res.statusCode >= 400) {
					try {
						const errorResponse = JSON.parse(responseData)
						reject(new Error(errorResponse.readableMessage || `HTTP Error ${res.statusCode}`))
					} catch {
						reject(new Error(`HTTP Error ${res.statusCode}`))
					}
					return
				}

				let response: unknown
				try {
					response = JSON.parse(responseData)
				} catch (error: any) {
					reject(
						new Error(
							`Falha ao parsear resposta: ${
								error instanceof Error ? error.message : "Erro desconhecido"
							}`,
						),
					)
					return
				}

				// Validação Roo-first da resposta
				const parseResult = jinaSearchResponseSchema.safeParse(response)
				if (!parseResult.success) {
					reject(new Error("Formato de resposta inválido da Jina API"))
					return
				}

				resolve(parseResult.data)
			})
		})

		req.on("timeout", () => {
			req.destroy()
			reject(new Error("Request timed out"))
		})

		req.on("error", (error) => {
			reject(new Error(`Request failed: ${error.message}`))
		})

		req.end()
	})
}
