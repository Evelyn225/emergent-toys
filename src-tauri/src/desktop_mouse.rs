use std::{
    mem::{size_of, zeroed},
    sync::{
        atomic::{AtomicBool, AtomicI32, Ordering},
        mpsc, OnceLock,
    },
    thread,
    time::Duration,
};
use tauri::{Emitter, WebviewWindow};
use windows_sys::Win32::{
    Devices::HumanInterfaceDevice::{HID_USAGE_GENERIC_MOUSE, HID_USAGE_PAGE_GENERIC},
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    System::LibraryLoader::GetModuleHandleW,
    UI::{
        Input::{
            GetRawInputData, RegisterRawInputDevices, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
            RIDEV_INPUTSINK, RID_INPUT, RIM_TYPEMOUSE,
        },
        WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DispatchMessageW, GetForegroundWindow, GetMessageW,
            RegisterClassW, HWND_MESSAGE, WM_INPUT, WNDCLASSW,
        },
    },
};
static ACTIVE: AtomicBool = AtomicBool::new(false);
static DELTA_X: AtomicI32 = AtomicI32::new(0);
static DELTA_Y: AtomicI32 = AtomicI32::new(0);
static INPUT_WINDOW: OnceLock<isize> = OnceLock::new();
static GAME_WINDOW: OnceLock<isize> = OnceLock::new();
unsafe fn register_mouse(hwnd: HWND) -> bool {
    let device = RAWINPUTDEVICE {
        usUsagePage: HID_USAGE_PAGE_GENERIC as u16,
        usUsage: HID_USAGE_GENERIC_MOUSE as u16,
        dwFlags: RIDEV_INPUTSINK,
        hwndTarget: hwnd,
    };
    RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32) != 0
}
pub fn start<R: tauri::Runtime>(app: tauri::AppHandle<R>, window: &WebviewWindow<R>) {
    let Ok(hwnd) = window.hwnd() else { return };
    let _ = GAME_WINDOW.set(hwnd.0 as isize);
    let (ready_tx, ready_rx) = mpsc::sync_channel(1);
    // Own the input window and message pump on one thread. Subclassing the WebView host can fail on a different
    // thread, and depends on how WebView2 creates and focuses its child windows.
    thread::spawn(move || unsafe {
        let class: Vec<u16> = "GlyphportMouseInput\0".encode_utf16().collect();
        let instance = GetModuleHandleW(std::ptr::null());
        let wc = WNDCLASSW {
            lpfnWndProc: Some(input_window_proc),
            hInstance: instance,
            lpszClassName: class.as_ptr(),
            ..zeroed()
        };
        if RegisterClassW(&wc) == 0 {
            let _ = ready_tx.send(false);
            return;
        }
        let input = CreateWindowExW(
            0,
            class.as_ptr(),
            class.as_ptr(),
            0,
            0,
            0,
            0,
            0,
            HWND_MESSAGE,
            std::ptr::null_mut(),
            instance,
            std::ptr::null(),
        );
        if input.is_null() || !register_mouse(input) {
            let _ = ready_tx.send(false);
            return;
        }
        let _ = INPUT_WINDOW.set(input as isize);
        let _ = ready_tx.send(true);
        let mut message = zeroed();
        while GetMessageW(&mut message, std::ptr::null_mut(), 0, 0) > 0 {
            DispatchMessageW(&message);
        }
    });
    if ready_rx.recv_timeout(Duration::from_secs(2)) != Ok(true) {
        eprintln!("Glyphport native mouse input could not initialize");
        return;
    }
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(8));
        let x = DELTA_X.swap(0, Ordering::AcqRel);
        let y = DELTA_Y.swap(0, Ordering::AcqRel);
        if ACTIVE.load(Ordering::Acquire) && (x != 0 || y != 0) {
            let _ = app.emit("desktop-mouse-delta", (x, y));
        }
    });
}
pub fn set_capture<R: tauri::Runtime>(
    window: &WebviewWindow<R>,
    active: bool,
    confined: bool,
) -> bool {
    if active {
        let Some(&input) = INPUT_WINDOW.get() else {
            return false;
        };
        // Reclaim registration on entering gameplay: other WebView/input components may register a mouse too.
        if !unsafe { register_mouse(input as HWND) } {
            return false;
        }
    }
    if window.set_cursor_grab(active || confined).is_err()
        || window.set_cursor_visible(!active).is_err()
    {
        let _ = window.set_cursor_grab(false);
        let _ = window.set_cursor_visible(true);
        stop_capture();
        return false;
    }
    DELTA_X.store(0, Ordering::Release);
    DELTA_Y.store(0, Ordering::Release);
    ACTIVE.store(active, Ordering::Release);
    true
}
pub fn stop_capture() {
    ACTIVE.store(false, Ordering::Release);
    DELTA_X.store(0, Ordering::Release);
    DELTA_Y.store(0, Ordering::Release);
}
unsafe extern "system" fn input_window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // Message-only input needs INPUTSINK. Read it only while the captured game is the foreground window;
    // another app's movement never enters the game, even before the asynchronous blur event arrives.
    if message == WM_INPUT
        && ACTIVE.load(Ordering::Acquire)
        && GAME_WINDOW.get().copied() == Some(GetForegroundWindow() as isize)
    {
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
            && read >= size_of::<RAWINPUTHEADER>() as u32
            && input.header.dwType == RIM_TYPEMOUSE
        {
            DELTA_X.fetch_add(input.data.mouse.lLastX, Ordering::Relaxed);
            DELTA_Y.fetch_add(input.data.mouse.lLastY, Ordering::Relaxed);
        }
    }
    DefWindowProcW(hwnd, message, wparam, lparam)
}
