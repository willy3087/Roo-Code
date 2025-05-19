import { ServerConfigSchema } from "../McpHub"
const fs = require("fs/promises")
const { McpHub } = require("../McpHub")
jest.mock("vscode", () => ({
	workspace: {
		createFileSystemWatcher: jest.fn().mockReturnValue({
			onDidChange: jest.fn(),
			onDidCreate: jest.fn(),
			onDidDelete: jest.fn(),
			dispose: jest.fn(),
		}),
		onDidSaveTextDocument: jest.fn(),
		onDidChangeWorkspaceFolders: jest.fn(),
		workspaceFolders: [],
	},
	window: {
		showErrorMessage: jest.fn(),
		showInformationMessage: jest.fn(),
		showWarningMessage: jest.fn(),
	},
	Disposable: {
		from: jest.fn(),
	},
}))
jest.mock("fs/promises")
jest.mock("../../../core/webview/ClineProvider")
describe("McpHub", () => {
	let mcpHub
	let mockProvider
	// Store original console methods
	const originalConsoleError = console.error
	beforeEach(() => {
		jest.clearAllMocks()
		// Mock console.error to suppress error messages during tests
		console.error = jest.fn()
		const mockUri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: jest.fn(),
			toJSON: jest.fn(),
		}
		mockProvider = {
			ensureSettingsDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: jest.fn(),
			context: {
				subscriptions: [],
				workspaceState: {},
				globalState: {},
				secrets: {},
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				globalStoragePath: "/test/global-storage",
				environmentVariableCollection: {},
				extension: {
					id: "test-extension",
					extensionUri: mockUri,
					extensionPath: "/test/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: {
						version: "1.0.0",
					},
					activate: jest.fn(),
					exports: undefined,
				},
				asAbsolutePath: (path) => path,
				storageUri: mockUri,
				globalStorageUri: mockUri,
				logUri: mockUri,
				extensionMode: 1,
				logPath: "/test/path",
				languageModelAccessInformation: {},
			},
		}
		fs.readFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["allowed-tool"],
					},
				},
			}),
		)
		mcpHub = new McpHub(mockProvider)
	})
	afterEach(() => {
		// Restore original console methods
		console.error = originalConsoleError
	})
	describe("toggleToolAlwaysAllow", () => {
		it("should add tool to always allow list when enabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: [],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)
			// Verify the config was updated correctly
			const writeCalls = fs.writeFile.mock.calls
			expect(writeCalls.length).toBeGreaterThan(0)
			// Find the write call
			const callToUse = writeCalls[writeCalls.length - 1]
			expect(callToUse).toBeTruthy()
			// The path might be normalized differently on different platforms,
			// so we'll just check that we have a call with valid content
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(Array.isArray(writtenConfig.mcpServers["test-server"].alwaysAllow)).toBe(true)
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
		it("should remove tool from always allow list when disabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["existing-tool"],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "existing-tool", false)
			// Verify the config was updated correctly
			const writeCalls = fs.writeFile.mock.calls
			expect(writeCalls.length).toBeGreaterThan(0)
			// Find the write call
			const callToUse = writeCalls[writeCalls.length - 1]
			expect(callToUse).toBeTruthy()
			// The path might be normalized differently on different platforms,
			// so we'll just check that we have a call with valid content
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"]).toBeDefined()
			expect(Array.isArray(writtenConfig.mcpServers["test-server"].alwaysAllow)).toBe(true)
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).not.toContain("existing-tool")
		})
		it("should initialize alwaysAllow if it does not exist", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "global", "new-tool", true)
			// Verify the config was updated with initialized alwaysAllow
			// Find the write call with the normalized path
			const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
			const writeCalls = fs.writeFile.mock.calls
			// Find the write call with the normalized path
			const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
			const callToUse = writeCall || writeCalls[0]
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
	})
	describe("server disabled state", () => {
		it("should toggle server disabled state", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						type: "stdio",
						command: "node",
						args: ["test.js"],
						disabled: false,
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleServerDisabled("test-server", true)
			// Verify the config was updated correctly
			// Find the write call with the normalized path
			const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
			const writeCalls = fs.writeFile.mock.calls
			// Find the write call with the normalized path
			const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
			const callToUse = writeCall || writeCalls[0]
			const writtenConfig = JSON.parse(callToUse[1])
			expect(writtenConfig.mcpServers["test-server"].disabled).toBe(true)
		})
		it("should filter out disabled servers from getServers", () => {
			const mockConnections = [
				{
					server: {
						name: "enabled-server",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {},
					transport: {},
				},
				{
					server: {
						name: "disabled-server",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {},
					transport: {},
				},
			]
			mcpHub.connections = mockConnections
			const servers = mcpHub.getServers()
			expect(servers.length).toBe(1)
			expect(servers[0].name).toBe("enabled-server")
		})
		it("should prevent calling tools on disabled servers", async () => {
			const mockConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				},
				transport: {},
			}
			mcpHub.connections = [mockConnection]
			await expect(mcpHub.callTool("disabled-server", "some-tool", {})).rejects.toThrow(
				'Server "disabled-server" is disabled and cannot be used',
			)
		})
		it("should prevent reading resources from disabled servers", async () => {
			const mockConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn(),
				},
				transport: {},
			}
			mcpHub.connections = [mockConnection]
			await expect(mcpHub.readResource("disabled-server", "some/uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})
	})
	describe("callTool", () => {
		it("should execute tool successfully", async () => {
			// Mock the connection with a minimal client implementation
			const mockConnection = {
				server: {
					name: "test-server",
					config: JSON.stringify({}),
					status: "connected",
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				},
				transport: {
					start: jest.fn(),
					close: jest.fn(),
					stderr: { on: jest.fn() },
				},
			}
			mcpHub.connections = [mockConnection]
			await mcpHub.callTool("test-server", "some-tool", {})
			// Verify the request was made with correct parameters
			expect(mockConnection.client.request).toHaveBeenCalledWith(
				{
					method: "tools/call",
					params: {
						name: "some-tool",
						arguments: {},
					},
				},
				expect.any(Object),
				expect.objectContaining({ timeout: 60000 }),
			)
		})
		it("should throw error if server not found", async () => {
			await expect(mcpHub.callTool("non-existent-server", "some-tool", {})).rejects.toThrow(
				"No connection found for server: non-existent-server",
			)
		})
		describe("timeout configuration", () => {
			it("should validate timeout values", () => {
				// Test valid timeout values
				const validConfig = {
					type: "stdio",
					command: "test",
					timeout: 60,
				}
				expect(() => ServerConfigSchema.parse(validConfig)).not.toThrow()
				// Test invalid timeout values
				const invalidConfigs = [
					{ type: "stdio", command: "test", timeout: 0 }, // Too low
					{ type: "stdio", command: "test", timeout: 3601 }, // Too high
					{ type: "stdio", command: "test", timeout: -1 }, // Negative
				]
				invalidConfigs.forEach((config) => {
					expect(() => ServerConfigSchema.parse(config)).toThrow()
				})
			})
			it("should use default timeout of 60 seconds if not specified", async () => {
				const mockConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ type: "stdio", command: "test" }), // No timeout specified
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					},
					transport: {},
				}
				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")
				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }),
				)
			})
			it("should apply configured timeout to tool calls", async () => {
				const mockConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({ type: "stdio", command: "test", timeout: 120 }), // 2 minutes
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					},
					transport: {},
				}
				mcpHub.connections = [mockConnection]
				await mcpHub.callTool("test-server", "test-tool")
				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 120000 }),
				)
			})
		})
		describe("updateServerTimeout", () => {
			it("should update server timeout in settings file", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}
				fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
				await mcpHub.updateServerTimeout("test-server", 120)
				// Verify the config was updated correctly
				// Find the write call with the normalized path
				const normalizedSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
				const writeCalls = fs.writeFile.mock.calls
				// Find the write call with the normalized path
				const writeCall = writeCalls.find((call) => call[0] === normalizedSettingsPath)
				const callToUse = writeCall || writeCalls[0]
				const writtenConfig = JSON.parse(callToUse[1])
				expect(writtenConfig.mcpServers["test-server"].timeout).toBe(120)
			})
			it("should fallback to default timeout when config has invalid timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}
				fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
				// Update with invalid timeout
				await mcpHub.updateServerTimeout("test-server", 3601)
				// Config is written
				expect(fs.writeFile).toHaveBeenCalled()
				// Setup connection with invalid timeout
				const mockConnection = {
					server: {
						name: "test-server",
						config: JSON.stringify({
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 3601, // Invalid timeout
						}),
						status: "connected",
					},
					client: {
						request: jest.fn().mockResolvedValue({ content: [] }),
					},
					transport: {},
				}
				mcpHub.connections = [mockConnection]
				// Call tool - should use default timeout
				await mcpHub.callTool("test-server", "test-tool")
				// Verify default timeout was used
				expect(mockConnection.client.request).toHaveBeenCalledWith(
					expect.anything(),
					expect.anything(),
					expect.objectContaining({ timeout: 60000 }),
				)
			})
			it("should accept valid timeout values", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}
				fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
				// Test valid timeout values
				const validTimeouts = [1, 60, 3600]
				for (const timeout of validTimeouts) {
					await mcpHub.updateServerTimeout("test-server", timeout)
					expect(fs.writeFile).toHaveBeenCalled()
					jest.clearAllMocks() // Reset for next iteration
					fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
				}
			})
			it("should notify webview after updating timeout", async () => {
				const mockConfig = {
					mcpServers: {
						"test-server": {
							type: "stdio",
							command: "node",
							args: ["test.js"],
							timeout: 60,
						},
					},
				}
				fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
				await mcpHub.updateServerTimeout("test-server", 120)
				expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
					expect.objectContaining({
						type: "mcpServers",
					}),
				)
			})
		})
	})
})
//# sourceMappingURL=McpHub.test.js.map
