"use client"

import { useCallback, useState } from "react"
import { z } from "zod"
import { CircleDashed, CircleCheck, CircleSlash, LoaderCircle, Dot } from "lucide-react"

import { type Run, type PendingTask, Task } from "@benchmark/db"

import { useEventSource } from "@/hooks/use-event-source"
import { cn } from "@/lib/utils"

const messageSchema = z.object({
	type: z.enum(["hello", "data"]),
	data: z.record(z.string(), z.unknown()),
})

const taskEventSchema = z.discriminatedUnion("event", [
	// {"event":"client","runId":4,"language":"cpp","exercise":"queen-attack","prompt":"Your job is to complete a coding exercise described by `.docs/instructions.md`...","workspacePath":"/Users/cte/Documents/exercises/cpp/queen-attack"}
	z.object({
		event: z.literal("client"),
		runId: z.number(),
		language: z.string(),
		exercise: z.string(),
		prompt: z.string(),
		workspacePath: z.string(),
	}),
	// {"event":"message","taskId":"acfdc39d-2c21-484b-9fb0-c6670b1a7439","action":"updated","message":{"ts":1742574782085,"type":"say","say":"text","text":"Great! All the tests have passed...","partial":true}}
	z.object({
		event: z.literal("message"),
		taskId: z.string(),
		action: z.enum(["created", "updated"]),
		message: z.object({
			ts: z.number(),
			type: z.enum(["ask", "say"]),
			text: z.string(),
			partial: z.boolean(),
		}),
	}),
	// {"event":"taskTokenUsageUpdated","taskId":"acfdc39d-2c21-484b-9fb0-c6670b1a7439","usage":{"totalTokensIn":102069,"totalTokensOut":1700,"totalCacheWrites":0,"totalCacheReads":0,"totalCost":0.1212111,"contextTokens":19286}}
	z.object({
		event: z.literal("taskTokenUsageUpdated"),
		taskId: z.string(),
		usage: z.object({
			totalTokensIn: z.number(),
			totalTokensOut: z.number(),
			totalCacheWrites: z.number(),
			totalCacheReads: z.number(),
			totalCost: z.number(),
			contextTokens: z.number(),
		}),
	}),
])

type CurrentRun = Run & { tasks: Task[]; pendingTasks: PendingTask[] }

export function ShowRun({ run }: { run: CurrentRun }) {
	const [clientId, setClientId] = useState<string>()
	const [runningTask, setRunningTask] = useState<string>()
	const url = `/api/runs/${run.id}/stream`

	const onMessage = useCallback((messageEvent: MessageEvent) => {
		// console.log(messageEvent.data)
		let data

		try {
			data = JSON.parse(messageEvent.data)
		} catch (_) {
			// console.log(`invalid JSON: ${messageEvent.data}`)
			return
		}

		const result = messageSchema.safeParse(data)

		if (!result.success) {
			// console.log(`unrecognized messageEvent.data: ${messageEvent.data}`)
			return
		}

		const payload = result.data

		if (payload.type === "hello") {
			setClientId(payload.data.clientId as string)
		} else if (payload.type === "data") {
			const taskEvent = taskEventSchema.safeParse(payload.data)

			if (!taskEvent.success) {
				console.log(`unrecognized payload.data`, payload.data, taskEvent.error)
				return
			}

			if (taskEvent.data.event === "client") {
				console.log(`client`, taskEvent.data)
				const { language, exercise } = taskEvent.data
				setRunningTask(`${language}/${exercise}`)
			} else if (taskEvent.data.event === "message") {
				console.log(`message: ${taskEvent.data.message.text}`)
			} else if (taskEvent.data.event === "taskTokenUsageUpdated") {
				console.log(`taskTokenUsageUpdated: ${taskEvent.data.usage}`)
			}
		}
	}, [])

	const status = useEventSource({ url, onMessage })

	const pendingTasks = run.pendingTasks.filter((pendingTask) => !run.tasks.find((task) => task.id === pendingTask.id))

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="border-b mb-2 pb-2">
					<div>Run #{run.id}</div>
					<div>{run.model}</div>
					{run.description && <div className="text-sm text-muted-foreground">{run.description}</div>}
				</div>
				{run.tasks.map((task) => (
					<div key={task.id} className="flex items-center gap-2">
						{task.passed ? (
							<CircleCheck className="size-4 text-green-500" />
						) : (
							<CircleSlash className="size-4 text-destructive" />
						)}
						<div>
							{task.language}/{task.exercise}
						</div>
					</div>
				))}
				{pendingTasks.map((task) => (
					<div key={task.id} className="flex items-center gap-2">
						{runningTask === `${task.language}/${task.exercise}` ? (
							<LoaderCircle className="size-4 animate-spin" />
						) : (
							<CircleDashed className="size-4" />
						)}
						<div>
							{task.language}/{task.exercise}
						</div>
					</div>
				))}
			</div>
			<div className="absolute top-5 right-5">
				<div className="flex items-center gap-2">
					<div className="animate-ping">
						<div
							className={cn("size-2 rounded-full", {
								"bg-green-500": status === "open",
								"bg-amber-300": status === "init",
								"bg-rose-500": status === "error",
							})}
						/>
					</div>
					<div className="font-mono text-xs">{clientId}</div>
				</div>
			</div>
		</>
	)
}
