@echo off
title CRS Converter - Launcher
echo ============================================
echo   CRS Converter Web App - Starting
echo ============================================
echo.

REM --- 1. Python virtual environment ---
if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [error] Could not create venv. Is Python 3.10+ installed and on PATH?
        pause
        exit /b 1
    )
    echo [setup] Installing backend dependencies...
    call .venv\Scripts\pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo [error] Failed to install backend dependencies.
        pause
        exit /b 1
    )
    echo.
)

REM --- 2. Node.js check ---
where node >nul 2>&1
if errorlevel 1 (
    echo [error] Node.js is not installed or not on PATH.
    echo         Download from https://nodejs.org/ (LTS recommended^)
    pause
    exit /b 1
)

REM --- 3. Frontend node_modules ---
if not exist "frontend\node_modules" (
    echo [setup] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
    if errorlevel 1 (
        echo [error] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

REM --- 4. Check if ports are already in use ---
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [warn] Port 8000 already in use - backend may already be running.
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [warn] Port 5173 already in use - frontend may already be running.
)

REM --- 5. Start backend in a new window ---
echo [start] Backend  - http://localhost:8000
start "CRS Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\python.exe -m uvicorn backend.main:app --port 8000"

REM --- 6. Wait a moment for backend to initialise ---
timeout /t 3 /nobreak >nul

REM --- 7. Start frontend in a new window ---
echo [start] Frontend - http://localhost:5173
start "CRS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo   Servers starting in two new windows.
echo   Open http://localhost:5173 in your browser.
echo   Close the server windows to stop.
echo ============================================
echo.
timeout /t 6 /nobreak
