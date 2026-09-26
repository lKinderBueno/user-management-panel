#!/usr/bin/env bash
# ==============================================================================
# PlaylistLabs User Management - Installer Wrapper
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

if [ -f "$SCRIPT_DIR/setup.sh" ]; then
    exec "$SCRIPT_DIR/setup.sh" "$@"
else
    # Executed remotely via curl
    curl -fsSL https://ump.playlistlabs.io/setup.sh | bash -s -- "$@"
fi
