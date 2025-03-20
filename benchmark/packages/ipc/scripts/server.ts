import { IpcServer } from "../src/ipcServer"

async function main() {
	try {
		const server = new IpcServer()
		server.listen()
		console.log(`listening @ ${server.socketPath}`)

		while (server.isListening) {
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		process.exit(0)
	} catch (e) {
		console.error(e)
		process.exit(1)
	}
}

main()
