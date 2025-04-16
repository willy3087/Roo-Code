import fs from "fs/promises" // Módulo para operações assíncronas de sistema de arquivos
import * as path from "path" // Utilitário para manipulação de caminhos de arquivos
import os from "os" // Utilitários relacionados ao sistema operacional
import crypto from "crypto" // Funcionalidades criptográficas para geração de IDs
import EventEmitter from "events" // Sistema de eventos para comunicação entre componentes

import { Anthropic } from "@anthropic-ai/sdk" // SDK oficial da Anthropic para interação com modelos Claude
import cloneDeep from "clone-deep" // Utilitário para clonar objetos profundamente
import delay from "delay" // Função para criar atrasos controlados
import pWaitFor from "p-wait-for" // Utilitário para esperar por condições assíncronas
import getFolderSize from "get-folder-size" // Ferramenta para calcular tamanho de diretórios
import { serializeError } from "serialize-error" // Converte objetos de erro em formato serializável
import * as vscode from "vscode" // API do VS Code para integração com o editor

import { TokenUsage } from "../schemas" // Esquema para rastreamento de uso de tokens
import { ApiHandler, buildApiHandler } from "../api" // Gerenciador de comunicação com APIs de IA
import { ApiStream } from "../api/transform/stream" // Processamento de streams de resposta da API
import { DIFF_VIEW_URI_SCHEME, DiffViewProvider } from "../integrations/editor/DiffViewProvider" // Visualização de diferenças de código
import {
	CheckpointServiceOptions,
	RepoPerTaskCheckpointService,
	RepoPerWorkspaceCheckpointService,
} from "../services/checkpoints" // Serviços para gerenciamento de checkpoints de código
import { findToolName, formatContentBlockToMarkdown } from "../integrations/misc/export-markdown" // Utilitários para exportação de conteúdo
import { fetchInstructionsTool } from "./tools/fetchInstructionsTool" // Ferramenta para buscar instruções personalizadas
import { listFilesTool } from "./tools/listFilesTool" // Ferramenta para listar arquivos no workspace
import { readFileTool } from "./tools/readFileTool" // Ferramenta para ler conteúdo de arquivos
import { ExitCodeDetails } from "../integrations/terminal/TerminalProcess" // Detalhes de códigos de saída do terminal
import { Terminal } from "../integrations/terminal/Terminal" // Abstração para interação com terminal
import { TerminalRegistry } from "../integrations/terminal/TerminalRegistry" // Registro de terminais disponíveis
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher" // Serviço para buscar conteúdo de URLs
import { listFiles } from "../services/glob/list-files" // Utilitário para listar arquivos com padrões glob
import { CheckpointStorage } from "../shared/checkpoints" // Armazenamento de checkpoints de código
import { ApiConfiguration } from "../shared/api" // Configurações para comunicação com APIs
import { findLastIndex } from "../shared/array" // Utilitário para arrays
import { combineApiRequests } from "../shared/combineApiRequests" // Combinação de requisições de API para métricas
import { combineCommandSequences } from "../shared/combineCommandSequences" // Combinação de sequências de comandos
import { TokenUsage } from "../schemas"
import { ApiHandler, buildApiHandler } from "../api"
import { ApiStream } from "../api/transform/stream"
import { DIFF_VIEW_URI_SCHEME, DiffViewProvider } from "../integrations/editor/DiffViewProvider"
import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../services/checkpoints"
import { findToolName, formatContentBlockToMarkdown } from "../integrations/misc/export-markdown"
import { fetchInstructionsTool } from "./tools/fetchInstructionsTool"
import { listFilesTool } from "./tools/listFilesTool"
import { readFileTool } from "./tools/readFileTool"
import { ExitCodeDetails, TerminalProcess } from "../integrations/terminal/TerminalProcess"
import { Terminal } from "../integrations/terminal/Terminal"
import { TerminalRegistry } from "../integrations/terminal/TerminalRegistry"
import { UrlContentFetcher } from "../services/browser/UrlContentFetcher"
import { listFiles } from "../services/glob/list-files"
import { ApiConfiguration } from "../shared/api"
import { findLastIndex } from "../shared/array"
import { combineApiRequests } from "../shared/combineApiRequests"
import { combineCommandSequences } from "../shared/combineCommandSequences"
import {
	ClineApiReqCancelReason,
	ClineApiReqInfo,
	ClineAsk,
	ClineMessage,
	ClineSay,
	ToolProgressStatus,
} from "../shared/ExtensionMessage" // Tipos de mensagens trocadas na extensão
import { getApiMetrics } from "../shared/getApiMetrics" // Cálculo de métricas de uso da API
import { HistoryItem } from "../shared/HistoryItem" // Representação de itens do histórico de conversas
import { ClineAskResponse } from "../shared/WebviewMessage" // Tipos de mensagens da webview
import { GlobalFileNames } from "../shared/globalFileNames" // Nomes de arquivos globais usados pela extensão
import { defaultModeSlug, getModeBySlug, getFullModeDetails } from "../shared/modes" // Gerenciamento de modos de operação
import { EXPERIMENT_IDS, experiments as Experiments, ExperimentId } from "../shared/experiments" // Sistema de experimentos
import { calculateApiCostAnthropic } from "../utils/cost" // Cálculo de custos de API
import { fileExistsAtPath } from "../utils/fs" // Verificação de existência de arquivos
import { arePathsEqual } from "../utils/path" // Comparação de caminhos de arquivos
import { parseMentions } from "./mentions" // Processamento de menções em mensagens
import { FileContextTracker } from "./context-tracking/FileContextTracker" // Rastreamento de contexto de arquivos
import { RooIgnoreController } from "./ignore/RooIgnoreController" // Controle de arquivos ignorados
import { AssistantMessageContent, parseAssistantMessage, ToolParamName, ToolUseName } from "./assistant-message" // Processamento de mensagens do assistente
import { formatResponse } from "./prompts/responses" // Formatação de respostas
import { SYSTEM_PROMPT } from "./prompts/system" // Prompt de sistema para o modelo
import { truncateConversationIfNeeded } from "./sliding-window" // Gerenciamento de janela deslizante para conversas longas
import { ClineProvider } from "./webview/ClineProvider" // Provedor da interface webview
import { BrowserSession } from "../services/browser/BrowserSession" // Sessão de navegador para acesso web
import { formatLanguage } from "../shared/language" // Formatação de linguagem para exibição
import { McpHub } from "../services/mcp/McpHub" // Hub para Model Control Protocol
import { DiffStrategy, getDiffStrategy } from "./diff/DiffStrategy" // Estratégias para cálculo de diferenças
import { telemetryService } from "../services/telemetry/TelemetryService" // Serviço de telemetria
import { validateToolUse, isToolAllowedForMode, ToolName } from "./mode-validator" // Validação de ferramentas por modo
import { getWorkspacePath } from "../utils/path" // Obtenção do caminho do workspace
import { writeToFileTool } from "./tools/writeToFileTool" // Ferramenta para escrever em arquivos
import { applyDiffTool } from "./tools/applyDiffTool" // Ferramenta para aplicar diferenças de código
import { insertContentTool } from "./tools/insertContentTool" // Ferramenta para inserir conteúdo em arquivos
import { searchAndReplaceTool } from "./tools/searchAndReplaceTool" // Ferramenta para busca e substituição
import { listCodeDefinitionNamesTool } from "./tools/listCodeDefinitionNamesTool" // Ferramenta para listar definições de código
import { searchFilesTool } from "./tools/searchFilesTool" // Ferramenta para buscar em arquivos
import { browserActionTool } from "./tools/browserActionTool" // Ferramenta para ações de navegador
import { executeCommandTool } from "./tools/executeCommandTool" // Ferramenta para executar comandos
import { useMcpToolTool } from "./tools/useMcpToolTool" // Ferramenta para usar ferramentas MCP
import { accessMcpResourceTool } from "./tools/accessMcpResourceTool" // Ferramenta para acessar recursos MCP
import { askFollowupQuestionTool } from "./tools/askFollowupQuestionTool" // Ferramenta para perguntas de acompanhamento
import { switchModeTool } from "./tools/switchModeTool" // Ferramenta para alternar entre modos
import { attemptCompletionTool } from "./tools/attemptCompletionTool" // Ferramenta para tentativas de completar código
import { newTaskTool } from "./tools/newTaskTool" // Ferramenta para criar novas tarefas

/**
 * Tipo que representa a resposta de uma ferramenta, podendo ser uma string simples
 * ou um array de blocos de texto/imagem compatíveis com a API Anthropic.
 */
export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

/**
 * Tipo que representa o conteúdo enviado pelo usuário, consistindo em um array
 * de blocos de conteúdo (texto, imagens, etc.) compatíveis com a API Anthropic.
 */
type UserContent = Array<Anthropic.Messages.ContentBlockParam>

/**
 * Eventos emitidos pela classe Cline durante seu ciclo de vida.
 * Cada evento pode ter parâmetros associados que são passados aos ouvintes.
 */
export type ClineEvents = {
	/** Emitido quando uma mensagem é criada ou atualizada */
	message: [{ action: "created" | "updated"; message: ClineMessage }]
	/** Emitido quando uma tarefa é iniciada */
	taskStarted: []
	/** Emitido quando o modo da tarefa é alterado */
	taskModeSwitched: [taskId: string, mode: string]
	/** Emitido quando uma tarefa é pausada */
	taskPaused: []
	/** Emitido quando uma tarefa é retomada após pausa */
	taskUnpaused: []
	/** Emitido quando uma pergunta recebe resposta */
	taskAskResponded: []
	/** Emitido quando uma tarefa é abortada */
	taskAborted: []
	/** Emitido quando uma nova tarefa é criada a partir desta */
	taskSpawned: [taskId: string]
	/** Emitido quando uma tarefa é concluída, incluindo estatísticas de uso de tokens */
	taskCompleted: [taskId: string, usage: TokenUsage]
	/** Emitido quando o uso de tokens de uma tarefa é atualizado */
	taskTokenUsageUpdated: [taskId: string, usage: TokenUsage]
}

/**
 * Opções de configuração para criar uma nova instância de Cline.
 * Define o comportamento e estado inicial da instância.
 */
export type ClineOptions = {
	/** Provedor que gerencia a interface do webview */
	provider: ClineProvider
	/** Configuração da API para comunicação com o modelo de IA */
	apiConfiguration: ApiConfiguration
	/** Instruções personalizadas para o modelo de IA */
	customInstructions?: string
	/** Habilita o cálculo de diferenças entre versões de código */
	enableDiff?: boolean
	/** Habilita o sistema de checkpoints para salvar estados da tarefa */
	enableCheckpoints?: boolean
	/** Armazenamento para os checkpoints */
	checkpointStorage?: CheckpointStorage
	/** Limiar para correspondência aproximada em comparações de texto */
	fuzzyMatchThreshold?: number
	/** Limite de erros consecutivos antes de abortar a tarefa */
	consecutiveMistakeLimit?: number
	/** Descrição da tarefa a ser executada */
	task?: string
	/** Imagens a serem incluídas na tarefa inicial */
	images?: string[]
	/** Item de histórico para restaurar uma conversa anterior */
	historyItem?: HistoryItem
	/** Configuração de experimentos ativos */
	experiments?: Record<string, boolean>
	/** Indica se a tarefa deve ser iniciada automaticamente */
	startTask?: boolean
	/** Referência para a tarefa raiz (em caso de subtarefas) */
	rootTask?: Cline
	/** Referência para a tarefa pai (em caso de subtarefas) */
	parentTask?: Cline
	/** Número da tarefa na sequência */
	taskNumber?: number
	/** Callback executado quando a instância é criada */
	onCreated?: (cline: Cline) => void
}

/**
 * Classe principal que gerencia a execução de tarefas e interação com o modelo de IA.
 * Esta classe é responsável por:
 * - Gerenciar o ciclo de vida das tarefas
 * - Controlar a comunicação com o modelo de IA
 * - Gerenciar o histórico de conversas
 * - Controlar o estado das ferramentas e checkpoints
 * - Interagir com o ambiente VSCode
 *
 * A classe é instanciada pelo ClineProvider e pode ter tarefas pai/filho para suportar subtarefas.
 */
export class Cline extends EventEmitter<ClineEvents> {
	// Identificadores únicos da tarefa
	readonly taskId: string
	readonly instanceId: string

	// Referências para tarefas relacionadas (para suporte a subtarefas)
	readonly rootTask: Cline | undefined = undefined
	readonly parentTask: Cline | undefined = undefined
	readonly taskNumber: number
	isPaused: boolean = false
	pausedModeSlug: string = defaultModeSlug
	private pauseInterval: NodeJS.Timeout | undefined

	// Configuração e gerenciamento da API
	readonly apiConfiguration: ApiConfiguration
	api: ApiHandler
	private fileContextTracker: FileContextTracker
	private urlContentFetcher: UrlContentFetcher
	browserSession: BrowserSession
	didEditFile: boolean = false
	customInstructions?: string
	diffStrategy?: DiffStrategy
	diffEnabled: boolean = false
	fuzzyMatchThreshold: number

	// Histórico de mensagens e estado da conversa
	apiConversationHistory: (Anthropic.MessageParam & { ts?: number })[] = []
	clineMessages: ClineMessage[] = []
	rooIgnoreController?: RooIgnoreController
	private askResponse?: ClineAskResponse
	private askResponseText?: string
	private askResponseImages?: string[]
	private lastMessageTs?: number
	// Não é privado pois precisa ser acessível pelas ferramentas
	consecutiveMistakeCount: number = 0
	consecutiveMistakeLimit: number
	consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map()
	// Não é privado pois precisa ser acessível pelas ferramentas
	providerRef: WeakRef<ClineProvider>
	private abort: boolean = false
	didFinishAbortingStream = false
	abandoned = false
	diffViewProvider: DiffViewProvider
	private lastApiRequestTime?: number
	isInitialized = false

	// Sistema de checkpoints para salvar o estado da tarefa
	private enableCheckpoints: boolean
	private checkpointService?: RepoPerTaskCheckpointService
	private checkpointServiceInitializing = false

	// Controle de streaming de mensagens
	isWaitingForFirstChunk = false
	isStreaming = false
	private currentStreamingContentIndex = 0
	private assistantMessageContent: AssistantMessageContent[] = []
	private presentAssistantMessageLocked = false
	private presentAssistantMessageHasPendingUpdates = false
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []
	private userMessageContentReady = false
	didRejectTool = false
	private didAlreadyUseTool = false
	private didCompleteReadingStream = false

	/**
	 * Construtor da classe Cline
	 * @param provider - Referência para o ClineProvider que gerencia esta instância
	 * @param apiConfiguration - Configurações da API de IA
	 * @param customInstructions - Instruções personalizadas para o modelo
	 * @param enableDiff - Habilita o sistema de diff para edições de arquivos
	 * @param enableCheckpoints - Habilita o sistema de checkpoints
	 * @param checkpointStorage - Tipo de armazenamento de checkpoints
	 * @param fuzzyMatchThreshold - Limiar para correspondência difusa
	 * @param consecutiveMistakeLimit - Limite de erros consecutivos
	 * @param task - Descrição da tarefa inicial
	 * @param images - Imagens associadas à tarefa
	 * @param historyItem - Item de histórico para retomar uma tarefa
	 * @param experiments - Configurações de experimentos
	 * @param startTask - Se deve iniciar a tarefa automaticamente
	 * @param rootTask - Tarefa raiz (para subtarefas)
	 * @param parentTask - Tarefa pai (para subtarefas)
	 * @param taskNumber - Número da tarefa na sequência
	 * @param onCreated - Callback chamado após a criação
	 */
	constructor({
		provider,
		apiConfiguration,
		customInstructions,
		enableDiff = false,
		enableCheckpoints = true,
		fuzzyMatchThreshold = 1.0,
		consecutiveMistakeLimit = 3,
		task,
		images,
		historyItem,
		experiments,
		startTask = true,
		rootTask,
		parentTask,
		taskNumber = -1,
		onCreated,
	}: ClineOptions) {
		super()

		// Verifica se os parâmetros necessários foram fornecidos para iniciar a tarefa
		if (startTask && !task && !images && !historyItem) {
			throw new Error("Either historyItem or task/images must be provided")
		}

		// Inicializa identificadores únicos para a tarefa
		this.taskId = historyItem ? historyItem.id : crypto.randomUUID() // Usa o ID existente ou cria um novo
		this.instanceId = crypto.randomUUID().slice(0, 8) // Cria um ID de instância curto
		this.taskNumber = -1 // Inicializa o número da tarefa como inválido

		// Inicializa controladores e rastreadores
		this.rooIgnoreController = new RooIgnoreController(this.cwd) // Gerencia arquivos a serem ignorados
		this.fileContextTracker = new FileContextTracker(provider, this.taskId) // Rastreia contexto de arquivos
		this.rooIgnoreController.initialize().catch((error) => {
			console.error("Failed to initialize RooIgnoreController:", error)
		})

		// Configura a API e ferramentas auxiliares
		this.apiConfiguration = apiConfiguration // Armazena configuração da API
		this.api = buildApiHandler(apiConfiguration) // Constrói o manipulador da API
		this.urlContentFetcher = new UrlContentFetcher(provider.context) // Ferramenta para buscar conteúdo de URLs
		this.browserSession = new BrowserSession(provider.context) // Gerencia sessão do navegador
		this.customInstructions = customInstructions // Armazena instruções personalizadas

		// Configura parâmetros de comportamento
		this.diffEnabled = enableDiff // Habilita ou desabilita o sistema de diff
		this.fuzzyMatchThreshold = fuzzyMatchThreshold // Define o limiar para correspondência difusa
		this.consecutiveMistakeLimit = consecutiveMistakeLimit // Define o limite de erros consecutivos
		this.providerRef = new WeakRef(provider) // Referência fraca ao provedor para evitar vazamentos de memória
		this.diffViewProvider = new DiffViewProvider(this.cwd) // Provedor de visualização de diferenças
		this.enableCheckpoints = enableCheckpoints // Habilita ou desabilita checkpoints
		this.checkpointStorage = checkpointStorage // Define o tipo de armazenamento de checkpoints

		// Configura relacionamentos de tarefas
		this.rootTask = rootTask // Tarefa raiz (para hierarquia de tarefas)
		this.parentTask = parentTask // Tarefa pai (para subtarefas)
		this.taskNumber = taskNumber // Número da tarefa na sequência

		// Registra telemetria sobre a criação/reinício da tarefa
		this.apiConfiguration = apiConfiguration
		this.api = buildApiHandler(apiConfiguration)
		this.urlContentFetcher = new UrlContentFetcher(provider.context)
		this.browserSession = new BrowserSession(provider.context)
		this.customInstructions = customInstructions
		this.diffEnabled = enableDiff
		this.fuzzyMatchThreshold = fuzzyMatchThreshold
		this.consecutiveMistakeLimit = consecutiveMistakeLimit
		this.providerRef = new WeakRef(provider)
		this.diffViewProvider = new DiffViewProvider(this.cwd)
		this.enableCheckpoints = enableCheckpoints

		this.rootTask = rootTask
		this.parentTask = parentTask
		this.taskNumber = taskNumber

		if (historyItem) {
			telemetryService.captureTaskRestarted(this.taskId) // Registra reinício de tarefa existente
		} else {
			telemetryService.captureTaskCreated(this.taskId) // Registra criação de nova tarefa
		}

		// Inicializa a estratégia de diff com base no estado atual
		this.updateDiffStrategy(experiments ?? {})

		// Executa callback após a criação, se fornecido
		onCreated?.(this)

		// Inicia a tarefa se solicitado
		if (startTask) {
			if (task || images) {
				this.startTask(task, images) // Inicia nova tarefa com descrição e/ou imagens
			} else if (historyItem) {
				this.resumeTaskFromHistory() // Retoma tarefa a partir do histórico
			} else {
				throw new Error("Either historyItem or task/images must be provided")
			}
		}
	}

	/**
	 * Método estático para criar uma nova instância de Cline
	 * @param options - Opções de configuração
	 * @returns [instância de Cline, Promise que resolve quando a tarefa é iniciada]
	 */
	static create(options: ClineOptions): [Cline, Promise<void>] {
		const instance = new Cline({ ...options, startTask: false })
		const { images, task, historyItem } = options
		let promise

		if (images || task) {
			promise = instance.startTask(task, images)
		} else if (historyItem) {
			promise = instance.resumeTaskFromHistory()
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}

		return [instance, promise]
	}

	/**
	 * Obtém o diretório de trabalho atual
	 * @returns Caminho absoluto para o diretório de trabalho
	 */
	get cwd() {
		return getWorkspacePath(path.join(os.homedir(), "Desktop"))
	}

	// Add method to update diffStrategy.
	async updateDiffStrategy(experiments: Partial<Record<ExperimentId, boolean>>) {
		this.diffStrategy = getDiffStrategy({
			model: this.api.getModel().id,
			experiments,
			fuzzyMatchThreshold: this.fuzzyMatchThreshold,
		})
	}

	// Storing task to disk for history

	/**
	 * Garante que o diretório da tarefa exista no armazenamento global
	 * @returns Caminho absoluto para o diretório da tarefa
	 */
	private async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}

		// Use storagePathManager para recuperar o diretório de armazenamento da tarefa
		const { getTaskDirectoryPath } = await import("../shared/storagePathManager")
		return getTaskDirectoryPath(globalStoragePath, this.taskId)
	}

	/**
	 * Obtém o histórico de conversação da API salvo no diretório da tarefa
	 * @returns Histórico de mensagens da API
	 */
	private async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
		const fileExists = await fileExistsAtPath(filePath)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	/**
	 * Adiciona uma mensagem ao histórico de conversação da API
	 * @param message - Mensagem a ser adicionada
	 */
	private async addToApiConversationHistory(message: Anthropic.MessageParam) {
		const messageWithTs = { ...message, ts: Date.now() }
		this.apiConversationHistory.push(messageWithTs)
		await this.saveApiConversationHistory()
	}

	/**
	 * Substitui todo o histórico de conversação da API
	 * @param newHistory - Novo histórico de mensagens
	 */
	async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	/**
	 * Salva o histórico de conversação da API no diretório da tarefa
	 */
	private async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.apiConversationHistory)
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
		} catch (error) {
			// in the off chance this fails, we don't want to stop the task
			console.error("Failed to save API conversation history:", error)
		}
	}

	private async getSavedClineMessages(): Promise<ClineMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), GlobalFileNames.uiMessages)

		if (await fileExistsAtPath(filePath)) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		} else {
			// check old location
			const oldPath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			if (await fileExistsAtPath(oldPath)) {
				const data = JSON.parse(await fs.readFile(oldPath, "utf8"))
				await fs.unlink(oldPath) // remove old file
				return data
			}
		}
		return []
	}

	/**
	 * Adiciona uma mensagem ao histórico de mensagens do Cline
	 * @param message - Mensagem a ser adicionada
	 */
	private async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)
		await this.providerRef.deref()?.postStateToWebview()
		this.emit("message", { action: "created", message })
		await this.saveClineMessages()
	}

	/**
	 * Substitui todas as mensagens do Cline por um novo conjunto
	 * @param newMessages - Novas mensagens
	 */
	public async overwriteClineMessages(newMessages: ClineMessage[]) {
		this.clineMessages = newMessages
		await this.saveClineMessages()
	}

	private async updateClineMessage(partialMessage: ClineMessage) {
		await this.providerRef.deref()?.postMessageToWebview({ type: "partialMessage", partialMessage })
		this.emit("message", { action: "updated", message: partialMessage })
	}

	/**
	 * Calcula e retorna o uso de tokens da API
	 * @returns Métricas de uso de tokens
	 */
	getTokenUsage() {
		const usage = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))))
		this.emit("taskTokenUsageUpdated", this.taskId, usage)
		return usage
	}

	/**
	 * Salva as mensagens do Cline no armazenamento persistente
	 */
	private async saveClineMessages() {
		try {
			const taskDir = await this.ensureTaskDirectoryExists()
			const filePath = path.join(taskDir, GlobalFileNames.uiMessages)
			await fs.writeFile(filePath, JSON.stringify(this.clineMessages))
			// combined as they are in ChatView
			const apiMetrics = this.getTokenUsage()
			const taskMessage = this.clineMessages[0] // first message is always the task say
			const lastRelevantMessage =
				this.clineMessages[
					findLastIndex(
						this.clineMessages,
						(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
					)
				]

			let taskDirSize = 0

			try {
				taskDirSize = await getFolderSize.loose(taskDir)
			} catch (err) {
				console.error(
					`[saveClineMessages] failed to get task directory size (${taskDir}): ${err instanceof Error ? err.message : String(err)}`,
				)
			}

			await this.providerRef.deref()?.updateTaskHistory({
				id: this.taskId,
				number: this.taskNumber,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
				size: taskDirSize,
				workspace: this.cwd,
			})
		} catch (error) {
			console.error("Failed to save cline messages:", error)
		}
	}

	// Communicate with webview

	// partial has three valid states true (partial message), false (completion of partial message), undefined (individual complete message)
	async ask(
		type: ClineAsk,
		text?: string,
		partial?: boolean,
		progressStatus?: ToolProgressStatus,
	): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
		// Se esta instância Cline foi abortada pelo provedor, então o único
		// motivo de estar viva é uma promise ainda em execução em segundo plano,
		// caso em que não queremos enviar seu resultado para o webview como está
		// anexado a uma nova instância de Cline agora. Então podemos ignorar
		// o resultado de qualquer promise ativa, e esta classe será
		// deallocated. (Embora definamos Cline = undefined no provedor, isso
		// simplesmente remove a referência a esta instância, mas a instância
		// ainda está viva até que esta promise seja resolvida ou rejeitada.)
		if (this.abort) {
			throw new Error(`[Cline#ask] task ${this.taskId}.${this.instanceId} aborted`)
		}

		let askTs: number

		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)
			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "ask" && lastMessage.ask === type
			if (partial) {
				if (isUpdatingPreviousPartial) {
					// Mensagem parcial existente, então atualize-a.
					lastMessage.text = text
					lastMessage.partial = partial
					lastMessage.progressStatus = progressStatus
					// TODO: Seja mais eficiente sobre o salvamento e o post de
					// apenas novos dados ou uma mensagem inteira de cada vez para
					// ignorar parcial para salvamentos, e apenas postar partes de
					// uma mensagem parcial em vez de todo o array em um novo ouvinte.
					this.updateClineMessage(lastMessage)
					throw new Error("Current ask promise was ignored (#1)")
				} else {
					// Esta é uma nova mensagem parcial, então adicione-a com o estado parcial.
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text, partial })
					throw new Error("Current ask promise was ignored (#2)")
				}
			} else {
				if (isUpdatingPreviousPartial) {
					// Esta é a versão completa de uma mensagem parcial anterior,
					// então substitua a parcial pela versão completa.
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined

					/*
					Bug for the history books:
					No webview usamos o ts como a chave do chatrow para a lista virtuosa.
					Desde que atualizamos este ts logo no final do streaming, causaria uma
					flutuação na visualização. A propriedade key tem que ser estável,
					caso contrário o react tem dificuldade em reconciliar itens entre
					renders, causando desmontagem e montagem de componentes (flickering).
					O lição aqui é se você ver flutuação quando está renderizando listas,
					provavelmente porque a propriedade key não é estável.
					Então, neste caso, temos que garantir que o ts da mensagem nunca
					seja alterado após o primeiro ajuste.
					*/
					askTs = lastMessage.ts
					this.lastMessageTs = askTs
					// lastMessage.ts = askTs
					lastMessage.text = text
					lastMessage.partial = false
					lastMessage.progressStatus = progressStatus
					await this.saveClineMessages()
					this.updateClineMessage(lastMessage)
				} else {
					// Esta é uma nova e completa mensagem, então adicione-a como normal.
					this.askResponse = undefined
					this.askResponseText = undefined
					this.askResponseImages = undefined
					askTs = Date.now()
					this.lastMessageTs = askTs
					await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
				}
			}
		} else {
			// Esta é uma nova mensagem não parcial, então adicione-a como normal.
			this.askResponse = undefined
			this.askResponseText = undefined
			this.askResponseImages = undefined
			askTs = Date.now()
			this.lastMessageTs = askTs
			await this.addToClineMessages({ ts: askTs, type: "ask", ask: type, text })
		}

		await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })

		if (this.lastMessageTs !== askTs) {
			// Pode acontecer se enviamos várias perguntas em sequência, por exemplo, com
			// command_output. É importante que, quando sabemos que uma pergunta pode falhar,
			// ela seja tratada de formagraceful.
			throw new Error("Current ask promise was ignored")
		}

		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		this.emit("taskAskResponded")
		return result
	}

	async handleWebviewAskResponse(askResponse: ClineAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	async say(
		type: ClineSay,
		text?: string,
		images?: string[],
		partial?: boolean,
		checkpoint?: Record<string, unknown>,
		progressStatus?: ToolProgressStatus,
	): Promise<undefined> {
		if (this.abort) {
			throw new Error(`[Cline#say] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (partial !== undefined) {
			const lastMessage = this.clineMessages.at(-1)
			const isUpdatingPreviousPartial =
				lastMessage && lastMessage.partial && lastMessage.type === "say" && lastMessage.say === type
			if (partial) {
				if (isUpdatingPreviousPartial) {
					// Mensagem parcial existente, então atualize-a
					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = partial
					lastMessage.progressStatus = progressStatus
					this.updateClineMessage(lastMessage)
				} else {
					// Esta é uma nova mensagem parcial, então adicione-a com o estado parcial
					const sayTs = Date.now()
					this.lastMessageTs = sayTs
					await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images, partial })
				}
			} else {
				// Nova mensagem agora tem uma versão completa de uma mensagem parcial anterior.
				if (isUpdatingPreviousPartial) {
					// Esta é a versão completa de uma mensagem parcial anterior,
					// então substitua a parcial pela versão completa.
					this.lastMessageTs = lastMessage.ts
					// lastMessage.ts = sayTs
					lastMessage.text = text
					lastMessage.images = images
					lastMessage.partial = false
					lastMessage.progressStatus = progressStatus
					// Em vez de transmitir eventos partialMessage, fazemos um save
					// e post como normal para persistir no disco.
					await this.saveClineMessages()
					// Mais performante que um postStateToWebview inteiro.
					this.updateClineMessage(lastMessage)
				} else {
					// Esta é uma nova e completa mensagem, então adicione-a como normal.
					const sayTs = Date.now()
					this.lastMessageTs = sayTs
					await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images })
				}
			}
		} else {
			// Esta é uma nova mensagem não parcial, então adicione-a como normal.
			const sayTs = Date.now()
			this.lastMessageTs = sayTs
			await this.addToClineMessages({ ts: sayTs, type: "say", say: type, text, images, checkpoint })
		}
	}

	async sayAndCreateMissingParamError(toolName: ToolUseName, paramName: string, relPath?: string) {
		await this.say(
			"error",
			`Roo tried to use ${toolName}${
				relPath ? ` for '${relPath.toPosix()}'` : ""
			} without value for required parameter '${paramName}'. Retrying...`,
		)
		return formatResponse.toolError(formatResponse.missingToolParameterError(paramName))
	}

	// Ciclo de vida da tarefa

	private async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (para API) e clineMessages (para webview) precisam estar em sincronia
		// se o processo da extensão fosse morto, então no reinício o clineMessages não estaria vazio,
		// então precisamos defini-lo como [] quando criamos uma nova instância de Cline (caso contrário,
		// o webview mostraria mensagens envelhecidas da sessão anterior)
		this.clineMessages = []
		this.apiConversationHistory = []
		await this.providerRef.deref()?.postStateToWebview()

		await this.say("text", task, images)
		this.isInitialized = true

		let imageBlocks: Anthropic.ImageBlockParam[] = formatResponse.imageBlocks(images)

		console.log(`[subtasks] task ${this.taskId}.${this.instanceId} starting`)

		await this.initiateTaskLoop([
			{
				type: "text",
				text: `<task>\n${task}\n</task>`,
			},
			...imageBlocks,
		])
	}

	async resumePausedTask(lastMessage: string) {
		// libera esta instância Cline do estado de pausa
		this.isPaused = false
		this.emit("taskUnpaused")

		// finge uma resposta da subtarefa que ela terminou de executar e esta é a resposta do que ela fez
		// adiciona a mensagem ao histórico de chat e ao webview ui
		try {
			await this.say("subtask_result", lastMessage)

			await this.addToApiConversationHistory({
				role: "user",
				content: [
					{
						type: "text",
						text: `[new_task completed] Result: ${lastMessage}`,
					},
				],
			})
		} catch (error) {
			this.providerRef
				.deref()
				?.log(`Error failed to add reply from subtast into conversation of parent task, error: ${error}`)
			throw error
		}
	}

	/**
	 * Retoma uma tarefa a partir do histórico
	 */
	private async resumeTaskFromHistory() {
		const modifiedClineMessages = await this.getSavedClineMessages()

		// Remove quaisquer mensagens de retomada que possam ter sido adicionadas anteriormente
		const lastRelevantMessageIndex = findLastIndex(
			modifiedClineMessages,
			(m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"),
		)
		if (lastRelevantMessageIndex !== -1) {
			modifiedClineMessages.splice(lastRelevantMessageIndex + 1)
		}

		// como não usamos mais api_req_finished, precisamos verificar se o último api_req_started tem um valor de custo,
		// se não tiver e não houver uma razão de cancelamento para apresentar, então removemos, pois indica uma solicitação de API sem nenhum conteúdo parcial transmitido
		const lastApiReqStartedIndex = findLastIndex(
			modifiedClineMessages,
			(m) => m.type === "say" && m.say === "api_req_started",
		)
		if (lastApiReqStartedIndex !== -1) {
			const lastApiReqStarted = modifiedClineMessages[lastApiReqStartedIndex]
			const { cost, cancelReason }: ClineApiReqInfo = JSON.parse(lastApiReqStarted.text || "{}")
			if (cost === undefined && cancelReason === undefined) {
				modifiedClineMessages.splice(lastApiReqStartedIndex, 1)
			}
		}

		await this.overwriteClineMessages(modifiedClineMessages)
		this.clineMessages = await this.getSavedClineMessages()

		// Agora apresenta as mensagens de cline ao usuário e pergunta se ele quer
		// retomar (NOTE: corrigimos um bug antes onde o
		// apiConversationHistory não seria inicializado ao abrir uma tarefa antiga,
		// e isso foi porque estávamos esperando a retomada).
		// Isso é importante caso o usuário exclua mensagens sem retomar
		// a tarefa primeiro.
		this.apiConversationHistory = await this.getSavedApiConversationHistory()

		const lastClineMessage = this.clineMessages
			.slice()
			.reverse()
			.find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")) // could be multiple resume tasks

		let askType: ClineAsk
		if (lastClineMessage?.ask === "completion_result") {
			askType = "resume_completed_task"
		} else {
			askType = "resume_task"
		}

		this.isInitialized = true

		const { response, text, images } = await this.ask(askType) // calls poststatetowebview
		let responseText: string | undefined
		let responseImages: string[] | undefined
		if (response === "messageResponse") {
			await this.say("user_feedback", text, images)
			responseText = text
			responseImages = images
		}

		// Garanta que o histórico de conversação da API possa ser retomado pela API,
		// mesmo que esteja fora de sincronia com as mensagens do cline.
		let existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
			await this.getSavedApiConversationHistory()

		// v2.0 xml tags refactor caveat: como não usamos mais ferramentas, precisamos substituir todas as bloco de ferramentas com um bloco de texto,
		// pois a API não permite conversas com ferramentas e sem esquema de ferramentas
		const conversationWithoutToolBlocks = existingApiConversationHistory.map((message) => {
			if (Array.isArray(message.content)) {
				const newContent = message.content.map((block) => {
					if (block.type === "tool_use") {
						// é importante convertemos para o novo formato de esquema de ferramentas para que o modelo não se confunda sobre como invocar ferramentas
						const inputAsXml = Object.entries(block.input as Record<string, string>)
							.map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
							.join("\n")
						return {
							type: "text",
							text: `<${block.name}>\n${inputAsXml}\n</${block.name}>`,
						} as Anthropic.Messages.TextBlockParam
					} else if (block.type === "tool_result") {
						// Converte o bloco.content em um array de bloco de texto, removendo imagens
						const contentAsTextBlocks = Array.isArray(block.content)
							? block.content.filter((item) => item.type === "text")
							: [{ type: "text", text: block.content }]
						const textContent = contentAsTextBlocks.map((item) => item.text).join("\n\n")
						const toolName = findToolName(block.tool_use_id, existingApiConversationHistory)
						return {
							type: "text",
							text: `[${toolName} Result]\n\n${textContent}`,
						} as Anthropic.Messages.TextBlockParam
					}
					return block
				})
				return { ...message, content: newContent }
			}
			return message
		})
		existingApiConversationHistory = conversationWithoutToolBlocks

		// FIXME: remover completamente os blocos de uso de ferramentas

		// se a última mensagem é uma mensagem de assistente, precisamos verificar se há ferramentas, pois cada ferramenta tem que ter uma resposta da ferramenta
		// se não houver ferramentas e apenas um bloco de texto, então podemos apenas adicionar uma mensagem do usuário
		// (observe que isso não é mais relevante já que usamos prompts de ferramentas personalizados em vez de blocos de uso de ferramentas, mas está aqui para fins de compatibilidade caso os usuários retomem tarefas antigas)

		// se a última mensagem for uma mensagem do usuário, precisamos obter a mensagem do assistente anterior para ver se ela fez chamadas de ferramentas e, em caso afirmativo, preencher as respostas de ferramentas restantes com 'interrompido'

		let modifiedOldUserContent: UserContent // ou a última mensagem se for uma mensagem do usuário, ou a mensagem do usuário antes da última (assistente)
		let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[] // precisa remover a última mensagem do usuário para substituir com a nova mensagem do usuário modificada
		if (existingApiConversationHistory.length > 0) {
			const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

			if (lastMessage.role === "assistant") {
				const content = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				const hasToolUse = content.some((block) => block.type === "tool_use")

				if (hasToolUse) {
					const toolUseBlocks = content.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]
					const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
						type: "tool_result",
						tool_use_id: block.id,
						content: "Task was interrupted before this tool call could be completed.",
					}))
					modifiedApiConversationHistory = [...existingApiConversationHistory] // no changes
					modifiedOldUserContent = [...toolResponses]
				} else {
					modifiedApiConversationHistory = [...existingApiConversationHistory]
					modifiedOldUserContent = []
				}
			} else if (lastMessage.role === "user") {
				const previousAssistantMessage: Anthropic.Messages.MessageParam | undefined =
					existingApiConversationHistory[existingApiConversationHistory.length - 2]

				const existingUserContent: UserContent = Array.isArray(lastMessage.content)
					? lastMessage.content
					: [{ type: "text", text: lastMessage.content }]
				if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
					const assistantContent = Array.isArray(previousAssistantMessage.content)
						? previousAssistantMessage.content
						: [{ type: "text", text: previousAssistantMessage.content }]

					const toolUseBlocks = assistantContent.filter(
						(block) => block.type === "tool_use",
					) as Anthropic.Messages.ToolUseBlock[]

					if (toolUseBlocks.length > 0) {
						const existingToolResults = existingUserContent.filter(
							(block) => block.type === "tool_result",
						) as Anthropic.ToolResultBlockParam[]

						const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
							.filter(
								(toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id),
							)
							.map((toolUse) => ({
								type: "tool_result",
								tool_use_id: toolUse.id,
								content: "Task was interrupted before this tool call could be completed.",
							}))

						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1) // removes the last user message
						modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
					} else {
						modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
						modifiedOldUserContent = [...existingUserContent]
					}
				} else {
					modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
					modifiedOldUserContent = [...existingUserContent]
				}
			} else {
				throw new Error("Unexpected: Last message is not a user or assistant message")
			}
		} else {
			throw new Error("Unexpected: No existing API conversation history")
		}

		let newUserContent: UserContent = [...modifiedOldUserContent]

		const agoText = ((): string => {
			const timestamp = lastClineMessage?.ts ?? Date.now()
			const now = Date.now()
			const diff = now - timestamp
			const minutes = Math.floor(diff / 60000)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			if (days > 0) {
				return `${days} day${days > 1 ? "s" : ""} ago`
			}
			if (hours > 0) {
				return `${hours} hour${hours > 1 ? "s" : ""} ago`
			}
			if (minutes > 0) {
				return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
			}
			return "just now"
		})()

		const wasRecent = lastClineMessage?.ts && Date.now() - lastClineMessage.ts < 30_000

		newUserContent.push({
			type: "text",
			text:
				`[TASK RESUMPTION] This task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. If the task has not been completed, retry the last step before interruption and proceed with completing the task.\n\nNote: If you previously attempted a tool use that the user did not provide a result for, you should assume the tool use was not successful and assess whether you should retry. If the last tool was a browser_action, the browser has been closed and you must launch a new browser if needed.${
					wasRecent
						? "\n\nIMPORTANT: If the last tool use was a write_to_file that was interrupted, the file was reverted back to its original state before the interrupted edit, and you do NOT need to re-read the file as you already have its up-to-date contents."
						: ""
				}` +
				(responseText
					? `\n\nNew instructions for task continuation:\n<user_message>\n${responseText}\n</user_message>`
					: ""),
		})

		if (responseImages && responseImages.length > 0) {
			newUserContent.push(...formatResponse.imageBlocks(responseImages))
		}

		await this.overwriteApiConversationHistory(modifiedApiConversationHistory)

		console.log(`[subtasks] task ${this.taskId}.${this.instanceId} resuming from history item`)

		await this.initiateTaskLoop(newUserContent)
	}

	private async initiateTaskLoop(userContent: UserContent): Promise<void> {
		// Kicks off the checkpoints initialization process in the background.
		this.getCheckpointService()

		let nextUserContent = userContent
		let includeFileDetails = true

		this.emit("taskStarted")

		while (!this.abort) {
			const didEndLoop = await this.recursivelyMakeClineRequests(nextUserContent, includeFileDetails)
			includeFileDetails = false // precisamos apenas dos detalhes do arquivo a primeira vez

			// O modo como este loop de agente funciona é que o cline receberá uma
			// tarefa que ele então chamará ferramentas para completá-la. A menos que haja um
			// attempt_completion chamada, continuamos respondendo a ele com as respostas de suas
			// ferramentas até que ele tente complete_task ou não use mais ferramentas. Se ele não usar mais ferramentas,
			// perguntamos se ele considerou se completou a tarefa e então chamamos
			// attempt_completion, caso contrário, prosseguimos com a tarefa.
			// Há um limite de MAX_REQUESTS_PER_TASK para evitar solicitações infinitas,
			// mas o cline é instruído a finalizar a tarefa o mais eficientemente possível
			// como ele pode.

			if (didEndLoop) {
				// Até agora, uma tarefa nunca 'completa'. Isso só acontecerá se
				// o usuário atingir o máximo de solicitações e negar o redefinição do contador.
				break
			} else {
				nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
				this.consecutiveMistakeCount++
			}
		}
	}

	async abortTask(isAbandoned = false) {
		// if (this.abort) {
		// 	console.log(`[subtasks] already aborted task ${this.taskId}.${this.instanceId}`)
		// 	return
		// }

		console.log(`[subtasks] aborting task ${this.taskId}.${this.instanceId}`)

		// Irá parar qualquer promessa autônoma em execução.
		if (isAbandoned) {
			this.abandoned = true
		}

		this.abort = true
		this.emit("taskAborted")

		// Irá parar qualquer promessa autônoma em execução.
		if (this.pauseInterval) {
			clearInterval(this.pauseInterval)
			this.pauseInterval = undefined
		}

		// Libera qualquer terminal associado a esta tarefa.
		TerminalRegistry.releaseTerminalsForTask(this.taskId)

		this.urlContentFetcher.closeBrowser()
		this.browserSession.closeBrowser()
		this.rooIgnoreController?.dispose()
		this.fileContextTracker.dispose()

		// Se não estivermos transmitindo, `abortStream` (que reverte as alterações da exibição de diferenças)
		// não será chamado, então precisamos reverter as alterações aqui.
		if (this.isStreaming && this.diffViewProvider.isEditing) {
			await this.diffViewProvider.revertChanges()
		}
	}

	// Tools

	async executeCommandTool(command: string, customCwd?: string): Promise<[boolean, ToolResponse]> {
		let workingDir: string
		if (!customCwd) {
			workingDir = this.cwd
		} else if (path.isAbsolute(customCwd)) {
			workingDir = customCwd
		} else {
			workingDir = path.resolve(this.cwd, customCwd)
		}

		// Verifica se o diretório existe
		try {
			await fs.access(workingDir)
		} catch (error) {
			return [false, `Working directory '${workingDir}' does not exist.`]
		}

		const terminalInfo = await TerminalRegistry.getOrCreateTerminal(workingDir, !!customCwd, this.taskId)

		// Atualiza o diretório de trabalho caso o terminal que pedimos tenha
		// um diretório de trabalho diferente, para que o modelo saiba onde o
		// comando foi executado:
		workingDir = terminalInfo.getCurrentWorkingDirectory()

		const workingDirInfo = workingDir ? ` from '${workingDir.toPosix()}'` : ""
		terminalInfo.terminal.show() // um bug visual estranho quando criamos novos terminais (mesmo manualmente) onde há um espaço em branco no topo.
		let userFeedback: { text?: string; images?: string[] } | undefined
		let didContinue = false
		let completed = false
		let result: string = ""
		let exitDetails: ExitCodeDetails | undefined
		const { terminalOutputLineLimit = 500 } = (await this.providerRef.deref()?.getState()) ?? {}

		const sendCommandOutput = async (line: string, terminalProcess: TerminalProcess): Promise<void> => {
			try {
				const { response, text, images } = await this.ask("command_output", line)
				if (response === "yesButtonClicked") {
					// prosseguir enquanto estiver em execução
				} else {
					userFeedback = { text, images }
				}
				didContinue = true
				terminalProcess.continue() // continue past the await
			} catch {
				// Isso só pode acontecer se esta promessa ask foi ignorada, então ignore este erro
			}
		}

		const process = terminalInfo.runCommand(command, {
			onLine: (line, process) => {
				if (!didContinue) {
					sendCommandOutput(Terminal.compressTerminalOutput(line, terminalOutputLineLimit), process)
				} else {
					this.say("command_output", Terminal.compressTerminalOutput(line, terminalOutputLineLimit))
				}
			},
			onCompleted: (output) => {
				result = output ?? ""
				completed = true
			},
			onShellExecutionComplete: (details) => {
				exitDetails = details
			},
			onNoShellIntegration: async (message) => {
				await this.say("shell_integration_warning", message)
			},
		})

		await process

		// Aguarda um pequeno atraso para garantir que todas as mensagens sejam enviadas para o webview
		// Este atraso permite que promessas não aguardadas sejam criadas e
		// para suas mensagens associadas serem enviadas para o webview, mantendo
		// a ordem correta das mensagens (embora o webview seja inteligente sobre
		// agrupar mensagens command_output mesmo com qualquer gap)
		await delay(50)

		result = Terminal.compressTerminalOutput(result, terminalOutputLineLimit)

		// keep in case we need it to troubleshoot user issues, but this should be removed in the future
		// if everything looks good:
		console.debug(
			"[execute_command status]",
			JSON.stringify(
				{
					completed,
					userFeedback,
					hasResult: result.length > 0,
					exitDetails,
					terminalId: terminalInfo.id,
					workingDir: workingDirInfo,
					isTerminalBusy: terminalInfo.busy,
				},
				null,
				2,
			),
		)

		if (userFeedback) {
			await this.say("user_feedback", userFeedback.text, userFeedback.images)
			return [
				true,
				formatResponse.toolResult(
					`Command is still running in terminal ${terminalInfo.id}${workingDirInfo}.${
						result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
					}\n\nThe user provided the following feedback:\n<feedback>\n${userFeedback.text}\n</feedback>`,
					userFeedback.images,
				),
			]
		} else if (completed) {
			let exitStatus: string = ""
			if (exitDetails !== undefined) {
				if (exitDetails.signal) {
					exitStatus = `Process terminated by signal ${exitDetails.signal} (${exitDetails.signalName})`
					if (exitDetails.coreDumpPossible) {
						exitStatus += " - core dump possible"
					}
				} else if (exitDetails.exitCode === undefined) {
					result += "<VSCE exit code is undefined: terminal output and command execution status is unknown.>"
					exitStatus = `Exit code: <undefined, notify user>`
				} else {
					if (exitDetails.exitCode !== 0) {
						exitStatus += "Command execution was not successful, inspect the cause and adjust as needed.\n"
					}
					exitStatus += `Exit code: ${exitDetails.exitCode}`
				}
			} else {
				result += "<VSCE exitDetails == undefined: terminal output and command execution status is unknown.>"
				exitStatus = `Exit code: <undefined, notify user>`
			}

			let workingDirInfo: string = workingDir ? ` within working directory '${workingDir.toPosix()}'` : ""
			const newWorkingDir = terminalInfo.getCurrentWorkingDirectory()

			if (newWorkingDir !== workingDir) {
				workingDirInfo += `\nNOTICE: Your command changed the working directory for this terminal to '${newWorkingDir.toPosix()}' so you MUST adjust future commands accordingly because they will be executed in this directory`
			}

			const outputInfo = `\nOutput:\n${result}`
			return [
				false,
				`Command executed in terminal ${terminalInfo.id}${workingDirInfo}. ${exitStatus}${outputInfo}`,
			]
		} else {
			return [
				false,
				`Command is still running in terminal ${terminalInfo.id}${workingDirInfo}.${
					result.length > 0 ? `\nHere's the output so far:\n${result}` : ""
				}\n\nYou will be updated on the terminal status and new output in the future.`,
			]
		}
	}

	async *attemptApiRequest(previousApiReqIndex: number, retryAttempt: number = 0): ApiStream {
		let mcpHub: McpHub | undefined

		const { apiConfiguration, mcpEnabled, alwaysApproveResubmit, requestDelaySeconds } =
			(await this.providerRef.deref()?.getState()) ?? {}

		let rateLimitDelay = 0

		// Aplica a limitação de taxa somente se esta não for a primeira solicitação
		if (this.lastApiRequestTime) {
			const now = Date.now()
			const timeSinceLastRequest = now - this.lastApiRequestTime
			const rateLimit = apiConfiguration?.rateLimitSeconds || 0
			rateLimitDelay = Math.ceil(Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000)
		}

		// Exibe a mensagem de limitação de taxa somente se não estiver tentando novamente. Se estiver tentando novamente, incluiremos o atraso lá.
		if (rateLimitDelay > 0 && retryAttempt === 0) {
			// Exibe o temporizador de contagem regressiva
			for (let i = rateLimitDelay; i > 0; i--) {
				const delayMessage = `Rate limiting for ${i} seconds...`
				await this.say("api_req_retry_delayed", delayMessage, undefined, true)
				await delay(1000)
			}
		}

		// Atualiza o tempo da última solicitação antes de fazer a solicitação
		this.lastApiRequestTime = Date.now()

		if (mcpEnabled ?? true) {
			mcpHub = this.providerRef.deref()?.getMcpHub()
			if (!mcpHub) {
				throw new Error("MCP hub not available")
			}
			// Aguarda os servidores MCP para se conectar antes de gerar o prompt do sistema
			await pWaitFor(() => mcpHub!.isConnecting !== true, { timeout: 10_000 }).catch(() => {
				console.error("MCP servers failed to connect in time")
			})
		}

		const rooIgnoreInstructions = this.rooIgnoreController?.getInstructions()

		const {
			browserViewportSize,
			mode,
			customModePrompts,
			experiments,
			enableMcpServerCreation,
			browserToolEnabled,
			language,
		} = (await this.providerRef.deref()?.getState()) ?? {}
		const { customModes } = (await this.providerRef.deref()?.getState()) ?? {}
		const systemPrompt = await (async () => {
			const provider = this.providerRef.deref()
			if (!provider) {
				throw new Error("Provider not available")
			}
			return SYSTEM_PROMPT(
				provider.context,
				this.cwd,
				(this.api.getModel().info.supportsComputerUse ?? false) && (browserToolEnabled ?? true),
				mcpHub,
				this.diffStrategy,
				browserViewportSize,
				mode,
				customModePrompts,
				customModes,
				this.customInstructions,
				this.diffEnabled,
				experiments,
				enableMcpServerCreation,
				language,
				rooIgnoreInstructions,
			)
		})()

		// Se o uso total de tokens da solicitação API anterior estiver próximo da janela de contexto, trunque o histórico de conversação para liberar espaço para a nova solicitação
		if (previousApiReqIndex >= 0) {
			const previousRequest = this.clineMessages[previousApiReqIndex]?.text
			if (!previousRequest) return

			const {
				tokensIn = 0,
				tokensOut = 0,
				cacheWrites = 0,
				cacheReads = 0,
			}: ClineApiReqInfo = JSON.parse(previousRequest)

			const totalTokens = tokensIn + tokensOut + cacheWrites + cacheReads

			// Valor máximo padrão de tokens para modelos de pensamento quando nenhum valor específico é definido
			const DEFAULT_THINKING_MODEL_MAX_TOKENS = 16_384

			const modelInfo = this.api.getModel().info
			const maxTokens = modelInfo.thinking
				? this.apiConfiguration.modelMaxTokens || DEFAULT_THINKING_MODEL_MAX_TOKENS
				: modelInfo.maxTokens
			const contextWindow = modelInfo.contextWindow
			const trimmedMessages = await truncateConversationIfNeeded({
				messages: this.apiConversationHistory,
				totalTokens,
				maxTokens,
				contextWindow,
				apiHandler: this.api,
			})

			if (trimmedMessages !== this.apiConversationHistory) {
				await this.overwriteApiConversationHistory(trimmedMessages)
			}
		}

		// Limpa o histórico de conversação:
		// 1. Convertendo para Anthropic.MessageParam por espalhamento apenas das propriedades necessárias para a API
		// 2. Convertendo blocos de imagem para descrições de texto se o modelo não suportar imagens
		const cleanConversationHistory = this.apiConversationHistory.map(({ role, content }) => {
			// Manipula o conteúdo de array (pode conter blocos de imagem)
			if (Array.isArray(content)) {
				if (!this.api.getModel().info.supportsImages) {
					// Converte blocos de imagem para descrições de texto
					content = content.map((block) => {
						if (block.type === "image") {
							// Converte blocos de imagem para descrições de texto
							// Nota: Não podemos acessar o conteúdo/URL da imagem real devido a limitações da API,
							// mas podemos indicar que uma imagem foi mencionada na conversa
							return {
								type: "text",
								text: "[Imagem mencionada na conversa]",
							}
						}
						return block
					})
				}
			}
			return { role, content }
		})

		const stream = this.api.createMessage(systemPrompt, cleanConversationHistory)
		const iterator = stream[Symbol.asyncIterator]()

		try {
			// Aguardando o primeiro chunk para ver se lançará um erro.
			this.isWaitingForFirstChunk = true
			const firstChunk = await iterator.next()
			yield firstChunk.value
			this.isWaitingForFirstChunk = false
		} catch (error) {
			// observe que este erro api_req_failed é único, pois só apresentamos esta opção se a API ainda não transmitiu nenhum conteúdo (ou seja, falha no primeiro chunk), permitindo que eles pressionem um botão de repetição. No entanto, se a API falhar no meio da transmissão, ela pode estar em qualquer estado arbitrário onde algumas ferramentas podem ter sido executadas, então esse erro é tratado de forma diferente e requer o cancelamento completo da tarefa.
			if (alwaysApproveResubmit) {
				let errorMsg

				if (error.error?.metadata?.raw) {
					errorMsg = JSON.stringify(error.error.metadata.raw, null, 2)
				} else if (error.message) {
					errorMsg = error.message
				} else {
					errorMsg = "Unknown error"
				}

				const baseDelay = requestDelaySeconds || 5
				let exponentialDelay = Math.ceil(baseDelay * Math.pow(2, retryAttempt))

				// Se o erro for um 429 e os detalhes do erro contiverem um atraso de repetição, use esse atraso em vez de backoff exponencial
				if (error.status === 429) {
					const geminiRetryDetails = error.errorDetails?.find(
						(detail: any) => detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
					)
					if (geminiRetryDetails) {
						const match = geminiRetryDetails?.retryDelay?.match(/^(\d+)s$/)
						if (match) {
							exponentialDelay = Number(match[1]) + 1
						}
					}
				}

				// Aguarda o maior dos atrasos exponenciais ou o atraso da limitação de taxa
				const finalDelay = Math.max(exponentialDelay, rateLimitDelay)

				// Exibe o temporizador de contagem regressiva com backoff exponencial
				for (let i = finalDelay; i > 0; i--) {
					await this.say(
						"api_req_retry_delayed",
						`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying in ${i} seconds...`,
						undefined,
						true,
					)
					await delay(1000)
				}

				await this.say(
					"api_req_retry_delayed",
					`${errorMsg}\n\nRetry attempt ${retryAttempt + 1}\nRetrying now...`,
					undefined,
					false,
				)

				// Delega a saída do gerador da chamada recursiva com o contador de repetição incrementado
				yield* this.attemptApiRequest(previousApiReqIndex, retryAttempt + 1)
				return
			} else {
				const { response } = await this.ask(
					"api_req_failed",
					error.message ?? JSON.stringify(serializeError(error), null, 2),
				)
				if (response !== "yesButtonClicked") {
					// isso nunca acontecerá, pois se noButtonClicked, limparemos a tarefa atual, abortando esta instância
					throw new Error("API request failed")
				}
				await this.say("api_req_retried")
				// Delega a saída do gerador da chamada recursiva
				yield* this.attemptApiRequest(previousApiReqIndex)
				return
			}
		}

		// não há erro, então podemos continuar a produzir todos os chunks restantes
		// (precisa ser colocado fora do try/catch, pois queremos que o chamador manipule os erros e não com api_req_failed, pois isso é reservado para falhas no primeiro chunk apenas)
		// isso delega para outro gerador ou objeto iterável. Neste caso, está dizendo "yield all remaining values from this iterator". Isso passa por todos os chunks subsequentes do original stream.
		yield* iterator
	}

	async presentAssistantMessage() {
		if (this.abort) {
			throw new Error(`[Cline#presentAssistantMessage] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (this.presentAssistantMessageLocked) {
			this.presentAssistantMessageHasPendingUpdates = true
			return
		}
		this.presentAssistantMessageLocked = true
		this.presentAssistantMessageHasPendingUpdates = false

		if (this.currentStreamingContentIndex >= this.assistantMessageContent.length) {
			// isso pode acontecer se o último bloco de conteúdo foi concluído antes de a transmissão terminar. se a transmissão estiver terminada e estivermos fora dos limites, isso significa que já apresentamos/executamos o último bloco de conteúdo e estamos prontos para continuar para a próxima solicitação
			if (this.didCompleteReadingStream) {
				this.userMessageContentReady = true
			}
			// console.log("no more content blocks to stream! this shouldn't happen?")
			this.presentAssistantMessageLocked = false
			return
			//throw new Error("No more content blocks to stream! This shouldn't happen...") // remove and just return after testing
		}

		const block = cloneDeep(this.assistantMessageContent[this.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too

		switch (block.type) {
			case "text": {
				if (this.didRejectTool || this.didAlreadyUseTool) {
					break
				}
				let content = block.content
				if (content) {
					// (precisamos fazer isso para conteúdo parcial e completo, pois enviar conteúdo em tags thinking para o renderizador markdown será automaticamente removido)
					// Remove substrings finais de <thinking ou </thinking (a análise xml abaixo é apenas para tags de abertura)
					// (isso é feito com a análise xml abaixo agora, mas mantendo aqui para referência)
					// content = content.replace(/<\/?t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?$/, "")
					// Remove todas as instâncias de <thinking> (com quebra de linha opcional depois) e </thinking> (com quebra de linha opcional antes)
					// - Precisa ser separado pois não queremos remover a quebra de linha antes da primeira tag
					// - Precisa acontecer antes da análise xml abaixo
					content = content.replace(/<thinking>\s?/g, "")
					content = content.replace(/\s?<\/thinking>/g, "")

					// Remove a tag XML parcial no final do conteúdo (para tags de ferramenta e pensamento)
					// (previne que o scrollview pule quando as tags são removidas automaticamente)
					const lastOpenBracketIndex = content.lastIndexOf("<")
					if (lastOpenBracketIndex !== -1) {
						const possibleTag = content.slice(lastOpenBracketIndex)
						// Verifica se há um '>' após o último '<' (ou seja, se a tag está completa) (tags de pensamento e ferramenta completas já foram removidas por agora)
						const hasCloseBracket = possibleTag.includes(">")
						if (!hasCloseBracket) {
							// Extrai o nome potencial da tag
							let tagContent: string
							if (possibleTag.startsWith("</")) {
								tagContent = possibleTag.slice(2).trim()
							} else {
								tagContent = possibleTag.slice(1).trim()
							}
							// Verifica se tagContent é provavelmente um nome de tag incompleto (letras e sublinhados apenas)
							const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)
							// Remove < ou </ para evitar que esses artefatos apareçam na conversa (também lida com tags de pensamento fechando)
							const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"
							// Se a tag estiver incompleta e no final, remova-a do conteúdo
							if (isOpeningOrClosing || isLikelyTagName) {
								content = content.slice(0, lastOpenBracketIndex).trim()
							}
						}
					}
				}
				await this.say("text", content, undefined, block.partial)
				break
			}
			case "tool_use":
				const toolDescription = (): string => {
					switch (block.name) {
						case "execute_command":
							return `[${block.name} for '${block.params.command}']`
						case "read_file":
							return `[${block.name} for '${block.params.path}']`
						case "fetch_instructions":
							return `[${block.name} for '${block.params.task}']`
						case "write_to_file":
							return `[${block.name} for '${block.params.path}']`
						case "apply_diff":
							return `[${block.name} for '${block.params.path}']`
						case "search_files":
							return `[${block.name} for '${block.params.regex}'${
								block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
							}]`
						case "insert_content":
							return `[${block.name} for '${block.params.path}']`
						case "search_and_replace":
							return `[${block.name} for '${block.params.path}']`
						case "list_files":
							return `[${block.name} for '${block.params.path}']`
						case "list_code_definition_names":
							return `[${block.name} for '${block.params.path}']`
						case "browser_action":
							return `[${block.name} for '${block.params.action}']`
						case "use_mcp_tool":
							return `[${block.name} for '${block.params.server_name}']`
						case "access_mcp_resource":
							return `[${block.name} for '${block.params.server_name}']`
						case "ask_followup_question":
							return `[${block.name} for '${block.params.question}']`
						case "attempt_completion":
							return `[${block.name}]`
						case "switch_mode":
							return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
						case "new_task": {
							const mode = block.params.mode ?? defaultModeSlug
							const message = block.params.message ?? "(no message)"
							const modeName = getModeBySlug(mode, customModes)?.name ?? mode
							return `[${block.name} in ${modeName} mode: '${message}']`
						}
					}
				}

				if (this.didRejectTool) {
					// ignorar qualquer conteúdo de ferramenta após o usuário ter rejeitado uma ferramenta uma vez
					if (!block.partial) {
						this.userMessageContent.push({
							type: "text",
							text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
						})
					} else {
						// ferramenta parcial após o usuário rejeitar uma ferramenta anterior
						this.userMessageContent.push({
							type: "text",
							text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
						})
					}
					break
				}

				if (this.didAlreadyUseTool) {
					// ignorar qualquer conteúdo após uma ferramenta ter sido usada
					this.userMessageContent.push({
						type: "text",
						text: `Tool [${block.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,
					})
					break
				}

				const pushToolResult = (content: ToolResponse) => {
					this.userMessageContent.push({
						type: "text",
						text: `${toolDescription()} Result:`,
					})
					if (typeof content === "string") {
						this.userMessageContent.push({
							type: "text",
							text: content || "(tool did not return anything)",
						})
					} else {
						this.userMessageContent.push(...content)
					}
					// uma vez que um resultado de ferramenta foi coletado, ignore todas as outras ferramentas, pois devemos apresentar apenas um resultado de ferramenta por mensagem
					this.didAlreadyUseTool = true

					// Marcar um checkpoint como possível, pois usamos uma ferramenta
					// que pode ter alterado o sistema de arquivos.
				}

				const askApproval = async (
					type: ClineAsk,
					partialMessage?: string,
					progressStatus?: ToolProgressStatus,
				) => {
					const { response, text, images } = await this.ask(type, partialMessage, false, progressStatus)
					if (response !== "yesButtonClicked") {
						// Lidar com ambos messageResponse e noButtonClicked com texto
						if (text) {
							await this.say("user_feedback", text, images)
							pushToolResult(
								formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images),
							)
						} else {
							pushToolResult(formatResponse.toolDenied())
						}
						this.didRejectTool = true
						return false
					}
					// Lidar com yesButtonClicked com texto
					if (text) {
						await this.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
					}
					return true
				}

				const askFinishSubTaskApproval = async () => {
					// perguntar ao usuário para aprovar que esta tarefa foi concluída, e ele revisou, e podemos declarar que a tarefa está concluída
					// e retornar o controle para a tarefa pai para continuar executando o restante das sub-tarefas
					const toolMessage = JSON.stringify({
						tool: "finishTask",
					})

					return await askApproval("tool", toolMessage)
				}

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`
					await this.say(
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)
					// this.toolResults.push({
					// 	type: "tool_result",
					// 	tool_use_id: toolUseId,
					// 	content: await this.formatToolError(errorString),
					// })
					pushToolResult(formatResponse.toolError(errorString))
				}

				// Se o bloco for parcial, remova a tag de fechamento parcial para que não seja apresentada ao usuário
				const removeClosingTag = (tag: ToolParamName, text?: string): string => {
					if (!block.partial) {
						return text || ""
					}
					if (!text) {
						return ""
					}
					// Esta expressão regular constrói dinamicamente um padrão para corresponder à tag de fechamento:
					// - Opcionalmente corresponde a espaço em branco antes da tag
					// - Corresponde a '<' ou '</' opcionalmente seguido por qualquer subconjunto de caracteres do nome da tag
					const tagRegex = new RegExp(
						`\\s?<\/?${tag
							.split("")
							.map((char) => `(?:${char})?`)
							.join("")}$`,
						"g",
					)
					return text.replace(tagRegex, "")
				}

				if (block.name !== "browser_action") {
					await this.browserSession.closeBrowser()
				}

				if (!block.partial) {
					telemetryService.captureToolUsage(this.taskId, block.name)
				}

				// Validar o uso da ferramenta antes da execução
				const { mode, customModes } = (await this.providerRef.deref()?.getState()) ?? {}
				try {
					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						{
							apply_diff: this.diffEnabled,
						},
						block.params,
					)
				} catch (error) {
					this.consecutiveMistakeCount++
					pushToolResult(formatResponse.toolError(error.message))
					break
				}

				switch (block.name) {
					case "write_to_file":
						await writeToFileTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "apply_diff":
						await applyDiffTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "insert_content":
						await insertContentTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "search_and_replace":
						await searchAndReplaceTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "read_file":
						await readFileTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)

						break
					case "fetch_instructions":
						await fetchInstructionsTool(this, block, askApproval, handleError, pushToolResult)
						break
					case "list_files":
						await listFilesTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "list_code_definition_names":
						await listCodeDefinitionNamesTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "search_files":
						await searchFilesTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "browser_action":
						await browserActionTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "execute_command":
						await executeCommandTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "use_mcp_tool":
						await useMcpToolTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "access_mcp_resource":
						await accessMcpResourceTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "ask_followup_question":
						await askFollowupQuestionTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "switch_mode":
						await switchModeTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "new_task":
						await newTaskTool(this, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "attempt_completion":
						await attemptCompletionTool(
							this,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
							toolDescription,
							askFinishSubTaskApproval,
						)
						break
				}

				break
		}

		const recentlyModifiedFiles = this.fileContextTracker.getAndClearCheckpointPossibleFile()

		if (recentlyModifiedFiles.length > 0) {
			// TODO: We can track what file changes were made and only
			// checkpoint those files, this will be save storage.
			await this.checkpointSave()
			// TODO: podemos rastrear quais arquivos foram alterados e checkpoint apenas esses arquivos, isso salvará armazenamento
			this.checkpointSave()
		}

		/*
		Verificar fora dos limites é normal, significa que a próxima chamada de ferramenta está sendo construída e pronta para ser adicionada ao assistantMessageContent para apresentar.
		Quando você ver a UI inativa durante isso, significa que uma ferramenta está quebrando sem apresentar qualquer UI. Por exemplo, a ferramenta write_to_file estava quebrando quando relpath era indefinido e para relpath inválido, ela nunca apresentava UI.
		*/
		this.presentAssistantMessageLocked = false // isso precisa ser colocado aqui, se não, chamar this.presentAssistantMessage abaixo falharia (às vezes) já que está travado
		// NOTE: quando a ferramenta é rejeitada, o stream iterador é interrompido e espera por userMessageContentReady para ser true. Futuras chamadas para apresentar saltarão a execução já que didRejectTool e didAlreadyUseTool estão definidos. Quando o conteúdo atingir o comprimento da mensagem, userMessageContentReady será definido como true (em vez de preemptivamente fazer isso no iterador)
		if (!block.partial || this.didRejectTool || this.didAlreadyUseTool) {
			// o bloco terminou de transmitir e executar
			if (this.currentStreamingContentIndex === this.assistantMessageContent.length - 1) {
				// é ok que incrementamos se !didCompleteReadingStream, ele apenas retornará porque está fora dos limites e, à medida que a transmissão continua, chamará presentAssitantMessage se um novo bloco estiver pronto. se a transmissão estiver terminada, então definimos userMessageContentReady como true quando estiver fora dos limites. Isso permite que a transmissão continue e todos os blocos de conteúdo potenciais sejam apresentados.
				// o último bloco está completo e terminou de executar
				this.userMessageContentReady = true // will allow pwaitfor to continue
			}

			// chamar o próximo bloco se existir (se não, o stream lerá chamará quando estiver pronto)
			this.currentStreamingContentIndex++ // precisamos incrementar independentemente, então quando o stream chamar esta função novamente, ele transmitirá o próximo bloco

			if (this.currentStreamingContentIndex < this.assistantMessageContent.length) {
				// já há mais blocos de conteúdo para transmitir, então chamaremos esta função por nós mesmos
				// await this.presentAssistantContent()

				this.presentAssistantMessage()
				return
			}
		}
		// o bloco é parcial, mas o stream de leitura pode ter terminado
		if (this.presentAssistantMessageHasPendingUpdates) {
			this.presentAssistantMessage()
		}
	}

	// Usado quando uma sub-tarefa é lançada e a tarefa pai está esperando que ela termine.
	// TBD: Os 1s devem ser adicionados às configurações, também devemos adicionar um timeout para
	// evitar espera infinita.
	async waitForResume() {
		await new Promise<void>((resolve) => {
			this.pauseInterval = setInterval(() => {
				if (!this.isPaused) {
					clearInterval(this.pauseInterval)
					this.pauseInterval = undefined
					resolve()
				}
			}, 1000)
		})
	}

	async recursivelyMakeClineRequests(
		userContent: UserContent,
		includeFileDetails: boolean = false,
	): Promise<boolean> {
		if (this.abort) {
			throw new Error(`[Cline#recursivelyMakeClineRequests] task ${this.taskId}.${this.instanceId} aborted`)
		}

		if (this.consecutiveMistakeCount >= this.consecutiveMistakeLimit) {
			const { response, text, images } = await this.ask(
				"mistake_limit_reached",
				this.api.getModel().id.includes("claude")
					? `This may indicate a failure in his thought process or inability to use a tool properly, which can be mitigated with some user guidance (e.g. "Try breaking down the task into smaller steps").`
					: "eLai Code uses complex prompts and iterative task execution that may be challenging for less capable models. For best results, it's recommended to use Claude 3.7 Sonnet for its advanced agentic coding capabilities.",
			)

			if (response === "messageResponse") {
				userContent.push(
					...[
						{
							type: "text",
							text: formatResponse.tooManyMistakes(text),
						} as Anthropic.Messages.TextBlockParam,
						...formatResponse.imageBlocks(images),
					],
				)

				// Track consecutive mistake errors in telemetry
				telemetryService.captureConsecutiveMistakeError(this.taskId)
			}
			this.consecutiveMistakeCount = 0
		}

		// Obter o índice da solicitação API anterior para verificar o uso de tokens e determinar se precisamos truncar o histórico de conversação.
		const previousApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")

		// Neste loop de solicitação Cline, precisamos verificar se esta instância de tarefa
		// foi solicitada a aguardar a conclusão de uma sub-tarefa antes de continuar.
		const provider = this.providerRef.deref()

		if (this.isPaused && provider) {
			provider.log(`[subtasks] paused ${this.taskId}.${this.instanceId}`)
			await this.waitForResume()
			provider.log(`[subtasks] resumed ${this.taskId}.${this.instanceId}`)
			const currentMode = (await provider.getState())?.mode ?? defaultModeSlug

			if (currentMode !== this.pausedModeSlug) {
				// O modo foi alterado, precisamos voltar para o modo pausado.
				await provider.handleModeSwitch(this.pausedModeSlug)

				// Atraso para permitir que o modo seja alterado antes de executar a próxima ferramenta.
				await delay(500)

				provider.log(
					`[subtasks] task ${this.taskId}.${this.instanceId} has switched back to '${this.pausedModeSlug}' from '${currentMode}'`,
				)
			}
		}

		// Obter detalhes detalhados é uma operação cara, usa globby para
		// construir a estrutura de arquivos do projeto de cima para baixo, o que para projetos grandes pode
		// levar alguns segundos. Para a melhor experiência do usuário, mostramos uma mensagem api_req_started
		// com um spinner de carregamento enquanto isso acontece.
		await this.say(
			"api_req_started",
			JSON.stringify({
				request:
					userContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n") + "\n\nLoading...",
			}),
		)

		const [parsedUserContent, environmentDetails] = await this.loadContext(userContent, includeFileDetails)
		// adicionar detalhes do ambiente como seu próprio bloco de texto, separado dos resultados da ferramenta
		const finalUserContent = [...parsedUserContent, { type: "text", text: environmentDetails }] as UserContent

		await this.addToApiConversationHistory({ role: "user", content: finalUserContent })
		telemetryService.captureConversationMessage(this.taskId, "user")

		// desde que enviamos uma mensagem api_req_started de espaço reservado para atualizar a UI enquanto aguardávamos para realmente iniciar a solicitação API (para carregar detalhes potenciais, por exemplo), precisamos atualizar o texto dessa mensagem
		const lastApiReqIndex = findLastIndex(this.clineMessages, (m) => m.say === "api_req_started")

		this.clineMessages[lastApiReqIndex].text = JSON.stringify({
			request: finalUserContent.map((block) => formatContentBlockToMarkdown(block)).join("\n\n"),
		} satisfies ClineApiReqInfo)

		await this.saveClineMessages()
		await this.providerRef.deref()?.postStateToWebview()

		try {
			let cacheWriteTokens = 0
			let cacheReadTokens = 0
			let inputTokens = 0
			let outputTokens = 0
			let totalCost: number | undefined

			// atualizar api_req_started. não podemos usar api_req_finished mais, pois é um caso único onde pode vir após uma mensagem de streaming (ou seja, no meio de ser atualizado ou executado)
			// felizmente api_req_finished foi sempre removido para o gui, então permanece apenas para fins de compatibilidade para manter o rastreio de preços em tarefas da história
			// (vale a pena remover alguns meses a partir de agora)
			const updateApiReqMsg = (cancelReason?: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
				this.clineMessages[lastApiReqIndex].text = JSON.stringify({
					...JSON.parse(this.clineMessages[lastApiReqIndex].text || "{}"),
					tokensIn: inputTokens,
					tokensOut: outputTokens,
					cacheWrites: cacheWriteTokens,
					cacheReads: cacheReadTokens,
					cost:
						totalCost ??
						calculateApiCostAnthropic(
							this.api.getModel().info,
							inputTokens,
							outputTokens,
							cacheWriteTokens,
							cacheReadTokens,
						),
					cancelReason,
					streamingFailedMessage,
				} satisfies ClineApiReqInfo)
			}

			const abortStream = async (cancelReason: ClineApiReqCancelReason, streamingFailedMessage?: string) => {
				if (this.diffViewProvider.isEditing) {
					await this.diffViewProvider.revertChanges() // fecha a diferença visual
				}

				// se o último mensagem é parcial, precisamos atualizar e salvar
				const lastMessage = this.clineMessages.at(-1)

				if (lastMessage && lastMessage.partial) {
					// lastMessage.ts = Date.now() NÃO atualize ts, pois é usado como uma chave para a lista virtuosa
					lastMessage.partial = false
					// em vez de transmitir eventos partialMessage, fazemos um save e post como normal para persistir no disco
					console.log("updating partial message", lastMessage)
					// await this.saveClineMessages()
				}

				// Informar ao assistente que sua resposta foi interrompida para quando a tarefa for retomada
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [
						{
							type: "text",
							text:
								assistantMessage +
								`\n\n[${
									cancelReason === "streaming_failed"
										? "Response interrupted by API Error"
										: "Response interrupted by user"
								}]`,
						},
					],
				})

				// atualizar api_req_started para ter cancelado e custo, para que possamos exibir o custo do stream parcial
				updateApiReqMsg(cancelReason, streamingFailedMessage)
				await this.saveClineMessages()

				// sinaliza para o provedor que pode recuperar as mensagens salvas do disco, pois abortTask não pode ser aguardado em natureza
				this.didFinishAbortingStream = true
			}

			// reiniciar o estado de streaming
			this.currentStreamingContentIndex = 0
			this.assistantMessageContent = []
			this.didCompleteReadingStream = false
			this.userMessageContent = []
			this.userMessageContentReady = false
			this.didRejectTool = false
			this.didAlreadyUseTool = false
			this.presentAssistantMessageLocked = false
			this.presentAssistantMessageHasPendingUpdates = false
			await this.diffViewProvider.reset()

			// Só produz se o primeiro chunk for bem-sucedido, caso contrário, permitirá que o usuário tente novamente a solicitação (provavelmente devido a um erro de limitação de taxa, que é lançado no primeiro chunk).
			const stream = this.attemptApiRequest(previousApiReqIndex)
			let assistantMessage = ""
			let reasoningMessage = ""
			this.isStreaming = true

			try {
				for await (const chunk of stream) {
					if (!chunk) {
						// Às vezes, chunk é indefinido, não sei que pode causar isso, mas este workaround parece corrigir isso.
						continue
					}

					switch (chunk.type) {
						case "reasoning":
							reasoningMessage += chunk.text
							await this.say("reasoning", reasoningMessage, undefined, true)
							break
						case "usage":
							inputTokens += chunk.inputTokens
							outputTokens += chunk.outputTokens
							cacheWriteTokens += chunk.cacheWriteTokens ?? 0
							cacheReadTokens += chunk.cacheReadTokens ?? 0
							totalCost = chunk.totalCost
							break
						case "text":
							assistantMessage += chunk.text
							// analisar a mensagem de assistente bruta em blocos de conteúdo
							const prevLength = this.assistantMessageContent.length
							this.assistantMessageContent = parseAssistantMessage(assistantMessage)
							if (this.assistantMessageContent.length > prevLength) {
								this.userMessageContentReady = false // new content we need to present, reset to false in case previous content set this to true
							}
							// apresentar conteúdo ao usuário
							this.presentAssistantMessage()
							break
					}

					if (this.abort) {
						console.log(`aborting stream, this.abandoned = ${this.abandoned}`)

						if (!this.abandoned) {
							// apenas precisa abortar de formagraceful se esta instância não estiver abandonada (às vezes o stream openrouter fica preso, o que afetaria instâncias futuras de cline)
							await abortStream("user_cancelled")
						}

						break // aborts the stream
					}

					if (this.didRejectTool) {
						// userContent tem uma rejeição de ferramenta, então interrompa a resposta do assistente para apresentar o feedback do usuário
						assistantMessage += "\n\n[Response interrupted by user feedback]"
						// this.userMessageContentReady = true // instead of setting this premptively, we allow the present iterator to finish and set userMessageContentReady when its ready
						break
					}

					// PREV: precisávamos deixar a solicitação terminar para o openrouter obter detalhes de geração
					// UPDATE: é uma melhor experiência do usuário interromper a solicitação no custo da API não sendo recuperado
					if (this.didAlreadyUseTool) {
						assistantMessage +=
							"\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]"
						break
					}
				}
			} catch (error) {
				// abandoned acontece quando a extensão não está mais esperando que a instância de cline termine de abortar (o erro é lançado aqui quando qualquer função no loop lança devido a this.abort)
				if (!this.abandoned) {
					this.abortTask() // se a transmissão falhou, há vários estados em que a tarefa poderia estar (ou seja, pode ter transmitido algumas ferramentas que o usuário pode ter executado), então simplesmente voltamos a cancelar a tarefa

					await abortStream(
						"streaming_failed",
						error.message ?? JSON.stringify(serializeError(error), null, 2),
					)

					const history = await this.providerRef.deref()?.getTaskWithId(this.taskId)

					if (history) {
						await this.providerRef.deref()?.initClineWithHistoryItem(history.historyItem)
						// await this.providerRef.deref()?.postStateToWebview()
					}
				}
			} finally {
				this.isStreaming = false
			}

			// precisa chamar aqui caso a transmissão foi abortada
			if (this.abort || this.abandoned) {
				throw new Error(`[Cline#recursivelyMakeClineRequests] task ${this.taskId}.${this.instanceId} aborted`)
			}

			this.didCompleteReadingStream = true

			// definir qualquer bloco para ser completo para permitir que presentAssistantMessage termine e defina userMessageContentReady como true
			// (poderia ser um bloco de texto que não tinha ferramentas subsequentes, ou um bloco de texto no final, ou uma ferramenta inválida, etc. o que for o caso, presentAssistantMessage depende desses blocos para serem completos ou o usuário para rejeitar um bloco para poder continuar e, eventualmente, definir userMessageContentReady como true)
			const partialBlocks = this.assistantMessageContent.filter((block) => block.partial)
			partialBlocks.forEach((block) => {
				block.partial = false
			})
			// this.assistantMessageContent.forEach((e) => (e.partial = false)) // não podemos fazer isso apenas porque uma ferramenta pode estar no meio de ser executada (
			if (partialBlocks.length > 0) {
				this.presentAssistantMessage() // se houver conteúdo para atualizar, ele completará e atualizará this.userMessageContentReady para true, o que estamos realmente fazendo é apresentar o último bloco parcial que acabamos de definir como completo
			}

			updateApiReqMsg()
			await this.saveClineMessages()
			await this.providerRef.deref()?.postStateToWebview()

			// agora adicione ao apiconversationhistory
			// precisa salvar as respostas do assistente para o arquivo antes de prosseguir para o uso da ferramenta, pois o usuário pode sair a qualquer momento e não poderemos salvar a resposta do assistente
			let didEndLoop = false
			if (assistantMessage.length > 0) {
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: assistantMessage }],
				})
				telemetryService.captureConversationMessage(this.taskId, "assistant")

				// NOTA: este comentário está aqui para futura referência - isso foi um workaround para userMessageContent não sendo definido como true. Era devido a ele não chamar recursivamente para blocos parciais quando didRejectTool, então ficava preso esperando um bloco parcial para ser concluído antes de poder continuar.
				// no caso de os blocos de conteúdo terminarem
				// pode ser que a stream da API tenha terminado após o último bloco de conteúdo analisado ter sido executado, então podemos detectar o limite e definir userMessageContentReady como true (note que você não deve chamar presentAssistantMessage desde que se o último bloco estiver completo, ele será apresentado novamente)
				// const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // se houver algum bloco parcial após a stream ter terminado, podemos considerá-lo inválido
				// if (this.currentStreamingContentIndex >= completeBlocks.length) {
				// 	this.userMessageContentReady = true
				// }

				await pWaitFor(() => this.userMessageContentReady)

				// se o modelo não usou ferramentas, então precisamos dizer para ele usar uma ferramenta ou attempt_completion
				const didToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
				if (!didToolUse) {
					this.userMessageContent.push({
						type: "text",
						text: formatResponse.noToolsUsed(),
					})
					this.consecutiveMistakeCount++
				}

				const recDidEndLoop = await this.recursivelyMakeClineRequests(this.userMessageContent)
				didEndLoop = recDidEndLoop
			} else {
				// se não houver assistant_responses, isso significa que não obtivemos nenhum bloco de conteúdo de texto ou tool_use da API, o que assumimos ser um erro
				await this.say(
					"error",
					"Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
				)
				await this.addToApiConversationHistory({
					role: "assistant",
					content: [{ type: "text", text: "Failure: I did not provide a response." }],
				})
			}

			return didEndLoop // will always be false for now
		} catch (error) {
			// isso nunca deveria acontecer, pois o único que pode lançar um erro é o attemptApiRequest, que está em um try catch que envia uma pergunta onde, se noButtonClicked, limpará a tarefa atual e destruirá esta instância. No entanto, para evitar rejeição de promessa não tratada, terminaremos este loop, o que terminará a execução desta instância (veja startTask)
			return true // precisa ser true para que o loop pai saiba que precisa terminar a tarefa
		}
	}

	async loadContext(userContent: UserContent, includeFileDetails: boolean = false) {
		// Processar o array userContent, que contém vários tipos de blocos:
		// TextBlockParam, ImageBlockParam, ToolUseBlockParam, and ToolResultBlockParam.
		// Precisamos aplicar parseMentions() a:
		// 1. Todos os TextBlockParam's text (primeira mensagem do usuário com task)
		// 2. ToolResultBlockParam's content/context text arrays if it contains "<feedback>" (see formatToolDeniedFeedback, attemptCompletion, executeCommand, and consecutiveMistakeCount >= 3) or "<answer>" (see askFollowupQuestion), we place all user generated content in these tags so they can effectively be used as markers for when we should parse mentions)
		const parsedUserContent = await Promise.all(
			userContent.map(async (block) => {
				const shouldProcessMentions = (text: string) => text.includes("<task>") || text.includes("<feedback>")

				if (block.type === "text") {
					if (shouldProcessMentions(block.text)) {
						return {
							...block,
							text: await parseMentions(
								block.text,
								this.cwd,
								this.urlContentFetcher,
								this.fileContextTracker,
							),
						}
					}
					return block
				} else if (block.type === "tool_result") {
					if (typeof block.content === "string") {
						if (shouldProcessMentions(block.content)) {
							return {
								...block,
								content: await parseMentions(
									block.content,
									this.cwd,
									this.urlContentFetcher,
									this.fileContextTracker,
								),
							}
						}
						return block
					} else if (Array.isArray(block.content)) {
						const parsedContent = await Promise.all(
							block.content.map(async (contentBlock) => {
								if (contentBlock.type === "text" && shouldProcessMentions(contentBlock.text)) {
									return {
										...contentBlock,
										text: await parseMentions(
											contentBlock.text,
											this.cwd,
											this.urlContentFetcher,
											this.fileContextTracker,
										),
									}
								}
								return contentBlock
							}),
						)
						return {
							...block,
							content: parsedContent,
						}
					}
					return block
				}
				return block
			}),
		)

		const environmentDetails = await this.getEnvironmentDetails(includeFileDetails)

		return [parsedUserContent, environmentDetails]
	}

	async getEnvironmentDetails(includeFileDetails: boolean = false) {
		let details = ""

		const { terminalOutputLineLimit = 500, maxWorkspaceFiles = 200 } =
			(await this.providerRef.deref()?.getState()) ?? {}

		// Pode ser útil para cline saber se o usuário passou de um ou nenhum arquivo para outro entre mensagens, então sempre incluímos este contexto
		details += "\n\n# VSCode Visíveis Arquivos"
		const visibleFilePaths = vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(this.cwd, absolutePath))
			.slice(0, maxWorkspaceFiles)

		// Filtrar caminhos através do rooIgnoreController
		const allowedVisibleFiles = this.rooIgnoreController
			? this.rooIgnoreController.filterPaths(visibleFilePaths)
			: visibleFilePaths.map((p) => p.toPosix()).join("\n")

		if (allowedVisibleFiles) {
			details += `\n${allowedVisibleFiles}`
		} else {
			details += "\n(No visible files)"
		}

		details += "\n\n# VSCode Open Tabs"
		const { maxOpenTabsContext } = (await this.providerRef.deref()?.getState()) ?? {}
		const maxTabs = maxOpenTabsContext ?? 20
		const openTabPaths = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.map((absolutePath) => path.relative(this.cwd, absolutePath).toPosix())
			.slice(0, maxTabs)

		// Filtrar caminhos através do rooIgnoreController
		const allowedOpenTabs = this.rooIgnoreController
			? this.rooIgnoreController.filterPaths(openTabPaths)
			: openTabPaths.map((p) => p.toPosix()).join("\n")

		if (allowedOpenTabs) {
			details += `\n${allowedOpenTabs}`
		} else {
			details += "\n(No open tabs)"
		}

		// Obter terminais específicos de tarefa e de fundo
		const busyTerminals = [
			...TerminalRegistry.getTerminals(true, this.taskId),
			...TerminalRegistry.getBackgroundTerminals(true),
		]
		const inactiveTerminals = [
			...TerminalRegistry.getTerminals(false, this.taskId),
			...TerminalRegistry.getBackgroundTerminals(false),
		]

		if (busyTerminals.length > 0 && this.didEditFile) {
			await delay(300) // delay after saving file to let terminals catch up
		}

		if (busyTerminals.length > 0) {
			// aguarde os terminais esfriarem
			await pWaitFor(() => busyTerminals.every((t) => !TerminalRegistry.isProcessHot(t.id)), {
				interval: 100,
				timeout: 15_000,
			}).catch(() => {})
		}

		// queremos obter diagnósticos depois que os terminais esfriarem por vários motivos: o terminal pode estar criando um projeto, servidores de desenvolvimento (compiladores como webpack) recompile e depois enviem diagnósticos, etc
		/*
		let diagnosticsDetails = ""
		const diagnostics = await this.diagnosticsMonitor.getCurrentDiagnostics(this.didEditFile || terminalWasBusy) // se cline executou um comando (ie npm install) ou editou o workspace, aguarde um pouco para que os diagnósticos sejam atualizados
		for (const [uri, fileDiagnostics] of diagnostics) {
			const problems = fileDiagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
			if (problems.length > 0) {
				diagnosticsDetails += `\n## ${path.relative(this.cwd, uri.fsPath)}`
				for (const diagnostic of problems) {
					// let severity = diagnostic.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning"
					const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
					const source = diagnostic.source ? `[${diagnostic.source}] ` : ""
					diagnosticsDetails += `\n- ${source}Line ${line}: ${diagnostic.message}`
				}
			}
		}
		*/
		this.didEditFile = false // reset, this lets us know when to wait for saved files to update terminals

		// aguardar atualizações de diagnósticos permite que o output do terminal seja o mais atual possível
		let terminalDetails = ""
		if (busyTerminals.length > 0) {
			// terminals are cool, let's retrieve their output
			terminalDetails += "\n\n# Actively Running Terminals"
			for (const busyTerminal of busyTerminals) {
				terminalDetails += `\n## Original command: \`${busyTerminal.getLastCommand()}\``
				let newOutput = TerminalRegistry.getUnretrievedOutput(busyTerminal.id)
				if (newOutput) {
					newOutput = Terminal.compressTerminalOutput(newOutput, terminalOutputLineLimit)
					terminalDetails += `\n### New Output\n${newOutput}`
				} else {
					// details += `\n(Still running, no new output)` // não queremos mostrar isso logo após executar o comando
				}
			}
		}

		// Primeiro, verifique se qualquer terminal inativo nesta tarefa tem processos concluídos com output
		const terminalsWithOutput = inactiveTerminals.filter((terminal) => {
			const completedProcesses = terminal.getProcessesWithOutput()
			return completedProcesses.length > 0
		})

		// Only add the header if there are terminals with output
		if (terminalsWithOutput.length > 0) {
			terminalDetails += "\n\n# Inactive Terminals with Completed Process Output"

			// Process each terminal with output
			for (const inactiveTerminal of terminalsWithOutput) {
				let terminalOutputs: string[] = []

				// Obter output dos processos concluídos na fila
				const completedProcesses = inactiveTerminal.getProcessesWithOutput()
				for (const process of completedProcesses) {
					let output = process.getUnretrievedOutput()
					if (output) {
						output = Terminal.compressTerminalOutput(output, terminalOutputLineLimit)
						terminalOutputs.push(`Command: \`${process.command}\`\n${output}`)
					}
				}

				// Limpar a fila após recuperar o output
				inactiveTerminal.cleanCompletedProcessQueue()

				// Adicionar o output deste terminal ao contexto
				if (terminalOutputs.length > 0) {
					terminalDetails += `\n## Terminal ${inactiveTerminal.id}`
					terminalOutputs.forEach((output, index) => {
						terminalDetails += `\n### New Output\n${output}`
					})
				}
			}
		}

		// details += "\n\n# VSCode Workspace Errors"
		// if (diagnosticsDetails) {
		// 	details += diagnosticsDetails
		// } else {
		// 	details += "\n(No errors detected)"
		// }

		// Adicionar a seção de arquivos recentemente modificados
		const recentlyModifiedFiles = this.fileContextTracker.getAndClearRecentlyModifiedFiles()
		if (recentlyModifiedFiles.length > 0) {
			details +=
				"\n\n# Recently Modified Files\nThese files have been modified since you last accessed them (file was just edited so you may need to re-read it before editing):"
			for (const filePath of recentlyModifiedFiles) {
				details += `\n${filePath}`
			}
		}

		if (terminalDetails) {
			details += terminalDetails
		}

		// Adicionar informações de horário atual com fuso horário
		const now = new Date()
		const formatter = new Intl.DateTimeFormat(undefined, {
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
			hour12: true,
		})
		const timeZone = formatter.resolvedOptions().timeZone
		const timeZoneOffset = -now.getTimezoneOffset() / 60 // Converter para horas e inverter o sinal para corresponder à notação convencional
		const timeZoneOffsetHours = Math.floor(Math.abs(timeZoneOffset))
		const timeZoneOffsetMinutes = Math.abs(Math.round((Math.abs(timeZoneOffset) - timeZoneOffsetHours) * 60))
		const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? "+" : "-"}${timeZoneOffsetHours}:${timeZoneOffsetMinutes.toString().padStart(2, "0")}`
		details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`

		// Adicionar informações de tokens de contexto
		const { contextTokens, totalCost } = getApiMetrics(this.clineMessages)
		const modelInfo = this.api.getModel().info
		const contextWindow = modelInfo.contextWindow
		const contextPercentage =
			contextTokens && contextWindow ? Math.round((contextTokens / contextWindow) * 100) : undefined
		details += `\n\n# Current Context Size (Tokens)\n${contextTokens ? `${contextTokens.toLocaleString()} (${contextPercentage}%)` : "(Not available)"}`
		details += `\n\n# Current Cost\n${totalCost !== null ? `$${totalCost.toFixed(2)}` : "(Not available)"}`
		// Adicionar o modo atual e qualquer aviso específico do modo
		const {
			mode,
			customModes,
			apiModelId,
			customModePrompts,
			experiments = {} as Record<ExperimentId, boolean>,
			customInstructions: globalCustomInstructions,
			language,
		} = (await this.providerRef.deref()?.getState()) ?? {}
		const currentMode = mode ?? defaultModeSlug
		const modeDetails = await getFullModeDetails(currentMode, customModes, customModePrompts, {
			cwd: this.cwd,
			globalCustomInstructions,
			language: language ?? formatLanguage(vscode.env.language),
		})
		details += `\n\n# Current Mode\n`
		details += `<slug>${currentMode}</slug>\n`
		details += `<name>${modeDetails.name}</name>\n`
		details += `<model>${apiModelId}</model>\n`
		if (Experiments.isEnabled(experiments ?? {}, EXPERIMENT_IDS.POWER_STEERING)) {
			details += `<role>${modeDetails.roleDefinition}</role>\n`
			if (modeDetails.customInstructions) {
				details += `<custom_instructions>${modeDetails.customInstructions}</custom_instructions>\n`
			}
		}

		// Adicionar aviso se não estiver no modo de código
		if (
			!isToolAllowedForMode("write_to_file", currentMode, customModes ?? [], {
				apply_diff: this.diffEnabled,
			}) &&
			!isToolAllowedForMode("apply_diff", currentMode, customModes ?? [], { apply_diff: this.diffEnabled })
		) {
			const currentModeName = getModeBySlug(currentMode, customModes)?.name ?? currentMode
			const defaultModeName = getModeBySlug(defaultModeSlug, customModes)?.name ?? defaultModeSlug
			details += `\n\nNOTE: You are currently in '${currentModeName}' mode, which does not allow write operations. To write files, the user will need to switch to a mode that supports file writing, such as '${defaultModeName}' mode.`
		}

		if (includeFileDetails) {
			details += `\n\n# Current Workspace Directory (${this.cwd.toPosix()}) Files\n`
			const isDesktop = arePathsEqual(this.cwd, path.join(os.homedir(), "Desktop"))
			if (isDesktop) {
				// não queremos acessar o desktop imediatamente, pois isso mostraria uma janela de permissão
				details += "(Desktop files not shown automatically. Use list_files to explore if needed.)"
			} else {
				const maxFiles = maxWorkspaceFiles ?? 200
				const [files, didHitLimit] = await listFiles(this.cwd, true, maxFiles)
				const { showRooIgnoredFiles = true } = (await this.providerRef.deref()?.getState()) ?? {}
				const result = formatResponse.formatFilesList(
					this.cwd,
					files,
					didHitLimit,
					this.rooIgnoreController,
					showRooIgnoredFiles,
				)
				details += result
			}
		}

		return `<environment_details>\n${details.trim()}\n</environment_details>`
	}

	// Checkpoints

	private getCheckpointService() {
		if (!this.enableCheckpoints) {
			return undefined
		}

		if (this.checkpointService) {
			return this.checkpointService
		}

		if (this.checkpointServiceInitializing) {
			console.log("[Cline#getCheckpointService] checkpoint service is still initializing")
			return undefined
		}

		const log = (message: string) => {
			console.log(message)

			try {
				this.providerRef.deref()?.log(message)
			} catch (err) {
				// NO-OP
			}
		}

		console.log("[Cline#getCheckpointService] initializing checkpoints service")

		try {
			const workspaceDir = getWorkspacePath()

			if (!workspaceDir) {
				log("[Cline#getCheckpointService] workspace folder not found, disabling checkpoints")
				this.enableCheckpoints = false
				return undefined
			}

			const globalStorageDir = this.providerRef.deref()?.context.globalStorageUri.fsPath

			if (!globalStorageDir) {
				log("[Cline#getCheckpointService] globalStorageDir not found, disabling checkpoints")
				this.enableCheckpoints = false
				return undefined
			}

			const options: CheckpointServiceOptions = {
				taskId: this.taskId,
				workspaceDir,
				shadowDir: globalStorageDir,
				log,
			}

			// Apenas `task` é suportado no momento, até que possamos descobrir como
			// isolar o `workspace` variante.
			// const service =
			// 	this.checkpointStorage === "task"
			// 		? RepoPerTaskCheckpointService.create(options)
			// 		: RepoPerWorkspaceCheckpointService.create(options)

			const service = RepoPerTaskCheckpointService.create(options)

			this.checkpointServiceInitializing = true

			service.on("initialize", () => {
				log("[Cline#getCheckpointService] service initialized")

				try {
					const isCheckpointNeeded =
						typeof this.clineMessages.find(({ say }) => say === "checkpoint_saved") === "undefined"

					this.checkpointService = service
					this.checkpointServiceInitializing = false

					if (isCheckpointNeeded) {
						log("[Cline#getCheckpointService] no checkpoints found, saving initial checkpoint")
						this.checkpointSave()
					}
				} catch (err) {
					log("[Cline#getCheckpointService] caught error in on('initialize'), disabling checkpoints")
					this.enableCheckpoints = false
				}
			})

			service.on("checkpoint", ({ isFirst, fromHash: from, toHash: to }) => {
				try {
					this.providerRef.deref()?.postMessageToWebview({ type: "currentCheckpointUpdated", text: to })

					this.say("checkpoint_saved", to, undefined, undefined, { isFirst, from, to }).catch((err) => {
						log("[Cline#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					})
				} catch (err) {
					log(
						"[Cline#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints",
					)
					console.error(err)
					this.enableCheckpoints = false
				}
			})

			log("[Cline#getCheckpointService] initializing shadow git")

			service.initShadowGit().catch((err) => {
				log(
					`[Cline#getCheckpointService] caught unexpected error in initShadowGit, disabling checkpoints (${err.message})`,
				)
				console.error(err)
				this.enableCheckpoints = false
			})

			return service
		} catch (err) {
			log("[Cline#getCheckpointService] caught unexpected error, disabling checkpoints")
			this.enableCheckpoints = false
			return undefined
		}
	}

	private async getInitializedCheckpointService({
		interval = 250,
		timeout = 15_000,
	}: { interval?: number; timeout?: number } = {}) {
		const service = this.getCheckpointService()

		if (!service || service.isInitialized) {
			return service
		}

		try {
			await pWaitFor(
				() => {
					console.log("[Cline#getCheckpointService] waiting for service to initialize")
					return service.isInitialized
				},
				{ interval, timeout },
			)

			return service
		} catch (err) {
			return undefined
		}
	}

	public async checkpointDiff({
		ts,
		previousCommitHash,
		commitHash,
		mode,
	}: {
		ts: number
		previousCommitHash?: string
		commitHash: string
		mode: "full" | "checkpoint"
	}) {
		const service = await this.getInitializedCheckpointService()

		if (!service) {
			return
		}

		telemetryService.captureCheckpointDiffed(this.taskId)

		if (!previousCommitHash && mode === "checkpoint") {
			const previousCheckpoint = this.clineMessages
				.filter(({ say }) => say === "checkpoint_saved")
				.sort((a, b) => b.ts - a.ts)
				.find((message) => message.ts < ts)

			previousCommitHash = previousCheckpoint?.text
		}

		try {
			const changes = await service.getDiff({ from: previousCommitHash, to: commitHash })

			if (!changes?.length) {
				vscode.window.showInformationMessage("No changes found.")
				return
			}

			await vscode.commands.executeCommand(
				"vscode.changes",
				mode === "full" ? "Changes since task started" : "Changes since previous checkpoint",
				changes.map((change) => [
					vscode.Uri.file(change.paths.absolute),
					vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
						query: Buffer.from(change.content.before ?? "").toString("base64"),
					}),
					vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
						query: Buffer.from(change.content.after ?? "").toString("base64"),
					}),
				]),
			)
		} catch (err) {
			this.providerRef.deref()?.log("[checkpointDiff] disabling checkpoints for this task")
			this.enableCheckpoints = false
		}
	}

	public async checkpointSave() {
		const service = this.getCheckpointService()

		if (!service) {
			return
		}

		if (!service.isInitialized) {
			this.providerRef
				.deref()
				?.log("[checkpointSave] checkpoints didn't initialize in time, disabling checkpoints for this task")

			this.enableCheckpoints = false
			return
		}

		telemetryService.captureCheckpointCreated(this.taskId)

		// Inicie o processo de checkpoint em segundo plano.
		return service.saveCheckpoint(`Task: ${this.taskId}, Time: ${Date.now()}`).catch((err) => {
			console.error("[Cline#checkpointSave] capturou um erro inesperado, desabilitando checkpoints", err)
			this.enableCheckpoints = false
		})
	}

	public async checkpointRestore({
		ts,
		commitHash,
		mode,
	}: {
		ts: number
		commitHash: string
		mode: "preview" | "restore"
	}) {
		const service = await this.getInitializedCheckpointService()

		if (!service) {
			return
		}

		const index = this.clineMessages.findIndex((m) => m.ts === ts)

		if (index === -1) {
			return
		}

		try {
			await service.restoreCheckpoint(commitHash)

			telemetryService.captureCheckpointRestored(this.taskId)

			await this.providerRef.deref()?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })

			if (mode === "restore") {
				await this.overwriteApiConversationHistory(
					this.apiConversationHistory.filter((m) => !m.ts || m.ts < ts),
				)

				const deletedMessages = this.clineMessages.slice(index + 1)

				const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
					combineApiRequests(combineCommandSequences(deletedMessages)),
				)

				await this.overwriteClineMessages(this.clineMessages.slice(0, index + 1))

				// TODO: Verifique se isso está funcionando conforme o esperado.
				await this.say(
					"api_req_deleted",
					JSON.stringify({
						tokensIn: totalTokensIn,
						tokensOut: totalTokensOut,
						cacheWrites: totalCacheWrites,
						cacheReads: totalCacheReads,
						cost: totalCost,
					} satisfies ClineApiReqInfo),
				)
			}

			// A tarefa já está cancelada pelo provedor antes, mas precisamos re-inicializar para obter as mensagens atualizadas.
			//
			// Isso foi tomado da implementação de checkpoints de Cline. A instância de cline ficará pendência se não cancelarmos duas vezes,
			// então isso é necessário no momento, mas parece uma solução complicada e hacky para um problema que não entendo completamente.
			// Gostaria de revisar isso no futuro e tentar melhorar o fluxo de tarefas e a comunicação entre o webview e a instância de cline.
			this.providerRef.deref()?.cancelTask()
		} catch (err) {
			this.providerRef.deref()?.log("[checkpointRestore] disabling checkpoints for this task")
			this.enableCheckpoints = false
		}
	}

	// Acessador público para fileContextTracker
	public getFileContextTracker(): FileContextTracker {
		return this.fileContextTracker
	}
}
