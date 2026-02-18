mod compile;
mod config;
mod harness;
mod sandbox;

use axum::{Router, routing::post};
use clap::Parser;
use config::Config;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::{cors::CorsLayer, services::ServeDir};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

#[derive(Parser, Debug)]
#[command(about = "Reussir language playground server")]
struct Cli {
    /// Path to the TOML configuration file.
    #[arg(short, long, default_value = "config.toml")]
    config: PathBuf,

    /// Override the bind address from the config file.
    #[arg(short, long)]
    bind: Option<SocketAddr>,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cli = Cli::parse();
    let mut cfg = Config::load(&cli.config)?;

    if let Some(bind) = cli.bind {
        cfg.bind_addr = bind;
    }

    let bind_addr = cfg.bind_addr;
    let cfg = Arc::new(cfg);

    let frontend = ServeDir::new("frontend").append_index_html_on_directories(true);

    let app = Router::new()
        .route("/api/compile", post(compile::handle))
        .with_state(cfg)
        .fallback_service(frontend)
        .layer(CorsLayer::permissive());

    tracing::info!("listening on http://{bind_addr}");
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
