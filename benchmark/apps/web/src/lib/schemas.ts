import { z } from "zod"

/**
 * CreateRun
 */

export const createRunSchema = z
	.object({
		model: z.string().min(1, { message: "Model is required." }),
		description: z.string().optional(),
		suite: z.enum(["full", "partial"]),
		exercises: z.array(z.string()).optional(),
	})
	.refine((data) => data.suite === "full" || (data.exercises || []).length > 0, {
		message: "Exercises are required when running a partial suite.",
		path: ["exercises"],
	})

export type CreateRun = z.infer<typeof createRunSchema>

/**
 * TaskEvent
 */

export const taskEventSchema = z.discriminatedUnion("eventName", [
	z.object({
		eventName: z.literal("connect"),
		data: z.object({ task: z.object({ id: z.number() }) }),
	}),
	z.object({
		eventName: z.literal("taskStarted"),
		data: z.object({ task: z.object({ id: z.number() }) }),
	}),
	z.object({
		eventName: z.literal("message"),
		data: z.object({
			task: z.object({ id: z.number() }),
			message: z.object({
				taskId: z.string(),
				action: z.enum(["created", "updated"]),
				message: z.object({
					ask: z.string().optional(),
					say: z.string().optional(),
					partial: z.boolean(),
					text: z.string(),
				}),
			}),
		}),
	}),
	z.object({
		eventName: z.literal("taskTokenUsageUpdated"),
		data: z.object({
			task: z.object({ id: z.number() }),
			usage: z.object({}),
		}),
	}),
	z.object({
		eventName: z.literal("taskFinished"),
		data: z.object({ task: z.object({ id: z.number() }) }),
	}),
])

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
		data: taskEventSchema,
	}),
])

export type IpcServerMessage = z.infer<typeof ipcServerMessageSchema>
