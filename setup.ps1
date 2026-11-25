# Cài Xưởng phim trên Windows 10/11 (chạy thẳng trên máy, không cần WSL/Docker) — chạy lại bao nhiêu lần cũng được:
#   setup.cmd                                                   (bấm đúp được)
#   powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
# Cài (bằng winget, nếu thiếu): Git, Node >= 20, uv, ffmpeg -> pnpm -> thư viện Node/Python -> font, kho SFX, Chrome headless cho Remotion
#      -> giọng đọc VieNeu (tools\tts-vi\install.ps1) -> skill /series -> Claude Code CLI (cho nút AI trên trang web).
# Biến tuỳ chọn: XUONG_SKIP_TTS=1 (bỏ giọng đọc), XUONG_SKIP_SKILL=1, XUONG_SKIP_CLAUDE=1, XUONG_SKIP_THU=1 (không dựng thử tập mẫu).
$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = '1'

function Say($m) { Write-Host ""; Write-Host "> $m" -ForegroundColor Yellow }
function Ok($m) { Write-Host "  OK  $m" -ForegroundColor Green }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Update-SessionPath {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
# chạy lệnh ngoài, dừng nếu mã thoát khác 0
function Run {
  $exe = $args[0]; $rest = @(); if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
  & $exe @rest
  if ($LASTEXITCODE -ne 0) { throw "Lệnh lỗi (mã $LASTEXITCODE): $exe $($rest -join ' ')" }
}
function Winget-Install($id, $name) {
  if (-not (Has 'winget')) { throw "Thiếu $name và máy chưa có winget — cài $name thủ công rồi chạy lại setup.cmd (winget có sẵn trong Windows 10 21H1+/11 qua 'App Installer' của Microsoft Store)." }
  Write-Host "  Cài $name (winget)..."
  & winget install -e --id $id --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { Write-Host "  ! winget báo mã $LASTEXITCODE khi cài $name (có thể đã có sẵn) — kiểm tra lại bên dưới." -ForegroundColor DarkYellow }
  Update-SessionPath
}
function Node-Major { if (Has 'node') { [int](((& node -v) -replace '^v(\d+).*', '$1')) } else { 0 } }

Say "Phần mềm hệ thống (Windows $([Environment]::OSVersion.Version))"
if (-not (Has 'git')) { Winget-Install 'Git.Git' 'Git' }
if ((Node-Major) -lt 20) { Winget-Install 'OpenJS.NodeJS.LTS' 'Node.js (>= 20)' }
if (-not (Has 'uv')) { Winget-Install 'astral-sh.uv' 'uv' }
if (-not (Has 'ffmpeg')) { Winget-Install 'Gyan.FFmpeg' 'ffmpeg' }
if (-not (Has 'pnpm')) {
  Write-Host "  Cài pnpm 9.15.9 (npm)..."
  Run npm install -g pnpm@9.15.9
  Update-SessionPath
}
foreach ($t in 'git', 'node', 'pnpm', 'uv', 'ffmpeg') {
  if (-not (Has $t)) { throw "Vẫn thiếu '$t' trong PATH — mở cửa sổ PowerShell MỚI rồi chạy lại setup.cmd (PATH chỉ cập nhật cho cửa sổ mới)." }
}
Ok "git $((& git --version) -replace 'git version ','') · node $(& node -v) · pnpm $(& pnpm -v) · $(& uv --version) · ffmpeg $((& ffmpeg -version | Select-Object -First 1) -split ' ' | Select-Object -Index 2)"

Say "Thư viện Node (pnpm install)"
Run pnpm install --frozen-lockfile
Say "Font tiếng Việt"
Run node tools/sync-fonts.mjs
Say "Môi trường Python cho âm thanh (uv sync) + kho SFX"
Run uv sync
if (Get-ChildItem (Join-Path $ROOT 'assets\sfx\*.wav') -ErrorAction SilentlyContinue) { Ok 'kho SFX đã có' } else { Run uv run tools/audio/sfx_bank.py }

Say "Chrome headless cho Remotion"
Run pnpm exec remotion browser ensure
# Remotion đôi khi giải nén dở (antivirus quét file zip) -> chỉ còn vài file, thiếu chrome-headless-shell.exe: giải nén lại từ file zip đã tải
$chromeDir = Join-Path $ROOT 'node_modules\.remotion\chrome-headless-shell'
if (-not (Get-ChildItem $chromeDir -Recurse -Filter 'chrome-headless-shell.exe' -ErrorAction SilentlyContinue)) {
  $zip = Get-ChildItem $chromeDir -Filter '*.zip' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $zip) { throw 'Remotion chưa tải được Chrome headless — kiểm tra mạng rồi chạy lại.' }
  Write-Host '  Giải nén lại Chrome headless từ file zip đã tải...'
  $dest = Join-Path $chromeDir 'win64'
  Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $zip.FullName -DestinationPath $dest -Force
  if (-not (Get-ChildItem $chromeDir -Recurse -Filter 'chrome-headless-shell.exe' -ErrorAction SilentlyContinue)) {
    throw 'Chrome headless vẫn thiếu sau khi giải nén — phần mềm diệt virus có thể đang xoá chrome-headless-shell.exe: thêm thư mục node_modules\.remotion vào danh sách loại trừ rồi chạy lại.'
  }
}
Ok 'Chrome headless'

if ($env:XUONG_SKIP_TTS -ne '1') {
  Say 'Giọng đọc VieNeu + lệnh tts-vi'
  & (Join-Path $ROOT 'tools\tts-vi\install.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Cài giọng đọc lỗi (xem log ở trên)' }
}

if ($env:XUONG_SKIP_SKILL -ne '1') {
  Say 'Skill /series cho Claude Code'
  $skills = Join-Path $env:USERPROFILE '.claude\skills'
  $dst = Join-Path $skills 'series'
  New-Item -ItemType Directory -Force $skills | Out-Null
  $item = Get-Item $dst -Force -ErrorAction SilentlyContinue
  if ($item -and -not $item.LinkType) {
    Write-Host "  ! $dst là thư mục thật — không ghi đè. Xoá nó rồi chạy lại nếu muốn dùng skill của repo này." -ForegroundColor DarkYellow
  } else {
    $want = Join-Path $ROOT 'skill'
    if ($item -and (@($item.Target) -contains $want)) { Ok "$dst -> $want (đã gắn)" }
    else {
      if ($item) { & cmd /c rmdir "`"$dst`"" }   # gỡ junction/symlink cũ (Remove-Item của PowerShell 5.1 lỗi trên junction)
      New-Item -ItemType Junction -Path $dst -Target $want | Out-Null
      Ok "$dst -> $want"
    }
  }
}

if ($env:XUONG_SKIP_CLAUDE -ne '1') {
  Say 'Claude Code CLI (cho nút AI trên trang web)'
  if (Has 'claude') { Ok "claude $((& claude --version) | Select-Object -First 1)" }
  else { Run npm install -g '@anthropic-ai/claude-code'; Update-SessionPath; Ok 'đã cài claude' }
  Write-Host '  Nhớ đăng nhập một lần: chạy  claude  rồi gõ  /login'
}

Say 'Kiểm tra'
& node tools/doctor.mjs
if ($env:XUONG_SKIP_TTS -ne '1' -and $env:XUONG_SKIP_THU -ne '1') {
  Say 'Dựng thử một tập mẫu ~9 giây (kiểm tra cả dây chuyền + đo tốc độ máy)'
  & node tools/doctor.mjs --thu
}
Write-Host ""
Write-Host 'Xong. Mở trang web: start.cmd  (hoặc: pnpm web)  ->  http://localhost:4710' -ForegroundColor Green
