import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({ entryPoints: ["src/utils/index.ts"], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { calcInventoryRestDays, getAgingStatus } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);
const now = new Date("2026-09-18T00:00:00Z").getTime();

test("all inventory views use the same frozen-adjusted rest days", () => {
  const active = { roastDate: "2026-09-10T00:00:00Z", status: "ACTIVE", frozenDurationMs: 0 };
  const frozen = { ...active, status: "FROZEN", frozenDurationMs: 2 * 86400000, lastFrozenAt: "2026-09-15T00:00:00Z" };
  assert.equal(calcInventoryRestDays(active, now), 8);
  assert.equal(calcInventoryRestDays(frozen, now), 3);
  assert.equal(calcInventoryRestDays({ ...frozen, status: "ACTIVE" }, now), 6);
});

test("peak status uses frozen-adjusted rest days", () => {
  const inventory = { roastDate: "2026-08-19T00:00:00Z", status: "ACTIVE", frozenDurationMs: 20 * 86400000 };
  const restDays = calcInventoryRestDays(inventory, now);
  assert.equal(restDays, 10);
  assert.equal(getAgingStatus({ peakStart: 7, peakEnd: 21 }, restDays), "PEAK");
  assert.equal(getAgingStatus({ peakStart: 7, peakEnd: 21 }, 30), "PAST_PEAK");
});
