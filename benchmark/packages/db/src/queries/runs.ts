import { desc, eq, sql } from "drizzle-orm"

import { db } from "../db"
import { InsertRun, insertRunSchema, runs, tasks } from "../schema"

import { RecordNotFoundError } from "./errors"

export const findRun = async (id: number) => {
	const run = await db.query.runs.findFirst({ where: eq(runs.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createRun = async (args: InsertRun) => {
	const result = await db
		.insert(runs)
		.values({
			...insertRunSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	return result[0]
}

export const getRuns = () =>
	db
		.select({
			id: runs.id,
			model: runs.model,
			description: runs.description,
			createdAt: runs.createdAt,
			passed: sql<number>`sum(${tasks.passed})`,
			failed: sql<number>`sum(${tasks.passed} = 0)`,
			total: sql<number>`count(${tasks.id})`,
			rate: sql<number>`sum(${tasks.passed}) * 1.0 / count(${tasks.id})`,
			cost: sql<number>`sum(${tasks.cost})`,
			duration: sql<number>`sum(${tasks.duration})`,
		})
		.from(runs)
		.leftJoin(tasks, eq(runs.id, tasks.runId))
		.orderBy(desc(runs.id))
