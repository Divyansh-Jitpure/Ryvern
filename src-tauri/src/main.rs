use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![input_snapshot])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(true);
            }

            let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &quit])?;
            let tray_icon = Image::new_owned(make_tray_icon_rgba(), 32, 32);

            // The tray is the tiny native control surface for the pet window.
            // React remains focused on future settings UI, while Rust owns OS
            // integration such as always-on-top windows and process lifetime.
            TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(tray_icon)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            match window.is_visible() {
                                Ok(true) => {
                                    let _ = window.hide();
                                }
                                _ => {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn input_snapshot() -> Result<(f64, f64, u32, u32), String> {
    platform_input_snapshot()
}

#[cfg(target_os = "windows")]
fn platform_input_snapshot() -> Result<(f64, f64, u32, u32), String> {
    use std::mem::size_of;
    use std::sync::atomic::{AtomicU32, Ordering};
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, GetLastInputInfo, LASTINPUTINFO,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    static LAST_KEYBOARD_INPUT_TICK: AtomicU32 = AtomicU32::new(0);

    let mut point = POINT { x: 0, y: 0 };
    let ok = unsafe { GetCursorPos(&mut point) };

    if ok == 0 {
        return Err("GetCursorPos failed".to_string());
    }

    let mut last_input = LASTINPUTINFO {
        cbSize: size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    let ok = unsafe { GetLastInputInfo(&mut last_input) };

    if ok == 0 {
        return Err("GetLastInputInfo failed".to_string());
    }

    let now = unsafe { GetTickCount() };
    let input_age_ms = now.wrapping_sub(last_input.dwTime);

    // Observe only whether a keyboard key changed state. No key identity or
    // typed content crosses the command boundary or is stored by the app.
    let keyboard_active = (0x08..=0xFE)
        .any(|virtual_key| unsafe { GetAsyncKeyState(virtual_key) } as u16 & 0x8001 != 0);

    if keyboard_active {
        LAST_KEYBOARD_INPUT_TICK.store(now, Ordering::Relaxed);
    }

    let last_keyboard_tick = LAST_KEYBOARD_INPUT_TICK.load(Ordering::Relaxed);
    let keyboard_input_age_ms = if last_keyboard_tick == 0 {
        u32::MAX
    } else {
        now.wrapping_sub(last_keyboard_tick)
    };

    Ok((
        point.x as f64,
        point.y as f64,
        input_age_ms,
        keyboard_input_age_ms,
    ))
}

#[cfg(not(target_os = "windows"))]
fn platform_input_snapshot() -> Result<(f64, f64, u32, u32), String> {
    Err("Global input tracking is implemented for Windows in this MVP.".to_string())
}

fn make_tray_icon_rgba() -> Vec<u8> {
    let mut rgba = vec![0; 32 * 32 * 4];

    for y in 0..32 {
        for x in 0..32 {
            let dx = x as i32 - 16;
            let dy = y as i32 - 17;
            let body = dx * dx + dy * dy <= 12 * 12;
            let horn_left = (9..=12).contains(&x) && (5..=10).contains(&y);
            let horn_right = (20..=23).contains(&x) && (5..=10).contains(&y);
            let wing_left = (5..=10).contains(&x) && (15..=22).contains(&y);
            let wing_right = (22..=27).contains(&x) && (15..=22).contains(&y);
            let eye = ((x == 12 || x == 20) && (y == 16 || y == 17)) || (x == 16 && y == 21);

            if body || horn_left || horn_right || wing_left || wing_right {
                let index = ((y * 32 + x) * 4) as usize;
                let color = if eye {
                    [58, 36, 25, 255]
                } else if horn_left || horn_right {
                    [246, 219, 146, 255]
                } else if wing_left || wing_right {
                    [101, 126, 91, 255]
                } else {
                    [73, 139, 105, 255]
                };
                rgba[index..index + 4].copy_from_slice(&color);
            }
        }
    }

    rgba
}

