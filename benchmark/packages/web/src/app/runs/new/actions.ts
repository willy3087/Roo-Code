"use server"

import { revalidatePath } from "next/cache"

import * as db from "@benchmark/db"

export async function createRun(data: db.InsertRun) {
	const run = await db.createRun(data)
	revalidatePath("/runs")
	return run
}
