import { and, eq } from "drizzle-orm"

import { db } from "../db"
import { InsertTask, insertTaskSchema, tasks } from "../schema"

import { RecordNotFoundError } from "./errors"
import { Language } from "../enums"

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

	return result[0]
}

export const getTask = async ({ runId, language, exercise }: { runId: number; language: Language; exercise: string }) =>
	db.query.tasks.findFirst({
		where: and(eq(tasks.runId, runId), eq(tasks.language, language), eq(tasks.exercise, exercise)),
	})
