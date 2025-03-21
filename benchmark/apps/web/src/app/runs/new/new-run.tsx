"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X, Loader2, Rocket } from "lucide-react"

import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import {
	Button,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
} from "@/components/ui"

import { createRun } from "./actions"

const formSchema = z.object({
	model: z.string(),
	description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function NewRun() {
	const router = useRouter()
	const { data: models, isLoading, isError } = useOpenRouterModels()
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			model: "anthropic/claude-3.7-sonnet",
			description: "",
		},
	})

	async function onSubmit(data: FormValues) {
		setIsSubmitting(true)

		try {
			const run = await createRun(data)
			router.push(`/runs/${run.id}`)
		} catch (error) {
			console.error("Error creating run:", error)
			setIsSubmitting(false)
		}
	}

	return (
		<>
			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="flex flex-col justify-center gap-6 h-dvh max-w-xl mx-auto">
					<div>__dirname: {__dirname}</div>
					<FormField
						control={form.control}
						name="model"
						render={({ field }) => (
							<FormItem>
								<FormLabel>OpenRouter Model</FormLabel>
								<Select onValueChange={field.onChange} defaultValue={field.value}>
									<FormControl>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select" />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										{isLoading ? (
											<Loader2 className="size-4 m-2 animate-spin" />
										) : isError ? (
											<div className="m-2 text-center text-destructive">
												Failed to load models.
											</div>
										) : (
											models?.map((model) => (
												<SelectItem key={model.id} value={model.id}>
													{model.name}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea placeholder="Optional" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button type="submit" disabled={isSubmitting}>
						<Rocket className="size-4" />
						Launch Benchmark Run
					</Button>
				</form>
			</FormProvider>
			<Button
				variant="default"
				className="absolute top-5 right-5 size-12 rounded-full"
				onClick={() => router.push("/")}>
				<X className="size-6" />
			</Button>
		</>
	)
}
