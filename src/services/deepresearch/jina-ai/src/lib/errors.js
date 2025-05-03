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
import { ApplicationError, Prop, RPC_TRANSFER_PROTOCOL_META_SYMBOL, StatusCode } from "civkit"
import _ from "lodash"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
dayjs.extend(utc)
let ServiceDisabledError = class ServiceDisabledError extends ApplicationError {}
ServiceDisabledError = __decorate([StatusCode(50301)], ServiceDisabledError)
export { ServiceDisabledError }
let ServiceCrashedError = class ServiceCrashedError extends ApplicationError {}
ServiceCrashedError = __decorate([StatusCode(50302)], ServiceCrashedError)
export { ServiceCrashedError }
let ServiceNodeResourceDrainError = class ServiceNodeResourceDrainError extends ApplicationError {}
ServiceNodeResourceDrainError = __decorate([StatusCode(50303)], ServiceNodeResourceDrainError)
export { ServiceNodeResourceDrainError }
let EmailUnverifiedError = class EmailUnverifiedError extends ApplicationError {}
EmailUnverifiedError = __decorate([StatusCode(40104)], EmailUnverifiedError)
export { EmailUnverifiedError }
let InsufficientCreditsError = class InsufficientCreditsError extends ApplicationError {}
InsufficientCreditsError = __decorate([StatusCode(40201)], InsufficientCreditsError)
export { InsufficientCreditsError }
let FreeFeatureLimitError = class FreeFeatureLimitError extends ApplicationError {}
FreeFeatureLimitError = __decorate([StatusCode(40202)], FreeFeatureLimitError)
export { FreeFeatureLimitError }
let InsufficientBalanceError = class InsufficientBalanceError extends ApplicationError {}
InsufficientBalanceError = __decorate([StatusCode(40203)], InsufficientBalanceError)
export { InsufficientBalanceError }
let LockConflictError = class LockConflictError extends ApplicationError {}
LockConflictError = __decorate([StatusCode(40903)], LockConflictError)
export { LockConflictError }
let BudgetExceededError = class BudgetExceededError extends ApplicationError {}
BudgetExceededError = __decorate([StatusCode(40904)], BudgetExceededError)
export { BudgetExceededError }
let HarmfulContentError = class HarmfulContentError extends ApplicationError {}
HarmfulContentError = __decorate([StatusCode(45101)], HarmfulContentError)
export { HarmfulContentError }
let SecurityCompromiseError = class SecurityCompromiseError extends ApplicationError {}
SecurityCompromiseError = __decorate([StatusCode(45102)], SecurityCompromiseError)
export { SecurityCompromiseError }
let BatchSizeTooLargeError = class BatchSizeTooLargeError extends ApplicationError {}
BatchSizeTooLargeError = __decorate([StatusCode(41201)], BatchSizeTooLargeError)
export { BatchSizeTooLargeError }
let RateLimitTriggeredError = class RateLimitTriggeredError extends ApplicationError {
	retryAfter
	retryAfterDate
	get [RPC_TRANSFER_PROTOCOL_META_SYMBOL]() {
		const retryAfter = this.retryAfter || this.retryAfterDate
		if (!retryAfter) {
			return super[RPC_TRANSFER_PROTOCOL_META_SYMBOL]
		}
		return _.merge(_.cloneDeep(super[RPC_TRANSFER_PROTOCOL_META_SYMBOL]), {
			headers: {
				"Retry-After": `${retryAfter instanceof Date ? dayjs(retryAfter).utc().format("ddd, DD MMM YYYY HH:mm:ss [GMT]") : retryAfter}`,
			},
		})
	}
}
__decorate(
	[
		Prop({
			desc: "Retry after seconds",
		}),
	],
	RateLimitTriggeredError.prototype,
	"retryAfter",
	void 0,
)
__decorate(
	[
		Prop({
			desc: "Retry after date",
		}),
	],
	RateLimitTriggeredError.prototype,
	"retryAfterDate",
	void 0,
)
RateLimitTriggeredError = __decorate([StatusCode(42903)], RateLimitTriggeredError)
export { RateLimitTriggeredError }
//# sourceMappingURL=errors.js.map
