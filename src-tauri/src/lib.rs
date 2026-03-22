#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
fn run_powershell(script: &str) -> Result<String, String> {
  let output = Command::new("powershell")
    .args([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
    .map_err(|error| error.to_string())?;

  if output.status.success() {
    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  let message = if stderr.is_empty() { stdout } else { stderr };
  Err(message)
}

#[cfg(target_os = "windows")]
fn run_powershell_with_env(script: &str, envs: &[(&str, &str)]) -> Result<String, String> {
  let mut command = Command::new("powershell");
  command
    .args([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ])
    .creation_flags(CREATE_NO_WINDOW);

  for (key, value) in envs {
    command.env(key, value);
  }

  let output = command.output().map_err(|error| error.to_string())?;

  if output.status.success() {
    return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  let message = if stderr.is_empty() { stdout } else { stderr };
  Err(message)
}

#[tauri::command]
fn list_printers() -> Result<Vec<String>, String> {
  #[cfg(target_os = "windows")]
  {
    let output = run_powershell("(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)")?;
    let printers = output
      .lines()
      .map(str::trim)
      .filter(|line| !line.is_empty())
      .map(ToString::to_string)
      .collect::<Vec<String>>();

    return Ok(printers);
  }

  #[cfg(not(target_os = "windows"))]
  {
    Err("Unsupported platform".to_string())
  }
}

#[tauri::command(rename_all = "snake_case")]
fn print_receipt_text(receipt_text: String, printer_name: Option<String>) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    let script = r#"
$printer = $env:RUX_PRINTER_NAME
if ([string]::IsNullOrWhiteSpace($printer)) {
  $printer = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name -First 1)
}
if ([string]::IsNullOrWhiteSpace($printer)) {
  throw "No default printer found"
}

$text = $env:RUX_RECEIPT_TEXT
if ([string]::IsNullOrWhiteSpace($text)) {
  throw "Receipt text is empty"
}

$text = $text -replace "`r?`n", "`r`n"
$text | Out-Printer -Name $printer
"#;

    let selected_printer = printer_name.unwrap_or_default();
    run_powershell_with_env(
      script,
      &[
        ("RUX_RECEIPT_TEXT", receipt_text.as_str()),
        ("RUX_PRINTER_NAME", selected_printer.as_str()),
      ],
    )?;
    return Ok(());
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = (receipt_text, printer_name);
    Err("Unsupported platform".to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // IMPORTANT: plugins should be attached to Builder, not app.handle()
  let mut builder =
    tauri::Builder::default().invoke_handler(tauri::generate_handler![list_printers, print_receipt_text]);

  // Optional: updater plugin (desktop only)
  #[cfg(all(desktop, not(debug_assertions)))]
  {
    builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
  }

  // Optional: log plugin (debug only)
  #[cfg(debug_assertions)]
  {
    builder = builder.plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    );
  }

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
