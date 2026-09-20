import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/lib/grinderCalibration.ts"], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const calibration = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);

test("direct measurements take priority and fill missing clicks", () => {
  const points = { Custom: { "1": 500, "3": 900 } };
  assert.deepEqual(calibration.micronsForClick("Custom", 1, points), { um: 500, source: "user" });
  assert.deepEqual(calibration.micronsForClick("Custom", 2, points), { um: 700, source: "estimated" });
  assert.deepEqual(calibration.micronsForClick("Custom", 4, points), { um: 1100, source: "estimated", extrapolated: true });
});

test("new grinders need two direct measurements before conversion", () => {
  assert.equal(calibration.micronsForClick("Custom", 2, { Custom: { "1": 500 } }), null);
  assert.equal(calibration.clickForMicrons("Custom", 700, { Custom: { "1": 500 } }), null);
  assert.equal(calibration.clickForMicrons("Custom", 700, { Custom: { "1": 500, "3": 900 } }), 2);
});

test("built-in data remains available until personal measurements are added", () => {
  const result = calibration.micronsForClick("HammerHead", 20, {});
  assert.equal(result.source, "default");
  assert.equal(result.um, 935);
});

test("uses the final segment for nonlinear upper extrapolation and inverse conversion", () => {
  const points = { Custom: { "1": 100, "2": 200, "3": 400 } };
  assert.deepEqual(calibration.micronsForClick("Custom", 2.5, points), { um: 300, source: "estimated" });
  assert.deepEqual(calibration.micronsForClick("Custom", 4, points), { um: 600, source: "estimated", extrapolated: true });
  assert.equal(calibration.clickForMicrons("Custom", 600, points), 4);
  assert.equal(calibration.clickForMicrons("Custom", 0, points), 0);
  assert.equal(calibration.clickForMicrons("Custom", 250, { Custom: { "1": 100, "2": 200, "3": 150 } }), null);
});
