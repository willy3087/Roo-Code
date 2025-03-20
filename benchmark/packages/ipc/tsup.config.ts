import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs"],
	dts: true,
	sourcemap: true,
	clean: true,
	outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
	tsconfig: "tsconfig.cjs.json",
	noExternal: ["node-ipc", "zod"],
})
