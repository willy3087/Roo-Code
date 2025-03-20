import ipc from "node-ipc"

import { ClientMessage, ClientMessageType, ServerMessageType, serverMessageSchema } from "./schemas"

export class IpcClient {
	private readonly _socketPath: string
	private _isConnected = false
	private _clientId?: string

	constructor(socketPath: string) {
		this._socketPath = socketPath
	}

	connect() {
		ipc.config.silent = true

		ipc.connectTo("benchmarkServer", this.socketPath, () => {
			ipc.of.benchmarkServer.on("connect", (args) => this.onConnect(args))
			ipc.of.benchmarkServer.on("message", (data) => this.onMessage(data))
			ipc.of.benchmarkServer.on("disconnect", (args) => this.onDisconnect(args))
		})
	}

	private onConnect(args: unknown) {
		console.log("[client#onConnect]", args)
		this._isConnected = true
	}

	private onMessage(data: unknown) {
		if (typeof data !== "object") {
			console.log("[client#onMessage] invalid data", data)
			return
		}

		const result = serverMessageSchema.safeParse(data)

		if (!result.success) {
			console.log("[client#onMessage] invalid payload", result.error)
			return
		}

		const payload = result.data

		switch (payload.type) {
			case ServerMessageType.Hello:
				console.log(`[client#Hello] ${payload.data.clientId}`)
				this._clientId = payload.data.clientId
				break
			case ServerMessageType.Pong:
				console.log(`[client#Pong]`)
				break
		}
	}

	private onDisconnect(args: unknown) {
		console.log("[client#onDisconnect]", args)
		this._isConnected = false
	}

	public sendMessage(message: ClientMessage) {
		ipc.of.benchmarkServer.emit("message", message)
	}

	public ping() {
		if (!this.isReady) {
			return false
		}

		this.sendMessage({ type: ClientMessageType.Ping, data: { clientId: this._clientId! } })
		return true
	}

	public get socketPath() {
		return this._socketPath
	}

	public get clientId() {
		return this._clientId
	}

	public get isConnected() {
		return this._isConnected
	}

	public get isReady() {
		return this._isConnected && this._clientId !== undefined
	}
}
