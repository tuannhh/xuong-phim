@echo off
rem Mở Xưởng phim bằng Docker Desktop trên Windows (bấm đúp). Chạy thẳng trên Windows: dùng WSL2 Ubuntu rồi chạy  bash start.sh
chcp 65001 >nul
cd /d "%~dp0"
where docker >nul 2>nul || (echo Chua co Docker Desktop - cai tai https://www.docker.com/products/docker-desktop/ & pause & exit /b 1)
docker info >nul 2>nul || (echo Docker Desktop chua mo - mo ung dung Docker roi chay lai. & pause & exit /b 1)
if not exist .env (
  copy .env.example .env >nul
  echo Da tao file .env - sua XUONG_OUTPUT_DIR va TU_LIEU_DIR thanh thu muc tren may Windows, vd C:/Users/ten/Videos/Xuong phim
  notepad .env
)
docker compose up -d --build || (pause & exit /b 1)
start "" http://localhost:4710
echo Xuong phim dang chay o http://localhost:4710 - dung: docker compose stop
pause
