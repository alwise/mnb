use tauri::async_runtime;

#[tauri::command]
async fn get_printers() -> Result<Vec<String>, String> {
  async_runtime::spawn_blocking(|| {
    #[cfg(target_os = "windows")]
    {
      use std::process::Command;
      use std::os::windows::process::CommandExt;

      const CREATE_NO_WINDOW: u32 = 0x08000000;

      let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(&[
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress",
        ])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

      if !output.status.success() {
        return Err("Failed to get printers".into());
      }

      let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8: {}", e))?;

      let printers = match serde_json::from_str::<serde_json::Value>(&stdout) {
        Ok(serde_json::Value::Array(arr)) => arr
          .into_iter()
          .filter_map(|v| v.as_str().map(String::from))
          .collect(),
        Ok(serde_json::Value::String(s)) => vec![s],
        _ => vec![],
      };

      Ok(printers)
    }

    #[cfg(not(target_os = "windows"))]
    {
      use std::process::Command;

      let output = Command::new("lpstat")
        .arg("-p")
        .output()
        .or_else(|_| Command::new("lpinfo").arg("-v").output())
        .map_err(|e| format!("Failed to get printers: {}", e))?;

      if !output.status.success() {
        return Ok(vec![]);
      }

      let stdout = String::from_utf8(output.stdout)
        .map_err(|e| format!("Invalid UTF-8: {}", e))?;

      let printers: Vec<String> = stdout
        .lines()
        .filter_map(|line| line.split_whitespace().last().map(|s| s.to_string()))
        .collect();

      Ok(printers)
    }
  })
  .await
  .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn print_file(path: String, printer_name: Option<String>) -> Result<(), String> {
  async_runtime::spawn_blocking(move || {
    if !std::path::Path::new(&path).exists() {
      return Err(format!("File does not exist: {}", path));
    }

    if !path.to_lowercase().ends_with(".pdf") {
      return Err("Only PDF files are supported.".into());
    }

    #[cfg(target_os = "windows")]
    {
      use std::process::Command;
      use std::os::windows::process::CommandExt;
      use windows::{
        core::{w, PCWSTR},
        Win32::Foundation::*,
        Win32::System::Com::*,
        Win32::UI::Shell::*,
      };

      const CREATE_NO_WINDOW: u32 = 0x08000000;

      unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
      }

      let path_wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();

      if printer_name.is_none() {
        unsafe {
          let result = ShellExecuteW(
            None,
            w!("print"),
            PCWSTR(path_wide.as_ptr()),
            None,
            None,
            SW_SHOWNORMAL,
          );

          if result.0 > 32 {
            return Ok(());
          }
        }

        let escaped = path.replace("'", "''");
        let ps = Command::new("powershell")
          .creation_flags(CREATE_NO_WINDOW)
          .args(&[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!("Start-Process -FilePath '{}' -Verb Print", escaped),
          ])
          .spawn();

        return ps
          .map(|_| ())
          .map_err(|e| format!("Failed to open print dialog: {}", e));
      }

      let printer = printer_name.unwrap();
      let escaped_path = path.replace("'", "''");
      let escaped_printer = printer.replace("'", "''");

      let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(&[
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          &format!(
            "Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '{}' -PassThru | Wait-Process",
            escaped_path, escaped_printer
          ),
        ])
        .output()
        .map_err(|e| format!("PowerShell failed: {}", e))?;

      if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
      }

      Ok(())
    }

    #[cfg(target_os = "macos")]
    {
      use std::process::Command;

      if printer_name.is_none() {
        let script = format!(
          r#"
          tell application "Preview"
            open POSIX file "{}"
            activate
          end tell
          tell application "System Events"
            keystroke "p" using command down
          end tell
          "#,
          path.replace('"', "\\\"")
        );

        let output = Command::new("osascript")
          .args(&["-e", &script])
          .output()
          .map_err(|e| format!("AppleScript failed: {}", e))?;

        if !output.status.success() {
          return Err(
            "macOS requires Accessibility permission to show the print dialog.
Enable it in:
System Settings → Privacy & Security → Accessibility"
              .into(),
          );
        }

        return Ok(());
      }

      let printer = printer_name.unwrap();
      let output = Command::new("lp")
        .args(&["-d", &printer, &path])
        .output()
        .map_err(|e| format!("lp failed: {}", e))?;

      if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
      }

      Ok(())
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
      use std::process::Command;

      let mut cmd = Command::new("lp");
      if let Some(printer) = printer_name {
        cmd.args(&["-d", &printer]);
      }
      cmd.arg(&path);

      let output = cmd.output().map_err(|e| e.to_string())?;

      if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
      }

      Ok(())
    }
  })
  .await
  .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![get_printers, print_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
