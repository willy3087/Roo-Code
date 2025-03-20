import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import pMap from "p-map"

import { build, filesystem, GluegunPrompt, GluegunToolbox } from "gluegun"
import { runTests } from "@vscode/test-electron"

import { type Language, languages, type Run, findRun, createRun, getTask } from "@benchmark/db"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionDevelopmentPath = path.resolve(__dirname, "../../../..")
const extensionTestsPath = path.resolve(extensionDevelopmentPath, "benchmark/packages/runner/dist")
const exercisesPath = path.resolve(extensionDevelopmentPath, "benchmark/exercises")

export const isLanguage = (language: string): language is Language => languages.includes(language as Language)

const run = async (toolbox: GluegunToolbox) => {
	const { config, prompt } = toolbox
	const id = config.runId ? Number(config.runId) : undefined
	let { language, exercise } = config

	if (language === "all") {
		const run = await findOrCreateRun({ id })
		await runAll(run)
	} else if (exercise === "all") {
		const run = await findOrCreateRun({ id })
		await runLanguage({ run, language })
	} else {
		language = language || (await askLanguage(prompt))
		exercise = exercise || (await askExercise(prompt, language))
		const run = await findOrCreateRun({ id })
		await runExercise({ run, language, exercise })
	}
}

const runAll = async (run: Run) =>
	(await pMap(languages, (language) => runLanguage({ run, language }), { concurrency: 1 })).flatMap(
		(language) => language,
	)

const runLanguage = async ({ run, language }: { run: Run; language: Language }) => {
	const languagePath = path.resolve(exercisesPath, language)

	if (!fs.existsSync(languagePath)) {
		console.error(`Language directory ${languagePath} does not exist`)
		process.exit(1)
	}

	const exercises = filesystem
		.subdirectories(languagePath)
		.map((exercise) => path.basename(exercise))
		.filter((exercise) => !exercise.startsWith("."))

	const results = await pMap(
		exercises,
		async (exercise) => ({
			language,
			exercise,
			result: await runExercise({ run, language, exercise }),
		}),
		{ concurrency: 1 },
	)

	return results
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
			PROMPT_PATH: promptPath,
			WORKSPACE_PATH: workspacePath,
			OPENROUTER_MODEL_ID: run.model,
			RUN_ID: run.id.toString(),
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

type FindOrCreateRun = { id?: number; model?: string }

const findOrCreateRun = async ({ id, model = "anthropic/claude-3.7-sonnet" }: FindOrCreateRun) =>
	id ? findRun(id) : createRun({ model })

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
