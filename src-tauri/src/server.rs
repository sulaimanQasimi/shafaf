use axum::{
    body::Body,
    extract::State,
    http::{Response, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json,
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

// Embed ai.html content at compile time for production
// In development, try to read from file first, fallback to embedded
const EMBEDDED_AI_HTML: &str = include_str!("../../ai.html");

#[derive(Debug, Serialize, Deserialize)]
struct PuterCredentials {
    app_id: String,
    auth_token: String,
}

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

    // Get app data directory for storing credentials
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
    
    let credentials_path = Arc::new(app_data_dir.join("puter_credentials.json"));

    // Create the router
    let app = Router::new()
        .route("/", get(serve_ai_html))
        .route("/ai.html", get(serve_ai_html))
        .route("/api/store-credentials", post(store_credentials))
        .route("/api/get-credentials", get(get_credentials))
        .with_state((ai_html_content.clone(), credentials_path));

    // Bind to all interfaces on port 5021
    let bind_addr = "0.0.0.0:5021";
    let listener = match tokio::net::TcpListener::bind(bind_addr).await {
        Ok(listener) => {
            println!("🚀 AI server started at http://127.0.0.1:5021/ai.html (listening on all interfaces)");
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
    State((content, _)): State<(String, Arc<PathBuf>)>,
) -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/html; charset=utf-8")
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from(content))
        .unwrap()
}

/// Handler to store Puter credentials
async fn store_credentials(
    State((_, credentials_path)): State<(String, Arc<PathBuf>)>,
    Json(credentials): Json<PuterCredentials>,
) -> impl IntoResponse {
    // Store credentials in JSON file
    match serde_json::to_string_pretty(&credentials) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&*credentials_path, json) {
                return Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Body::from(format!(r#"{{"error": "Failed to write credentials: {}"}}"#, e)))
                    .unwrap();
            }
            
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(r#"{"success": true}"#))
                .unwrap()
        }
        Err(e) => {
            Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(format!(r#"{{"error": "Failed to serialize credentials: {}"}}"#, e)))
                .unwrap()
        }
    }
}

/// Handler to get Puter credentials
async fn get_credentials(
    State((_, credentials_path)): State<(String, Arc<PathBuf>)>,
) -> impl IntoResponse {
    match std::fs::read_to_string(&*credentials_path) {
        Ok(content) => {
            match serde_json::from_str::<PuterCredentials>(&content) {
                Ok(credentials) => {
                    Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Body::from(serde_json::to_string(&credentials).unwrap()))
                        .unwrap()
                }
                Err(e) => {
                    Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Body::from(format!(r#"{{"error": "Failed to parse credentials: {}"}}"#, e)))
                        .unwrap()
                }
            }
        }
        Err(_) => {
            // File doesn't exist, return empty response
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Body::from(r#"{"error": "No credentials found"}"#))
                .unwrap()
        }
    }
}
