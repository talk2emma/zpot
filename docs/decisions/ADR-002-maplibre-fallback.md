# ADR-002 — MapLibre Native fallback for the map provider

**Context.** The BRD and TRD prefer Mapbox. Mapbox native SDK downloads need a secret `DOWNLOADS:READ` token; we have none, and unauthenticated requests return 404. The brief says to use a clearly labelled fallback and keep the integration points.

**Decision.** Ship `@maplibre/maplibre-react-native` (an open-source fork of the Mapbox RN SDK) with OpenFreeMap vector tiles, which need no key, behind a provider-agnostic `ZpotMap` contract. Mapbox becomes a second implementation of the same contract (`docs/development/maps.md`). A debug label is shown if Mapbox is requested but unavailable.

**Consequences.** Real interactive native maps work today on both platforms. Tile terms are OpenFreeMap and OSM attribution, which is displayed. Switching providers touches one file plus the native dependency.
