import { useState, useCallback, useRef } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"

import { Run } from "@benchmark/db"

import { getTasks } from "@/lib/server/tasks"
import { ipcServerMessageSchema } from "@/lib/schemas"
import { useEventSource } from "@/hooks/use-event-source"

export const useRunStatus = (run: Run) => {
	const [clientId, setClientId] = useState<string>()
	const [runningTaskId, setRunningTaskId] = useState<number>()
	const outputRef = useRef<Map<number, string[]>>(new Map())
	const [outputCounts, setOutputCounts] = useState<Record<number, number>>({})

	const { data: tasks } = useQuery({
		queryKey: ["run", run.id, runningTaskId],
		queryFn: async () => getTasks(run.id),
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
	})

	const url = `/api/runs/${run.id}/stream`

	const onMessage = useCallback((messageEvent: MessageEvent) => {
		let data

		try {
			data = JSON.parse(messageEvent.data)
		} catch (_) {
			console.log(`invalid JSON: ${messageEvent.data}`)
			return
		}

		const result = ipcServerMessageSchema.safeParse(data)

		if (!result.success) {
			console.log(`unrecognized messageEvent.data: ${messageEvent.data}`)
			return
		}

		const payload = result.data

		if (payload.type === "Ack") {
			setClientId(payload.data.clientId as string)
		} else if (payload.type === "TaskEvent") {
			const taskId = payload.data.data.task.id

			if (payload.data.eventName === "connect" || payload.data.eventName === "taskStarted") {
				setRunningTaskId(taskId)
			} else if (payload.data.eventName === "taskFinished") {
				setRunningTaskId(undefined)
			} else if (payload.data.eventName === "message") {
				const { text } = payload.data.data.message.message
				console.log(`message: ${taskId} ->`, text)
				outputRef.current.set(taskId, [...(outputRef.current.get(taskId) || []), text])
				const outputCounts: Record<number, number> = {}

				for (const [taskId, messages] of outputRef.current.entries()) {
					outputCounts[taskId] = messages.length
				}

				setOutputCounts(outputCounts)
			}
		}
	}, [])

	const status = useEventSource({ url, onMessage })

	return { tasks, status, clientId, runningTaskId, output: outputRef.current, outputCounts }
}
