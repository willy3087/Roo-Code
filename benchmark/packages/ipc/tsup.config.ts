import { defineConfig, Options } from "tsup"

const shared: Options = {
	entry: ["src/index.ts"],
	dts: true,
	outDir: "dist",
	clean: true,
}

export default defineConfig([
	{
		...shared,
		format: ["esm"],
		tsconfig: "./tsconfig.json",
	},
	{
		...shared,
		format: ["cjs"],
		tsconfig: "./tsconfig.cjs.json",
		outExtension: () => ({ js: ".cjs" }),
		noExternal: ["node-ipc"],
	},
])
