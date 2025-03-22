import { z } from "zod"

export const messageSchema = z.object({
	type: z.enum(["hello", "data"]),
	data: z.record(z.string(), z.unknown()),
})

export const taskSchema = z.object({
	id: z.number(),
})

export const taskEventSchema = z.discriminatedUnion("event", [
	z.object({ event: z.literal("client"), task: taskSchema }),
	z.object({ event: z.literal("taskStarted"), task: taskSchema }),
	z.object({ event: z.literal("taskFinished"), task: taskSchema }),
	z.object({
		event: z.literal("message"),
		task: taskSchema,
		message: z.object({
			taskId: z.string(),
			action: z.enum(["created", "updated"]),
			message: z.object({
				ts: z.number(),
				type: z.enum(["ask", "say"]),
				text: z.string(),
				partial: z.boolean().optional(),
			}),
		}),
	}),
	z.object({
		event: z.literal("taskTokenUsageUpdated"),
		task: taskSchema,
		usage: z.object({
			totalTokensIn: z.number(),
			totalTokensOut: z.number(),
			totalCacheWrites: z.number().optional(),
			totalCacheReads: z.number().optional(),
			totalCost: z.number(),
			contextTokens: z.number(),
		}),
	}),
])
