/* Minimal assertion helper for the Weather App test suite. */
let passes = 0;
let failures = 0;

function assert(condition, message) {
    if (condition) {
        passes += 1;
        console.log(`  PASS - ${message}`);
    } else {
        failures += 1;
        console.error(`  FAIL - ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function report() {
    console.log(`\n${passes} passed, ${failures} failed\n`);
    process.exit(failures > 0 ? 1 : 0);
}

module.exports = { assert, assertEqual, report };
