#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod desktop_mouse;

#[cfg(windows)]
use tauri::Manager;

#[tauri::command]
async fn set_game_mouse_capture(
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
async fn toggle_game_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let fullscreen = !window.is_fullscreen().map_err(|error| error.to_string())?;
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| error.to_string())?;
    Ok(fullscreen)
}

#[tauri::command]
async fn open_game_update(window: tauri::WebviewWindow, version: String) -> Result<(), String> {
    // Construct the official installer URL ourselves; IPC cannot open arbitrary URLs or programs.
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3
        || parts.iter().any(|part| {
            part.is_empty()
                || !part.bytes().all(|b| b.is_ascii_digit())
                || part.parse::<u32>().is_err()
        })
    {
        return Err("Invalid release version".into());
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
        let url: Vec<u16> = format!("https://github.com/Evelyn225/emergent-toys/releases/download/ascii-city-v{version}/Glyphport-Setup.exe\0").encode_utf16().collect();
        let verb: Vec<u16> = "open\0".encode_utf16().collect();
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        let result = unsafe {
            ShellExecuteW(
                hwnd.0 as _,
                verb.as_ptr(),
                url.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        if result as isize > 32 {
            Ok(())
        } else {
            Err("Could not open the installer download".into())
        }
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        Err("Windows updates are only available on Windows".into())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_game_mouse_capture,
            toggle_game_fullscreen,
            open_game_update
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
