use axum::{
    body::Body,
    http::{Response, StatusCode},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Start the HTTP server on port 5021 to serve ai.html
pub async fn start_server(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Try to find ai.html in multiple locations
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
        // Fallback: current directory
        Some(PathBuf::from("ai.html")),
    ]
    .into_iter()
    .flatten()
    .collect();

    let ai_html_path = possible_paths
        .iter()
        .find(|p| p.exists())
        .ok_or_else(|| {
            let searched: Vec<String> = possible_paths.iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            format!("ai.html not found. Searched: {:?}", searched)
        })?;

    let ai_html_content = std::fs::read_to_string(ai_html_path)
        .map_err(|e| format!("Failed to read ai.html from {:?}: {}", ai_html_path, e))?;

    println!("📄 Serving ai.html from: {:?}", ai_html_path);

    // Create the router
    let app = Router::new()
        .route("/", get(serve_ai_html))
        .route("/ai.html", get(serve_ai_html))
        .with_state(ai_html_content.clone());

    // Bind to localhost:5021
    let listener = tokio::net::TcpListener::bind("127.0.0.1:5021").await?;
    
    println!("🚀 AI server started at http://127.0.0.1:5021/ai.html");
    
    axum::serve(listener, app).await?;
    
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
