/* Smart city-matching tests against the real js/app.js ranking code. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { assert, assertEqual, report } = require("./assert");

const code = fs.readFileSync(path.resolve(__dirname, "../js/app.js"), "utf8");
const fakeEl = {
    addEventListener() {},
    textContent: "",
    className: "",
    classList: { add() {}, remove() {}, contains() {} },
    hidden: true,
    disabled: false,
    src: "",
    alt: "",
    value: "",
    focus() {},
    setAttribute() {},
    append() {}
};
const sandbox = {
    document: {
        getElementById: () => fakeEl,
        createElement: () => fakeEl,
        createDocumentFragment: () => ({ appendChild() {} })
    },
    console
};
vm.runInNewContext(code, sandbox);

const { rankLocations, normalizeText } = sandbox;

function place(name, overrides = {}) {
    return {
        name,
        latitude: overrides.latitude ?? 0,
        longitude: overrides.longitude ?? 0,
        feature_code: overrides.feature_code ?? "PPL",
        country: overrides.country ?? "",
        country_code: overrides.country_code ?? "",
        admin1: overrides.admin1 ?? "",
        admin2: overrides.admin2 ?? "",
        population: overrides.population ?? 0,
        timezone: overrides.timezone ?? "",
        ...overrides
    };
}

function pickName(results, query) {
    const outcome = rankLocations(results, query);
    if (!outcome) return null;
    if (outcome.ambiguous) return { ambiguous: true, candidates: outcome.candidates.map((p) => p.name) };
    return outcome.place.name;
}

function pickFull(results, query) {
    return rankLocations(results, query);
}

/* ---- Fixtures derived from real Open-Meteo responses ---- */

const lahore = [
    place("Lahore", { latitude: 31.558, longitude: 74.35071, feature_code: "PPLA", country: "Pakistan", country_code: "PK", admin1: "Punjab", population: 13004135, timezone: "Asia/Karachi" }),
    place("Lahore", { latitude: 38.19875, longitude: -77.96944, feature_code: "PPL", country: "United States", country_code: "US", admin1: "Virginia", population: 0, timezone: "America/New_York" }),
    place("Kili Lahor", { latitude: 30.39561, longitude: 68.7627, feature_code: "PPL", country: "Pakistan", country_code: "PK", admin1: "Balochistan", population: 0, timezone: "Asia/Karachi" }),
    place("Lahore International Airport", { latitude: 31.52156, longitude: 74.40359, feature_code: "AIRP", country: "Pakistan", country_code: "PK", admin1: "Punjab", population: 0, timezone: "Asia/Karachi" }),
    place("Lahore Cantt", { latitude: 31.52942, longitude: 74.37727, feature_code: "PPL", country: "Pakistan", country_code: "PK", admin1: "Punjab", population: 0, timezone: "Asia/Karachi" }),
    place("Lahore City", { latitude: 31.49479, longitude: 74.34624, feature_code: "AIRP", country: "Pakistan", country_code: "PK", admin1: "Punjab", population: 0, timezone: "Asia/Karachi" })
];

const paris = [
    place("Paris", { latitude: 48.8534, longitude: 2.3488, feature_code: "PPLC", country: "France", country_code: "FR", admin1: "Île-de-France Region", population: 2138551, timezone: "Europe/Paris" }),
    place("Paris", { latitude: 33.66094, longitude: -95.55551, feature_code: "PPLA2", country: "United States", country_code: "US", admin1: "Texas", population: 24782, timezone: "America/Chicago" }),
    place("Paris", { latitude: 36.302, longitude: -88.3267, feature_code: "PPLA2", country: "United States", country_code: "US", admin1: "Tennessee", population: 10150, timezone: "America/Chicago" })
];

const london = [
    place("London", { latitude: 51.5085, longitude: -0.1257, feature_code: "PPLC", country: "United Kingdom", country_code: "GB", admin1: "England", population: 8961989, timezone: "Europe/London" }),
    place("London", { latitude: 42.9834, longitude: -81.233, feature_code: "PPL", country: "Canada", country_code: "CA", admin1: "Ontario", population: 422324, timezone: "America/Toronto" }),
    place("London", { latitude: 39.8865, longitude: -83.4483, feature_code: "PPLA2", country: "United States", country_code: "US", admin1: "Ohio", population: 10060, timezone: "America/New_York" })
];

const tokyo = [
    place("Tokyo", { latitude: 35.6895, longitude: 139.6917, feature_code: "PPLC", country: "Japan", country_code: "JP", admin1: "Tokyo", population: 9733276, timezone: "Asia/Tokyo" }),
    place("Tokyo Hill", { latitude: 26.9206, longitude: -97.8636, feature_code: "MT", country: "United States", country_code: "US", admin1: "Texas", population: 0, timezone: "America/Chicago" }),
    place("Tokyo Heliport", { latitude: 35.6333, longitude: 139.85, feature_code: "AIRH", country: "Japan", country_code: "JP", admin1: "Chiba", population: 0, timezone: "Asia/Tokyo" })
];

const karachi = [
    place("Karachi", { latitude: 24.8608, longitude: 67.0104, feature_code: "PPLA", country: "Pakistan", country_code: "PK", admin1: "Sindh", population: 11624219, timezone: "Asia/Karachi" }),
    place("Karachi", { latitude: 57.8539, longitude: 49.5594, feature_code: "PPL", country: "Russia", country_code: "RU", admin1: "Kirov Oblast", population: 0, timezone: "Europe/Kirov" })
];

/* ---- Single-city queries: automatic best match, no selection prompt ---- */

const rLahore = pickFull(lahore, "Lahore");
assert(rLahore && !rLahore.ambiguous, "Lahore → single best match, not ambiguous");
assertEqual(rLahore.place.name, "Lahore", "Lahore → selected name is Lahore");
assertEqual(rLahore.place.country, "Pakistan", "Lahore → country is Pakistan");
assertEqual(rLahore.place.admin1, "Punjab", "Lahore → region is Punjab");
assertEqual(rLahore.place.latitude, 31.558, "Lahore → latitude 31.558");
assertEqual(rLahore.place.longitude, 74.35071, "Lahore → longitude 74.35071");
assertEqual(rLahore.place.timezone, "Asia/Karachi", "Lahore → timezone Asia/Karachi");
assertEqual(rLahore.place.feature_code, "PPLA", "Lahore → genuine capital city (PPLA), not airport/locality");

assertEqual(pickName(lahore, "LAHORE"), "Lahore", "uppercase input normalizes");
assertEqual(pickName(lahore, "  lahore  "), "Lahore", "whitespace-padded input normalizes");
assertEqual(pickName(lahore, "Lahore, Pakistan"), "Lahore", "Lahore, Pakistan → best match");
assertEqual(pickName(lahore, "Lahore, Virginia"), "Lahore", "Lahore, Virginia → the US Lahore (context respected)");
assertEqual(pickName(lahore, "Lahore, India"), null, "Lahore, India → no reliable match (never silently wrong)");

assertEqual(pickName(paris, "Paris"), "Paris", "Paris → best match (Paris, France)");
assertEqual(rankLocations(paris, "Paris").place.country, "France", "Paris → France (most prominent match)");

assertEqual(pickName(paris, "Paris, Texas"), "Paris", "Paris, Texas → Paris, Texas, United States");
assertEqual(rankLocations(paris, "Paris, Texas").place.country, "United States", "Paris, Texas → United States");
assertEqual(rankLocations(paris, "Paris, Texas").place.admin1, "Texas", "Paris, Texas → region Texas");

const rParisFull = rankLocations(paris, "Paris, Texas, USA");
assert(rParisFull && !rParisFull.ambiguous, "Paris, Texas, USA → single match");
assertEqual(rParisFull.place.country, "United States", "Paris, Texas, USA → United States");
assertEqual(rParisFull.place.admin1, "Texas", "Paris, Texas, USA → Texas (explicit country never ignored)");
assertEqual(pickName(paris, "Paris, France"), "Paris", "Paris, France → Paris, France");
assertEqual(pickName(paris, "Paris, Germany"), null, "Paris, Germany → no reliable match (context never ignored)");

assertEqual(pickName(london, "London"), "London", "London → London, England, UK");
assertEqual(rankLocations(london, "London").place.country, "United Kingdom", "London → United Kingdom");

assertEqual(pickName(tokyo, "Tokyo"), "Tokyo", "Tokyo → Tokyo, Japan");
assertEqual(rankLocations(tokyo, "Tokyo").place.country, "Japan", "Tokyo → Japan");

assertEqual(pickName(karachi, "Karachi"), "Karachi", "Karachi → Karachi, Sindh, Pakistan");
assertEqual(rankLocations(karachi, "Karachi").place.admin1, "Sindh", "Karachi → Sindh");

/* ---- Deprioritization of non-city feature types ---- */
const airports = lahore.filter((p) => p.feature_code === "AIRP");
assert(pickName(lahore, "Lahore") !== "Lahore International Airport", "airport is not chosen over the city");
assert(pickName(lahore, "Lahore") !== "Lahore Cantt", "locality is not chosen over the capital");

/* ---- Coordinate validation ---- */
const missingCoords = [
    place("Nowhere", { latitude: null, longitude: 0, feature_code: "PPL", country: "Nowhereland" }),
    place("Somewhere", { latitude: 0, longitude: null, feature_code: "PPL", country: "Somewhereland" }),
    place("Valid", { latitude: 10, longitude: 20, feature_code: "PPL", country: "Validland" })
];
assertEqual(rankLocations(missingCoords, "Valid").place.name, "Valid", "results without valid coordinates are excluded");
assertEqual(rankLocations([missingCoords[0], missingCoords[1]], "Nowhere"), null, "no valid coordinates → null");

const outOfRange = [
    place("Bad", { latitude: 91, longitude: 0, feature_code: "PPL", country: "X" }),
    place("Good", { latitude: 10, longitude: 20, feature_code: "PPL", country: "X" })
];
assertEqual(rankLocations(outOfRange, "Good").place.name, "Good", "out-of-range coordinates are excluded");

/* ---- Empty / invalid input ---- */
assertEqual(rankLocations(lahore, ""), null, "empty query → null");
assertEqual(rankLocations(lahore, "   "), null, "whitespace-only query → null");
assertEqual(rankLocations([], "Lahore"), null, "empty results → null");
assertEqual(rankLocations(null, "Lahore"), null, "null results → null");
assertEqual(rankLocations(undefined, "Lahore"), null, "undefined results → null");

/* ---- Deterministic tie-breaking ---- */
const tie = [
    place("Springfield", { latitude: 1, longitude: 1, feature_code: "PPL", country: "Bland", population: 50000 }),
    place("Springfield", { latitude: 2, longitude: 2, feature_code: "PPL", country: "Aland", population: 50000 })
];
const tieOutcome = rankLocations(tie, "Springfield");
assert(tieOutcome && tieOutcome.ambiguous, "equal exact matches are reported as ambiguous");
assertEqual(tieOutcome.candidates[0].country, "Aland", "equal-score ambiguity order is stable by country");
const contradiction = rankLocations(paris, "Paris, Texas, France");
assertEqual(contradiction, null, "contradictory region and country are rejected");
assertEqual(pickName(paris, "Paris, Texas, USA"), "Paris", "USA alias validates the country context");
assertEqual(rankLocations([place("Paris", { feature_code: "AIRP", country: "France" })], "Paris"), null, "airport feature is excluded");

/* ---- Ambiguity: two strong, equally-plausible city matches ---- */
const springfield = [
    place("Springfield", { latitude: 39.78, longitude: -89.65, feature_code: "PPL", country: "United States", country_code: "US", admin1: "Illinois", population: 115000 }),
    place("Springfield", { latitude: 37.21, longitude: -93.29, feature_code: "PPL", country: "United States", country_code: "US", admin1: "Missouri", population: 170000 })
];
const amb = rankLocations(springfield, "Springfield");
assert(amb && amb.ambiguous, "two equal Springfield matches → ambiguous");
assert(amb.candidates.length === 2, "ambiguous result exposes both candidates");

/* ---- Normalization safety (Unicode) ---- */
assertEqual(normalizeText("  Lâhore  "), "lâhore", "Unicode text trimmed and lowercased");
assertEqual(normalizeText(null), "", "null normalizes to empty string");

/* ---- Mirpur, Pakistan ambiguity and explicit Azad Kashmir context ---- */
const mirpur = [
    place("Mirpur", { latitude: 33.148, longitude: 73.751, feature_code: "PPL", country: "Pakistan", country_code: "PK", admin1: "Azad Kashmir", population: 124000, timezone: "Asia/Karachi" }),
    place("Mirpur", { latitude: 32.24068, longitude: 75.34309, feature_code: "PPL", country: "Pakistan", country_code: "PK", admin1: "Punjab", population: 124000, timezone: "Asia/Karachi" })
];
const mirpurUnqualified = rankLocations(mirpur, "Mirpur");
assert(mirpurUnqualified && mirpurUnqualified.ambiguous, "unqualified Mirpur with distinct Pakistani regions is ambiguous");
assert(mirpurUnqualified.candidates.some((p) => p.admin1 === "Azad Kashmir"), "Mirpur ambiguity exposes Azad Kashmir candidate");
assert(mirpurUnqualified.candidates.some((p) => p.admin1 === "Punjab"), "Mirpur ambiguity exposes Punjab candidate");
assertEqual(pickFull(mirpur, "Mirpur, Pakistan").ambiguous, true, "country-only Mirpur query remains ambiguous across Pakistani regions");
assertEqual(pickFull(mirpur, "Mirpur, Azad Kashmir").place.admin1, "Azad Kashmir", "explicit Azad Kashmir selects the intended Mirpur");
assertEqual(pickFull(mirpur, "Mirpur, Azad Kashmir, Pakistan").place.admin1, "Azad Kashmir", "explicit Azad Kashmir and Pakistan select the intended Mirpur");
assertEqual(pickFull(mirpur, "Mirpur, Punjab, Pakistan").place.admin1, "Punjab", "explicit Punjab selects the distinct Mirpur");

report();
