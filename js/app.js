/* ==========================================================================
   Atmos — Weather App
   Application logic
   ========================================================================== */

// --- API endpoints (only permitted external services) ---
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

// Pakistan-first geocoding: for unqualified city names (no explicit country
// context such as a comma), the geocoding request includes country_code=PK
// so the API prioritises Pakistani results.  If the user explicitly provides
// country or region context (e.g. "Paris, France"), the filter is omitted
// and the existing ranking algorithm respects the explicit context.
const PAKISTAN_COUNTRY_CODE = "PK";

/* Hard timeout for every network request. */
const REQUEST_TIMEOUT_MS = 15000;

/* Scores within this gap of the top result are treated as ambiguous. */
const AMBIGUITY_GAP = 20;

/* --- DOM elements --- */
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const weatherCard = document.getElementById("weather-card");
const unitBtn = document.getElementById("unit-btn");
const dataSourceEl = document.getElementById("data-source");

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

/* --- Application state --- */
let currentUnit = "C";            /* "C" or "F" */
let weatherData = null;           /* { place, data } cached for unit toggle */
let abortController = null;       /* AbortController for the in-flight request */
let isLoading = false;            /* Guard against overlapping searches */
let searchSequence = 0;           /* Monotonic id of the latest user-initiated search */

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

/**
 * Normalize text for comparison: trim, collapse internal whitespace,
 * lowercase (Unicode-aware).
 */
function normalizeText(text) {
    if (typeof text !== "string") {
        return "";
    }
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Round a number to a fixed precision, safely. */
function roundNumber(value, decimals = 0) {
    if (!isFiniteNumber(value)) {
        return null;
    }
    return Number(value.toFixed(decimals));
}

/** Convert Celsius to Fahrenheit. F = (C × 9/5) + 32. */
function celsiusToFahrenheit(celsius) {
    if (!isFiniteNumber(celsius)) {
        return null;
    }
    return (celsius * 9 / 5) + 32;
}

/**
 * Format a temperature for display based on the current unit.
 * Raw API values stay in Celsius; only the rendered value is converted.
 */
function formatTemperature(celsius) {
    const value = currentUnit === "F" ? celsiusToFahrenheit(celsius) : celsius;
    if (!isFiniteNumber(value)) {
        return "–";
    }
    const unit = currentUnit === "F" ? "°F" : "°C";
    return `${roundNumber(value)} ${unit}`;
}

/**
 * Parse a free-text city query into city part plus optional
 * country/region context parts: "Paris, Texas, USA" → ["Paris", "Texas", "USA"].
 */
function parseLocationQuery(query) {
    return String(query || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
}

/**
 * Score how well a geocoding result matches explicitly entered
 * country/region context. Exact match > prefix match > no match.
 */
function contextScore(place, contextParts) {
    if (!contextParts.length) return 0;
    const countryAliases = {
        usa: 'us', 'u.s.': 'us', 'united states of america': 'us',
        uk: 'gb', 'u.k.': 'gb', britain: 'gb', 'great britain': 'gb',
        uae: 'ae', 'u.a.e.': 'ae'
    };
    const country = normalizeText(place.country || '');
    const countryCode = normalizeText(place.country_code || '');
    const regions = [place.admin1, place.admin2, place.admin3, place.admin4]
        .map(normalizeText).filter(Boolean);
    let score = 0;
    for (const raw of contextParts) {
        const part = normalizeText(raw);
        if (!part) return -Infinity;
        const codeAlias = countryAliases[part];
        const isCountryMatch = (codeAlias && countryCode === codeAlias) ||
            country === part || countryCode === part;
        const isRegionMatch = regions.includes(part);
        // Every qualifier must match. A known country qualifier cannot be
        // satisfied by a region with the same text in a different country.
        const knownCountryCodes = Object.values(countryAliases);
        const looksLikeCountryCode = /^[a-z]{2}$/.test(part);
        if (looksLikeCountryCode && !isCountryMatch) return -Infinity;
        if (!isCountryMatch && !isRegionMatch) return -Infinity;
        score += isCountryMatch ? 90 : 70;
    }
    return score;
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
 * Explicit country/region context entered by the user is never ignored:
 * results that do not match the context are excluded.
 *
 * Returns:
 *   { place }                      — single best match
 *   { ambiguous: true, candidates } — multiple confident matches; caller refines
 *   null                           — no usable result
 */
function rankLocations(results, query) {
    const parts = parseLocationQuery(query);
    const city = normalizeText(parts[0]).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!city || !Array.isArray(results) || results.length === 0) {
        return null;
    }

    const scored = [];
    for (const place of results) {
        if (!place || typeof place !== "object") {
            continue;
        }

        const name = normalizeText(place.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let score = 0;
        let nameMatched = false;

        /* 1. City-name match. */
        if (name === city) {
            score += 100;
            nameMatched = true;
        } else {
            continue; // Only exact normalized city matches are reliable.
        }

        /* 2. GeoNames populated-place features are eligible; landmarks and airports are not. */
        const fc = String(place.feature_code || "").toUpperCase();
        if (fc && !fc.startsWith("PPL")) continue;
        if (fc === "PPLC" || fc === "PPLA") {
            score += 60; /* national / provincial capital */
        } else if (fc === "PPL") {
            score += 40; /* populated place */
        } else if (fc === "PPLX") {
            score += 20; /* section of a populated place */
        } else if (fc === "PPLA2" || fc === "PPLA3" || fc === "PPLA4") {
            score += 10; /* secondary / tertiary administrative division */
        } else if (fc === "AIRP" || fc === "AIRH" || fc === "AIRF") {
            score += 5; /* airport — not a city */
        } else if (fc === "MT" || fc === "MTN" || fc === "PASS") {
            score += 2; /* mountain / pass — not a city */
        } else if (fc === "PRK" || fc === "LAND" || fc === "AREA") {
            score += 1; /* park / landmark / area — not a city */
        }

        /* 3. Population when available. */
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

        /* 5. Explicit country / administrative-region context (never ignored). */
        const ctx = contextScore(place, parts.slice(1));
        if (ctx === -Infinity) continue;
        score += ctx;

        /* 4. Valid coordinates (required before any weather request). */
        if (!isFiniteNumber(place.latitude) || !isFiniteNumber(place.longitude)) {
            continue;
        }
        if (Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) {
            continue;
        }
        score += 10;

        scored.push({ place, score, nameMatched });
    }

    if (scored.length === 0) {
        return null;
    }

    /* 6. Stable deterministic sort: highest score first, then name ascending. */
    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        const na = normalizeText(a.place.name);
        const nb = normalizeText(b.place.name);
        if (na !== nb) return na < nb ? -1 : 1;
        const ca = normalizeText(a.place.country_code || a.place.country || "");
        const cb = normalizeText(b.place.country_code || b.place.country || "");
        if (ca !== cb) return ca < cb ? -1 : 1;
        const aa = normalizeText(a.place.admin1 || "");
        const ab = normalizeText(b.place.admin1 || "");
        if (aa !== ab) return aa < ab ? -1 : 1;
        return (a.place.latitude - b.place.latitude) || (a.place.longitude - b.place.longitude);
    });

    /* Confidence check: two strong, equally-plausible city matches means we
       cannot establish the intended location without more context. */
    if (scored.length >= 2) {
        const gap = scored[0].score - scored[1].score;
        if (gap <= AMBIGUITY_GAP && scored[0].nameMatched && scored[1].nameMatched) {
            return {
                ambiguous: true,
                candidates: scored
                    .filter((entry) => scored[0].score - entry.score <= AMBIGUITY_GAP)
                    .map((entry) => entry.place)
            };
        }
    }

    return { place: scored[0].place };
}

/** Get the weather-code entry, with a neutral fallback for unknown codes. */
function getWeatherCodeEntry(code) {
    if (!isFiniteNumber(code)) {
        return UNKNOWN_CODE;
    }
    return WEATHER_CODES[Math.round(code)] || UNKNOWN_CODE;
}

/** Build an  src from an inline SVG string. Safe: content is internal only. */
function svgDataUri(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Format local time for the searched location using its API timezone. */
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
 * Fetch with a hard timeout plus external cancellation.
 * An already-aborted external signal results in "Request cancelled."
 */
async function abortableFetch(url, { signal } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const unlisten = signal
        ? signal.addEventListener("abort", () => controller.abort(), { once: true })
        : null;

    try {
        return await fetch(url, { signal: controller.signal });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(timedOut ? "Request timed out. Please try again." : "Request cancelled.");
        }
        throw error;
    } finally {
        clearTimeout(timer);
        if (unlisten) {
            unlisten();
        }
    }
}

/**
 * Geocode a city name using deterministic smart matching.
 * Ambiguous results are returned for explicit user selection.
 *
 * Pakistan-first strategy:
 * - For unqualified city names (no explicit country/region context,
 i.e. no comma in the query), the geocoding request includes
 *   country_code=PK so the API prioritises Pakistani candidates.
 * - If the user explicitly enters a comma-separated query (e.g.
 *   "Paris, France", "London, United Kingdom", "Haripur, Pakistan"),
 *   the filter is omitted and the ranking algorithm handles the
 *   explicit context via its normal country/region matching logic.
 */
async function getCoordinates(city) {
    const trimmed = String(city || "").trim();
    if (!trimmed) throw new Error("Please enter a city name.");
    const queryParts = parseLocationQuery(trimmed);
    const unqualified = queryParts.length === 1;
    const controller = new AbortController();
    cancelCurrentRequest();
    abortController = controller;

    const requestCandidates = async (countryCode) => {
        const url = new URL(GEOCODING_API);
        url.search = new URLSearchParams({
            name: queryParts.slice(0, 2).join(", "),
            count: "10", language: "en", format: "json"
        });
        if (countryCode) url.searchParams.set("countryCode", countryCode);
        let response;
        try {
            response = await abortableFetch(url, { signal: controller.signal });
        } catch (error) {
            if (["Request cancelled.", "Request timed out. Please try again."].includes(error.message)) throw error;
            throw new Error("Unable to reach the geocoding service. Check your connection.");
        }
        if (!response.ok) throw new Error("City search service is unavailable.");
        let data;
        try { data = await response.json(); }
        catch { throw new Error("Invalid response from the geocoding service."); }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid response from the geocoding service.");
        }
        /* Open-Meteo omits `results` when a valid search has no matches. */
        if (data.results === undefined && !data.error) return [];
        if (!Array.isArray(data.results)) throw new Error("Invalid response from the geocoding service.");
        return data.results;
    };

    const select = (results) => rankLocations(results, trimmed);
    let outcome;
    if (unqualified) {
        const pakistanResults = await requestCandidates(PAKISTAN_COUNTRY_CODE);
        outcome = select(pakistanResults.filter((p) => normalizeText(p.country_code) === "pk"));
        if (outcome && !outcome.ambiguous) return { place: outcome.place };
        if (!outcome) {
            // No reliable Pakistani match: use the unrestricted index for
            // international cities such as London and Tokyo.
            const globalResults = await requestCandidates(null);
            outcome = select(globalResults);
        }
    } else {
        const results = await requestCandidates(null);
        outcome = select(results);
    }

    if (outcome && outcome.ambiguous) {
        const error = new Error("MULTIPLE_LOCATIONS");
        error.candidates = outcome.candidates;
        throw error;
    }
    if (!outcome || !outcome.place) {
        throw new Error("No reliable match found. Check the spelling, or add the country or region (e.g. \"Paris, France\").");
    }
    return { place: outcome.place };
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
            "pressure_msl"
        ].join(","),
        hourly: ["temperature_2m", "weather_code"].join(","),
        daily: ["weather_code", "temperature_2m_max", "temperature_2m_min"].join(","),
        timezone: "auto",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh"
    });

    let response;
    try {
        response = await abortableFetch(url, { signal });
    } catch (error) {
        if (error.message === "Request cancelled.") {
            throw error;
        }
        if (error.message === "Request timed out. Please try again.") {
            throw error;
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

    if (!data || !data.current || typeof data.current !== "object" ||
        typeof data.timezone !== "string" || !data.timezone ||
        !data.current_units || data.current_units.temperature_2m !== "°C" ||
        data.current_units.wind_speed_10m !== "km/h" ||
        data.current_units.pressure_msl !== "hPa" ||
        !data.hourly_units || data.hourly_units.temperature_2m !== "°C" ||
        !data.daily_units || data.daily_units.temperature_2m_max !== "°C" ||
        data.daily_units.temperature_2m_min !== "°C") {
        throw new Error("Weather information is unavailable or has unexpected units.");
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

    /* Prefer the night variant for clear conditions after sunset. */
    let iconKey = codeEntry.icon;
    if (iconKey === "clear-day" && isDay === false) {
        iconKey = "clear-night";
    }

    /* City / country / local time. */
    cityNameEl.textContent = place.name || "Unknown location";
    const region = place.admin1 ? place.admin1 : "";
    const country = place.country ? place.country : "";
    cityCountryEl.textContent = [region, country].filter(Boolean).join(", ");
    localTimeEl.textContent = formatLocalTime(data.timezone);

    /* Temperature (actual). */
    const tempC = isFiniteNumber(current.temperature_2m) ? current.temperature_2m : null;
    temperatureEl.textContent = tempC !== null ? formatTemperature(tempC) : "–";

    /* Condition. */
    conditionEl.textContent = codeEntry.description;

    /* Feels-like temperature (distinct from actual temperature). */
    const feelsC = isFiniteNumber(current.apparent_temperature) ? current.apparent_temperature : null;
    if (feelsC !== null && tempC !== null) {
        const tempDisp = currentUnit === "F" ? celsiusToFahrenheit(tempC) : tempC;
        const feelsDisp = currentUnit === "F" ? celsiusToFahrenheit(feelsC) : feelsC;
        const diff = roundNumber(feelsDisp - tempDisp, 1);
        const unitLabel = currentUnit === "F" ? "°F" : "°C";
        const displayFeels = roundNumber(feelsDisp);
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
    pressureEl.textContent = isFiniteNumber(current.pressure_msl)
        ? `${roundNumber(current.pressure_msl)} hPa`
        : "–";

    /* Source transparency: genuine provider + observation timestamp. */
    const updated = data.current.time ? String(data.current.time).slice(11, 16) : "";
    dataSourceEl.textContent = updated
        ? `Open-Meteo model estimate · ${updated} local time`
        : "Open-Meteo model estimate";

    /* Weather visual: trusted inline SVG, accessible alt text. */
    const iconSvg = WEATHER_ICONS[iconKey] || WEATHER_ICONS.unknown;
    weatherIconEl.src = svgDataUri(iconSvg);
    weatherIconEl.alt = codeEntry.description;

    /* Unit toggle label. */
    unitBtn.textContent = currentUnit === "C"
        ? "Switch to Fahrenheit (°F)"
        : "Switch to Celsius (°C)";
    unitBtn.disabled = false;

    /* Show weather card. */
    weatherCard.hidden = false;

    /* Forecasts. */
    renderHourly(data.hourly, currentUnit, data.current.time);
    renderDaily(data.daily, currentUnit);
}

/** Render upcoming hourly forecast using the API's local wall-clock timestamps. */
function renderHourly(hourly, unit, currentLocalTime) {
    if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
        hourlySection.hidden = true;
        return;
    }

    const items = [];
    for (let i = 0; i < hourly.time.length; i++) {
        const timeStr = hourly.time[i];
        const temp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
        const code = hourly.weather_code ? hourly.weather_code[i] : null;
        if (!timeStr || !isFiniteNumber(temp) || !isFiniteNumber(code)) continue;
        // API timestamps are in the selected location's timezone. Lexical ISO
        // comparison avoids applying the browser timezone or a stale UTC offset.
        if (typeof currentLocalTime === "string" && timeStr < currentLocalTime) continue;
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
    hourlyListEl.textContent = "";
    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = "hour-card";
        article.setAttribute(
            "aria-label",
            `${formatHourLabel(item.time)}: ${entry.description}, ${formatTemperature(item.temp)}`
        );

        const timeEl = document.createElement("span");
        timeEl.className = "hour-time";
        timeEl.textContent = formatHourLabel(item.time);

        const iconEl = document.createElement("img");
        iconEl.className = "hour-icon";
        iconEl.src = svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown);
        iconEl.alt = "";
        iconEl.width = 36;
        iconEl.height = 36;

        const tempEl = document.createElement("span");
        tempEl.className = "hour-temp";
        tempEl.textContent = formatTemperature(item.temp);

        article.append(timeEl, iconEl, tempEl);
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
        if (!timeStr || !isFiniteNumber(max) || !isFiniteNumber(min) || !isFiniteNumber(code)) continue;
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
    dailyListEl.textContent = "";
    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = "day-card";
        article.setAttribute(
            "aria-label",
            `${formatDayLabel(item.time)}: ${entry.description}, high ${formatTemperature(item.max)}, low ${formatTemperature(item.min)}`
        );

        const labelEl = document.createElement("span");
        labelEl.className = "day-label";
        labelEl.textContent = formatDayLabel(item.time);

        const iconEl = document.createElement("img");
        iconEl.className = "day-icon";
        iconEl.src = svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown);
        iconEl.alt = "";
        iconEl.width = 40;
        iconEl.height = 40;

        const tempEl = document.createElement("div");
        tempEl.className = "day-temp";
        const highEl = document.createElement("span");
        highEl.textContent = formatTemperature(item.max);
        const lowEl = document.createElement("span");
        lowEl.className = "low";
        lowEl.textContent = formatTemperature(item.min);
        tempEl.append(highEl, lowEl);

        article.append(labelEl, iconEl, tempEl);
        fragment.appendChild(article);
    }
    dailyListEl.appendChild(fragment);
}

/** Format an hourly ISO time into a short local label (wall-clock slice). */
function formatHourLabel(iso) {
    try {
        const s = String(iso);
        const m = s.match(/T(\d{2}:\d{2})/);
        return m ? m[1] : new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
        return String(iso);
    }
}

/** Format a daily ISO date into a weekday label (timezone-safe). */
function formatDayLabel(iso) {
    try {
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) {
            return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
        }
        const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (!Number.isFinite(ms)) {
            return String(iso);
        }
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return days[new Date(ms).getUTCDay()];
    } catch (error) {
        return String(iso);
    }
}

/* --- Core search flow --- */

function showMultipleLocationsMessage(candidates) {
    showStatus("Multiple locations match. Choose the intended location below, or add a region to your search.");
    const choices = document.createElement("span");
    choices.className = "location-choices";
    for (const place of candidates) {
        const context = [place.admin1, place.country].filter(Boolean).join(", ");
        const coordinates = `${Number(place.latitude).toFixed(5)}, ${Number(place.longitude).toFixed(5)}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "location-choice";
        button.textContent = `${place.name}${context ? ` — ${context}` : ""} (${coordinates})`;
        button.setAttribute("aria-label", `Select ${place.name}, ${context || "location"}, at ${coordinates}`);
        button.addEventListener("click", () => loadChosenPlace(place));
        choices.append(button);
    }
    statusEl.append(" ", choices);
}

async function fetchWeatherForPlace(place, sequence) {
    try {
        const data = await getWeather(place.latitude, place.longitude, abortController.signal);
        if (sequence !== searchSequence) return;
        displayWeather(place, data);
        showStatus(`Weather updated for ${place.name}.`, "success");
    } catch (error) {
        if (sequence !== searchSequence || error.name === "AbortError" || error.message === "Request cancelled.") {
            return; /* superseded by a newer request */
        }
        showStatus(error.message || "Something went wrong. Please try again.", "error");
    }
}

function setLoading(loading) {
    isLoading = loading;
    searchBtn.disabled = loading;
    cityInput.disabled = loading;
    unitBtn.disabled = loading;
}

async function loadChosenPlace(place) {
    const sequence = ++searchSequence;
    cancelCurrentRequest();
    abortController = new AbortController();
    cityInput.value = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    weatherCard.hidden = true;
    hourlySection.hidden = true;
    dailySection.hidden = true;
    weatherData = null;
    setLoading(true);
    showStatus(`Loading weather for ${place.name}…`, "loading");
    try {
        await fetchWeatherForPlace(place, sequence);
    } finally {
        if (sequence === searchSequence) setLoading(false);
    }
}

async function searchCity(city) {
    const trimmed = city.trim();
    if (!trimmed) {
        showStatus("Please enter a city name.", "error");
        cityInput.focus();
        return;
    }

    /* Only the latest search may restore the loading state, so an older,
       slower request cannot prematurely re-enable controls for a newer one. */
    const sequence = ++searchSequence;
    setLoading(true);
    showStatus("Searching for location…", "loading");
    weatherCard.hidden = true;
    hourlySection.hidden = true;
    dailySection.hidden = true;
    weatherData = null;

    try {
        const result = await getCoordinates(trimmed);
        if (sequence !== searchSequence) return;
        await fetchWeatherForPlace(result.place, sequence);
    } catch (error) {
        if (error.message === "Request cancelled.") {
            return; /* superseded by a newer request */
        }
        if (error.candidates && Array.isArray(error.candidates)) {
            showMultipleLocationsMessage(error.candidates);
            if (sequence === searchSequence) {
                setLoading(false);
            }
            return;
        }
        showStatus(error.message || "Something went wrong. Please try again.", "error");
    } finally {
        if (sequence === searchSequence) {
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
