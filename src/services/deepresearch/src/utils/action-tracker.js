import { EventEmitter } from "events"
import { getI18nText } from "./text-tools"
export class ActionTracker extends EventEmitter {
	state = {
		thisStep: { action: "answer", answer: "", references: [], think: "" },
		gaps: [],
		totalStep: 0,
	}
	trackAction(newState) {
		this.state = { ...this.state, ...newState }
		this.emit("action", this.state.thisStep)
	}
	trackThink(think, lang, params = {}) {
		if (lang) {
			think = getI18nText(think, lang, params)
		}
		this.state = { ...this.state, thisStep: { ...this.state.thisStep, URLTargets: [], think } }
		this.emit("action", this.state.thisStep)
	}
	getState() {
		return { ...this.state }
	}
	reset() {
		this.state = {
			thisStep: { action: "answer", answer: "", references: [], think: "" },
			gaps: [],
			totalStep: 0,
		}
	}
}
//# sourceMappingURL=action-tracker.js.map
