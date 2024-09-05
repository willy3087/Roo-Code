# Change Log

All notable changes to the "claude-dev" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [1.5.27]

- Claude's changes now appear in your file's Timeline, allowing you to easily view a diff of each edit. This is especially helpful if you want to revert to a previous version. No need for git—everything is tracked by VSCode's local history!
- Updated system prompt to keep Claude from re-reading files unnecessarily

## [1.5.19]

- Adds support for OpenAI compatible API providers (e.g. Ollama!)

## [1.5.13]

- New terminal emulator! When Claude runs commands, you can now type directly in the terminal (+ support for Python environments)
- Adds search to Task History

## [1.5.6]

- You can now edit Claude's changes before accepting! When he edits or creates a file, you can modify his changes directly in the right side of the diff view (+ hover over the 'Revert Block' arrow button in the center to undo `// rest of code here` shenanigans)

## [1.5.4]

- Adds support for reading .pdf and .docx files (try "turn my business_plan.docx into a company website")

## [1.5.0]

- Adds new `search_files` tool that lets Claude perform regex searches in your project, making it easy for him to refactor code, address TODOs and FIXMEs, remove dead code, and more!

## [1.4.0]

- Adds "Always allow read-only operations" setting to let Claude read files and view directories without needing approval (off by default)
- Implement sliding window context management to keep tasks going past 200k tokens
- Adds Google Cloud Vertex AI support and updates Claude 3.5 Sonnet max output to 8192 tokens for all providers.
- Improves system prompt to gaurd against lazy edits (less "//rest of code here")

## [1.3.0]

- Adds task history

## [1.2.0]

- Adds support for Prompt Caching to significantly reduce costs and response times (currently only available through Anthropic API for Claude 3.5 Sonnet and Claude 3.0 Haiku)

## [1.1.1]

- Adds option to choose other Claude models (+ GPT-4o, DeepSeek, and Mistral if you use OpenRouter)
- Adds option to add custom instructions to the end of the system prompt

## [1.1.0]

- Paste images in chat to use Claude's vision capabilities and turn mockups into fully functional applications or fix bugs with screenshots

## [1.0.9]

- Add support for OpenRouter and AWS Bedrock

## [1.0.8]

- Shows diff view of new or edited files right in the editor

## [1.0.7]

- Replace `list_files` and `analyze_project` with more explicit `list_files_top_level`, `list_files_recursive`, and `view_source_code_definitions_top_level` to get source code definitions only for files relevant to the task

## [1.0.6]

- Interact with CLI commands by sending messages to stdin and terminating long-running processes like servers
- Export tasks to markdown files (useful as context for future tasks)

## [1.0.5]

- Claude now has context about vscode's visible editors and opened tabs

## [1.0.4]

- Open in the editor (using menu bar or `Claude Dev: Open In New Tab` in command palette) to see how Claude updates your workspace more clearly
- New `analyze_project` tool to help Claude get a comprehensive overview of your project's source code definitions and file structure
- Provide feedback to tool use like terminal commands and file edits
- Updated max output tokens to 8192 so less lazy coding (`// rest of code here...`)
- Added ability to retry failed API requests (helpful for rate limits)
- Quality of life improvements like markdown rendering, memory optimizations, better theme support

## [0.0.6]

- Initial release