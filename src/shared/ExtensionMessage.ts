// type that represents json data that is sent from extension to webview, called ExtensionMessage and has 'type' enum which can be 'plusButtonTapped' or 'settingsButtonTapped' or 'hello'

// webview will hold state
export interface ExtensionMessage {
    type: "action" | "state"
    text?: string
    action?: "plusButtonTapped" | "settingsButtonTapped" | "didBecomeVisible"
    state?: { didOpenOnce: boolean, apiKey?: string, maxRequestsPerTask?: number, claudeMessages: ClaudeMessage[] }
}

export interface ClaudeMessage {
    ts: number
    type: "ask" | "say"
    ask?: ClaudeAsk
    say?: ClaudeSay
    text?: string
}

export type ClaudeAsk = "request_limit_reached" | "followup" | "command" | "completion_result" | "tool"
export type ClaudeSay = "task" | "error" | "api_req_started" | "api_req_finished" | "text" | "command_output" | "completion_result"

export interface ClaudeSayTool {
    tool: "editedExistingFile" | "newFileCreated" | "readFile" | "listFiles"
    path?: string
    diff?: string
    content?: string
}