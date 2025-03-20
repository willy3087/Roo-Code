import { drizzle } from "drizzle-orm/libsql"

export * from "./schema"

export const db = drizzle({ connection: { url: process.env.BENCHMARKS_DB_PATH! } })
