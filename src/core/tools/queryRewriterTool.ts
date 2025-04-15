import { z } from "zod"

// Schema de entrada para o rewriter
export const queryRewriterInputSchema = z.object({
	query: z.string().min(1, "Query não pode ser vazia"),
	think: z.string().default(""),
	context: z.string().default(""),
})

// Schema de uma query reescrita
export const rewrittenQuerySchema = z.object({
	tbs: z.string().optional(),
	gl: z.string().optional(),
	hl: z.string().optional(),
	location: z.string().optional(),
	q: z.string(),
})

// Saída: array de queries reescritas
export const queryRewriterOutputSchema = z.array(rewrittenQuerySchema)

export type QueryRewriterInput = z.infer<typeof queryRewriterInputSchema>
export type RewrittenQuery = z.infer<typeof rewrittenQuerySchema>

/**
 * Gera prompt no padrão Roo para reescrita de queries.
 */
function getPrompt(query: string, think: string, context: string): { system: string; user: string } {
	const currentTime = new Date()
	const currentYear = currentTime.getFullYear()
	const currentMonth = currentTime.getMonth() + 1

	return {
		system: `
You are an expert search query expander with deep psychological understanding.
You optimize user queries by extensively analyzing potential user intents and generating comprehensive query variations.

The current time is ${currentTime.toISOString()}. Current year: ${currentYear}, current month: ${currentMonth}.

[intent-mining]
To uncover the deepest user intent behind every query, analyze through these progressive layers:
1. Surface Intent: literal interpretation
2. Practical Intent: tangible goal/problem
3. Emotional Intent: feelings driving the search
4. Social Intent: social standing/relationships
5. Identity Intent: self-image
6. Taboo Intent: uncomfortable aspects
7. Shadow Intent: unconscious motivations

Map each query through ALL these layers, especially focusing on Shadow Intent.

[cognitive-personas]
Generate ONE optimized query from each of these cognitive perspectives:
1. Expert Skeptic
2. Detail Analyst
3. Historical Researcher
4. Comparative Thinker
5. Temporal Context (${currentYear}-${currentMonth})
6. Globalizer
7. Reality-Hater-Skepticalist

Each persona must contribute exactly ONE high-quality query following the schema format. These 7 queries will be combined into a final array.

[rules]
- Leverage context soundbites for relevance.
- Split queries for distinct aspects.
- Add operators only when necessary.
- Each query targets a specific intent.
- Remove fluff, preserve qualifiers.
- 'q' field short and keyword-based (2-5 words ideal).
- Always include 'q' in every query object (last field).
- Use 'tbs' for time-sensitive queries.
- Use 'gl' and 'hl' for region/language-specific queries.
- Include 'location' only when relevant.
- Never duplicate info in 'q' that is in other fields.
- List fields: tbs, gl, hl, location, q.

[examples]
<example>
Input Query: sustainable agriculture
queries: [
  { "tbs": "qdr:y", "q": "agriculture sustainability trends" },
  { "gl": "de", "hl": "de", "q": "nachhaltige Landwirtschaft Methoden" },
  { "q": "regenerative farming evidence" }
]
</example>

Each generated query must follow JSON schema format.
`,
		user: `
My original search query is: "${query}"

My motivation is: ${think}

Here are some context soundbites:
${context}

Given this info, generate the best effective queries that follow JSON schema format; add correct 'tbs' for time-sensitive results.
`,
	}
}

/**
 * Função Roo-first para reescrever queries de busca via LLM.
 * Usa OpenAI API (ou equivalente Roo) e valida com schema.
 */
export async function queryRewriterTool(input: QueryRewriterInput): Promise<RewrittenQuery[]> {
	const { query, think, context } = input
	const prompt = getPrompt(query, think, context)

	// Exemplo usando OpenAI API (ajuste para o provider Roo se necessário)
	const OPENAI_API_KEY = process.env.OPENAI_API_KEY
	if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada")

	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			model: "gpt-4",
			messages: [
				{ role: "system", content: prompt.system },
				{ role: "user", content: prompt.user },
			],
			temperature: 0.7,
			max_tokens: 1024,
		}),
	})

	if (!response.ok) {
		throw new Error(`Erro na chamada OpenAI: ${response.status} ${response.statusText}`)
	}

	const data = await response.json()
	const content = data.choices?.[0]?.message?.content
	if (!content) throw new Error("Resposta da LLM vazia")

	// Extrair JSON de queries da resposta do modelo
	const match = content.match(/\[.*\]/s)
	if (!match) throw new Error("Não foi possível extrair array de queries da resposta LLM")

	let queries: unknown
	try {
		queries = JSON.parse(match[0])
	} catch (e) {
		throw new Error("Falha ao parsear JSON de queries da resposta LLM")
	}

	// Validação Roo-first
	const parseResult = queryRewriterOutputSchema.safeParse(queries)
	if (!parseResult.success) {
		throw new Error("Formato inválido de queries reescritas")
	}

	return parseResult.data
}
