"use server"

import { spawn } from "child_process"
import { revalidatePath } from "next/cache"

import * as db from "@benchmark/db"

export async function createRun(data: db.InsertRun) {
	const run = await db.createRun(data)
	revalidatePath("/runs")

	try {
		const process = spawn(
			"pnpm",
			["--filter", "@benchmark/cli", "dev", "run", "all", "--runId", run.id.toString()],
			{
				detached: true,
				stdio: "ignore",
			},
		)

		process.unref()
		return process.pid
	} catch (_) {
		return undefined
	}
}
