@echo off
setlocal
cd /d "%~dp0"

:: Prefer PowerShell Core (pwsh) if installed, fallback to Windows PowerShell
where pwsh >nul 2>nul
if %errorlevel% equ 0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
    goto finish
)

where powershell >nul 2>nul
if %errorlevel% equ 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
    goto finish
)

echo [ERROR] Neither PowerShell Core (pwsh) nor Windows PowerShell (powershell) could be found.
exit /b 1

:finish
if "%~1"=="" if not defined CI (
    echo.
    echo Press any key to exit...
    pause >nul
)
