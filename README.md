# Atmos — Weather App

Atmos is a responsive weather app using Open-Meteo geocoding and forecast APIs. It presents current model estimates, hourly and seven-day forecasts, location-local time, and Celsius/Fahrenheit display.

## Features

- Dynamic global place search, with a Pakistan-focused request first for unqualified names and a global fallback when no reliable Pakistani exact match is found.
- Explicit country and region context validation, including queries such as `Paris, Texas, USA`.
- Exact normalized place-name matching, populated-place feature checks, valid coordinate checks, deterministic ranking, and an inline ambiguity message.
- Current model-estimated temperature, feels-like temperature, humidity, wind speed, pressure, and WMO condition visuals.
- Hourly and seven-day forecasts, using the API timezone and local forecast timestamps.
- Celsius/Fahrenheit toggle using raw Celsius values and a single presentation conversion.
- Accessible loading/error messages, cancellation, stale-response guards, and responsive layouts.

## Data and API

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Forecast: `https://api.open-meteo.com/v1/forecast`
- The geocoding filter is `countryCode=PK` (ISO 3166-1 alpha-2), as named in the [official Geocoding API documentation](https://open-meteo.com/en/docs/geocoding-api).
- Forecast requests explicitly request Celsius and km/h. The app checks response unit metadata for Celsius, km/h, and hPa.
- “Current” values are Open-Meteo model estimates, not direct local-station observations. Model coverage and update times vary.

## Run locally

From the project directory, run `python3 -m http.server 8000` and open `http://localhost:8000/`.

## Tests

Run from the `tests/` directory:

```sh
node ranking.js
node conversions.js
node geocoding.js
node e2e.js
```

`ranking.js`, `conversions.js`, and `geocoding.js` use controlled fixtures. `e2e.js` launches Chromium and intercepts only the two Open-Meteo endpoints with deterministic fixtures. The browser suite verifies page rendering, requests and coordinates, errors, unit switching, forecasts, and nine viewport widths. It does not establish live API availability or live weather correctness.

## Current verification limitation

In the audit environment, DNS resolution for `geocoding-api.open-meteo.com` and `api.open-meteo.com` failed. Therefore, real API response checks and live searches were not completed. The browser test uses controlled responses and must not be described as a live API test.
