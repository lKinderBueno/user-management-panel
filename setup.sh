#!/usr/bin/env bash
# ==============================================================================
# PlaylistLabs User Management - Installer & Upgrader Script
#
# Interactive Usage:
#   Fresh Install:  curl -fsSL https://ump.playlistlabs.io/setup.sh | bash
#
# Unattended / CLI Arguments Usage:
#   curl -fsSL https://ump.playlistlabs.io/setup.sh | bash -s -- -y
#   ./setup.sh -p 8080 -d panel.example.com --version latest -y
# ==============================================================================

set -euo pipefail

RED='\033[031m'
GREEN='\033[032m'
YELLOW='\033[1;33m'
CYAN='\033[036m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_RAW_URL="https://ump.playlistlabs.io"

# ------------------------------------------------------------------------------
# Command-Line Arguments & Environment Variables
# ------------------------------------------------------------------------------
CLI_PORT=""
CLI_DOMAIN=""
CLI_VERSION=""
CLI_DB_PASS=""
CLI_DB_ROOT_PASS=""
CLI_DIR=""
CLI_HTTPS_PORT=""
CLI_NO_HTTPS=0
NO_HTTPS="${NO_HTTPS:-0}"
CLI_UNINSTALL=0
CLI_KEEP_VOLUMES=0
NON_INTERACTIVE="${NON_INTERACTIVE:-0}"

show_help() {
    cat << EOF
PlaylistLabs User Management Stack - Installer & Upgrader

Usage:
  ./setup.sh [OPTIONS]
  curl -fsSL https://ump.playlistlabs.io/setup.sh | bash -s -- [OPTIONS]

Options:
  -p, --port <port>          HTTP port for the gateway (default: 80)
      --https-port <port>    HTTPS port for the gateway (default: 443)
      --no-https             Disable HTTPS (port 443) binding
  -d, --domain <domain>      Primary domain or server IP (default: localhost)
  -v, --version <tag>        Application version to deploy (default: latest)
      --db-pass <password>   MariaDB user password (default: auto-generated random)
      --db-root-pass <pass>  MariaDB root password (default: auto-generated random)
      --dir <directory>      Installation directory (default: user-management-panel)
  -u, --uninstall            Complete uninstallation: stop containers, delete volumes, data, secrets & images
      --keep-volumes         When uninstalling, preserve database volumes and secrets
  -y, --yes, -n, --non-interactive
                             Run in non-interactive/unattended mode (no prompts)
  -h, --help                 Display this help message

Environment Variables:
  HTTP_PORT, HTTPS_PORT, NO_HTTPS, DOMAIN, APP_VERSION, DB_PASSWORD, DB_ROOT_PASSWORD, INSTALL_DIR, NON_INTERACTIVE

Examples:
  # Unattended installation with custom port:
  ./setup.sh -p 8080 -d panel.example.com -y

  # Via curl one-liner with arguments:
  curl -fsSL https://ump.playlistlabs.io/setup.sh | bash -s -- -p 8080 -y

  # Complete uninstallation and cleanup (removes containers, database volumes, secrets, and images):
  ./setup.sh --uninstall

  # Unattended complete wipe:
  ./setup.sh --uninstall -y
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--port)
            CLI_PORT="${2:-}"
            shift 2
            ;;
        --https-port)
            CLI_HTTPS_PORT="${2:-}"
            shift 2
            ;;
        --no-https)
            CLI_NO_HTTPS=1
            shift
            ;;
        -d|--domain)
            CLI_DOMAIN="${2:-}"
            shift 2
            ;;
        -v|--version)
            CLI_VERSION="${2:-}"
            shift 2
            ;;
        --db-pass)
            CLI_DB_PASS="${2:-}"
            shift 2
            ;;
        --db-root-pass)
            CLI_DB_ROOT_PASS="${2:-}"
            shift 2
            ;;
        --dir)
            CLI_DIR="${2:-}"
            shift 2
            ;;
        -u|--uninstall)
            CLI_UNINSTALL=1
            shift
            ;;
        --keep-volumes)
            CLI_KEEP_VOLUMES=1
            shift
            ;;
        --purge)
            # Retained for explicit alias compatibility
            CLI_KEEP_VOLUMES=0
            shift
            ;;
        -y|--yes|-n|--non-interactive)
            NON_INTERACTIVE=1
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}[ERROR] Unknown option: $1${NC}"
            echo "Run './setup.sh --help' for available options."
            exit 1
            ;;
    esac
done

INSTALL_DIR="${CLI_DIR:-${INSTALL_DIR:-user-management-panel}}"
TARGET_VERSION="${CLI_VERSION:-${APP_VERSION:-}}"
GIVEN_PORT="${CLI_PORT:-${HTTP_PORT:-}}"
GIVEN_DOMAIN="${CLI_DOMAIN:-${DOMAIN:-}}"
GIVEN_DB_PASS="${CLI_DB_PASS:-${DB_PASSWORD:-}}"
GIVEN_DB_ROOT_PASS="${CLI_DB_ROOT_PASS:-${DB_ROOT_PASSWORD:-}}"
GIVEN_HTTPS_PORT="${CLI_HTTPS_PORT:-${HTTPS_PORT:-}}"
SKIP_HTTPS="${CLI_NO_HTTPS:-${NO_HTTPS:-0}}"

# Check if interactive terminal is available (suppressed if non-interactive mode requested)
IS_INTERACTIVE=0
if [ "$NON_INTERACTIVE" -eq 1 ] || [ "${CI:-}" = "true" ]; then
    IS_INTERACTIVE=0
elif [ -t 0 ]; then
    IS_INTERACTIVE=1
elif [ -r /dev/tty ]; then
    IS_INTERACTIVE=1
fi

# Helper function to read user input reliably, even when script is executed via `curl ... | bash`
prompt_user() {
    local prompt_msg="$1"
    local var_name="$2"
    local input_val=""

    if [ "$IS_INTERACTIVE" -eq 0 ]; then
        eval "$var_name=\"\""
        return 0
    fi

    if [ -r /dev/tty ]; then
        printf "%b" "$prompt_msg" >&2
        IFS= read -r input_val < /dev/tty || input_val=""
    elif [ -t 0 ]; then
        printf "%b" "$prompt_msg" >&2
        IFS= read -r input_val || input_val=""
    else
        input_val=""
    fi
    eval "$var_name=\"\$input_val\""
}

# Helper function to check if a port is in use
is_port_in_use() {
    local port="$1"
    # Try ss (modern Linux)
    if command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -E -q ":${port}\b"; then
            return 0
        fi
    # Try netstat (legacy Linux)
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -E -q ":${port}\b"; then
            return 0
        fi
    # Try lsof
    elif command -v lsof &> /dev/null; then
        if lsof -iTCP:"${port}" -sTCP:LISTEN -P -n &> /dev/null; then
            return 0
        fi
    fi

    # Fallback using bash socket test
    if (echo > /dev/tcp/127.0.0.1/"${port}") 2>/dev/null; then
        return 0
    fi

    return 1
}

# ------------------------------------------------------------------------------
# Uninstallation and Cleanup Handler
# ------------------------------------------------------------------------------
do_uninstall() {
    echo -e "${YELLOW}====================================================================${NC}"
    echo -e "${YELLOW}   PLAYLISTLABS USER MANAGEMENT - UNINSTALL & CLEANUP UTILITY      ${NC}"
    echo -e "${YELLOW}====================================================================${NC}"
    echo ""

    if [ ! -f docker-compose.yml ] && [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
        cd "$INSTALL_DIR"
    fi

    if [ ! -f docker-compose.yml ]; then
        echo -e "${RED}[ERROR] No docker-compose.yml found in current directory or in '${INSTALL_DIR}'.${NC}"
        echo "Nothing to uninstall."
        exit 1
    fi

    # Interactive confirmation if not in non-interactive/unattended mode
    if [ "$IS_INTERACTIVE" -eq 1 ] && [ "$NON_INTERACTIVE" -eq 0 ]; then
        echo -e "${RED}${BOLD}WARNING: This will completely stop all containers and permanently delete${NC}"
        echo -e "${RED}${BOLD}all database volumes, secrets, downloaded images, and configuration.${NC}"
        prompt_user "Are you sure you want to completely uninstall and wipe all data? [y/N]: " CONFIRM_UNINSTALL
        if ! [[ "$CONFIRM_UNINSTALL" =~ ^[yY] ]]; then
            echo "Uninstallation cancelled."
            exit 0
        fi
    fi

    echo ""
    if [ "$CLI_KEEP_VOLUMES" -eq 1 ]; then
        echo -e "${YELLOW}[1/1] Stopping and removing stack containers (preserving volumes & secrets)...${NC}"
        docker compose down --remove-orphans 2>/dev/null || true

        echo ""
        echo -e "${GREEN}====================================================================${NC}"
        echo -e "${GREEN}  ✓ UNINSTALLATION COMPLETED!                                       ${NC}"
        echo -e "${GREEN}  Containers stopped and removed. Database data & secrets preserved.${NC}"
        echo -e "${GREEN}  To restart: docker compose up -d                                  ${NC}"
        echo -e "${GREEN}====================================================================${NC}"
    else
        echo -e "${YELLOW}[1/3] Stopping containers and deleting persistent Docker volumes...${NC}"
        docker compose down -v --remove-orphans 2>/dev/null || true

        echo -e "${YELLOW}[2/3] Removing downloaded application images...${NC}"
        docker images --filter=reference='ghcr.io/lkinderbueno/user-management-*' -q | xargs -r docker rmi -f 2>/dev/null || true

        echo -e "${YELLOW}[3/3] Cleaning up local secrets, configuration files, and data directories...${NC}"
        rm -rf secrets data backups sql deploy .env .env.bak docker-compose.yml .env.example reset-password.sh reset_password uninstall.sh install.sh 2>/dev/null || true

        echo ""
        echo -e "${GREEN}====================================================================${NC}"
        echo -e "${GREEN}  ✓ UNINSTALLATION & COMPLETE CLEANUP COMPLETED!                    ${NC}"
        echo -e "${GREEN}  All containers, database volumes, secrets, images and data purged.${NC}"
        echo -e "${GREEN}====================================================================${NC}"
    fi

    exit 0
}

if [ "$CLI_UNINSTALL" -eq 1 ]; then
    do_uninstall
fi

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}      PLAYLISTLABS USER MANAGEMENT - SETUP & UPGRADE UTILITY       ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""

# 1. Check prerequisites
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[!] Docker is not installed. Installing Docker automatically...${NC}"
    if command -v curl &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
    elif command -v wget &> /dev/null; then
        wget -qO- https://get.docker.com | sh
    else
        echo -e "${RED}[ERROR] Neither curl nor wget is installed. Please install Docker first:${NC}"
        echo "  curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose v2 is required but not found. Please ensure Docker Compose plugin is installed.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/5] Docker and Docker Compose ready.${NC}"

# 2. Setup directory
if [ -f docker-compose.yml ] || [ -f .env ]; then
    echo -e "${GREEN}[2/5] Current directory already contains project configuration. Using current directory.${NC}"
else
    echo -e "${YELLOW}[2/5] Setting up directory: ${INSTALL_DIR}...${NC}"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Detect if this is an upgrade of an existing installation
IS_UPGRADE=0
CURRENT_VERSION="latest"
CURRENT_DOMAIN="localhost"
CURRENT_PORT="80"

if [ -f .env ] && [ -f docker-compose.yml ] && [ -f secrets/db_password.txt ]; then
    IS_UPGRADE=1
    CURRENT_VERSION=$(grep "^APP_VERSION=" .env 2>/dev/null | cut -d'=' -f2 || echo "latest")
    CURRENT_DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | cut -d'=' -f2 || echo "localhost")
    CURRENT_PORT=$(grep "^HTTP_PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "80")

    echo -e "${GREEN}  ✓ Existing installation detected (UPGRADE MODE).${NC}"
    echo -e "    - Current version: ${CYAN}${CURRENT_VERSION}${NC}"
    echo -e "    - Domain:          ${CYAN}${CURRENT_DOMAIN}${NC}"
    echo -e "    - Port:            ${CYAN}${CURRENT_PORT}${NC}"
    echo ""
fi

# 3. Download updated stack configuration
echo -e "${YELLOW}[3/5] Updating stack configuration and definitions...${NC}"
curl -fsSL "${REPO_RAW_URL}/docker-compose.yml" -o docker-compose.yml
curl -fsSL "${REPO_RAW_URL}/.env.example" -o .env.example

# Download SQL schema files for MariaDB init (new installs or reference)
mkdir -p sql
curl -fsSL "${REPO_RAW_URL}/sql/001_init_schema.sql" -o sql/001_init_schema.sql

# Download Caddy config
mkdir -p deploy/caddy
curl -fsSL "${REPO_RAW_URL}/deploy/caddy/Caddyfile" -o deploy/caddy/Caddyfile
curl -fsSL "${REPO_RAW_URL}/deploy/caddy/1x1.png" -o deploy/caddy/1x1.png

# Download helper scripts
curl -fsSL "${REPO_RAW_URL}/reset-password.sh" -o reset-password.sh && chmod +x reset-password.sh || true
curl -fsSL "${REPO_RAW_URL}/uninstall.sh" -o uninstall.sh && chmod +x uninstall.sh || true
ln -sf reset-password.sh reset_password 2>/dev/null || cp reset-password.sh reset_password 2>/dev/null || true

# 4. Check & Configure Secrets, Port and Version
echo -e "${YELLOW}[4/5] Configuration & Security Setup...${NC}"
mkdir -p secrets backups data/epg
chown -R 1000:1000 backups data 2>/dev/null || true
chmod -R 775 backups data 2>/dev/null || true

# Generate strong random JWT secret automatically if missing
if [ ! -f secrets/jwt_secret.txt ]; then
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32 > secrets/jwt_secret.txt
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 48 | head -n 1 > secrets/jwt_secret.txt
    fi
    echo -e "${GREEN}  ✓ Generated secure random JWT secret.${NC}"
else
    echo -e "${GREEN}  ✓ Existing JWT secret preserved.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 4A: Database Credentials (MariaDB)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- [1/3] MariaDB Database Credentials ---${NC}"

# Case 1: Provided via CLI flag or Environment Variable
if [ -n "$GIVEN_DB_PASS" ]; then
    echo "$GIVEN_DB_PASS" > secrets/db_password.txt
    echo -e "  ${GREEN}✓ MariaDB user password set from argument/env.${NC}"
fi

if [ -n "$GIVEN_DB_ROOT_PASS" ]; then
    echo "$GIVEN_DB_ROOT_PASS" > secrets/db_root_password.txt
    echo -e "  ${GREEN}✓ MariaDB root password set from argument/env.${NC}"
fi

# Case 2: Upgrading an existing install (preserve if not explicitly provided)
if [ "$IS_UPGRADE" -eq 1 ] && [ -f secrets/db_password.txt ]; then
    if [ -z "$GIVEN_DB_PASS" ]; then
        echo -e "  ${GREEN}✓ Existing database credentials preserved in secrets/db_password.txt${NC}"
        if [ "$IS_INTERACTIVE" -eq 1 ]; then
            prompt_user "Do you want to change the database passwords? [y/N]: " CHANGE_DB_PASS
            if [[ "$CHANGE_DB_PASS" =~ ^[yY] ]]; then
                prompt_user "Enter new password for MariaDB user 'playlistlabs': " USER_DB_PASS
                if [ -n "$USER_DB_PASS" ]; then
                    echo "$USER_DB_PASS" > secrets/db_password.txt
                    echo -e "  ${GREEN}✓ Updated secrets/db_password.txt${NC}"
                fi
                prompt_user "Enter new MariaDB ROOT password: " USER_ROOT_PASS
                if [ -n "$USER_ROOT_PASS" ]; then
                    echo "$USER_ROOT_PASS" > secrets/db_root_password.txt
                    echo -e "  ${GREEN}✓ Updated secrets/db_root_password.txt${NC}"
                fi
            fi
        fi
    fi
# Case 3: Fresh Install
elif [ ! -f secrets/db_password.txt ] || [ ! -f secrets/db_root_password.txt ]; then
    if [ "$IS_INTERACTIVE" -eq 1 ]; then
        echo -e "You can specify your own password or press [Enter] to generate a secure random one."
        if [ ! -f secrets/db_password.txt ]; then
            prompt_user "Enter password for MariaDB user 'playlistlabs' [press Enter for auto-generated]: " USER_DB_PASS
            if [ -n "$USER_DB_PASS" ]; then
                echo "$USER_DB_PASS" > secrets/db_password.txt
                echo -e "  ${GREEN}✓ Database user password set.${NC}"
            else
                DEFAULT_DB_PASS=$(openssl rand -base64 18 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
                echo "$DEFAULT_DB_PASS" > secrets/db_password.txt
                echo -e "  ${GREEN}✓ Generated secure database password:${NC} ${CYAN}${DEFAULT_DB_PASS}${NC}"
            fi
        fi

        if [ ! -f secrets/db_root_password.txt ]; then
            prompt_user "Enter MariaDB ROOT password [press Enter for auto-generated]: " USER_ROOT_PASS
            if [ -n "$USER_ROOT_PASS" ]; then
                echo "$USER_ROOT_PASS" > secrets/db_root_password.txt
                echo -e "  ${GREEN}✓ Database ROOT password set.${NC}"
            else
                DEFAULT_ROOT_PASS=$(openssl rand -base64 18 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
                echo "$DEFAULT_ROOT_PASS" > secrets/db_root_password.txt
                echo -e "  ${GREEN}✓ Generated secure root password:${NC} ${CYAN}${DEFAULT_ROOT_PASS}${NC}"
            fi
        fi
    else
        # Non-interactive / unattended fallback
        if [ ! -f secrets/db_password.txt ]; then
            DEFAULT_DB_PASS=$(openssl rand -base64 18 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
            echo "$DEFAULT_DB_PASS" > secrets/db_password.txt
            echo -e "  ${GREEN}✓ Generated secure database user password in secrets/db_password.txt${NC}"
        fi
        if [ ! -f secrets/db_root_password.txt ]; then
            DEFAULT_ROOT_PASS=$(openssl rand -base64 18 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)
            echo "$DEFAULT_ROOT_PASS" > secrets/db_root_password.txt
            echo -e "  ${GREEN}✓ Generated secure root password in secrets/db_root_password.txt${NC}"
        fi
    fi
fi
chmod 644 secrets/*.txt 2>/dev/null || true

# Check & Configure .env
if [ ! -f .env ]; then
    cp .env.example .env
fi

# ------------------------------------------------------------------------------
# STEP 4B: Network & Ingress (Gateway)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- [2/3] Network & Port Configuration (Gateway) ---${NC}"

FINAL_PORT=""
FINAL_DOMAIN=""

# Case 1: Port given via CLI argument or environment
if [ -n "$GIVEN_PORT" ]; then
    if ! [[ "$GIVEN_PORT" =~ ^[0-9]+$ ]] || [ "$GIVEN_PORT" -lt 1 ] || [ "$GIVEN_PORT" -gt 65535 ]; then
        echo -e "  ${RED}[!] Invalid port '$GIVEN_PORT' provided. Must be between 1 and 65535.${NC}"
        exit 1
    fi
    if [ "$IS_UPGRADE" -eq 1 ] && [ "$GIVEN_PORT" = "$CURRENT_PORT" ]; then
        FINAL_PORT="$GIVEN_PORT"
    elif is_port_in_use "$GIVEN_PORT"; then
        if [ "$IS_INTERACTIVE" -eq 0 ]; then
            echo -e "  ${RED}[ERROR] Specified port $GIVEN_PORT is already in use by another process.${NC}"
            exit 1
        else
            echo -e "  ${RED}[!] Port $GIVEN_PORT is ALREADY IN USE.${NC}"
        fi
    else
        FINAL_PORT="$GIVEN_PORT"
        echo -e "  ${GREEN}✓ Port configured from argument: ${CYAN}${FINAL_PORT}${NC}"
    fi
fi

# Case 2: Domain given via CLI argument or environment
if [ -n "$GIVEN_DOMAIN" ]; then
    FINAL_DOMAIN="$GIVEN_DOMAIN"
    echo -e "  ${GREEN}✓ Domain configured from argument: ${CYAN}${FINAL_DOMAIN}${NC}"
fi

# Prompt or determine port if not yet resolved
if [ -z "$FINAL_PORT" ]; then
    if [ "$IS_UPGRADE" -eq 1 ]; then
        if [ "$IS_INTERACTIVE" -eq 1 ]; then
            prompt_user "Keep existing port (${CURRENT_PORT})? [Y/n]: " KEEP_PORT
            if [[ "$KEEP_PORT" =~ ^[nN] ]]; then
                while true; do
                    prompt_user "Enter new HTTP port: " USER_HTTP_PORT
                    CHOSEN_PORT="${USER_HTTP_PORT:-80}"
                    if ! [[ "$CHOSEN_PORT" =~ ^[0-9]+$ ]] || [ "$CHOSEN_PORT" -lt 1 ] || [ "$CHOSEN_PORT" -gt 65535 ]; then
                        echo -e "  ${RED}[!] Invalid port. Enter a number 1-65535.${NC}"
                        continue
                    fi
                    if is_port_in_use "$CHOSEN_PORT"; then
                        echo -e "  ${RED}[!] Port $CHOSEN_PORT is in use. Choose another.${NC}"
                        continue
                    fi
                    FINAL_PORT="$CHOSEN_PORT"
                    break
                done
            else
                FINAL_PORT="$CURRENT_PORT"
            fi
        else
            FINAL_PORT="$CURRENT_PORT"
        fi
    else
        if [ "$IS_INTERACTIVE" -eq 1 ]; then
            while true; do
                prompt_user "Enter HTTP port [press Enter for 80]: " USER_HTTP_PORT
                CHOSEN_PORT="${USER_HTTP_PORT:-80}"
                if ! [[ "$CHOSEN_PORT" =~ ^[0-9]+$ ]] || [ "$CHOSEN_PORT" -lt 1 ] || [ "$CHOSEN_PORT" -gt 65535 ]; then
                    echo -e "  ${RED}[!] Invalid port '$CHOSEN_PORT'. Enter a number 1-65535.${NC}"
                    continue
                fi
                if is_port_in_use "$CHOSEN_PORT"; then
                    echo -e "  ${RED}[!] Port $CHOSEN_PORT is ALREADY IN USE by another process on this server.${NC}"
                    echo -e "  ${YELLOW}Please choose an available port (e.g. 8080, 8000, 8888, 8088):${NC}"
                    continue
                fi
                FINAL_PORT="$CHOSEN_PORT"
                echo -e "  ${GREEN}✓ Port $FINAL_PORT is available and ready.${NC}"
                break
            done
        else
            # Unattended fresh install
            FINAL_PORT="80"
            if is_port_in_use "$FINAL_PORT"; then
                echo -e "  ${YELLOW}[!] Port 80 in use, falling back to 8080...${NC}"
                FINAL_PORT="8080"
            fi
        fi
    fi
fi

# Detect public/server IP (useful for ingress routing and display)
SERVER_IP=""
if command -v curl &> /dev/null; then
    SERVER_IP=$(curl -s4 -m 2 https://api.ipify.org 2>/dev/null || curl -s4 -m 2 https://ifconfig.me 2>/dev/null || echo "")
fi
if [ -z "$SERVER_IP" ] && command -v hostname &> /dev/null; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

# Determine domain without prompting:
# Keep existing domain on upgrade, default to localhost on new install
if [ -z "$FINAL_DOMAIN" ]; then
    if [ "$IS_UPGRADE" -eq 1 ]; then
        FINAL_DOMAIN="$CURRENT_DOMAIN"
    else
        FINAL_DOMAIN="localhost"
    fi
fi

if [ "$FINAL_DOMAIN" = "localhost" ] && [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "  Active Ingress: ${CYAN}http://localhost:${FINAL_PORT}${NC} or ${CYAN}http://${SERVER_IP}:${FINAL_PORT}${NC}"
else
    echo -e "  Active Ingress: ${CYAN}http://${FINAL_DOMAIN}:${FINAL_PORT}${NC}"
fi

# Write to .env
if grep -q "^HTTP_PORT=" .env; then
    sed -i.bak "s/^HTTP_PORT=.*/HTTP_PORT=${FINAL_PORT}/" .env && rm -f .env.bak
else
    echo "HTTP_PORT=${FINAL_PORT}" >> .env
fi

if grep -q "^DOMAIN=" .env; then
    sed -i.bak "s/^DOMAIN=.*/DOMAIN=${FINAL_DOMAIN}/" .env && rm -f .env.bak
else
    echo "DOMAIN=${FINAL_DOMAIN}" >> .env
fi

# ------------------------------------------------------------------------------
# HTTPS Port Availability Detection & Configuration
# ------------------------------------------------------------------------------
HTTPS_ENABLED=1
HTTPS_PORT_TARGET="${GIVEN_HTTPS_PORT:-443}"

if [ "$SKIP_HTTPS" -eq 1 ] || [ "$SKIP_HTTPS" = "true" ]; then
    HTTPS_ENABLED=0
    echo -e "  ${YELLOW}[!] HTTPS binding explicitly disabled via flag/environment.${NC}"
else
    # Check if target HTTPS port is already in use by our own Caddy container on upgrade
    IS_OUR_CADDY_ON_HTTPS=0
    if command -v docker &> /dev/null; then
        if docker ps --filter "name=playlistlabs-caddy" --format "{{.Ports}}" 2>/dev/null | grep -E -q ":${HTTPS_PORT_TARGET}->"; then
            IS_OUR_CADDY_ON_HTTPS=1
        fi
    fi

    # Check if the port is in use by another process
    if is_port_in_use "$HTTPS_PORT_TARGET" && [ "$IS_OUR_CADDY_ON_HTTPS" -eq 0 ]; then
        HTTPS_ENABLED=0
        echo ""
        echo -e "  ${YELLOW}┌────────────────────────────────────────────────────────────────────────┐${NC}"
        echo -e "  ${YELLOW}│ [WARNING] PORT ${HTTPS_PORT_TARGET} (HTTPS) IS ALREADY IN USE BY ANOTHER PROCESS!     │${NC}"
        echo -e "  ${YELLOW}├────────────────────────────────────────────────────────────────────────┤${NC}"
        echo -e "  ${YELLOW}│ Port ${HTTPS_PORT_TARGET} is occupied by another service on this server                │${NC}"
        echo -e "  ${YELLOW}│ (such as Nginx, Apache, or another reverse proxy).                     │${NC}"
        echo -e "  ${YELLOW}│                                                                        │${NC}"
        echo -e "  ${YELLOW}│ -> Skipping HTTPS port ${HTTPS_PORT_TARGET} binding to prevent startup failure.        │${NC}"
        echo -e "  ${YELLOW}│ -> The stack will start and operate normally on HTTP port ${FINAL_PORT}.        │${NC}"
        echo -e "  ${YELLOW}│                                                                        │${NC}"
        echo -e "  ${YELLOW}│ Note: Automatic Let's Encrypt certificates on port 443 will not be     │${NC}"
        echo -e "  ${YELLOW}│ exposed directly. You can route traffic via an upstream reverse proxy. │${NC}"
        echo -e "  ${YELLOW}└────────────────────────────────────────────────────────────────────────┘${NC}"
        echo ""
    else
        echo -e "  ${GREEN}✓ Port ${HTTPS_PORT_TARGET} (HTTPS) is available and enabled.${NC}"
    fi
fi

# Apply port binding to docker-compose.yml
if [ -f docker-compose.yml ]; then
    if [ "$HTTPS_ENABLED" -eq 0 ]; then
        # Comment out the 443 port binding line so Docker Compose does not attempt to bind it
        sed -i.bak -E '/:443/s/^[[:space:]]*-/      # -/' docker-compose.yml 2>/dev/null && rm -f docker-compose.yml.bak 2>/dev/null || true
    else
        # Ensure 443 port binding line is uncommented and enabled
        sed -i.bak -E '/:443/s/^[[:space:]]*#[[:space:]]*-/      -/' docker-compose.yml 2>/dev/null && rm -f docker-compose.yml.bak 2>/dev/null || true
    fi
fi

# Update HTTPS_PORT in .env
if [ "$HTTPS_ENABLED" -eq 0 ]; then
    if grep -q "^HTTPS_PORT=" .env; then
        sed -i.bak "s/^HTTPS_PORT=.*/# HTTPS_PORT=443 (disabled: port occupied by another process)/" .env && rm -f .env.bak
    fi
else
    if grep -q "^# *HTTPS_PORT=" .env; then
        sed -i.bak "s/^# *HTTPS_PORT=.*/HTTPS_PORT=${HTTPS_PORT_TARGET}/" .env && rm -f .env.bak
    elif grep -q "^HTTPS_PORT=" .env; then
        sed -i.bak "s/^HTTPS_PORT=.*/HTTPS_PORT=${HTTPS_PORT_TARGET}/" .env && rm -f .env.bak
    else
        echo "HTTPS_PORT=${HTTPS_PORT_TARGET}" >> .env
    fi
fi

# ------------------------------------------------------------------------------
# STEP 4C: Application Version
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}--- [3/3] Application Version ---${NC}"
if [ -z "$TARGET_VERSION" ]; then
    if [ "$IS_INTERACTIVE" -eq 1 ]; then
        if [ "$IS_UPGRADE" -eq 1 ]; then
            prompt_user "Enter version/tag to upgrade to [press Enter for '${CURRENT_VERSION}']: " INPUT_VER
            TARGET_VERSION="${INPUT_VER:-$CURRENT_VERSION}"
        else
            prompt_user "Enter version/tag to deploy [press Enter for 'latest']: " INPUT_VER
            TARGET_VERSION="${INPUT_VER:-latest}"
        fi
    else
        if [ "$IS_UPGRADE" -eq 1 ]; then
            TARGET_VERSION="$CURRENT_VERSION"
        else
            TARGET_VERSION="latest"
        fi
    fi
fi
echo -e "  Target version: ${CYAN}${TARGET_VERSION}${NC}"

if grep -q "^APP_VERSION=" .env; then
    sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=${TARGET_VERSION}/" .env && rm -f .env.bak
else
    echo "APP_VERSION=${TARGET_VERSION}" >> .env
fi

# 5. Check Image Digests / Hashes and Start Containers
echo ""
echo -e "${YELLOW}[5/5] Checking image hashes (version: ${TARGET_VERSION}) and updating services...${NC}"
export APP_VERSION="${TARGET_VERSION}"

SERVICES=("dashboard" "xtream" "redirector" "syncer")
OLD_HASHES=()
IMAGES=()

for svc in "${SERVICES[@]}"; do
    img="ghcr.io/lkinderbueno/user-management-${svc}:${TARGET_VERSION}"
    IMAGES+=("$img")
    cur_id=$(docker image inspect --format '{{.Id}}' "$img" 2>/dev/null || echo "none")
    OLD_HASHES+=("$cur_id")
done

echo -e "  Verifying remote digests on GitHub Container Registry (GHCR)..."
docker compose pull

echo ""
echo -e "${BOLD}Image Version & Hash Verification:${NC}"
for i in "${!SERVICES[@]}"; do
    svc="${SERVICES[$i]}"
    img="${IMAGES[$i]}"
    old_id="${OLD_HASHES[$i]}"
    new_id=$(docker image inspect --format '{{.Id}}' "$img" 2>/dev/null || echo "unknown")

    short_old="${old_id#sha256:}"
    short_old="${short_old:0:12}"
    short_new="${new_id#sha256:}"
    short_new="${short_new:0:12}"

    if [ "$old_id" = "none" ]; then
        echo -e "  ${GREEN}✓ ${svc}:${NC} Downloaded image (hash: ${CYAN}${short_new}${NC})"
    elif [ "$old_id" != "$new_id" ]; then
        echo -e "  ${GREEN}✓ ${svc}:${NC} New digest detected on registry! Updated (${YELLOW}${short_old}${NC} -> ${GREEN}${short_new}${NC})"
    else
        echo -e "  ${CYAN}✓ ${svc}:${NC} Up to date (hash: ${CYAN}${short_new}${NC}, remote matches local)"
    fi
done

echo ""
echo -e "  Configuring directory permissions for non-root containers (UID 1000)..."
mkdir -p backups data/epg
chown -R 1000:1000 backups data 2>/dev/null || true
chmod -R 775 backups data 2>/dev/null || true
chmod 644 secrets/*.txt 2>/dev/null || true

echo -e "  Launching services..."
docker compose up -d

# Read effective port & domain from .env
EFFECTIVE_PORT=$(grep "^HTTP_PORT=" .env | cut -d'=' -f2 || echo "80")
EFFECTIVE_DOMAIN=$(grep "^DOMAIN=" .env | cut -d'=' -f2 || echo "localhost")
PORT_SUFFIX=""
if [ "$EFFECTIVE_PORT" != "80" ] && [ -n "$EFFECTIVE_PORT" ]; then
    PORT_SUFFIX=":${EFFECTIVE_PORT}"
fi

echo ""
echo -e "${GREEN}====================================================================${NC}"
if [ "$IS_UPGRADE" -eq 1 ]; then
    echo -e "${GREEN}  ✓ UPGRADE COMPLETED SUCCESSFULLY!                                 ${NC}"
else
    echo -e "${GREEN}  ✓ INSTALLATION COMPLETED SUCCESSFULLY!                            ${NC}"
fi
echo -e "${GREEN}====================================================================${NC}"
echo ""
echo -e "Access your Management Dashboard & API Gateway:"
if [ "$EFFECTIVE_DOMAIN" != "localhost" ]; then
    if [ "$HTTPS_ENABLED" -eq 1 ]; then
        echo -e "  - Domain: ${CYAN}https://${EFFECTIVE_DOMAIN}${PORT_SUFFIX}${NC} (or http://${EFFECTIVE_DOMAIN}${PORT_SUFFIX})"
    else
        echo -e "  - Domain: ${CYAN}http://${EFFECTIVE_DOMAIN}${PORT_SUFFIX}${NC}"
    fi
fi
echo -e "  - Local:  ${CYAN}http://localhost${PORT_SUFFIX}${NC}"
if [ -n "$SERVER_IP" ] && [ "$SERVER_IP" != "127.0.0.1" ]; then
    echo -e "  - Server: ${CYAN}http://${SERVER_IP}${PORT_SUFFIX}${NC}"
else
    echo -e "  - Server: ${CYAN}http://<your-server-ip>${PORT_SUFFIX}${NC}"
fi

if [ "$HTTPS_ENABLED" -eq 0 ]; then
    echo ""
    echo -e "  ${YELLOW}[!] Notice: HTTPS port 443 binding was skipped because port 443 was occupied.${NC}"
    echo -e "  ${YELLOW}    The panel is operating on HTTP. To enable direct SSL, free port 443${NC}"
    echo -e "  ${YELLOW}    or route traffic through an existing reverse proxy (e.g. Nginx).${NC}"
fi
echo ""
echo -e "Version active: ${CYAN}${TARGET_VERSION}${NC}"
echo -e "Database credentials location:"
echo -e "  - ${YELLOW}secrets/db_password.txt${NC}"
echo -e "  - ${YELLOW}secrets/db_root_password.txt${NC}"
echo -e "  - ${YELLOW}secrets/jwt_secret.txt${NC}"
echo ""
if [ "$IS_UPGRADE" -eq 0 ]; then
    echo -e "Initial Setup:"
    echo -e "  Open the dashboard in your browser to complete the initial setup wizard"
    echo -e "  (create master admin, enter PlaylistLabs token, and configure streaming)."
    echo ""
fi
echo -e "Stack commands:"
echo -e "  - Check status:    ${YELLOW}docker compose ps${NC}"
echo -e "  - View logs:       ${YELLOW}docker compose logs -f${NC}"
echo -e "  - Reset password:  ${YELLOW}./reset-password.sh${NC} (or ${YELLOW}./reset_password${NC})"
echo -e "  - Stop stack:      ${YELLOW}docker compose down${NC}"
echo -e "  - Update images:   ${YELLOW}docker compose pull && docker compose up -d${NC}"
echo -e "  - Uninstall stack: ${YELLOW}./uninstall.sh${NC}"
echo ""
