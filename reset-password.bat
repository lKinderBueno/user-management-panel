@echo off
setlocal
cd /d "%~dp0"

:: 1. Check if playlistlabs-server container is running
docker ps --format "{{.Names}}" 2>nul | findstr /i "^playlistlabs-server$" >nul
if %errorlevel% equ 0 (
    echo [INFO] Running reset_password inside playlistlabs-server container...
    docker exec -it playlistlabs-server reset_password %*
    goto end
)

:: 2. Check if playlistlabs-dashboard container is running
docker ps --format "{{.Names}}" 2>nul | findstr /i "^playlistlabs-dashboard$" >nul
if %errorlevel% equ 0 (
    echo [INFO] Running reset_password inside playlistlabs-dashboard container...
    docker exec -it playlistlabs-dashboard reset_password %*
    goto end
)

:: 3. Check if local Go is available
where go >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Running via local Go environment...
    go run ./cmd/reset_password %*
    goto end
)

echo [ERROR] Neither Docker container nor Go compiler was found.
:end
if "%~1"=="" pause
