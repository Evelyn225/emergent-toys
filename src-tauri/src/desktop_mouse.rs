use std::{
    mem::{size_of, zeroed},
    sync::{
        atomic::{AtomicBool, AtomicI32, Ordering},
        OnceLock,
    },
};
use tauri::{Emitter, WebviewWindow};
use windows_sys::Win32::{
    Devices::HumanInterfaceDevice::{HID_USAGE_GENERIC_MOUSE, HID_USAGE_PAGE_GENERIC},
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Input::{
            GetRawInputData, RegisterRawInputDevices, MOUSE_MOVE_ABSOLUTE, RAWINPUT,
            RAWINPUTDEVICE, RAWINPUTHEADER, RAWMOUSE, RIDEV_INPUTSINK, RIDEV_REMOVE, RID_INPUT,
            RIM_TYPEMOUSE,
        },
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            GetForegroundWindow, KillTimer, SetTimer, WA_INACTIVE, WM_ACTIVATE, WM_INPUT,
            WM_NCDESTROY, WM_TIMER,
        },
    },
};

const MOUSE_SUBCLASS: usize = 0x47594D53;
const MOUSE_TIMER: usize = 0x47594D54;
static GAME_WINDOW: OnceLock<WebviewWindow> = OnceLock::new();
static REGISTERED: AtomicBool = AtomicBool::new(false);
static ACTIVE: AtomicBool = AtomicBool::new(false);
static DELTA_X: AtomicI32 = AtomicI32::new(0);
static DELTA_Y: AtomicI32 = AtomicI32::new(0);

unsafe fn register_mouse(hwnd: HWND, active: bool) -> bool {
    let device = RAWINPUTDEVICE {
        usUsagePage: HID_USAGE_PAGE_GENERIC,
        usUsage: HID_USAGE_GENERIC_MOUSE,
        // WebView2's focused child belongs to its browser process. Route input to our host, but register
        // only during captured gameplay and check its foreground HWND before reading any movement.
        dwFlags: if active {
            RIDEV_INPUTSINK
        } else {
            RIDEV_REMOVE
        },
        hwndTarget: if active { hwnd } else { std::ptr::null_mut() },
    };
    RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32) != 0
}

pub async fn set_capture(window: WebviewWindow, active: bool) -> bool {
    let (result_tx, mut result_rx) = tauri::async_runtime::channel(1);
    let ui_window = window.clone();
    // Window subclassing must happen on its owning UI thread, including when IPC arrives on a worker.
    if window
        .run_on_main_thread(move || {
            let _ = result_tx.try_send(set_capture_on_main_thread(&ui_window, active));
        })
        .is_err()
    {
        return false;
    }
    result_rx.recv().await.unwrap_or(false)
}

fn set_capture_on_main_thread(window: &WebviewWindow, active: bool) -> bool {
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let hwnd = hwnd.0 as HWND;
    if GAME_WINDOW.get().is_none() {
        if unsafe { SetWindowSubclass(hwnd, Some(input_window_proc), MOUSE_SUBCLASS, 0) } == 0 {
            return false;
        }
        let _ = GAME_WINDOW.set(window.clone());
    }
    stop_capture(hwnd);
    if unsafe { GetForegroundWindow() } != hwnd {
        return !active;
    }
    if active {
        if !unsafe { register_mouse(hwnd, true) } {
            return false;
        }
        REGISTERED.store(true, Ordering::Release);
        // Coalesce high polling-rate mouse events on the existing UI message loop; no input worker or hidden window.
        if unsafe { SetTimer(hwnd, MOUSE_TIMER, 8, None) } == 0 {
            stop_capture(hwnd);
            return false;
        }
    }
    if window.set_cursor_grab(active).is_err() || window.set_cursor_visible(!active).is_err() {
        stop_capture(hwnd);
        return false;
    }
    ACTIVE.store(active, Ordering::Release);
    true
}

// Called only on the window's UI thread. Pausing, switching apps and closing unregister the device entirely.
fn stop_capture(hwnd: HWND) {
    ACTIVE.store(false, Ordering::Release);
    DELTA_X.store(0, Ordering::Release);
    DELTA_Y.store(0, Ordering::Release);
    unsafe {
        KillTimer(hwnd, MOUSE_TIMER);
        if REGISTERED.swap(false, Ordering::AcqRel) {
            register_mouse(hwnd, false);
        }
    }
    if let Some(window) = GAME_WINDOW.get() {
        let _ = window.set_cursor_grab(false);
        let _ = window.set_cursor_visible(true);
    }
}

fn release_for_focus_loss(hwnd: HWND) {
    let captured = ACTIVE.load(Ordering::Acquire);
    stop_capture(hwnd);
    if captured {
        if let Some(window) = GAME_WINDOW.get() {
            let _ = window.emit_to(window.label(), "desktop-mouse-released", ());
        }
    }
}

unsafe extern "system" fn input_window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _subclass: usize,
    _data: usize,
) -> LRESULT {
    if message == WM_ACTIVATE && wparam & 0xffff == WA_INACTIVE as usize {
        release_for_focus_loss(hwnd);
    } else if message == WM_NCDESTROY {
        stop_capture(hwnd);
        RemoveWindowSubclass(hwnd, Some(input_window_proc), MOUSE_SUBCLASS);
    } else if ACTIVE.load(Ordering::Acquire) {
        if GetForegroundWindow() != hwnd {
            release_for_focus_loss(hwnd);
        } else if message == WM_INPUT {
            let mut input: RAWINPUT = zeroed();
            let mut bytes = size_of::<RAWINPUT>() as u32;
            let read = GetRawInputData(
                lparam as _,
                RID_INPUT,
                (&mut input as *mut RAWINPUT).cast(),
                &mut bytes,
                size_of::<RAWINPUTHEADER>() as u32,
            );
            if read != u32::MAX
                && read >= (size_of::<RAWINPUTHEADER>() + size_of::<RAWMOUSE>()) as u32
                && input.header.dwType == RIM_TYPEMOUSE
                && input.data.mouse.usFlags & MOUSE_MOVE_ABSOLUTE == 0
            {
                DELTA_X.fetch_add(input.data.mouse.lLastX, Ordering::Relaxed);
                DELTA_Y.fetch_add(input.data.mouse.lLastY, Ordering::Relaxed);
            }
        } else if message == WM_TIMER && wparam == MOUSE_TIMER {
            let x = DELTA_X.swap(0, Ordering::AcqRel);
            let y = DELTA_Y.swap(0, Ordering::AcqRel);
            if x != 0 || y != 0 {
                if let Some(window) = GAME_WINDOW.get() {
                    let _ = window.emit_to(window.label(), "desktop-mouse-delta", (x, y));
                }
            }
        }
    }
    // Continue WebView/window handling, including the required foreground WM_INPUT cleanup.
    DefSubclassProc(hwnd, message, wparam, lparam)
}
