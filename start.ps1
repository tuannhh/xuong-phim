# Mở Xưởng phim trên Windows — chọn cách chạy một lần, lần sau tự nhớ:
#   start.cmd                 chạy theo cách đã chọn (lần đầu sẽ hỏi)
#   start.cmd --chon          chọn lại
#   start.cmd thang           chạy thẳng trên máy (nhanh hơn — khuyên dùng)
#   start.cmd docker          chạy trong Docker Desktop (không phải cài từng phần mềm, nhưng chậm hơn)
# Lựa chọn lưu ở .xuong-mode (ngoài git).
$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$port = if ($env:PORT) { $env:PORT } else { '4710' }
$url = "http://localhost:$port"
$modeFile = Join-Path $ROOT '.xuong-mode'
function Say($m) { Write-Host ""; Write-Host "> $m" -ForegroundColor Yellow }
function Job-Status {
  try { (Invoke-RestMethod "$url/api/job" -TimeoutSec 2).status } catch { $null }
}
function Server-Up { try { $null = Invoke-RestMethod "$url/api/job" -TimeoutSec 2; $true } catch { $false } }

$mode = if ($args.Count -gt 0) { [string]$args[0] } else { '' }
if ($mode -eq '--chon') { Remove-Item $modeFile -Force -ErrorAction SilentlyContinue; $mode = '' }
if (-not $mode -and (Test-Path $modeFile)) { $mode = (Get-Content $modeFile -Raw).Trim() }
if (-not $mode) {
  Write-Host @'

Xưởng phim — chọn cách chạy:
  1) Chạy thẳng trên máy  (khuyên dùng — nhanh hơn Docker)
                          lần đầu tự cài phần mềm còn thiếu (setup.cmd), mất 10–20 phút
  2) Chạy trong Docker    (chỉ cần Docker Desktop; chậm hơn)
'@
  $ans = Read-Host 'Chọn 1 hoặc 2 [1]'
  $mode = if ($ans -eq '2') { 'docker' } else { 'thang' }
  Set-Content $modeFile $mode -Encoding ascii
  Write-Host 'Đã nhớ lựa chọn. Đổi lại: start.cmd --chon'
}

# Cổng đang bận: nếu là Xưởng phim đang dựng dở thì không được dừng (mất việc đang chạy)
if (Server-Up) {
  $st = Job-Status
  if ($st -eq 'running' -or $st -eq 'stopping') { Write-Host "Xưởng phim đang chạy một việc (dựng phim / viết kịch bản) ở $url — chờ xong rồi chạy lại lệnh này." }
  else { Write-Host "Xưởng phim đang mở sẵn ở $url." }
  Start-Process $url
  exit 0
}

if ($mode -eq 'docker') {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Chưa có Docker — cài Docker Desktop (https://www.docker.com/products/docker-desktop/) rồi chạy lại, hoặc: start.cmd thang' }
  & docker info | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop chưa mở — mở ứng dụng Docker rồi chạy lại.' }
  if (-not (Test-Path (Join-Path $ROOT '.env'))) {
    $videos = (Join-Path $env:USERPROFILE 'Videos\Xưởng phim') -replace '\\', '/'
    $docs = (Join-Path $env:USERPROFILE 'Documents') -replace '\\', '/'
    $env_ = (Get-Content (Join-Path $ROOT '.env.example') -Raw -Encoding UTF8) -replace '(?m)^XUONG_OUTPUT_DIR=.*', "XUONG_OUTPUT_DIR=$videos" -replace '(?m)^TU_LIEU_DIR=.*', "TU_LIEU_DIR=$docs"
    [IO.File]::WriteAllText((Join-Path $ROOT '.env'), $env_, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host 'Đã tạo file .env. Muốn dùng các nút AI trong Docker: chạy  claude setup-token  rồi dán mã vào dòng CLAUDE_CODE_OAUTH_TOKEN trong .env.'
  }
  Say 'Dựng và mở Xưởng phim trong Docker (lần đầu tải vài GB)'
  & docker compose up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'docker compose lỗi' }
  Write-Host "Mở $url — dừng: docker compose stop"
  Start-Process $url
  exit 0
}

# chạy thẳng
$running = @(); if (Get-Command docker -ErrorAction SilentlyContinue) { $ErrorActionPreference = 'Continue'; $running = @(& docker ps --format '{{.Names}}' 2>$null); $ErrorActionPreference = 'Stop' }
if ($running -contains 'xuong-phim') {
  Say 'Dừng bản Docker đang chạy (máy này chuyển sang chạy thẳng)'
  & docker compose stop
}
& node tools/doctor.mjs | Out-Null
if ($LASTEXITCODE -ne 0) {
  Say 'Máy chưa cài đủ — chạy setup (lần đầu 10–20 phút)'
  & (Join-Path $ROOT 'setup.ps1')
}
Say "Mở Xưởng phim: $url  (dừng: Ctrl+C)"
Start-Job { Start-Sleep 3; Start-Process $using:url } | Out-Null
& node tools/web/server.mjs
