import { useAppTranslation } from "@/i18n/TranslationContext"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui"

import { ApiConfiguration, ModelInfo } from "../../../../src/shared/api"

export const EFFORTS = ["high", "medium", "low"] as const

interface ReasoningEffortProps {
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
	modelInfo: ModelInfo
}

export const ReasoningEffort = ({ setApiConfigurationField, modelInfo }: ReasoningEffortProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">Model Reasoning Effort</label>
			</div>
			<Select
				value={modelInfo.reasoningEffort}
				onValueChange={(value) =>
					setApiConfigurationField("openRouterModelInfo", {
						...modelInfo,
						reasoningEffort: value as "high" | "medium" | "low",
					})
				}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="openrouter">OpenRouter</SelectItem>
					<SelectSeparator />
					{EFFORTS.map((value) => (
						<SelectItem key={value} value={value}>
							{value}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
