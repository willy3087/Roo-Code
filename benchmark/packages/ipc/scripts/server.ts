import { IpcServer } from "../src/ipcServer"
import { ServerMessageType } from "../src/types"

async function main(socketPath: string) {
	try {
		const server = new IpcServer(socketPath)
		server.listen()
		console.log(`listening @ ${server.socketPath}`)

		while (server.isListening) {
			server.broadcast({ type: ServerMessageType.Message, data: { message: "hello" } })
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		process.exit(0)
	} catch (e) {
		console.error(e)
		process.exit(1)
	}
}

if (!process.argv[2]) {
	console.error("Usage: npx tsx scripts/client.ts <socketPath>")
	process.exit(1)
}

main(process.argv[2])
