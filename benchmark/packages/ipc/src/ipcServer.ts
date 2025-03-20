import { Socket } from "node:net"
import ipc from "node-ipc"
import * as os from "node:os"
import * as path from "node:path"
import * as crypto from "node:crypto"

import { ClientMessageType, ServerMessage, ServerMessageType, clientMessageSchema } from "./types.js"

export class IpcServer {
	private _isListening = false
	private _socketId: string
	private _clients: Map<string, Socket>

	constructor() {
		this._socketId = "benchmark"
		this._clients = new Map()
	}

	public listen() {
		this._isListening = true

		ipc.config.id = this._socketId
		ipc.config.silent = true

		ipc.serve(this.socketPath, () => {
			ipc.server.on("connect", (socket) => this.onConnect(socket))
			ipc.server.on("message", (data, socket) => this.onMessage(data, socket))
			ipc.server.on("socket.disconnected", (socket, id) => this.onDisconnect(socket, id))
		})

		ipc.server.start()
	}

	private onConnect(socket: Socket) {
		const clientId = crypto.randomBytes(6).toString("hex")
		console.log(`[server#onConnect]`, clientId)
		this._clients.set(clientId, socket)
		this.sendMessage(socket, { type: ServerMessageType.Hello, data: { clientId } })
	}

	private onMessage(data: unknown, socket: Socket) {
		if (typeof data !== "object") {
			console.log("[server#onMessage] invalid data", data)
			return
		}

		const result = clientMessageSchema.safeParse(data)

		if (!result.success) {
			console.log("[server#onMessage] invalid payload", result.error)
			return
		}

		const payload = result.data

		switch (payload.type) {
			case ClientMessageType.Message:
				console.log(`[server#Message] ${payload.data.message}`)
				break
			case ClientMessageType.Ping:
				console.log(`[server#Ping]`)
				this.sendMessage(socket, { type: ServerMessageType.Pong })
				break
		}
	}

	private onDisconnect(socket: Socket, destroyedSocketID: string) {
		console.log(`[server#socket.disconnected] ${destroyedSocketID}`)
	}

	public sendMessage(socket: Socket, message: ServerMessage) {
		ipc.server.emit(socket, "message", message)
	}

	public get socketPath() {
		return path.join(os.tmpdir(), `${this._socketId}.sock`)
	}

	public get isListening() {
		return this._isListening
	}
}
