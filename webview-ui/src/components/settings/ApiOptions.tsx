import { Checkbox, Dropdown, Pane } from "vscrui"
import type { DropdownOption } from "vscrui"
import { VSCodeLink, VSCodeRadio, VSCodeRadioGroup, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react"
import { useEvent, useInterval } from "react-use"
import {
	ApiConfiguration,
	ModelInfo,
	anthropicDefaultModelId,
	anthropicModels,
	azureOpenAiDefaultApiVersion,
	bedrockDefaultModelId,
	bedrockModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	geminiDefaultModelId,
	geminiModels,
	glamaDefaultModelId,
	glamaDefaultModelInfo,
	mistralDefaultModelId,
	mistralModels,
	openAiModelInfoSaneDefaults,
	openAiNativeDefaultModelId,
	openAiNativeModels,
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	vertexDefaultModelId,
	vertexModels,
	unboundDefaultModelId,
	unboundModels,
} from "../../../../src/shared/api"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import * as vscodemodels from "vscode"
import VSCodeButtonLink from "../common/VSCodeButtonLink"
import OpenRouterModelPicker, {
	ModelDescriptionMarkdown,
	OPENROUTER_MODEL_PICKER_Z_INDEX,
} from "./OpenRouterModelPicker"
import OpenAiModelPicker from "./OpenAiModelPicker"
import GlamaModelPicker from "./GlamaModelPicker"

interface ApiOptionsProps {
	apiErrorMessage?: string
	modelIdErrorMessage?: string
}

const ApiOptions = ({ apiErrorMessage, modelIdErrorMessage }: ApiOptionsProps) => {
	const { apiConfiguration, uriScheme, handleInputChange } = useExtensionState()
	const [ollamaModels, setOllamaModels] = useState<string[]>([])
	const [lmStudioModels, setLmStudioModels] = useState<string[]>([])
	const [vsCodeLmModels, setVsCodeLmModels] = useState<vscodemodels.LanguageModelChatSelector[]>([])
	const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl)
	const [azureApiVersionSelected, setAzureApiVersionSelected] = useState(!!apiConfiguration?.azureApiVersion)
	const [openRouterBaseUrlSelected, setOpenRouterBaseUrlSelected] = useState(!!apiConfiguration?.openRouterBaseUrl)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

	const { selectedProvider, selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	// Poll ollama/lmstudio models
	const requestLocalModels = useCallback(() => {
		if (selectedProvider === "ollama") {
			vscode.postMessage({ type: "requestOllamaModels", text: apiConfiguration?.ollamaBaseUrl })
		} else if (selectedProvider === "lmstudio") {
			vscode.postMessage({ type: "requestLmStudioModels", text: apiConfiguration?.lmStudioBaseUrl })
		} else if (selectedProvider === "vscode-lm") {
			vscode.postMessage({ type: "requestVsCodeLmModels" })
		}
	}, [selectedProvider, apiConfiguration?.ollamaBaseUrl, apiConfiguration?.lmStudioBaseUrl])
	useEffect(() => {
		if (selectedProvider === "ollama" || selectedProvider === "lmstudio" || selectedProvider === "vscode-lm") {
			requestLocalModels()
		}
	}, [selectedProvider, requestLocalModels])
	useInterval(
		requestLocalModels,
		selectedProvider === "ollama" || selectedProvider === "lmstudio" || selectedProvider === "vscode-lm"
			? 2000
			: null,
	)
	const handleMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data
		if (message.type === "ollamaModels" && message.ollamaModels) {
			setOllamaModels(message.ollamaModels)
		} else if (message.type === "lmStudioModels" && message.lmStudioModels) {
			setLmStudioModels(message.lmStudioModels)
		} else if (message.type === "vsCodeLmModels" && message.vsCodeLmModels) {
			setVsCodeLmModels(message.vsCodeLmModels)
		}
	}, [])
	useEvent("message", handleMessage)

	const createDropdown = (models: Record<string, ModelInfo>) => {
		const options: DropdownOption[] = [
			{ value: "", label: "Select a model..." },
			...Object.keys(models).map((modelId) => ({
				value: modelId,
				label: modelId,
			})),
		]
		return (
			<Dropdown
				id="model-id"
				value={selectedModelId}
				onChange={(value: unknown) => {
					handleInputChange("apiModelId")({
						target: {
							value: (value as DropdownOption).value,
						},
					})
				}}
				style={{ width: "100%" }}
				options={options}
			/>
		)
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
			<div className="dropdown-container">
				<label htmlFor="api-provider">
					<span style={{ fontWeight: 500 }}>API Provider</span>
				</label>
				<Dropdown
					id="api-provider"
					value={selectedProvider}
					onChange={(value: unknown) => {
						handleInputChange("apiProvider")({
							target: {
								value: (value as DropdownOption).value,
							},
						})
					}}
					style={{ minWidth: 130, position: "relative", zIndex: OPENROUTER_MODEL_PICKER_Z_INDEX + 1 }}
					options={[
						{ value: "openrouter", label: "OpenRouter" },
						{ value: "anthropic", label: "Anthropic" },
						{ value: "gemini", label: "Google Gemini" },
						{ value: "deepseek", label: "DeepSeek" },
						{ value: "openai-native", label: "OpenAI" },
						{ value: "openai", label: "OpenAI Compatible" },
						{ value: "vertex", label: "GCP Vertex AI" },
						{ value: "bedrock", label: "AWS Bedrock" },
						{ value: "glama", label: "Glama" },
						{ value: "vscode-lm", label: "VS Code LM API" },
						{ value: "mistral", label: "Mistral" },
						{ value: "lmstudio", label: "LM Studio" },
						{ value: "ollama", label: "Ollama" },
						{ value: "unbound", label: "Unbound" },
					]}
				/>
			</div>

			{selectedProvider === "anthropic" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.apiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("apiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>Anthropic API Key</span>
					</VSCodeTextField>

					<Checkbox
						checked={anthropicBaseUrlSelected}
						onChange={(checked: boolean) => {
							setAnthropicBaseUrlSelected(checked)
							if (!checked) {
								handleInputChange("anthropicBaseUrl")({
									target: {
										value: "",
									},
								})
							}
						}}>
						Use custom base URL
					</Checkbox>

					{anthropicBaseUrlSelected && (
						<VSCodeTextField
							value={apiConfiguration?.anthropicBaseUrl || ""}
							style={{ width: "100%", marginTop: 3 }}
							type="url"
							onInput={handleInputChange("anthropicBaseUrl")}
							placeholder="Default: https://api.anthropic.com"
						/>
					)}

					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
						{!apiConfiguration?.apiKey && (
							<VSCodeLink
								href="https://console.anthropic.com/settings/keys"
								style={{ display: "inline", fontSize: "inherit" }}>
								You can get an Anthropic API key by signing up here.
							</VSCodeLink>
						)}
					</p>
				</div>
			)}

			{selectedProvider === "glama" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.glamaApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("glamaApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>Glama API Key</span>
					</VSCodeTextField>
					{!apiConfiguration?.glamaApiKey && (
						<VSCodeButtonLink
							href={getGlamaAuthUrl(uriScheme)}
							style={{ margin: "5px 0 0 0" }}
							appearance="secondary">
							Get Glama API Key
						</VSCodeButtonLink>
					)}
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
					</p>
				</div>
			)}

			{selectedProvider === "openai-native" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.openAiNativeApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("openAiNativeApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>OpenAI API Key</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
						{!apiConfiguration?.openAiNativeApiKey && (
							<VSCodeLink
								href="https://platform.openai.com/api-keys"
								style={{ display: "inline", fontSize: "inherit" }}>
								You can get an OpenAI API key by signing up here.
							</VSCodeLink>
						)}
					</p>
				</div>
			)}

			{selectedProvider === "mistral" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.mistralApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("mistralApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>Mistral API Key</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
						{!apiConfiguration?.mistralApiKey && (
							<VSCodeLink
								href="https://console.mistral.ai/codestral/"
								style={{
									display: "inline",
									fontSize: "inherit",
								}}>
								You can get a Mistral API key by signing up here.
							</VSCodeLink>
						)}
					</p>
				</div>
			)}

			{selectedProvider === "openrouter" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.openRouterApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("openRouterApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>OpenRouter API Key</span>
					</VSCodeTextField>
					{!apiConfiguration?.openRouterApiKey && (
						<p>
							<VSCodeButtonLink
								href={getOpenRouterAuthUrl(uriScheme)}
								style={{ margin: "5px 0 0 0" }}
								appearance="secondary">
								Get OpenRouter API Key
							</VSCodeButtonLink>
						</p>
					)}
					<Checkbox
						checked={openRouterBaseUrlSelected}
						onChange={(checked: boolean) => {
							setOpenRouterBaseUrlSelected(checked)
							if (!checked) {
								handleInputChange("openRouterBaseUrl")({
									target: {
										value: "",
									},
								})
							}
						}}>
						Use custom base URL
					</Checkbox>

					{openRouterBaseUrlSelected && (
						<VSCodeTextField
							value={apiConfiguration?.openRouterBaseUrl || ""}
							style={{ width: "100%", marginTop: 3 }}
							type="url"
							onInput={handleInputChange("openRouterBaseUrl")}
							placeholder="Default: https://openrouter.ai/api/v1"
						/>
					)}
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.{" "}
						{/* {!apiConfiguration?.openRouterApiKey && (
							<span style={{ color: "var(--vscode-charts-green)" }}>
								(<span style={{ fontWeight: 500 }}>Note:</span> OpenRouter is recommended for high rate
								limits, prompt caching, and wider selection of models.)
							</span>
						)} */}
					</p>
					<Checkbox
						checked={apiConfiguration?.openRouterUseMiddleOutTransform || false}
						onChange={(checked: boolean) => {
							handleInputChange("openRouterUseMiddleOutTransform")({
								target: { value: checked },
							})
						}}>
						Compress prompts and message chains to the context size (
						<a href="https://openrouter.ai/docs/transforms">OpenRouter Transforms</a>)
					</Checkbox>
					<br />
				</div>
			)}

			{selectedProvider === "bedrock" && (
				<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
					<VSCodeRadioGroup
						value={apiConfiguration?.awsUseProfile ? "profile" : "credentials"}
						onChange={(e) => {
							const value = (e.target as HTMLInputElement)?.value
							const useProfile = value === "profile"
							handleInputChange("awsUseProfile")({
								target: { value: useProfile },
							})
						}}>
						<VSCodeRadio value="credentials">AWS Credentials</VSCodeRadio>
						<VSCodeRadio value="profile">AWS Profile</VSCodeRadio>
					</VSCodeRadioGroup>
					{/* AWS Profile Config Block */}
					{apiConfiguration?.awsUseProfile ? (
						<VSCodeTextField
							value={apiConfiguration?.awsProfile || ""}
							style={{ width: "100%" }}
							onInput={handleInputChange("awsProfile")}
							placeholder="Enter profile name">
							<span style={{ fontWeight: 500 }}>AWS Profile Name</span>
						</VSCodeTextField>
					) : (
						<>
							{/* AWS Credentials Config Block */}
							<VSCodeTextField
								value={apiConfiguration?.awsAccessKey || ""}
								style={{ width: "100%" }}
								type="password"
								onInput={handleInputChange("awsAccessKey")}
								placeholder="Enter Access Key...">
								<span style={{ fontWeight: 500 }}>AWS Access Key</span>
							</VSCodeTextField>
							<VSCodeTextField
								value={apiConfiguration?.awsSecretKey || ""}
								style={{ width: "100%" }}
								type="password"
								onInput={handleInputChange("awsSecretKey")}
								placeholder="Enter Secret Key...">
								<span style={{ fontWeight: 500 }}>AWS Secret Key</span>
							</VSCodeTextField>
							<VSCodeTextField
								value={apiConfiguration?.awsSessionToken || ""}
								style={{ width: "100%" }}
								type="password"
								onInput={handleInputChange("awsSessionToken")}
								placeholder="Enter Session Token...">
								<span style={{ fontWeight: 500 }}>AWS Session Token</span>
							</VSCodeTextField>
						</>
					)}
					<div className="dropdown-container">
						<label htmlFor="aws-region-dropdown">
							<span style={{ fontWeight: 500 }}>AWS Region</span>
						</label>
						<Dropdown
							id="aws-region-dropdown"
							value={apiConfiguration?.awsRegion || ""}
							style={{ width: "100%" }}
							onChange={(value: unknown) => {
								handleInputChange("awsRegion")({
									target: {
										value: (value as DropdownOption).value,
									},
								})
							}}
							options={[
								{ value: "", label: "Select a region..." },
								{ value: "us-east-1", label: "us-east-1" },
								{ value: "us-east-2", label: "us-east-2" },
								{ value: "us-west-2", label: "us-west-2" },
								{ value: "ap-south-1", label: "ap-south-1" },
								{ value: "ap-northeast-1", label: "ap-northeast-1" },
								{ value: "ap-northeast-2", label: "ap-northeast-2" },
								{ value: "ap-southeast-1", label: "ap-southeast-1" },
								{ value: "ap-southeast-2", label: "ap-southeast-2" },
								{ value: "ca-central-1", label: "ca-central-1" },
								{ value: "eu-central-1", label: "eu-central-1" },
								{ value: "eu-west-1", label: "eu-west-1" },
								{ value: "eu-west-2", label: "eu-west-2" },
								{ value: "eu-west-3", label: "eu-west-3" },
								{ value: "sa-east-1", label: "sa-east-1" },
								{ value: "us-gov-west-1", label: "us-gov-west-1" },
							]}
						/>
					</div>
					<Checkbox
						checked={apiConfiguration?.awsUseCrossRegionInference || false}
						onChange={(checked: boolean) => {
							handleInputChange("awsUseCrossRegionInference")({
								target: { value: checked },
							})
						}}>
						Use cross-region inference
					</Checkbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						Authenticate by either providing the keys above or use the default AWS credential providers,
						i.e. ~/.aws/credentials or environment variables. These credentials are only used locally to
						make API requests from this extension.
					</p>
				</div>
			)}

			{apiConfiguration?.apiProvider === "vertex" && (
				<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
					<VSCodeTextField
						value={apiConfiguration?.vertexProjectId || ""}
						style={{ width: "100%" }}
						onInput={handleInputChange("vertexProjectId")}
						placeholder="Enter Project ID...">
						<span style={{ fontWeight: 500 }}>Google Cloud Project ID</span>
					</VSCodeTextField>
					<div className="dropdown-container">
						<label htmlFor="vertex-region-dropdown">
							<span style={{ fontWeight: 500 }}>Google Cloud Region</span>
						</label>
						<Dropdown
							id="vertex-region-dropdown"
							value={apiConfiguration?.vertexRegion || ""}
							style={{ width: "100%" }}
							onChange={(value: unknown) => {
								handleInputChange("vertexRegion")({
									target: {
										value: (value as DropdownOption).value,
									},
								})
							}}
							options={[
								{ value: "", label: "Select a region..." },
								{ value: "us-east5", label: "us-east5" },
								{ value: "us-central1", label: "us-central1" },
								{ value: "europe-west1", label: "europe-west1" },
								{ value: "europe-west4", label: "europe-west4" },
								{ value: "asia-southeast1", label: "asia-southeast1" },
							]}
						/>
					</div>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						To use Google Cloud Vertex AI, you need to
						<VSCodeLink
							href="https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#before_you_begin"
							style={{ display: "inline", fontSize: "inherit" }}>
							{
								"1) create a Google Cloud account › enable the Vertex AI API › enable the desired Claude models,"
							}
						</VSCodeLink>{" "}
						<VSCodeLink
							href="https://cloud.google.com/docs/authentication/provide-credentials-adc#google-idp"
							style={{ display: "inline", fontSize: "inherit" }}>
							{"2) install the Google Cloud CLI › configure Application Default Credentials."}
						</VSCodeLink>
					</p>
				</div>
			)}

			{selectedProvider === "gemini" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.geminiApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("geminiApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>Gemini API Key</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
						{!apiConfiguration?.geminiApiKey && (
							<VSCodeLink
								href="https://ai.google.dev/"
								style={{ display: "inline", fontSize: "inherit" }}>
								You can get a Gemini API key by signing up here.
							</VSCodeLink>
						)}
					</p>
				</div>
			)}

			{selectedProvider === "openai" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.openAiBaseUrl || ""}
						style={{ width: "100%" }}
						type="url"
						onInput={handleInputChange("openAiBaseUrl")}
						placeholder={"Enter base URL..."}>
						<span style={{ fontWeight: 500 }}>Base URL</span>
					</VSCodeTextField>
					<VSCodeTextField
						value={apiConfiguration?.openAiApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("openAiApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>API Key</span>
					</VSCodeTextField>
					<OpenAiModelPicker />
					<div style={{ display: "flex", alignItems: "center" }}>
						<Checkbox
							checked={apiConfiguration?.openAiStreamingEnabled ?? true}
							onChange={(checked: boolean) => {
								handleInputChange("openAiStreamingEnabled")({
									target: { value: checked },
								})
							}}>
							Enable streaming
						</Checkbox>
					</div>
					<Checkbox
						checked={apiConfiguration?.openAiUseAzure ?? false}
						onChange={(checked: boolean) => {
							handleInputChange("openAiUseAzure")({
								target: { value: checked },
							})
						}}>
						Use Azure
					</Checkbox>
					<Checkbox
						checked={azureApiVersionSelected}
						onChange={(checked: boolean) => {
							setAzureApiVersionSelected(checked)
							if (!checked) {
								handleInputChange("azureApiVersion")({
									target: {
										value: "",
									},
								})
							}
						}}>
						Set Azure API version
					</Checkbox>
					{azureApiVersionSelected && (
						<VSCodeTextField
							value={apiConfiguration?.azureApiVersion || ""}
							style={{ width: "100%", marginTop: 3 }}
							onInput={handleInputChange("azureApiVersion")}
							placeholder={`Default: ${azureOpenAiDefaultApiVersion}`}
						/>
					)}

					<div
						style={{
							marginTop: 15,
						}}
					/>
					<Pane
						title="Model Configuration"
						open={false}
						actions={[
							{
								iconName: "refresh",
								onClick: () =>
									handleInputChange("openAiCustomModelInfo")({
										target: { value: openAiModelInfoSaneDefaults },
									}),
							},
						]}>
						<div
							style={{
								padding: 15,
								backgroundColor: "var(--vscode-editor-background)",
							}}>
							<p
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									margin: "0 0 15px 0",
									lineHeight: "1.4",
								}}>
								Configure the capabilities and pricing for your custom OpenAI-compatible model. <br />
								Be careful for the model capabilities, as they can affect how Roo Code can work.
							</p>

							{/* Capabilities Section */}
							<div
								style={{
									marginBottom: 20,
									padding: 12,
									backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
									borderRadius: 4,
								}}>
								<span
									style={{
										fontWeight: 500,
										fontSize: "12px",
										display: "block",
										marginBottom: 12,
										color: "var(--vscode-editor-foreground)",
									}}>
									Model Capabilities
								</span>
								<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
									<div className="token-config-field">
										<VSCodeTextField
											value={
												apiConfiguration?.openAiCustomModelInfo?.maxTokens?.toString() ||
												openAiModelInfoSaneDefaults.maxTokens?.toString() ||
												""
											}
											type="text"
											style={{
												width: "100%",
												borderColor: (() => {
													const value = apiConfiguration?.openAiCustomModelInfo?.maxTokens
													if (!value) return "var(--vscode-input-border)"
													return value > 0
														? "var(--vscode-charts-green)"
														: "var(--vscode-errorForeground)"
												})(),
											}}
											title="Maximum number of tokens the model can generate in a single response"
											onChange={(e: any) => {
												const value = parseInt(e.target.value)
												handleInputChange("openAiCustomModelInfo")({
													target: {
														value: {
															...(apiConfiguration?.openAiCustomModelInfo ||
																openAiModelInfoSaneDefaults),
															maxTokens: isNaN(value) ? undefined : value,
														},
													},
												})
											}}
											placeholder="e.g. 4096">
											<span style={{ fontWeight: 500 }}>Max Output Tokens</span>
										</VSCodeTextField>
										<div
											style={{
												fontSize: "11px",
												color: "var(--vscode-descriptionForeground)",
												marginTop: 4,
												display: "flex",
												alignItems: "center",
												gap: 4,
											}}>
											<i className="codicon codicon-info" style={{ fontSize: "12px" }}></i>
											<span>
												Maximum number of tokens the model can generate in a response. <br />
												(-1 is depend on server)
											</span>
										</div>
									</div>

									<div className="token-config-field">
										<VSCodeTextField
											value={
												apiConfiguration?.openAiCustomModelInfo?.contextWindow?.toString() ||
												openAiModelInfoSaneDefaults.contextWindow?.toString() ||
												""
											}
											type="text"
											style={{
												width: "100%",
												borderColor: (() => {
													const value = apiConfiguration?.openAiCustomModelInfo?.contextWindow
													if (!value) return "var(--vscode-input-border)"
													return value > 0
														? "var(--vscode-charts-green)"
														: "var(--vscode-errorForeground)"
												})(),
											}}
											title="Total number of tokens (input + output) the model can process in a single request"
											onChange={(e: any) => {
												const parsed = parseInt(e.target.value)
												handleInputChange("openAiCustomModelInfo")({
													target: {
														value: {
															...(apiConfiguration?.openAiCustomModelInfo ||
																openAiModelInfoSaneDefaults),
															contextWindow:
																e.target.value === ""
																	? undefined
																	: isNaN(parsed)
																		? openAiModelInfoSaneDefaults.contextWindow
																		: parsed,
														},
													},
												})
											}}
											placeholder="e.g. 128000">
											<span style={{ fontWeight: 500 }}>Context Window Size</span>
										</VSCodeTextField>
										<div
											style={{
												fontSize: "11px",
												color: "var(--vscode-descriptionForeground)",
												marginTop: 4,
												display: "flex",
												alignItems: "center",
												gap: 4,
											}}>
											<i className="codicon codicon-info" style={{ fontSize: "12px" }}></i>
											<span>
												Total tokens (input + output) the model can process. This will help Roo
												Code run correctly.
											</span>
										</div>
									</div>

									<div
										style={{
											backgroundColor: "var(--vscode-editor-background)",
											padding: "12px",
											borderRadius: "4px",
											marginTop: "8px",
											border: "1px solid var(--vscode-input-border)",
											transition: "background-color 0.2s ease",
										}}>
										<span
											style={{
												fontSize: "11px",
												fontWeight: 500,
												color: "var(--vscode-editor-foreground)",
												display: "block",
												marginBottom: "10px",
											}}>
											Model Features
										</span>

										<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
											<div className="feature-toggle">
												<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
													<Checkbox
														checked={
															apiConfiguration?.openAiCustomModelInfo?.supportsImages ??
															openAiModelInfoSaneDefaults.supportsImages
														}
														onChange={(checked: boolean) => {
															handleInputChange("openAiCustomModelInfo")({
																target: {
																	value: {
																		...(apiConfiguration?.openAiCustomModelInfo ||
																			openAiModelInfoSaneDefaults),
																		supportsImages: checked,
																	},
																},
															})
														}}>
														<span style={{ fontWeight: 500 }}>Image Support</span>
													</Checkbox>
													<i
														className="codicon codicon-info"
														title="Enable if the model can process and understand images in the input. Required for image-based assistance and visual code understanding."
														style={{
															fontSize: "12px",
															color: "var(--vscode-descriptionForeground)",
															cursor: "help",
														}}
													/>
												</div>
												<p
													style={{
														fontSize: "11px",
														color: "var(--vscode-descriptionForeground)",
														marginLeft: "24px",
														marginTop: "4px",
														lineHeight: "1.4",
													}}>
													Allows the model to analyze and understand images, essential for
													visual code assistance
												</p>
											</div>

											<div
												className="feature-toggle"
												style={{
													borderTop: "1px solid var(--vscode-input-border)",
													paddingTop: "12px",
												}}>
												<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
													<Checkbox
														checked={
															apiConfiguration?.openAiCustomModelInfo
																?.supportsComputerUse ?? false
														}
														onChange={(checked: boolean) => {
															handleInputChange("openAiCustomModelInfo")({
																target: {
																	value: {
																		...(apiConfiguration?.openAiCustomModelInfo ||
																			openAiModelInfoSaneDefaults),
																		supportsComputerUse: checked,
																	},
																},
															})
														}}>
														<span style={{ fontWeight: 500 }}>Computer Use</span>
													</Checkbox>
													<i
														className="codicon codicon-info"
														title="Enable if the model can interact with your computer through commands and file operations. Required for automated tasks and file modifications."
														style={{
															fontSize: "12px",
															color: "var(--vscode-descriptionForeground)",
															cursor: "help",
														}}
													/>
												</div>
												<p
													style={{
														fontSize: "11px",
														color: "var(--vscode-descriptionForeground)",
														marginLeft: "24px",
														marginTop: "4px",
														lineHeight: "1.4",
													}}>
													This model feature is for computer use like sonnet 3.5 support
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Pricing Section */}
							<div
								style={{
									backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
									padding: "12px",
									borderRadius: "4px",
									marginTop: "15px",
								}}>
								<div style={{ marginBottom: "12px" }}>
									<span
										style={{
											fontWeight: 500,
											fontSize: "12px",
											color: "var(--vscode-editor-foreground)",
											display: "block",
											marginBottom: "4px",
										}}>
										Model Pricing
									</span>
									<span
										style={{
											fontSize: "11px",
											color: "var(--vscode-descriptionForeground)",
											display: "block",
										}}>
										Configure token-based pricing in USD per million tokens
									</span>
								</div>

								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr",
										gap: "12px",
										backgroundColor: "var(--vscode-editor-background)",
										padding: "12px",
										borderRadius: "4px",
									}}>
									<div className="price-input">
										<VSCodeTextField
											value={
												apiConfiguration?.openAiCustomModelInfo?.inputPrice?.toString() ??
												openAiModelInfoSaneDefaults.inputPrice?.toString() ??
												""
											}
											type="text"
											style={{
												width: "100%",
												borderColor: (() => {
													const value = apiConfiguration?.openAiCustomModelInfo?.inputPrice
													if (!value && value !== 0) return "var(--vscode-input-border)"
													return value >= 0
														? "var(--vscode-charts-green)"
														: "var(--vscode-errorForeground)"
												})(),
											}}
											onChange={(e: any) => {
												const parsed = parseFloat(e.target.value)
												handleInputChange("openAiCustomModelInfo")({
													target: {
														value: {
															...(apiConfiguration?.openAiCustomModelInfo ??
																openAiModelInfoSaneDefaults),
															inputPrice:
																e.target.value === ""
																	? undefined
																	: isNaN(parsed)
																		? openAiModelInfoSaneDefaults.inputPrice
																		: parsed,
														},
													},
												})
											}}
											placeholder="e.g. 0.0001">
											<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
												<span style={{ fontWeight: 500 }}>Input Price</span>
												<i
													className="codicon codicon-info"
													title="Cost per million tokens in the input/prompt. This affects the cost of sending context and instructions to the model."
													style={{
														fontSize: "12px",
														color: "var(--vscode-descriptionForeground)",
														cursor: "help",
													}}
												/>
											</div>
										</VSCodeTextField>
									</div>

									<div className="price-input">
										<VSCodeTextField
											value={
												apiConfiguration?.openAiCustomModelInfo?.outputPrice?.toString() ||
												openAiModelInfoSaneDefaults.outputPrice?.toString() ||
												""
											}
											type="text"
											style={{
												width: "100%",
												borderColor: (() => {
													const value = apiConfiguration?.openAiCustomModelInfo?.outputPrice
													if (!value && value !== 0) return "var(--vscode-input-border)"
													return value >= 0
														? "var(--vscode-charts-green)"
														: "var(--vscode-errorForeground)"
												})(),
											}}
											onChange={(e: any) => {
												const parsed = parseFloat(e.target.value)
												handleInputChange("openAiCustomModelInfo")({
													target: {
														value: {
															...(apiConfiguration?.openAiCustomModelInfo ||
																openAiModelInfoSaneDefaults),
															outputPrice:
																e.target.value === ""
																	? undefined
																	: isNaN(parsed)
																		? openAiModelInfoSaneDefaults.outputPrice
																		: parsed,
														},
													},
												})
											}}
											placeholder="e.g. 0.0002">
											<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
												<span style={{ fontWeight: 500 }}>Output Price</span>
												<i
													className="codicon codicon-info"
													title="Cost per million tokens in the model's response. This affects the cost of generated content and completions."
													style={{
														fontSize: "12px",
														color: "var(--vscode-descriptionForeground)",
														cursor: "help",
													}}
												/>
											</div>
										</VSCodeTextField>
									</div>
								</div>
							</div>
						</div>
					</Pane>
					<div
						style={{
							marginTop: 15,
						}}
					/>

					{/* end Model Info Configuration */}

					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						<span style={{ color: "var(--vscode-errorForeground)" }}>
							(<span style={{ fontWeight: 500 }}>Note:</span> Roo Code uses complex prompts and works best
							with Claude models. Less capable models may not work as expected.)
						</span>
					</p>
				</div>
			)}

			{selectedProvider === "lmstudio" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.lmStudioBaseUrl || ""}
						style={{ width: "100%" }}
						type="url"
						onInput={handleInputChange("lmStudioBaseUrl")}
						placeholder={"Default: http://localhost:1234"}>
						<span style={{ fontWeight: 500 }}>Base URL (optional)</span>
					</VSCodeTextField>
					<VSCodeTextField
						value={apiConfiguration?.lmStudioModelId || ""}
						style={{ width: "100%" }}
						onInput={handleInputChange("lmStudioModelId")}
						placeholder={"e.g. meta-llama-3.1-8b-instruct"}>
						<span style={{ fontWeight: 500 }}>Model ID</span>
					</VSCodeTextField>
					{lmStudioModels.length > 0 && (
						<VSCodeRadioGroup
							value={
								lmStudioModels.includes(apiConfiguration?.lmStudioModelId || "")
									? apiConfiguration?.lmStudioModelId
									: ""
							}
							onChange={(e) => {
								const value = (e.target as HTMLInputElement)?.value
								// need to check value first since radio group returns empty string sometimes
								if (value) {
									handleInputChange("lmStudioModelId")({
										target: { value },
									})
								}
							}}>
							{lmStudioModels.map((model) => (
								<VSCodeRadio
									key={model}
									value={model}
									checked={apiConfiguration?.lmStudioModelId === model}>
									{model}
								</VSCodeRadio>
							))}
						</VSCodeRadioGroup>
					)}
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						LM Studio allows you to run models locally on your computer. For instructions on how to get
						started, see their
						<VSCodeLink href="https://lmstudio.ai/docs" style={{ display: "inline", fontSize: "inherit" }}>
							quickstart guide.
						</VSCodeLink>
						You will also need to start LM Studio's{" "}
						<VSCodeLink
							href="https://lmstudio.ai/docs/basics/server"
							style={{ display: "inline", fontSize: "inherit" }}>
							local server
						</VSCodeLink>{" "}
						feature to use it with this extension.{" "}
						<span style={{ color: "var(--vscode-errorForeground)" }}>
							(<span style={{ fontWeight: 500 }}>Note:</span> Roo Code uses complex prompts and works best
							with Claude models. Less capable models may not work as expected.)
						</span>
					</p>
				</div>
			)}

			{selectedProvider === "deepseek" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.deepSeekApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onInput={handleInputChange("deepSeekApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>DeepSeek API Key</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
						{!apiConfiguration?.deepSeekApiKey && (
							<VSCodeLink
								href="https://platform.deepseek.com/"
								style={{ display: "inline", fontSize: "inherit" }}>
								You can get a DeepSeek API key by signing up here.
							</VSCodeLink>
						)}
					</p>
				</div>
			)}

			{selectedProvider === "vscode-lm" && (
				<div>
					<div className="dropdown-container">
						<label htmlFor="vscode-lm-model">
							<span style={{ fontWeight: 500 }}>Language Model</span>
						</label>
						{vsCodeLmModels.length > 0 ? (
							<Dropdown
								id="vscode-lm-model"
								value={
									apiConfiguration?.vsCodeLmModelSelector
										? `${apiConfiguration.vsCodeLmModelSelector.vendor ?? ""}/${apiConfiguration.vsCodeLmModelSelector.family ?? ""}`
										: ""
								}
								onChange={(value: unknown) => {
									const valueStr = (value as DropdownOption)?.value
									if (!valueStr) {
										return
									}
									const [vendor, family] = valueStr.split("/")
									handleInputChange("vsCodeLmModelSelector")({
										target: {
											value: { vendor, family },
										},
									})
								}}
								style={{ width: "100%" }}
								options={[
									{ value: "", label: "Select a model..." },
									...vsCodeLmModels.map((model) => ({
										value: `${model.vendor}/${model.family}`,
										label: `${model.vendor} - ${model.family}`,
									})),
								]}
							/>
						) : (
							<p
								style={{
									fontSize: "12px",
									marginTop: "5px",
									color: "var(--vscode-descriptionForeground)",
								}}>
								The VS Code Language Model API allows you to run models provided by other VS Code
								extensions (including but not limited to GitHub Copilot). The easiest way to get started
								is to install the Copilot and Copilot Chat extensions from the VS Code Marketplace.
							</p>
						)}

						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-errorForeground)",
								fontWeight: 500,
							}}>
							Note: This is a very experimental integration and may not work as expected. Please report
							any issues to the Roo-Code GitHub repository.
						</p>
					</div>
				</div>
			)}

			{selectedProvider === "ollama" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.ollamaBaseUrl || ""}
						style={{ width: "100%" }}
						type="url"
						onInput={handleInputChange("ollamaBaseUrl")}
						placeholder={"Default: http://localhost:11434"}>
						<span style={{ fontWeight: 500 }}>Base URL (optional)</span>
					</VSCodeTextField>
					<VSCodeTextField
						value={apiConfiguration?.ollamaModelId || ""}
						style={{ width: "100%" }}
						onInput={handleInputChange("ollamaModelId")}
						placeholder={"e.g. llama3.1"}>
						<span style={{ fontWeight: 500 }}>Model ID</span>
					</VSCodeTextField>
					{ollamaModels.length > 0 && (
						<VSCodeRadioGroup
							value={
								ollamaModels.includes(apiConfiguration?.ollamaModelId || "")
									? apiConfiguration?.ollamaModelId
									: ""
							}
							onChange={(e) => {
								const value = (e.target as HTMLInputElement)?.value
								// need to check value first since radio group returns empty string sometimes
								if (value) {
									handleInputChange("ollamaModelId")({
										target: { value },
									})
								}
							}}>
							{ollamaModels.map((model) => (
								<VSCodeRadio
									key={model}
									value={model}
									checked={apiConfiguration?.ollamaModelId === model}>
									{model}
								</VSCodeRadio>
							))}
						</VSCodeRadioGroup>
					)}
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						Ollama allows you to run models locally on your computer. For instructions on how to get
						started, see their
						<VSCodeLink
							href="https://github.com/ollama/ollama/blob/main/README.md"
							style={{ display: "inline", fontSize: "inherit" }}>
							quickstart guide.
						</VSCodeLink>
						<span style={{ color: "var(--vscode-errorForeground)" }}>
							(<span style={{ fontWeight: 500 }}>Note:</span> Roo Code uses complex prompts and works best
							with Claude models. Less capable models may not work as expected.)
						</span>
					</p>
				</div>
			)}

			{selectedProvider === "unbound" && (
				<div>
					<VSCodeTextField
						value={apiConfiguration?.unboundApiKey || ""}
						style={{ width: "100%" }}
						type="password"
						onChange={handleInputChange("unboundApiKey")}
						placeholder="Enter API Key...">
						<span style={{ fontWeight: 500 }}>Unbound API Key</span>
					</VSCodeTextField>
					{!apiConfiguration?.unboundApiKey && (
						<VSCodeButtonLink
							href="https://gateway.getunbound.ai"
							style={{ margin: "5px 0 0 0" }}
							appearance="secondary">
							Get Unbound API Key
						</VSCodeButtonLink>
					)}
					<p
						style={{
							fontSize: "12px",
							marginTop: 3,
							color: "var(--vscode-descriptionForeground)",
						}}>
						This key is stored locally and only used to make API requests from this extension.
					</p>
				</div>
			)}

			{apiErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{apiErrorMessage}
				</p>
			)}

			{selectedProvider === "glama" && <GlamaModelPicker />}

			{selectedProvider === "openrouter" && <OpenRouterModelPicker />}

			{selectedProvider !== "glama" &&
				selectedProvider !== "openrouter" &&
				selectedProvider !== "openai" &&
				selectedProvider !== "ollama" &&
				selectedProvider !== "lmstudio" && (
					<>
						<div className="dropdown-container">
							<label htmlFor="model-id">
								<span style={{ fontWeight: 500 }}>Model</span>
							</label>
							{selectedProvider === "anthropic" && createDropdown(anthropicModels)}
							{selectedProvider === "bedrock" && createDropdown(bedrockModels)}
							{selectedProvider === "vertex" && createDropdown(vertexModels)}
							{selectedProvider === "gemini" && createDropdown(geminiModels)}
							{selectedProvider === "openai-native" && createDropdown(openAiNativeModels)}
							{selectedProvider === "deepseek" && createDropdown(deepSeekModels)}
							{selectedProvider === "mistral" && createDropdown(mistralModels)}
							{selectedProvider === "unbound" && createDropdown(unboundModels)}
						</div>

						<ModelInfoView
							selectedModelId={selectedModelId}
							modelInfo={selectedModelInfo}
							isDescriptionExpanded={isDescriptionExpanded}
							setIsDescriptionExpanded={setIsDescriptionExpanded}
						/>
					</>
				)}

			{modelIdErrorMessage && (
				<p
					style={{
						margin: "-10px 0 4px 0",
						fontSize: 12,
						color: "var(--vscode-errorForeground)",
					}}>
					{modelIdErrorMessage}
				</p>
			)}
		</div>
	)
}

export function getGlamaAuthUrl(uriScheme?: string) {
	const callbackUrl = `${uriScheme || "vscode"}://rooveterinaryinc.roo-cline/glama`

	return `https://glama.ai/oauth/authorize?callback_url=${encodeURIComponent(callbackUrl)}`
}

export function getOpenRouterAuthUrl(uriScheme?: string) {
	return `https://openrouter.ai/auth?callback_url=${uriScheme || "vscode"}://rooveterinaryinc.roo-cline/openrouter`
}

export const formatPrice = (price: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(price)
}

export const ModelInfoView = ({
	selectedModelId,
	modelInfo,
	isDescriptionExpanded,
	setIsDescriptionExpanded,
}: {
	selectedModelId: string
	modelInfo: ModelInfo
	isDescriptionExpanded: boolean
	setIsDescriptionExpanded: (isExpanded: boolean) => void
}) => {
	const isGemini = Object.keys(geminiModels).includes(selectedModelId)

	const infoItems = [
		modelInfo.description && (
			<ModelDescriptionMarkdown
				key="description"
				markdown={modelInfo.description}
				isExpanded={isDescriptionExpanded}
				setIsExpanded={setIsDescriptionExpanded}
			/>
		),
		<ModelInfoSupportsItem
			key="supportsImages"
			isSupported={modelInfo.supportsImages ?? false}
			supportsLabel="Supports images"
			doesNotSupportLabel="Does not support images"
		/>,
		<ModelInfoSupportsItem
			key="supportsComputerUse"
			isSupported={modelInfo.supportsComputerUse ?? false}
			supportsLabel="Supports computer use"
			doesNotSupportLabel="Does not support computer use"
		/>,
		!isGemini && (
			<ModelInfoSupportsItem
				key="supportsPromptCache"
				isSupported={modelInfo.supportsPromptCache}
				supportsLabel="Supports prompt caching"
				doesNotSupportLabel="Does not support prompt caching"
			/>
		),
		modelInfo.maxTokens !== undefined && modelInfo.maxTokens > 0 && (
			<span key="maxTokens">
				<span style={{ fontWeight: 500 }}>Max output:</span> {modelInfo.maxTokens?.toLocaleString()} tokens
			</span>
		),
		modelInfo.inputPrice !== undefined && modelInfo.inputPrice > 0 && (
			<span key="inputPrice">
				<span style={{ fontWeight: 500 }}>Input price:</span> {formatPrice(modelInfo.inputPrice)}/million tokens
			</span>
		),
		modelInfo.supportsPromptCache && modelInfo.cacheWritesPrice && (
			<span key="cacheWritesPrice">
				<span style={{ fontWeight: 500 }}>Cache writes price:</span>{" "}
				{formatPrice(modelInfo.cacheWritesPrice || 0)}/million tokens
			</span>
		),
		modelInfo.supportsPromptCache && modelInfo.cacheReadsPrice && (
			<span key="cacheReadsPrice">
				<span style={{ fontWeight: 500 }}>Cache reads price:</span>{" "}
				{formatPrice(modelInfo.cacheReadsPrice || 0)}/million tokens
			</span>
		),
		modelInfo.outputPrice !== undefined && modelInfo.outputPrice > 0 && (
			<span key="outputPrice">
				<span style={{ fontWeight: 500 }}>Output price:</span> {formatPrice(modelInfo.outputPrice)}/million
				tokens
			</span>
		),
		isGemini && (
			<span key="geminiInfo" style={{ fontStyle: "italic" }}>
				* Free up to {selectedModelId && selectedModelId.includes("flash") ? "15" : "2"} requests per minute.
				After that, billing depends on prompt size.{" "}
				<VSCodeLink href="https://ai.google.dev/pricing" style={{ display: "inline", fontSize: "inherit" }}>
					For more info, see pricing details.
				</VSCodeLink>
			</span>
		),
	].filter(Boolean)

	return (
		<p style={{ fontSize: "12px", marginTop: "2px", color: "var(--vscode-descriptionForeground)" }}>
			{infoItems.map((item, index) => (
				<Fragment key={index}>
					{item}
					{index < infoItems.length - 1 && <br />}
				</Fragment>
			))}
		</p>
	)
}

const ModelInfoSupportsItem = ({
	isSupported,
	supportsLabel,
	doesNotSupportLabel,
}: {
	isSupported: boolean
	supportsLabel: string
	doesNotSupportLabel: string
}) => (
	<span
		style={{
			fontWeight: 500,
			color: isSupported ? "var(--vscode-charts-green)" : "var(--vscode-errorForeground)",
		}}>
		<i
			className={`codicon codicon-${isSupported ? "check" : "x"}`}
			style={{
				marginRight: 4,
				marginBottom: isSupported ? 1 : -1,
				fontSize: isSupported ? 11 : 13,
				fontWeight: 700,
				display: "inline-block",
				verticalAlign: "bottom",
			}}></i>
		{isSupported ? supportsLabel : doesNotSupportLabel}
	</span>
)

export function normalizeApiConfiguration(apiConfiguration?: ApiConfiguration) {
	const provider = apiConfiguration?.apiProvider || "anthropic"
	const modelId = apiConfiguration?.apiModelId

	const getProviderData = (models: Record<string, ModelInfo>, defaultId: string) => {
		let selectedModelId: string
		let selectedModelInfo: ModelInfo
		if (modelId && modelId in models) {
			selectedModelId = modelId
			selectedModelInfo = models[modelId]
		} else {
			selectedModelId = defaultId
			selectedModelInfo = models[defaultId]
		}
		return { selectedProvider: provider, selectedModelId, selectedModelInfo }
	}
	switch (provider) {
		case "anthropic":
			return getProviderData(anthropicModels, anthropicDefaultModelId)
		case "bedrock":
			return getProviderData(bedrockModels, bedrockDefaultModelId)
		case "vertex":
			return getProviderData(vertexModels, vertexDefaultModelId)
		case "gemini":
			return getProviderData(geminiModels, geminiDefaultModelId)
		case "deepseek":
			return getProviderData(deepSeekModels, deepSeekDefaultModelId)
		case "openai-native":
			return getProviderData(openAiNativeModels, openAiNativeDefaultModelId)
		case "glama":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.glamaModelId || glamaDefaultModelId,
				selectedModelInfo: apiConfiguration?.glamaModelInfo || glamaDefaultModelInfo,
			}
		case "mistral":
			return getProviderData(mistralModels, mistralDefaultModelId)
		case "openrouter":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openRouterModelId || openRouterDefaultModelId,
				selectedModelInfo: apiConfiguration?.openRouterModelInfo || openRouterDefaultModelInfo,
			}
		case "openai":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.openAiModelId || "",
				selectedModelInfo: apiConfiguration?.openAiCustomModelInfo || openAiModelInfoSaneDefaults,
			}
		case "ollama":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.ollamaModelId || "",
				selectedModelInfo: openAiModelInfoSaneDefaults,
			}
		case "lmstudio":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.lmStudioModelId || "",
				selectedModelInfo: openAiModelInfoSaneDefaults,
			}
		case "vscode-lm":
			return {
				selectedProvider: provider,
				selectedModelId: apiConfiguration?.vsCodeLmModelSelector
					? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
					: "",
				selectedModelInfo: {
					...openAiModelInfoSaneDefaults,
					supportsImages: false, // VSCode LM API currently doesn't support images
				},
			}
		case "unbound":
			return getProviderData(unboundModels, unboundDefaultModelId)
		default:
			return getProviderData(anthropicModels, anthropicDefaultModelId)
	}
}

export default memo(ApiOptions)
