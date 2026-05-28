#!/usr/bin/env bash
# Install the launchd plist. Idempotent.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/dev/orchestrator}"
LABEL="com.dmj.orchestrator"
SRC_PLIST="$(cd "$(dirname "$0")" && pwd)/${LABEL}.plist"
DEST_PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/Orchestrator"

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

# Rewrite paths to actual home
sed -e "s|/Users/dannyok/dev/orchestrator|${INSTALL_DIR}|g" \
    -e "s|/Users/dannyok/Library/Logs/Orchestrator|${LOG_DIR}|g" \
    "$SRC_PLIST" > "$DEST_PLIST"

launchctl unload "$DEST_PLIST" 2>/dev/null || true
launchctl load "$DEST_PLIST"

echo "Installed: $DEST_PLIST"
echo "Logs: $LOG_DIR"
echo
echo "Control commands:"
echo "  launchctl list | grep $LABEL          # is it running?"
echo "  launchctl unload $DEST_PLIST           # stop"
echo "  launchctl load   $DEST_PLIST           # start"
echo "  tail -f $LOG_DIR/orchestrator.log      # follow logs"
