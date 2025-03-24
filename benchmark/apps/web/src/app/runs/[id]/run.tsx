"use client"

import { useState, useRef, useEffect } from "react"
import { LoaderCircle, RectangleEllipsis } from "lucide-react"

import * as db from "@benchmark/db"

import { useRunStatus } from "@/hooks/use-run-status"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, ScrollArea } from "@/components/ui"

import { TaskStatus } from "./task-status"
import { ConnectionStatus } from "./connection-status"

export function Run({ run }: { run: db.Run }) {
	const { tasks, status, clientId, runningTaskId, output, outputCounts } = useRunStatus(run)
	const scrollAreaRef = useRef<HTMLDivElement>(null)
	const [selectedTask, setSelectedTask] = useState<db.Task>()

	useEffect(() => {
		if (selectedTask) {
			const scrollArea = scrollAreaRef.current

			if (scrollArea) {
				scrollArea.scrollTo({
					top: scrollArea.scrollHeight,
					behavior: "smooth",
				})
			}
		}
	}, [selectedTask, outputCounts])

	return (
		<>
			<div className="flex flex-col gap-2">
				<div className="border-b mb-2 pb-2">
					<div>Run #{run.id}</div>
					<div>{run.model}</div>
					{run.description && <div className="text-sm text-muted-foreground">{run.description}</div>}
				</div>
				{!tasks ? (
					<LoaderCircle className="size-4 animate-spin" />
				) : (
					tasks.map((task) => (
						<div key={task.id} className="flex items-center gap-2">
							<TaskStatus task={task} runningTaskId={runningTaskId} />
							<div>
								{task.language}/{task.exercise}
							</div>
							{(outputCounts[task.id] ?? 0) > 0 && (
								<div
									className="flex items-center gap-1 cursor-pointer"
									onClick={() => setSelectedTask(task)}>
									<RectangleEllipsis className="size-4" />
									<div className="text-xs">({outputCounts[task.id]})</div>
								</div>
							)}
						</div>
					))
				)}
			</div>
			<div className="absolute top-5 right-5">
				<ConnectionStatus status={status} clientId={clientId} pid={run.pid} />
			</div>
			<Drawer open={!!selectedTask} onOpenChange={() => setSelectedTask(undefined)}>
				<DrawerContent>
					<div className="mx-auto w-full max-w-2xl">
						<DrawerHeader>
							<DrawerTitle>
								{selectedTask?.language}/{selectedTask?.exercise}
							</DrawerTitle>
						</DrawerHeader>
						<div className="font-mono text-xs pb-12">
							{selectedTask && (
								<ScrollArea viewportRef={scrollAreaRef} className="h-96 rounded-sm border">
									<div className="p-4">
										<h4 className="mb-4 text-sm font-medium leading-none">Tags</h4>
										{output.get(selectedTask.id)?.map((line, i) => <div key={i}>{line}</div>)}
									</div>
								</ScrollArea>
							)}
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	)
}
