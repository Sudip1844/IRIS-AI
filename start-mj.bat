@echo off
title MJ Assistant
cd /d "D:\Antigravity\New folder\IRIS-AI"

:: Try npx directly first
where npx >nul 2>&1
if %errorlevel%==0 (
    npx electron .
    exit /b
)

:: If npx not found in PATH, try common Node.js locations
if exist "%APPDATA%\npm\npx.cmd" (
    "%APPDATA%\npm\npx.cmd" electron .
    exit /b
)

if exist "%ProgramFiles%\nodejs\npx.cmd" (
    "%ProgramFiles%\nodejs\npx.cmd" electron .
    exit /b
)

:: Fallback: try to run node_modules directly
if exist "node_modules\.bin\electron.cmd" (
    "node_modules\.bin\electron.cmd" .
    exit /b
)

echo ERROR: Could not find npx or electron. Make sure Node.js is installed.
pause
