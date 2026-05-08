@echo off
:: Self-hiding script logic to prevent CMD window from staying open
if "%~1"=="hidden" goto :begin

set "vbsFile=%temp%\launch_mj.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%vbsFile%"
echo WshShell.CurrentDirectory = "%~dp0" >> "%vbsFile%"
echo WshShell.Run """%~f0"" hidden", 0, False >> "%vbsFile%"
cscript //nologo "%vbsFile%"
exit /b

:begin
cd /d "%~dp0"

:: Gracefully kill any stuck Electron or Node processes spawned from this directory
for /f "tokens=2" %%p in ('wmic process where "name='electron.exe' and executablepath like '%%MJ-AI%%'" get processid ^| findstr /r "[0-9]" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)

:: Run the Vite Dev Server
call npm run dev

