# Opencode GUI

A lightweight, native desktop GUI for [Opencode CLI](https://github.com/anomalyco/opencode). Built with **Tauri v2**, **SolidJS**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- **Native Desktop App** — Cross-platform GUI wrapper for Opencode CLI using Tauri
- **File Explorer** — Browse and filter your project files with an interactive tree view
- **Code Editor** — Syntax-highlighted code viewing with [Shiki](https://shiki.style)
- **Diff Viewer** — Review AI-generated changes in unified or split diff mode
- **AI Chat** — Conversational interface with session management and message history
- **Model Selection** — Choose from available LLM providers with cost/context indicators
- **Git Integration** — Track modified, added, and deleted files in the Changes tab
- **Draggable Tabs** — Reorder open files via drag-and-drop
- **Resizable Panes** — Adjustable sidebar and chat panel widths
- **Keyboard Shortcuts** — Quick file picker (`Ctrl/Cmd + P`) and more

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   SolidJS UI    │◄───►│  Tauri (Rust)   │
│  + Tailwind CSS │     │   Native APIs   │
└─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ @opencode-ai/sdk│     │ File System,    │
│  (HTTP client)  │     │ Dialog, Opener  │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

- [Bun](https://bun.sh) package manager
- [Rust](https://rustup.rs/) toolchain (for Tauri)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
- [Opencode CLI](https://github.com/anomalyco/opencode) installed and available in your `$PATH`

## Development

### 1. Start the Opencode server

The GUI connects to a running Opencode server:

```bash
opencode serve --port 4096
```

### 2. Clone and setup

```bash
git clone https://github.com/milisp/opencode-gui.git
cd opencode-gui
bun install
```

### 3. Run in development mode

```bash
bun tauri dev
```

This starts the Vite dev server and the Tauri app with hot reload.

### 4. Build for production

```bash
bun tauri build
```

Binaries will be output to `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [SolidJS](https://www.solidjs.com/) |
| Desktop | [Tauri v2](https://v2.tauri.app/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Syntax Highlighting | [Shiki](https://shiki.style) |
| Markdown | [Marked](https://marked.js.org/) |
| Icons | Custom SVG spritesheet |
| Package Manager | [Bun](https://bun.sh) |

## First Time Setup

1. Launch the app
2. Click the **settings** icon in the sidebar
3. Set your **Project Directory** to the folder you want to work in
4. Set the **Base URL** to match your Opencode server (default: `http://localhost:4096`)
5. Start chatting or open files to edit!

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + P` | Quick file picker |
| `Ctrl/Cmd + Shift + P` | Reserved |
| `Esc` | Blur input / close dialogs |
| Any character | Focus command input (when no input focused) |

## Project Structure

```
.
├── src/                    # Frontend (SolidJS)
│   ├── components/         # UI components (file-tree, code editor, etc.)
│   ├── context/            # Global state providers (SDK, theme, files, sessions)
│   ├── pages/              # Route pages
│   ├── ui/                 # Base UI primitives
│   └── utils/              # Helper functions
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/                # Rust source
│   └── Cargo.toml          # Rust dependencies
├── public/                 # Static assets
├── index.html              # Entry HTML
├── vite.config.ts          # Vite configuration
└── package.json            # Node dependencies
```

## License

MIT
