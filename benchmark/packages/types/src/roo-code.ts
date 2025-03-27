/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod"

/**
 * ProviderName
 */

const providerNames = [
	"anthropic",
	"glama",
	"openrouter",
	"bedrock",
	"vertex",
	"openai",
	"ollama",
	"vscode-lm",
	"lmstudio",
	"gemini",
	"openai-native",
	"mistral",
	"deepseek",
	"unbound",
	"requesty",
	"human-relay",
	"fake-ai",
] as const

export type ProviderName = (typeof providerNames)[number]

/**
 * ToolGroup
 */

export const toolGroups = ["read", "edit", "browser", "command", "mcp", "modes"] as const

export type ToolGroup = (typeof toolGroups)[number]

/**
 * CheckpointStorage
 */

export const checkpointStorages = ["task", "workspace"] as const

export type CheckpointStorage = (typeof checkpointStorages)[number]

/**
 * Language
 */

const languages = [
	"ca",
	"de",
	"en",
	"es",
	"fr",
	"hi",
	"it",
	"ja",
	"ko",
	"pl",
	"pt-BR",
	"tr",
	"vi",
	"zh-CN",
	"zh-TW",
] as const

export type Language = (typeof languages)[number]

/**
 * TelemetrySetting
 */

export const telemetrySettings = ["unset", "enabled", "disabled"] as const

export type TelemetrySetting = (typeof telemetrySettings)[number]

/**
 * ModelInfo
 */

const modelInfoSchema = z.object({
	maxTokens: z.number().optional(),
	contextWindow: z.number(),
	supportsImages: z.boolean().optional(),
	supportsComputerUse: z.boolean().optional(),
	supportsPromptCache: z.boolean(),
	inputPrice: z.number().optional(),
	outputPrice: z.number().optional(),
	cacheWritesPrice: z.number().optional(),
	cacheReadsPrice: z.number().optional(),
	description: z.string().optional(),
	reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
	thinking: z.boolean().optional(),
})

export type ModelInfo = z.infer<typeof modelInfoSchema>

/**
 * ApiConfigMeta
 */

const apiConfigMetaSchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: z.enum(providerNames).optional(),
})

export type ApiConfigMeta = z.infer<typeof apiConfigMetaSchema>

/**
 * HistoryItem
 */

const historyItemSchema = z.object({
	id: z.string(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
})

export type HistoryItem = z.infer<typeof historyItemSchema>

/**
 * GroupEntry
 */

const groupEntrySchema = z.union([
	z.enum(toolGroups),
	z
		.tuple([
			z.enum(toolGroups),
			z.object({
				fileRegex: z.string().optional(),
				description: z.string().optional(),
			}),
		])
		.readonly(),
])

export type GroupEntry = z.infer<typeof groupEntrySchema>

/**
 * ModeConfig
 */

const modeConfigSchema = z.object({
	slug: z.string(),
	name: z.string(),
	roleDefinition: z.string(),
	customInstructions: z.string().optional(),
	groups: z.array(groupEntrySchema).readonly(),
	source: z.enum(["global", "project"]).optional(),
})

export type ModeConfig = z.infer<typeof modeConfigSchema>

/**
 * ExperimentId
 */

const experimentsSchema = z.object({
	experimentalDiffStrategy: z.boolean(),
	search_and_replace: z.boolean(),
	insert_content: z.boolean(),
	powerSteering: z.boolean(),
	multi_search_and_replace: z.boolean(),
})

export type Experiments = z.infer<typeof experimentsSchema>

/**
 * GlobalSettings
 */

export const globalSettingsSchema = z.object({
	currentApiConfigName: z.string().optional(),
	listApiConfigMeta: z.array(apiConfigMetaSchema).optional(),
	pinnedApiConfigs: z.record(z.string(), z.boolean()).optional(),

	lastShownAnnouncementId: z.string().optional(),
	customInstructions: z.string().optional(),
	taskHistory: z.array(historyItemSchema).optional(),

	autoApprovalEnabled: z.boolean().optional(),
	alwaysAllowReadOnly: z.boolean().optional(),
	alwaysAllowReadOnlyOutsideWorkspace: z.boolean().optional(),
	alwaysAllowWrite: z.boolean().optional(),
	alwaysAllowWriteOutsideWorkspace: z.boolean().optional(),
	writeDelayMs: z.number().optional(),
	alwaysAllowBrowser: z.boolean().optional(),
	alwaysApproveResubmit: z.boolean().optional(),
	requestDelaySeconds: z.number().optional(),
	alwaysAllowMcp: z.boolean().optional(),
	alwaysAllowModeSwitch: z.boolean().optional(),
	alwaysAllowSubtasks: z.boolean().optional(),
	alwaysAllowExecute: z.boolean().optional(),
	allowedCommands: z.array(z.string()).optional(),

	browserToolEnabled: z.boolean().optional(),
	browserViewportSize: z.string().optional(),
	screenshotQuality: z.number().optional(),
	remoteBrowserEnabled: z.boolean().optional(),
	remoteBrowserHost: z.string().optional(),

	enableCheckpoints: z.boolean().optional(),
	checkpointStorage: z.enum(checkpointStorages).optional(),

	ttsEnabled: z.boolean().optional(),
	ttsSpeed: z.number().optional(),
	soundEnabled: z.boolean().optional(),
	soundVolume: z.number().optional(),

	maxOpenTabsContext: z.number().optional(),
	maxWorkspaceFiles: z.number().optional(),
	showRooIgnoredFiles: z.boolean().optional(),
	maxReadFileLine: z.number().optional(),

	terminalOutputLineLimit: z.number().optional(),
	terminalShellIntegrationTimeout: z.number().optional(),

	rateLimitSeconds: z.number().optional(),
	diffEnabled: z.boolean().optional(),
	fuzzyMatchThreshold: z.number().optional(),
	experiments: experimentsSchema.optional(),

	language: z.enum(languages).optional(),

	telemetrySetting: z.enum(telemetrySettings).optional(),

	mcpEnabled: z.boolean().optional(),
	enableMcpServerCreation: z.boolean().optional(),

	mode: z.string().optional(),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	customModes: z.array(modeConfigSchema).optional(),
	customModePrompts: z
		.record(
			z.string(),
			z
				.object({
					roleDefinition: z.string().optional(),
					customInstructions: z.string().optional(),
				})
				.optional(),
		)
		.optional(),
	customSupportPrompts: z.record(z.string(), z.string().optional()).optional(),
	enhancementApiConfigId: z.string().optional(),
})

export type GlobalSettings = z.infer<typeof globalSettingsSchema>
