mod webhook;
mod commands;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use webhook::{WebhookConfig, WebhookHandle};

pub struct AppState {
    pub webhook: Mutex<Option<WebhookHandle>>,
    pub config: Mutex<WebhookConfig>,
    pub status_responders: Mutex<std::collections::HashMap<String, tokio::sync::oneshot::Sender<serde_json::Value>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            let state = Arc::new(AppState {
                webhook: Mutex::new(None),
                config: Mutex::new(WebhookConfig::default()),
                status_responders: Mutex::new(std::collections::HashMap::new()),
            });
            app.manage(state.clone());

            // Fenster: 9:16 Aspect-Ratio fixieren
            if let Some(win) = app.get_webview_window("main") {
                #[allow(unused_must_use)]
                {
                    win.set_min_size(Some(tauri::PhysicalSize::new(281, 500)));
                }
                let _ = win.set_decorations(false);
                let _ = win.set_shadow(false);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::apply_settings,
            commands::get_local_ip,
            commands::status_reply,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri konnte nicht gestartet werden");
}
