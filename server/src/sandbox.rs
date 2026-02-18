//! Sandbox wrappers for compiler invocations.
//!
//! Two backends:
//!  - **bwrap** — bubblewrap: unshares namespaces, mounts a minimal read-only
//!    rootfs, and gives read-write access only to the per-request temp dir.
//!  - **landlock** — Linux Landlock LSM: applied via `pre_exec` in the child
//!    process between `fork` and `exec`; restricts filesystem access without
//!    needing a setuid helper.
//!
//! Both backends accept the same calling convention: a path to the program, its
//! arguments, the working directory that needs read-write access, and any extra
//! paths that need read-only access (e.g., the directory that holds the
//! compiler binary on exotic layouts).

use crate::config::{SandboxConfig, SandboxKind};
use anyhow::{Context, Result};
use std::ffi::OsStr;
use std::path::Path;
use tokio::process::Command;

/// Return a `Command` that runs `program args` inside the configured sandbox.
///
/// * `work_dir`       — the per-request temp directory; gets full read-write
///                      access so the compiler can read the source and write
///                      the output.
/// * `extra_ro_paths` — additional paths that need read-only access (e.g., the
///                      parent directory of the compiler binary).
pub fn wrap<I, S>(
    cfg: &SandboxConfig,
    program: &Path,
    args: I,
    work_dir: &Path,
    extra_ro_paths: &[&Path],
) -> Result<Command>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    match &cfg.kind {
        SandboxKind::None => {
            let mut cmd = Command::new(program);
            cmd.args(args);
            Ok(cmd)
        }
        SandboxKind::Bwrap => bwrap_wrap(cfg, program, args, work_dir, extra_ro_paths),
        SandboxKind::Landlock => landlock_wrap(program, args, work_dir, extra_ro_paths),
    }
}

// ---------------------------------------------------------------------------
// bwrap backend
// ---------------------------------------------------------------------------

fn bwrap_wrap<I, S>(
    cfg: &SandboxConfig,
    program: &Path,
    args: I,
    work_dir: &Path,
    extra_ro_paths: &[&Path],
) -> Result<Command>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let bwrap = cfg
        .bwrap_path
        .as_deref()
        .unwrap_or_else(|| Path::new("bwrap"));

    let mut cmd = Command::new(bwrap);

    // Unshare user, IPC, and UTS namespaces.
    // We intentionally omit --unshare-net: creating a new network namespace
    // requires CAP_NET_ADMIN to set up the loopback interface, which is not
    // available in all environments (containers, unprivileged users on some
    // kernels).  The compiler has no network code so this is not a security
    // regression — filesystem and process isolation is what matters here.
    cmd.args(["--unshare-user", "--unshare-ipc", "--unshare-uts"]);

    // Minimal read-only filesystem: standard FHS locations.
    for &dir in &["/usr", "/bin", "/sbin", "/lib", "/lib64", "/lib32"] {
        if Path::new(dir).exists() {
            cmd.args(["--ro-bind", dir, dir]);
        }
    }

    // NixOS keeps everything under /nix/store.
    if Path::new("/nix").exists() {
        cmd.args(["--ro-bind", "/nix", "/nix"]);
    }

    // Dynamic linker cache and config.
    for &f in &["/etc/ld.so.cache", "/etc/ld.so.conf", "/etc/alternatives"] {
        if Path::new(f).exists() {
            cmd.args(["--ro-bind", f, f]);
        }
    }

    // proc, dev, and a fresh /tmp inside the sandbox.
    cmd.args(["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp"]);

    // The per-request work directory — read-write so the compiler can write output.
    let work_str = work_dir
        .to_str()
        .context("work_dir path contains non-UTF-8 bytes")?;
    cmd.args(["--bind", work_str, work_str]);

    // Extra read-only paths supplied by the caller.
    for path in extra_ro_paths {
        if path.exists() {
            if let Some(s) = path.to_str() {
                cmd.args(["--ro-bind", s, s]);
            }
        }
    }

    // Kill the sandboxed process if the server process exits.
    cmd.args(["--die-with-parent", "--"]);
    cmd.arg(program);
    cmd.args(args);

    Ok(cmd)
}

// ---------------------------------------------------------------------------
// Landlock backend
// ---------------------------------------------------------------------------

fn landlock_wrap<I, S>(
    program: &Path,
    args: I,
    work_dir: &Path,
    extra_ro_paths: &[&Path],
) -> Result<Command>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    #[cfg(not(target_os = "linux"))]
    {
        tracing::warn!("Landlock is Linux-only; falling back to no-sandbox mode");
        let mut cmd = Command::new(program);
        cmd.args(args);
        return Ok(cmd);
    }

    #[cfg(target_os = "linux")]
    {
        let work_dir = work_dir.to_owned();
        let extra: Vec<std::path::PathBuf> = extra_ro_paths
            .iter()
            .filter(|p| p.exists())
            .map(|p| p.to_path_buf())
            .collect();

        let mut cmd = Command::new(program);
        cmd.args(args);

        // SAFETY: this closure runs in the child process between fork and exec.
        // No Tokio runtime is active at that point — only async-signal-safe
        // operations and the Landlock syscalls (which are syscall wrappers) are
        // safe here.  We do not touch any Rust runtime state besides the
        // Landlock crate's own thin syscall wrappers.
        unsafe {
            cmd.pre_exec(move || {
                apply_landlock(&work_dir, &extra)
                    .map_err(|e| std::io::Error::new(std::io::ErrorKind::PermissionDenied, e))
            });
        }

        Ok(cmd)
    }
}

#[cfg(target_os = "linux")]
fn apply_landlock(
    work_dir: &Path,
    extra_ro: &[std::path::PathBuf],
) -> anyhow::Result<()> {
    use landlock::{
        ABI, Access, AccessFs, PathBeneath, PathFd, Ruleset, RulesetAttr,
        RulesetCreatedAttr,
    };

    // Use the highest ABI the running kernel supports.
    let abi = ABI::V3;
    let read_only = AccessFs::from_read(abi);
    let read_write = AccessFs::from_all(abi);

    let mut ruleset = Ruleset::default()
        .handle_access(read_write)?
        .create()?;

    // Standard system paths: read-only.
    for dir in [
        "/usr", "/bin", "/sbin", "/lib", "/lib64", "/lib32", "/nix", "/etc",
    ] {
        let p = Path::new(dir);
        if p.exists() {
            ruleset = ruleset.add_rule(PathBeneath::new(PathFd::new(p)?, read_only))?;
        }
    }

    // Caller-supplied extra read-only paths.
    for p in extra_ro {
        if p.exists() {
            ruleset = ruleset.add_rule(PathBeneath::new(PathFd::new(p)?, read_only))?;
        }
    }

    // The work directory: read-write (source input + compiled output).
    ruleset = ruleset.add_rule(PathBeneath::new(PathFd::new(work_dir)?, read_write))?;

    ruleset.restrict_self()?;
    Ok(())
}
