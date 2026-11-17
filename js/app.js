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
const welcomeGuideEl = document.getElementById("welcome-guide");

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

/* High-fidelity vector SVG weather visuals (trusted internal templates, not user data). */
const WEATHER_ICONS = {
    "clear-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="14" fill="#F59E0B" fill-opacity="0.25"/>
        <circle cx="32" cy="32" r="11" fill="url(#sun-grad)"/>
        <g stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round">
            <line x1="32" y1="8" x2="32" y2="13"/>
            <line x1="32" y1="51" x2="32" y2="56"/>
            <line x1="8" y1="32" x2="13" y2="32"/>
            <line x1="51" y1="32" x2="56" y2="32"/>
            <line x1="15" y1="15" x2="18.5" y2="18.5"/>
            <line x1="45.5" y1="45.5" x2="49" y2="49"/>
            <line x1="15" y1="49" x2="18.5" y2="45.5"/>
            <line x1="45.5" y1="18.5" x2="49" y2="15"/>
        </g>
        <defs>
            <linearGradient id="sun-grad" x1="21" y1="21" x2="43" y2="43" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FDE68A"/>
                <stop offset="1" stop-color="#D97706"/>
            </linearGradient>
        </defs>
    </svg>`,

    "clear-night": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M42 16.5A18.5 18.5 0 1 1 20 49 20 20 0 0 0 42 16.5z" fill="url(#moon-grad)" stroke="#38BDF8" stroke-width="1.5"/>
        <circle cx="48" cy="19" r="1.5" fill="#E0F2FE"/>
        <circle cx="53" cy="29" r="1.2" fill="#BAE6FD"/>
        <circle cx="43" cy="38" r="1" fill="#7DD3FC"/>
        <path d="M21 16l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z" fill="#FDE047"/>
        <defs>
            <linearGradient id="moon-grad" x1="16" y1="16" x2="44" y2="48" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E0F2FE"/>
                <stop offset="1" stop-color="#38BDF8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "partly-cloudy-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <circle cx="26" cy="24" r="9" fill="#F59E0B"/>
        <g stroke="#F59E0B" stroke-width="2" stroke-linecap="round">
            <line x1="26" y1="7" x2="26" y2="11"/>
            <line x1="12" y1="24" x2="16" y2="24"/>
            <line x1="16" y1="14" x2="19" y2="17"/>
            <line x1="36" y1="14" x2="33" y2="17"/>
        </g>
        <path d="M20 46h24a10 10 0 0 0 2-19.8 14 14 0 0 0-25-3.2A11 11 0 0 0 20 46z" fill="url(#cloud-grad)" stroke="#94A3B8" stroke-width="1.5"/>
        <defs>
            <linearGradient id="cloud-grad" x1="15" y1="20" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "partly-cloudy-night": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M32 14A14 14 0 0 1 18 30 16 16 0 1 0 32 14z" fill="url(#pcn-moon)" stroke="#38BDF8" stroke-width="1.5"/>
        <circle cx="36" cy="18" r="1.2" fill="#E0F2FE"/>
        <circle cx="42" cy="24" r="1" fill="#7DD3FC"/>
        <path d="M20 46h24a10 10 0 0 0 2-19.8 14 14 0 0 0-25-3.2A11 11 0 0 0 20 46z" fill="url(#pcn-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <defs>
            <linearGradient id="pcn-moon" x1="16" y1="14" x2="32" y2="30" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E0F2FE"/>
                <stop offset="1" stop-color="#38BDF8"/>
            </linearGradient>
            <linearGradient id="pcn-cloud" x1="15" y1="20" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "overcast": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M26 30h22a9 9 0 0 0 1.8-17.8 12 12 0 0 0-21.6-2.9A10 10 0 0 0 26 30z" fill="#475569" fill-opacity="0.6"/>
        <path d="M16 48h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 48z" fill="url(#overcast-grad)" stroke="#64748B" stroke-width="1.5"/>
        <defs>
            <linearGradient id="overcast-grad" x1="10" y1="20" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stop-color="#CBD5E1"/>
                <stop offset="1" stop-color="#64748B"/>
            </linearGradient>
        </defs>
    </svg>`,

    "fog": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <g stroke="url(#fog-grad)" stroke-width="3" stroke-linecap="round">
            <line x1="12" y1="22" x2="52" y2="22"/>
            <line x1="16" y1="30" x2="48" y2="30"/>
            <line x1="10" y1="38" x2="54" y2="38"/>
            <line x1="18" y1="46" x2="46" y2="46"/>
        </g>
        <defs>
            <linearGradient id="fog-grad" x1="10" y1="34" x2="54" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#94A3B8"/>
                <stop offset="0.5" stop-color="#E2E8F0"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "drizzle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M16 36h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 36z" fill="url(#drizzle-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <g stroke="#38BDF8" stroke-width="2" stroke-linecap="round">
            <line x1="20" y1="42" x2="18" y2="47"/>
            <line x1="32" y1="42" x2="30" y2="47"/>
            <line x1="44" y1="42" x2="42" y2="47"/>
            <line x1="26" y1="48" x2="24" y2="53"/>
            <line x1="38" y1="48" x2="36" y2="53"/>
        </g>
        <defs>
            <linearGradient id="drizzle-cloud" x1="10" y1="10" x2="48" y2="36" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F1F5F9"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "freezing-drizzle": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M16 34h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 34z" fill="url(#fdrizzle-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <g stroke="#38BDF8" stroke-width="2" stroke-linecap="round">
            <line x1="22" y1="40" x2="20" y2="46"/>
            <line x1="42" y1="40" x2="40" y2="46"/>
        </g>
        <g fill="#7DD3FC">
            <circle cx="32" cy="45" r="2"/>
            <circle cx="24" cy="53" r="1.8"/>
            <circle cx="40" cy="53" r="1.8"/>
        </g>
        <defs>
            <linearGradient id="fdrizzle-cloud" x1="10" y1="10" x2="48" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E2E8F0"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "rain": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M16 34h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 34z" fill="url(#rain-cloud)" stroke="#64748B" stroke-width="1.5"/>
        <g stroke="#0284C7" stroke-width="2.5" stroke-linecap="round">
            <line x1="22" y1="40" x2="18" y2="49"/>
            <line x1="32" y1="40" x2="28" y2="49"/>
            <line x1="42" y1="40" x2="38" y2="49"/>
            <line x1="27" y1="48" x2="23" y2="57"/>
            <line x1="37" y1="48" x2="33" y2="57"/>
        </g>
        <defs>
            <linearGradient id="rain-cloud" x1="10" y1="10" x2="48" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#CBD5E1"/>
                <stop offset="1" stop-color="#64748B"/>
            </linearGradient>
        </defs>
    </svg>`,

    "freezing-rain": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M16 34h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 34z" fill="url(#frain-cloud)" stroke="#64748B" stroke-width="1.5"/>
        <g stroke="#0284C7" stroke-width="2" stroke-linecap="round">
            <line x1="20" y1="40" x2="17" y2="48"/>
            <line x1="44" y1="40" x2="41" y2="48"/>
        </g>
        <g stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round">
            <line x1="31" y1="42" x2="31" y2="50"/>
            <line x1="27" y1="46" x2="35" y2="46"/>
            <line x1="28" y1="43" x2="34" y2="49"/>
            <line x1="28" y1="49" x2="34" y2="43"/>
        </g>
        <defs>
            <linearGradient id="frain-cloud" x1="10" y1="10" x2="48" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#CBD5E1"/>
                <stop offset="1" stop-color="#475569"/>
            </linearGradient>
        </defs>
    </svg>`,

    "snow": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <g stroke="#E0F2FE" stroke-width="2.5" stroke-linecap="round">
            <line x1="32" y1="12" x2="32" y2="52"/>
            <line x1="14.7" y1="22" x2="49.3" y2="42"/>
            <line x1="14.7" y1="42" x2="49.3" y2="22"/>
        </g>
        <g stroke="#7DD3FC" stroke-width="2" stroke-linecap="round">
            <path d="M32 18l-3 3m3-3l3 3M32 46l-3-3m3 3l3-3"/>
            <path d="M20 25l0 4m0-4l4 0M44 39l0-4m0 4l-4 0"/>
            <path d="M20 39l4 0m-4 0l0-4M44 25l-4 0m4 0l0 4"/>
        </g>
        <circle cx="32" cy="32" r="3" fill="#BAE6FD"/>
    </svg>`,

    "snow-showers": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M16 32h30a11 11 0 0 0 2.2-21.8 15 15 0 0 0-27-3.5A12 12 0 0 0 16 32z" fill="url(#snow-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <g fill="#E0F2FE">
            <circle cx="22" cy="42" r="2.2"/>
            <circle cx="32" cy="40" r="2.5"/>
            <circle cx="42" cy="43" r="2"/>
            <circle cx="26" cy="50" r="2"/>
            <circle cx="38" cy="51" r="2.2"/>
        </g>
        <defs>
            <linearGradient id="snow-cloud" x1="10" y1="10" x2="48" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#F8FAFC"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "showers-day": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <circle cx="26" cy="22" r="8" fill="#F59E0B"/>
        <path d="M20 38h24a9 9 0 0 0 1.8-17.8 13 13 0 0 0-23.2-3A10 10 0 0 0 20 38z" fill="url(#shday-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <g stroke="#0284C7" stroke-width="2.5" stroke-linecap="round">
            <line x1="24" y1="44" x2="21" y2="52"/>
            <line x1="33" y1="44" x2="30" y2="52"/>
            <line x1="42" y1="44" x2="39" y2="52"/>
        </g>
        <defs>
            <linearGradient id="shday-cloud" x1="15" y1="16" x2="45" y2="38" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "showers-night": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M30 14A12 12 0 0 1 18 28 14 14 0 1 0 30 14z" fill="url(#shn-moon)" stroke="#38BDF8" stroke-width="1.2"/>
        <path d="M20 38h24a9 9 0 0 0 1.8-17.8 13 13 0 0 0-23.2-3A10 10 0 0 0 20 38z" fill="url(#shn-cloud)" stroke="#94A3B8" stroke-width="1.5"/>
        <g stroke="#0284C7" stroke-width="2.5" stroke-linecap="round">
            <line x1="24" y1="44" x2="21" y2="52"/>
            <line x1="33" y1="44" x2="30" y2="52"/>
            <line x1="42" y1="44" x2="39" y2="52"/>
        </g>
        <defs>
            <linearGradient id="shn-moon" x1="16" y1="14" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E0F2FE"/>
                <stop offset="1" stop-color="#38BDF8"/>
            </linearGradient>
            <linearGradient id="shn-cloud" x1="15" y1="16" x2="45" y2="38" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#94A3B8"/>
            </linearGradient>
        </defs>
    </svg>`,

    "thunderstorm": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M14 34h34a12 12 0 0 0 2.4-23.8 16 16 0 0 0-29.4-3.8A13 13 0 0 0 14 34z" fill="url(#tstorm-cloud)" stroke="#475569" stroke-width="1.5"/>
        <path d="M33 30l-7 14h6l-3 12 11-16h-7l5-10z" fill="#FBBF24" stroke="#D97706" stroke-width="1.5" stroke-linejoin="round"/>
        <defs>
            <linearGradient id="tstorm-cloud" x1="10" y1="8" x2="50" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#64748B"/>
                <stop offset="1" stop-color="#1E293B"/>
            </linearGradient>
        </defs>
    </svg>`,

    "thunderstorm-hail": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <path d="M14 34h34a12 12 0 0 0 2.4-23.8 16 16 0 0 0-29.4-3.8A13 13 0 0 0 14 34z" fill="url(#thail-cloud)" stroke="#475569" stroke-width="1.5"/>
        <path d="M30 30l-6 12h5l-2.5 10 9-13h-5.5l4-9z" fill="#FBBF24" stroke="#D97706" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="44" cy="42" r="2.2" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1"/>
        <circle cx="41" cy="51" r="2" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1"/>
        <circle cx="18" cy="46" r="2" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1"/>
        <defs>
            <linearGradient id="thail-cloud" x1="10" y1="8" x2="50" y2="34" gradientUnits="userSpaceOnUse">
                <stop stop-color="#64748B"/>
                <stop offset="1" stop-color="#1E293B"/>
            </linearGradient>
        </defs>
    </svg>`,

    "unknown": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="22" stroke="#64748B" stroke-width="2.5" stroke-dasharray="4 4"/>
        <circle cx="32" cy="32" r="4" fill="#94A3B8"/>
        <path d="M32 16v6M32 42v6M16 32h6M42 32h6" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
    </svg>`
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

/** Build an <img> src from an inline SVG string. Safe: content is internal only. */
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

    /* Prefer the night variant for clear/cloud/shower conditions after sunset. */
    let iconKey = codeEntry.icon;
    if (isDay === false) {
        if (iconKey === "clear-day") iconKey = "clear-night";
        else if (iconKey === "partly-cloudy-day") iconKey = "partly-cloudy-night";
        else if (iconKey === "showers-day") iconKey = "showers-night";
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

    /* Feels-like temperature. */
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

    /* Details. */
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

    /* Source transparency. */
    const updated = data.current.time ? String(data.current.time).slice(11, 16) : "";
    dataSourceEl.textContent = updated
        ? `Open-Meteo model estimate · ${updated} local time`
        : "Open-Meteo model estimate";

    /* Weather visual. */
    const iconSvg = WEATHER_ICONS[iconKey] || WEATHER_ICONS.unknown;
    weatherIconEl.src = svgDataUri(iconSvg);
    weatherIconEl.alt = codeEntry.description;

    /* Unit toggle label. */
    unitBtn.textContent = currentUnit === "C"
        ? "Switch to Fahrenheit (°F)"
        : "Switch to Celsius (°C)";
    unitBtn.disabled = false;

    /* Show weather card and hide welcome guide. */
    if (welcomeGuideEl) welcomeGuideEl.hidden = true;
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

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = i === 0 ? "hour-card hour-card--now" : "hour-card";
        article.setAttribute(
            "aria-label",
            `${formatHourLabel(item.time)}: ${entry.description}, ${formatTemperature(item.temp)}`
        );

        const timeEl = document.createElement("span");
        timeEl.className = "hour-time";
        timeEl.textContent = i === 0 ? "Now" : formatHourLabel(item.time);

        const iconEl = document.createElement("img");
        iconEl.className = "hour-icon";
        iconEl.src = svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown);
        iconEl.alt = "";
        iconEl.width = 32;
        iconEl.height = 32;

        const tempEl = document.createElement("span");
        tempEl.className = "hour-temp";
        tempEl.textContent = formatTemperature(item.temp);

        article.append(timeEl, iconEl, tempEl);
        fragment.appendChild(article);
    }
    hourlyListEl.appendChild(fragment);
}

/** Render seven-day daily forecast with visual temperature range bars. */
function renderDaily(daily, unit) {
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
        dailySection.hidden = true;
        return;
    }

    const items = [];
    const validMins = [];
    const validMaxs = [];
    for (let i = 0; i < daily.time.length; i++) {
        const timeStr = daily.time[i];
        const max = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;
        const min = daily.temperature_2m_min ? daily.temperature_2m_min[i] : null;
        const code = daily.weather_code ? daily.weather_code[i] : null;
        if (!timeStr || !isFiniteNumber(max) || !isFiniteNumber(min) || !isFiniteNumber(code)) continue;
        items.push({ time: timeStr, max, min, code });
        validMins.push(min);
        validMaxs.push(max);
        if (items.length >= 7) {
            break;
        }
    }

    if (items.length === 0) {
        dailySection.hidden = true;
        return;
    }

    const weekMin = validMins.length ? Math.min(...validMins) : 0;
    const weekMax = validMaxs.length ? Math.max(...validMaxs) : 0;
    const rawSpan = weekMax - weekMin;
    const rangeSpan = rawSpan > 0 ? rawSpan : 1;

    dailySection.hidden = false;
    dailyListEl.textContent = "";
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = getWeatherCodeEntry(item.code);
        const article = document.createElement("article");
        article.className = "day-card";
        article.setAttribute(
            "aria-label",
            `${formatDayLabel(item.time)}: ${entry.description}, high ${formatTemperature(item.max)}, low ${formatTemperature(item.min)}`
        );

        const labelEl = document.createElement("span");
        labelEl.className = "day-label";
        labelEl.textContent = i === 0 ? "Today" : formatDayLabel(item.time);

        const iconEl = document.createElement("img");
        iconEl.className = "day-icon";
        iconEl.src = svgDataUri(WEATHER_ICONS[entry.icon] || WEATHER_ICONS.unknown);
        iconEl.alt = "";
        iconEl.width = 28;
        iconEl.height = 28;

        const conditionEl = document.createElement("span");
        conditionEl.className = "day-condition-text";
        conditionEl.textContent = entry.description;

        // Visual Temperature Range Bar
        const tempCluster = document.createElement("div");
        tempCluster.className = "day-temp-cluster";

        const minEl = document.createElement("span");
        minEl.className = "range-min";
        minEl.textContent = formatTemperature(item.min);

        const trackEl = document.createElement("div");
        trackEl.className = "range-track";

        if (rawSpan > 0) {
            const leftPct = Math.max(0, Math.min(94, ((item.min - weekMin) / rangeSpan) * 100));
            const rightPct = Math.max(0, Math.min(100, ((weekMax - item.max) / rangeSpan) * 100));
            const barWidth = Math.max(6, Math.min(100 - leftPct, 100 - leftPct - rightPct));

            const barEl = document.createElement("div");
            barEl.className = "range-bar";
            barEl.style.left = `${leftPct.toFixed(1)}%`;
            barEl.style.width = `${barWidth.toFixed(1)}%`;
            trackEl.append(barEl);
        } else {
            const dotEl = document.createElement("div");
            dotEl.className = "range-bar range-bar--flat";
            dotEl.style.left = "45%";
            dotEl.style.width = "10%";
            trackEl.append(dotEl);
        }

        const maxEl = document.createElement("span");
        maxEl.className = "range-max";
        maxEl.textContent = formatTemperature(item.max);

        tempCluster.append(minEl, trackEl, maxEl);

        article.append(labelEl, iconEl, conditionEl, tempCluster);
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

    if (welcomeGuideEl) welcomeGuideEl.hidden = true;

    /* Only the latest search may restore the loading state. */
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

/* Quick search chips */
if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll(".quick-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const city = chip.dataset.city;
            if (city) {
                cityInput.value = city;
                searchCity(city);
            }
        });
    });
}

/* Allow cancelling a pending search by typing a new city. */
cityInput.addEventListener("input", () => {
    if (cityInput.value.trim() && isLoading) {
        cancelCurrentRequest();
    }
});
