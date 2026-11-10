# Map provider: Mapbox

* **Library:** `@rnmapbox/maps@10.3.17`, which uses the Mapbox Maps SDK **11.33.0** on iOS and Android.
* **Implementation:** `mobile/src/components/maps/providers/MapboxMapView.tsx`, behind the provider-agnostic `ZpotMap`
  contract (`components/maps/types.ts`). Screens never import the SDK.
* **Style:** `ZPOT_MAPBOX_STYLE_URL`, default `mapbox://styles/mapbox/streets-v12`.
* **Credentials:** a public `pk.*` token in `ZPOT_MAPBOX_PUBLIC_TOKEN` (`mobile/.env`, gitignored).

The overlays come from server data: parking polygons and lines coloured by the API `category` (restricted and unknown
are dashed), clusters below zoom 14, per-area markers from zoom 14 up, the destination pin, vacancy and report pins,
and the user's location puck. Map colours never decide legality. Only the API's enums do.

## Setup

1. Put the token in `mobile/.env`, then run `npm run env` (`postinstall` and `prestart` also run it):
   ```
   ZPOT_MAPBOX_PUBLIC_TOKEN=pk....
   ```
2. iOS: `cd mobile/ios && pod install`. The Podfile sets `$RNMapboxMapsImpl = 'mapbox'` and
   `$RNMapboxMapsVersion = '= 11.33.0'`, and calls `$RNMapboxMaps.pre_install` / `post_install`.
3. Android: nothing extra. `android/build.gradle` adds the Mapbox Maven repo
   (`https://api.mapbox.com/downloads/v2/releases/maven`) and pins `RNMapboxMapsVersion = "11.33.0"`.

**No secret token is needed any more.** The Maps SDK v11 Maven artifacts and the iOS CocoaPods binaries download
unauthenticated (verified 2026-11-10). If `MAPBOX_DOWNLOADS_TOKEN` (`~/.gradle/gradle.properties`) or
`RNMAPBOX_MAPS_DOWNLOAD_TOKEN` exists locally, Gradle still sends it. Never commit one.

## Without a token

`ZpotMap` doesn't render a blank or fake map. It shows "The map isn't configured in this build…"
(`explore.mapNotConfigured`, EN and PT-PT) and calls `onMapError` once, so Explore switches to its list view as it does
for any map failure. Debug builds also print which env var to set.

## Token and privacy rules

* Only `pk.*` tokens may ship. They're compiled into the JS bundle. `scripts/gen-env.js` refuses `sk.*`, and `ENV`
  ignores any value that doesn't start with `pk.` (`__tests__/env.test.ts`).
* Give the public token only public scopes, and rotate it in the Mapbox account if it's misused.
* **Optional telemetry is turned off** with `Mapbox.setTelemetryEnabled(false)`. On Android this sets the SDK's
  `userTelemetryRequestState`. On iOS, `@rnmapbox/maps` only writes the old `MGLMapboxMetricsEnabled` preference, and
  it's unverified whether Maps SDK v11 honours it.
* **Not everything can be turned off.** The SDK still sends usage and billing events (map loads, used for MAU
  billing) to `events.mapbox.com`. This was seen in the iOS simulator log on 2026-11-10. These events, and the tile
  requests themselves, mean Mapbox receives the device's IP address and an SDK identifier. **The privacy policy must
  name Mapbox as a processor before release.**
* The Mapbox wordmark and attribution stay visible, as the Mapbox ToS requires. `ornamentOffset` lifts them above
  Explore's floating Report button and map controls.
* Billing is per monthly active user (MAU) of the Maps SDK. The free tier covers development.

## Why MapLibre was removed

The app previously used MapLibre Native with OpenFreeMap tiles as a keyless stand-in. It can't ship alongside
`@rnmapbox/maps`: both libraries generate a TurboModule spec named `NativeMapViewModule`, and the Android link fails
with `duplicate symbol: facebook::react::NativeMapViewModuleSpecJSI`. Removing it meant uninstalling the package,
deleting `MapLibreMapView.tsx`, removing the `$MLRN.post_install` Podfile hook, and removing the MapLibre Swift package
and its signature-removal build phase from `Zpot.xcodeproj`.

## Performance guards (`MapboxMapView.tsx`, `markerBudget.ts`)

* **Marker budget.** At most 60 native `MarkerView`s (`MAX_MARKERS`) are mounted: the ones in the visible viewport,
  nearest the centre first, plus the selected area. The API can return up to 500 areas per box, and each marker is a
  native view the SDK repositions every frame. Polygons, lines and clusters are GPU layers and aren't capped.
* **No idle render loop.** `onMapIdle` also fires after re-renders and tile loads when the camera hasn't moved. The
  viewport state and `onRegionChange` only update when the bounds really change (`sameBounds`, about 1 m). Without
  this, storing a new viewport object on each idle re-rendered the markers, which re-rendered the map, which fired
  idle again. That loop starved the JS thread, and iOS dropped taps (E2E-011 "Apply" ignored, 3/4 runs).
* **Measured on 2026-11-10** (Pixel_10_Pro emulator, API 37). Release build: 114 MB total PSS with no map and
  208 MB on Explore with the map (native heap 99 MB). Cold start 0.48–0.57 s. Debug builds measure about 170 MB
  higher, because of dev tooling and the unminified bundle. Don't judge memory from a debug build.

## Notes

* The API's `/config/` still returns `MAP_STYLE_URL` (OpenFreeMap). The app uses its build-time Mapbox style and
  ignores that value.
* The cluster-count label uses `DIN Pro Bold` / `Arial Unicode MS Bold`, which the Mapbox glyph API hosts.
* Jest mocks `@rnmapbox/maps` and pins the build env to a fake `pk.test-token` (`jest.setup.js`), so tests never
  depend on a developer's `.env`.
