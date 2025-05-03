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
import {
	Also,
	AuthenticationFailedError,
	AuthenticationRequiredError,
	DownstreamServiceFailureError,
	RPC_CALL_ENVIRONMENT,
	ArrayOf,
	AutoCastable,
	Prop,
} from "civkit/civ-rpc"
import { parseJSONText } from "civkit/vectorize"
import { htmlEscape } from "civkit/escape"
import { marshalErrorLike } from "civkit/lang"
import logger from "../lib/logger"
import { AsyncLocalContext } from "../lib/async-context"
import { InjectProperty } from "../lib/registry"
import { JinaEmbeddingsDashboardHTTP } from "../lib/billing"
import envConfig from "../lib/env-config"
import { FirestoreRecord } from "../lib/firestore"
import _ from "lodash"
import { RateLimitDesc } from "../rate-limit"
export class JinaWallet extends AutoCastable {
	user_id
	trial_balance
	trial_start
	trial_end
	regular_balance
	total_balance
}
__decorate(
	[
		Prop({
			default: "",
		}),
	],
	JinaWallet.prototype,
	"user_id",
	void 0,
)
__decorate(
	[
		Prop({
			default: 0,
		}),
	],
	JinaWallet.prototype,
	"trial_balance",
	void 0,
)
__decorate([Prop()], JinaWallet.prototype, "trial_start", void 0)
__decorate([Prop()], JinaWallet.prototype, "trial_end", void 0)
__decorate(
	[
		Prop({
			default: 0,
		}),
	],
	JinaWallet.prototype,
	"regular_balance",
	void 0,
)
__decorate(
	[
		Prop({
			default: 0,
		}),
	],
	JinaWallet.prototype,
	"total_balance",
	void 0,
)
export class JinaEmbeddingsTokenAccount extends FirestoreRecord {
	static collectionName = "embeddingsTokenAccounts"
	_id = ""
	user_id
	email
	full_name
	customer_id
	avatar_url
	// Not keeping sensitive info for now
	// @Prop()
	// billing_address?: object;
	// @Prop()
	// payment_method?: object;
	wallet
	metadata
	lastSyncedAt
	customRateLimits
	static patchedFields = []
	static from(input) {
		for (const field of this.patchedFields) {
			if (typeof input[field] === "string") {
				input[field] = parseJSONText(input[field])
			}
		}
		return super.from(input)
	}
	degradeForFireStore() {
		const copy = {
			...this,
			wallet: { ...this.wallet },
			// Firebase disability
			customRateLimits: _.mapValues(this.customRateLimits, (v) => v.map((x) => ({ ...x }))),
		}
		for (const field of this.constructor.patchedFields) {
			if (typeof copy[field] === "object") {
				copy[field] = JSON.stringify(copy[field])
			}
		}
		return copy
	}
}
__decorate(
	[
		Prop({
			required: true,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"user_id",
	void 0,
)
__decorate(
	[
		Prop({
			nullable: true,
			type: String,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"email",
	void 0,
)
__decorate(
	[
		Prop({
			nullable: true,
			type: String,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"full_name",
	void 0,
)
__decorate(
	[
		Prop({
			nullable: true,
			type: String,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"customer_id",
	void 0,
)
__decorate(
	[
		Prop({
			nullable: true,
			type: String,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"avatar_url",
	void 0,
)
__decorate(
	[
		Prop({
			required: true,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"wallet",
	void 0,
)
__decorate(
	[
		Prop({
			type: Object,
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"metadata",
	void 0,
)
__decorate(
	[
		Prop({
			defaultFactory: () => new Date(),
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"lastSyncedAt",
	void 0,
)
__decorate(
	[
		Prop({
			dictOf: [ArrayOf(RateLimitDesc)],
		}),
	],
	JinaEmbeddingsTokenAccount.prototype,
	"customRateLimits",
	void 0,
)
const authDtoLogger = logger.child({ service: "JinaAuthDTO" })
const THE_VERY_SAME_JINA_EMBEDDINGS_CLIENT = new JinaEmbeddingsDashboardHTTP(
	envConfig.JINA_EMBEDDINGS_DASHBOARD_API_KEY,
)
let JinaEmbeddingsAuthDTO = class JinaEmbeddingsAuthDTO extends AutoCastable {
	uid
	bearerToken
	user
	ctxMgr
	jinaEmbeddingsDashboard = THE_VERY_SAME_JINA_EMBEDDINGS_CLIENT
	static from(input) {
		const instance = super.from(input)
		const ctx = input[RPC_CALL_ENVIRONMENT]
		const req = ctx.rawRequest || ctx.req
		if (req) {
			const authorization = req.get("authorization")
			if (authorization) {
				const authToken = authorization.split(" ")[1] || authorization
				instance.bearerToken = authToken
			}
		}
		if (!instance.bearerToken && input._token) {
			instance.bearerToken = input._token
		}
		return instance
	}
	async getBrief(ignoreCache) {
		if (!this.bearerToken) {
			throw new AuthenticationRequiredError({
				message: "Jina API key is required to authenticate. Please get one from https://jina.ai",
			})
		}
		let account
		try {
			account = await JinaEmbeddingsTokenAccount.fromFirestore(this.bearerToken)
		} catch (err) {
			// FireStore would not accept any string as input and may throw if not happy with it
			void 0
		}
		const age = account?.lastSyncedAt ? Date.now() - account.lastSyncedAt.getTime() : Infinity
		if (account && !ignoreCache) {
			if (account && age < 180_000) {
				this.user = account
				this.uid = this.user?.user_id
				return account
			}
		}
		try {
			const r = await this.jinaEmbeddingsDashboard.validateToken(this.bearerToken)
			const brief = r.data
			const draftAccount = JinaEmbeddingsTokenAccount.from({
				...account,
				...brief,
				_id: this.bearerToken,
				lastSyncedAt: new Date(),
			})
			await JinaEmbeddingsTokenAccount.save(draftAccount.degradeForFireStore(), undefined, { merge: true })
			this.user = draftAccount
			this.uid = this.user?.user_id
			return draftAccount
		} catch (err) {
			authDtoLogger.warn(`Failed to get user brief: ${err}`, { err: marshalErrorLike(err) })
			if (err?.status === 401) {
				throw new AuthenticationFailedError({
					message: "Invalid API key, please get a new one from https://jina.ai",
				})
			}
			if (account) {
				this.user = account
				this.uid = this.user?.user_id
				return account
			}
			throw new DownstreamServiceFailureError(`Failed to authenticate: ${err}`)
		}
	}
	async reportUsage(tokenCount, mdl, endpoint = "/encode") {
		const user = await this.assertUser()
		const uid = user.user_id
		user.wallet.total_balance -= tokenCount
		return this.jinaEmbeddingsDashboard
			.reportUsage(this.bearerToken, {
				model_name: mdl,
				api_endpoint: endpoint,
				consumer: {
					id: uid,
					user_id: uid,
				},
				usage: {
					total_tokens: tokenCount,
				},
				labels: {
					model_name: mdl,
				},
			})
			.then((r) => {
				JinaEmbeddingsTokenAccount.COLLECTION.doc(this.bearerToken)
					.update({ "wallet.total_balance": JinaEmbeddingsTokenAccount.OPS.increment(-tokenCount) })
					.catch((err) => {
						authDtoLogger.warn(`Failed to update cache for ${uid}: ${err}`, { err: marshalErrorLike(err) })
					})
				return r
			})
			.catch((err) => {
				user.wallet.total_balance += tokenCount
				authDtoLogger.warn(`Failed to report usage for ${uid}: ${err}`, { err: marshalErrorLike(err) })
			})
	}
	async solveUID() {
		if (this.uid) {
			this.ctxMgr.set("uid", this.uid)
			return this.uid
		}
		if (this.bearerToken) {
			await this.getBrief()
			this.ctxMgr.set("uid", this.uid)
			return this.uid
		}
		return undefined
	}
	async assertUID() {
		const uid = await this.solveUID()
		if (!uid) {
			throw new AuthenticationRequiredError("Authentication failed")
		}
		return uid
	}
	async assertUser() {
		if (this.user) {
			return this.user
		}
		await this.getBrief()
		return this.user
	}
	getRateLimits(...tags) {
		const descs = tags
			.map((x) => this.user?.customRateLimits?.[x] || [])
			.flat()
			.filter((x) => x.isEffective())
		if (descs.length) {
			return descs
		}
		return undefined
	}
}
__decorate([InjectProperty(AsyncLocalContext)], JinaEmbeddingsAuthDTO.prototype, "ctxMgr", void 0)
JinaEmbeddingsAuthDTO = __decorate(
	[
		Also({
			openapi: {
				operation: {
					parameters: {
						Authorization: {
							description:
								htmlEscape`Jina Token for authentication.\n\n` +
								htmlEscape`- Member of <JinaEmbeddingsAuthDTO>\n\n` +
								`- Authorization: Bearer {YOUR_JINA_TOKEN}`,
							in: "header",
							schema: {
								anyOf: [{ type: "string", format: "token" }],
							},
						},
					},
				},
			},
		}),
	],
	JinaEmbeddingsAuthDTO,
)
export { JinaEmbeddingsAuthDTO }
//# sourceMappingURL=jina-embeddings-auth.js.map
