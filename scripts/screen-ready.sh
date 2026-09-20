#!/bin/bash
# Is the Mac's screen usable for native-app QA right now, and keep it that way.
#
# Why this exists: `keep_awake_while_working` in the Claude app holds
# PreventUserIdleSystemSleep, which stops the *computer* idling to sleep. It does
# NOT hold PreventUserIdleDisplaySleep, so the display still turns off on the
# pmset `displaysleep` timer, and the lock screen follows it. Once locked,
# `screencapture` returns pure black, computer-use's app_screenshot fails with
# "audio/video capture failure", and computer_batch refuses because loginwindow
# is frontmost. Every thread that plans native work has to know this BEFORE it
# spends a turn on it.
#
#   scripts/screen-ready.sh          report only, exit 0 = ready, 2 = not ready
#   scripts/screen-ready.sh --arm    also take a display-sleep hold (12h)
#   scripts/screen-ready.sh --release  drop the hold this script took
#
# The hold is a caffeinate assertion, the same mechanism a video player uses. It
# changes no setting, needs no password, and dies with the process.

set -uo pipefail

HOLD_SECONDS="${KIRA_SCREEN_HOLD_SECONDS:-43200}" # 12 hours
PROBE_DIR="${TMPDIR:-/tmp}"
PID_FILE="$PROBE_DIR/kira-screen-ready.pid"

# A pidfile, not a pgrep tag: caffeinate treats any trailing argument as a
# utility to run, so tagging the command line makes it exec a missing binary
# and exit at once.
hold_pid() {
  [ -f "$PID_FILE" ] || return 0
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null)"
  [ -n "$pid" ] || return 0
  ps -p "$pid" -o comm= 2>/dev/null | grep -q caffeinate || return 0
  echo "$pid"
}

arm_hold() {
  local existing
  existing="$(hold_pid)"
  if [ -n "$existing" ]; then
    echo "hold: already held (pid $existing)"
    return
  fi
  # -d display sleep, -i idle system sleep, -u declare user activity so the
  # display timer restarts from now.
  nohup caffeinate -d -i -u -t "$HOLD_SECONDS" >/dev/null 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  if [ -n "$(hold_pid)" ]; then
    echo "hold: armed for $((HOLD_SECONDS / 3600))h (pid $(hold_pid))"
  else
    echo "hold: FAILED to arm"
  fi
}

release_hold() {
  local pid
  pid="$(hold_pid)"
  rm -f "$PID_FILE"
  if [ -z "$pid" ]; then
    echo "hold: nothing to release"
    return
  fi
  kill "$pid" 2>/dev/null && echo "hold: released (pid $pid)"
}

# The authoritative test: can we actually read pixels? A locked screen captures
# as pure black, so grab a small region of the menu bar and look at real bytes.
# BMP because it is uncompressed, so no image library is needed.
probe_capture() {
  local png="$PROBE_DIR/kira-screen-probe.png"
  local bmp="$PROBE_DIR/kira-screen-probe.bmp"
  rm -f "$png" "$bmp"
  screencapture -x -R 0,0,320,64 -t png "$png" >/dev/null 2>&1
  if [ ! -s "$png" ]; then
    echo "capture: FAILED (screencapture wrote nothing)"
    return 2
  fi
  sips -s format bmp "$png" --out "$bmp" >/dev/null 2>&1
  if [ ! -s "$bmp" ]; then
    echo "capture: UNKNOWN (sips could not convert the probe)"
    rm -f "$png"
    return 2
  fi
  local verdict
  verdict="$(/usr/bin/python3 - "$bmp" <<'PY'
import struct, sys
data = open(sys.argv[1], 'rb').read()
offset = struct.unpack_from('<I', data, 10)[0]
pixels = data[offset:]
print('black' if not any(pixels) else 'content')
PY
)"
  rm -f "$png" "$bmp"
  if [ "$verdict" = "content" ]; then
    echo "capture: ok (real pixels)"
    return 0
  fi
  echo "capture: BLACK (screen is locked or the display is asleep)"
  return 2
}

case "${1:-}" in
  --release)
    release_hold
    exit 0
    ;;
  --arm)
    arm_hold
    ;;
esac

echo "displaysleep timer: $(pmset -g custom 2>/dev/null | awk '/displaysleep/ {print $2; exit}') min"
echo "PreventUserIdleDisplaySleep: $(pmset -g assertions | awk '/PreventUserIdleDisplaySleep/ {print $2; exit}')"
echo "PreventUserIdleSystemSleep:  $(pmset -g assertions | awk '/PreventUserIdleSystemSleep/ {print $2; exit}')"
[ -n "$(hold_pid)" ] && echo "hold: held by this script (pid $(hold_pid))" || echo "hold: not held"

probe_capture
probe_status=$?

if [ "$probe_status" -eq 0 ]; then
  echo "VERDICT: ready for native QA"
  exit 0
fi

cat <<'MSG'
VERDICT: not ready for native QA
  Do the Bash-only parts of the task now, report, and do not sit waiting.
  Browser-testable UI does not need this at all: use headless Chrome over CDP
  (see CLAUDE.md, "Máy đang khoá màn hình").
  To make it ready, the user unlocks the Mac, then run:
    scripts/screen-ready.sh --arm
MSG
exit 2
