use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::get,
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{oneshot, Mutex};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

use crate::AppState;

#[derive(Clone, Debug)]
pub struct WebhookConfig {
    pub port: u16,
    pub enabled: bool,
    pub bind_all: bool,
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self {
            port: 8080,
            enabled: true,
            bind_all: true,
        }
    }
}

pub struct WebhookHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl WebhookHandle {
    pub fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

#[derive(Clone)]
struct AxumState {
    app: AppHandle,
}

#[derive(Deserialize)]
struct GiftParams {
    level: Option<i32>,
}

#[derive(Deserialize)]
struct HpParams {
    amount: Option<f32>,
}

#[derive(Deserialize)]
struct SkillParams {
    id: Option<i32>,
}

fn cors_headers() -> CorsLayer {
    CorsLayer::permissive()
}

fn build_router(state: AxumState) -> Router {
    Router::new()
        .route("/up", get(handle_up))
        .route("/down", get(handle_down))
        .route("/reset", get(handle_reset))
        .route("/gift", get(handle_gift))
        .route("/heal", get(handle_heal))
        .route("/damage", get(handle_damage))
        .route("/skill", get(handle_skill))
        .route("/status", get(handle_status))
        .route("/", get(handle_root))
        .with_state(state)
        .layer(cors_headers())
}

pub async fn start_server(
    app: AppHandle,
    config: WebhookConfig,
) -> Result<WebhookHandle, String> {
    let ip = if config.bind_all {
        IpAddr::V4(Ipv4Addr::UNSPECIFIED)
    } else {
        IpAddr::V4(Ipv4Addr::LOCALHOST)
    };
    let addr = SocketAddr::new(ip, config.port);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Port {} konnte nicht gebunden werden: {}", config.port, e))?;

    let (tx, rx) = oneshot::channel();
    let router = build_router(AxumState { app: app.clone() });

    tokio::spawn(async move {
        let server = axum::serve(listener, router).with_graceful_shutdown(async move {
            let _ = rx.await;
        });
        if let Err(e) = server.await {
            eprintln!("Webhook-Server beendet: {}", e);
        }
    });

    println!(
        "Webhook-Server läuft auf {}:{} (bind_all={})",
        ip, config.port, config.bind_all
    );

    Ok(WebhookHandle {
        shutdown_tx: Some(tx),
    })
}

// =============== Handlers ===============

async fn handle_up(State(s): State<AxumState>) -> impl IntoResponse {
    let _ = s.app.emit("webhook", json!({ "kind": "up" }));
    json_ok("Level UP")
}

async fn handle_down(State(s): State<AxumState>) -> impl IntoResponse {
    let _ = s.app.emit("webhook", json!({ "kind": "down" }));
    json_ok("Level DOWN")
}

async fn handle_reset(State(s): State<AxumState>) -> impl IntoResponse {
    let _ = s.app.emit("webhook", json!({ "kind": "reset" }));
    json_ok("Reset")
}

async fn handle_gift(
    State(s): State<AxumState>,
    Query(params): Query<GiftParams>,
) -> impl IntoResponse {
    let level = match params.level {
        Some(l) => l,
        None => {
            return json_err(
                StatusCode::BAD_REQUEST,
                "Parameter 'level' fehlt. Verwendung: /gift?level=X",
            )
        }
    };
    if !(1..=12).contains(&level) {
        return json_err(
            StatusCode::BAD_REQUEST,
            "Level muss zwischen 1 und 12 liegen",
        );
    }
    let _ = s
        .app
        .emit("webhook", json!({ "kind": "gift", "level": level }));
    json_ok(&format!("Gift für Level {} verarbeitet", level))
}

async fn handle_heal(
    State(s): State<AxumState>,
    Query(params): Query<HpParams>,
) -> impl IntoResponse {
    let amount = params.amount.unwrap_or(100.0);
    if !amount.is_finite() || amount <= 0.0 {
        return json_err(
            StatusCode::BAD_REQUEST,
            "Parameter 'amount' muss > 0 sein. Verwendung: /heal?amount=X",
        );
    }
    let _ = s
        .app
        .emit("webhook", json!({ "kind": "heal", "amount": amount }));
    json_ok(&format!("Heal +{} HP", amount))
}

async fn handle_damage(
    State(s): State<AxumState>,
    Query(params): Query<HpParams>,
) -> impl IntoResponse {
    let amount = params.amount.unwrap_or(100.0);
    if !amount.is_finite() || amount <= 0.0 {
        return json_err(
            StatusCode::BAD_REQUEST,
            "Parameter 'amount' muss > 0 sein. Verwendung: /damage?amount=X",
        );
    }
    let _ = s
        .app
        .emit("webhook", json!({ "kind": "damage", "amount": amount }));
    json_ok(&format!("Damage -{} HP", amount))
}

async fn handle_skill(
    State(s): State<AxumState>,
    Query(params): Query<SkillParams>,
) -> impl IntoResponse {
    let id = match params.id {
        Some(i) => i,
        None => {
            return json_err(
                StatusCode::BAD_REQUEST,
                "Parameter 'id' fehlt. Verwendung: /skill?id=N",
            )
        }
    };
    if id < 1 {
        return json_err(StatusCode::BAD_REQUEST, "Skill-ID muss >= 1 sein");
    }
    let _ = s
        .app
        .emit("webhook", json!({ "kind": "skill", "id": id }));
    json_ok(&format!("Skill #{} ausgelöst", id))
}

async fn handle_status(State(s): State<AxumState>) -> impl IntoResponse {
    // Frontend nach aktuellem Status fragen; mit Timeout auf Antwort warten
    let reply_id = Uuid::new_v4().to_string();
    let (tx, rx) = oneshot::channel::<Value>();

    if let Some(app_state) = s.app.try_state::<Arc<AppState>>() {
        let mut map = app_state.status_responders.lock().await;
        map.insert(reply_id.clone(), tx);
    } else {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, "State nicht verfügbar");
    }

    let _ = s.app.emit(
        "webhook",
        json!({ "kind": "status", "replyId": reply_id.clone() }),
    );

    match tokio::time::timeout(Duration::from_millis(1500), rx).await {
        Ok(Ok(value)) => (StatusCode::OK, Json(value)).into_response(),
        _ => {
            // Aufräumen falls Timeout
            if let Some(app_state) = s.app.try_state::<Arc<AppState>>() {
                let mut map = app_state.status_responders.lock().await;
                map.remove(&reply_id);
            }
            json_err(StatusCode::GATEWAY_TIMEOUT, "Frontend antwortete nicht")
        }
    }
}

async fn handle_root() -> impl IntoResponse {
    Json(json!({
        "app": "RunMMO",
        "endpoints": [
            "/up", "/down", "/reset", "/gift?level=X",
            "/heal?amount=X", "/damage?amount=X",
            "/skill?id=N", "/status"
        ]
    }))
}

// =============== Helpers ===============

fn json_ok(msg: &str) -> axum::response::Response {
    (StatusCode::OK, Json(json!({ "ok": true, "message": msg }))).into_response()
}

fn json_err(status: StatusCode, msg: &str) -> axum::response::Response {
    (status, Json(json!({ "ok": false, "error": msg }))).into_response()
}

// Hilfsfunktion: Server (neu)starten basierend auf neuer Config
pub async fn restart_server(
    app: AppHandle,
    new_cfg: WebhookConfig,
    handle_slot: &Mutex<Option<WebhookHandle>>,
    config_slot: &Mutex<WebhookConfig>,
) -> Result<(), String> {
    // Alten Server beenden
    {
        let mut guard = handle_slot.lock().await;
        if let Some(mut h) = guard.take() {
            h.shutdown();
        }
    }

    // Kurz warten, damit das Socket freigegeben wird
    tokio::time::sleep(Duration::from_millis(100)).await;

    if new_cfg.enabled {
        let new_handle = start_server(app.clone(), new_cfg.clone()).await?;
        *handle_slot.lock().await = Some(new_handle);
    }

    *config_slot.lock().await = new_cfg;
    Ok(())
}

// Status-Responder-Map dispose
pub async fn deliver_status_reply(
    map: &Mutex<HashMap<String, oneshot::Sender<Value>>>,
    reply_id: &str,
    value: Value,
) -> bool {
    let mut guard = map.lock().await;
    if let Some(tx) = guard.remove(reply_id) {
        let _ = tx.send(value);
        true
    } else {
        false
    }
}
