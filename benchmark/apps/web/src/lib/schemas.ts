import { z } from "zod"

/**
 * CreateRun
 */

export const createRunSchema = z
	.object({
		model: z.string().min(1),
		description: z.string().optional(),
		suite: z.enum(["full", "partial"]),
		exercises: z.array(z.string()).optional(),
	})
	.refine((data) => data.suite === "full" || (data.exercises || []).length > 0, {
		message: "Exercises are required for partial suite.",
	})

export type CreateRun = z.infer<typeof createRunSchema>

/**
 * IpcServerMessage
 */

export const ipcServerMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("Ack"),
		data: z.object({ clientId: z.string() }),
	}),
	z.object({
		type: z.literal("TaskEvent"),
		data: z.object({
			eventName: z.enum(["connect", "taskStarted", "message", "taskTokenUsageUpdated", "taskFinished"]),
			data: z.object({
				task: z.object({ id: z.number() }),
				// message: z.object({}).optional(),
				// usage: z.object({}).optional(),
				// taskMetrics: z.object({}).optional(),
			}),
		}),
	}),
])

export type IpcServerMessage = z.infer<typeof ipcServerMessageSchema>
