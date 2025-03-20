import { z } from "zod"

/**
 * Client
 */

export enum ClientMessageType {
	Ping = "ping",
	Message = "message",
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
	Message = "message",
	Data = "data",
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
	z.object({
		type: z.literal(ServerMessageType.Message),
		data: z.object({
			message: z.string(),
		}),
	}),
	z.object({
		type: z.literal(ServerMessageType.Data),
		data: z.unknown(),
	}),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>
