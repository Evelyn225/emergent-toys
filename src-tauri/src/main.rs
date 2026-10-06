#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod desktop_mouse;

#[cfg(windows)]
use tauri::Manager;

#[tauri::command]
fn set_game_mouse_capture(
    window: tauri::WebviewWindow,
    active: bool,
    confined: Option<bool>,
) -> bool {
    #[cfg(windows)]
    {
        return desktop_mouse::set_capture(&window, active, confined.unwrap_or(false));
    }

    #[cfg(not(windows))]
    {
        let _ = (window, active, confined);
        false
    }
}

#[tauri::command]
fn toggle_game_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let fullscreen = !window.is_fullscreen().map_err(|error| error.to_string())?;
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| error.to_string())?;
    Ok(fullscreen)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_game_mouse_capture,
            toggle_game_fullscreen
        ])
        .setup(|app| {
            #[cfg(windows)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    desktop_mouse::start(app.handle().clone(), &window);
                    let window_on_focus = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            desktop_mouse::stop_capture();
                            let _ = window_on_focus.set_cursor_grab(false);
                            let _ = window_on_focus.set_cursor_visible(true);
                        }
                    });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Glyphport");
}
