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
    /// Absolute path to the `rrc` compiler binary from a Reussir nightly.
    pub rrc_path: PathBuf,

    /// Absolute path to the `rene` package manager from the same nightly.
    pub rene_path: PathBuf,

    /// `llvm-strip` used to remove non-runtime sections before returning WASM.
    pub llvm_strip_path: PathBuf,

    /// Optional absolute Rust toolchain overrides. When absent, the server
    /// resolves `rustc` and `cargo` from PATH before invoking Rene.
    pub rustc_path: Option<PathBuf>,
    pub cargo_path: Option<PathBuf>,

    /// Shared Rene build directory. Runtime baking and compiler artifacts are
    /// cached here across requests.
    #[serde(default = "defaults::build_dir")]
    pub build_dir: PathBuf,

    /// Writable Cargo home used while Rene bakes its embedded runtime.
    /// Defaults to `<build_dir>/cargo-home`.
    pub cargo_home: Option<PathBuf>,

    /// Toolchain roots that sandboxed Rene/rrc processes need to read.
    /// Docker uses this for the rustup and Cargo installations under `/opt`.
    #[serde(default)]
    pub toolchain_ro_paths: Vec<PathBuf>,

    /// Timeout for a single rrc invocation.
    #[serde(default = "defaults::compile_timeout_secs")]
    pub compile_timeout_secs: u64,

    /// Timeout for a Rene build, including a first-use runtime bake.
    #[serde(default = "defaults::build_timeout_secs")]
    pub build_timeout_secs: u64,
}

impl CompilerConfig {
    pub fn cargo_home(&self) -> PathBuf {
        self.cargo_home
            .clone()
            .unwrap_or_else(|| self.build_dir.join("cargo-home"))
    }
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

    pub fn build_dir() -> PathBuf {
        PathBuf::from("playground-build")
    }

    pub fn compile_timeout_secs() -> u64 {
        30
    }

    pub fn build_timeout_secs() -> u64 {
        300
    }
}

// ---------------------------------------------------------------------------
// Loading / validation
// ---------------------------------------------------------------------------

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("cannot read config file: {}", path.display()))?;
        let mut cfg: Config = toml::from_str(&text)
            .with_context(|| format!("failed to parse config file: {}", path.display()))?;
        let cwd = std::env::current_dir().context("cannot resolve current directory")?;
        if cfg.compiler.build_dir.is_relative() {
            cfg.compiler.build_dir = cwd.join(&cfg.compiler.build_dir);
        }
        if let Some(cargo_home) = &mut cfg.compiler.cargo_home {
            if cargo_home.is_relative() {
                *cargo_home = cwd.join(&*cargo_home);
            }
        }
        cfg.validate()?;
        Ok(cfg)
    }

    fn validate(&self) -> Result<()> {
        for (name, path) in [
            ("compiler.rrc_path", &self.compiler.rrc_path),
            ("compiler.rene_path", &self.compiler.rene_path),
            ("compiler.llvm_strip_path", &self.compiler.llvm_strip_path),
        ] {
            anyhow::ensure!(path.is_file(), "{name} does not exist: {}", path.display());
        }
        std::fs::create_dir_all(&self.compiler.build_dir).with_context(|| {
            format!(
                "cannot create compiler.build_dir: {}",
                self.compiler.build_dir.display()
            )
        })?;
        let cargo_home = self.compiler.cargo_home();
        std::fs::create_dir_all(&cargo_home).with_context(|| {
            format!(
                "cannot create compiler.cargo_home: {}",
                cargo_home.display()
            )
        })?;
        let temp_dir = self.compiler.build_dir.join("tmp");
        std::fs::create_dir_all(&temp_dir).with_context(|| {
            format!(
                "cannot create compiler temporary directory: {}",
                temp_dir.display()
            )
        })?;
        Ok(())
    }
}
