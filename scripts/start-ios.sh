#!/usr/bin/env bash
# Builds and launches Zpot on an iOS simulator. Usage: scripts/start-ios.sh ["iPhone 17 Pro"]
set -euo pipefail
source "$(dirname "$0")/lib.sh"
xcodebuild -version >/dev/null 2>&1 || die "Xcode not installed/selected (sudo xcode-select -s /Applications/Xcode.app)"
command -v pod >/dev/null || die "CocoaPods missing — brew install cocoapods"
[ -f "$MOBILE/ios/Pods/Manifest.lock" ] || "$ROOT/scripts/tools/pod-install.sh"
api_up && ok "API reachable (simulator uses http://localhost:8000)" || warn "API not running — scripts/start-api.sh"
SIM="${1:-$(xcrun simctl list devices available | grep -E "iPhone" | head -1 | sed -E 's/^ +//; s/ \(.*//')}"
[ -n "$SIM" ] || die "No iPhone simulator available (Xcode › Settings › Platforms)"
ok "Simulator: $SIM"
ensure_metro
(cd "$MOBILE" && npx react-native run-ios --simulator "$SIM" --no-packager) || die "iOS build failed — open mobile/ios/Zpot.xcworkspace in Xcode for details"
ok "Zpot launched on $SIM"
