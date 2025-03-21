import { findRun, getTasks, getPendingTasks } from "@benchmark/db"

import { ShowRun } from "./show-run"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const run = await findRun(Number(id))
	const tasks = await getTasks(run.id)
	const pendingTasks = await getPendingTasks(run.id)

	if (!run) {
		return <div>Run not found</div>
	}

	return <ShowRun run={{ ...run, tasks, pendingTasks }} />
}
