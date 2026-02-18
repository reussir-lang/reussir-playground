# Reussir Playground

A web-based playground for the [Reussir](https://github.com/reussir-lang/reussir) language. Compiles `.rr` source code and displays LLVM IR, assembly, MLIR, or executes the compiled program.

## Setup

Requires:
- Rust toolchain
- A built `reussir-compiler` binary
- The `reussir-rt` runtime source
- All required environment variables (listed below)

```bash
cargo build --release
```

## Running

```bash
export REUSSIR_COMPILER=/path/to/reussir/build/bin/reussir-compiler
export REUSSIR_RT_PATH=/path/to/reussir/runtime
export REUSSIR_LIB_PATH=/path/to/reussir/build/lib

cargo run --release
# → Listening on http://127.0.0.1:3000
```

Open http://127.0.0.1:3000 in a browser.

## Configuration (environment variables)

| Variable | Required | Description |
|---|---|---|
| `REUSSIR_COMPILER` | Yes | Path to `reussir-compiler` binary |
| `REUSSIR_RT_PATH` | Yes | Path to `reussir-rt` source directory |
| `REUSSIR_LIB_PATH` | Yes | Path to built libraries (for `LD_LIBRARY_PATH`) |
| `BIND_ADDR` | `127.0.0.1:3000` | Server bind address |

You need to ensure all three required variables are set before starting the server.

## Modes

- **Run** — Compiles to native code, links with a Rust driver, executes, and shows stdout
- **LLVM IR** — Shows the generated LLVM IR
- **Assembly** — Shows the generated x86 assembly
- **MLIR** — Shows the Reussir MLIR dialect output
