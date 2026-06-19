use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![cursor_position])
        .setup(|app| {
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
fn cursor_position() -> Result<(f64, f64), String> {
    platform_cursor_position()
}

#[cfg(target_os = "windows")]
fn platform_cursor_position() -> Result<(f64, f64), String> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    let ok = unsafe { GetCursorPos(&mut point) };

    if ok == 0 {
        Err("GetCursorPos failed".to_string())
    } else {
        Ok((point.x as f64, point.y as f64))
    }
}

#[cfg(not(target_os = "windows"))]
fn platform_cursor_position() -> Result<(f64, f64), String> {
    Err("Global cursor tracking is implemented for Windows in this MVP.".to_string())
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
