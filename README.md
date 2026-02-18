# Reussir Playground

Web-based playground for the [Reussir](https://github.com/reussir-lang/reussir)
programming language.

**How it works:**
- The server compiles Reussir source to a `wasm32-wasip1` object, links it with
  `reussir-rt` via a generated Rust harness, and returns the `.wasm` binary.
- The browser executes the binary through a built-in WASI shim (`frontend/wasi.js`)
  — **the server never runs user code**.
- Text output modes (LLVM IR, Assembly, MLIR) invoke the compiler inside a
  sandbox and return the textual output directly.

## Requirements

| Tool | Notes |
|---|---|
| Rust toolchain | stable + `wasm32-wasip1` target (`rustup target add wasm32-wasip1`) |
| reussir-compiler | built from [reussir-lang/reussir](https://github.com/reussir-lang/reussir) |
| bwrap *(or)* Linux 5.13+ | sandboxing; bwrap is the default |

## Setup

```bash
# 1. Clone
git clone https://github.com/reussir-lang/reussir-playground
cd reussir-playground

# 2. Add the wasm32-wasip1 target (only needed once)
rustup target add wasm32-wasip1

# 3. Write your config
cp config.example.toml config.toml
$EDITOR config.toml       # set compiler.path and compiler.rt_path

# 4. Build and run
cargo build --release -p reussir-playground
./server/target/release/reussir-playground
# or: cargo run -p reussir-playground --release
```

Then open `http://127.0.0.1:3000` in a browser.

## Configuration

All configuration lives in `config.toml` (see `config.example.toml`).

| Key | Default | Description |
|---|---|---|
| `bind_addr` | `127.0.0.1:3000` | Listen address |
| `compiler.path` | *(required)* | Path to reussir-compiler binary |
| `compiler.rt_path` | *(required)* | Path to `reussir/runtime/` directory |
| `compiler.cargo_target_dir` | `playground-target` | Shared Cargo target dir for harness caching |
| `compiler.compile_timeout_secs` | `30` | Compiler timeout |
| `compiler.cargo_timeout_secs` | `180` | Cargo build timeout |
| `sandbox.kind` | `bwrap` | `bwrap` / `landlock` / `none` |
| `sandbox.bwrap_path` | `bwrap` in PATH | Path to bwrap binary |

The bind address can also be overridden on the CLI:

```bash
reussir-playground --bind 0.0.0.0:8080
reussir-playground --config /etc/reussir-playground/config.toml
```

## Sandboxing

Compiler invocations are sandboxed to prevent the untrusted reussir source
(which controls MLIR/LLVM IR passed to the backend) from exfiltrating data or
modifying the host.

- **bwrap** (default): unshares user, IPC, and network namespaces; presents a
  minimal read-only rootfs; the per-request temp dir gets read-write access.
- **landlock**: applies Linux Landlock rules via `pre_exec` in the child process.
  Requires kernel ≥ 5.13; gracefully degrades on older kernels.
- **none**: no sandboxing — only use locally.

> Note: sandboxing applies to the **compiler** process only.  The compiled
> `.wasm` binary is executed by the browser's own WebAssembly sandbox, so the
> server never runs user code at all.

## Output modes

| Mode | Description |
|---|---|
| **Run** | Compile to `wasm32-wasip1`, ship binary to browser, execute via built-in WASI shim |
| **LLVM IR** | Return the LLVM IR emitted for the target |
| **Assembly** | Return the native assembly |
| **MLIR** | Return the MLIR module before LLVM lowering |

## Architecture

```
Browser                         Server (Rust/axum)
──────────────────────          ────────────────────────────────────
 Code editor (CM6)
 Driver editor (Rust)  ─POST──► /api/compile
                                  │
                                  ├─ text modes:
                                  │   sandbox.wrap(reussir-compiler …)
                                  │   return { output: "…" }
                                  │
                                  └─ run mode:
                                      sandbox.wrap(reussir-compiler
                                        --target-triple wasm32-wasip1 …)
                                      cargo build --target wasm32-wasip1
                                      read .wasm
                                      return { wasm: "<base64>" }

 wasi.js ◄──────────────────────────────────────────────────────────
 WebAssembly.instantiate()
 _start()  →  capture stdout/stderr
 display output
```
