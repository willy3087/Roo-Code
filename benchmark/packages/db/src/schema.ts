import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core"
import * as t from "drizzle-orm/sqlite-core"
import { createInsertSchema } from "drizzle-zod"
import { z } from "zod"

import { languages } from "./enums"

/**
 * runs
 */

export const runs = sqliteTable("runs", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	model: text().notNull(),
	description: text(),
	createdAt: integer({ mode: "timestamp" }).notNull(),
})

export type Run = typeof runs.$inferSelect

export const insertRunSchema = createInsertSchema(runs).omit({
	id: true,
	createdAt: true,
})

export type InsertRun = z.infer<typeof insertRunSchema>

/**
 * tasks
 */

export const tasks = sqliteTable(
	"tasks",
	{
		id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
		runId: integer({ mode: "number" }).notNull(),
		language: text({ enum: languages }).notNull(),
		exercise: text().notNull(),
		tokensIn: integer({ mode: "number" }).notNull(),
		tokensOut: integer({ mode: "number" }).notNull(),
		tokensContext: integer({ mode: "number" }).notNull(),
		cacheWrites: integer({ mode: "number" }).notNull(),
		cacheReads: integer({ mode: "number" }).notNull(),
		cost: real().notNull(),
		duration: integer({ mode: "number" }).notNull(),
		passed: integer({ mode: "boolean" }).notNull(),
		createdAt: integer({ mode: "timestamp" }).notNull(),
	},
	(table) => [t.uniqueIndex("language_exercise_idx").on(table.runId, table.language, table.exercise)],
)

export type Task = typeof tasks.$inferSelect

export const insertTaskSchema = createInsertSchema(tasks).omit({
	id: true,
	createdAt: true,
})

export type InsertTask = z.infer<typeof insertTaskSchema>

/**
 * schema
 */

export const schema = { runs, tasks }
