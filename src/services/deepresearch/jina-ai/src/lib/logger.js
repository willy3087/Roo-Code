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
import { AbstractPinoLogger } from "civkit/pino-logger"
import { singleton, container } from "tsyringe"
import { threadId } from "node:worker_threads"
import { getTraceCtx } from "civkit/async-context"
const levelToSeverityMap = {
	trace: "DEFAULT",
	debug: "DEBUG",
	info: "INFO",
	warn: "WARNING",
	error: "ERROR",
	fatal: "CRITICAL",
}
let GlobalLogger = class GlobalLogger extends AbstractPinoLogger {
	loggerOptions = {
		level: "debug",
		base: {
			tid: threadId,
		},
	}
	init() {
		if (process.env["NODE_ENV"]?.startsWith("prod")) {
			super.init(process.stdout)
		} else {
			const PinoPretty = require("pino-pretty").PinoPretty
			super.init(
				PinoPretty({
					singleLine: true,
					colorize: true,
					messageFormat(log, messageKey) {
						return `${log["tid"] ? `[${log["tid"]}]` : ""}[${log["service"] || "ROOT"}] ${log[messageKey]}`
					},
				}),
			)
		}
		this.emit("ready")
	}
	log(...args) {
		const [levelObj, ...rest] = args
		const severity = levelToSeverityMap[levelObj?.level]
		const traceCtx = getTraceCtx()
		const patched = { ...levelObj, severity }
		if (traceCtx?.traceId && process.env["GCLOUD_PROJECT"]) {
			patched["logging.googleapis.com/trace"] =
				`projects/${process.env["GCLOUD_PROJECT"]}/traces/${traceCtx.traceId}`
		}
		return super.log(patched, ...rest)
	}
}
GlobalLogger = __decorate([singleton()], GlobalLogger)
export { GlobalLogger }
const instance = container.resolve(GlobalLogger)
export default instance
//# sourceMappingURL=logger.js.map
