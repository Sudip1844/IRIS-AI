@echo off
echo ==========================================
echo IRIS-AI (MJ Assistant) Build & Fix Utility
echo ==========================================
echo.

echo [1/3] Killing stuck processes...
taskkill /F /IM "IRIS-AI.exe" >nul 2>&1
taskkill /F /IM "electron.exe" >nul 2>&1

echo.
echo [2/3] Installing/Updating dependencies...
call npm install

echo.
echo [3/3] Building the Windows Executable (.exe)...
call npm run build:win

echo.
echo ==========================================
echo Build Complete! 
echo Check the 'dist' folder for the new .exe file.
echo Please reinstall the application using the new .exe so that the desktop shortcut works properly.
echo ==========================================
pause
