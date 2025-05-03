import { EventEmitter } from "events"
export class TokenTracker extends EventEmitter {
	usages = []
	budget
	constructor(budget) {
		super()
		this.budget = budget
		if ("asyncLocalContext" in process) {
			const asyncLocalContext = process.asyncLocalContext
			this.on("usage", () => {
				if (asyncLocalContext.available()) {
					asyncLocalContext.ctx.chargeAmount = this.getTotalUsage().totalTokens
				}
			})
		}
	}
	trackUsage(tool, usage) {
		const u = { tool, usage }
		this.usages.push(u)
		this.emit("usage", usage)
	}
	getTotalUsage() {
		return this.usages.reduce(
			(acc, { usage }) => {
				acc.promptTokens += usage.promptTokens
				acc.completionTokens += usage.completionTokens
				acc.totalTokens += usage.totalTokens
				return acc
			},
			{ promptTokens: 0, completionTokens: 0, totalTokens: 0 },
		)
	}
	getTotalUsageSnakeCase() {
		return this.usages.reduce(
			(acc, { usage }) => {
				acc.prompt_tokens += usage.promptTokens
				acc.completion_tokens += usage.completionTokens
				acc.total_tokens += usage.totalTokens
				return acc
			},
			{ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
		)
	}
	getUsageBreakdown() {
		return this.usages.reduce((acc, { tool, usage }) => {
			acc[tool] = (acc[tool] || 0) + usage.totalTokens
			return acc
		}, {})
	}
	printSummary() {
		const breakdown = this.getUsageBreakdown()
		console.log("Token Usage Summary:", {
			budget: this.budget,
			total: this.getTotalUsage(),
			breakdown,
		})
	}
	reset() {
		this.usages = []
	}
}
//# sourceMappingURL=token-tracker.js.map
