@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
set RC=%ERRORLEVEL%
echo %cmdcmdline% | find /i "/c" >nul && pause
exit /b %RC%
