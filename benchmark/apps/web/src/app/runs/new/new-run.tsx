"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import fuzzysort from "fuzzysort"
import { X, Rocket, Check, ChevronsUpDown } from "lucide-react"

import { createRun } from "@/lib/server/runs"
import { createRunSchema as formSchema, type CreateRun as FormValues } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { useOpenRouterModels } from "@/hooks/use-open-router-models"
import { useExercises } from "@/hooks/use-exercises"
import {
	Button,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Textarea,
	Tabs,
	TabsList,
	TabsTrigger,
	MultiSelect,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui"

export function NewRun() {
	const router = useRouter()

	const [modelSearchValue, setModelSearchValue] = useState("")
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
	const modelSearchResultsRef = useRef<Map<string, number>>(new Map())
	const modelSearchValueRef = useRef("")
	const models = useOpenRouterModels()

	const exercises = useExercises()

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			model: "",
			description: "",
			suite: "full",
			exercises: [],
		},
	})

	const {
		setValue,
		watch,
		formState: { isSubmitting },
	} = form

	const [model, suite] = watch(["model", "suite"])

	const selectModel = useCallback(
		(model: string) => {
			setValue("model", model)
			setModelPopoverOpen(false)
		},
		[setValue],
	)

	const onSubmit = useCallback(
		async (data: FormValues) => {
			try {
				const { id } = await createRun(data)
				router.push(`/runs/${id}`)
			} catch (_) {
				// Surface error.
			}
		},
		[router],
	)

	return (
		<>
			<FormProvider {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col justify-center gap-6">
					<FormField
						control={form.control}
						name="model"
						render={() => (
							<FormItem>
								<FormLabel>OpenRouter Model</FormLabel>
								<Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="input"
											role="combobox"
											aria-expanded={modelPopoverOpen}
											className="flex items-center justify-between">
											<div>
												{models.data?.find(({ id }) => id === model)?.name || model || "Select"}
											</div>
											<ChevronsUpDown className="opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
										<Command
											filter={(value, search) => {
												if (modelSearchValueRef.current !== search) {
													modelSearchValueRef.current = search
													modelSearchResultsRef.current.clear()

													for (const {
														obj: { id },
														score,
													} of fuzzysort.go(search, models.data || [], {
														key: "name",
													})) {
														modelSearchResultsRef.current.set(id, score)
													}
												}

												return modelSearchResultsRef.current.get(value) ?? 0
											}}>
											<CommandInput
												placeholder="Search"
												value={modelSearchValue}
												onValueChange={setModelSearchValue}
												className="h-9"
											/>
											<CommandList>
												<CommandEmpty>No model found.</CommandEmpty>
												<CommandGroup>
													{models.data?.map(({ id, name }) => (
														<CommandItem key={id} value={id} onSelect={selectModel}>
															{name}
															<Check
																className={cn(
																	"ml-auto text-accent group-data-[selected=true]:text-accent-foreground size-4",
																	id === model ? "opacity-100" : "opacity-0",
																)}
															/>
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="suite"
						render={() => (
							<FormItem>
								<FormLabel>Exercise Suite</FormLabel>
								<Tabs
									defaultValue="full"
									onValueChange={(value) => setValue("suite", value as "full" | "partial")}>
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="full">Full</TabsTrigger>
										<TabsTrigger value="partial">Partial</TabsTrigger>
									</TabsList>
								</Tabs>
							</FormItem>
						)}
					/>

					{suite === "partial" && (
						<FormField
							control={form.control}
							name="exercises"
							render={() => (
								<FormItem>
									<FormLabel>Exercises</FormLabel>
									<MultiSelect
										options={exercises.data?.map((path) => ({ value: path, label: path })) || []}
										onValueChange={(value) => setValue("exercises", value)}
										placeholder="Select"
										variant="inverted"
										maxCount={4}
									/>
									<FormMessage />
								</FormItem>
							)}
						/>
					)}

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
						Launch
					</Button>
				</form>
			</FormProvider>
			<Button
				variant="default"
				className="absolute top-4 right-12 size-12 rounded-full"
				onClick={() => router.push("/")}>
				<X className="size-6" />
			</Button>
		</>
	)
}
