# Viec can quyen quan tri cua Xuong phim tren Windows - tools/autostart.mjs goi qua UAC (Start-Process -Verb RunAs).
#   boot-on  : tac vu Task Scheduler "Xuong phim" chay xuong khi BAT MAY, chua can dang nhap Windows
#              (chay bang tai khoan cua nguoi dung, kieu S4U = khong luu mat khau; chi dung tai nguyen tren may nay)
#              hanh dong = node.exe tools\boot.mjs <thu muc cau hinh> (khong qua cmd.exe de dung/chay lai dung tien trinh)
#   boot-off : go tac vu
#   fw-on    : mo tuong lua cho node.exe, cong $Port, CHI tu dai Tailscale 100.64.0.0/10 (truy cap tu xa)
#   fw-off   : xoa quy tac tuong lua
# Loi ghi vao $Log de tien trinh goi (khong co quyen quan tri) doc lai.
param(
  [Parameter(Mandatory = $true)][ValidateSet('boot-on', 'boot-off', 'fw-on', 'fw-off')][string]$Action,
  [string]$User = '',
  [string]$Node = '',
  [string]$Script = '',
  [string]$Conf = '',
  [string]$Root = '',
  [int]$Port = 4710,
  [string]$Log = ''
)
$ErrorActionPreference = 'Stop'
$Task = 'Xuong phim'
$Rule = 'Xuong phim (Tailscale)'
# dung tac vu dang chay + tat may chu nen con sot (tien trinh S4U: tai khoan thuong khong tat duoc)
function Stop-Boot {
  Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.SessionId -eq 0 -and $_.CommandLine -match 'tools[\\/](boot|web[\\/]server)\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
try {
  switch ($Action) {
    'boot-on' {
      if (-not $User -or -not $Node -or -not $Script -or -not $Conf -or -not $Root) { throw 'Thieu -User / -Node / -Script / -Conf / -Root' }
      Stop-Boot
      $a = New-ScheduledTaskAction -Execute $Node -Argument ('"' + $Script + '" "' + $Conf + '"') -WorkingDirectory $Root
      $t = New-ScheduledTaskTrigger -AtStartup
      $t.Delay = 'PT20S'
      $p = New-ScheduledTaskPrincipal -UserId $User -LogonType S4U -RunLevel Limited
      $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
      Register-ScheduledTask -TaskName $Task -Action $a -Trigger $t -Principal $p -Settings $s -Description 'Xuong phim: mo may chu http://localhost:4710 khi bat may (tao boi tools/autostart.mjs)' -Force | Out-Null
    }
    'boot-off' { Stop-Boot; Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction SilentlyContinue }
    'fw-on' {
      if (-not $Node) { throw 'Thieu -Node' }
      Get-NetFirewallRule -DisplayName $Rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
      New-NetFirewallRule -DisplayName $Rule -Description 'Xuong phim: truy cap tu xa qua Tailscale' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -RemoteAddress '100.64.0.0/10' -Program $Node -Profile Any | Out-Null
    }
    'fw-off' { Get-NetFirewallRule -DisplayName $Rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule }
  }
  if ($Log) { 'ok' | Set-Content -Path $Log -Encoding UTF8 }
  exit 0
} catch {
  if ($Log) { ($_ | Out-String) | Set-Content -Path $Log -Encoding UTF8 }
  exit 1
}
