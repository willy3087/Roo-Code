import EventEmitter from "node:events"
import ipc from "node-ipc"

import { ClientMessage, ClientMessageType, ServerMessage, ServerMessageType, serverMessageSchema } from "./types.js"

export interface IpcClientEvents {
	connect: []
	message: [data: ServerMessage]
	disconnect: []
}

export class IpcClient extends EventEmitter<IpcClientEvents> {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void

	private _isConnected = false
	private _clientId?: string

	constructor(socketPath: string, log = console.log) {
		super()

		this._socketPath = socketPath
		this._log = log

		ipc.config.silent = true

		ipc.connectTo("benchmarkServer", this.socketPath, () => {
			ipc.of.benchmarkServer?.on("connect", (args) => this.onConnect(args))
			ipc.of.benchmarkServer?.on("message", (data) => this.onMessage(data))
			ipc.of.benchmarkServer?.on("disconnect", (args) => this.onDisconnect(args))
		})
	}

	private onConnect(args: unknown) {
		if (this._isConnected) {
			return
		}

		this.log("[client#onConnect]", args)
		this._isConnected = true
		this.emit("connect")
	}

	private onMessage(data: unknown) {
		if (typeof data !== "object") {
			this._log("[client#onMessage] invalid data", data)
			return
		}

		const result = serverMessageSchema.safeParse(data)

		if (!result.success) {
			this.log("[client#onMessage] invalid payload", result.error)
			return
		}

		const payload = result.data

		switch (payload.type) {
			case ServerMessageType.Hello:
				this.log(`[client#Hello] ${payload.data.clientId}`)
				this._clientId = payload.data.clientId
				break
			case ServerMessageType.Pong:
				this.log(`[client#Pong]`)
				break
		}

		this.emit("message", payload)
	}

	private onDisconnect(args: unknown) {
		if (!this._isConnected) {
			return
		}

		this.log("[client#onDisconnect]", args)
		this._isConnected = false
		this.emit("disconnect")
	}

	public sendMessage(message: ClientMessage) {
		ipc.of.benchmarkServer?.emit("message", message)
	}

	private log(...args: unknown[]) {
		this._log(...args)
	}

	public ping() {
		if (!this.isReady) {
			return false
		}

		this.sendMessage({ type: ClientMessageType.Ping, data: { clientId: this._clientId! } })
		return true
	}

	public disconnect() {
		try {
			ipc.disconnect("benchmarkServer")
			// @TODO: Should we set _disconnect here?
		} catch (error) {
			this.log("[client#disconnect] error disconnecting", error)
		}
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
