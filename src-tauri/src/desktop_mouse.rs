use std::{
    mem::{size_of, zeroed},
    sync::{
        atomic::{AtomicBool, AtomicI32, Ordering},
        OnceLock,
    },
    thread,
    time::Duration,
};

use tauri::{Emitter, WebviewWindow};
use windows_sys::Win32::{
    Devices::HumanInterfaceDevice::{HID_USAGE_GENERIC_MOUSE, HID_USAGE_PAGE_GENERIC},
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Input::{
            GetRawInputData, RegisterRawInputDevices, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
            RID_INPUT, RIM_TYPEMOUSE,
        },
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::WM_INPUT,
    },
};

const SUBCLASS_ID: usize = 0x474c_5950;
static ACTIVE: AtomicBool = AtomicBool::new(false);
static READY: AtomicBool = AtomicBool::new(false);
static DELTA_X: AtomicI32 = AtomicI32::new(0);
static DELTA_Y: AtomicI32 = AtomicI32::new(0);
static INPUT_WINDOW: OnceLock<isize> = OnceLock::new();

pub fn start<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: &WebviewWindow<R>) {
    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = hwnd.0 as HWND;
    let device = RAWINPUTDEVICE {
        usUsagePage: HID_USAGE_PAGE_GENERIC as u16,
        usUsage: HID_USAGE_GENERIC_MOUSE as u16,
        dwFlags: 0,
        hwndTarget: hwnd,
    };
    // Foreground-only input is intentional: the app never reads mouse movement
    // while another window has focus. The subclass remains on Tauri's HWND so
    // it does not replace Wry's window procedure.
    let registered =
        unsafe { RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32) };
    if registered == 0 {
        return;
    }

    if unsafe { SetWindowSubclass(hwnd, Some(input_window_proc), SUBCLASS_ID, 0) } == 0 {
        let remove = RAWINPUTDEVICE {
            dwFlags: windows_sys::Win32::UI::Input::RIDEV_REMOVE,
            hwndTarget: std::ptr::null_mut(),
            ..device
        };
        unsafe {
            RegisterRawInputDevices(&remove, 1, size_of::<RAWINPUTDEVICE>() as u32);
        }
        return;
    }
    let _ = INPUT_WINDOW.set(hwnd as isize);
    READY.store(true, Ordering::Release);

    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(8));
        let x = DELTA_X.swap(0, Ordering::AcqRel);
        let y = DELTA_Y.swap(0, Ordering::AcqRel);
        if ACTIVE.load(Ordering::Acquire) && (x != 0 || y != 0) {
            let _ = app.emit("desktop-mouse-delta", (x, y));
        }
    });
}

pub fn set_capture<R: tauri::Runtime>(window: &WebviewWindow<R>, active: bool) -> bool {
    if !READY.load(Ordering::Acquire) {
        return false;
    }
    if active {
        if window.set_cursor_grab(true).is_err() || window.set_cursor_visible(false).is_err() {
            let _ = window.set_cursor_grab(false);
            let _ = window.set_cursor_visible(true);
            return false;
        }
        DELTA_X.store(0, Ordering::Release);
        DELTA_Y.store(0, Ordering::Release);
        ACTIVE.store(true, Ordering::Release);
    } else {
        stop_capture();
        let _ = window.set_cursor_grab(false);
        let _ = window.set_cursor_visible(true);
    }
    true
}

pub fn stop_capture() {
    ACTIVE.store(false, Ordering::Release);
}

unsafe extern "system" fn input_window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    subclass_id: usize,
    _reference: usize,
) -> LRESULT {
    if message == WM_INPUT && ACTIVE.load(Ordering::Acquire) {
        let mut input: RAWINPUT = zeroed();
        let mut bytes = size_of::<RAWINPUT>() as u32;
        let read = GetRawInputData(
            lparam as _,
            RID_INPUT,
            (&mut input as *mut RAWINPUT).cast(),
            &mut bytes,
            size_of::<RAWINPUTHEADER>() as u32,
        );
        if read != u32::MAX && input.header.dwType == RIM_TYPEMOUSE {
            DELTA_X.fetch_add(input.data.mouse.lLastX, Ordering::Relaxed);
            DELTA_Y.fetch_add(input.data.mouse.lLastY, Ordering::Relaxed);
        }
    }
    if message == windows_sys::Win32::UI::WindowsAndMessaging::WM_NCDESTROY {
        let _ = RemoveWindowSubclass(hwnd, Some(input_window_proc), subclass_id);
        if INPUT_WINDOW.get().copied() == Some(hwnd as isize) {
            ACTIVE.store(false, Ordering::Release);
            READY.store(false, Ordering::Release);
        }
    }
    DefSubclassProc(hwnd, message, wparam, lparam)
}
