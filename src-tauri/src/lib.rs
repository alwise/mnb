#[tauri::command]
async fn get_printers() -> Result<Vec<String>, String> {
  #[cfg(target_os = "windows")]
  {
    use std::process::Command;
    
    // Use PowerShell to get list of printers
    let output = Command::new("powershell")
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
    
    let printer = printer_name.unwrap_or_else(|| "default".to_string());
    
    // Use PowerShell to print the PDF
    let output = if printer == "default" {
      Command::new("powershell")
        .args(&[
          "-Command",
          &format!("Start-Process -FilePath '{}' -Verb Print -PassThru | Wait-Process", path)
        ])
        .output()
    } else {
      Command::new("powershell")
        .args(&[
          "-Command",
          &format!("Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '{}' -PassThru | Wait-Process", path, printer)
        ])
        .output()
    };
    
    let output = output.map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      return Err(format!("Failed to print: {}", stderr));
    }
    
    Ok(())
  }
  
  #[cfg(not(target_os = "windows"))]
  {
    use std::process::Command;
    
    let mut cmd = Command::new("lp");
    
    if let Some(printer) = printer_name {
      cmd.args(&["-d", &printer]);
    }
    
    let output = cmd
      .arg(&path)
      .output()
      .map_err(|e| format!("Failed to print: {}", e))?;
    
    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr);
      return Err(format!("Failed to print: {}", stderr));
    }
    
    Ok(())
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
