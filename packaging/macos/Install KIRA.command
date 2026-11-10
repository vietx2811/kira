#!/bin/bash
# Bấm đúp file này trong Finder để cài KIRA:
#   1. Đóng KIRA nếu đang chạy.
#   2. Chép KIRA.app vào /Applications (bản cũ được chuyển vào Thùng rác).
#   3. Gỡ cờ quarantine và tự ký lại app cùng mọi thành phần bên trong:
#      4 helper native (OCR, Natural Language, Foundation Models, Codex) và
#      Safari Extension (kèm entitlements sandbox của nó).
#   4. Xác minh chữ ký, đăng ký Safari Extension với hệ thống, rồi mở KIRA.
#
# Biến môi trường cho người dùng nâng cao và để kiểm thử:
#   KIRA_INSTALL_DIR=<thư mục>   cài vào chỗ khác thay vì /Applications
#   KIRA_SIGN_IDENTITY=<tên>     ký bằng Developer ID thay vì ad-hoc
#   KIRA_NO_OPEN=1               không tự mở KIRA sau khi cài
#   KIRA_NO_REGISTER=1           không đăng ký app/Safari Extension (kiểm thử)

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_APP="$SCRIPT_DIR/KIRA.app"
INSTALL_DIR="${KIRA_INSTALL_DIR:-/Applications}"
TARGET_APP="$INSTALL_DIR/KIRA.app"
BUNDLE_ID="vxstudio.kira"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() {
  printf '\n\033[31mKhông cài được: %s\033[0m\n' "$*" >&2
  echo "Có thể đóng cửa sổ này."
  exit 1
}

say "Cài đặt KIRA"

[[ -d "$SOURCE_APP" ]] || fail "không thấy KIRA.app cạnh file này. Hãy giải nén cả bộ cài rồi bấm đúp lại."
[[ -x "$SCRIPT_DIR/sign-kira.sh" ]] || chmod +x "$SCRIPT_DIR/sign-kira.sh" 2>/dev/null || true
[[ -f "$SCRIPT_DIR/sign-kira.sh" ]] || fail "thiếu sign-kira.sh trong bộ cài."
[[ "$(uname -m)" == "arm64" ]] || fail "bản này dành cho Mac Apple Silicon (M1 trở lên)."

VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$SOURCE_APP/Contents/Info.plist" 2>/dev/null || echo "?")"
echo "Phiên bản: $VERSION"
echo "Cài vào:   $TARGET_APP"

# 1. Đóng KIRA đang chạy (theo bundle id, không theo tên tiến trình).
if pgrep -f "$TARGET_APP/Contents/MacOS/kira-desktop" >/dev/null 2>&1; then
  say "Đang đóng KIRA…"
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -f "$TARGET_APP/Contents/MacOS/kira-desktop" >/dev/null 2>&1 || break
    sleep 0.5
  done
  if pgrep -f "$TARGET_APP/Contents/MacOS/kira-desktop" >/dev/null 2>&1; then
    fail "KIRA vẫn đang chạy. Hãy lưu công việc, thoát KIRA (Cmd+Q) rồi bấm đúp lại file này."
  fi
fi

# Ghi vào /Applications thường không cần mật khẩu với tài khoản admin; nếu
# cần thì hỏi một lần qua sudo.
SUDO=()
mkdir -p "$INSTALL_DIR" 2>/dev/null || true
if [[ ! -w "$INSTALL_DIR" ]]; then
  say "Cần quyền quản trị để ghi vào $INSTALL_DIR. Nhập mật khẩu máy Mac nếu được hỏi."
  SUDO=(sudo)
fi

# 2. Bản cũ vào Thùng rác (khôi phục được), rồi chép bản mới.
if [[ -e "$TARGET_APP" ]]; then
  say "Chuyển bản KIRA cũ vào Thùng rác…"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  ${SUDO[@]+"${SUDO[@]}"} mv "$TARGET_APP" "$HOME/.Trash/KIRA-cu-$STAMP.app" \
    || fail "không chuyển được bản cũ vào Thùng rác."
fi

say "Đang chép KIRA.app…"
${SUDO[@]+"${SUDO[@]}"} ditto "$SOURCE_APP" "$TARGET_APP" || fail "không chép được KIRA.app vào $INSTALL_DIR."
if [[ ${#SUDO[@]} -gt 0 ]]; then
  ${SUDO[@]+"${SUDO[@]}"} chown -R "$(id -un)":staff "$TARGET_APP"
fi

# 3 + 4. Gỡ quarantine, ký inside-out và xác minh (sign-kira.sh làm cả ba).
say "Đang tự ký app và các thành phần bên trong…"
bash "$SCRIPT_DIR/sign-kira.sh" "$TARGET_APP" || fail "ký hoặc xác minh chữ ký thất bại."

# Đăng ký app và Safari Extension với hệ thống. Bỏ qua khi kiểm thử
# (KIRA_NO_REGISTER=1): bản cài thử cùng bundle id sẽ giành đăng ký của bản
# KIRA thật trong /Applications.
if [[ "${KIRA_NO_REGISTER:-0}" != "1" ]]; then
  APPEX="$TARGET_APP/Contents/PlugIns/KIRA Safari Extension.appex"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$TARGET_APP" >/dev/null 2>&1 || true
  if [[ -d "$APPEX" ]]; then
    pluginkit -a "$APPEX" >/dev/null 2>&1 || true
  fi
fi

say "Đã cài xong KIRA $VERSION."
cat <<'NEXT'

Bước tiếp theo:
  • Safari: Safari → Cài đặt → Tiện ích mở rộng → bật KIRA.
  • Chrome: mở KIRA → Cài đặt, tab cài extension Chrome, làm theo hướng dẫn.

Có thể đóng cửa sổ Terminal này.
NEXT

if [[ "${KIRA_NO_OPEN:-0}" != "1" ]]; then
  open "$TARGET_APP"
fi
