import { IpcClient } from "../src/ipcClient"

async function main(socketPath: string) {
	try {
		const startTime = Date.now()
		const client = new IpcClient(socketPath)
		client.connect()

		while (!client.isConnected) {
			if (Date.now() - startTime > 5000) {
				throw new Error("Failed to connect to server.")
			}

			await new Promise((resolve) => setTimeout(resolve, 1000))
		}

		while (client.isConnected) {
			client.ping()
			await new Promise((resolve) => setTimeout(resolve, 5000))
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
