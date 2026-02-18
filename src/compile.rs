use axum::Json;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tempfile::TempDir;

#[derive(Deserialize)]
pub struct CompileRequest {
    source: String,
    driver: String,
    mode: String,
}

#[derive(Serialize)]
pub struct CompileResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl CompileResponse {
    fn ok(output: String) -> Self {
        Self {
            success: true,
            output: Some(output),
            error: None,
        }
    }
    fn err(error: String) -> Self {
        Self {
            success: false,
            output: None,
            error: Some(error),
        }
    }
}

fn compiler_path() -> Result<PathBuf, String> {
    required_env_path("REUSSIR_COMPILER")
}

fn rt_path() -> Result<PathBuf, String> {
    required_env_path("REUSSIR_RT_PATH")
}

fn lib_path() -> Result<String, String> {
    Ok(required_env_path("REUSSIR_LIB_PATH")?
        .to_string_lossy()
        .into_owned())
}

fn required_env_path(name: &str) -> Result<PathBuf, String> {
    let path = std::env::var(name)
        .map_err(|_| format!("Missing required environment variable: {name}"))?;
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err(format!("{name} does not exist: {}", path.display()));
    }
    Ok(path)
}

pub async fn compile(Json(req): Json<CompileRequest>) -> Json<CompileResponse> {
    let result = match req.mode.as_str() {
        "llvm-ir" | "asm" | "mlir" => compile_text(&req).await,
        "run" => compile_run(&req).await,
        mode => Err(format!("Unknown mode: {mode}")),
    };
    Json(match result {
        Ok(output) => CompileResponse::ok(output),
        Err(error) => CompileResponse::err(error),
    })
}

async fn compile_text(req: &CompileRequest) -> Result<String, String> {
    let compiler = compiler_path()?;
    let tmp = TempDir::new().map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let input = tmp.path().join("input.rr");
    let ext = match req.mode.as_str() {
        "llvm-ir" => "ll",
        "asm" => "s",
        "mlir" => "mlir",
        _ => unreachable!(),
    };
    let output = tmp.path().join(format!("output.{ext}"));

    std::fs::write(&input, &req.source)
        .map_err(|e| format!("Failed to write input: {e}"))?;

    let result = tokio::time::timeout(
        Duration::from_secs(15),
        tokio::process::Command::new(compiler)
            .arg(&input)
            .arg("-o")
            .arg(&output)
            .arg("-t")
            .arg(&req.mode)
            .output(),
    )
    .await
    .map_err(|_| "Compiler timed out (15s)".to_string())?
    .map_err(|e| format!("Failed to run compiler: {e}"))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let stdout = String::from_utf8_lossy(&result.stdout);
        return Err(format!("{stdout}{stderr}"));
    }

    std::fs::read_to_string(&output).map_err(|e| format!("Failed to read output: {e}"))
}

async fn compile_run(req: &CompileRequest) -> Result<String, String> {
    let compiler = compiler_path()?;
    let rt_path = rt_path()?;
    let lib_path = lib_path()?;
    let tmp = TempDir::new().map_err(|e| format!("Failed to create temp dir: {e}"))?;
    let input_path = tmp.path().join("input.rr");
    let object_path = tmp.path().join("output.o");

    // 1. Write source and compile to object
    std::fs::write(&input_path, &req.source)
        .map_err(|e| format!("Failed to write input: {e}"))?;

    let compile_result = tokio::time::timeout(
        Duration::from_secs(15),
        tokio::process::Command::new(compiler)
            .arg(&input_path)
            .arg("-o")
            .arg(&object_path)
            .arg("-t")
            .arg("object")
            .output(),
    )
    .await
    .map_err(|_| "Compiler timed out (15s)".to_string())?
    .map_err(|e| format!("Failed to run compiler: {e}"))?;

    if !compile_result.status.success() {
        let stderr = String::from_utf8_lossy(&compile_result.stderr);
        let stdout = String::from_utf8_lossy(&compile_result.stdout);
        return Err(format!("{stdout}{stderr}"));
    }

    // 2. Generate harness
    let harness = crate::harness::generate_harness(&req.source, &req.driver)?;

    // 3. Create temp cargo project
    let cargo_dir = tmp.path().join("harness");
    std::fs::create_dir_all(cargo_dir.join("src"))
        .map_err(|e| format!("Failed to create cargo project dir: {e}"))?;

    let rt_path = rt_path
        .canonicalize()
        .map_err(|e| format!("Cannot find reussir-rt at {:?}: {e}", rt_path))?;
    let object_abs = object_path
        .canonicalize()
        .map_err(|e| format!("Cannot find compiled object: {e}"))?;

    let cargo_toml = format!(
        r#"[package]
name = "playground-run"
version = "0.1.0"
edition = "2021"

[dependencies]
reussir-rt = {{ path = "{}" }}
"#,
        rt_path.display()
    );

    // build.rs links the compiled .o and ensures runtime symbols are available
    let build_rs = format!(
        r#"fn main() {{
    println!("cargo:rustc-link-arg={}");
    println!("cargo:rustc-link-arg=-Wl,--undefined=__reussir_allocate");
    println!("cargo:rustc-link-arg=-Wl,--undefined=__reussir_deallocate");
    println!("cargo:rustc-link-arg=-Wl,--undefined=__reussir_reallocate");
    println!("cargo:rustc-link-arg=-Wl,--undefined=__reussir_panic");
}}"#,
        object_abs.display()
    );

    std::fs::write(cargo_dir.join("Cargo.toml"), cargo_toml)
        .map_err(|e| format!("Failed to write Cargo.toml: {e}"))?;
    std::fs::write(cargo_dir.join("build.rs"), build_rs)
        .map_err(|e| format!("Failed to write build.rs: {e}"))?;
    std::fs::write(cargo_dir.join("src/main.rs"), harness)
        .map_err(|e| format!("Failed to write main.rs: {e}"))?;

    // 4. Build with cargo (shared target dir for caching reussir-rt builds)
    let shared_target = std::env::current_dir()
        .map_err(|e| format!("Cannot get current dir: {e}"))?
        .join("playground-target");

    let build_result = tokio::time::timeout(
        Duration::from_secs(60),
        tokio::process::Command::new("cargo")
            .arg("build")
            .arg("--release")
            .env("CARGO_TARGET_DIR", &shared_target)
            .current_dir(&cargo_dir)
            .output(),
    )
    .await
    .map_err(|_| "Cargo build timed out (60s)".to_string())?
    .map_err(|e| format!("Failed to run cargo build: {e}"))?;

    if !build_result.status.success() {
        let stderr = String::from_utf8_lossy(&build_result.stderr);
        return Err(format!("Build failed:\n{stderr}"));
    }

    // 5. Copy binary to temp dir (avoid races with concurrent builds)
    let binary_src = shared_target.join("release/playground-run");
    let binary_path = tmp.path().join("playground-run");
    std::fs::copy(&binary_src, &binary_path).map_err(|e| {
        format!(
            "Failed to copy binary from {}: {e}",
            binary_src.display()
        )
    })?;

    // 6. Execute the binary
    let run_result = tokio::time::timeout(
        Duration::from_secs(5),
        tokio::process::Command::new(&binary_path)
            .env("LD_LIBRARY_PATH", lib_path)
            .output(),
    )
    .await
    .map_err(|_| "Program timed out (5s)".to_string())?
    .map_err(|e| format!("Failed to execute program: {e}"))?;

    let stdout = String::from_utf8_lossy(&run_result.stdout);
    let stderr = String::from_utf8_lossy(&run_result.stderr);

    if !run_result.status.success() {
        if stderr.is_empty() {
            return Err(format!("Program exited with {}", run_result.status));
        }
        return Err(stderr.into_owned());
    }

    let mut output = stdout.into_owned();
    if !stderr.is_empty() {
        if !output.is_empty() {
            output.push('\n');
        }
        output.push_str("--- stderr ---\n");
        output.push_str(&stderr);
    }

    Ok(output)
}
