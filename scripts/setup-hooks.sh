#!/usr/bin/env bash
# Aktiviert die versionierten Git-Hooks dieses Repos (gitleaks Secret-Scan).
# Einmalig nach dem Klonen ausführen:  bash scripts/setup-hooks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "✅ core.hooksPath = .githooks gesetzt. gitleaks-Pre-Commit-Hook ist aktiv."
echo "   Voraussetzung: gitleaks ist installiert (winget install --id Gitleaks.Gitleaks -e)."
