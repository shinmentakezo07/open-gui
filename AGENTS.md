# AGENTS.md — Opencode GUI

## Quick Start

```bash
# 1. Start the Opencode server (required for the GUI to function)
opencode serve --port 4096

# 2. In another terminal, run the Tauri dev app
bun tauri dev

# 3. Or run just the Vite frontend dev server (no native APIs)
bun dev
```

## Tech Stack

- **Frontend:** SolidJS + Tailwind CSS v4 + Vite
- **Desktop:** Tauri v2 (Rust)
- **Package Manager:** Bun (use `bun`, not `npm`/`pnpm`)
- **HTTP Client:** `@opencode-ai/sdk` talks to a running Opencode server

## Key Commands

| Command | What it does |
|---------|-------------|
| `bun dev` | Vite dev server only (port 1420) |
| `bun tauri dev` | Full Tauri app with hot reload |
| `bun build` | Type-check + Vite production build |
| `bun tauri build` | Build native desktop binaries → `src-tauri/target/release/bundle/` |
| `bun preview` | Preview the Vite production build |

## Architecture Notes

- **Frontend entry:** `src/index.tsx` → `src/App.tsx`
- **Rust entry:** `src-tauri/src/lib.rs` (minimal — only dialog + opener plugins)
- **Path alias:** `@/` maps to `./src/` (configured in `vite.config.ts` and `tsconfig.json`)
- **Vite is Tauri-aware:** fixed port 1420, ignores `src-tauri/`, `TAURI_DEV_HOST` env controls HMR host
- **No tests or linting configured** — there is no test runner, eslint, prettier, or biome setup

## TypeScript Strictness

- `noUnusedLocals: true` and `noUnusedParameters: true` are enabled
- Unused variables will fail the build (`bun build` runs `tsc` first)

## Development Gotchas

- The GUI is a thin wrapper; it **requires** `opencode serve --port 4096` (or matching Base URL in settings) to do anything useful
- `components.json` references `src/App.css` but the actual CSS entry is `src/index.css` — the shadcn-style config may be stale
- `bun tauri dev` is the only way to test native APIs (file dialogs, opener). `bun dev` gives you the web UI only.

## Dependencies to Know

- `@opencode-ai/sdk` — SDK for the Opencode HTTP API
- `shiki` + `marked` + `marked-shiki` — syntax highlighting and markdown rendering
- `diff` — diff viewer logic
- `@thisbeyond/solid-dnd` — drag-and-drop tabs
- `virtua` — virtual scrolling
