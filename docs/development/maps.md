# Map provider

## Current: MapLibre Native (works without credentials)

* Library: `@maplibre/maplibre-react-native@11.5.0`, an open-source fork of the Mapbox React Native SDK with the same rendering model.
* Style: `https://tiles.openfreemap.org/styles/liberty` (OpenFreeMap). No API key. Attribution "© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors" is shown on the map.
* Configured by `ZPOT_MAP_STYLE_URL` (mobile) and `MAP_STYLE_URL` (API `/config/`).

## Why not Mapbox right now

The BRD and TRD prefer Mapbox. The Mapbox Maps SDK native downloads (`api.mapbox.com/downloads/v2/...`) require a **secret** token with `DOWNLOADS:READ` scope, and none is available in this environment. Unauthenticated requests return 404. Building against Mapbox would break every native build.

## Switching to Mapbox

1. Get a Mapbox account with a public token (`pk.*`) and a secret download token (`sk.*`, `DOWNLOADS:READ`).
2. Put the **secret** token only in `~/.gradle/gradle.properties` (`MAPBOX_DOWNLOADS_TOKEN=sk…`) and `~/.netrc` (`machine api.mapbox.com login mapbox password sk…`). Never commit it, and never put it in `mobile/.env`. `gen-env.js` rejects `sk.*`.
3. `cd mobile && npm i @rnmapbox/maps@10.3.x`, then `cd ios && pod install`.
4. Implement `src/components/maps/providers/MapboxMapView.tsx` against the `ZpotMapProps` / `ZpotMapHandle` contract in `components/maps/types.ts`. The MapLibre implementation is the template; the component names map almost 1:1 (`Map`→`MapView`, `GeoJSONSource`→`ShapeSource`, `Layer`→`LineLayer`/`FillLayer`/`CircleLayer`/`SymbolLayer`, `Marker`→`MarkerView`).
5. Register it in `ZpotMap.tsx` when `ENV.mapProvider === 'mapbox'`. Set `ZPOT_MAP_PROVIDER=mapbox` and `ZPOT_MAPBOX_PUBLIC_TOKEN=pk…` in `mobile/.env`.

Until then, `ZPOT_MAP_PROVIDER=mapbox` shows a visible **"DEV · Mapbox not configured — using MapLibre fallback"** label in debug builds instead of failing silently.
