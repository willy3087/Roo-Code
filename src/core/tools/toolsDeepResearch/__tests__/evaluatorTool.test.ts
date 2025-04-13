import { buildAllEvaluationPrompts, AnswerAction, EvaluationType, KnowledgeItem } from "../evaluator"

describe("evaluator Roo-first", () => {
	const question = "O que é a fotossíntese?"
	const answerAction: AnswerAction = { answer: "A fotossíntese é o processo pelo qual plantas produzem energia." }
	const allKnowledge: KnowledgeItem[] = [
		{ question: "O que é clorofila?", answer: "Clorofila é o pigmento responsável pela cor verde das plantas." },
	]

	it("deve gerar prompt para avaliação definitiva", () => {
		const evaluationTypes: EvaluationType[] = ["definitive"]
		const prompts = buildAllEvaluationPrompts(question, answerAction, evaluationTypes, allKnowledge)
		expect(prompts).toHaveLength(1)
		expect(prompts[0].type).toBe("definitive")
		expect(prompts[0].prompt).toHaveProperty("system")
		expect(prompts[0].prompt).toHaveProperty("user")
		expect(typeof prompts[0].prompt.system).toBe("string")
		expect(typeof prompts[0].prompt.user).toBe("string")
	})

	it("deve gerar prompts para múltiplos tipos de avaliação", () => {
		const evaluationTypes: EvaluationType[] = ["definitive", "completeness", "plurality"]
		const prompts = buildAllEvaluationPrompts(question, answerAction, evaluationTypes, allKnowledge)
		expect(prompts).toHaveLength(3)
		const types = prompts.map((p) => p.type)
		expect(types).toContain("definitive")
		expect(types).toContain("completeness")
		expect(types).toContain("plurality")
	})

	it("deve lançar erro para tipo de avaliação inválido", () => {
		// @ts-expect-error Testando tipo inválido propositalmente
		expect(() => buildAllEvaluationPrompts(question, answerAction, ["invalido"], allKnowledge)).toThrow()
	})
})
