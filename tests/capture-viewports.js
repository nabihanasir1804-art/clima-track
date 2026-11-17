/* Script to capture genuine Chromium screenshots across all target viewports and README documentation assets */
const {spawn} = require("child_process");
const path = require("path");
const fs = require("fs");
const ROOT = path.resolve(__dirname, "..");
const http = require("http");
const puppeteer = require("puppeteer");

const PORT = 18774;
const BASE = `http://127.0.0.1:${PORT}`;
const TESTS_ASSETS_DIR = path.join(__dirname, "assets");
const DOC_ASSETS_DIR = path.join(ROOT, "assets");

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "laptop-1280x800", width: 1280, height: 800 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "small-mobile-320x700", width: 320, height: 700 }
];

const locations = {
  Haripur: {
    name: "Haripur",
    latitude: 33.99783,
    longitude: 72.93493,
    feature_code: "PPLA2",
    country_code: "PK",
    country: "Pakistan",
    admin1: "Khyber Pakhtunkhwa",
    timezone: "Asia/Karachi",
    population: 100000
  },
  Lahore: {
    name: "Lahore",
    latitude: 31.558,
    longitude: 74.35071,
    feature_code: "PPLA",
    country_code: "PK",
    country: "Pakistan",
    admin1: "Punjab",
    timezone: "Asia/Karachi",
    population: 13000000
  }
};

function weather(place) {
  const currentTime = "2026-11-17T12:00";
  const hourlyTimes = Array.from({length: 24}, (_, i) => `2026-11-17T${String(i).padStart(2, "0")}:00`);
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    timezone_abbreviation: "PKT",
    utc_offset_seconds: 18000,
    current_units: {
      time: "iso8601",
      interval: "seconds",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      apparent_temperature: "°C",
      is_day: "",
      weather_code: "wmo code",
      wind_speed_10m: "km/h",
      pressure_msl: "hPa"
    },
    current: {
      time: currentTime,
      interval: 900,
      temperature_2m: 24.3,
      relative_humidity_2m: 52,
      apparent_temperature: 25.1,
      is_day: 1,
      weather_code: 2,
      wind_speed_10m: 13.2,
      pressure_msl: 1008.7
    },
    hourly_units: {
      time: "iso8601",
      temperature_2m: "°C",
      weather_code: "wmo code"
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map((_, i) => 22 + Math.sin(i / 3) * 4),
      weather_code: hourlyTimes.map(() => 2)
    },
    daily_units: {
      time: "iso8601",
      weather_code: "wmo code",
      temperature_2m_max: "°C",
      temperature_2m_min: "°C"
    },
    daily: {
      time: Array.from({length: 7}, (_, i) => `2026-11-${String(17 + i).padStart(2, "0")}`),
      weather_code: [2, 1, 3, 61, 2, 0, 1],
      temperature_2m_max: [28, 27, 26, 23, 25, 27, 28],
      temperature_2m_min: [17, 16, 15, 14, 15, 16, 17]
    }
  };
}

(async () => {
  let server, browser;
  try {
    server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {cwd: ROOT, stdio: "ignore"});
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        await new Promise((resolve, reject) => {
          const r = http.get(`${BASE}/`, x => { x.resume(); resolve(); });
          r.on("error", reject);
        });
        ready = true;
        break;
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    if (!ready) throw new Error("Local server failed to start");

    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", req => {
      const u = new URL(req.url());
      if (u.hostname === "geocoding-api.open-meteo.com") {
        const q = u.searchParams.get("name")?.trim();
        const loc = locations[q] || locations.Lahore;
        req.respond({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ results: [loc] })
        });
        return;
      }
      if (u.hostname === "api.open-meteo.com") {
        const lat = Number(u.searchParams.get("latitude"));
        const loc = Object.values(locations).find(x => Math.abs(x.latitude - lat) < 0.1) || locations.Lahore;
        req.respond({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(weather(loc))
        });
        return;
      }
      req.continue();
    });

    // 1. Capture Welcome states for all viewports (test evidence)
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
      const filename = `welcome-${vp.name}.png`;
      const filePath = path.join(TESTS_ASSETS_DIR, filename);
      await page.screenshot({ path: filePath, fullPage: false });
    }

    // Capture official README Welcome Screenshot (1440x900)
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: path.join(DOC_ASSETS_DIR, "screenshot-welcome.png"), fullPage: false });
    console.log("Captured assets/screenshot-welcome.png");

    // 2. Load weather for Lahore and capture Weather states
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await page.$eval("#city-input", (e, v) => { e.value = v; }, "Lahore");
    await page.click("#search-btn");
    await page.waitForFunction(() => !document.querySelector("#weather-card").hidden && document.querySelector("#city-name").textContent.trim() === "Lahore", { timeout: 5000 });

    // Official README Lahore Weather Screenshot (Desktop 1440px full page)
    await page.setViewport({ width: 1440, height: 1020 });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: path.join(DOC_ASSETS_DIR, "screenshot-lahore-weather.png"), fullPage: false });
    console.log("Captured assets/screenshot-lahore-weather.png");

    // Official README Forecast Focus Screenshot (Seven-Day Outlook & Hourly timeline)
    const dailySection = await page.$("#daily-section");
    if (dailySection) {
      await dailySection.screenshot({ path: path.join(DOC_ASSETS_DIR, "screenshot-forecast.png") });
      console.log("Captured assets/screenshot-forecast.png");
    }

    // Official README Mobile Screenshot (390px, full page showing reflow)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: path.join(DOC_ASSETS_DIR, "screenshot-mobile.png"), fullPage: true });
    console.log("Captured assets/screenshot-mobile.png");

    // Test evidence multi-viewport screenshots
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 150));
      const filename = `weather-${vp.name}.png`;
      const filePath = path.join(TESTS_ASSETS_DIR, filename);
      await page.screenshot({ path: filePath, fullPage: false });
    }

    console.log("ALL DOCUMENTATION AND VIEWPORT SCREENSHOTS SUCCESSFULLY CAPTURED!");
  } catch (err) {
    console.error("Capture failed:", err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
})();
