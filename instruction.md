# Atmos implementation notes

## Architecture

- `index.html`: semantic search form, accessible status region, current conditions, hourly and daily forecasts.
- `css/style.css`: atmospheric responsive UI and reduced-motion support.
- `js/app.js`: geocoding/ranking, forecast requests, validation, rendering, temperature conversion, and request lifecycle.
- `tests/`: ranking, conversion, controlled geocoding, and Chromium E2E suites.

## Geocoding behavior

The app uses `https://geocoding-api.open-meteo.com/v1/search`. For an unqualified query it requests `countryCode=PK` first. It accepts a unique reliable exact Pakistani match; otherwise it sends a second unrestricted request and ranks global results. Qualified queries are unrestricted. The official parameter is camel-case `countryCode`, with ISO alpha-2 values; `PK` is Pakistan. The implementation filters returned Pakistan-first candidates by `country_code` as an additional check.

Queries split on commas. Every supplied context token must match the selected result's country, ISO country code, supported country alias (USA/UK/UAE), or an administrative level. Conflicts are rejected. The API request sends the city and first context token; remaining context is verified against each returned result. Exact normalized names are required. Results need numeric in-range coordinates; known non-populated features such as airports and mountains are excluded. The result contract from `getCoordinates()` is always `{ place }`; unresolved locations throw a friendly error and ambiguous matches carry a candidate list.

The API documentation allows only a single country or first-level administrative qualifier in the `name` search string. The current code sends city plus first qualifier and validates any additional supplied context locally.

## Forecast behavior

The app uses `https://api.open-meteo.com/v1/forecast` with the exact numeric geocoding coordinates, `timezone=auto`, `temperature_unit=celsius`, and `wind_speed_unit=kmh`. It validates the current object, timezone, and response unit metadata. Raw Celsius values are preserved and converted only when rendered. Missing/non-numeric forecast entries are skipped; missing current values display as unavailable. Hourly timestamps are compared as the API's location-local ISO strings, without applying the browser timezone.

The displayed current condition is identified as an Open-Meteo model estimate. It is not a direct thermometer or local station observation.

## Verification status

`node ranking.js`, `node conversions.js`, and `node geocoding.js` run controlled tests. `node e2e.js` launches a real Chromium browser and uses deterministic interception fixtures for the two documented Open-Meteo URLs. Live API verification was unavailable during the November 15, 2026 audit because DNS resolution failed in the environment. See `final_report.md` for the evidence and remaining checks.
