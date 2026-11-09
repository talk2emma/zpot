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
api_up() { curl -fsS --max-time 3 http://localhost:8000/api/v1/health/ >/dev/null 2>&1; }
metro_up() { curl -fsS --max-time 2 http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; }
ensure_metro() {
  if metro_up; then ok "Metro already running on :8081 (reusing)"; return; fi
  (cd "$MOBILE" && nohup npx react-native start > "$ROOT/.metro.log" 2>&1 &)
  for _ in $(seq 1 60); do metro_up && { ok "Metro started (log: .metro.log)"; return; }; sleep 1; done
  die "Metro did not start — see .metro.log"
}
