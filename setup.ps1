# ==============================================================================
# PlaylistLabs User Management - Windows Installer & Upgrader Script
#
# Interactive Usage:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#   .\setup.bat
#   irm https://ump.playlistlabs.io/setup.ps1 | iex
#
# Unattended / CLI Arguments Usage:
#   .\setup.ps1 -Port 8080 -Domain panel.example.com -Version latest -Yes
#   .\setup.ps1 -p 8080 -d panel.example.com -y
#   .\setup.bat -p 8080 -d panel.example.com -y
# ==============================================================================

$ErrorActionPreference = "Stop"

$REPO_RAW_URL = "https://ump.playlistlabs.io"
$Check = [char]0x2713

# ------------------------------------------------------------------------------
# Command-Line Arguments & Environment Variables Defaults
# ------------------------------------------------------------------------------
$CLI_PORT = ""
$CLI_HTTPS_PORT = ""
$CLI_NO_HTTPS = 0
$CLI_DOMAIN = ""
$CLI_VERSION = ""
$CLI_DB_PASS = ""
$CLI_DB_ROOT_PASS = ""
$CLI_DIR = ""
$CLI_UNINSTALL = 0
$CLI_KEEP_VOLUMES = 0
$NON_INTERACTIVE = 0

if ($env:NO_HTTPS -and ($env:NO_HTTPS -eq "1" -or $env:NO_HTTPS -eq "true")) {
    $CLI_NO_HTTPS = 1
}
if ($env:NON_INTERACTIVE -and ($env:NON_INTERACTIVE -eq "1" -or $env:NON_INTERACTIVE -eq "true")) {
    $NON_INTERACTIVE = 1
}

function Show-Help {
    Write-Host @"
PlaylistLabs User Management Stack - Windows Installer & Upgrader

Usage:
  .\setup.ps1 [OPTIONS]
  .\setup.bat [OPTIONS]
  irm https://ump.playlistlabs.io/setup.ps1 | iex

Options:
  -p, -Port, --port <port>             HTTP port for the gateway (default: 80)
      -HttpsPort, --https-port <port>  HTTPS port for the gateway (default: 443)
      -NoHttps, --no-https             Disable HTTPS (port 443) binding
  -d, -Domain, --domain <domain>       Primary domain or server IP (default: localhost)
  -v, -Version, --version <tag>        Application version to deploy (default: latest)
      -DbPass, --db-pass <password>    MariaDB user password (default: auto-generated random)
      -DbRootPass, --db-root-pass <pw> MariaDB root password (default: auto-generated random)
      -Dir, --dir <directory>          Installation directory (default: user-management-panel)
  -u, -Uninstall, --uninstall          Complete uninstallation: stop containers, delete volumes, data, secrets & images
      -KeepVolumes, --keep-volumes     When uninstalling, preserve database volumes and secrets
      -Purge, --purge                  Alias to ensure full wipe of volumes and data
  -y, -Yes, --yes, -n, --non-interactive
                                       Run in non-interactive/unattended mode (no prompts)
  -h, -Help, --help                    Display this help message

Environment Variables:
  HTTP_PORT, HTTPS_PORT, NO_HTTPS, DOMAIN, APP_VERSION, DB_PASSWORD, DB_ROOT_PASSWORD, INSTALL_DIR, NON_INTERACTIVE

Examples:
  # Unattended installation with custom port:
  .\setup.ps1 -p 8080 -d panel.example.com -y

  # Using batch launcher:
  .\setup.bat -p 8080 -d panel.example.com -y

  # Complete uninstallation and cleanup (removes containers, database volumes, secrets, and images):
  .\setup.ps1 --uninstall

  # Unattended complete wipe:
  .\setup.ps1 --uninstall -y
"@
}

# ------------------------------------------------------------------------------
# Argument Parsing (Supports Unix-style, GNU double-dash, and PowerShell flags)
# ------------------------------------------------------------------------------
$i = 0
while ($i -lt $args.Count) {
    $arg = "$($args[$i])"
    
    $optName = $arg
    $optVal = $null
    if ($arg -match '^(--[a-zA-Z0-9_-]+)=(.*)$') {
        $optName = $matches[1]
        $optVal = $matches[2]
    }

    switch -Regex ($optName) {
        '^(-p|--port|-port)$' {
            if ($null -ne $optVal) { $CLI_PORT = $optVal }
            else { $CLI_PORT = "$($args[++$i])" }
        }
        '^(--https-port|-https-port|-httpsport)$' {
            if ($null -ne $optVal) { $CLI_HTTPS_PORT = $optVal }
            else { $CLI_HTTPS_PORT = "$($args[++$i])" }
        }
        '^(--no-https|-no-https|-nohttps)$' {
            $CLI_NO_HTTPS = 1
        }
        '^(-d|--domain|-domain)$' {
            if ($null -ne $optVal) { $CLI_DOMAIN = $optVal }
            else { $CLI_DOMAIN = "$($args[++$i])" }
        }
        '^(-v|--version|-version)$' {
            if ($null -ne $optVal) { $CLI_VERSION = $optVal }
            else { $CLI_VERSION = "$($args[++$i])" }
        }
        '^(--db-pass|-db-pass|-dbpass)$' {
            if ($null -ne $optVal) { $CLI_DB_PASS = $optVal }
            else { $CLI_DB_PASS = "$($args[++$i])" }
        }
        '^(--db-root-pass|-db-root-pass|-dbrootpass)$' {
            if ($null -ne $optVal) { $CLI_DB_ROOT_PASS = $optVal }
            else { $CLI_DB_ROOT_PASS = "$($args[++$i])" }
        }
        '^(--dir|-dir)$' {
            if ($null -ne $optVal) { $CLI_DIR = $optVal }
            else { $CLI_DIR = "$($args[++$i])" }
        }
        '^(-u|--uninstall|-uninstall)$' {
            $CLI_UNINSTALL = 1
        }
        '^(--keep-volumes|-keep-volumes|-keepvolumes)$' {
            $CLI_KEEP_VOLUMES = 1
        }
        '^(--purge|-purge)$' {
            $CLI_KEEP_VOLUMES = 0
        }
        '^(-y|--yes|-yes|-n|--non-interactive|-non-interactive|-noninteractive)$' {
            $NON_INTERACTIVE = 1
        }
        '^(-h|--help|-help|-\?|/\?)$' {
            Show-Help
            exit 0
        }
        default {
            Write-Host "[ERROR] Unknown option: $arg" -ForegroundColor Red
            Write-Host "Run '.\setup.ps1 --help' for available options."
            exit 1
        }
    }
    $i++
}

$INSTALL_DIR = if ($CLI_DIR) { $CLI_DIR } elseif ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "user-management-panel" }
$TARGET_VERSION = if ($CLI_VERSION) { $CLI_VERSION } elseif ($env:APP_VERSION) { $env:APP_VERSION } else { "" }
$GIVEN_PORT = if ($CLI_PORT) { $CLI_PORT } elseif ($env:HTTP_PORT) { $env:HTTP_PORT } else { "" }
$GIVEN_DOMAIN = if ($CLI_DOMAIN) { $CLI_DOMAIN } elseif ($env:DOMAIN) { $env:DOMAIN } else { "" }
$GIVEN_DB_PASS = if ($CLI_DB_PASS) { $CLI_DB_PASS } elseif ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
$GIVEN_DB_ROOT_PASS = if ($CLI_DB_ROOT_PASS) { $CLI_DB_ROOT_PASS } elseif ($env:DB_ROOT_PASSWORD) { $env:DB_ROOT_PASSWORD } else { "" }
$GIVEN_HTTPS_PORT = if ($CLI_HTTPS_PORT) { $CLI_HTTPS_PORT } elseif ($env:HTTPS_PORT) { $env:HTTPS_PORT } else { "" }
$SKIP_HTTPS = if ($CLI_NO_HTTPS -eq 1) { 1 } elseif ($env:NO_HTTPS -eq "1" -or $env:NO_HTTPS -eq "true") { 1 } else { 0 }

# Interactive detection
$IS_INTERACTIVE = 1
if ($NON_INTERACTIVE -eq 1 -or $env:CI -eq "true" -or [Console]::IsInputRedirected) {
    $IS_INTERACTIVE = 0
}

# ------------------------------------------------------------------------------
# Helper Utilities
# ------------------------------------------------------------------------------
function Prompt-User {
    param (
        [string]$PromptMsg
    )
    if ($IS_INTERACTIVE -eq 0) {
        return ""
    }
    try {
        Write-Host -NoNewline $PromptMsg
        $line = [Console]::ReadLine()
        if ($null -eq $line) { return "" }
        return $line.Trim()
    } catch {
        try {
            $line = Read-Host
            if ($null -eq $line) { return "" }
            return $line.Trim()
        } catch {
            return ""
        }
    }
}

function Test-PortInUse {
    param ([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns -and $conns.Count -gt 0) {
            return $true
        }
    } catch {}

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(200, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
    } catch {}

    return $false
}

function Get-RandomAlphanumeric {
    param ([int]$Length = 24)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray()
    $buffer = New-Object byte[] ($Length * 4)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    $result = New-Object char[] $Length
    for ($idx = 0; $idx -lt $Length; $idx++) {
        $val = [BitConverter]::ToUInt32($buffer, $idx * 4)
        $result[$idx] = $chars[$val % $chars.Length]
    }
    return -join $result
}

function Get-RandomBase64 {
    param ([int]$Bytes = 32)
    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buffer)
    return [Convert]::ToBase64String($buffer)
}

function Write-CleanSecretFile {
    param (
        [string]$FilePath,
        [string]$Value
    )
    $dir = Split-Path -Parent $FilePath
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($FilePath, $Value.Trim(), $utf8NoBom)
}

function Download-StackFile {
    param (
        [string]$Url,
        [string]$DestinationPath
    )
    $dir = Split-Path -Parent $DestinationPath
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $downloaded = $false
    try {
        if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
            & curl.exe -fsSL "$Url" -o "$DestinationPath"
            if ($LASTEXITCODE -eq 0 -and (Test-Path $DestinationPath)) {
                $downloaded = $true
            }
        }
    } catch {}

    if (-not $downloaded) {
        try {
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
            Invoke-WebRequest -Uri $Url -OutFile $DestinationPath -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
            $downloaded = $true
        } catch {}
    }

    if (-not $downloaded -and -not (Test-Path $DestinationPath)) {
        Write-Host "  [WARNING] Unable to download $Url and no local copy found." -ForegroundColor Yellow
    }
}

function Set-EnvVariable {
    param (
        [string]$Path,
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $Path)) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" $Path
        } else {
            New-Item -ItemType File -Path $Path -Force | Out-Null
        }
    }
    $lines = [System.IO.File]::ReadAllLines($Path)
    $found = $false
    $newLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $lines) {
        if ($line -match "^#?\s*${Key}=") {
            $newLines.Add("${Key}=${Value}")
            $found = $true
        } else {
            $newLines.Add($line)
        }
    }
    if (-not $found) {
        $newLines.Add("${Key}=${Value}")
    }
    [System.IO.File]::WriteAllLines($Path, $newLines)
}

function Disable-EnvVariable {
    param (
        [string]$Path,
        [string]$Key,
        [string]$Comment
    )
    if (-not (Test-Path $Path)) { return }
    $lines = [System.IO.File]::ReadAllLines($Path)
    $newLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $lines) {
        if ($line -match "^#?\s*${Key}=") {
            $newLines.Add("# ${Key}=${Comment}")
        } else {
            $newLines.Add($line)
        }
    }
    [System.IO.File]::WriteAllLines($Path, $newLines)
}

function Update-ComposeHttpsPort {
    param (
        [string]$Path,
        [bool]$Enable
    )
    if (-not (Test-Path $Path)) { return }
    $lines = [System.IO.File]::ReadAllLines($Path)
    $newLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $lines) {
        if ($line -match ':443') {
            if ($Enable) {
                $newLines.Add(($line -replace '^[ \t]*#[ \t]*-', '      -'))
            } else {
                $newLines.Add(($line -replace '^[ \t]*-', '      # -'))
            }
        } else {
            $newLines.Add($line)
        }
    }
    [System.IO.File]::WriteAllLines($Path, $newLines)
}

# ------------------------------------------------------------------------------
# Uninstallation and Cleanup Handler
# ------------------------------------------------------------------------------
function Do-Uninstall {
    Write-Host "====================================================================" -ForegroundColor Yellow
    Write-Host "   PLAYLISTLABS USER MANAGEMENT - UNINSTALL & CLEANUP UTILITY      " -ForegroundColor Yellow
    Write-Host "====================================================================" -ForegroundColor Yellow
    Write-Host ""

    if (-not (Test-Path "docker-compose.yml") -and (Test-Path "$INSTALL_DIR\docker-compose.yml")) {
        Set-Location $INSTALL_DIR
    }

    if (-not (Test-Path "docker-compose.yml")) {
        Write-Host "[ERROR] No docker-compose.yml found in current directory or in '$INSTALL_DIR'." -ForegroundColor Red
        Write-Host "Nothing to uninstall."
        exit 1
    }

    # Interactive confirmation if not unattended
    if ($IS_INTERACTIVE -eq 1 -and $NON_INTERACTIVE -eq 0) {
        Write-Host "WARNING: This will completely stop all containers and permanently delete" -ForegroundColor Red
        Write-Host "all database volumes, secrets, downloaded images, and configuration." -ForegroundColor Red
        $confirm = Prompt-User "Are you sure you want to completely uninstall and wipe all data? [y/N]: "
        if (-not ($confirm -match '^[yY]')) {
            Write-Host "Uninstallation cancelled."
            exit 0
        }
    }

    Write-Host ""
    if ($CLI_KEEP_VOLUMES -eq 1) {
        Write-Host "[1/1] Stopping and removing stack containers (preserving volumes & secrets)..." -ForegroundColor Yellow
        docker compose down --remove-orphans 2>$null

        Write-Host ""
        Write-Host "====================================================================" -ForegroundColor Green
        Write-Host "  $Check UNINSTALLATION COMPLETED!" -ForegroundColor Green
        Write-Host "  Containers stopped and removed. Database data & secrets preserved." -ForegroundColor Green
        Write-Host "  To restart: docker compose up -d" -ForegroundColor Green
        Write-Host "====================================================================" -ForegroundColor Green
    } else {
        Write-Host "[1/3] Stopping containers and deleting persistent Docker volumes..." -ForegroundColor Yellow
        docker compose down -v --remove-orphans 2>$null

        Write-Host "[2/3] Removing downloaded application images..." -ForegroundColor Yellow
        $imgs = docker images --filter="reference=ghcr.io/lkinderbueno/user-management-*" -q 2>$null
        if ($imgs) {
            $imgs | ForEach-Object { docker rmi -f $_ 2>$null | Out-Null }
        }

        Write-Host "[3/3] Cleaning up local secrets, configuration files, and data directories..." -ForegroundColor Yellow
        $itemsToClean = @(
            "secrets", "data", "backups", "sql", "deploy",
            ".env", ".env.bak", "docker-compose.yml", ".env.example",
            "reset-password.sh", "reset_password", "uninstall.sh", "install.sh"
        )
        foreach ($item in $itemsToClean) {
            if (Test-Path $item) {
                Remove-Item -Path $item -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
            }
        }

        Write-Host ""
        Write-Host "====================================================================" -ForegroundColor Green
        Write-Host "  $Check UNINSTALLATION & COMPLETE CLEANUP COMPLETED!" -ForegroundColor Green
        Write-Host "  All containers, database volumes, secrets, images and data purged." -ForegroundColor Green
        Write-Host "====================================================================" -ForegroundColor Green
    }

    exit 0
}

if ($CLI_UNINSTALL -eq 1) {
    Do-Uninstall
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "      PLAYLISTLABS USER MANAGEMENT - SETUP & UPGRADE UTILITY       " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Check prerequisites
# ------------------------------------------------------------------------------
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[!] Docker is not installed or not found in system PATH." -ForegroundColor Yellow
    Write-Host "[ERROR] Docker Desktop for Windows is required to run PlaylistLabs." -ForegroundColor Red
    Write-Host "Please download and install Docker Desktop from:"
    Write-Host "  https://docs.docker.com/desktop/setup/install/windows-install/"
    Write-Host "Ensure WSL2 backend is enabled and Docker Desktop is running before proceeding."
    exit 1
}

# Check docker compose
$composeVer = docker compose version 2>$null
if ($LASTEXITCODE -ne 0 -or -not $composeVer) {
    Write-Host "[ERROR] Docker Compose v2 is required but not found. Please ensure Docker Compose is enabled in Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if Docker daemon is running
$dockerInfo = docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Desktop engine is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop and wait until the engine is in 'running' state, then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/5] Docker and Docker Compose ready." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Setup directory
# ------------------------------------------------------------------------------
if ((Test-Path "docker-compose.yml") -or (Test-Path ".env")) {
    Write-Host "[2/5] Current directory already contains project configuration. Using current directory." -ForegroundColor Green
} else {
    Write-Host "[2/5] Setting up directory: $INSTALL_DIR..." -ForegroundColor Yellow
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }
    Set-Location $INSTALL_DIR
}

# Detect if this is an upgrade of an existing installation
$IS_UPGRADE = $false
$CURRENT_VERSION = "latest"
$CURRENT_DOMAIN = "localhost"
$CURRENT_PORT = "80"
$CADDY_WAS_RUNNING = $false

$runningContainers = docker ps --format "{{.Names}}" 2>$null
if ($runningContainers -and ($runningContainers -split "`r?`n") -contains "playlistlabs-caddy") {
    $CADDY_WAS_RUNNING = $true
}

if ((Test-Path ".env") -and (Test-Path "docker-compose.yml") -and (Test-Path "secrets/db_password.txt")) {
    $IS_UPGRADE = $true
    $envLines = Get-Content ".env" -ErrorAction SilentlyContinue
    foreach ($line in $envLines) {
        if ($line -match "^APP_VERSION=(.*)$") {
            $CURRENT_VERSION = $matches[1].Trim()
        } elseif ($line -match "^DOMAIN=(.*)$") {
            $CURRENT_DOMAIN = $matches[1].Trim()
        } elseif ($line -match "^HTTP_PORT=(.*)$") {
            $CURRENT_PORT = $matches[1].Trim()
        }
    }

    Write-Host "  $Check Existing installation detected (UPGRADE MODE)." -ForegroundColor Green
    Write-Host "    - Current version: " -NoNewline
    Write-Host $CURRENT_VERSION -ForegroundColor Cyan
    Write-Host "    - Domain:          " -NoNewline
    Write-Host $CURRENT_DOMAIN -ForegroundColor Cyan
    Write-Host "    - Port:            " -NoNewline
    Write-Host $CURRENT_PORT -ForegroundColor Cyan
    Write-Host ""
}

# ------------------------------------------------------------------------------
# 3. Download updated stack configuration
# ------------------------------------------------------------------------------
Write-Host "[3/5] Updating stack configuration and definitions..." -ForegroundColor Yellow
Download-StackFile "${REPO_RAW_URL}/docker-compose.yml" "docker-compose.yml"
Download-StackFile "${REPO_RAW_URL}/.env.example" ".env.example"

# Download SQL schema files for MariaDB init
Download-StackFile "${REPO_RAW_URL}/sql/001_init_schema.sql" "sql/001_init_schema.sql"

# Download Caddy config
Download-StackFile "${REPO_RAW_URL}/deploy/caddy/Caddyfile" "deploy/caddy/Caddyfile"
Download-StackFile "${REPO_RAW_URL}/deploy/caddy/1x1.png" "deploy/caddy/1x1.png"

# Download helper scripts
Download-StackFile "${REPO_RAW_URL}/install.sh" "install.sh"
Download-StackFile "${REPO_RAW_URL}/reset-password.sh" "reset-password.sh"
Download-StackFile "${REPO_RAW_URL}/uninstall.sh" "uninstall.sh"

# ------------------------------------------------------------------------------
# 4. Check & Configure Secrets, Port and Version
# ------------------------------------------------------------------------------
Write-Host "[4/5] Configuration & Security Setup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "secrets", "backups", "data\epg" | Out-Null

# Generate strong random JWT secret automatically if missing
if (-not (Test-Path "secrets/jwt_secret.txt")) {
    $jwtSecret = Get-RandomBase64 32
    Write-CleanSecretFile "secrets/jwt_secret.txt" $jwtSecret
    Write-Host "  $Check Generated secure random JWT secret." -ForegroundColor Green
} else {
    Write-Host "  $Check Existing JWT secret preserved." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# STEP 4A: Database Credentials (MariaDB)
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "--- [1/3] MariaDB Database Credentials ---" -ForegroundColor White

if ($GIVEN_DB_PASS) {
    Write-CleanSecretFile "secrets/db_password.txt" $GIVEN_DB_PASS
    Write-Host "  $Check MariaDB user password set from argument/env." -ForegroundColor Green
}

if ($GIVEN_DB_ROOT_PASS) {
    Write-CleanSecretFile "secrets/db_root_password.txt" $GIVEN_DB_ROOT_PASS
    Write-Host "  $Check MariaDB root password set from argument/env." -ForegroundColor Green
}

if ($IS_UPGRADE -and (Test-Path "secrets/db_password.txt")) {
    if (-not $GIVEN_DB_PASS) {
        Write-Host "  $Check Existing database credentials preserved in secrets/db_password.txt" -ForegroundColor Green
        if ($IS_INTERACTIVE -eq 1) {
            $changePass = Prompt-User "Do you want to change the database passwords? [y/N]: "
            if ($changePass -match '^[yY]') {
                $userPass = Prompt-User "Enter new password for MariaDB user 'playlistlabs': "
                if ($userPass) {
                    Write-CleanSecretFile "secrets/db_password.txt" $userPass
                    Write-Host "  $Check Updated secrets/db_password.txt" -ForegroundColor Green
                }
                $rootPass = Prompt-User "Enter new MariaDB ROOT password: "
                if ($rootPass) {
                    Write-CleanSecretFile "secrets/db_root_password.txt" $rootPass
                    Write-Host "  $Check Updated secrets/db_root_password.txt" -ForegroundColor Green
                }
            }
        }
    }
} elseif (-not (Test-Path "secrets/db_password.txt") -or -not (Test-Path "secrets/db_root_password.txt")) {
    if ($IS_INTERACTIVE -eq 1) {
        Write-Host "You can specify your own password or press [Enter] to generate a secure random one."
        if (-not (Test-Path "secrets/db_password.txt")) {
            $userPass = Prompt-User "Enter password for MariaDB user 'playlistlabs' [press Enter for auto-generated]: "
            if ($userPass) {
                Write-CleanSecretFile "secrets/db_password.txt" $userPass
                Write-Host "  $Check Database user password set." -ForegroundColor Green
            } else {
                $genPass = Get-RandomAlphanumeric 24
                Write-CleanSecretFile "secrets/db_password.txt" $genPass
                Write-Host "  $Check Generated secure database password: " -ForegroundColor Green -NoNewline
                Write-Host $genPass -ForegroundColor Cyan
            }
        }

        if (-not (Test-Path "secrets/db_root_password.txt")) {
            $rootPass = Prompt-User "Enter MariaDB ROOT password [press Enter for auto-generated]: "
            if ($rootPass) {
                Write-CleanSecretFile "secrets/db_root_password.txt" $rootPass
                Write-Host "  $Check Database ROOT password set." -ForegroundColor Green
            } else {
                $genRoot = Get-RandomAlphanumeric 24
                Write-CleanSecretFile "secrets/db_root_password.txt" $genRoot
                Write-Host "  $Check Generated secure root password: " -ForegroundColor Green -NoNewline
                Write-Host $genRoot -ForegroundColor Cyan
            }
        }
    } else {
        # Non-interactive / unattended fallback
        if (-not (Test-Path "secrets/db_password.txt")) {
            $genPass = Get-RandomAlphanumeric 24
            Write-CleanSecretFile "secrets/db_password.txt" $genPass
            Write-Host "  $Check Generated secure database user password in secrets/db_password.txt" -ForegroundColor Green
        }
        if (-not (Test-Path "secrets/db_root_password.txt")) {
            $genRoot = Get-RandomAlphanumeric 24
            Write-CleanSecretFile "secrets/db_root_password.txt" $genRoot
            Write-Host "  $Check Generated secure root password in secrets/db_root_password.txt" -ForegroundColor Green
        }
    }
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

# ------------------------------------------------------------------------------
# STEP 4B: Network & Ingress (Gateway)
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "--- [2/3] Network & Port Configuration (Gateway) ---" -ForegroundColor White

$FINAL_PORT = ""
$FINAL_DOMAIN = ""

if ($GIVEN_PORT) {
    if (-not ($GIVEN_PORT -match '^\d+$') -or [int]$GIVEN_PORT -lt 1 -or [int]$GIVEN_PORT -gt 65535) {
        Write-Host "  [!] Invalid port '$GIVEN_PORT' provided. Must be between 1 and 65535." -ForegroundColor Red
        exit 1
    }
    $portNum = [int]$GIVEN_PORT
    if ($IS_UPGRADE -and ($GIVEN_PORT -eq $CURRENT_PORT)) {
        $FINAL_PORT = $GIVEN_PORT
    } elseif (Test-PortInUse $portNum) {
        if ($IS_INTERACTIVE -eq 0) {
            Write-Host "  [ERROR] Specified port $GIVEN_PORT is already in use by another process." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "  [!] Port $GIVEN_PORT is ALREADY IN USE." -ForegroundColor Red
        }
    } else {
        $FINAL_PORT = $GIVEN_PORT
        Write-Host "  $Check Port configured from argument: " -ForegroundColor Green -NoNewline
        Write-Host $FINAL_PORT -ForegroundColor Cyan
    }
}

if ($GIVEN_DOMAIN) {
    $FINAL_DOMAIN = $GIVEN_DOMAIN
    Write-Host "  $Check Domain configured from argument: " -ForegroundColor Green -NoNewline
    Write-Host $FINAL_DOMAIN -ForegroundColor Cyan
}

if (-not $FINAL_PORT) {
    if ($IS_UPGRADE) {
        if ($IS_INTERACTIVE -eq 1) {
            $keepPort = Prompt-User "Keep existing port (${CURRENT_PORT})? [Y/n]: "
            if ($keepPort -match '^[nN]') {
                while ($true) {
                    $userPort = Prompt-User "Enter new HTTP port: "
                    $chosenPort = if ($userPort) { $userPort } else { "80" }
                    if (-not ($chosenPort -match '^\d+$') -or [int]$chosenPort -lt 1 -or [int]$chosenPort -gt 65535) {
                        Write-Host "  [!] Invalid port. Enter a number 1-65535." -ForegroundColor Red
                        continue
                    }
                    if (Test-PortInUse ([int]$chosenPort)) {
                        Write-Host "  [!] Port $chosenPort is in use. Choose another." -ForegroundColor Red
                        continue
                    }
                    $FINAL_PORT = "$chosenPort"
                    break
                }
            } else {
                $FINAL_PORT = $CURRENT_PORT
            }
        } else {
            $FINAL_PORT = $CURRENT_PORT
        }
    } else {
        if ($IS_INTERACTIVE -eq 1) {
            while ($true) {
                $userPort = Prompt-User "Enter HTTP port [press Enter for 80]: "
                $chosenPort = if ($userPort) { $userPort } else { "80" }
                if (-not ($chosenPort -match '^\d+$') -or [int]$chosenPort -lt 1 -or [int]$chosenPort -gt 65535) {
                    Write-Host "  [!] Invalid port '$chosenPort'. Enter a number 1-65535." -ForegroundColor Red
                    continue
                }
                if (Test-PortInUse ([int]$chosenPort)) {
                    Write-Host "  [!] Port $chosenPort is ALREADY IN USE by another process on this machine." -ForegroundColor Red
                    Write-Host "  Please choose an available port (e.g. 8080, 8000, 8888, 8088):" -ForegroundColor Yellow
                    continue
                }
                $FINAL_PORT = "$chosenPort"
                Write-Host "  $Check Port $FINAL_PORT is available and ready." -ForegroundColor Green
                break
            }
        } else {
            # Unattended fresh install
            $FINAL_PORT = "80"
            if (Test-PortInUse 80) {
                Write-Host "  [!] Port 80 in use, falling back to 8080..." -ForegroundColor Yellow
                $FINAL_PORT = "8080"
            }
        }
    }
}

# Detect public or local network IP
$SERVER_IP = ""
try {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $SERVER_IP = (& curl.exe -s4 -m 2 https://api.ipify.org 2>$null)
        if (-not $SERVER_IP) {
            $SERVER_IP = (& curl.exe -s4 -m 2 https://ifconfig.me 2>$null)
        }
    }
    if (-not $SERVER_IP) {
        $SERVER_IP = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 2 -ErrorAction SilentlyContinue)
    }
} catch {}

if (-not $SERVER_IP) {
    try {
        $localIps = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" }).IPAddress
        if ($localIps) {
            $SERVER_IP = $localIps[0]
        }
    } catch {}
}

if (-not $FINAL_DOMAIN) {
    if ($IS_UPGRADE) {
        $FINAL_DOMAIN = $CURRENT_DOMAIN
    } else {
        $FINAL_DOMAIN = "localhost"
    }
}

if ($FINAL_DOMAIN -eq "localhost" -and $SERVER_IP -and $SERVER_IP -ne "127.0.0.1") {
    Write-Host "  Active Ingress: " -NoNewline
    Write-Host "http://localhost:${FINAL_PORT}" -ForegroundColor Cyan -NoNewline
    Write-Host " or " -NoNewline
    Write-Host "http://${SERVER_IP}:${FINAL_PORT}" -ForegroundColor Cyan
} else {
    Write-Host "  Active Ingress: " -NoNewline
    Write-Host "http://${FINAL_DOMAIN}:${FINAL_PORT}" -ForegroundColor Cyan
}

Set-EnvVariable ".env" "HTTP_PORT" $FINAL_PORT
Set-EnvVariable ".env" "DOMAIN" $FINAL_DOMAIN

# ------------------------------------------------------------------------------
# HTTPS Port Availability Detection & Configuration
# ------------------------------------------------------------------------------
$HTTPS_ENABLED = 1
$HTTPS_PORT_TARGET = if ($GIVEN_HTTPS_PORT) { $GIVEN_HTTPS_PORT } else { "443" }

if ($SKIP_HTTPS -eq 1) {
    $HTTPS_ENABLED = 0
    Write-Host "  [!] HTTPS binding explicitly disabled via flag/environment." -ForegroundColor Yellow
} else {
    $isOurCaddyOnHttps = 0
    $caddyPorts = docker ps --filter "name=playlistlabs-caddy" --format "{{.Ports}}" 2>$null
    if ($caddyPorts -and ($caddyPorts -match ":${HTTPS_PORT_TARGET}->")) {
        $isOurCaddyOnHttps = 1
    }

    if ((Test-PortInUse ([int]$HTTPS_PORT_TARGET)) -and ($isOurCaddyOnHttps -eq 0)) {
        $HTTPS_ENABLED = 0
        Write-Host ""
        Write-Host "  +------------------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host "  | [WARNING] PORT $HTTPS_PORT_TARGET (HTTPS) IS ALREADY IN USE BY ANOTHER PROCESS!     |" -ForegroundColor Yellow
        Write-Host "  +------------------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host "  | Port $HTTPS_PORT_TARGET is occupied by another service on this machine                |" -ForegroundColor Yellow
        Write-Host "  | (such as IIS, Nginx, Apache, or another reverse proxy).                |" -ForegroundColor Yellow
        Write-Host "  |                                                                        |" -ForegroundColor Yellow
        Write-Host "  | -> Skipping HTTPS port $HTTPS_PORT_TARGET binding to prevent startup failure.        |" -ForegroundColor Yellow
        Write-Host "  | -> The stack will start and operate normally on HTTP port $FINAL_PORT.        |" -ForegroundColor Yellow
        Write-Host "  |                                                                        |" -ForegroundColor Yellow
        Write-Host "  | Note: Automatic Let's Encrypt certificates on port 443 will not be     |" -ForegroundColor Yellow
        Write-Host "  | exposed directly. You can route traffic via an upstream reverse proxy. |" -ForegroundColor Yellow
        Write-Host "  +------------------------------------------------------------------------+" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  $Check Port $HTTPS_PORT_TARGET (HTTPS) is available and enabled." -ForegroundColor Green
    }
}

# Apply port binding to docker-compose.yml
if (Test-Path "docker-compose.yml") {
    Update-ComposeHttpsPort "docker-compose.yml" ($HTTPS_ENABLED -eq 1)
}

# Update HTTPS_PORT in .env
if ($HTTPS_ENABLED -eq 0) {
    Disable-EnvVariable ".env" "HTTPS_PORT" "443 (disabled: port occupied by another process)"
} else {
    Set-EnvVariable ".env" "HTTPS_PORT" $HTTPS_PORT_TARGET
}

# ------------------------------------------------------------------------------
# STEP 4C: Application Version
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "--- [3/3] Application Version ---" -ForegroundColor White
if (-not $TARGET_VERSION) {
    if ($IS_INTERACTIVE -eq 1) {
        if ($IS_UPGRADE) {
            $inputVer = Prompt-User "Enter version/tag to upgrade to [press Enter for '${CURRENT_VERSION}']: "
            $TARGET_VERSION = if ($inputVer) { $inputVer } else { $CURRENT_VERSION }
        } else {
            $inputVer = Prompt-User "Enter version/tag to deploy [press Enter for 'latest']: "
            $TARGET_VERSION = if ($inputVer) { $inputVer } else { "latest" }
        }
    } else {
        if ($IS_UPGRADE) {
            $TARGET_VERSION = $CURRENT_VERSION
        } else {
            $TARGET_VERSION = "latest"
        }
    }
}
Write-Host "  Target version: " -NoNewline
Write-Host $TARGET_VERSION -ForegroundColor Cyan

Set-EnvVariable ".env" "APP_VERSION" $TARGET_VERSION

# ------------------------------------------------------------------------------
# 5. Check Image Digests / Hashes and Start Containers
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[5/5] Checking image hashes (version: ${TARGET_VERSION}) and updating services..." -ForegroundColor Yellow
$env:APP_VERSION = $TARGET_VERSION

$services = @("dashboard", "xtream", "redirector", "syncer")
$oldHashes = @()
$images = @()

foreach ($svc in $services) {
    $img = "ghcr.io/lkinderbueno/user-management-${svc}:${TARGET_VERSION}"
    $images += $img
    $curId = docker image inspect --format "{{.Id}}" $img 2>$null
    if (-not $curId) { $curId = "none" }
    $oldHashes += $curId
}

Write-Host "  Verifying remote digests on GitHub Container Registry (GHCR)..."
docker compose pull

Write-Host ""
Write-Host "Image Version & Hash Verification:" -ForegroundColor White
for ($idx = 0; $idx -lt $services.Count; $idx++) {
    $svc = $services[$idx]
    $img = $images[$idx]
    $oldId = $oldHashes[$idx]
    $newId = docker image inspect --format "{{.Id}}" $img 2>$null
    if (-not $newId) { $newId = "unknown" }

    $shortOld = $oldId.Replace("sha256:", "")
    if ($shortOld.Length -gt 12) { $shortOld = $shortOld.Substring(0, 12) }
    $shortNew = $newId.Replace("sha256:", "")
    if ($shortNew.Length -gt 12) { $shortNew = $shortNew.Substring(0, 12) }

    if ($oldId -eq "none") {
        Write-Host "  $Check ${svc}: " -ForegroundColor Green -NoNewline
        Write-Host "Downloaded image (hash: " -NoNewline
        Write-Host $shortNew -ForegroundColor Cyan -NoNewline
        Write-Host ")"
    } elseif ($oldId -ne $newId) {
        Write-Host "  $Check ${svc}: " -ForegroundColor Green -NoNewline
        Write-Host "New digest detected on registry! Updated (" -NoNewline
        Write-Host $shortOld -ForegroundColor Yellow -NoNewline
        Write-Host " -> " -NoNewline
        Write-Host $shortNew -ForegroundColor Green -NoNewline
        Write-Host ")"
    } else {
        Write-Host "  $Check ${svc}: " -ForegroundColor Cyan -NoNewline
        Write-Host "Up to date (hash: " -NoNewline
        Write-Host $shortNew -ForegroundColor Cyan -NoNewline
        Write-Host ", remote matches local)"
    }
}

Write-Host ""
Write-Host "  Ensuring storage directories exist..."
New-Item -ItemType Directory -Force -Path "backups", "data\epg" | Out-Null

Write-Host "  Launching services..."
docker compose up -d

# Restart Caddy reverse proxy on upgrade or if previously running
if ($IS_UPGRADE -or $CADDY_WAS_RUNNING) {
    $caddyRunning = docker ps --format "{{.Names}}" 2>$null | Select-String -Pattern "^playlistlabs-caddy$"
    if ($caddyRunning) {
        Write-Host "  Restarting Caddy reverse proxy to apply configuration updates..."
        docker compose restart caddy 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker compose --profile caddy restart caddy 2>$null
            if ($LASTEXITCODE -ne 0) {
                docker restart playlistlabs-caddy 2>$null | Out-Null
            }
        }
        Write-Host "  $Check Caddy reverse proxy restarted successfully." -ForegroundColor Green
    }
}

# Read effective port & domain from .env
$EFFECTIVE_PORT = "80"
$EFFECTIVE_DOMAIN = "localhost"
if (Test-Path ".env") {
    $envLines = Get-Content ".env" -ErrorAction SilentlyContinue
    foreach ($line in $envLines) {
        if ($line -match "^HTTP_PORT=(.*)$") { $EFFECTIVE_PORT = $matches[1].Trim() }
        if ($line -match "^DOMAIN=(.*)$") { $EFFECTIVE_DOMAIN = $matches[1].Trim() }
    }
}

$PORT_SUFFIX = ""
if ($EFFECTIVE_PORT -ne "80" -and $EFFECTIVE_PORT) {
    $PORT_SUFFIX = ":${EFFECTIVE_PORT}"
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
if ($IS_UPGRADE) {
    Write-Host "  $Check UPGRADE COMPLETED SUCCESSFULLY!" -ForegroundColor Green
} else {
    Write-Host "  $Check INSTALLATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
}
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Version active: " -NoNewline
Write-Host $TARGET_VERSION -ForegroundColor Cyan
Write-Host "Database credentials location:"
Write-Host "  - " -NoNewline
Write-Host "secrets/db_password.txt" -ForegroundColor Yellow
Write-Host "  - " -NoNewline
Write-Host "secrets/db_root_password.txt" -ForegroundColor Yellow
Write-Host "  - " -NoNewline
Write-Host "secrets/jwt_secret.txt" -ForegroundColor Yellow
Write-Host ""

Write-Host "Access your Management Dashboard & API Gateway:"
if ($EFFECTIVE_DOMAIN -ne "localhost") {
    if ($HTTPS_ENABLED -eq 1) {
        Write-Host "  - Domain: " -NoNewline
        Write-Host "https://${EFFECTIVE_DOMAIN}${PORT_SUFFIX}" -ForegroundColor Cyan -NoNewline
        Write-Host " (or http://${EFFECTIVE_DOMAIN}${PORT_SUFFIX})"
    } else {
        Write-Host "  - Domain: " -NoNewline
        Write-Host "http://${EFFECTIVE_DOMAIN}${PORT_SUFFIX}" -ForegroundColor Cyan
    }
}
Write-Host "  - Local:  " -NoNewline
Write-Host "http://localhost${PORT_SUFFIX}" -ForegroundColor Cyan
if ($SERVER_IP -and $SERVER_IP -ne "127.0.0.1") {
    Write-Host "  - Server: " -NoNewline
    Write-Host "http://${SERVER_IP}${PORT_SUFFIX}" -ForegroundColor Cyan
} else {
    Write-Host "  - Server: " -NoNewline
    Write-Host "http://<your-server-ip>${PORT_SUFFIX}" -ForegroundColor Cyan
}

if ($HTTPS_ENABLED -eq 0) {
    Write-Host ""
    Write-Host "  [!] Notice: HTTPS port 443 binding was skipped because port 443 was occupied." -ForegroundColor Yellow
    Write-Host "      The panel is operating on HTTP. To enable direct SSL, free port 443" -ForegroundColor Yellow
    Write-Host "      or route traffic through an existing reverse proxy (e.g. IIS / Nginx)." -ForegroundColor Yellow
}
Write-Host ""
if (-not $IS_UPGRADE) {
    Write-Host "Initial Setup:"
    Write-Host "  Open the dashboard in your browser to complete the initial setup wizard"
    Write-Host ""
}
