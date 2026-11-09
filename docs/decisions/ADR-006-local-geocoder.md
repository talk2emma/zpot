# ADR-006 — Geocoding provider

**Decision.** The default is a local PostGIS gazetteer (`cities.Place`, accent-insensitive search via `unaccent` and a trigram index). It's deterministic, works offline and makes no third-party calls in development. A Nominatim adapter is included, with caching and a 1 req/s lock, for opt-in use within its usage policy (`GEOCODER_PROVIDER=nominatim`). Every result carries `coverage`, so the app can explain unsupported cities.

**Open question.** Choosing the production provider (Mapbox Search, Google Places or self-hosted Nominatim/Photon) needs licence and cost review.
