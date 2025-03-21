import { and, eq } from "drizzle-orm"

import { db } from "../db.js"
import { type InsertPendingTask, insertPendingTaskSchema, pendingTasks } from "../schema.js"

import { Language } from "../enums.js"
import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"

export const findPendingTask = async (id: number) => {
	const run = await db.query.pendingTasks.findFirst({ where: eq(pendingTasks.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createPendingTask = async (args: InsertPendingTask) => {
	const result = await db
		.insert(pendingTasks)
		.values({
			...insertPendingTaskSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	const task = result[0]

	if (!task) {
		throw new RecordNotCreatedError()
	}

	return task
}

type GetPendingTask = {
	runId: number
	language: Language
	exercise: string
}

export const getPendingTask = async ({ runId, language, exercise }: GetPendingTask) =>
	db.query.pendingTasks.findFirst({
		where: and(
			eq(pendingTasks.runId, runId),
			eq(pendingTasks.language, language),
			eq(pendingTasks.exercise, exercise),
		),
	})
