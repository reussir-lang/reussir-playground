# Reussir Playground

Web playground for the [Reussir](https://github.com/reussir-lang/reussir)
programming language.

## How it works

- The editor contains one complete Reussir package: program logic, the
  `#[main]` entry point, and any `#[ffi(import)]` PolyFFI definitions.
- Run mode asks the nightly `rene` package manager to build an executable for
  `wasm32-wasip1`.
- The server runs `llvm-strip` on the resulting module, returns it as base64,
  and the browser executes it through the bundled WASI shim.
- LLVM IR, WebAssembly assembly, and MLIR views use the matching nightly `rrc`
  compiler after Rene prepares the target runtime and PolyFFI library paths.
- User programs are never executed by the server.

The Docker image downloads the self-contained `rrc` and `rene` binaries from
the [Reussir nightly release](https://github.com/reussir-lang/reussir/releases/tag/nightly);
it does not build the compiler from source.

## Requirements

| Tool | Notes |
|---|---|
| Reussir nightly | `rrc` and `rene` from the nightly release |
| Rust toolchain | Nightly toolchain plus `wasm32-wasip1` |
| LLVM | `llvm-strip` must be available |
| Node.js + pnpm | Frontend build toolchain |

## Setup

```bash
git clone https://github.com/reussir-lang/reussir-playground
cd reussir-playground

rustup target add wasm32-wasip1

cp config.example.toml config.toml
$EDITOR config.toml

cd frontend
pnpm install
pnpm build
cd ..

cargo run -p reussir-playground --release
```

Open <http://127.0.0.1:3000>.

For frontend development, run `pnpm dev` in `frontend/`; Vite proxies
`/api` to the Rust server on port 3000.

## Configuration

All configuration lives in `config.toml`.

| Key | Default | Description |
|---|---|---|
| `bind_addr` | `127.0.0.1:3000` | Listen address |
| `compiler.rrc_path` | required | Nightly `rrc` binary |
| `compiler.rene_path` | required | Nightly `rene` binary |
| `compiler.llvm_strip_path` | required | `llvm-strip` binary |
| `compiler.rustc_path` / `cargo_path` | from `PATH` | Optional absolute Rust toolchain overrides |
| `compiler.build_dir` | `playground-build` | Shared Rene runtime/build cache |
| `compiler.cargo_home` | `<build_dir>/cargo-home` | Writable Cargo cache |
| `compiler.toolchain_ro_paths` | `[]` | Extra toolchain roots exposed read-only in the sandbox |
| `compiler.compile_timeout_secs` | `30` | `rrc`/`llvm-strip` timeout |
| `compiler.build_timeout_secs` | `300` | Rene build timeout, including first runtime bake |
| `sandbox.kind` | `bwrap` | `bwrap`, `landlock`, or `none` |

The bind address can also be overridden:

```bash
reussir-playground --bind 0.0.0.0:8080
```

## API

`POST /api/compile` accepts:

```json
{
  "source": "#[main]\npub fn entry() {}",
  "mode": "run",
  "opt": "size",
  "reuse_across_call": false
}
```

Text modes return `{ "success": true, "output": "..." }`. Run mode returns
`{ "success": true, "wasm": "<base64>" }`.

## Sandboxing

Compiler/package-manager processes run through the configured filesystem
sandbox. The shared Rene build directory is writable so it can cache the
embedded runtime and Cargo artifacts; toolchain roots are read-only. The
compiled WebAssembly runs only in the browser's WebAssembly sandbox.
