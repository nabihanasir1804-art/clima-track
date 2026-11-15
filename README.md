<div align="center">

# Atmos

### Weather for any city. Clear forecasts. Thoughtful location matching.

Atmos is a responsive weather app powered by [Open-Meteo](https://open-meteo.com/). Search for a place, review current model estimates, and explore local hourly and seven-day forecasts.

[![Open-Meteo](https://img.shields.io/badge/Weather%20data-Open--Meteo-3182CE?style=for-the-badge)](https://open-meteo.com/)
[![JavaScript](https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Explore features](https://img.shields.io/badge/Explore-Features-243746?style=for-the-badge)](#features)
[![Quick start](https://img.shields.io/badge/Quick-Start-E6B75A?style=for-the-badge&labelColor=243746)](#quick-start)
[![Testing](https://img.shields.io/badge/Read-Testing%20Guide-2E8B57?style=for-the-badge)](#testing)

</div>

## Preview

<p align="center">
  <img src="assets/screenshot-welcome.png" alt="Atmos welcome screen with city search" width="48%">
  <img src="assets/screenshot-lahore-weather.png" alt="Atmos current weather and forecasts for Lahore" width="48%">
</p>

## Contents

- [Features](#features)
- [Location search](#location-search)
- [Weather data](#weather-data-and-accuracy)
- [Quick start](#quick-start)
- [Testing](#testing)
- [Project structure](#project-structure)

## Features

### Find the right place

- Search cities around the world, with a Pakistan-first lookup for unqualified names.
- Respect explicit region and country context, for example `Paris, Texas, USA` or `Mirpur, Azad Kashmir`.
- Show inline choices when the geocoder returns multiple plausible locations. Each choice includes its region, country, and coordinates so similarly named places can be distinguished.
- Use a global fallback when the Pakistan-first search has no reliable exact match.

### See conditions and forecasts

- Current temperature, feels-like temperature, humidity, wind speed, pressure, and a weather-condition icon.
- Hourly forecast and seven-day outlook.
- Local time and forecast timestamps for the selected location.
- Celsius display with a Fahrenheit toggle; the app keeps the original Celsius data and converts for display.

### Comfortable on desktop and mobile

- Responsive layout for narrow and wide screens.
- Keyboard-accessible search and location choices.
- Clear loading, error, and empty states; previous weather is hidden while a new search is unresolved.
- Reduced-motion support and stale-request protection.

## Location search

Atmos uses exact normalized place-name matching, valid coordinates, populated-place checks, and explicit context validation. For an unqualified city name, it first asks Open-Meteo to prioritize Pakistan. If the results contain multiple plausible Pakistani places, Atmos asks you to choose; it does not silently send weather for one of them. When that search has no reliable exact Pakistani result, the app can fall back to the global index.

Examples:

| Search | How Atmos handles it |
|---|---|
| `Lahore` | Uses the Pakistan-first result when a reliable match is available. |
| `London` | Uses the global fallback when the Pakistan-first search has no match. |
| `Paris, Texas, USA` | Checks the city, region, and country context. |
| `Mirpur` | Offers choices when multiple exact-name places match. |
| `Mirpur, Azad Kashmir` | Uses the Azad Kashmir context to select that region’s result. |

A region can still contain multiple places with the same name. In that case, use the inline coordinate labels to choose the intended one.

## Weather data and accuracy

Atmos uses two Open-Meteo endpoints:

- [Geocoding API](https://open-meteo.com/en/docs/geocoding-api) — finds matching places and their coordinates.
- [Forecast API](https://open-meteo.com/en/docs) — returns current conditions, hourly values, and daily forecasts.

The forecast request uses the selected geocoding coordinates, automatic timezone detection, Celsius, and km/h. Open-Meteo may return the nearby model-grid coordinates in its weather response; those can differ slightly from the requested city coordinates.

Current conditions are **weather-model estimates**, not direct readings from a local thermometer or station. Model coverage, update times, and accuracy vary by location and conditions. Atmos does not claim universal geographic coverage or exact agreement with another weather provider.

## Quick start

Atmos is a static web app. Python 3 can serve it locally without a build step:

```sh
cd clima-track
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

### Test prerequisites

The app itself is static. To run the automated browser tests, install the project dependencies with Node.js and npm:

```sh
npm ci
```

Chromium is needed for the Puppeteer browser suites. Puppeteer can manage its browser install; alternatively, set `PUPPETEER_EXECUTABLE_PATH` to an installed Chromium executable.

## Testing

### Deterministic tests

Run the local unit suites and fixture-based browser checks from the repository root:

```sh
npm test
```

This runs ranking, temperature conversion, geocoding, and Chromium E2E tests. The fixture E2E suite uses controlled responses for repeatable checks; it does not establish live provider availability or live weather correctness.

### Live Open-Meteo checks

The following commands require an internet connection and use real API responses. The live browser suites do not intercept or replace Open-Meteo responses.

```sh
npm run verify:live:matrix       # finite 42-place provider matrix
npm run verify:mirpur            # four live Mirpur geocoding queries
npm run test:e2e:live            # live browser checks for eight cities
npm run test:e2e:live:mirpur     # live browser regression for five Mirpur queries
```

The matrix is a fixed test set, not a guarantee of global location coverage. Weather values change over time, so rerun live checks when you need current provider results.

## Project structure

```text
clima-track/
├── index.html                  # App structure
├── css/style.css               # Responsive styling and visual states
├── js/app.js                   # Search, matching, API calls, and rendering
├── assets/                     # App screenshots
├── tests/                      # Unit, fixture-browser, and live-browser checks
├── package.json                # Test commands and Puppeteer dependency
└── package-lock.json           # Locked npm dependency versions
```

## Data and project links

- [Open-Meteo](https://open-meteo.com/)
- [Geocoding API documentation](https://open-meteo.com/en/docs/geocoding-api)
- [Forecast API documentation](https://open-meteo.com/en/docs)
