#!/bin/bash
# Assembles the distributable release zip from an already-built KIRA.app:
# KIRA.app + sign-kira.sh + entitlements + instructions, zipped exactly the
# way README's "download, extract, ./sign-kira.sh" flow expects. Run
# `pnpm release:mac` first to build and ad-hoc-sign KIRA.app.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/VERSION")"
APP_SRC="$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle/macos/KIRA.app"
STAGE_NAME="KIRA-${VERSION}-macos-arm64"
RELEASE_DIR="$REPO_ROOT/release"
STAGE_DIR="$RELEASE_DIR/$STAGE_NAME"

if [[ ! -d "$APP_SRC" ]]; then
  echo "Không tìm thấy $APP_SRC" >&2
  echo "Chạy 'pnpm release:mac' trước để build và ký KIRA.app." >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$APP_SRC" "$STAGE_DIR/KIRA.app"
cp "$SCRIPT_DIR/sign-kira.sh" "$STAGE_DIR/"
cp "$SCRIPT_DIR/KIRA-Safari-Extension.entitlements" "$STAGE_DIR/"
cp "$SCRIPT_DIR/HUONG-DAN.md" "$STAGE_DIR/"

ZIP_PATH="$RELEASE_DIR/${STAGE_NAME}.zip"
rm -f "$ZIP_PATH" "${ZIP_PATH}.sha256"
(cd "$RELEASE_DIR" && zip -r -X -q "${STAGE_NAME}.zip" "$STAGE_NAME")
rm -rf "$STAGE_DIR"

(cd "$RELEASE_DIR" && shasum -a 256 "${STAGE_NAME}.zip" > "${STAGE_NAME}.zip.sha256")

echo "Đã tạo: $ZIP_PATH"
du -h "$ZIP_PATH"
