//! `/api/compile` request handler.
//!
//! Three code paths:
//!
//! * **text modes** (`llvm-ir`, `asm`, `mlir`) — invoke the reussir compiler
//!   inside a sandbox, read the textual output, return it as JSON.
//!
//! * **run mode** — compile to a `wasm32-wasip1` object inside a sandbox,
//!   build a Rust harness that links the object and `reussir-rt`, then return
//!   the `.wasm` binary as a base64-encoded JSON field.  The browser executes
//!   it via the bundled WASI shim — the server never runs user code.

use crate::config::Config;
use anyhow::{Context, Result};
use axum::extract::State;
use axum::Json;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CompileRequest {
    source: String,
    driver: String,
    mode: String,
}

#[derive(Serialize)]
pub struct CompileResponse {
    pub success: bool,
    /// Textual output for llvm-ir / asm / mlir modes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    /// Base64-encoded `.wasm` for run mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wasm: Option<String>,
    /// Human-readable error message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl CompileResponse {
    fn text(output: String) -> Self {
        Self { success: true, output: Some(output), wasm: None, error: None }
    }

    fn wasm(bytes: Vec<u8>) -> Self {
        Self { success: true, output: None, wasm: Some(B64.encode(bytes)), error: None }
    }

    fn err(msg: impl Into<String>) -> Self {
        Self { success: false, output: None, wasm: None, error: Some(msg.into()) }
    }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

pub async fn handle(
    State(cfg): State<Arc<Config>>,
    Json(req): Json<CompileRequest>,
) -> Json<CompileResponse> {
    let result = match req.mode.as_str() {
        "llvm-ir" | "asm" | "mlir" => compile_text(&cfg, &req).await,
        "run" => compile_run(&cfg, &req).await,
        other => Err(anyhow::anyhow!("unknown mode: {other}")),
    };

    Json(match result {
        Ok(resp) => resp,
        Err(e) => CompileResponse::err(e.to_string()),
    })
}

// ---------------------------------------------------------------------------
// Text output modes (llvm-ir / asm / mlir)
// ---------------------------------------------------------------------------

async fn compile_text(cfg: &Config, req: &CompileRequest) -> Result<CompileResponse> {
    let tmp = TempDir::new().context("failed to create temp dir")?;
    let input = tmp.path().join("input.rr");
    let ext = match req.mode.as_str() {
        "llvm-ir" => "ll",
        "asm" => "s",
        "mlir" => "mlir",
        _ => unreachable!(),
    };
    let output_path = tmp.path().join(format!("output.{ext}"));

    std::fs::write(&input, &req.source).context("failed to write source")?;

    let compiler = &cfg.compiler.path;
    let args = [
        input.as_os_str(),
        OsStr::new("-o"),
        output_path.as_os_str(),
        OsStr::new("-t"),
        OsStr::new(req.mode.as_str()),
    ];

    let extra_ro = compiler_ro_paths(cfg);
    let extra_ro_refs: Vec<&Path> = extra_ro.iter().map(AsRef::as_ref).collect();

    let mut cmd =
        crate::sandbox::wrap(&cfg.sandbox, compiler, args, tmp.path(), &extra_ro_refs)?;

    let out = tokio::time::timeout(
        Duration::from_secs(cfg.compiler.compile_timeout_secs),
        cmd.output(),
    )
    .await
    .context("compiler timed out")?
    .context("failed to spawn compiler")?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        anyhow::bail!("{stdout}{stderr}");
    }

    let text = std::fs::read_to_string(&output_path).context("failed to read compiler output")?;
    Ok(CompileResponse::text(text))
}

// ---------------------------------------------------------------------------
// Run mode — compile to wasm, build harness, return binary
// ---------------------------------------------------------------------------

async fn compile_run(cfg: &Config, req: &CompileRequest) -> Result<CompileResponse> {
    let tmp = TempDir::new().context("failed to create temp dir")?;
    let input_path = tmp.path().join("input.rr");
    let object_path = tmp.path().join("output.o");

    std::fs::write(&input_path, &req.source).context("failed to write source")?;

    // -----------------------------------------------------------------------
    // Step 1: compile Reussir source → wasm32-wasip1 object (sandboxed)
    // -----------------------------------------------------------------------
    let compiler = &cfg.compiler.path;
    let args = [
        input_path.as_os_str(),
        OsStr::new("-o"),
        object_path.as_os_str(),
        OsStr::new("-t"),
        OsStr::new("object"),
        OsStr::new("--target-triple"),
        OsStr::new("wasm32-wasip1"),
    ];

    let extra_ro = compiler_ro_paths(cfg);
    let extra_ro_refs: Vec<&Path> = extra_ro.iter().map(AsRef::as_ref).collect();

    let mut cmd =
        crate::sandbox::wrap(&cfg.sandbox, compiler, args, tmp.path(), &extra_ro_refs)?;

    let compile_out = tokio::time::timeout(
        Duration::from_secs(cfg.compiler.compile_timeout_secs),
        cmd.output(),
    )
    .await
    .context("compiler timed out")?
    .context("failed to spawn compiler")?;

    if !compile_out.status.success() {
        let stderr = String::from_utf8_lossy(&compile_out.stderr);
        let stdout = String::from_utf8_lossy(&compile_out.stdout);
        anyhow::bail!("{stdout}{stderr}");
    }

    let object_abs = object_path
        .canonicalize()
        .context("compiled object not found after compiler exit")?;

    // -----------------------------------------------------------------------
    // Step 2: generate harness source + build throwaway Cargo project
    // -----------------------------------------------------------------------
    let harness_src = crate::harness::generate_harness(&req.source, &req.driver)
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    let rt_path = cfg
        .compiler
        .rt_path
        .canonicalize()
        .context("failed to canonicalize rt_path")?;

    let cargo_dir = tmp.path().join("harness");
    std::fs::create_dir_all(cargo_dir.join("src"))
        .context("failed to create harness src dir")?;

    // Cargo.toml for the harness crate.
    // `reussir-rt` compiles cleanly to wasm32-wasip1; cargo silently drops
    // the `dylib` crate-type and uses `rlib` instead.
    std::fs::write(
        cargo_dir.join("Cargo.toml"),
        format!(
            r#"[package]
name = "playground-run"
version = "0.1.0"
edition = "2024"

[dependencies]
reussir-rt = {{ path = "{rt}" }}

[profile.release]
opt-level = "z"
lto = true
panic = "abort"
strip = true
"#,
            rt = rt_path.display()
        ),
    )
    .context("failed to write harness Cargo.toml")?;

    // build.rs: link in the compiled Reussir object.
    // For wasm32-wasip1 we don't need `-Wl,--undefined=` — the reussir-rt
    // rlib already exports those symbols and wasm-ld resolves them normally.
    std::fs::write(
        cargo_dir.join("build.rs"),
        format!(
            r#"fn main() {{
    println!("cargo:rustc-link-arg={obj}");
}}
"#,
            obj = object_abs.display()
        ),
    )
    .context("failed to write harness build.rs")?;

    std::fs::write(cargo_dir.join("src/main.rs"), &harness_src)
        .context("failed to write harness main.rs")?;

    // -----------------------------------------------------------------------
    // Step 3: cargo build --target wasm32-wasip1 --release
    // -----------------------------------------------------------------------
    // Use a shared target dir so repeated reussir-rt compilations are cached.
    // We resolve the path before spawning so a relative config value works
    // regardless of the cargo working directory.
    let shared_target = cfg
        .compiler
        .cargo_target_dir
        .canonicalize()
        .unwrap_or_else(|_| {
            std::env::current_dir()
                .unwrap_or_default()
                .join(&cfg.compiler.cargo_target_dir)
        });

    let build_out = tokio::time::timeout(
        Duration::from_secs(cfg.compiler.cargo_timeout_secs),
        tokio::process::Command::new("cargo")
            .args(["build", "--release", "--target", "wasm32-wasip1"])
            .env("CARGO_TARGET_DIR", &shared_target)
            .current_dir(&cargo_dir)
            .output(),
    )
    .await
    .context("cargo build timed out")?
    .context("failed to spawn cargo")?;

    if !build_out.status.success() {
        let stderr = String::from_utf8_lossy(&build_out.stderr);
        anyhow::bail!("harness build failed:\n{stderr}");
    }

    // -----------------------------------------------------------------------
    // Step 4: read and return the wasm binary
    // -----------------------------------------------------------------------
    let wasm_path = shared_target.join("wasm32-wasip1/release/playground-run.wasm");
    let wasm_bytes = std::fs::read(&wasm_path)
        .with_context(|| format!("wasm output not found at {}", wasm_path.display()))?;

    Ok(CompileResponse::wasm(wasm_bytes))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Return paths that the compiler process needs read-only access to.
///
/// Includes the directory that holds the binary (so the sandbox can see it)
/// and, if configured, the shared-library directory (needed for
/// `libMLIRReussirBridge.so` etc.).
fn compiler_ro_paths(cfg: &Config) -> Vec<std::path::PathBuf> {
    let compiler = &cfg.compiler.path;
    let mut paths = Vec::new();
    if let Some(parent) = compiler.parent() {
        if !parent.as_os_str().is_empty() {
            paths.push(parent.to_owned());
        }
    }
    if let Some(lib) = &cfg.compiler.lib_path {
        paths.push(lib.clone());
    }
    paths
}
