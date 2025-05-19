import { modes, defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { getToolDescriptionsForMode } from "./tools"
import * as vscode from "vscode"
import * as os from "os"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
} from "./sections"
import { loadSystemPromptFile } from "./sections/custom-system-prompt"
import { formatLanguage } from "../../shared/language"
async function generatePrompt(
	context,
	cwd,
	supportsComputerUse,
	mode,
	mcpHub,
	diffStrategy,
	browserViewportSize,
	promptComponent,
	customModeConfigs,
	globalCustomInstructions,
	diffEnabled,
	experiments,
	enableMcpServerCreation,
	language,
	rooIgnoreInstructions,
) {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}
	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined
	// Get the full mode config to ensure we have the role definition
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition
	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])
	const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(mode, cwd, supportsComputerUse, effectiveDiffStrategy, browserViewportSize, mcpHub, customModeConfigs, experiments)}

${getToolUseGuidelinesSection()}

${mcpServersSection}

${getCapabilitiesSection(cwd, supportsComputerUse, mcpHub, effectiveDiffStrategy)}

${modesSection}

${getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy)}

${getSystemInfoSection(cwd)}

${getObjectiveSection()}

${await addCustomInstructions(promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions })}`
	return basePrompt
}
export const SYSTEM_PROMPT = async (
	context,
	cwd,
	supportsComputerUse,
	mcpHub,
	diffStrategy,
	browserViewportSize,
	mode = defaultModeSlug,
	customModePrompts,
	customModes,
	globalCustomInstructions,
	diffEnabled,
	experiments,
	enableMcpServerCreation,
	language,
	rooIgnoreInstructions,
) => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}
	const getPromptComponent = (value) => {
		if (typeof value === "object" && value !== null) {
			return value
		}
		return undefined
	}
	// Try to load custom system prompt from file
	const variablesForPrompt = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)
	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts?.[mode])
	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]
	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition
		const customInstructions = await addCustomInstructions(
			promptComponent?.customInstructions || currentMode.customInstructions || "",
			globalCustomInstructions || "",
			cwd,
			mode,
			{ language: language ?? formatLanguage(vscode.env.language), rooIgnoreInstructions },
		)
		// For file-based prompts, don't include the tool sections
		return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
	}
	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined
	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
	)
}
//# sourceMappingURL=system.js.map
