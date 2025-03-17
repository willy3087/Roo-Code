import { VSCodeButton, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { memo, useEffect, useRef, useState } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ApiConfigMeta } from "../../../../src/shared/ExtensionMessage"
import { Dropdown } from "vscrui"
import type { DropdownOption } from "vscrui"
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog"
import { Button, Input } from "../ui"

interface ApiConfigManagerProps {
	currentApiConfigName?: string
	listApiConfigMeta?: ApiConfigMeta[]
	onSelectConfig: (configName: string) => void
	onDeleteConfig: (configName: string) => void
	onRenameConfig: (oldName: string, newName: string) => void
	onUpsertConfig: (configName: string) => void
}

const ApiConfigManager = ({
	currentApiConfigName = "",
	listApiConfigMeta = [],
	onSelectConfig,
	onDeleteConfig,
	onRenameConfig,
	onUpsertConfig,
}: ApiConfigManagerProps) => {
	const { t } = useAppTranslation()
	const [isRenaming, setIsRenaming] = useState(false)
	const [isCreating, setIsCreating] = useState(false)
	const [inputValue, setInputValue] = useState("")
	const [newProfileName, setNewProfileName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const inputRef = useRef<any>(null)
	const newProfileInputRef = useRef<any>(null)

	const validateName = (name: string, isNewProfile: boolean): string | null => {
		const trimmed = name.trim()
		if (!trimmed) return t("settings:providers.nameEmpty")

		const nameExists = listApiConfigMeta?.some((config) => config.name.toLowerCase() === trimmed.toLowerCase())

		// For new profiles, any existing name is invalid
		if (isNewProfile && nameExists) {
			return t("settings:providers.nameExists")
		}

		// For rename, only block if trying to rename to a different existing profile
		if (!isNewProfile && nameExists && trimmed.toLowerCase() !== currentApiConfigName?.toLowerCase()) {
			return t("settings:providers.nameExists")
		}

		return null
	}

	const resetCreateState = () => {
		setIsCreating(false)
		setNewProfileName("")
		setError(null)
	}

	const resetRenameState = () => {
		setIsRenaming(false)
		setInputValue("")
		setError(null)
	}

	// Focus input when entering rename mode
	useEffect(() => {
		if (isRenaming) {
			const timeoutId = setTimeout(() => inputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isRenaming])

	// Focus input when opening new dialog
	useEffect(() => {
		if (isCreating) {
			const timeoutId = setTimeout(() => newProfileInputRef.current?.focus(), 0)
			return () => clearTimeout(timeoutId)
		}
	}, [isCreating])

	// Reset state when current profile changes
	useEffect(() => {
		resetCreateState()
		resetRenameState()
	}, [currentApiConfigName])

	const handleAdd = () => {
		resetCreateState()
		setIsCreating(true)
	}

	const handleStartRename = () => {
		setIsRenaming(true)
		setInputValue(currentApiConfigName || "")
		setError(null)
	}

	const handleCancel = () => {
		resetRenameState()
	}

	const handleSave = () => {
		const trimmedValue = inputValue.trim()
		const error = validateName(trimmedValue, false)

		if (error) {
			setError(error)
			return
		}

		if (isRenaming && currentApiConfigName) {
			if (currentApiConfigName === trimmedValue) {
				resetRenameState()
				return
			}
			onRenameConfig(currentApiConfigName, trimmedValue)
		}

		resetRenameState()
	}

	const handleNewProfileSave = () => {
		const trimmedValue = newProfileName.trim()
		const error = validateName(trimmedValue, true)

		if (error) {
			setError(error)
			return
		}

		onUpsertConfig(trimmedValue)
		resetCreateState()
	}

	const handleDelete = () => {
		if (!currentApiConfigName || !listApiConfigMeta || listApiConfigMeta.length <= 1) return

		// Let the extension handle both deletion and selection
		onDeleteConfig(currentApiConfigName)
	}

	const isOnlyProfile = listApiConfigMeta?.length === 1

	return (
		<div className="flex flex-col gap-1">
			<label htmlFor="config-profile">
				<span className="font-medium">{t("settings:providers.configProfile")}</span>
			</label>

			{isRenaming ? (
				<div
					data-testid="rename-form"
					style={{ display: "flex", gap: "4px", alignItems: "center", flexDirection: "column" }}>
					<div style={{ display: "flex", gap: "4px", alignItems: "center", width: "100%" }}>
						<VSCodeTextField
							ref={inputRef}
							value={inputValue}
							onInput={(e: unknown) => {
								const target = e as { target: { value: string } }
								setInputValue(target.target.value)
								setError(null)
							}}
							placeholder={t("settings:providers.enterNewName")}
							style={{ flexGrow: 1 }}
							onKeyDown={(e: unknown) => {
								const event = e as { key: string }
								if (event.key === "Enter" && inputValue.trim()) {
									handleSave()
								} else if (event.key === "Escape") {
									handleCancel()
								}
							}}
						/>
						<VSCodeButton
							appearance="icon"
							disabled={!inputValue.trim()}
							onClick={handleSave}
							title={t("settings:common.save")}
							data-testid="save-rename-button"
							style={{
								padding: 0,
								margin: 0,
								height: "28px",
								width: "28px",
								minWidth: "28px",
							}}>
							<span className="codicon codicon-check" />
						</VSCodeButton>
						<VSCodeButton
							appearance="icon"
							onClick={handleCancel}
							title={t("settings:common.cancel")}
							data-testid="cancel-rename-button"
							style={{
								padding: 0,
								margin: 0,
								height: "28px",
								width: "28px",
								minWidth: "28px",
							}}>
							<span className="codicon codicon-close" />
						</VSCodeButton>
					</div>
					{error && (
						<p className="text-red-500 text-sm mt-2" data-testid="error-message">
							{error}
						</p>
					)}
				</div>
			) : (
				<>
					<div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
						<Dropdown
							id="config-profile"
							value={currentApiConfigName}
							onChange={(value: unknown) => {
								onSelectConfig((value as DropdownOption).value)
							}}
							role="combobox"
							options={listApiConfigMeta.map((config) => ({
								value: config.name,
								label: config.name,
							}))}
							className="w-full"
						/>
						<VSCodeButton
							appearance="icon"
							onClick={handleAdd}
							title={t("settings:providers.addProfile")}
							data-testid="add-profile-button"
							style={{
								padding: 0,
								margin: 0,
								height: "28px",
								width: "28px",
								minWidth: "28px",
							}}>
							<span className="codicon codicon-add" />
						</VSCodeButton>
						{currentApiConfigName && (
							<>
								<VSCodeButton
									appearance="icon"
									onClick={handleStartRename}
									title={t("settings:providers.renameProfile")}
									data-testid="rename-profile-button"
									style={{
										padding: 0,
										margin: 0,
										height: "28px",
										width: "28px",
										minWidth: "28px",
									}}>
									<span className="codicon codicon-edit" />
								</VSCodeButton>
								<VSCodeButton
									appearance="icon"
									onClick={handleDelete}
									title={
										isOnlyProfile
											? t("settings:providers.cannotDeleteOnlyProfile")
											: t("settings:providers.deleteProfile")
									}
									data-testid="delete-profile-button"
									disabled={isOnlyProfile}
									style={{
										padding: 0,
										margin: 0,
										height: "28px",
										width: "28px",
										minWidth: "28px",
									}}>
									<span className="codicon codicon-trash" />
								</VSCodeButton>
							</>
						)}
					</div>
					<p
						style={{
							fontSize: "12px",
							margin: "5px 0 12px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						{t("settings:providers.description")}
					</p>
				</>
			)}

			<Dialog
				open={isCreating}
				onOpenChange={(open: boolean) => {
					if (open) {
						setIsCreating(true)
						setNewProfileName("")
						setError(null)
					} else {
						resetCreateState()
					}
				}}
				aria-labelledby="new-profile-title">
				<DialogContent className="p-4 max-w-sm">
					<DialogTitle>{t("settings:providers.newProfile")}</DialogTitle>
					<Input
						ref={newProfileInputRef}
						value={newProfileName}
						onInput={(e: unknown) => {
							const target = e as { target: { value: string } }
							setNewProfileName(target.target.value)
							setError(null)
						}}
						placeholder={t("settings:providers.enterProfileName")}
						data-testid="new-profile-input"
						style={{ width: "100%" }}
						onKeyDown={(e: unknown) => {
							const event = e as { key: string }
							if (event.key === "Enter" && newProfileName.trim()) {
								handleNewProfileSave()
							} else if (event.key === "Escape") {
								resetCreateState()
							}
						}}
					/>
					{error && (
						<p className="text-red-500 text-sm mt-2" data-testid="error-message">
							{error}
						</p>
					)}
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="secondary" onClick={resetCreateState} data-testid="cancel-new-profile-button">
							{t("settings:common.cancel")}
						</Button>
						<Button
							variant="default"
							disabled={!newProfileName.trim()}
							onClick={handleNewProfileSave}
							data-testid="create-profile-button">
							{t("settings:providers.createProfile")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default memo(ApiConfigManager)
