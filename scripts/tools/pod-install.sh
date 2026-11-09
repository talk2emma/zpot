#!/usr/bin/env bash
# Robust `pod install`: pre-downloads React Native's prebuilt core tarball with resume/stall detection
# (CocoaPods' own curl gives up on slow or flaky connections), then points CocoaPods at the local copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RN_VERSION=$(node -p "require('$ROOT/mobile/node_modules/react-native/package.json').version")
CACHE="${ZPOT_CACHE_DIR:-$HOME/.cache/zpot}"; mkdir -p "$CACHE"
TARBALL="$CACHE/rncore-$RN_VERSION-debug.tar.gz"
URL="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/$RN_VERSION/react-native-artifacts-$RN_VERSION-reactnative-core-debug.tar.gz"
if ! tar -tzf "$TARBALL" >/dev/null 2>&1; then
  echo "Downloading React Native $RN_VERSION prebuilt core (resumable)…"
  for i in $(seq 1 30); do
    curl -sS -f -L -C - --speed-limit 20000 --speed-time 20 --connect-timeout 20 -o "$TARBALL" "$URL" && break
    echo "  retry $i ($(du -h "$TARBALL" 2>/dev/null | cut -f1) so far)"; sleep 2
  done
  tar -tzf "$TARBALL" >/dev/null || { echo "Download failed: $URL"; exit 1; }
fi
cd "$ROOT/mobile/ios"
RCT_TESTONLY_RNCORE_TARBALL_PATH="$TARBALL" pod install "$@"
