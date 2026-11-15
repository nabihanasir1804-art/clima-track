/* Temperature conversion tests against the real js/app.js code. */
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
    setTimeout,
    clearTimeout,
    console
};
vm.runInNewContext(code, sandbox);

const { formatTemperature, celsiusToFahrenheit } = sandbox;

/** Set currentUnit inside the running context (sandbox property writes don't reach let bindings). */
function setUnit(unit) {
    vm.runInNewContext(`currentUnit = "${unit}";`, sandbox);
}

/* --- Formula correctness --- */
assertEqual(celsiusToFahrenheit(0), 32, "0°C = 32°F");
assertEqual(celsiusToFahrenheit(100), 212, "100°C = 212°F");
assertEqual(celsiusToFahrenheit(-40), -40, "−40°C = −40°F");
assertEqual(celsiusToFahrenheit(11), 51.8, "11°C = 51.8°F before rounding");
assertEqual(celsiusToFahrenheit(null), null, "non-finite input → null");
assertEqual(celsiusToFahrenheit(NaN), null, "NaN input → null");
assertEqual(celsiusToFahrenheit("hot"), null, "string input → null");

/* --- Default unit: Celsius --- */
setUnit("C");
assertEqual(formatTemperature(0), "0 °C", "0°C displays as 0 °C");
assertEqual(formatTemperature(11), "11 °C", "11°C displays as 11 °C");
assertEqual(formatTemperature(-5), "-5 °C", "negative Celsius displays correctly");
assertEqual(formatTemperature(18.8), "19 °C", "18.8°C rounds to 19 °C");
assertEqual(formatTemperature(null), "–", "null temperature → –");
assertEqual(formatTemperature(undefined), "–", "undefined temperature → –");
assertEqual(formatTemperature(NaN), "–", "NaN temperature → –");

/* --- Fahrenheit unit --- */
setUnit("F");
assertEqual(formatTemperature(0), "32 °F", "0°C = 32°F display");
assertEqual(formatTemperature(100), "212 °F", "100°C = 212°F display");
assertEqual(formatTemperature(-40), "-40 °F", "−40°C = −40°F display");
assertEqual(formatTemperature(11), "52 °F", "11°C = 51.8°F → 52 °F display");
assertEqual(formatTemperature(18.8), "66 °F", "18.8°C ≈ 65.8°F → 66 °F display");
assertEqual(formatTemperature(null), "–", "null temperature → – (F)");

/* --- No double conversion on toggle --- */
setUnit("C");
const cFirst = formatTemperature(11);        // "11 °C"
setUnit("F");
const fSecond = formatTemperature(11);       // "52 °F" (converted from raw 11°C once)
setUnit("C");
const cAgain = formatTemperature(11);        // back to "11 °C"
assertEqual(cFirst, "11 °C", "Celsius first render");
assertEqual(fSecond, "52 °F", "Fahrenheit converted once from raw Celsius");
assertEqual(cAgain, "11 °C", "switching back to Celsius shows original value");

report();
