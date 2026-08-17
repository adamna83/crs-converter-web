@echo off
title CRS Converter - Stopping
echo Stopping CRS Converter servers...

REM --- Kill uvicorn (port 8000) ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

REM --- Kill node (port 5173, i.e. vite dev) ---
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)

echo Done.
timeout /t 2 /nobreak
