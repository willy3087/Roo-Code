import { useAppTranslation } from "@/i18n/TranslationContext"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"

import { ApiConfiguration } from "../../../../src/shared/api"
import { reasoningEfforts, ReasoningEffort as ReasoningEffortType } from "../../../../src/schemas"

interface ReasoningEffortProps {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
}

export const ReasoningEffort = ({ apiConfiguration, setApiConfigurationField }: ReasoningEffortProps) => {
	const { t } = useAppTranslation()

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between items-center">
				<label className="block font-medium mb-1">{t("settings:providers.reasoningEffort.label")}</label>
			</div>
			<Select
				value={apiConfiguration.reasoningEffort}
				onValueChange={(value) => setApiConfigurationField("reasoningEffort", value as ReasoningEffortType)}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder={t("settings:common.select")} />
				</SelectTrigger>
				<SelectContent>
					{reasoningEfforts.map((value) => (
						<SelectItem key={value} value={value}>
							{t(`settings:providers.reasoningEffort.${value}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
