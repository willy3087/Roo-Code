import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { useEventSource } from "@/hooks/use-event-source"

import { Run } from "@benchmark/db"

import { getTasks } from "./actions"
import { messageSchema, taskEventSchema } from "./schemas"

export const useRunStatus = (run: Run) => {
	const [clientId, setClientId] = useState<string>()
	const [runningTaskId, setRunningTaskId] = useState<number>()

	const { data: tasks } = useQuery({
		queryKey: ["run", run.id, runningTaskId],
		queryFn: async () => getTasks(run.id),
		placeholderData: keepPreviousData,
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

		const result = messageSchema.safeParse(data)

		if (!result.success) {
			console.log(`unrecognized messageEvent.data: ${messageEvent.data}`)
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
				setRunningTaskId(taskEvent.data.task.id)
			} else if (taskEvent.data.event === "message") {
				// console.log(`message: ${taskEvent.data.message.message.text}`)
			} else if (taskEvent.data.event === "taskTokenUsageUpdated") {
				console.log(`taskTokenUsageUpdated`, taskEvent.data.usage)
			} else if (taskEvent.data.event === "taskStarted") {
				setRunningTaskId(taskEvent.data.task.id)
			} else if (taskEvent.data.event === "taskFinished") {
				setRunningTaskId(undefined)
			}
		}
	}, [])

	const status = useEventSource({ url, onMessage })

	return { tasks, status, clientId, runningTaskId }
}
