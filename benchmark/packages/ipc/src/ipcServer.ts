import { Socket } from "node:net"
import * as crypto from "node:crypto"
import EventEmitter from "node:events"

import ipc from "node-ipc"

import { ClientMessageType, ServerMessage, ServerMessageType, clientMessageSchema } from "./types.js"

type IpcServerEvents = {
	client: [id: string]
}

export class IpcServer extends EventEmitter<IpcServerEvents> {
	private readonly _socketPath: string
	private readonly _log: (...args: unknown[]) => void
	private readonly _clients: Map<string, Socket>

	private _isListening = false

	constructor(socketPath: string, log = console.log) {
		super()

		this._socketPath = socketPath
		this._log = log
		this._clients = new Map()
	}

	public listen() {
		this._isListening = true

		ipc.config.silent = true

		ipc.serve(this.socketPath, () => {
			ipc.server.on("connect", (socket) => this.onConnect(socket))
			ipc.server.on("message", (data, socket) => this.onMessage(data, socket))
			ipc.server.on("socket.disconnected", (socket) => this.onDisconnect(socket))
		})

		ipc.server.start()
	}

	private onConnect(socket: Socket) {
		const clientId = crypto.randomBytes(6).toString("hex")
		this._clients.set(clientId, socket)
		this.log(`[server#onConnect] clientId = ${clientId}, # clients = ${this._clients.size}`)
		this.send(socket, { type: ServerMessageType.Hello, data: { clientId } })
		this.emit("client", clientId)
	}

	private onMessage(data: unknown, socket: Socket) {
		if (typeof data !== "object") {
			this.log("[server#onMessage] invalid data", data)
			return
		}

		const result = clientMessageSchema.safeParse(data)

		if (!result.success) {
			this.log("[server#onMessage] invalid payload", result.error)
			return
		}

		const payload = result.data

		switch (payload.type) {
			case ClientMessageType.Message:
				this.log(`[server#Message] ${payload.data.message}`)
				break
			case ClientMessageType.Ping:
				this.log(`[server#Ping]`)
				this.send(socket, { type: ServerMessageType.Pong })
				break
		}
	}

	private onDisconnect(destroyedSocket: Socket) {
		let destroyedClientId: string | undefined

		for (const [clientId, socket] of this._clients.entries()) {
			if (socket === destroyedSocket) {
				destroyedClientId = clientId
				this._clients.delete(clientId)
				break
			}
		}

		this.log(`[server#socket.disconnected] clientId = ${destroyedClientId}, # clients = ${this._clients.size}`)
	}

	private log(...args: unknown[]) {
		this._log(...args)
	}

	public broadcast(message: ServerMessage) {
		this.log("[server#broadcast] message =", message)
		ipc.server.broadcast("message", message)
	}

	public send(client: string | Socket, message: ServerMessage) {
		this.log("[server#send] message =", message)

		if (typeof client === "string") {
			const socket = this._clients.get(client)

			if (socket) {
				ipc.server.emit(socket, "message", message)
			}
		} else {
			ipc.server.emit(client, "message", message)
		}
	}

	public get socketPath() {
		return this._socketPath
	}

	public get isListening() {
		return this._isListening
	}
}
