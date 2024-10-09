import React, { useMemo, useState, useRef, useEffect, memo } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import styled from "styled-components"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { useMount } from "react-use"
import { vscode } from "../../utils/vscode"
import { ModelInfoView, normalizeApiConfiguration } from "./ApiOptions"
import { useRemark } from "react-remark"

const OpenRouterModelPicker: React.FC = () => {
	const { apiConfiguration, setApiConfiguration, openRouterModels } = useExtensionState()
	const [searchTerm, setSearchTerm] = useState("")
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		setApiConfiguration({
			...apiConfiguration,
			openRouterModelId: newModelId,
			openRouterModelInfo: openRouterModels[newModelId],
		})
		setSearchTerm(newModelId)
		setIsDropdownVisible(false)
	}

	const { selectedModelId, selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	useMount(() => {
		vscode.postMessage({ type: "refreshOpenRouterModels" })
	})

	const filteredModelIds = useMemo(() => {
		return Object.keys(openRouterModels)
			.filter((modelId) => modelId.toLowerCase().includes(searchTerm.toLowerCase()))
			.sort((a, b) => a.localeCompare(b))
	}, [openRouterModels, searchTerm])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	return (
		<>
			<DropdownWrapper ref={dropdownRef}>
				<label htmlFor="model-search">
					<span style={{ fontWeight: 500 }}>Model</span>
				</label>
				<VSCodeTextField
					id="model-search"
					placeholder="Search and select a model..."
					value={searchTerm}
					onChange={(e) => {
						setSearchTerm((e.target as HTMLInputElement).value)
						setIsDropdownVisible(true)
					}}
					onFocus={() => setIsDropdownVisible(true)}
					style={{ width: "100%", zIndex: 1001 }}
				/>
				{isDropdownVisible && (
					<DropdownList>
						{filteredModelIds.map((modelId) => (
							<DropdownItem key={modelId} onClick={() => handleModelChange(modelId)}>
								{modelId}
							</DropdownItem>
						))}
					</DropdownList>
				)}
			</DropdownWrapper>

			<ModelInfoView selectedModelId={selectedModelId} modelInfo={selectedModelInfo} />
		</>
	)
}

export default OpenRouterModelPicker

// Dropdown

const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: 1000;
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const DropdownItem = styled.div`
	padding: 5px 10px;
	cursor: pointer;
	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

// Markdown

const StyledMarkdown = styled.div`
	font-family: var(--vscode-font-family), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
		Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
	font-size: 12px;
	color: var(--vscode-descriptionForeground);

	p,
	li,
	ol,
	ul {
		line-height: 1.25;
		margin: 0;
	}

	ol,
	ul {
		padding-left: 1.5em;
		margin-left: 0;
	}

	p {
		white-space: pre-wrap;
	}
`

export const ModelDescriptionMarkdown = memo(({ markdown, key }: { markdown?: string; key: string }) => {
	const [reactContent, setMarkdown] = useRemark()

	useEffect(() => {
		setMarkdown(markdown || "")
	}, [markdown, setMarkdown])

	return (
		<StyledMarkdown key={key} style={{ display: "inline-block", marginBottom: 5 }}>
			{reactContent}
		</StyledMarkdown>
	)
})
