import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/utils/validation.ts"],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { validMeasure, validGrinderRange, validStockOutflow, validPourTime, validRecipeTimeline } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

test("measure and stock rules reject negative, non-finite, off-step and excess values", () => {
  assert.equal(validMeasure(20.1, 1, 100, 0.1), true);
  for (const value of [-20, 0, 100.01, Infinity, NaN, 1.05]) {
    assert.equal(validMeasure(value, 1, 100, 0.1), false);
  }
  assert.equal(validStockOutflow(20, 100), true);
  assert.equal(validStockOutflow(0.1, 0.3 - 0.2), true);
  assert.equal(validStockOutflow(120, 100), false);
  assert.equal(validStockOutflow(-20, 100), false);
  assert.equal(validStockOutflow(20, -1), false);
});

test("grinder range and pour chronology must be usable", () => {
  assert.equal(validGrinderRange(0.1, 10, 0.1), true);
  assert.equal(validGrinderRange(10, 1, 0.1), false);
  assert.equal(validGrinderRange(0, 10, 0), false);
  assert.equal(validGrinderRange(0, 10, Infinity), false);
  assert.equal(validPourTime("0:45", "1:30"), true);
  assert.equal(validPourTime("01:30", "00:45"), false);
  assert.equal(validPourTime("01:30", "01:30"), false);
  assert.equal(validPourTime("00:99", "01:30"), false);
});

test("recipe timelines reject empty, reversed and overlapping stages", () => {
  assert.match(validRecipeTimeline([{ start: "00:00", end: "00:00", waterMl: 0 }]), /최소/);
  assert.match(validRecipeTimeline([{ start: "01:00", end: "00:30", waterMl: 0 }]), /시작/);
  assert.match(validRecipeTimeline([
    { start: "00:00", end: "01:00", waterMl: 40 },
    { start: "00:30", end: "01:30", waterMl: 0 },
  ]), /겹칩니다/);
  assert.equal(validRecipeTimeline([
    { start: "00:00", end: "00:45", waterMl: 0 },
    { start: "00:45", end: "01:30", waterMl: 60 },
  ]), "");
});
