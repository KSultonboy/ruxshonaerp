$stdout = "D:\ONGOINGPROJECTS\RuxshonaTort\ruxshona-erp-ui\.codex-desktop-dev.out.log"
$stderr = "D:\ONGOINGPROJECTS\RuxshonaTort\ruxshona-erp-ui\.codex-desktop-dev.err.log"
if (Test-Path $stdout) { Remove-Item $stdout -Force }
if (Test-Path $stderr) { Remove-Item $stderr -Force }
$p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run desktop:dev" -WorkingDirectory "D:\ONGOINGPROJECTS\RuxshonaTort\ruxshona-erp-ui" -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Start-Sleep -Seconds 30
$children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $p.Id } | Select-Object -ExpandProperty ProcessId
Write-Output "PID=$($p.Id) HAS_EXITED=$($p.HasExited) CHILDREN=$($children -join ',')"
Write-Output "---STDOUT---"
if (Test-Path $stdout) { Get-Content $stdout }
Write-Output "---STDERR---"
if (Test-Path $stderr) { Get-Content $stderr }
if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
foreach ($child in $children) { Stop-Process -Id $child -Force -ErrorAction SilentlyContinue }
