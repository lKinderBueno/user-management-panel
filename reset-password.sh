#!/usr/bin/env bash
# ==============================================================================
# PlaylistLabs - Universal Password Reset & Account Recovery Tool
# Supports:
#   - Direct in-container execution (Docker Compose / Docker)
#   - Fallback MariaDB execution (even if reset_password binary is missing in container)
#   - Local Go environment
# ==============================================================================

set -eo pipefail

# Change directory to project root (where docker-compose.yml and secrets/ live)
cd "$(dirname "$0")"

show_help() {
    cat << 'EOF'
===================================================================
 PlaylistLabs - Password Reset & Generator CLI
===================================================================
Usage:
  ./reset-password.sh [options] [username]
  ./reset_password [options] [username]
  docker compose exec dashboard reset_password [options] [username]

Options:
  -u, -user, --user <string>      Username of the account to reset (default: "admin")
  -p, -password, --password <str> Explicit password to set (if omitted, a secure one is generated)
  -reset-host-restrictions        Clear admin hostname and disable host restrictions
  -h, -help, --help               Show this help message

Examples:
  # Generate a new random password for user "admin"
  ./reset-password.sh

  # Set an explicit password for admin
  ./reset-password.sh -u admin -p "SecretPassword123!"

  # Reset domain & hostname restrictions
  ./reset-password.sh -reset-host-restrictions
===================================================================
EOF
    exit 0
}

# ------------------------------------------------------------------------------
# 1. Parse Arguments
# ------------------------------------------------------------------------------
TARGET_USER=""
NEW_PASS=""
RESET_HOST_RESTRICTIONS=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        -u|-user|--user)
            TARGET_USER="${2:-}"
            shift 2
            ;;
        -p|-password|--password)
            NEW_PASS="${2:-}"
            shift 2
            ;;
        -reset-host-restrictions|--reset-host-restrictions)
            RESET_HOST_RESTRICTIONS=1
            shift
            ;;
        -h|-help|--help)
            show_help
            ;;
        *)
            if [ -z "$TARGET_USER" ] && [[ ! "$1" =~ ^- ]]; then
                TARGET_USER="$1"
            fi
            shift
            ;;
    esac
done

if [ -z "$TARGET_USER" ]; then
    TARGET_USER="admin"
fi

# ------------------------------------------------------------------------------
# 2. Check for running Docker containers
# ------------------------------------------------------------------------------
CONTAINER_NAME=""
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^playlistlabs-dashboard$"; then
    CONTAINER_NAME="playlistlabs-dashboard"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^playlistlabs-server$"; then
    CONTAINER_NAME="playlistlabs-server"
fi

# 2A. If container has reset_password binary inside, use it directly!
if [ -n "$CONTAINER_NAME" ]; then
    if docker exec "$CONTAINER_NAME" which reset_password >/dev/null 2>&1 || docker exec "$CONTAINER_NAME" test -f /usr/local/bin/reset_password 2>/dev/null; then
        ARGS=("-u" "$TARGET_USER")
        if [ -n "$NEW_PASS" ]; then
            ARGS+=("-p" "$NEW_PASS")
        fi
        if [ "$RESET_HOST_RESTRICTIONS" -eq 1 ]; then
            ARGS+=("-reset-host-restrictions")
        fi
        exec docker exec -it "$CONTAINER_NAME" reset_password "${ARGS[@]}"
    fi
fi

# ------------------------------------------------------------------------------
# 2B. Fallback: Directly update MariaDB via playlistlabs-mariadb container
# (Used when running in Docker but reset_password binary is not in the image)
# ------------------------------------------------------------------------------
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^playlistlabs-mariadb$"; then
    echo "[INFO] Running password recovery via MariaDB container..."

    DB_ROOT_PASS=""
    if [ -f secrets/db_root_password.txt ]; then
        DB_ROOT_PASS="$(cat secrets/db_root_password.txt | tr -d '\r\n')"
    fi
    DB_USER_PASS=""
    if [ -f secrets/db_password.txt ]; then
        DB_USER_PASS="$(cat secrets/db_password.txt | tr -d '\r\n')"
    fi

    # Determine MySQL connection arguments
    MYSQL_EXEC="mariadb"
    if ! docker exec playlistlabs-mariadb mariadb --version >/dev/null 2>&1; then
        MYSQL_EXEC="mysql"
    fi

    AUTH_ARGS=()
    if [ -n "$DB_ROOT_PASS" ]; then
        AUTH_ARGS=("-u" "root" "-p${DB_ROOT_PASS}")
    elif [ -n "$DB_USER_PASS" ]; then
        AUTH_ARGS=("-u" "playlistlabs" "-p${DB_USER_PASS}")
    fi

    IS_GENERATED=0
    if [ -z "$NEW_PASS" ]; then
        # Generate 16-char random password
        NEW_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*-_+=' < /dev/urandom | head -c 16)
        IS_GENERATED=1
    fi

    # Generate Bcrypt hash
    BCRYPT_HASH=""
    # 1. Try Caddy if running
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^playlistlabs-caddy$"; then
        BCRYPT_HASH=$(docker exec playlistlabs-caddy caddy hash-password --plaintext "$NEW_PASS" 2>/dev/null || true)
    fi

    # 2. Try tiny Alpine container with htpasswd -B
    if [ -z "$BCRYPT_HASH" ]; then
        BCRYPT_HASH=$(docker run --rm alpine sh -c "apk add --no-cache apache2-utils >/dev/null 2>&1 && htpasswd -bnBC 10 '' '$NEW_PASS' | cut -d: -f2" 2>/dev/null || true)
    fi

    # 3. Try Python3
    if [ -z "$BCRYPT_HASH" ] && command -v python3 >/dev/null 2>&1; then
        BCRYPT_HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw('$NEW_PASS'.encode(), bcrypt.gensalt()).decode())" 2>/dev/null || true)
    fi

    if [ -z "$BCRYPT_HASH" ]; then
        echo "[ERROR] Could not compute bcrypt hash. Please ensure Docker is running."
        exit 1
    fi

    # Execute SQL updates inside MariaDB
    SQL_SCRIPT="
    UPDATE admins SET password_hash = '${BCRYPT_HASH}', updated_at = NOW() WHERE username = '${TARGET_USER}';
    UPDATE security_ip_bans SET is_blocked = 0, failed_attempts = 0;
    DELETE FROM security_access_logs WHERE username = '${TARGET_USER}' AND success = 0;
    "

    if [ "$RESET_HOST_RESTRICTIONS" -eq 1 ]; then
        SQL_SCRIPT="${SQL_SCRIPT}
        UPDATE system_settings SET admin_hostname = NULL, block_streaming_on_admin_host = 1, restrict_admin_to_admin_host = 0, block_direct_ip_streaming = 0 WHERE id = 1;
        "
    fi

    # Check if admin user exists, or insert default admin if missing
    USER_COUNT=$(docker exec playlistlabs-mariadb "$MYSQL_EXEC" "${AUTH_ARGS[@]}" playlistlabs -N -e "SELECT COUNT(*) FROM admins WHERE username = '${TARGET_USER}';" 2>/dev/null || echo "0")

    if [ "$USER_COUNT" -eq 0 ] && [ "$TARGET_USER" = "admin" ]; then
        SQL_SCRIPT="
        INSERT INTO admins (username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins)
        VALUES ('admin', '${BCRYPT_HASH}', 'admin', 1, 1, 1, 1);
        UPDATE security_ip_bans SET is_blocked = 0, failed_attempts = 0;
        "
    fi

    docker exec -i playlistlabs-mariadb "$MYSQL_EXEC" "${AUTH_ARGS[@]}" playlistlabs -e "$SQL_SCRIPT" >/dev/null 2>&1

    echo ""
    echo "===================================================================="
    echo "       PLAYLISTLABS - PASSWORD RESET COMPLETED"
    echo "===================================================================="
    echo " Account Type:    ADMIN"
    echo " Username:        ${TARGET_USER}"
    if [ "$IS_GENERATED" -eq 1 ]; then
        printf " New Password:    \033[1;32m%s\033[0m  (Randomly generated)\n" "$NEW_PASS"
    else
        printf " New Password:    \033[1;32m%s\033[0m  (Manually provided)\n" "$NEW_PASS"
    fi
    echo " Anti-Brute-Force: Cleared failed attempts and unblocked all IPs"
    if [ "$RESET_HOST_RESTRICTIONS" -eq 1 ]; then
        echo " Host Restriction: Admin hostname restrictions reset to defaults"
    fi
    echo "--------------------------------------------------------------------"
    echo " Access:          You can now log in immediately with these credentials."
    echo "===================================================================="
    echo ""
    exit 0
fi

# ------------------------------------------------------------------------------
# 3. Local Go Fallback (for bare-metal development)
# ------------------------------------------------------------------------------
if command -v go >/dev/null 2>&1 && [ -d "./cmd/reset_password" ]; then
    echo "[INFO] Running reset_password using local Go compiler..."
    ARGS=("-u" "$TARGET_USER")
    if [ -n "$NEW_PASS" ]; then
        ARGS+=("-p" "$NEW_PASS")
    fi
    if [ "$RESET_HOST_RESTRICTIONS" -eq 1 ]; then
        ARGS+=("-reset-host-restrictions")
    fi
    exec go run ./cmd/reset_password "${ARGS[@]}"
fi

echo "[ERROR] Could not find a running PlaylistLabs MariaDB container or local Go installation."
echo "Please make sure your Docker stack is running ('docker compose up -d')."
exit 1
