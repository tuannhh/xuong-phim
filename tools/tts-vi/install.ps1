# Cài giọng đọc tts-vi trên Windows (tương đương install.sh):
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\tts-vi\install.ps1
# Việc làm: tải VieNeu-TTS (bản ghim) -> `uv sync` -> tạo config.env từ mẫu (nếu chưa có) -> tạo tts-vi.cmd để gõ tay (không bắt buộc:
# xưởng tự tìm python của VieNeu theo VIENEU_DIR trong config.env).
# Biến: VIENEU_DIR (mặc định: thư mục VieNeu-TTS nằm cạnh thư mục xưởng), VIENEU_REF (mặc định 6566468 = release 3.8.5).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT = Split-Path -Parent (Split-Path -Parent $HERE)
$dir = if ($env:VIENEU_DIR) { $env:VIENEU_DIR } else { Join-Path (Split-Path -Parent $ROOT) 'VieNeu-TTS' }
# đã có config.env (cài từ trước) -> dùng lại đúng thư mục VieNeu trong đó, không tải bản thứ hai
if (-not $env:VIENEU_DIR -and (Test-Path (Join-Path $HERE 'config.env'))) {
  $m = Select-String -Path (Join-Path $HERE 'config.env') -Pattern '^VIENEU_DIR=(.+)$' | Select-Object -First 1
  if ($m) { $d = $m.Matches[0].Groups[1].Value.Trim(); if ($d -and (Test-Path $d)) { $dir = $d } }
}
$ref = if ($env:VIENEU_REF) { $env:VIENEU_REF } else { '6566468' }

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Thiếu uv — cài: winget install astral-sh.uv' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Thiếu git' }

if (-not (Test-Path (Join-Path $dir '.git'))) {
  Write-Host "-> Tải VieNeu-TTS vào $dir"
  & git clone https://github.com/pnnbao97/VieNeu-TTS.git $dir
  if ($LASTEXITCODE -ne 0) { throw 'git clone lỗi' }
}
& git -C $dir fetch -q origin
& git -C $dir checkout -q $ref
if ($LASTEXITCODE -ne 0) { throw "Không checkout được $ref" }
Write-Host '-> Cài môi trường Python của VieNeu (uv sync)'
Push-Location $dir
try { & uv sync; if ($LASTEXITCODE -ne 0) { throw 'uv sync lỗi' } } finally { Pop-Location }

$cfg = Join-Path $HERE 'config.env'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path $cfg)) {
  $text = [IO.File]::ReadAllText((Join-Path $HERE 'config.example.env'), $utf8)
  $text = $text -replace '(?m)^VIENEU_DIR=.*', ('VIENEU_DIR=' + ($dir -replace '\\', '/'))
  [IO.File]::WriteAllText($cfg, $text, $utf8)
  Write-Host "-> Tạo $cfg (chưa có khoá Gemini - chỉ dùng VieNeu)"
}

$py = Join-Path $dir '.venv\Scripts\python.exe'
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Force $bin | Out-Null
[IO.File]::WriteAllText((Join-Path $bin 'tts-vi.cmd'), "@echo off`r`n`"$py`" -X utf8 -I `"$HERE\tts_vi.py`" %*`r`n", [System.Text.Encoding]::ASCII)
Write-Host "-> Lệnh gõ tay: $bin\tts-vi.cmd  (thêm thư mục này vào PATH nếu muốn gọi 'tts-vi' ở mọi nơi)"

Write-Host '-> Thử: lần đầu VieNeu tải model từ Hugging Face (vài trăm MB)'
$voices = & $py -X utf8 -I (Join-Path $HERE 'tts_vi.py') --voices
if ($LASTEXITCODE -ne 0) { throw 'tts-vi chạy lỗi' }
$voices | Select-Object -First 5
Write-Host 'Xong.'
