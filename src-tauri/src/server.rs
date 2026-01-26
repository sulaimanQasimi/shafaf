use axum::{
    body::Body,
    http::{Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// Embed ai.html content at compile time for production
// In development, try to read from file first, fallback to embedded
const EMBEDDED_AI_HTML: &str = include_str!("../../ai.html");

/// Start the HTTP server on port 5021 to serve ai.html
pub async fn start_server(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Try to find ai.html in multiple locations (for development)
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .ok();
    
    let current_dir = std::env::current_dir().ok();
    
    // Get executable directory (for production builds)
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));
    
    // Try multiple possible locations for ai.html (development first, then production)
    let possible_paths: Vec<PathBuf> = vec![
        // Development: project root
        current_dir.as_ref().map(|p| p.join("ai.html")),
        // Development: parent of current dir (if running from src-tauri)
        current_dir.as_ref().and_then(|p| p.parent().map(|p| p.join("ai.html"))),
        // Production: resource directory
        resource_dir.as_ref().map(|p| p.join("ai.html")),
        // Production: executable directory
        exe_dir.as_ref().map(|p| p.join("ai.html")),
        // Production: resources subdirectory (Windows)
        exe_dir.as_ref().map(|p| p.join("resources").join("ai.html")),
    ]
    .into_iter()
    .flatten()
    .collect();

    // Try to read from file first (for development/hot-reload)
    let ai_html_content = possible_paths
        .iter()
        .find(|p| p.exists())
        .and_then(|path| std::fs::read_to_string(path).ok())
        .unwrap_or_else(|| {
            // Fallback to embedded content (for production)
            println!("📄 Using embedded ai.html content");
            EMBEDDED_AI_HTML.to_string()
        });

    if let Some(path) = possible_paths.iter().find(|p| p.exists()) {
        println!("📄 Serving ai.html from file: {:?}", path);
    } else {
        println!("📄 Serving embedded ai.html content");
    }

    // Create the router
    let app = Router::new()
        .route("/", get(serve_ai_html))
        .route("/ai.html", get(serve_ai_html))
        .with_state(ai_html_content.clone());

    // Bind to localhost:5021
    let bind_addr = "127.0.0.1:5021";
    let listener = match tokio::net::TcpListener::bind(bind_addr).await {
        Ok(listener) => {
            println!("🚀 AI server started at http://{}/ai.html", bind_addr);
            listener
        }
        Err(e) => {
            eprintln!("❌ Failed to bind to {}: {}", bind_addr, e);
            eprintln!("   This might be because:");
            eprintln!("   - The port is already in use");
            eprintln!("   - You don't have permission to bind to this port");
            eprintln!("   - A firewall is blocking the connection");
            return Err(Box::new(e));
        }
    };
    
    // Start serving
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("❌ Server error: {}", e);
        return Err(Box::new(e));
    }
    
    Ok(())
}

/// Handler to serve ai.html
async fn serve_ai_html(
    axum::extract::State(content): axum::extract::State<String>,
) -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/html; charset=utf-8")
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from(content))
        .unwrap()
}
