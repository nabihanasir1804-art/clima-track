# Atmos — Weather App

Atmos is a responsive weather app using Open-Meteo geocoding and forecast APIs. It presents current model estimates, hourly and seven-day forecasts, location-local time, and Celsius/Fahrenheit display.

## Features

- Pakistan-first search for unqualified city names, with a global fallback when no exact Pakistani result is found; ambiguous Pakistani matches prompt for a selection.
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

Run the local deterministic suites from the project root:

```sh
npm test
```

This runs the ranking, conversion, geocoding, and fixture-based Chromium suites. The browser fixture suite does not substitute for live API verification.

Live checks use real Open-Meteo responses and require an internet connection:

```sh
npm run verify:live:matrix
npm run verify:mirpur
npm run test:e2e:live
npm run test:e2e:live:mirpur
```

The live browser suites do not intercept or replace API responses.
