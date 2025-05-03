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
var APICall_1
import { AutoCastable, ResourcePolicyDenyError, Also, Prop } from "civkit/civ-rpc"
import { AsyncService } from "civkit/async-service"
import { getTraceId } from "civkit/async-context"
import { singleton, container } from "tsyringe"
import { RateLimitTriggeredError } from "./lib/errors"
import { FirestoreRecord } from "./lib/firestore"
export var API_CALL_STATUS
;(function (API_CALL_STATUS) {
	API_CALL_STATUS["SUCCESS"] = "success"
	API_CALL_STATUS["ERROR"] = "error"
	API_CALL_STATUS["PENDING"] = "pending"
})(API_CALL_STATUS || (API_CALL_STATUS = {}))
let APICall = class APICall extends FirestoreRecord {
	static {
		APICall_1 = this
	}
	static collectionName = "apiRoll"
	traceId
	uid
	ip
	tags
	createdAt
	completedAt
	status
	expireAt
	tag(...tags) {
		for (const t of tags) {
			if (!this.tags.includes(t)) {
				this.tags.push(t)
			}
		}
	}
	save() {
		return this.constructor.save(this)
	}
}
__decorate(
	[
		Prop({
			required: true,
			defaultFactory: () => getTraceId(),
		}),
	],
	APICall.prototype,
	"traceId",
	void 0,
)
__decorate([Prop()], APICall.prototype, "uid", void 0)
__decorate([Prop()], APICall.prototype, "ip", void 0)
__decorate(
	[
		Prop({
			arrayOf: String,
			default: [],
		}),
	],
	APICall.prototype,
	"tags",
	void 0,
)
__decorate(
	[
		Prop({
			required: true,
			defaultFactory: () => new Date(),
		}),
	],
	APICall.prototype,
	"createdAt",
	void 0,
)
__decorate([Prop()], APICall.prototype, "completedAt", void 0)
__decorate(
	[
		Prop({
			required: true,
			default: API_CALL_STATUS.PENDING,
		}),
	],
	APICall.prototype,
	"status",
	void 0,
)
__decorate(
	[
		Prop({
			required: true,
			defaultFactory: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
		}),
	],
	APICall.prototype,
	"expireAt",
	void 0,
)
APICall = APICall_1 = __decorate([Also({ dictOf: Object })], APICall)
export { APICall }
export class RateLimitDesc extends AutoCastable {
	occurrence
	periodSeconds
	notBefore
	notAfter
	isEffective() {
		const now = new Date()
		if (this.notBefore && this.notBefore > now) {
			return false
		}
		if (this.notAfter && this.notAfter < now) {
			return false
		}
		return true
	}
}
__decorate(
	[
		Prop({
			default: 1000,
		}),
	],
	RateLimitDesc.prototype,
	"occurrence",
	void 0,
)
__decorate(
	[
		Prop({
			default: 3600,
		}),
	],
	RateLimitDesc.prototype,
	"periodSeconds",
	void 0,
)
__decorate([Prop()], RateLimitDesc.prototype, "notBefore", void 0)
__decorate([Prop()], RateLimitDesc.prototype, "notAfter", void 0)
let RateLimitControl = class RateLimitControl extends AsyncService {
	globalLogger
	logger
	constructor(globalLogger) {
		super(...arguments)
		this.globalLogger = globalLogger
		this.logger = this.globalLogger.child({ service: this.constructor.name })
	}
	async init() {
		await this.dependencyReady()
		this.emit("ready")
	}
	async queryByUid(uid, pointInTime, ...tags) {
		let q = APICall.COLLECTION.orderBy("createdAt", "asc")
			.where("createdAt", ">=", pointInTime)
			.where("status", "in", [API_CALL_STATUS.SUCCESS, API_CALL_STATUS.PENDING])
			.where("uid", "==", uid)
		if (tags.length) {
			q = q.where("tags", "array-contains-any", tags)
		}
		return APICall.fromFirestoreQuery(q)
	}
	async queryByIp(ip, pointInTime, ...tags) {
		let q = APICall.COLLECTION.orderBy("createdAt", "asc")
			.where("createdAt", ">=", pointInTime)
			.where("status", "in", [API_CALL_STATUS.SUCCESS, API_CALL_STATUS.PENDING])
			.where("ip", "==", ip)
		if (tags.length) {
			q = q.where("tags", "array-contains-any", tags)
		}
		return APICall.fromFirestoreQuery(q)
	}
	async assertUidPeriodicLimit(uid, pointInTime, limit, ...tags) {
		if (limit <= 0) {
			throw new ResourcePolicyDenyError(
				`This UID(${uid}) is not allowed to call this endpoint (rate limit quota is 0).`,
			)
		}
		let q = APICall.COLLECTION.orderBy("createdAt", "asc")
			.where("createdAt", ">=", pointInTime)
			.where("status", "in", [API_CALL_STATUS.SUCCESS, API_CALL_STATUS.PENDING])
			.where("uid", "==", uid)
		if (tags.length) {
			q = q.where("tags", "array-contains-any", tags)
		}
		const count = (await q.count().get()).data().count
		if (count >= limit) {
			const r = await APICall.fromFirestoreQuery(q.limit(1))
			const [r1] = r
			const dtMs = Math.abs(r1.createdAt?.valueOf() - pointInTime.valueOf())
			const dtSec = Math.ceil(dtMs / 1000)
			throw RateLimitTriggeredError.from({
				message: `Per UID rate limit exceeded (${tags.join(",") || "called"} ${limit} times since ${pointInTime})`,
				retryAfter: dtSec,
			})
		}
		return count + 1
	}
	async assertIPPeriodicLimit(ip, pointInTime, limit, ...tags) {
		let q = APICall.COLLECTION.orderBy("createdAt", "asc")
			.where("createdAt", ">=", pointInTime)
			.where("status", "in", [API_CALL_STATUS.SUCCESS, API_CALL_STATUS.PENDING])
			.where("ip", "==", ip)
		if (tags.length) {
			q = q.where("tags", "array-contains-any", tags)
		}
		const count = (await q.count().get()).data().count
		if (count >= limit) {
			const r = await APICall.fromFirestoreQuery(q.limit(1))
			const [r1] = r
			const dtMs = Math.abs(r1.createdAt?.valueOf() - pointInTime.valueOf())
			const dtSec = Math.ceil(dtMs / 1000)
			throw RateLimitTriggeredError.from({
				message: `Per IP rate limit exceeded (${tags.join(",") || "called"} ${limit} times since ${pointInTime})`,
				retryAfter: dtSec,
			})
		}
		return count + 1
	}
	record(partialRecord) {
		const record = APICall.from(partialRecord)
		const newId = APICall.COLLECTION.doc().id
		record._id = newId
		return record
	}
	// async simpleRPCUidBasedLimit(rpcReflect: RPCReflection, uid: string, tags: string[] = [],
	//     ...inputCriterion: RateLimitDesc[] | [Date, number][]) {
	//     const criterion = inputCriterion.map((c) => { return Array.isArray(c) ? c : this.rateLimitDescToCriterion(c); });
	//     await Promise.all(criterion.map(([pointInTime, n]) =>
	//         this.assertUidPeriodicLimit(uid, pointInTime, n, ...tags)));
	//     const r = this.record({
	//         uid,
	//         tags,
	//     });
	//     r.save().catch((err) => this.logger.warn(`Failed to save rate limit record`, { err }));
	//     rpcReflect.then(() => {
	//         r.status = API_CALL_STATUS.SUCCESS;
	//         r.save()
	//             .catch((err) => this.logger.warn(`Failed to save rate limit record`, { err }));
	//     });
	//     rpcReflect.catch((err) => {
	//         r.status = API_CALL_STATUS.ERROR;
	//         r.error = err.toString();
	//         r.save()
	//             .catch((err) => this.logger.warn(`Failed to save rate limit record`, { err }));
	//     });
	//     return r;
	// }
	rateLimitDescToCriterion(rateLimitDesc) {
		return [new Date(Date.now() - rateLimitDesc.periodSeconds * 1000), rateLimitDesc.occurrence]
	}
}
RateLimitControl = __decorate([singleton()], RateLimitControl)
export { RateLimitControl }
const instance = container.resolve(RateLimitControl)
export default instance
//# sourceMappingURL=rate-limit.js.map
