"use client"

import { useRouter } from "next/navigation"
import { Rocket } from "lucide-react"

import { getRuns } from "@benchmark/db"

import { formatCurrency, formatDuration } from "@/lib"
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"

type Run = Awaited<ReturnType<typeof getRuns>>[number]

export function Home({ runs }: { runs: Run[] }) {
	const router = useRouter()

	return (
		<>
			<Table className="border">
				<TableHeader>
					<TableRow>
						<TableHead>ID</TableHead>
						<TableHead>Model</TableHead>
						<TableHead>Timestamp</TableHead>
						<TableHead>Passed</TableHead>
						<TableHead>Failed</TableHead>
						<TableHead>% Correct</TableHead>
						<TableHead>Cost</TableHead>
						<TableHead>Duration</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{runs.map((run) => (
						<TableRow key={run.id}>
							<TableCell>{run.id}</TableCell>
							<TableCell>{run.model}</TableCell>
							<TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
							<TableCell>{run.passed}</TableCell>
							<TableCell>{run.failed}</TableCell>
							<TableCell>{(run.rate * 100).toFixed(1)}%</TableCell>
							<TableCell>{formatCurrency(run.cost)}</TableCell>
							<TableCell>{formatDuration(run.duration)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/runs/new")}>
				<Rocket className="size-6" />
			</Button>
		</>
	)
}
