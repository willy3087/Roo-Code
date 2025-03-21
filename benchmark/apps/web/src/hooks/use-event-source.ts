import { useCallback, useEffect, useRef, useState } from "react"

export type EventSourceStatus = "init" | "open" | "error"

export type EventSourceEvent = Event & { data: string }

type UseEventSourceOptions = {
	url: string
	withCredentials?: boolean
	onMessage: (event: MessageEvent) => void
}

export function useEventSource({ url, withCredentials, onMessage }: UseEventSourceOptions) {
	const sourceRef = useRef<EventSource | null>(null)
	const statusRef = useRef<EventSourceStatus>("init")
	const [status, setStatus] = useState<EventSourceStatus>("init")
	const handleMessage = useCallback((event: MessageEvent) => onMessage(event), [onMessage])

	const createEventSource = useCallback(() => {
		sourceRef.current = new EventSource(url, { withCredentials })

		sourceRef.current.onopen = () => {
			statusRef.current = "open"
			setStatus("open")
		}

		sourceRef.current.onmessage = (event) => {
			handleMessage(event)
		}

		sourceRef.current.onerror = () => {
			statusRef.current = "error"
			setStatus("error")
			// sourceRef.current?.close()
			// sourceRef.current = null
		}
	}, [url, withCredentials, handleMessage])

	useEffect(() => {
		createEventSource()

		setTimeout(() => {
			if (statusRef.current === "init") {
				sourceRef.current?.close()
				sourceRef.current = null
				createEventSource()
			}
		}, 100)

		return () => {
			sourceRef.current?.close()
			sourceRef.current = null
		}
	}, [createEventSource])

	return status
}
