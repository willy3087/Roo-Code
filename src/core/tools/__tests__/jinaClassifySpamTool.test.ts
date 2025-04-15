import { jinaClassifySpamTool } from "../jinaClassifySpamTool"

describe("jinaClassifySpamTool", () => {
	it("deve classificar texto como spam ou não usando a API Jina (se JINA_API_KEY estiver definida)", async () => {
		if (!process.env.JINA_API_KEY) {
			console.warn("JINA_API_KEY não definida, pulando teste de integração real.")
			return
		}
		const result = await jinaClassifySpamTool({
			text: "Você ganhou um prêmio! Clique aqui para resgatar.",
			classifierId: "4a27dea0-381e-407c-bc67-250de45763dd",
			timeoutMs: 5000,
		})
		expect(typeof result.isSpam).toBe("boolean")
	})

	it("deve lançar erro se a API key não estiver definida", async () => {
		const original = process.env.JINA_API_KEY
		delete process.env.JINA_API_KEY
		await expect(
			jinaClassifySpamTool({
				text: "Teste sem chave",
				classifierId: "4a27dea0-381e-407c-bc67-250de45763dd",
				timeoutMs: 5000,
			}),
		).rejects.toThrow()
		if (original) process.env.JINA_API_KEY = original
	})
})
