import { desc, eq, sql } from "drizzle-orm"

import { RecordNotFoundError, RecordNotCreatedError } from "./errors.js"
import type { InsertRun, UpdateRun } from "../schema.js"
import { insertRunSchema, runs, tasks } from "../schema.js"
import { db } from "../db.js"

const table = runs

export const findRun = async (id: number) => {
	const run = await db.query.runs.findFirst({ where: eq(table.id, id) })

	if (!run) {
		throw new RecordNotFoundError()
	}

	return run
}

export const createRun = async (args: InsertRun) => {
	const records = await db
		.insert(table)
		.values({
			...insertRunSchema.parse(args),
			createdAt: new Date(),
		})
		.returning()

	const record = records[0]

	if (!record) {
		throw new RecordNotCreatedError()
	}

	return record
}

export const updateRun = async (id: number, values: UpdateRun) => {
	const records = await db.update(table).set(values).where(eq(table.id, id)).returning()
	const record = records[0]

	if (!record) {
		throw new RecordNotFoundError()
	}

	return record
}

export const getRuns = () =>
	db
		.select({
			id: table.id,
			model: table.model,
			description: table.description,
			createdAt: table.createdAt,
			passed: sql<number>`sum(${tasks.passed})`,
			failed: sql<number>`sum(${tasks.passed} = 0)`,
			total: sql<number>`count(${tasks.id})`,
			rate: sql<number>`sum(${tasks.passed}) * 1.0 / count(${tasks.id})`,
			cost: sql<number>`sum(${tasks.cost})`,
			duration: sql<number>`sum(${tasks.duration})`,
		})
		.from(table)
		.leftJoin(tasks, eq(table.id, tasks.runId))
		.orderBy(desc(table.id))
