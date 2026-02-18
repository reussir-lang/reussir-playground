use anyhow::{Context, Result};
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone)]
pub struct Config {
    /// Address to listen on.  Overridable via `--bind` CLI flag.
    #[serde(default = "defaults::bind_addr")]
    pub bind_addr: SocketAddr,

    pub compiler: CompilerConfig,

    #[serde(default)]
    pub sandbox: SandboxConfig,
}

// ---------------------------------------------------------------------------
// Compiler / build config
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone)]
pub struct CompilerConfig {
    /// Absolute path to the reussir compiler binary.
    pub path: PathBuf,

    /// Optional directory containing the compiler's shared libraries
    /// (e.g. `build/lib/`).  Added as a read-only path in the sandbox so the
    /// compiler process can load `libMLIRReussirBridge.so` etc.
    pub lib_path: Option<PathBuf>,

    /// Path to the `reussir-rt` Cargo project directory.
    /// Used as the `reussir-rt` dependency when building the wasm32-wasip1 harness.
    /// The crate compiles for wasm just fine — the `dylib` crate-type is silently
    /// downgraded to `rlib` by cargo on that target.
    pub rt_path: PathBuf,

    /// Shared Cargo target directory for caching harness builds across requests.
    #[serde(default = "defaults::cargo_target_dir")]
    pub cargo_target_dir: PathBuf,

    /// Timeout for a single reussir compiler invocation.
    #[serde(default = "defaults::compile_timeout_secs")]
    pub compile_timeout_secs: u64,

    /// Timeout for `cargo build --target wasm32-wasip1` of the harness.
    #[serde(default = "defaults::cargo_timeout_secs")]
    pub cargo_timeout_secs: u64,
}

// ---------------------------------------------------------------------------
// Sandbox config
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone)]
#[serde(default)]
pub struct SandboxConfig {
    pub kind: SandboxKind,
    /// Path to the `bwrap` binary.  Falls back to searching PATH.
    pub bwrap_path: Option<PathBuf>,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        Self {
            kind: SandboxKind::Bwrap,
            bwrap_path: None,
        }
    }
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "lowercase")]
pub enum SandboxKind {
    /// Wrap the compiler in bubblewrap (recommended; requires bwrap in PATH or
    /// configured via `sandbox.bwrap_path`).
    #[default]
    Bwrap,
    /// Apply Linux Landlock rules in a pre-exec hook (requires kernel ≥ 5.13).
    Landlock,
    /// No sandboxing — for local development only.
    None,
}

// ---------------------------------------------------------------------------
// Default helpers
// ---------------------------------------------------------------------------

mod defaults {
    use std::net::SocketAddr;
    use std::path::PathBuf;

    pub fn bind_addr() -> SocketAddr {
        "127.0.0.1:3000".parse().unwrap()
    }

    pub fn cargo_target_dir() -> PathBuf {
        PathBuf::from("playground-target")
    }

    pub fn compile_timeout_secs() -> u64 {
        30
    }

    pub fn cargo_timeout_secs() -> u64 {
        180
    }
}

// ---------------------------------------------------------------------------
// Loading / validation
// ---------------------------------------------------------------------------

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("cannot read config file: {}", path.display()))?;
        let cfg: Config = toml::from_str(&text)
            .with_context(|| format!("failed to parse config file: {}", path.display()))?;
        cfg.validate()?;
        Ok(cfg)
    }

    fn validate(&self) -> Result<()> {
        anyhow::ensure!(
            self.compiler.path.exists(),
            "compiler.path does not exist: {}",
            self.compiler.path.display()
        );
        anyhow::ensure!(
            self.compiler.rt_path.exists(),
            "compiler.rt_path does not exist: {}",
            self.compiler.rt_path.display()
        );
        Ok(())
    }
}
