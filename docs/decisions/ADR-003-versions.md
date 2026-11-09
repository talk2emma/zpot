# ADR-003 — Framework versions

* **React Native 0.87.1** (stable August 2026, New Architecture, Hermes). 0.88.0 was 3 weeks old at project start; its library ecosystem (screens, maps, keychain) had not caught up.
* **Django 5.2 LTS** with DRF 3.18, SimpleJWT 5.5.1, drf-spectacular 0.30 and django-filter 26.1. Django 6.x support in SimpleJWT and spectacular is not confirmed, and 5.2 is supported until April 2028.
* **Python 3.13** (Docker, Debian trixie for GDAL 3.10). Host Python (3.9) is never used.
* **PostGIS 17-3.5** using the `imresamu/postgis` multi-arch build, because the official image has no arm64 build.
* Mobile libraries pinned exactly (`--save-exact`). React Native Testing Library v14, whose `render`, `fireEvent` and `act` are async.
