#!/usr/bin/env bash
# Builds and launches Zpot on an Android emulator. Usage: scripts/start-android.sh [AVD_NAME]
set -euo pipefail
source "$(dirname "$0")/lib.sh"
detect_java_home; detect_android_home
[ -n "${JAVA_HOME:-}" ] || die "No JDK found (install Android Studio)"
[ -n "${ANDROID_HOME:-}" ] || die "Android SDK not found (Android Studio › SDK Manager)"
command -v adb >/dev/null || die "adb not found in \$ANDROID_HOME/platform-tools"
api_up && ok "API reachable" || warn "API not running — scripts/start-api.sh (the app will show connection errors)"

if ! adb devices | grep -q "emulator-.*device$"; then
  AVD="${1:-$(emulator -list-avds | head -1)}"
  [ -n "$AVD" ] || die "No AVD — create one in Android Studio › Device Manager"
  ok "Booting emulator $AVD"
  nohup emulator -avd "$AVD" -netdelay none -netspeed full > "$ROOT/.emulator.log" 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi
ok "Emulator ready: $(adb devices | grep emulator | head -1 | cut -f1)"
# API access: the app defaults to http://10.0.2.2:8000 on Android; adb reverse also allows localhost.
adb reverse tcp:8000 tcp:8000 >/dev/null && ok "adb reverse tcp:8000 (API) configured"
adb reverse tcp:8081 tcp:8081 >/dev/null || true
ensure_metro
ABI=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
(cd "$MOBILE" && npx react-native run-android --no-packager --active-arch-only) || die "Android build failed — see output above"
allow_dev_background_network   # keeps Fast Refresh connected when the app is backgrounded (see lib.sh)
ok "Zpot launched (ABI $ABI)"
