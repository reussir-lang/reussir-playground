# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Frontend (React/Vite, in `frontend/`)
```bash
cd frontend
pnpm install            # install dependencies
pnpm dev                # dev server on :5173, proxies /api to :3000
pnpm build              # typecheck (tsc -b) + vite production build → dist/
```

### Server (Rust/Axum)
```bash
cargo build --release -p reussir-playground
cargo run -p reussir-playground --release
cargo check -p reussir-playground         # fast type checking
```

### Initial Setup
```bash
rustup target add wasm32-wasip1           # required once
cp config.example.toml config.toml       # then set compiler.path and compiler.rt_path
```

### Development Workflow
Run the Rust server on port 3000, then run `pnpm dev` in `frontend/` — Vite proxies `/api` requests to the backend. Production builds serve `frontend/dist/` via the Axum `ServeDir` fallback.

## Architecture

**Two-part system**: Rust server compiles Reussir code; browser executes the resulting WASM.

- `POST /api/compile` accepts `{ source, driver, mode, opt }` and returns either `{ output }` (text modes: llvm-ir, asm, mlir) or `{ wasm }` (base64-encoded wasm32-wasip1 binary for run mode). The server **never runs user code** — WASM execution happens in the browser via a WASI shim.

- The server sandboxes compiler invocations (bwrap/landlock/none) and generates a Rust FFI harness linking the compiled object with `reussir-rt` for run mode.

### Server (`server/src/`)
- `main.rs` — Axum router: single `/api/compile` endpoint + static file fallback
- `compile.rs` — Compile handler: invokes reussir-compiler, builds wasm harness via cargo
- `harness.rs` — Parses `extern "C" trampoline` declarations, generates Rust FFI wrapper
- `sandbox.rs` — Wraps compiler invocations in bwrap or landlock sandbox
- `config.rs` — TOML config parsing

### Frontend (`frontend/src/`)
- **State**: Jotai atoms in `store/atoms.ts` (source code, driver code, mode, opt level, output)
- **API**: `api/compile.ts` — fetch wrapper with Zod response validation
- **Editors**: Monaco Editor with custom Reussir Monarch tokenizer (`lang/reussir-monarch.ts`)
- **WASI**: `runtime/wasi.ts` — minimal WASI snapshot_preview1 shim for in-browser wasm execution
- **Layout**: `react-resizable-panels` for split panes; shadcn/ui for toolbar controls
- **Routing**: TanStack Router (file-based, single `/` route currently)

### Docker
Multi-stage Dockerfile: reussir-builder (compiler) → playground-builder (Rust server) → frontend-builder (Node/Vite) → runtime. CI builds multi-arch (amd64 + arm64) images to GHCR.

## Key Conventions

- **Package manager**: pnpm (not npm) for the frontend
- **Config**: `config.toml` (gitignored) from `config.example.toml`. Required fields: `compiler.path`, `compiler.rt_path`
- **Sandbox**: Use `sandbox.kind = "none"` for local macOS development; bwrap or landlock in production/Docker
- **Reussir syntax**: Authoritative grammar is `frontend/syntaxes/reussir.tmLanguage.json`; the Monaco Monarch tokenizer in `lang/reussir-monarch.ts` should stay in sync with it
