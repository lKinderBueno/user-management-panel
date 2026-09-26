#!/usr/bin/env bash
# ==============================================================================
# PlaylistLabs User Management - Uninstaller & Cleanup Utility
#
# Usage:
#   ./uninstall.sh            # Complete uninstallation & cleanup (interactive confirmation)
#   ./uninstall.sh -y         # Unattended full wipe (deletes containers, volumes, secrets)
#   ./uninstall.sh --keep-volumes  # Uninstall containers only (preserve volumes & secrets)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

if [ -f "$SCRIPT_DIR/setup.sh" ]; then
    exec "$SCRIPT_DIR/setup.sh" --uninstall "$@"
else
    curl -fsSL https://ump.playlistlabs.io/setup.sh | bash -s -- --uninstall "$@"
fi
