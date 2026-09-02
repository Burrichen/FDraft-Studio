// FDraft Studio's Tauri backend is deliberately thin: almost all project-
// lifecycle logic (atomic saves, autosave, crash recovery, snapshots,
// undo/redo) lives in the TypeScript frontend (see apps/studio/src/), built
// against a `FilePlatform` abstraction so it can be unit-tested without a
// Rust/Tauri runtime at all. This file only wires up the official plugins
// that expose real filesystem/dialog/config-store access to that frontend
// code — it defines no custom commands of its own.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running FDraft Studio");
}
