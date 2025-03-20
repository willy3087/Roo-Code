"use client"

import { useCallback } from "react"

import { Run } from "@benchmark/db"

import { useEventSource } from "@/hooks/use-event-source"

export function ShowRun({ run }: { run: Run }) {
	const url = `/api/runs/${run.id}/stream`
	const onMessage = useCallback(({ data }: MessageEvent) => console.log(data), [])
	const status = useEventSource({ url, onMessage })
	return (
		<div>
			Show Run: {run.id} | {status}
		</div>
	)
}
