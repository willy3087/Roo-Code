"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import {
	Button,
	FormControl,
	FormDescription,
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
	model: z.string({
		required_error: "Please select a model",
	}),
	description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function NewRun() {
	const router = useRouter()
	const { data: models, isLoading, error } = useOpenRouterModels()
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
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
		<div className="space-y-6 max-w-2xl mx-auto p-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold">Create New Run</h1>
				<p className="text-muted-foreground">
					Create a new run by selecting a model and providing an optional description.
				</p>
			</div>
			<div>
				<FormProvider {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="model"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Model</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a model" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{isLoading ? (
												<div className="p-2 text-center text-muted-foreground">
													Loading models...
												</div>
											) : error ? (
												<div className="p-2 text-center text-destructive">
													Error loading models. Using fallback options.
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
									<FormDescription>Select the model to use for this run.</FormDescription>
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
										<Textarea
											placeholder="Enter a description for this run (optional)"
											className="resize-none"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Provide an optional description to help identify this run.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Creating..." : "Create Run"}
						</Button>
					</form>
				</FormProvider>
			</div>
		</div>
	)
}
