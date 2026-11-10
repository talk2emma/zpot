# Android Studio

**Edit in Antigravity, build and debug in Android Studio.** Both tools point at the same files. Android Studio only owns `mobile/android`.

## Open the project

1. Start the backend: `./scripts/start-api.sh`.
2. Start Metro from a terminal: `cd mobile && npm start`. Android Studio does not start Metro.
3. In Android Studio, choose **File › Open** and select `zpot-mobile/mobile/android` (the folder with `settings.gradle`). Don't open the repo root.
4. Gradle JDK: **Settings › Build Tools › Gradle › Gradle JDK = "jbr-25" (Embedded JDK)**. Gradle 9.4 supports JDK 17–25.
5. Let Gradle sync. The first sync downloads Gradle 9.4.1, build-tools 37 and NDK 27.1. SDK licences must be accepted (`sdkmanager --licenses`).
6. Pick the `Pixel_10_Pro` AVD (or any arm64 image with API 24+) and press **Run ▶** on the `app` configuration.

The app loads JavaScript from Metro on `localhost:8081`. Run `adb reverse tcp:8081 tcp:8081` if the emulator shows "Unable to load script". `start-android.sh` does this for you.

## Configuration

| Item | Where | Value |
|---|---|---|
| Application ID / namespace | `app/build.gradle` | `pt.zpot.app`. Change both `namespace` and `applicationId`, and the Kotlin package folder. |
| App name | `res/values/strings.xml` | Zpot |
| Icon | `res/mipmap-*` | Generated from the official logo: `node scripts/gen-icons.js` |
| Splash | `res/values/styles.xml` (`BootTheme`), `drawable-*/bootsplash_logo.png` | `react-native-bootsplash` |
| Permissions | `AndroidManifest.xml` (+ merged from libraries) | INTERNET, POST_NOTIFICATIONS (asked at session start); ACCESS_NETWORK_STATE and ACCESS_FINE/COARSE_LOCATION (foreground only) are merged from NetInfo/geolocation. No CAMERA permission: photos use the system camera/picker intent. |
| Deep links | `AndroidManifest.xml` | `zpot://` intent filter |
| Navigation hand-off | `<queries>` | `google.navigation`, `waze`, `geo`, `https` |
| Cleartext HTTP | `usesCleartextTraffic` placeholder | Enabled for debug builds only (local API) |
| Map | Mapbox Maps SDK 11.33 (Mapbox Maven repo, no download token) | Public `pk.*` token in `mobile/.env` |

## Command line equivalents

```bash
cd mobile/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a   # debug APK: app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8000 tcp:8000 && adb reverse tcp:8081 tcp:8081
adb shell am start -n pt.zpot.app/.MainActivity
```

## Debugging

* JS: press `j` in Metro to open React Native DevTools, or shake the device for the Dev Menu.
* Native: Logcat filtered by `pt.zpot.app`. Mapbox logs under the `Mapbox` / `RNMBX` tags.
* Network: the API base URL is shown at the bottom of Profile in debug builds.
