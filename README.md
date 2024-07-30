# Claude Dev

<p align="center">
  <img src="https://media.githubusercontent.com/media/saoudrizwan/claude-dev/main/demo.gif" width="100%" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev"><strong>Download VSCode Extension</strong></a>
</p>

Thanks to [Claude 3.5 Sonnet's agentic coding capabilities](https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf) Claude Dev can handle complex software development tasks step-by-step. With tools that let him read & write files, analyze project source code, and execute terminal commands (after you grant permission), he can assist you in ways that go beyond simple code completion or tech support. From building software projects to running system operations, Claude Dev is only limited by your imagination.

While autonomous AI scripts traditionally run in sandboxed environments, Claude Dev offers a human-in-the-loop GUI to supervise every file change and command executed, providing a safe and accessible way to explore the potential of agentic AI.

-   View syntax highlighted file previews and diffs for every change Claude makes
-   Runs CLI commands directly in chat, so you never have to open a terminal yourself (+ respond to interactive commands by sending a message)
-   Presents permission buttons (i.e. 'Approve CLI command') before tool use or sending information to the API
-   Keep track of total tokens and API usage cost for the entire task loop and individual requests
-   Set a maximum # of API requests allowed for a task before being prompted for permission to proceed
-   When a task is completed, Claude Dev determines if he can present the result to you with a CLI command like `open -a "Google Chrome" index.html`, which you run with a click of a button

_**Pro tip**: Use the `Cmd + Shift + P` shortcut to open the command palette and type `Claude Dev: Open In New Tab` to start a new task right in your editor._

## How it works

Claude Dev uses an agentic loop style implementation with chain-of-thought prompting and access to powerful tools that give him the ability to accomplish nearly any task. Start by providing a task and the agentic loop fires off, where it might use certain tools (with your permission) to accomplish each step in its thought process.

### Tools

Claude Dev has access to the following capabilities:

1. **`execute_command`**: Execute CLI commands on the system (only with your permission, output is streamed into the chat and you can respond to stdin or exit long-running processes when you're ready)
2. **`analyze_project`**: Analyze the project's source code and file structure (see more below)
3. **`list_files`**: List all file paths at the top level of the specified directory (useful for generic file operations like retrieving a file from your Desktop)
4. **`read_file`**: Read the contents of a file at the specified path
5. **`write_to_file`**: Write content to a file at the specified path, automatically creating any necessary directories
6. **`ask_followup_question`**: Ask the user a question to gather additional information needed to complete a task (due to the autonomous nature of the program, this isn't a typical chatbot–Claude Dev must explicitly interrupt his task loop to ask for more information)
7. **`attempt_completion`**: Present the result to the user after completing a task, potentially with a CLI command to kickoff a demonstration

### Working in Existing Projects

The `analyze_project` tool uses [tree-sitter](https://github.com/tree-sitter/tree-sitter) to parse source code with custom tag queries that extract names of classes, functions, methods, and other definitions. This approach leverages the fact that large language models are fundamentally built on natural language processing–by focusing on these named elements, we provide the LLM with a structural understanding of the codebase that aligns closely with how developers conceptualize and organize their code.

This method is particularly effective because:

-   Developers typically name components to reflect their purpose and role within the larger system.
-   These names often encapsulate high-level concepts and relationships that are crucial for understanding the overall architecture.
-   By effectively extracting the "language" of the codebase, we enable the LLM to grasp structure and intent without wasting context on implementation details.

Here's how `analyze_project` works:

1. It scans your project directory, identifying source code files that tree-sitter can parse. Any unparsed files' paths will be listed at the end of the output so that Claude can request to manually read them if necessary.
2. It parses each file into an abstract syntax tree and applies a language-specific query to extract definition names. You can see the exact query used for each language in `src/analyze-project/queries`.
3. The results are formatted into a concise & readable output that Claude can easily interpret to quickly understand the structure and purpose of your entire codebase, making it more effective at assisting with complex development tasks.

### Only With Your Permission

Claude always asks for your permission first before any tools are executed or information is sent back to the API. This puts you in control of this agentic loop, every step of the way.

![image](https://github.com/saoudrizwan/claude-dev/assets/7799382/e6435441-9400-41c9-98a9-63f75c5d45be)

## Contribution

Feel free to contribute to this project by submitting issues and pull requests. Contributions are welcome and appreciated!
To build Claude Dev locally, follow these steps:

1. Clone the repository:
    ```bash
    git clone https://github.com/saoudrizwan/claude-dev.git
    ```
2. Open the project in VSCode:
    ```bash
    code claude-dev
    ```
3. Install the necessary dependencies for the extension and webview-gui:
    ```bash
    npm run install:all
    ```
4. Launch by pressing `F5` to open a new VSCode window with the extension loaded

## Reviews

-   ["Claude Sonnet 3.5 Artifacts in VSCode With This Extension"](https://www.youtube.com/watch?v=5FbZ8ALfSTs) by [CoderOne](https://www.youtube.com/@CoderOne)
-   ["Meet Claude Dev — An Open-Source AI Programmer In VS Code"](https://generativeai.pub/meet-claude-dev-an-open-source-autonomous-ai-programmer-in-vs-code-f457f9821b7b) by [Jim Clyde Monge](https://jimclydemonge.medium.com/)
-   ["AI Development with Claude Dev"](https://www.linkedin.com/pulse/ai-development-claude-dev-shannon-lal-3ql3e/) by Shannon Lal
-   ["Code Smarter with Claude Dev: An AI Programmer for Your Projects"](https://www.linkedin.com/pulse/code-smarter-claude-dev-ai-programmer-your-projects-iana-detochka-jiqpe) by Iana D.
-   [Claude Dev also hit top 10 posts of all time on r/ClaudeAI (thank you for all the lovely comments)](https://www.reddit.com/r/ClaudeAI/comments/1e3h0f1/my_submission_to_anthropics_build_with_claude/)

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Questions?

Contact me on X <a href="https://x.com/sdrzn" target="_blank">@sdrzn</a>. Please create an <a href="https://github.com/saoudrizwan/claude-dev/issues">issue</a> if you come across a bug or would like a feature to be added.

## Acknowledgments

Special thanks to Anthropic for providing the API that powers this extension.
