import {
    Also, AuthenticationFailedError, AuthenticationRequiredError,
    DownstreamServiceFailureError, RPC_CALL_ENVIRONMENT,
    ArrayOf, AutoCastable, Prop
} from 'civkit/civ-rpc';
import { parseJSONText } from 'civkit/vectorize';
import { htmlEscape } from 'civkit/escape';
import { marshalErrorLike } from 'civkit/lang';

import type express from 'express';

import logger from '../lib/logger';
import { AsyncLocalContext } from '../lib/async-context';
import { InjectProperty } from '../lib/registry';
import { JinaEmbeddingsDashboardHTTP } from '../lib/billing';
import envConfig from '../lib/env-config';

import { FirestoreRecord } from '../lib/firestore';
import _ from 'lodash';
import { RateLimitDesc } from '../rate-limit';

export class JinaWallet extends AutoCastable {
    @Prop({
        default: ''
    })
    user_id!: string;

    @Prop({
        default: 0
    })
    trial_balance!: number;

    @Prop()
    trial_start?: Date;

    @Prop()
    trial_end?: Date;

    @Prop({
        default: 0
    })
    regular_balance!: number;

    @Prop({
        default: 0
    })
    total_balance!: number;
}

export class JinaEmbeddingsTokenAccount extends FirestoreRecord {
    static override collectionName = 'embeddingsTokenAccounts';

    override _id: string = "";

    @Prop({
        required: true
    })
    user_id!: string;

    @Prop({
        nullable: true,
        type: String,
    })
    email?: string;

    @Prop({
        nullable: true,
        type: String,
    })
    full_name?: string;

    @Prop({
        nullable: true,
        type: String,
    })
    customer_id?: string;

    @Prop({
        nullable: true,
        type: String,
    })
    avatar_url?: string;

    // Not keeping sensitive info for now
    // @Prop()
    // billing_address?: object;

    // @Prop()
    // payment_method?: object;

    @Prop({
        required: true
    })
    wallet!: JinaWallet;

    @Prop({
        type: Object
    })
    metadata?: { [k: string]: any; };

    @Prop({
        defaultFactory: () => new Date()
    })
    lastSyncedAt!: Date;

    @Prop({
        dictOf: [ArrayOf(RateLimitDesc)]
    })
    customRateLimits?: { [k: string]: RateLimitDesc[]; };

    static patchedFields = [
    ];

    static override from(input: any) {
        for (const field of this.patchedFields) {
            if (typeof input[field] === 'string') {
                input[field] = parseJSONText(input[field]);
            }
        }

        return super.from(input) as JinaEmbeddingsTokenAccount;
    }

    override degradeForFireStore() {
        const copy: any = {
            ...this,
            wallet: { ...this.wallet },
            // Firebase disability
            customRateLimits: _.mapValues(this.customRateLimits, (v) => v.map((x) => ({ ...x }))),
        };

        for (const field of (this.constructor as typeof JinaEmbeddingsTokenAccount).patchedFields) {
            if (typeof copy[field] === 'object') {
                copy[field] = JSON.stringify(copy[field]) as any;
            }
        }

        return copy;
    }

    [k: string]: any;
}


const authDtoLogger = logger.child({ service: 'JinaAuthDTO' });

export interface FireBaseHTTPCtx {
    req: express.Request,
    res: express.Response,
}

const THE_VERY_SAME_JINA_EMBEDDINGS_CLIENT = new JinaEmbeddingsDashboardHTTP(envConfig.JINA_EMBEDDINGS_DASHBOARD_API_KEY);

@Also({
    openapi: {
        operation: {
            parameters: {
                'Authorization': {
                    description: htmlEscape`Jina Token for authentication.\n\n` +
                        htmlEscape`- Member of <JinaEmbeddingsAuthDTO>\n\n` +
                        `- Authorization: Bearer {YOUR_JINA_TOKEN}`
                    ,
                    in: 'header',
                    schema: {
                        anyOf: [
                            { type: 'string', format: 'token' }
                        ]
                    }
                }
            }
        }
    }
})
export class JinaEmbeddingsAuthDTO extends AutoCastable {
    uid?: string;
    bearerToken?: string;
    user?: JinaEmbeddingsTokenAccount;

    @InjectProperty(AsyncLocalContext)
    ctxMgr!: AsyncLocalContext;

    jinaEmbeddingsDashboard = THE_VERY_SAME_JINA_EMBEDDINGS_CLIENT;

    static override from(input: any) {
        const instance = super.from(input) as JinaEmbeddingsAuthDTO;

        const ctx = input[RPC_CALL_ENVIRONMENT];

        const req = (ctx.rawRequest || ctx.req) as express.Request | undefined;

        if (req) {
            const authorization = req.get('authorization');

            if (authorization) {
                const authToken = authorization.split(' ')[1] || authorization;
                instance.bearerToken = authToken;
            }

        }

        if (!instance.bearerToken && input._token) {
            instance.bearerToken = input._token;
        }

        return instance;
    }

    async getBrief(ignoreCache?: boolean | string) {
        if (!this.bearerToken) {
            throw new AuthenticationRequiredError({
                message: 'Jina API key is required to authenticate. Please get one from https://jina.ai'
            });
        }

        let account;
        try {
            account = await JinaEmbeddingsTokenAccount.fromFirestore(this.bearerToken);
        } catch (err) {
            // FireStore would not accept any string as input and may throw if not happy with it
            void 0;
        }


        const age = account?.lastSyncedAt ? Date.now() - account.lastSyncedAt.getTime() : Infinity;

        if (account && !ignoreCache) {
            if (account && age < 180_000) {
                this.user = account;
                this.uid = this.user?.user_id;

                return account;
            }
        }

        try {
            const r = await this.jinaEmbeddingsDashboard.validateToken(this.bearerToken);
            const brief = r.data;
            const draftAccount = JinaEmbeddingsTokenAccount.from({
                ...account, ...brief, _id: this.bearerToken,
                lastSyncedAt: new Date()
            });
            await JinaEmbeddingsTokenAccount.save(draftAccount.degradeForFireStore(), undefined, { merge: true });

            this.user = draftAccount;
            this.uid = this.user?.user_id;

            return draftAccount;
        } catch (err: any) {
            authDtoLogger.warn(`Failed to get user brief: ${err}`, { err: marshalErrorLike(err) });

            if (err?.status === 401) {
                throw new AuthenticationFailedError({
                    message: 'Invalid API key, please get a new one from https://jina.ai'
                });
            }

            if (account) {
                this.user = account;
                this.uid = this.user?.user_id;

                return account;
            }


            throw new DownstreamServiceFailureError(`Failed to authenticate: ${err}`);
        }
    }

    async reportUsage(tokenCount: number, mdl: string, endpoint: string = '/encode') {
        const user = await this.assertUser();
        const uid = user.user_id;
        user.wallet.total_balance -= tokenCount;

        return this.jinaEmbeddingsDashboard.reportUsage(this.bearerToken!, {
            model_name: mdl,
            api_endpoint: endpoint,
            consumer: {
                id: uid,
                user_id: uid,
            },
            usage: {
                total_tokens: tokenCount
            },
            labels: {
                model_name: mdl
            }
        }).then((r) => {
            JinaEmbeddingsTokenAccount.COLLECTION.doc(this.bearerToken!)
                .update({ 'wallet.total_balance': JinaEmbeddingsTokenAccount.OPS.increment(-tokenCount) })
                .catch((err) => {
                    authDtoLogger.warn(`Failed to update cache for ${uid}: ${err}`, { err: marshalErrorLike(err) });
                });

            return r;
        }).catch((err) => {
            user.wallet.total_balance += tokenCount;
            authDtoLogger.warn(`Failed to report usage for ${uid}: ${err}`, { err: marshalErrorLike(err) });
        });
    }

    async solveUID() {
        if (this.uid) {
            this.ctxMgr.set('uid', this.uid);

            return this.uid;
        }

        if (this.bearerToken) {
            await this.getBrief();
            this.ctxMgr.set('uid', this.uid);

            return this.uid;
        }

        return undefined;
    }

    async assertUID() {
        const uid = await this.solveUID();

        if (!uid) {
            throw new AuthenticationRequiredError('Authentication failed');
        }

        return uid;
    }

    async assertUser() {
        if (this.user) {
            return this.user;
        }

        await this.getBrief();

        return this.user!;
    }

    getRateLimits(...tags: string[]) {
        const descs = tags.map((x) => this.user?.customRateLimits?.[x] || []).flat().filter((x) => x.isEffective());

        if (descs.length) {
            return descs;
        }

        return undefined;
    }
}
