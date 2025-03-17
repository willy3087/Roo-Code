import React, { memo, useState } from "react"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import prettyBytes from "pretty-bytes"
import { Virtuoso } from "react-virtuoso"
import { VSCodeButton, VSCodeTextField, VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"
import { formatLargeNumber, formatDate } from "@/utils/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { Tab, TabContent, TabHeader } from "../common/Tab"
import { useTaskSearch } from "./useTaskSearch"
import { ExportButton } from "./ExportButton"
import { CopyButton } from "./CopyButton"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const { tasks, searchQuery, setSearchQuery, sortOption, setSortOption, setLastNonRelevantSort } = useTaskSearch()
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-2">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
					<VSCodeButton onClick={onDone}>{t("history:done")}</VSCodeButton>
				</div>
				<div className="flex flex-col gap-2">
					<VSCodeTextField
						style={{ width: "100%" }}
						placeholder={t("history:searchPlaceholder")}
						value={searchQuery}
						data-testid="history-search-input"
						onInput={(e) => {
							const newValue = (e.target as HTMLInputElement)?.value
							setSearchQuery(newValue)
							if (newValue && !searchQuery && sortOption !== "mostRelevant") {
								setLastNonRelevantSort(sortOption)
								setSortOption("mostRelevant")
							}
						}}>
						<div
							slot="start"
							className="codicon codicon-search"
							style={{ fontSize: 13, marginTop: 2.5, opacity: 0.8 }}
						/>
						{searchQuery && (
							<div
								className="input-icon-button codicon codicon-close"
								aria-label="Clear search"
								onClick={() => setSearchQuery("")}
								slot="end"
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									height: "100%",
								}}
							/>
						)}
					</VSCodeTextField>
					<VSCodeRadioGroup
						style={{ display: "flex", flexWrap: "wrap" }}
						value={sortOption}
						role="radiogroup"
						onChange={(e) => setSortOption((e.target as HTMLInputElement).value as SortOption)}>
						<VSCodeRadio value="newest" data-testid="radio-newest">
							{t("history:newest")}
						</VSCodeRadio>
						<VSCodeRadio value="oldest" data-testid="radio-oldest">
							{t("history:oldest")}
						</VSCodeRadio>
						<VSCodeRadio value="mostExpensive" data-testid="radio-most-expensive">
							{t("history:mostExpensive")}
						</VSCodeRadio>
						<VSCodeRadio value="mostTokens" data-testid="radio-most-tokens">
							{t("history:mostTokens")}
						</VSCodeRadio>
						<VSCodeRadio
							value="mostRelevant"
							disabled={!searchQuery}
							data-testid="radio-most-relevant"
							style={{ opacity: searchQuery ? 1 : 0.5 }}>
							{t("history:mostRelevant")}
						</VSCodeRadio>
					</VSCodeRadioGroup>
				</div>
			</TabHeader>

			<TabContent className="p-0">
				<Virtuoso
					style={{
						flexGrow: 1,
						overflowY: "scroll",
					}}
					data={tasks}
					data-testid="virtuoso-container"
					initialTopMostItemIndex={0}
					components={{
						List: React.forwardRef((props, ref) => (
							<div {...props} ref={ref} data-testid="virtuoso-item-list" />
						)),
					}}
					itemContent={(index, item) => (
						<div
							data-testid={`ta***REMOVED***item-${item.id}`}
							key={item.id}
							className={cn("cursor-pointer", {
								"border-b border-vscode-panel-border": index < tasks.length - 1,
							})}
							onClick={() => vscode.postMessage({ type: "showTaskWithId", text: item.id })}>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "8px",
									padding: "12px 20px",
									position: "relative",
								}}>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}>
									<span
										style={{
											color: "var(--vscode-descriptionForeground)",
											fontWeight: 500,
											fontSize: "0.85em",
											textTransform: "uppercase",
										}}>
										{formatDate(item.ts)}
									</span>
									<div className="flex flex-row">
										<Button
											variant="ghost"
											size="sm"
											title={t("history:deleteTaskTitle")}
											data-testid="delete-ta***REMOVED***button"
											onClick={(e) => {
												e.stopPropagation()

												if (e.shiftKey) {
													vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
												} else {
													setDeleteTaskId(item.id)
												}
											}}>
											<span className="codicon codicon-trash" />
											{item.size && prettyBytes(item.size)}
										</Button>
									</div>
								</div>
								<div
									style={{
										fontSize: "var(--vscode-font-size)",
										color: "var(--vscode-foreground)",
										display: "-webkit-box",
										WebkitLineClamp: 3,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										overflowWrap: "anywhere",
									}}
									data-testid="ta***REMOVED***content"
									dangerouslySetInnerHTML={{ __html: item.task }}
								/>
								<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
									<div
										data-testid="tokens-container"
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										}}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "4px",
												flexWrap: "wrap",
											}}>
											<span
												style={{
													fontWeight: 500,
													color: "var(--vscode-descriptionForeground)",
												}}>
												{t("history:tokensLabel")}
											</span>
											<span
												data-testid="tokens-in"
												style={{
													display: "flex",
													alignItems: "center",
													gap: "3px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												<i
													className="codicon codicon-arrow-up"
													style={{
														fontSize: "12px",
														fontWeight: "bold",
														marginBottom: "-2px",
													}}
												/>
												{formatLargeNumber(item.tokensIn || 0)}
											</span>
											<span
												data-testid="tokens-out"
												style={{
													display: "flex",
													alignItems: "center",
													gap: "3px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												<i
													className="codicon codicon-arrow-down"
													style={{
														fontSize: "12px",
														fontWeight: "bold",
														marginBottom: "-2px",
													}}
												/>
												{formatLargeNumber(item.tokensOut || 0)}
											</span>
										</div>
										{!item.totalCost && (
											<div className="flex flex-row gap-1">
												<CopyButton itemTask={item.task} />
												<ExportButton itemId={item.id} />
											</div>
										)}
									</div>

									{!!item.cacheWrites && (
										<div
											data-testid="cache-container"
											style={{
												display: "flex",
												alignItems: "center",
												gap: "4px",
												flexWrap: "wrap",
											}}>
											<span
												style={{
													fontWeight: 500,
													color: "var(--vscode-descriptionForeground)",
												}}>
												{t("history:cacheLabel")}
											</span>
											<span
												data-testid="cache-writes"
												style={{
													display: "flex",
													alignItems: "center",
													gap: "3px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												<i
													className="codicon codicon-database"
													style={{
														fontSize: "12px",
														fontWeight: "bold",
														marginBottom: "-1px",
													}}
												/>
												+{formatLargeNumber(item.cacheWrites || 0)}
											</span>
											<span
												data-testid="cache-reads"
												style={{
													display: "flex",
													alignItems: "center",
													gap: "3px",
													color: "var(--vscode-descriptionForeground)",
												}}>
												<i
													className="codicon codicon-arrow-right"
													style={{
														fontSize: "12px",
														fontWeight: "bold",
														marginBottom: 0,
													}}
												/>
												{formatLargeNumber(item.cacheReads || 0)}
											</span>
										</div>
									)}

									{!!item.totalCost && (
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												marginTop: -2,
											}}>
											<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
												<span
													style={{
														fontWeight: 500,
														color: "var(--vscode-descriptionForeground)",
													}}>
													{t("history:apiCostLabel")}
												</span>
												<span style={{ color: "var(--vscode-descriptionForeground)" }}>
													${item.totalCost?.toFixed(4)}
												</span>
											</div>
											<div className="flex flex-row gap-1">
												<CopyButton itemTask={item.task} />
												<ExportButton itemId={item.id} />
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				/>
			</TabContent>

			{deleteTaskId && (
				<DeleteTaskDialog taskId={deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)} open />
			)}
		</Tab>
	)
}

export default memo(HistoryView)
