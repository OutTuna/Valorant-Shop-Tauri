mod commands;
mod error;
mod types;
mod valorant;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Desktop-only: makes sure a second launch (e.g. the OS opening
    // `valorant-store://...` while the app is already running) gets
    // forwarded into this instance instead of spawning a duplicate window.
    // The "deep-link" Cargo feature on this plugin wires that forwarded
    // argv straight into the deep-link plugin's "deep-link://new-url"
    // event, so the frontend only ever needs one listener
    // (`onOpenUrl` from `@tauri-apps/plugin-deep-link`) regardless of OS.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }

    builder = builder.plugin(tauri_plugin_deep_link::init());
    builder = builder.plugin(tauri_plugin_opener::init());
    builder = commands::register(builder);

    builder
        .run(tauri::generate_context!())
        .expect("error while running the Valorant Store application");
}
