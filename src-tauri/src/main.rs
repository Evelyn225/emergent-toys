#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod desktop_mouse;
mod screenshots;

#[tauri::command]
async fn save_screenshot(png: Vec<u8>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || screenshots::save(&png))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn open_screenshot_folder(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
        // IPC has no path argument: Explorer can only open the app's own screenshot directory.
        let directory = screenshots::directory()?;
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let path: Vec<u16> = directory
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let verb: Vec<u16> = "open\0".encode_utf16().collect();
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        let result = unsafe {
            ShellExecuteW(
                hwnd.0 as _,
                verb.as_ptr(),
                path.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        if result as isize > 32 {
            Ok(())
        } else {
            Err("Windows could not open the Screenshots folder".into())
        }
    }
    #[cfg(not(windows))]
    {
        let _ = window;
        Err("Opening the screenshot folder is only available on Windows".into())
    }
}

#[tauri::command]
async fn set_game_mouse_capture(window: tauri::WebviewWindow, active: bool) -> bool {
    #[cfg(windows)]
    {
        desktop_mouse::set_capture(window, active).await
    }

    #[cfg(not(windows))]
    {
        let _ = (window, active);
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

#[tauri::command]
fn quit_game(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_game_mouse_capture,
            toggle_game_fullscreen,
            open_game_update,
            save_screenshot,
            open_screenshot_folder,
            quit_game
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Glyphport");
}
