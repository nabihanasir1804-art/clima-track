/* ==========================================================================
   Atmos — Weather App
   Application logic
   ========================================================================== */

/* --- API endpoints (only permitted external services) --- */
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

/* --- DOM elements --- */
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const weatherCard = document.getElementById("weather-card");
const unitBtn = document.getElementById("unit-btn");

/* Weather display elements */
const cityNameEl = document.getElementById("city-name");
const cityCountryEl = document.getElementById("city-country");
const localTimeEl = document.getElementById("local-time");
const weatherIconEl = document.getElementById("weather-icon");
const temperatureEl = document.getElementById("temperature");
const conditionEl = document.getElementById("description");
const feelsNoteEl = document.getElementById("feels-note");
const feelsLikeEl = document.getElementById("feels-like");
const humidityEl = document.getElementById("humidity");
const windSpeedEl = document.getElementById("wind-speed");
const pressureEl = document.getElementById("pressure");

/* Forecast elements */
const hourlySection = document.getElementById("hourly-section");
const hourlyListEl = document.getElementById("hourly-list");
const dailySection = document.getElementById("daily-section");
const dailyListEl = document.getElementById("daily-list");

/* Location picker (ambiguous cities) — removed from normal flow.
   Smart matching selects the best result automatically. */

/* --- Application state --- */
let currentUnit = "C";            /* "C" or "F" */
let weatherData = null;           /* { place, data } cached for unit toggle */
let abortController = null;       /* AbortController for the in-flight request */
let isLoading = false;            /* Guard against overlapping searches */

/* --- Official Open-Meteo (WMO) weather-code mapping --- */
/* Each code: description + icon key used for the weather visual. */
const WEATHER_CODES = {
    0:  { description: "Clear sky", icon: "clear-day" },
    1:  { description: "Mainly clear", icon: "clear-day" },
    2:  { description: "Partly cloudy", icon: "partly-cloudy-day" },
    3:  { description: "Overcast", icon: "overcast" },
    45: { description: "Fog", icon: "fog" },
    48: { description: "Depositing rime fog", icon: "fog" },
    51: { description: "Light drizzle", icon: "drizzle" },
    53: { description: "Moderate drizzle", icon: "drizzle" },
    55: { description: "Dense drizzle", icon: "drizzle" },
    56: { description: "Light freezing drizzle", icon: "freezing-drizzle" },
    57: { description: "Dense freezing drizzle", icon: "freezing-drizzle" },
    61: { description: "Slight rain", icon: "rain" },
    63: { description: "Moderate rain", icon: "rain" },
    65: { description: "Heavy rain", icon: "rain" },
    66: { description: "Light freezing rain", icon: "freezing-rain" },
    67: { description: "Heavy freezing rain", icon: "freezing-rain" },
    71: { description: "Slight snow", icon: "snow" },
    73: { description: "Moderate snow", icon: "snow" },
    75: { description: "Heavy snow", icon: "snow" },
    77: { description: "Snow grains", icon: "snow" },
    80: { description: "Slight rain showers", icon: "showers-day" },
    81: { description: "Moderate rain showers", icon: "showers-day" },
    82: { description: "Violent rain showers", icon: "showers-day" },
    85: { description: "Slight snow showers", icon: "snow-showers" },
    86: { description: "Heavy snow showers", icon: "snow-showers" },
    95: { description: "Thunderstorm", icon: "thunderstorm" },
    96: { description: "Thunderstorm with hail", icon: "thunderstorm-hail" },
    99: { description: "Heavy thunderstorm with hail", icon: "thunderstorm-hail" }
};

const UNKNOWN_CODE = { description: "Weather conditions unavailable", icon: "unknown" };

/* Inline SVG weather visuals (trusted internal templates, not user data). */
const WEATHER_ICONS = {
    "clear-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6B75A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    "clear-night": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8AB8D8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79"/></svg>`,
    "partly-cloudy-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6B75A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.73"/><path d="M14 15H8a3 3 0 0 1-3-3v-1z"/></svg>`,
    "overcast": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A9B7C2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 0 1-7-7v-3a7 7 0 0 1 7-7h3a7 7 0 0 1 7 7v3a7 7 0 0 1-7 7z"/></svg>`,
    "fog": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A9B7C2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h14M3 13h14M3 17h14"/></svg>`,
    "drizzle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8AB8D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/></svg>`,
    "freezing-drizzle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8AB8D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/><path d="M12 8l2-2 2 2"/></svg>`,
    "rain": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8AB8D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/></svg>`,
    "freezing-rain": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8AB8D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/><path d="M12 8l2-2 2 2"/></svg>`,
    "snow": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A9B7C2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/><path d="M12 14l-3 3M12 14l3 3M12 14l-3-3M12 14l3-3"/></svg>`,
    "snow-showers": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#A9B7C2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/><path d="M12 14l-3 3M12 14l3 3M12 14l-3-3M12 14l3-3M14 10l-2 2M14 10l2 2"/></svg>`,
    "showers-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6B75A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h3M19 21v-4M17 17v-2M15 13v-2M9 19v-4M11 15v-2M6 11v-2M21 17v-2M23 13v-2M21 9v-2"/><circle cx="12" cy="12" r="3" stroke="#E6B75A" stroke-width="2" fill="none"/></svg>`,
    "thunderstorm": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6B75A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></svg>`,
    "thunderstorm-hail": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6B75A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9z"/><circle cx="12" cy="14" r="1"/></svg>`,
    "unknown": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#728290" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
};

/* --- Helpers --- */

/** Show an accessible status message. type: "" | "error" | "success" | "loading" */
function showStatus(text, type = "") {
    statusEl.textContent = text;
    statusEl.className = "status";
    if (type) {
        statusEl.classList.add(`status--${type}`);
    }
}

/** Validate that a value is a finite number. */
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

/** Normalize text for comparison: trim, lowercase, Unicode-safe. */
function normalizeText(text) {
    if (typeof text !== "string") {
        return "";
    }
    return text.trim().toLowerCase();
}

/** Round a number to a fixed precision, safely. */
function roundNumber(value, decimals = 0) {
    if (!isFiniteNumber(value)) {
        return null;
    }
    return Number(value.toFixed(decimals));
}

/** Convert Celsius to Fahrenheit. */
function celsiusToFahrenheit(celsius) {
    if (!isFiniteNumber(celsius)) {
        return null;
    }
    return (celsius * 9 / 5) + 32;
}

/** Format a temperature for display based on current unit. */
function formatTemperature(celsius) {
    const value = currentUnit === "F" ? celsiusToFahrenheit(celsius) : celsius;
    if (value === null) {
        return "–";
    }
    const unit = currentUnit === "F" ? "°F" : "°C";
    return `${roundNumber(value)} ${unit}`;
}

/*
 * Deterministic location-ranking algorithm for smart city matching.
 *
 * Priority (per product directive):
 *   1. Exact city-name match (normalized).
 *   2. Genuine populated city/locality rather than an administrative area.
 *   3. Appropriate population ranking when available.
 *   4. Valid latitude and longitude (required).
 *   5. Relevant country and administrative-region context.
 *   6. Stable, deterministic tie-breaking.
 *
 * Returns the best-matching result, or null if no result has valid coordinates.
 */
function rankLocations(results, query) {
    const q = normalizeText(query);
    if (!q || !Array.isArray(results) || results.length === 0) {
        return null;
    }

    const scored = results.map((place) => {
        const name = normalizeText(place.name);
        let score = 0;

        /* 1. Exact name match. */
        if (name === q) {
            score += 120;
        } else if (name.startsWith(q)) {
            score += 80;
        } else if (q.startsWith(name) && name.length > 0) {
            score += 40;
        } else {
            /* Not a meaningful name match — deprioritize heavily but keep for ranking. */
            score += 5;
        }

        /* 2. Feature type: genuine populated place > administrative area > other. */
        const fc = String(place.feature_code || "").toUpperCase();
        if (fc === "PPLC" || fc === "PPLA") {
            score += 60; /* national/provincial capital or administrative centre */
        } else if (fc === "PPL") {
            score += 40; /* populated place */
        } else if (fc === "PPLX") {
            score += 20; /* section of populated place */
        } else if (fc === "PPLA2" || fc === "PPLA3" || fc === "PPLA4") {
            score += 10; /* secondary/tertiary admin division */
        } else if (fc === "AIRP" || fc === "AIRH") {
            score += 5; /* airport — not a city */
        } else if (fc === "MT" || fc === "MTN" || fc === "PASS") {
            score += 2; /* mountain / pass — not a city */
        } else if (fc === "PRK" || fc === "LAND" || fc === "AREA") {
            score += 1; /* park / landmark / area — not a city */
        }

        /* 3. Population when available (tiered, log-friendly). */
        const pop = Number(place.population || 0);
        if (pop >= 1000000) {
            score += 30;
        } else if (pop >= 100000) {
            score += 20;
        } else if (pop >= 10000) {
            score += 10;
        } else if (pop >= 1000) {
            score += 5;
        }

        /* 5. Country and administrative-region context. */
        if (place.country) {
            score += 15;
        }
        if (place.admin1) {
            score += 10;
        }

        return { place, score };
    });

    /* Filter out results without valid coordinates (priority 4). */
    const valid = scored.filter((s) =>
        isFiniteNumber(s.place.latitude) && isFiniteNumber(s.place.longitude)
    );

    if (valid.length === 0) {
        return null;
    }

    /* Stable deterministic sort: highest score first, then name ascending for tie-breaking. */
    valid.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        const na = normalizeText(a.place.name);
        const nb = normalizeText(b.place.name);
        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
    });

    return valid[0].place;
}

/** Get the weather-code entry, with a neutral fallback for unknown codes. */
function getWeatherCodeEntry(code) {
    if (!isFiniteNumber(code)) {
        return UNKNOWN_CODE;
    }
    return WEATHER_CODES[Math.round(code)] || UNKNOWN_CODE;
}

/** Build an <img> src from an inline SVG string. Safe: content is internal only. */
function svgDataUri(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Format local time for the searched location using its timezone. */
function formatLocalTime(timezone) {
    if (!timezone || typeof timezone !== "string") {
        return "";
    }
    try {
        return new Date().toLocaleString(undefined, {
            timeZone: timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (error) {
        return "";
    }
}

/* --- Request lifecycle --- */

/** Abort any in-flight request so stale responses cannot overwrite newer ones. */
function cancelCurrentRequest() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
}

/**
 * Geocode a city name using deterministic smart matching.
 * Automatically selects the best matching result — no user selection prompt.
 */
async function getCoordinates(city) {
    const trimmed = city.trim();
    if (!trimmed) {
        throw new Error("Please enter a city name.");
    }

    const url = new URL(GEOCODING_API);
    url.search = new URLSearchParams({
        name: trimmed,
        count: "10",
        language: "en",
        format: "json"
    });

    /* Abort any earlier request before starting a new one. */
    cancelCurrentRequest();
    const controller = new AbortController();
    abortController = controller;

    let response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Request cancelled.");
        }
        throw new Error("Unable to reach the geocoding service. Check your connection.");
    }

    if (!response.ok) {
        throw new Error("City search service is unavailable.");
    }

    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error("Invalid response from the geocoding service.");
    }

    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error("City not found. Please check the spelling and try again.");
    }

    /* Use deterministic ranking to select the best match. */
    const best = rankLocations(data.results, trimmed);

    if (!best) {
        throw new Error("No valid coordinates found for that city.");
    }

    return best;
}

/**
 * Fetch current + forecast weather for coordinates.
 * signal: AbortSignal so the request can be cancelled.
 */
async function getWeather(latitude, longitude, signal) {
    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
        throw new Error("Invalid coordinates.");
    }

    const url = new URL(FORECAST_API);
    url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "weather_code",
            "wind_speed_10m",
            "surface_pressure"
        ].join(","),
        hourly: ["temperature_2m", "weather_code"].join(","),
        daily: ["weather_code", "temperature_2m_max", "temperature_2m_min"].join(","),
        timezone: "auto"
    });

    let response;
    try {
        response = await fetch(url, { signal });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Request cancelled.");
        }
        throw new Error("Unable to reach the weather service. Check your connection.");
    }

    if (!response.ok) {
        throw new Error("Unable to retrieve weather data.");
    }

    let data;
    try {
        data = await response.json();
    } catch (error) {
        throw new Error("Invalid response from the weather service.");
    }

    if (!data || !data.current) {
        throw new Error("Weather information is unavailable.");
    }

    return data;
}

/* --- Rendering --- */

/** Render the current-weather card from validated API data. */
function displayWeather(place, data) {
    const current = data.current;
    if (!current) {
        throw new Error("No current weather data to display.");
    }

    weatherData = { place, data };

    const codeEntry = getWeatherCodeEntry(current.weather_code);
    const isDay = current.is_day === 1;

    /* City / country / local time. */
    cityNameEl.textContent = place.name || "Unknown location";
    const region = place.admin1 ? place.admin1 : "";
    const country = place.country ? place.country : "";
    cityCountryEl.textContent = [region, country].filter(Boolean).join(", ");
    localTimeEl.textContent = formatLocalTime(data.timezone);

    /* Temperature. */
    const tempC = isFiniteNumber(current.temperature_2m) ? current.temperature_2m : null;
    temperatureEl.textContent = tempC !== null ? formatTemperature(tempC) : "–";

    /* Condition. */
    conditionEl.textContent = codeEntry.description;

    /* Feels like note. */
    const feelsC = isFiniteNumber(current.apparent_temperature) ? current.apparent_temperature : null;
    if (feelsC !== null && tempC !== null) {
        const diff = roundNumber(feelsC - tempC, 1);
        const unitLabel = currentUnit === "F" ? "°F" : "°C";
        const displayFeels = currentUnit === "F" ? roundNumber(celsiusToFahrenheit(feelsC)) : roundNumber(feelsC);
        let phrase = "feels like the actual temperature";
        if (diff > 0) {
            phrase = `feels ${Math.abs(diff)}${unitLabel} warmer than actual`;
        } else if (diff < 0) {
            phrase = `feels ${Math.abs(diff)}${unitLabel} cooler than actual`;
        }
        feelsNoteEl.textContent = `Feels like ${displayFeels}${unitLabel}. ${phrase}.`;
    } else {
        feelsNoteEl.textContent = "";
    }

    /* Details with graceful missing-value handling. */
    feelsLikeEl.textContent = feelsC !== null ? formatTemperature(feelsC) : "–";
    humidityEl.textContent = isFiniteNumber(current.relative_humidity_2m)
        ? `${current.relative_humidity_2m}%`
        : "–";
    windSpeedEl.textContent = isFiniteNumber(current.wind_speed_10m)
        ? `${current.wind_speed_10m} km/h`
        : "–";
    pressureEl.textContent = isFiniteNumber(current.surface_pressure)
        ? `${roundNumber(current.surface_pressure)} hPa`
        : "–";

    /* Weather visual: trusted inline SVG, accessible alt text. */
    const iconSvg = WEATHER_ICONS[codeEntry.icon] || WEATHER_ICONS.unknown;
    weatherIconEl.src = svgDataUri(iconSvg);
    weatherIconEl.alt = codeEntry.description;

    /* Unit toggle label. */
    unitBtn.textContent = currentUnit === "C"
        ? "Switch to Fahrenheit (°F)"
        : "Switch to Celsius (°C)";
    unitBtn.disabled = false;

    /* Show card, hide picker. */
    weatherCard.hidden = false;
    locationPicker.hidden = true;

    /* Forecasts. */
    const locationNowMs = Date.now() + ((data.utc_offset_seconds || 0) * 1000);
    renderHourly(data.hourly, currentUnit, locationNowMs);
    renderDaily(data.daily, currentUnit);
}

/** Render upcoming hourly forecast. locationNowMs: location's current time in UTC ms. */
function renderHourly(hourly, unit, locationNowMs) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        hourlySection.hidden = true;
        return;
    }

    const items = [];
    for (let i = 0; i < hourly.time.length; i++) {
        const timeStr = hourly.time[i];
        const temp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
        const code = hourly.weather_code ? hourly.weather_code[i] : null;
        if (!timeStr || temp === null || code === null) {
            continue;
        }
        /* timeStr is a location wall-clock time; treat as UTC for comparison with locationNowMs. */
        const timeMs = new Date(timeStr + "Z").getTime();
        if (!Number.isFinite(timeMs) || timeMs < locationNowMs) {
            continue;
        }
        items.push({ time: timeStr, temp, code });
        if (items.length >= 12) {
            break;
        }
    }

    if (items.length === 0) {
        hourlySection.hidden = true;
        return;
    }

    hourlySection.hidden = false;
    hourlyListEl.innerHTML = ""; /* internal content only */
    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = "hour-card";
        article.innerHTML = `
            <span class="hour-time">${formatHourLabel(item.time)}</span>
            <img class="hour-icon" src="${svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown)}" alt="" width="36" height="36">
            <span class="hour-temp">${formatTemperature(item.temp)}</span>
        `;
        article.setAttribute("aria-label", `${formatHourLabel(item.time)}: ${entry.description}, ${formatTemperature(item.temp)}`);
        fragment.appendChild(article);
    }
    hourlyListEl.appendChild(fragment);
}

/** Render seven-day daily forecast. */
function renderDaily(daily, unit) {
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
        dailySection.hidden = true;
        return;
    }

    const items = [];
    for (let i = 0; i < daily.time.length; i++) {
        const timeStr = daily.time[i];
        const max = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;
        const min = daily.temperature_2m_min ? daily.temperature_2m_min[i] : null;
        const code = daily.weather_code ? daily.weather_code[i] : null;
        if (!timeStr || max === null || min === null || code === null) {
            continue;
        }
        items.push({ time: timeStr, max, min, code });
        if (items.length >= 7) {
            break;
        }
    }

    if (items.length === 0) {
        dailySection.hidden = true;
        return;
    }

    dailySection.hidden = false;
    dailyListEl.innerHTML = ""; /* internal content only */
    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = "day-card";
        article.innerHTML = `
            <span class="day-label">${formatDayLabel(item.time)}</span>
            <img class="day-icon" src="${svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown)}" alt="" width="40" height="40">
            <div class="day-temp"><span>${formatTemperature(item.max)}</span><span class="low">${formatTemperature(item.min)}</span></div>
        `;
        article.setAttribute("aria-label", `${formatDayLabel(item.time)}: ${entry.description}, high ${formatTemperature(item.max)}, low ${formatTemperature(item.min)}`);
        fragment.appendChild(article);
    }
    dailyListEl.appendChild(fragment);
}

/** Format an hourly ISO time into a short local label. */
function formatHourLabel(iso) {
    try {
        return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
        return iso;
    }
}

/** Format a daily ISO date into a weekday label. */
function formatDayLabel(iso) {
    try {
        return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
    } catch (error) {
        return iso;
    }
}

/* --- Location picker (ambiguous cities) --- */

function renderLocationPicker(candidates) {
    locationListEl.innerHTML = ""; /* internal content only */
    const fragment = document.createDocumentFragment();

    for (const place of candidates) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "place-choice";
        const detail = [place.admin1, place.country].filter(Boolean).join(", ");
        button.innerHTML = `
            <span class="place-name">${escapeHtml(place.name)}</span>
            <span class="place-detail">${escapeHtml(detail)}</span>
            <span class="place-coords">${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}</span>
        `;
        button.setAttribute("aria-label", `Select ${place.name}, ${detail}`);
        button.addEventListener("click", () => selectLocation(place));
        fragment.appendChild(button);
    }

    locationListEl.appendChild(fragment);
    weatherCard.hidden = true;
    hourlySection.hidden = true;
    dailySection.hidden = true;
    locationPicker.hidden = false;
    showStatus(`Multiple places matched. Select the one you meant.`);
}

function selectLocation(place) {
    locationPicker.hidden = true;
    showStatus(`Loading weather for ${place.name}…`, "loading");
    setLoading(true);
    fetchWeatherForPlace(place);
}

/* Escape text for internal SVG/HTML attribute injection (defensive). */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/* --- Core search flow --- */

async function fetchWeatherForPlace(place) {
    try {
        const data = await getWeather(place.latitude, place.longitude, abortController.signal);
        displayWeather(place, data);
        showStatus(`Weather updated for ${place.name}.`, "success");
    } catch (error) {
        if (error.name === "AbortError" || error.message === "Request cancelled.") {
            return; /* superseded by a newer request */
        }
        showStatus(error.message || "Something went wrong. Please try again.", "error");
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    isLoading = loading;
    searchBtn.disabled = loading;
    cityInput.disabled = loading;
    if (loading) {
        unitBtn.disabled = true;
    }
}

async function searchCity(city) {
    const trimmed = city.trim();
    if (!trimmed) {
        showStatus("Please enter a city name.", "error");
        cityInput.focus();
        return;
    }

    setLoading(true);
    showStatus("Searching for location…", "loading");
    weatherCard.hidden = true;
    locationPicker.hidden = true;

    try {
        const place = await getCoordinates(trimmed);
        await fetchWeatherForPlace(place);
    } catch (error) {
        if (error.message === "AMBIGUOUS" && Array.isArray(error.candidates)) {
            renderLocationPicker(error.candidates);
            setLoading(false);
            return;
        }
        showStatus(error.message || "Something went wrong. Please try again.", "error");
    } finally {
        if (!isLoading) {
            setLoading(false);
        }
    }
}

/* --- Event listeners --- */

form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchCity(cityInput.value);
});

unitBtn.addEventListener("click", () => {
    if (!weatherData) {
        return;
    }
    currentUnit = currentUnit === "C" ? "F" : "C";
    /* Re-render from cached data; no new API request. */
    displayWeather(weatherData.place, weatherData.data);
});

/* Allow cancelling a pending search by typing a new city. */
cityInput.addEventListener("input", () => {
    if (cityInput.value.trim() && isLoading) {
        cancelCurrentRequest();
    }
});
