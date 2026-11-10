#!/usr/bin/env bash
# Shared helpers for Zpot scripts.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$ROOT/mobile"
if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; B=$'\e[1m'; N=$'\e[0m'; else G=; Y=; R=; B=; N=; fi
ok()   { printf "  ${G}✔${N} %s\n" "$*"; }
warn() { printf "  ${Y}!${N} %s\n" "$*"; }
fail() { printf "  ${R}✘${N} %s\n" "$*"; }
head1(){ printf "\n${B}%s${N}\n" "$*"; }
die()  { fail "$*"; exit 1; }

# Prefer Android Studio's bundled JDK (Gradle 9.4 supports JDK 17–25).
detect_java_home() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then return; fi
  for c in "/Applications/Android Studio.app/Contents/jbr/Contents/Home" "$(/usr/libexec/java_home 2>/dev/null)"; do
    if [ -x "$c/bin/java" ]; then export JAVA_HOME="$c"; return; fi
  done
}
detect_android_home() {
  if [ -z "${ANDROID_HOME:-}" ]; then
    for c in "$HOME/Library/Android/sdk" "${ANDROID_SDK_ROOT:-}"; do [ -d "$c" ] && export ANDROID_HOME="$c" && break; done
  fi
  [ -n "${ANDROID_HOME:-}" ] && export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
}
# Local development only. On Android 15+, NetworkPolicyManager blocks network for an app that has left the
# foreground (blocked_state APP_BACKGROUND) and ConnectivityService destroys its live TCP sockets about 5 s later.
# That kills the Fast Refresh WebSocket to Metro, so a debug build that goes to the background (e.g. the hand-off to
# a navigation app) shows "Cannot connect to Metro … Error: undefined" on return, and Fast Refresh stays disconnected.
# Putting the package on the power-save allowlist exempts it from that block. This is a device setting, not an app
# change: release builds have no Metro socket and correctly lose network in the background. E2E runs deliberately
# don't call this, so they keep production behaviour. Undo: adb shell cmd deviceidle whitelist -pt.zpot.app
ZPOT_ANDROID_PACKAGE="pt.zpot.app"
allow_dev_background_network() {  # allow_dev_background_network [adb-serial]
  local adbc=(adb); [ -n "${1:-}" ] && adbc=(adb -s "$1")
  "${adbc[@]}" shell pm path "$ZPOT_ANDROID_PACKAGE" >/dev/null 2>&1 || return 0   # not installed yet
  if "${adbc[@]}" shell cmd deviceidle whitelist "+$ZPOT_ANDROID_PACKAGE" >/dev/null 2>&1; then
    ok "Dev: $ZPOT_ANDROID_PACKAGE exempt from background network block (Fast Refresh survives backgrounding)"
  else
    warn "Could not allowlist $ZPOT_ANDROID_PACKAGE; Fast Refresh may disconnect after backgrounding (docs/development/emulator-networking.md)"
  fi
}

api_up() { curl -fsS --max-time 3 http://localhost:8000/api/v1/health/ >/dev/null 2>&1; }
metro_up() { curl -fsS --max-time 2 http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; }
ensure_metro() {
  if metro_up; then ok "Metro already running on :8081 (reusing)"; return; fi
  (cd "$MOBILE" && nohup npx react-native start > "$ROOT/.metro.log" 2>&1 &)
  for _ in $(seq 1 60); do metro_up && { ok "Metro started (log: .metro.log)"; return; }; sleep 1; done
  die "Metro did not start — see .metro.log"
}
