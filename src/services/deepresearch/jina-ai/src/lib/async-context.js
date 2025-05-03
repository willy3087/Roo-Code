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
import { GlobalAsyncContext } from "civkit/async-context"
import { container, singleton } from "tsyringe"
let AsyncLocalContext = class AsyncLocalContext extends GlobalAsyncContext {}
AsyncLocalContext = __decorate([singleton()], AsyncLocalContext)
export { AsyncLocalContext }
const instance = container.resolve(AsyncLocalContext)
Reflect.set(process, "asyncLocalContext", instance)
export default instance
//# sourceMappingURL=async-context.js.map
