import * as fs from "fs"
import * as path from "path"
import * as os from "os"

import pMap from "p-map"
import { build, filesystem, GluegunPrompt, GluegunToolbox } from "gluegun"
import { runTests } from "@vscode/test-electron"

import { type Language, languages } from "@benchmark/types"
import { type Run, findRun, createRun, finishRun, createTask, Task, getTasks } from "@benchmark/db"

import { __dirname, extensionDevelopmentPath, extensionTestsPath, exercisesPath } from "./paths.js"
import { getExercises } from "./exercises.js"

export const isLanguage = (language: string): language is Language => languages.includes(language as Language)

const run = async (toolbox: GluegunToolbox) => {
	const { config, prompt } = toolbox

	let { language, exercise } = config

	if (![undefined, ...languages, "all"].includes(language)) {
		throw new Error(`Language is invalid: ${language}`)
	}

	if (!["undefined", "string"].includes(typeof exercise)) {
		throw new Error(`Exercise is invalid: ${exercise}`)
	}

	const id = config.runId ? Number(config.runId) : undefined
	let run: Run

	if (id) {
		run = await findRun(id)
	} else {
		run = await createRun({
			model: "anthropic/claude-3.7-sonnet",
			pid: process.pid,
			socketPath: path.resolve(os.tmpdir(), `benchmark-${crypto.randomUUID()}.sock`),
		})

		if (language === "all") {
			for (const language of languages) {
				const exercises = getExercises()[language as Language]
				await pMap(exercises, async (exercise) => createTask({ runId: run.id, language, exercise }), {
					concurrency: 10,
				})
			}
		} else if (exercise === "all") {
			const exercises = getExercises()[language as Language]
			await pMap(exercises, async (exercise) => createTask({ runId: run.id, language, exercise }), {
				concurrency: 10,
			})
		} else {
			language = language || (await askLanguage(prompt))
			exercise = exercise || (await askExercise(prompt, language))
			await createTask({ runId: run.id, language, exercise })
		}
	}

	const tasks = await getTasks(run.id)

	for (const task of tasks) {
		await runExercise({ run, task })
	}

	const result = await finishRun(run.id)
	console.log(result)
}

const runExercise = async ({ run, task }: { run: Run; task: Task }) => {
	const { language, exercise } = task
	const workspacePath = path.resolve(exercisesPath, language, exercise)
	const promptPath = path.resolve(exercisesPath, `prompts/${language}.md`)

	if (!fs.existsSync(promptPath)) {
		throw new Error(`Prompt file does not exist: ${promptPath}`)
	}

	if (task.finishedAt) {
		console.log(`Test result exists for ${language} / ${exercise}, skipping`)
		return false
	}

	console.log(`Running ${language} / ${exercise}`)

	await runTests({
		extensionDevelopmentPath,
		extensionTestsPath,
		launchArgs: [workspacePath, "--disable-extensions"],
		extensionTestsEnv: {
			TASK_ID: task.id.toString(),
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
