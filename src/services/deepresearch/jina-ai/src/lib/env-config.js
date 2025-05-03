var __decorate =
	(this && this.__decorate) ||
	function (decorators, target, key, desc) {
		var c = arguments.length,
			r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
			d
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
			r = Reflect.decorate(decorators, target, key, desc)
		else
			for (var i = decorators.length - 1; i >= 0; i--)
				if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
		return c > 3 && r && Object.defineProperty(target, key, r), r
	}
import { container, singleton } from "tsyringe"
export const SPECIAL_COMBINED_ENV_KEY = "ENV_COMBINED"
const CONF_ENV = [
	"OPENAI_API_KEY",
	"ANTHROPIC_API_KEY",
	"REPLICATE_API_KEY",
	"GOOGLE_AI_STUDIO_API_KEY",
	"JINA_EMBEDDINGS_API_KEY",
	"JINA_EMBEDDINGS_DASHBOARD_API_KEY",
	"BRAVE_SEARCH_API_KEY",
]
let EnvConfig = class EnvConfig {
	dynamic
	combined = {}
	originalEnv = { ...process.env }
	constructor() {
		if (process.env[SPECIAL_COMBINED_ENV_KEY]) {
			Object.assign(
				this.combined,
				JSON.parse(Buffer.from(process.env[SPECIAL_COMBINED_ENV_KEY], "base64").toString("utf-8")),
			)
			delete process.env[SPECIAL_COMBINED_ENV_KEY]
		}
		// Static config
		for (const x of CONF_ENV) {
			const s = this.combined[x] || process.env[x] || ""
			Reflect.set(this, x, s)
			if (x in process.env) {
				delete process.env[x]
			}
		}
		// Dynamic config
		this.dynamic = new Proxy(
			{
				get: (_target, prop) => {
					return this.combined[prop] || process.env[prop] || ""
				},
			},
			{},
		)
	}
}
EnvConfig = __decorate([singleton()], EnvConfig)
export { EnvConfig }
const instance = container.resolve(EnvConfig)
export default instance
//# sourceMappingURL=env-config.js.map
