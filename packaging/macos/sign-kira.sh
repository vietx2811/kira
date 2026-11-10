#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="${1:-"$SCRIPT_DIR/KIRA.app"}"
IDENTITY="${KIRA_SIGN_IDENTITY:--}"
ENTITLEMENTS="$SCRIPT_DIR/KIRA-Safari-Extension.entitlements"
APPEX="$APP_PATH/Contents/PlugIns/KIRA Safari Extension.appex"

if [[ ! -d "$APP_PATH" || "$APP_PATH" != *.app ]]; then
  echo "Không tìm thấy ứng dụng: $APP_PATH" >&2
  echo "Cách dùng: ./sign-kira.sh /đường/dẫn/KIRA.app" >&2
  exit 1
fi

if [[ ! -f "$APP_PATH/Contents/Info.plist" ]]; then
  echo "Bundle ứng dụng không hợp lệ: $APP_PATH" >&2
  exit 1
fi

if [[ ! -d "$APPEX" || ! -f "$ENTITLEMENTS" ]]; then
  echo "Thiếu Safari Extension hoặc file entitlements đi kèm." >&2
  exit 1
fi

# Finder, browsers, and non-system volumes can attach resource-fork/Finder
# metadata that makes codesign reject otherwise valid nested executables.
# Clear those attributes before signing; optionally preserve quarantine only
# for workflows that explicitly need it.
if [[ "${KIRA_KEEP_QUARANTINE:-0}" == "1" ]]; then
  xattr -dr com.apple.FinderInfo "$APP_PATH" 2>/dev/null || true
  xattr -dr com.apple.ResourceFork "$APP_PATH" 2>/dev/null || true
else
  xattr -cr "$APP_PATH" 2>/dev/null || true
fi

VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "?")"

if [[ "$IDENTITY" == "-" ]]; then
  SIGN_ARGS=(--force --sign -)
  echo "Đang ký ad-hoc KIRA $VERSION cho máy hiện tại…"
else
  SIGN_ARGS=(--force --sign "$IDENTITY" --options runtime --timestamp)
  echo "Đang ký KIRA $VERSION bằng: $IDENTITY"
fi

# Inside-out: every nested Mach-O first (the helpers in Contents/MacOS and the
# Safari extension's own binary), then the extension bundle with its sandbox
# entitlements, then the app itself last so its seal covers the signed parts.
while IFS= read -r -d '' executable; do
  if file "$executable" | grep -q "Mach-O"; then
    echo "  ký $(basename "$executable")"
    codesign "${SIGN_ARGS[@]}" "$executable"
  fi
done < <(find "$APP_PATH/Contents" -type f -perm -111 -print0)

codesign "${SIGN_ARGS[@]}" --entitlements "$ENTITLEMENTS" "$APPEX"
codesign "${SIGN_ARGS[@]}" "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo
echo "Đã ký và xác minh thành công:"
echo "$APP_PATH"

if [[ "$IDENTITY" == "-" ]]; then
  echo "Chữ ký ad-hoc chỉ dành cho sử dụng trên máy này; không thay thế notarization."
else
  echo "Có thể tiếp tục notarize bằng notarytool nếu muốn phân phối rộng rãi."
fi
