#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"
ZIP_PATH="${REPO_ROOT}/next-token-please-itch.zip"

cd "${FRONTEND_DIR}"
bun install --frozen-lockfile
bun run build:itch

rm -f "${ZIP_PATH}"
cd dist-itch
zip -qr "${ZIP_PATH}" .

echo "Wrote ${ZIP_PATH}"
unzip -l "${ZIP_PATH}" | head -20
