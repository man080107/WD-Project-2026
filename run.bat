@echo off
title Planet Playground Server
echo ===================================================
echo   Planet Playground - Startup Script
echo ===================================================
echo.

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo Installing dependencies (if needed)...
call npm install --no-audit --no-fund

echo.
echo Starting the server...
echo Once the server is running, your browser will open automatically.
echo (Press Ctrl+C to stop the server at any time)
echo.

:: Wait briefly then open the browser
start "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"

:: Start the application
node server.js

pause
