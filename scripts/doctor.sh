#!/usr/bin/env bash
# Checks the actual state of the local toolchain. Never prints success it didn't verify.
set -u
source "$(dirname "$0")/lib.sh"
detect_java_home; detect_android_home
MISSING=0; WARN=0
need() { # name, command, version-cmd, hint
  if command -v "$2" >/dev/null 2>&1; then ok "$1: $(eval "$3" 2>&1 | head -1)"; else fail "$1 not found — $4"; MISSING=$((MISSING+1)); fi
}
want() { if command -v "$2" >/dev/null 2>&1; then ok "$1: $(eval "$3" 2>&1 | head -1)"; else warn "$1 not found — $4"; WARN=$((WARN+1)); fi; }

head1 "System"
ok "macOS $(sw_vers -productVersion) ($(uname -m))"

head1 "Core"
need "Node.js" node "node --version" "install Node 20+ (brew install node)"
if command -v node >/dev/null; then v=$(node -p 'process.versions.node.split(".")[0]'); [ "$v" -ge 20 ] || { fail "Node $v < 20"; MISSING=$((MISSING+1)); }; fi
need "npm" npm "npm --version" "ships with Node"
need "Git" git "git --version" "xcode-select --install"
want "Watchman" watchman "watchman --version" "optional; brew install watchman (faster Metro file watching)"
want "Python 3 (host)" python3 "python3 --version" "only needed outside Docker"

head1 "Backend (Docker)"
need "Docker" docker "docker --version" "install Docker Desktop"
if command -v docker >/dev/null; then
  if docker info >/dev/null 2>&1; then ok "Docker daemon running"; else fail "Docker daemon not running — start Docker Desktop"; MISSING=$((MISSING+1)); fi
  if docker compose version >/dev/null 2>&1; then ok "Docker Compose: $(docker compose version --short)"; else fail "docker compose plugin missing"; MISSING=$((MISSING+1)); fi
fi
if api_up; then ok "Zpot API responding at http://localhost:8000/api/v1/"; else warn "Zpot API not running (scripts/start-api.sh)"; WARN=$((WARN+1)); fi

head1 "Android"
if [ -n "${JAVA_HOME:-}" ]; then ok "JDK: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1) ($JAVA_HOME)"; else fail "No JDK — install Android Studio (bundled JBR) or JDK 17+"; MISSING=$((MISSING+1)); fi
[ -d "/Applications/Android Studio.app" ] && ok "Android Studio installed" || { warn "Android Studio not in /Applications"; WARN=$((WARN+1)); }
if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
  ok "Android SDK: $ANDROID_HOME"
  ls "$ANDROID_HOME/platforms" >/dev/null 2>&1 && ok "SDK platforms: $(ls "$ANDROID_HOME/platforms" | tr '\n' ' ')" || warn "no SDK platforms installed"
  command -v adb >/dev/null && ok "adb: $(adb version | head -1)" || { fail "adb missing (platform-tools)"; MISSING=$((MISSING+1)); }
  if command -v emulator >/dev/null; then
    avds=$(emulator -list-avds 2>/dev/null | tr '\n' ' '); [ -n "$avds" ] && ok "AVDs: $avds" || { warn "no Android Virtual Devices — create one in Android Studio › Device Manager"; WARN=$((WARN+1)); }
  else fail "Android emulator binary missing"; MISSING=$((MISSING+1)); fi
  [ -d "$ANDROID_HOME/ndk" ] && ok "NDK: $(ls "$ANDROID_HOME/ndk" | tr '\n' ' ')" || warn "NDK not installed yet (Gradle downloads the required version on first build)"
else fail "ANDROID_HOME not found — install the SDK via Android Studio"; MISSING=$((MISSING+1)); fi

head1 "iOS"
if xcode-select -p >/dev/null 2>&1; then ok "Xcode CLT: $(xcode-select -p)"; else fail "Xcode command line tools missing — xcode-select --install"; MISSING=$((MISSING+1)); fi
if command -v xcodebuild >/dev/null && xcodebuild -version >/dev/null 2>&1; then ok "$(xcodebuild -version 2>/dev/null | tr '\n' ' ')"; else fail "Xcode not installed/selected"; MISSING=$((MISSING+1)); fi
rt=$(xcrun simctl list runtimes 2>/dev/null | grep -c "iOS"); [ "$rt" -gt 0 ] && ok "iOS simulator runtimes: $(xcrun simctl list runtimes 2>/dev/null | grep iOS | sed 's/ (.*//' | tr '\n' ' ')" || { fail "no iOS simulator runtime (Xcode › Settings › Platforms)"; MISSING=$((MISSING+1)); }
need "CocoaPods" pod "pod --version" "brew install cocoapods"
want "Ruby" ruby "ruby --version" "system Ruby is fine when CocoaPods comes from Homebrew"

head1 "Project"
[ -d "$MOBILE/node_modules" ] && ok "mobile/node_modules installed" || { warn "run scripts/bootstrap.sh (npm install)"; WARN=$((WARN+1)); }
[ -d "$MOBILE/ios/Pods" ] && ok "iOS Pods installed" || { warn "iOS Pods not installed (cd mobile/ios && pod install)"; WARN=$((WARN+1)); }
[ -f "$ROOT/api/.env" ] && ok "api/.env present" || { warn "api/.env missing (bootstrap creates it from .env.example)"; WARN=$((WARN+1)); }
[ -f "$MOBILE/.env" ] && ok "mobile/.env present" || { warn "mobile/.env missing (defaults are used)"; WARN=$((WARN+1)); }
grep -q "^ZPOT_MAPBOX_PUBLIC_TOKEN=pk\." "$MOBILE/.env" 2>/dev/null && ok "Mapbox public token configured" \
  || { warn "No Mapbox public token — the map shows as unavailable. Set ZPOT_MAPBOX_PUBLIC_TOKEN=pk.… in mobile/.env (docs/development/maps.md)"; WARN=$((WARN+1)); }

head1 "Summary"
if [ "$MISSING" -eq 0 ]; then ok "No blocking problems found ($WARN warning(s))"; else fail "$MISSING blocking problem(s), $WARN warning(s)"; fi
exit $(( MISSING > 0 ? 1 : 0 ))
