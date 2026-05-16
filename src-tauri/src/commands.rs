use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, State};

use crate::webhook::{self, WebhookConfig};
use crate::AppState;

#[tauri::command]
pub async fn apply_settings(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    port: u16,
    enabled: bool,
    bind_all: bool,
    #[allow(unused_variables)] duration_seconds: f64,
) -> Result<(), String> {
    let new_cfg = WebhookConfig {
        port,
        enabled,
        bind_all,
    };

    // Falls Config identisch und Server läuft → nichts tun
    let current_cfg = state.config.lock().await.clone();
    let already_running = state.webhook.lock().await.is_some();
    if current_cfg.port == new_cfg.port
        && current_cfg.enabled == new_cfg.enabled
        && current_cfg.bind_all == new_cfg.bind_all
        && already_running == new_cfg.enabled
    {
        return Ok(());
    }

    webhook::restart_server(app, new_cfg, &state.webhook, &state.config).await
}

#[tauri::command]
pub fn get_local_ip() -> String {
    match local_ip_address::local_ip() {
        Ok(ip) => ip.to_string(),
        Err(_) => String::new(),
    }
}

#[tauri::command]
pub async fn status_reply(
    state: State<'_, Arc<AppState>>,
    reply_id: String,
    status: Value,
) -> Result<(), String> {
    webhook::deliver_status_reply(&state.status_responders, &reply_id, status).await;
    Ok(())
}
