use axum::{routing::post, Router};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

mod compile;
mod harness;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let bind_addr: SocketAddr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:3000".to_string())
        .parse()
        .expect("Invalid BIND_ADDR");

    let frontend =
        ServeDir::new("frontend").append_index_html_on_directories(true);

    let app = Router::new()
        .route("/api/compile", post(compile::compile))
        .fallback_service(frontend)
        .layer(CorsLayer::permissive());

    tracing::info!("Listening on http://{bind_addr}");
    let listener = tokio::net::TcpListener::bind(bind_addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
