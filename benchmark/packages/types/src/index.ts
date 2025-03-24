import { z } from "zod"

/**
 * Language
 */

export const languages = ["cpp", "go", "java", "javascript", "python", "rust"] as const

export type Language = (typeof languages)[number]

export const isLanguage = (value: string): value is Language => languages.includes(value as Language)

/**
 * TaskEvent
 */

export enum TaskEventName {
	Connect = "Connect",
	TaskStarted = "TaskStarted",
	Message = "Message",
	TaskTokenUsageUpdated = "TaskTokenUsageUpdated",
	TaskFinished = "TaskFinished",
}

export const taskEventSchema = z.object({
	eventName: z.nativeEnum(TaskEventName),
	data: z.unknown(),
})

export type TaskEvent = z.infer<typeof taskEventSchema>

/**
 * TaskCommand
 */

export enum TaskCommandName {
	StartNewTask = "StartNewTask",
}

export const taskCommandSchema = z.discriminatedUnion("commandName", [
	z.object({
		commandName: z.literal(TaskCommandName.StartNewTask),
		data: z.object({
			text: z.string(),
			images: z.array(z.string()).optional(),
		}),
	}),
])

export type TaskCommand = z.infer<typeof taskCommandSchema>
