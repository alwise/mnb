#[tauri::command]
async fn get_printers() -> Result<Vec<String>, String> {
  #[cfg(target_os = "windows")]
  {
    use std::process::Command;
    use std::os::windows::process::CommandExt;

    // CREATE_NO_WINDOW flag to prevent showing a console window
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    // Use PowerShell to get list of printers without showing a window
    let output = Command::new("powershell")
      .creation_flags(CREATE_NO_WINDOW)
      .args(&[
        "-Command",
        "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"
      ])
      .output()
      .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    if !output.status.success() {
      return Err("Failed to get printers".to_string());
    }
    
    let stdout = String::from_utf8(output.stdout)
      .map_err(|e| format!("Invalid UTF-8: {}", e))?;
    
    // Parse JSON array
    let printers: Vec<String> = serde_json::from_str(&stdout)
      .unwrap_or_else(|_| {
        // If JSON parsing fails, try to parse line by line
        stdout
          .lines()
          .filter_map(|line| {
            let line = line.trim().trim_matches('"');
            if !line.is_empty() {
              Some(line.to_string())
            } else {
              None
            }
          })
          .collect()
      });
    
    Ok(printers)
  }
  
  #[cfg(not(target_os = "windows"))]
  {
    use std::process::Command;
    
    // For macOS/Linux, use lpstat or lpinfo
    let output = Command::new("lpstat")
      .arg("-p")
      .output()
      .or_else(|_| {
        Command::new("lpinfo")
          .arg("-v")
          .output()
      })
      .map_err(|e| format!("Failed to get printers: {}", e))?;
    
    if !output.status.success() {
      return Ok(vec![]); // Return empty list if no printers found
    }
    
    let stdout = String::from_utf8(output.stdout)
      .map_err(|e| format!("Invalid UTF-8: {}", e))?;
    
    let printers: Vec<String> = stdout
      .lines()
      .filter_map(|line| {
        // Extract printer name from lpstat output
        if line.starts_with("printer ") {
          line.split_whitespace().nth(1).map(|s| s.to_string())
        } else {
          None
        }
      })
      .collect();
    
    Ok(printers)
  }
}

#[tauri::command]
async fn print_file(path: String, printer_name: Option<String>) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    use std::process::Command;
    use std::os::windows::process::CommandExt;

    // CREATE_NO_WINDOW flag to prevent showing a console window
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    // If no printer specified, show Windows print dialog
    // Otherwise, print directly to the specified printer
    if printer_name.is_none() {
      // Verify file exists first
      if !std::path::Path::new(&path).exists() {
        return Err(format!("PDF file does not exist: {}", path));
      }
      
      // Try Windows Shell API first (most reliable)
      use windows::{
        core::*,
        Win32::Foundation::*,
        Win32::System::Com::*,
        Win32::UI::Shell::*,
      };
      
      unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
        let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
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
        // If ShellExecuteW failed, continue to PowerShell fallback
        // Log the error code for debugging
        eprintln!("ShellExecuteW failed with error code: {}", result.0);
      }
      
      // Fallback: Use PowerShell Start-Process with Print verb
      // Escape single quotes for PowerShell
      let escaped_path = path.replace("'", "''");
      
      let ps_result = Command::new("powershell")
        .args(&[
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          &format!("Start-Process -FilePath '{}' -Verb Print", escaped_path)
        ])
        .spawn();
      
      match ps_result {
        Ok(_) => Ok(()),
        Err(e) => {
          // Last resort: Try opening the file normally (user can print manually)
          unsafe {
            let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
            let result = ShellExecuteW(
              None,
              None,
              PCWSTR(path_wide.as_ptr()),
              None,
              None,
              SW_SHOWNORMAL,
            );
            
            if result.0 > 32 {
              // File opened successfully, but print dialog didn't show
              // Return error so user knows to print manually
              Err(format!("PDF opened in viewer. Please use Ctrl+P or the print button in the PDF viewer to print. PowerShell error: {}", e))
            } else {
              // Get error description based on error code
              let error_desc = match result.0 {
                0 => "Out of memory or resources",
                2 => "File not found",
                3 => "Path not found",
                5 => "Access denied",
                8 => "Out of memory",
                11 => "Invalid .exe file",
                26 => "Sharing violation",
                27 => "File association incomplete or invalid",
                28 => "DDE transaction timed out",
                29 => "DDE transaction failed",
                30 => "DDE transaction busy",
                31 => "No file association",
                32 => "DLL not found",
                _ => "Unknown error"
              };
              
              Err(format!("Failed to open print dialog. PowerShell error: {}. ShellExecute error ({}): {}. File path: {}", e, result.0, error_desc, path))
            }
          }
        }
      }
    } else {
      let printer = printer_name.unwrap();
      
      // Print directly to specified printer
      let output = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(&[
          "-Command",
          &format!("Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '{}' -PassThru | Wait-Process", path, printer)
        ])
        .output();
      
      let output = output.map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
      
      if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to print: {}", stderr));
      }
      
      Ok(())
    }
  }
  
  #[cfg(not(target_os = "windows"))]
  {
    use std::process::Command;
    
    // Verify file exists first
    if !std::path::Path::new(&path).exists() {
      return Err(format!("PDF file does not exist: {}", path));
    }
    
    // If no printer specified, show print dialog
    if printer_name.is_none() {
      // On macOS, use AppleScript to open PDF and show print dialog
      #[cfg(target_os = "macos")]
      {
        // Use AppleScript to open PDF in Preview and trigger print dialog
        let script = format!(
          "tell application \"Preview\"\n\
           open POSIX file \"{}\"\n\
           activate\n\
           delay 0.5\n\
           end tell\n\
           tell application \"System Events\"\n\
           tell process \"Preview\"\n\
           keystroke \"p\" using command down\n\
           end tell\n\
           end tell",
          path.replace("\"", "\\\"")
        );
        
        let output = Command::new("osascript")
          .args(&["-e", &script])
          .output()
          .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;
        
        if output.status.success() {
          Ok(())
        } else {
          // Fallback: Just open the file
          let open_result = Command::new("open")
            .arg(&path)
            .spawn();
          
          match open_result {
            Ok(_) => {
              // Try AppleScript again after a delay
              std::thread::sleep(std::time::Duration::from_millis(1500));
              let retry_script = "tell application \"System Events\"\n\
                                  keystroke \"p\" using command down\n\
                                  end tell";
              let _ = Command::new("osascript")
                .args(&["-e", retry_script])
                .output();
              
              Err("PDF opened. If print dialog didn't appear, please use Cmd+P.".to_string())
            },
            Err(e) => {
              let stderr = String::from_utf8_lossy(&output.stderr);
              Err(format!("Failed to open print dialog. AppleScript error: {}. Open error: {}. Please open the PDF manually and use Cmd+P.", stderr, e))
            }
          }
        }
      }
      
      // On Linux, try to use lp with default printer or show error
      #[cfg(not(target_os = "macos"))]
      {
        // Try lp without printer (uses default)
        let output = Command::new("lp")
          .arg(&path)
          .output()
          .map_err(|e| format!("Failed to execute lp: {}", e))?;
        
        if !output.status.success() {
          let stderr = String::from_utf8_lossy(&output.stderr);
          return Err(format!("Failed to print. Please specify a printer or use 'lpstat -p' to see available printers. Error: {}", stderr));
        }
        
        return Ok(());
      }
    } else {
      // Print directly to specified printer
      let printer = printer_name.unwrap();
      let output = Command::new("lp")
        .args(&["-d", &printer, &path])
        .output()
        .map_err(|e| format!("Failed to execute lp: {}", e))?;
      
      if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to print: {}", stderr));
      }
      
      Ok(())
    }
  }
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
