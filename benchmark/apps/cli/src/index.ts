import * as fs from "fs"
import * as path from "path"
import * as os from "os"

import { build, filesystem, GluegunPrompt, GluegunToolbox } from "gluegun"
import { runTests } from "@vscode/test-electron"

import {
	type Language,
	languages,
	type Run,
	findRun,
	createRun,
	getPendingTask,
	createPendingTask,
	getTask,
} from "@benchmark/db"

import { __dirname, extensionDevelopmentPath, extensionTestsPath, exercisesPath } from "./paths.js"
import { getExercises } from "./exercises.js"

export const isLanguage = (language: string): language is Language => languages.includes(language as Language)

const run = async (toolbox: GluegunToolbox) => {
	const { config, prompt } = toolbox
	const id = config.runId ? Number(config.runId) : undefined
	const { language, exercise } = config

	if (language === "all") {
		await runAll(id)
	} else if (exercise === "all") {
		await runLanguage({ id, language })
	} else {
		await runLanguageExercise({
			id,
			language: language || (await askLanguage(prompt)),
			exercise: exercise || (await askExercise(prompt, language)),
		})
	}
}

const runAll = async (id?: number) => {
	const run = await findOrCreateRun({ id })
	const exercises = getExercises()

	for (const [language, languageExercises] of Object.entries(exercises)) {
		await Promise.all(
			languageExercises.map((exercise) =>
				findOrCreatePendingTask({ runId: run.id, language: language as Language, exercise }),
			),
		)
	}

	for (const [language, languageExercises] of Object.entries(exercises)) {
		for (const exercise of languageExercises) {
			await runExercise({ run, language: language as Language, exercise })
		}
	}
}

const runLanguage = async ({ id, language }: { id?: number; language: Language }) => {
	const run = await findOrCreateRun({ id })
	const exercises = getExercises()
	const languageExercises = exercises[language]

	await Promise.all(
		languageExercises.map((exercise) => findOrCreatePendingTask({ runId: run.id, language, exercise })),
	)

	for (const exercise of languageExercises) {
		await runExercise({ run, language, exercise })
	}
}

const runLanguageExercise = async ({
	id,
	language,
	exercise,
}: {
	id?: number
	language: Language
	exercise: string
}) => {
	const run = await findOrCreateRun({ id })
	await findOrCreatePendingTask({ runId: run.id, language, exercise })
	return runExercise({ run, language, exercise })
}

const runExercise = async ({ run, language, exercise }: { run: Run; language: Language; exercise: string }) => {
	const workspacePath = path.resolve(exercisesPath, language, exercise)
	const promptPath = path.resolve(exercisesPath, `prompts/${language}.md`)

	if (!fs.existsSync(promptPath)) {
		throw new Error(`Prompt file does not exist: ${promptPath}`)
	}

	const task = await getTask({ runId: run.id, language, exercise })

	if (task) {
		console.log(`Test result exists for ${language} / ${exercise}, skipping`)
		return false
	}

	console.log(`Running ${language} / ${exercise}`)

	await runTests({
		extensionDevelopmentPath,
		extensionTestsPath,
		launchArgs: [workspacePath, "--disable-extensions"],
		extensionTestsEnv: {
			RUN_ID: run.id.toString(),
			LANGUAGE: language,
			EXERCISE: exercise,
			PROMPT_PATH: promptPath,
			WORKSPACE_PATH: workspacePath,
			OPENROUTER_MODEL_ID: run.model,
		},
	})

	return true
}

const askLanguage = async (prompt: GluegunPrompt) => {
	const { language } = await prompt.ask<{ language: Language }>({
		type: "select",
		name: "language",
		message: "Which language?",
		choices: [...languages],
	})

	return language
}

const askExercise = async (prompt: GluegunPrompt, language: Language) => {
	const exercises = filesystem.subdirectories(path.join(exercisesPath, language))

	if (exercises.length === 0) {
		throw new Error(`No exercises found for ${language}`)
	}

	const { exercise } = await prompt.ask<{ exercise: string }>({
		type: "select",
		name: "exercise",
		message: "Which exercise?",
		choices: exercises.map((exercise) => path.basename(exercise)).filter((exercise) => !exercise.startsWith(".")),
	})

	return exercise
}

const findOrCreateRun = async ({ id, model = "anthropic/claude-3.7-sonnet" }: { id?: number; model?: string }) =>
	id
		? findRun(id)
		: createRun({
				model,
				pid: process.pid,
				socketPath: path.resolve(os.tmpdir(), `benchmark-${crypto.randomUUID()}.sock`),
			})

const findOrCreatePendingTask = async ({
	runId,
	language,
	exercise,
}: {
	runId: number
	language: Language
	exercise: string
}) => (await getPendingTask({ runId, language, exercise })) || (await createPendingTask({ runId, language, exercise }))

const main = async () => {
	const cli = build()
		.brand("cli")
		.src(__dirname)
		.help()
		.version()
		.command({
			name: "run",
			description: "Run a benchmark",
			run: ({ config, parameters }) => {
				config.language = parameters.first
				config.exercise = parameters.second

				if (parameters.options["runId"]) {
					config.runId = parameters.options["runId"]
				}
			},
		})
		.defaultCommand()
		.create()

	const toolbox = await cli.run(process.argv)
	const { print, command } = toolbox

	try {
		switch (command?.name) {
			case "run":
				await run(toolbox)
				break
		}

		process.exit(0)
	} catch (error: unknown) {
		print.error(error instanceof Error ? error.message : String(error))
		process.exit(1)
	}
}

if (!fs.existsSync(extensionDevelopmentPath)) {
	console.error(`"extensionDevelopmentPath" does not exist.`)
	process.exit(1)
}

if (!fs.existsSync(extensionTestsPath)) {
	console.error(`"extensionTestsPath" does not exist. Please run "pnpm --filter @benchmark/runner build".`)
	process.exit(1)
}

if (!fs.existsSync(exercisesPath)) {
	console.error(
		`Exercises path does not exist. Please run "git clone https://github.com/cte/Roo-Code-Benchmark.git exercises".`,
	)
	process.exit(1)
}

main()
