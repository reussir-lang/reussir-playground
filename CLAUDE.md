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
rustup target add wasm32-wasip1
cp config.example.toml config.toml
# Set compiler.rrc_path, compiler.rene_path, and compiler.llvm_strip_path.
```

### Development Workflow
Run the Rust server on port 3000, then run `pnpm dev` in `frontend/` — Vite proxies `/api` requests to the backend. Production builds serve `frontend/dist/` via the Axum `ServeDir` fallback.

## Architecture

**Two-part system**: Rust server compiles Reussir code; browser executes the resulting WASM.

- `POST /api/compile` accepts `{ source, mode, opt, reuse_across_call }` and returns either `{ output }` (text modes: llvm-ir, asm, mlir) or `{ wasm }` (base64-encoded wasm32-wasip1 binary for run mode). The server **never runs user code** — WASM execution happens in the browser via a WASI shim.

- The server sandboxes compiler invocations (bwrap/landlock/none). Rene builds a complete Reussir package whose source contains `#[main]` and PolyFFI definitions; there is no separate Rust driver.

### Server (`server/src/`)
- `main.rs` — Axum router: single `/api/compile` endpoint + static file fallback
- `compile.rs` — Compile handler: invokes nightly Rene/rrc and strips run-mode WASM
- `sandbox.rs` — Wraps compiler invocations in bwrap or landlock sandbox
- `config.rs` — TOML config parsing

### Frontend (`frontend/src/`)
- **State**: Jotai atoms in `store/atoms.ts` (source code, mode, opt level, output)
- **API**: `api/compile.ts` — fetch wrapper with Zod response validation
- **Editors**: Monaco Editor with custom Reussir Monarch tokenizer (`lang/reussir-monarch.ts`)
- **WASI**: `runtime/wasi.ts` — minimal WASI snapshot_preview1 shim for in-browser wasm execution
- **Layout**: `react-resizable-panels` for split panes; shadcn/ui for toolbar controls
- **Routing**: TanStack Router (file-based, single `/` route currently)

### Docker
The multi-stage Dockerfile downloads the public Reussir nightly binaries,
builds the playground server and frontend, then creates the runtime image. CI
builds multi-arch (amd64 + arm64) images to GHCR.

## Key Conventions

- **Package manager**: pnpm (not npm) for the frontend
- **Config**: `config.toml` (gitignored) from `config.example.toml`. Required fields: `compiler.rrc_path`, `compiler.rene_path`, `compiler.llvm_strip_path`
- **Sandbox**: Use `sandbox.kind = "none"` for local macOS development; bwrap or landlock in production/Docker
- **Reussir syntax**: Authoritative grammar is `frontend/syntaxes/reussir.tmLanguage.json`; the Monaco Monarch tokenizer in `lang/reussir-monarch.ts` should stay in sync with it
