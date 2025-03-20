import { z } from "zod"

/**
 * Client
 */

export enum ClientMessageType {
	Message = "message",
	Ping = "ping",
}

export const clientMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ClientMessageType.Message),
		data: z.object({
			clientId: z.string(),
			message: z.string(),
		}),
	}),
	z.object({
		type: z.literal(ClientMessageType.Ping),
		data: z.object({
			clientId: z.string(),
		}),
	}),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

/**
 * Server
 */

export enum ServerMessageType {
	Hello = "hello",
	Pong = "pong",
}

export const serverMessageSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal(ServerMessageType.Hello),
		data: z.object({
			clientId: z.string(),
		}),
	}),
	z.object({
		type: z.literal(ServerMessageType.Pong),
	}),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>
