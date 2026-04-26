@echo off
setlocal
echo ============================================
echo Starting GenAI Testing System
echo ============================================

echo.
echo [1/2] Starting Backend Server (Port 5000)...
start "Backend Server" cmd /k "cd server && npm run dev"

echo.
echo [2/2] Starting Frontend Dev Server...
start "Frontend Dev" cmd /k "npm run dev"

echo.
echo ============================================
echo Both servers are starting!
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:5000
echo ============================================
pause
