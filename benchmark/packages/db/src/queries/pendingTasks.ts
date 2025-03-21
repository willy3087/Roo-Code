import { and, eq } from "drizzle-orm"

import type { Language } from "../enums.js"
import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import type { InsertPendingTask, UpdatePendingTask } from "../schema.js"
import { insertPendingTaskSchema, pendingTasks } from "../schema.js"
import { db } from "../db.js"

const table = pendingTasks

export const findPendingTask = async (id: number) => {
	const run = await db.query.pendingTasks.findFirst({ where: eq(table.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createPendingTask = async (args: InsertPendingTask) => {
	const records = await db
		.insert(table)
		.values({
			...insertPendingTaskSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updatePendingTask = async (id: number, values: UpdatePendingTask) => {
	const records = await db.update(table).set(values).where(eq(table.id, id)).returning()
	const record = records[0]

	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

type GetPendingTask = {
	runId: number
	language: Language
	exercise: string
}

export const getPendingTask = async ({ runId, language, exercise }: GetPendingTask) =>
	db.query.pendingTasks.findFirst({
		where: and(eq(table.runId, runId), eq(table.language, language), eq(table.exercise, exercise)),
	})

export const getPendingTasks = async (runId: number) =>
	db.query.pendingTasks.findMany({ where: eq(table.runId, runId) })
