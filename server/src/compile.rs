//! `/api/compile` request handler.
//!
//! Rene owns executable builds, including the embedded Reussir runtime and
//! polymorphic FFI. Run mode asks Rene for a `wasm32-wasip1` executable,
//! strips it with `llvm-strip`, and returns it to the browser. Text modes ask
//! Rene to prepare the matching runtime/toolchain, then invoke the nightly
//! `rrc` binary with Rene's reported PolyFFI library directories.

use crate::config::Config;
use anyhow::{Context, Result};
use axum::extract::State;
use axum::Json;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tempfile::{Builder as TempBuilder, TempDir};
use tokio::process::Command;
use tokio::sync::Mutex;

const TARGET: &str = "wasm32-wasip1";
const PROFILE: &str = "playground";
static RENE_LOCK: Mutex<()> = Mutex::const_new(());

#[derive(Deserialize)]
pub struct CompileRequest {
    source: String,
    mode: String,
    /// Optimization level: "none" | "default" | "size" | "aggressive".
    #[serde(default = "default_opt")]
    opt: String,
    /// Pass `--reuse-across-call` through Rene to rrc.
    #[serde(default)]
    reuse_across_call: bool,
}

fn default_opt() -> String {
    "none".to_owned()
}

#[derive(Serialize)]
pub struct CompileResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wasm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl CompileResponse {
    fn text(output: String) -> Self {
        Self {
            success: true,
            output: Some(output),
            wasm: None,
            error: None,
        }
    }

    fn wasm(bytes: Vec<u8>) -> Self {
        Self {
            success: true,
            output: None,
            wasm: Some(B64.encode(bytes)),
            error: None,
        }
    }

    fn err(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            output: None,
            wasm: None,
            error: Some(msg.into()),
        }
    }
}

pub async fn handle(
    State(cfg): State<Arc<Config>>,
    Json(req): Json<CompileRequest>,
) -> Json<CompileResponse> {
    let opt = match req.opt.as_str() {
        "none" | "default" | "size" | "aggressive" => req.opt.as_str(),
        _ => "none",
    };
    let result = match req.mode.as_str() {
        "llvm-ir" | "asm" | "mlir" => compile_text(&cfg, &req, opt).await,
        "run" => compile_run(&cfg, &req, opt).await,
        other => Err(anyhow::anyhow!("unknown mode: {other}")),
    };

    Json(match result {
        Ok(response) => response,
        Err(error) => CompileResponse::err(error.to_string()),
    })
}

async fn compile_run(cfg: &Config, req: &CompileRequest, opt: &str) -> Result<CompileResponse> {
    // Rene uses an exclusive redb database in the shared build directory.
    let rene_guard = RENE_LOCK.lock().await;
    let rene_cli = detect_rene_cli(cfg).await?;
    let package = PackageDir::new(cfg, &req.source, opt, req.reuse_across_call, true, rene_cli)?;
    let output = run_rene(cfg, &package, true, rene_cli).await?;
    drop(rene_guard);
    let artifact = output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .next_back()
        .map(PathBuf::from)
        .context("rene returned no WASM artifact path")?;
    ensure_inside(&artifact, &cfg.compiler.build_dir)
        .context("rene returned an artifact outside compiler.build_dir")?;

    let stripped = package.root().join("playground.stripped.wasm");
    let args = [
        OsStr::new("--strip-all"),
        OsStr::new("-o"),
        stripped.as_os_str(),
        artifact.as_os_str(),
    ];
    let strip_out = run_sandboxed(
        cfg,
        &cfg.compiler.llvm_strip_path,
        args,
        Duration::from_secs(cfg.compiler.compile_timeout_secs),
    )
    .await
    .context("failed to strip WASM")?;
    ensure_success("llvm-strip", &strip_out)?;

    let wasm = std::fs::read(&stripped)
        .with_context(|| format!("stripped WASM not found at {}", stripped.display()))?;
    Ok(CompileResponse::wasm(wasm))
}

async fn compile_text(cfg: &Config, req: &CompileRequest, opt: &str) -> Result<CompileResponse> {
    // Rene uses an exclusive redb database in the shared build directory.
    let rene_guard = RENE_LOCK.lock().await;
    let rene_cli = detect_rene_cli(cfg).await?;
    let package = PackageDir::new(
        cfg,
        &req.source,
        opt,
        req.reuse_across_call,
        false,
        rene_cli,
    )?;

    // A target-less Rene build bakes/reuses reussir-rt and prints exactly the
    // directories rrc needs for PolyFFI compilation, one per stdout line.
    let libdir_output = run_rene(cfg, &package, false, rene_cli).await?;
    drop(rene_guard);
    let libdirs: Vec<PathBuf> = libdir_output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .collect();
    anyhow::ensure!(
        !libdirs.is_empty(),
        "rene returned no PolyFFI library directories"
    );

    let (emit, extension) = match req.mode.as_str() {
        "llvm-ir" => ("llvm-ir", "ll"),
        "asm" => ("asm", "s"),
        "mlir" => ("mlir", "mlir"),
        _ => unreachable!(),
    };
    let output_path = package.root().join(format!("output.{extension}"));
    let mut args: Vec<OsString> = vec![
        package.source().as_os_str().to_owned(),
        OsString::from("--package-name"),
        OsString::from(package.name()),
        OsString::from("-o"),
        output_path.as_os_str().to_owned(),
        OsString::from("--emit"),
        OsString::from(emit),
        OsString::from("-O"),
        OsString::from(opt),
        OsString::from("--target-triple"),
        OsString::from(TARGET),
    ];
    if req.reuse_across_call {
        args.push(OsString::from("--reuse-across-call"));
    }
    for libdir in &libdirs {
        args.push(OsString::from("--polyffi-libdir"));
        args.push(libdir.as_os_str().to_owned());
    }

    let out = run_sandboxed(
        cfg,
        &cfg.compiler.rrc_path,
        args,
        Duration::from_secs(cfg.compiler.compile_timeout_secs),
    )
    .await
    .context("failed to run rrc")?;
    ensure_success("rrc", &out)?;

    let text = std::fs::read_to_string(&output_path)
        .with_context(|| format!("rrc output not found at {}", output_path.display()))?;
    Ok(CompileResponse::text(text))
}

struct PackageDir {
    _temp: TempDir,
    root: PathBuf,
    name: String,
    manifest: PathBuf,
    source: PathBuf,
}

impl PackageDir {
    fn new(
        cfg: &Config,
        source: &str,
        opt: &str,
        reuse_across_call: bool,
        executable: bool,
        rene_cli: ReneCli,
    ) -> Result<Self> {
        let requests = cfg.compiler.build_dir.join("requests");
        std::fs::create_dir_all(&requests)
            .with_context(|| format!("cannot create {}", requests.display()))?;
        let temp = TempBuilder::new()
            .prefix("request-")
            .tempdir_in(&requests)
            .context("failed to create request directory")?;
        let root = temp.path().to_owned();
        let suffix = root
            .file_name()
            .and_then(OsStr::to_str)
            .context("request directory has no UTF-8 file name")?
            .replace('-', "_");
        let name = format!("playground_{suffix}");
        let source_dir = root.join("src");
        std::fs::create_dir(&source_dir).context("failed to create package source directory")?;
        let source_path = source_dir.join("lib.rr");
        std::fs::write(&source_path, source).context("failed to write Reussir source")?;

        let targets = if executable {
            format!("\n  targets.{name} = {{ kind = 'executable }},")
        } else {
            String::new()
        };
        let target_profile = match rene_cli {
            ReneCli::Legacy => format!("\n    target_triple = \"{TARGET}\","),
            ReneCli::Modern => String::new(),
        };
        let manifest_text = format!(
            r#"{{
  package = {{ name = "{name}", version = "0.1.0" }},{targets}
  profiles.{PROFILE} = {{
    opt = "{opt}",
    debug = false,
    {target_profile}
    reuse_across_call = {reuse_across_call},
  }},
}}
"#
        );
        let manifest = root.join("rene.ncl");
        std::fs::write(&manifest, manifest_text).context("failed to write Rene manifest")?;

        Ok(Self {
            _temp: temp,
            root,
            name,
            manifest,
            source: source_path,
        })
    }

    fn root(&self) -> &Path {
        &self.root
    }

    fn source(&self) -> &Path {
        &self.source
    }

    fn name(&self) -> &str {
        &self.name
    }
}

#[derive(Clone, Copy)]
enum ReneCli {
    /// Nightlies before machine targets moved to `--target <TRIPLE>`.
    Legacy,
    /// Current Rene: `--target <TRIPLE>` selects the machine target.
    Modern,
}

async fn detect_rene_cli(cfg: &Config) -> Result<ReneCli> {
    let out = run_sandboxed(
        cfg,
        &cfg.compiler.rene_path,
        ["build", "--help"],
        Duration::from_secs(cfg.compiler.compile_timeout_secs),
    )
    .await
    .context("failed to inspect rene CLI")?;
    ensure_success("rene --help", &out)?;
    let help = String::from_utf8_lossy(&out.stdout);
    Ok(if help.contains("--bin <") {
        ReneCli::Modern
    } else {
        ReneCli::Legacy
    })
}

async fn run_rene(
    cfg: &Config,
    package: &PackageDir,
    executable: bool,
    rene_cli: ReneCli,
) -> Result<String> {
    let mut args: Vec<OsString> = vec![
        OsString::from("build"),
        OsString::from("--manifest-path"),
        package.manifest.as_os_str().to_owned(),
        OsString::from("--build-dir"),
        cfg.compiler.build_dir.as_os_str().to_owned(),
        OsString::from("--profile"),
        OsString::from(PROFILE),
    ];
    match rene_cli {
        ReneCli::Legacy if executable => {
            args.push(OsString::from("--target"));
            args.push(OsString::from(package.name()));
        }
        ReneCli::Legacy => {}
        ReneCli::Modern => {
            args.push(OsString::from("--target"));
            args.push(OsString::from(TARGET));
        }
    }
    let out = run_sandboxed(
        cfg,
        &cfg.compiler.rene_path,
        args,
        Duration::from_secs(cfg.compiler.build_timeout_secs),
    )
    .await
    .context("failed to run rene")?;
    ensure_success("rene", &out)?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

async fn run_sandboxed<I, S>(
    cfg: &Config,
    program: &Path,
    args: I,
    timeout: Duration,
) -> Result<std::process::Output>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let extra_ro = tool_ro_paths(cfg);
    let extra_ro_refs: Vec<&Path> = extra_ro.iter().map(PathBuf::as_path).collect();
    let mut command: Command = crate::sandbox::wrap(
        &cfg.sandbox,
        program,
        args,
        &cfg.compiler.build_dir,
        &extra_ro_refs,
    )?;
    command
        .env("CARGO_HOME", cfg.compiler.cargo_home())
        .env("TMPDIR", cfg.compiler.build_dir.join("tmp"))
        .env(
            "REUSSIR_RUSTC",
            resolve_program("rustc", cfg.compiler.rustc_path.as_deref())?,
        )
        .env(
            "REUSSIR_CARGO",
            resolve_program("cargo", cfg.compiler.cargo_path.as_deref())?,
        )
        .env("PATH", tool_path(cfg)?)
        .current_dir(&cfg.compiler.build_dir)
        .kill_on_drop(true);
    tokio::time::timeout(timeout, command.output())
        .await
        .with_context(|| {
            format!(
                "{} timed out after {}s",
                program.display(),
                timeout.as_secs()
            )
        })?
        .with_context(|| format!("failed to spawn {}", program.display()))
}

fn resolve_program(name: &str, configured: Option<&Path>) -> Result<PathBuf> {
    if let Some(path) = configured {
        anyhow::ensure!(
            path.is_file(),
            "configured {name} does not exist: {}",
            path.display()
        );
        return absolute_path(path)
            .with_context(|| format!("cannot resolve configured {name}: {}", path.display()));
    }
    let path = std::env::var_os("PATH").context("PATH is not set")?;
    for directory in std::env::split_paths(&path) {
        let candidate = directory.join(name);
        if candidate.is_file() {
            return absolute_path(&candidate)
                .with_context(|| format!("cannot resolve {name}: {}", candidate.display()));
        }
    }
    anyhow::bail!("cannot find {name} on PATH")
}

fn absolute_path(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_owned());
    }
    Ok(std::env::current_dir()
        .context("cannot resolve current directory")?
        .join(path))
}

fn tool_path(cfg: &Config) -> Result<OsString> {
    let mut entries = Vec::new();
    for program in [&cfg.compiler.rrc_path, &cfg.compiler.rene_path] {
        if let Some(parent) = program.parent() {
            entries.push(parent.to_owned());
        }
    }
    if let Some(path) = std::env::var_os("PATH") {
        entries.extend(std::env::split_paths(&path));
    }
    std::env::join_paths(entries).context("cannot construct compiler PATH")
}

fn tool_ro_paths(cfg: &Config) -> Vec<PathBuf> {
    let mut paths = cfg.compiler.toolchain_ro_paths.clone();
    for program in [
        &cfg.compiler.rrc_path,
        &cfg.compiler.rene_path,
        &cfg.compiler.llvm_strip_path,
    ] {
        if let Some(parent) = program.parent() {
            if !parent.as_os_str().is_empty() {
                paths.push(parent.to_owned());
            }
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

fn ensure_success(name: &str, output: &std::process::Output) -> Result<()> {
    if output.status.success() {
        return Ok(());
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    anyhow::bail!("{name} failed:\n{stdout}{stderr}")
}

fn ensure_inside(path: &Path, root: &Path) -> Result<()> {
    let path = path
        .canonicalize()
        .with_context(|| format!("cannot resolve {}", path.display()))?;
    let root = root
        .canonicalize()
        .with_context(|| format!("cannot resolve {}", root.display()))?;
    anyhow::ensure!(
        path.starts_with(&root),
        "{} is outside {}",
        path.display(),
        root.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_omits_unused_payloads() {
        let json = serde_json::to_value(CompileResponse::text("ok".to_owned())).unwrap();
        assert_eq!(json["output"], "ok");
        assert!(json.get("wasm").is_none());
        assert!(json.get("error").is_none());
    }

    #[test]
    fn default_optimization_is_none() {
        assert_eq!(default_opt(), "none");
    }
}
