# Roo-Cline

A fork of Cline, an autonomous coding agent, with some added experimental configuration and automation features.
- Auto-approval capabilities for commands, write, and browser operations
- Support for .clinerules per-project custom instructions
- Ability to run side-by-side with Cline
- Unit test coverage (written almost entirely by Roo Cline!)
- Support for playing sound effects
- Support for OpenRouter compression
- Support for copying prompts from the history screen
- Support for editing through diffs / handling truncated full-file edits
- Support for newer Gemini models (gemini-exp-1206 and gemini-2.0-flash-exp)

Here's an example of Roo-Cline autonomously creating a snake game with "Always approve write operations" and "Always approve browser actions" turned on:

https://github.com/user-attachments/assets/c2bb31dc-e9b2-4d73-885d-17f1471a4987

## Contributing
To contribute to the project, start by exploring [open issues](https://github.com/RooVetGit/Roo-Cline/issues) or checking our [feature request board](https://github.com/cline/cline/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop). We'd also love to have you join our [Discord](https://discord.gg/cline) to share ideas and connect with other contributors.

<details>
<summary>Local Setup</summary>

1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Build the VSIX file:
   ```bash
   npm run build
   ```
3. The new VSIX file will be created in the `bin/` directory
4. Install the extension from the VSIX file as described below:

   - **Option 1:** Drag and drop the `.vsix` file into your VSCode-compatible editor's Extensions panel (Cmd/Ctrl+Shift+X).

   - **Option 2:** Install the plugin using the CLI, make sure you have your VSCode-compatible CLI installed and in your `PATH` variable. Cursor example: `export PATH="$PATH:/Applications/Cursor.app/Contents/MacOS"`

    ```bash
    # Ex: cursor --install-extension bin/roo-cline-2.0.1.vsix
    # Ex: code --install-extension bin/roo-cline-2.0.1.vsix
    ```

5. Launch by pressing `F5` (or `Run`->`Start Debugging`) to open a new VSCode window with the extension loaded. (You may need to install the [esbuild problem matchers extension](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers) if you run into issues building the project.)

</details>

<details>
<summary>Publishing</summary>
We use [changesets](https://github.com/changesets/changesets) for versioning and publishing this package. To make changes:

1. Create a PR with your changes
2. Create a new changeset by running `npm run changeset`
   - Select the appropriate kind of change - `patch` for bug fixes, `minor` for new features, or `major` for breaking changes
   - Write a clear description of your changes that will be included in the changelog
3. Get the PR approved and pass all checks
4. Merge it

Once your merge is successful:
- The release workflow will automatically create a new "Changeset version bump" PR
- This PR will:
  - Update the version based on your changeset
  - Update the `CHANGELOG.md` file
  - Create a git tag
- The PR will be automatically approved and merged
- A new version and git release will be published

</details>

## Stay Updated!
Subscribe to our [Github releases](https://github.com/RooVetGit/Roo-Cline/releases) to keep up with the latest updates! You can also view our [CHANGELOG.md](Roo-Cline/CHANGELOG.md) for more details.

---

# Cline (prev. Claude Dev) – \#1 on OpenRouter

<p align="center">
  <img src="https://media.githubusercontent.com/media/cline/cline/main/assets/docs/demo.gif" width="100%" />
</p>

<div align="center">
<table>
<tbody>
<td align="center">
<a href="https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline" target="_blank"><strong>Download on VS Marketplace</strong></a>
</td>
<td align="center">
<a href="https://discord.gg/cline" target="_blank"><strong>Join the Discord</strong></a>
</td>
<td align="center">
<a href="https://github.com/cline/cline/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop" target="_blank"><strong>Feature Requests</strong></a>
</td>
<td align="center">
<a href="https://cline.bot/join-us" target="_blank"><strong>We're Hiring!</strong></a>
</td>
</tbody>
</table>
</div>

Meet Cline, an AI assistant that can use your **CLI** a**N**d **E**ditor.

Thanks to [Claude 3.5 Sonnet's agentic coding capabilities](https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf), Cline can handle complex software development tasks step-by-step. With tools that let him create & edit files, explore large projects, use the browser, and execute terminal commands (after you grant permission), he can assist you in ways that go beyond code completion or tech support. While autonomous AI scripts traditionally run in sandboxed environments, this extension provides a human-in-the-loop GUI to approve every file change and terminal command, providing a safe and accessible way to explore the potential of agentic AI.

1. Enter your task and add images to convert mockups into functional apps or fix bugs with screenshots.
2. Cline starts by analyzing your file structure & source code ASTs, running regex searches, and reading relevant files to get up to speed in existing projects. By carefully managing what information is added to context, Cline can provide valuable assistance even for large, complex projects without overwhelming the context window.
3. Once Cline has the information he needs, he can:
    - Create and edit files + monitor linter/compiler errors along the way, letting him proactively fix issues like missing imports and syntax errors on his own.
    - Execute commands directly in your terminal and monitor their output as he works, letting him e.g., react to dev server issues after editing a file.
    - For web development tasks, Cline can launch the site in a headless browser, click, type, scroll, and capture screenshots + console logs, allowing him to fix runtime errors and visual bugs.
4. When a task is completed, Cline will present the result to you with a terminal command like `open -a "Google Chrome" index.html`, which you run with a click of a button.

> [!TIP]
> Use the `CMD/CTRL + Shift + P` shortcut to open the command palette and type "Cline: Open In New Tab" to open the extension as a tab in your editor. This lets you use Cline side-by-side with your file explorer, and see how he changes your workspace more clearly.

---

<img align="right" width="340" src="https://github.com/user-attachments/assets/3cf21e04-7ce9-4d22-a7b9-ba2c595e88a4">

### Use any API and Model

Cline supports API providers like OpenRouter, Anthropic, OpenAI, Google Gemini, AWS Bedrock, Azure, and GCP Vertex. You can also configure any OpenAI compatible API, or use a local model through LM Studio/Ollama. If you're using OpenRouter, the extension fetches their latest model list, allowing you to use the newest models as soon as they're available.

The extension also keeps track of total tokens and API usage cost for the entire task loop and individual requests, keeping you informed of spend every step of the way.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/81be79a8-1fdb-4028-9129-5fe055e01e76">

### Run Commands in Terminal

Thanks to the new [shell integration updates in VSCode v1.93](https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api), Cline can execute commands directly in your terminal and receive the output. This allows him to perform a wide range of tasks, from installing packages and running build scripts to deploying applications, managing databases, and executing tests, all while adapting to your dev environment & toolchain to get the job done right.

For long running processes like dev servers, use the "Proceed While Running" button to let Cline continue in the task while the command runs in the background. As Cline works he’ll be notified of any new terminal output along the way, letting him react to issues that may come up, such as compile-time errors when editing files.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="400" src="https://github.com/user-attachments/assets/c5977833-d9b8-491e-90f9-05f9cd38c588">

### Create and Edit Files

Cline can create and edit files directly in your editor, presenting you a diff view of the changes. You can edit or revert Cline's changes directly in the diff view editor, or provide feedback in chat until you're satisfied with the result. Cline also monitors linter/compiler errors (missing imports, syntax errors, etc.) so he can fix issues that come up along the way on his own.

All changes made by Cline are recorded in your file's Timeline, providing an easy way to track and revert modifications if needed.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/bc2e85ba-dfeb-4fe6-9942-7cfc4703cbe5">

### Use the Browser

With Claude 3.5 Sonnet's new [Computer Use](https://www.anthropic.com/news/3-5-models-and-computer-use) capability, Cline can launch a browser, click elements, type text, and scroll, capturing screenshots and console logs at each step. This allows for interactive debugging, end-to-end testing, and even general web use! This gives him autonomy to fixing visual bugs and runtime issues without you needing to handhold and copy-pasting error logs yourself.

Try asking Cline to "test the app", and watch as he runs a command like `npm run dev`, launches your locally running dev server in a browser, and performs a series of tests to confirm that everything works. [See a demo here.](https://x.com/sdrzn/status/1850880547825823989)

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="360" src="https://github.com/user-attachments/assets/7fdf41e6-281a-4b4b-ac19-020b838b6970">

### Add Context

-   **`@url`:** Paste in a URL for the extension to fetch and convert to markdown, useful when you want to give Cline the latest docs
-   **`@problems`:** Add workspace errors and warnings ('Problems' panel) for Cline to fix
-   **`@file`:** Adds a file's contents so you don't have to waste API requests approving read file (+ type to search files)
-   **`@folder`:** Adds folder's files all at once to speed up your workflow even more
