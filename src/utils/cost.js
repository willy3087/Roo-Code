function calculateApiCostInternal(
	modelInfo,
	inputTokens,
	outputTokens,
	cacheCreationInputTokens,
	cacheReadInputTokens,
) {
	const cacheWritesCost = ((modelInfo.cacheWritesPrice || 0) / 1_000_000) * cacheCreationInputTokens
	const cacheReadsCost = ((modelInfo.cacheReadsPrice || 0) / 1_000_000) * cacheReadInputTokens
	const baseInputCost = ((modelInfo.inputPrice || 0) / 1_000_000) * inputTokens
	const outputCost = ((modelInfo.outputPrice || 0) / 1_000_000) * outputTokens
	const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
	return totalCost
}
// For Anthropic compliant usage, the input tokens count does NOT include the cached tokens
export function calculateApiCostAnthropic(
	modelInfo,
	inputTokens,
	outputTokens,
	cacheCreationInputTokens,
	cacheReadInputTokens,
) {
	const cacheCreationInputTokensNum = cacheCreationInputTokens || 0
	const cacheReadInputTokensNum = cacheReadInputTokens || 0
	return calculateApiCostInternal(
		modelInfo,
		inputTokens,
		outputTokens,
		cacheCreationInputTokensNum,
		cacheReadInputTokensNum,
	)
}
// For OpenAI compliant usage, the input tokens count INCLUDES the cached tokens
export function calculateApiCostOpenAI(
	modelInfo,
	inputTokens,
	outputTokens,
	cacheCreationInputTokens,
	cacheReadInputTokens,
) {
	const cacheCreationInputTokensNum = cacheCreationInputTokens || 0
	const cacheReadInputTokensNum = cacheReadInputTokens || 0
	const nonCachedInputTokens = Math.max(0, inputTokens - cacheCreationInputTokensNum - cacheReadInputTokensNum)
	return calculateApiCostInternal(
		modelInfo,
		nonCachedInputTokens,
		outputTokens,
		cacheCreationInputTokensNum,
		cacheReadInputTokensNum,
	)
}
export const parseApiPrice = (price) => (price ? parseFloat(price) * 1_000_000 : undefined)
//# sourceMappingURL=cost.js.map
