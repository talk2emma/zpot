# Xcode

## Open the project

1. Run `./scripts/tools/pod-install.sh`. It wraps `pod install` and pre-downloads React Native's ~95 MB prebuilt core with resume support, because CocoaPods' own download gives up on slow connections. CocoaPods comes from Homebrew (`brew install cocoapods`). The Mapbox Maps SDK comes from CocoaPods through `@rnmapbox/maps` (`$RNMapboxMaps.pre_install`/`post_install` in the `Podfile`; no secret token needed).
2. Open **`mobile/ios/Zpot.xcworkspace`**. Always use the workspace, never `.xcodeproj`.
3. Start Metro: `cd mobile && npm start`.
4. Select the **Zpot** scheme and an iPhone simulator (iOS 27 runtime installed), then press **⌘R**.

`./scripts/start-ios.sh ["iPhone 17 Pro"]` does all of this from the terminal.

## Configuration

| Item | Where | Value |
|---|---|---|
| Bundle identifier | Target › Signing & Capabilities (`PRODUCT_BUNDLE_IDENTIFIER`) | `pt.zpot.app`. Change it here for your team. |
| Display name | `Info.plist` `CFBundleDisplayName` | Zpot |
| Icon | `Images.xcassets/AppIcon.appiconset` | Generated (`node scripts/gen-icons.js`), opaque 1024 marketing icon |
| Launch screen | `BootSplash.storyboard` | `react-native-bootsplash` |
| Location | `NSLocationWhenInUseUsageDescription` | Foreground only, with a purpose string |
| Navigation hand-off | `LSApplicationQueriesSchemes` | `comgooglemaps`, `waze` (Apple Maps needs none) |
| Deep links | `CFBundleURLTypes` | `zpot` (handled in `AppDelegate.application(_:open:options:)` via `RCTLinkingManager`) |
| Local HTTP | `NSAppTransportSecurity.NSAllowsLocalNetworking` | `localhost` API in debug |
| Signing | Target › Signing | Simulator builds need no team. Physical devices need your Apple ID team. |

## Simulator vs physical device

* **Simulator.** `localhost:8000` reaches the Mac's API directly.
* **Device.** Set `ZPOT_API_URL_IOS=http://<Mac LAN IP>:8000/api/v1` in `mobile/.env`, run `npm run env`, add the IP to `DJANGO_ALLOWED_HOSTS`, and make sure the device can reach the Mac (same Wi-Fi, firewall allows 8000). Metro is discovered by the dev build over the LAN.

## Location on the simulator

Use **Features › Location › Custom Location…** with `38.7347, -9.1450` (Saldanha) to exercise "near you" search with seeded data.
