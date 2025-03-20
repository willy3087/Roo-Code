import { and, eq } from "drizzle-orm"

import { db } from "../db.js"
import { type InsertTask, insertTaskSchema, tasks } from "../schema.js"

import { type Language } from "../enums.js"
import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"

export const findTask = async (id: number) => {
	const run = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createTask = async (args: InsertTask) => {
	const result = await db
		.insert(tasks)
		.values({
			...insertTaskSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	const task = result[0]

	if (!task) {
		throw new RecordNotCreatedError()
	}

	return task
}

export const getTask = async ({ runId, language, exercise }: { runId: number; language: Language; exercise: string }) =>
	db.query.tasks.findFirst({
		where: and(eq(tasks.runId, runId), eq(tasks.language, language), eq(tasks.exercise, exercise)),
	})
