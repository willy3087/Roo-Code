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
import { ApplicationError, OperationNotAllowedError, Prop, RPC_CALL_ENVIRONMENT } from "civkit/civ-rpc"
import { marshalErrorLike } from "civkit/lang"
import { randomUUID } from "crypto"
import { once } from "events"
import { JinaEmbeddingsAuthDTO } from "./dto/jina-embeddings-auth"
import rateLimitControl, { API_CALL_STATUS, RateLimitDesc } from "./rate-limit"
import asyncLocalContext from "./lib/async-context"
import globalLogger from "./lib/logger"
import { InsufficientBalanceError } from "./lib/errors"
import { firebaseDefaultBucket, FirestoreRecord } from "./lib/firestore"
import cors from "cors"
globalLogger.serviceReady()
const logger = globalLogger.child({ service: "JinaAISaaSMiddleware" })
const appName = "DEEPRESEARCH"
export class KnowledgeItem extends FirestoreRecord {
	static collectionName = "knowledgeItems"
	traceId
	uid
	question
	answer
	type
	references
	createdAt
	updatedAt
}
__decorate(
	[
		Prop({
			required: true,
		}),
	],
	KnowledgeItem.prototype,
	"traceId",
	void 0,
)
__decorate(
	[
		Prop({
			required: true,
		}),
	],
	KnowledgeItem.prototype,
	"uid",
	void 0,
)
__decorate(
	[
		Prop({
			default: "",
		}),
	],
	KnowledgeItem.prototype,
	"question",
	void 0,
)
__decorate(
	[
		Prop({
			default: "",
		}),
	],
	KnowledgeItem.prototype,
	"answer",
	void 0,
)
__decorate(
	[
		Prop({
			default: "",
		}),
	],
	KnowledgeItem.prototype,
	"type",
	void 0,
)
__decorate(
	[
		Prop({
			arrayOf: Object,
			default: [],
		}),
	],
	KnowledgeItem.prototype,
	"references",
	void 0,
)
__decorate(
	[
		Prop({
			defaultFactory: () => new Date(),
		}),
	],
	KnowledgeItem.prototype,
	"createdAt",
	void 0,
)
__decorate(
	[
		Prop({
			defaultFactory: () => new Date(),
		}),
	],
	KnowledgeItem.prototype,
	"updatedAt",
	void 0,
)
const corsMiddleware = cors()
export const jinaAiMiddleware = (req, res, next) => {
	if (req.path === "/ping") {
		res.status(200).end("pone")
		return
	}
	if (req.path.startsWith("/v1/models")) {
		next()
		return
	}
	if (req.method !== "POST" && req.method !== "GET") {
		next()
		return
	}
	asyncLocalContext.run(async () => {
		const googleTraceId = req.get("x-cloud-trace-context")?.split("/")?.[0]
		const ctx = asyncLocalContext.ctx
		ctx.traceId = req.get("x-request-id") || req.get("request-id") || googleTraceId || randomUUID()
		ctx.traceT0 = new Date()
		ctx.ip = req?.ip
		try {
			const authDto = JinaEmbeddingsAuthDTO.from({
				[RPC_CALL_ENVIRONMENT]: { req, res },
			})
			const uid = await authDto.solveUID()
			if (!uid && !ctx.ip) {
				throw new OperationNotAllowedError(`Missing IP information for anonymous user`)
			}
			let rateLimitPolicy
			if (uid) {
				const user = await authDto.assertUser()
				if (!(user.wallet.total_balance > 0)) {
					throw new InsufficientBalanceError(`Account balance not enough to run this query, please recharge.`)
				}
				rateLimitPolicy = authDto.getRateLimits(appName) || [
					parseInt(user.metadata?.speed_level) >= 2
						? RateLimitDesc.from({
								occurrence: 100,
								periodSeconds: 60,
							})
						: RateLimitDesc.from({
								occurrence: 10,
								periodSeconds: 60,
							}),
				]
			} else {
				rateLimitPolicy = [
					RateLimitDesc.from({
						occurrence: 2,
						periodSeconds: 60,
					}),
				]
			}
			const criterions = rateLimitPolicy.map((c) => rateLimitControl.rateLimitDescToCriterion(c))
			await Promise.all(
				criterions.map(([pointInTime, n]) =>
					uid
						? rateLimitControl.assertUidPeriodicLimit(uid, pointInTime, n, appName)
						: rateLimitControl.assertIPPeriodicLimit(ctx.ip, pointInTime, n, appName),
				),
			)
			const draftApiCall = { tags: [appName] }
			if (uid) {
				draftApiCall.uid = uid
			} else {
				draftApiCall.ip = ctx.ip
			}
			const apiRoll = rateLimitControl.record(draftApiCall)
			apiRoll
				.save()
				.catch((err) => logger.warn(`Failed to save rate limit record`, { err: marshalErrorLike(err) }))
			const pResClose = once(res, "close")
			next()
			await pResClose
			const chargeAmount = ctx.chargeAmount
			if (chargeAmount) {
				authDto.reportUsage(chargeAmount, `reader-${appName}`).catch((err) => {
					logger.warn(`Unable to report usage for ${uid || ctx.ip}`, { err: marshalErrorLike(err) })
				})
				apiRoll.chargeAmount = chargeAmount
			}
			apiRoll.status = res.statusCode === 200 ? API_CALL_STATUS.SUCCESS : API_CALL_STATUS.ERROR
			apiRoll
				.save()
				.catch((err) => logger.warn(`Failed to save rate limit record`, { err: marshalErrorLike(err) }))
			logger.info(
				`HTTP ${res.statusCode} for request ${ctx.traceId} after ${Date.now() - ctx.traceT0.valueOf()}ms`,
				{
					uid,
					ip: ctx.ip,
					chargeAmount,
				},
			)
			if (uid && ctx.promptContext?.knowledge?.length) {
				Promise.all(
					ctx.promptContext.knowledge.map((x) =>
						KnowledgeItem.save(
							KnowledgeItem.from({
								...x,
								uid,
								traceId: ctx.traceId,
							}),
						),
					),
				).catch((err) => {
					logger.warn(`Failed to save knowledge`, { err: marshalErrorLike(err) })
				})
			}
			if (ctx.promptContext) {
				const patchedCtx = { ...ctx.promptContext }
				if (Array.isArray(patchedCtx.context)) {
					patchedCtx.context = patchedCtx.context.map((x) => ({ ...x, result: undefined }))
				}
				firebaseDefaultBucket
					.file(`promptContext/${ctx.traceId}.json`)
					.save(JSON.stringify(patchedCtx), {
						metadata: {
							contentType: "application/json",
						},
					})
					.catch((err) => {
						logger.warn(`Failed to save promptContext`, { err: marshalErrorLike(err) })
					})
			}
		} catch (err) {
			if (!res.headersSent) {
				corsMiddleware(req, res, () => "noop")
				if (err instanceof ApplicationError) {
					res.status(parseInt(err.code) || 500).json({ error: err.message })
					return
				}
				res.status(500).json({ error: "Internal" })
			}
			logger.error(`Error in billing middleware`, { err: marshalErrorLike(err) })
			if (err.stack) {
				logger.error(err.stack)
			}
		}
	})
}
//# sourceMappingURL=patch-express.js.map
