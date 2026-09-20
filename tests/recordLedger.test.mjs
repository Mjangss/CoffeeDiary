import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/lib/recordLedger.ts"],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { saveBrewRecord, deleteBrewDiary, cancelBrewRecord, reviseInitialWeight } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

const record = (id, dose, baseClick, inventoryId = "a") => ({
  id, createdAt: `2026-09-${id === "r1" ? "17" : "18"}T00:00:00Z`,
  bean: "bean", method: "Brew", grinder: "Millab M01", dripper: "V60",
  switchApplied: false, dose, baseClick, inventoryId,
});
const payload = () => ({
  records: [], profiles: {}, beans: [], recipes: [],
  inventory: [
    { id: "a", initialWeight: 100, remainingWeight: 100, status: "ACTIVE", manualLogs: [] },
    { id: "b", initialWeight: 50, remainingWeight: 50, status: "ACTIVE", manualLogs: [] },
  ],
});

test("record correction and inventory move keep stock, logs and profile aligned", () => {
  const created = saveBrewRecord(payload(), record("r1", 20, 4));
  assert.equal(created.inventory[0].remainingWeight, 80);
  assert.equal(created.inventory[0].manualLogs[0].recordId, "r1");
  assert.ok(created.inventory[0].manualLogs[0].id);
  const corrected = saveBrewRecord(created, record("r1", 30, 6));
  assert.equal(corrected.inventory[0].remainingWeight, 70);
  assert.equal(corrected.inventory[0].manualLogs.at(-1).amount, 10);
  assert.equal(corrected.inventory[0].manualLogs.at(-1).type, "DEC");
  assert.equal(Object.values(corrected.profiles)[0].baseClick, 6);
  const moved = saveBrewRecord(corrected, record("r1", 30, 6, "b"));
  assert.equal(moved.inventory[0].remainingWeight, 100);
  assert.equal(moved.inventory[1].remainingWeight, 20);
  assert.equal(moved.records[0].inventoryId, "b");
  assert.equal(moved.inventory[0].manualLogs.at(-1).type, "INC");
  assert.equal(moved.inventory[1].manualLogs.at(-1).recordId, "r1");
  const deleted = deleteBrewDiary(moved, "r1");
  assert.equal(deleted.records.length, 0);
  assert.equal(deleted.inventory[1].remainingWeight, 20);
  assert.deepEqual(deleted.profiles, {});
});

test("profiles recalculate after edit or diary deletion", () => {
  const first = saveBrewRecord(payload(), record("r1", 20, 4));
  const second = saveBrewRecord(first, record("r2", 20, 6));
  assert.equal(Object.values(second.profiles)[0].baseClick, 5);
  assert.equal(Object.values(second.profiles)[0].sampleCount, 2);
  const deleted = deleteBrewDiary(second, "r1");
  assert.equal(Object.values(deleted.profiles)[0].baseClick, 6);
  assert.equal(Object.values(deleted.profiles)[0].sampleCount, 1);
  const renamed = saveBrewRecord(second, { ...record("r1", 20, 4), bean: "other" });
  assert.equal(Object.keys(renamed.profiles).length, 2);
  assert.deepEqual(Object.values(renamed.profiles).map(profile => profile.sampleCount).sort(), [1, 1]);
});

test("explicit extraction cancellation restores stock only with linked debit history", () => {
  const created = saveBrewRecord(payload(), record("r1", 20, 4));
  const cancelled = cancelBrewRecord(created, "r1");
  assert.equal(cancelled.inventory[0].remainingWeight, 100);
  assert.equal(cancelled.inventory[0].manualLogs.at(-1).recordId, "r1");
  assert.equal(cancelled.inventory[0].manualLogs.at(-1).type, "INC");
  assert.equal(cancelled.records.length, 0);
  const moved = saveBrewRecord(created, record("r1", 20, 4, "b"));
  const movedCancelled = cancelBrewRecord(moved, "r1");
  assert.equal(movedCancelled.inventory[0].remainingWeight, 100);
  assert.equal(movedCancelled.inventory[1].remainingWeight, 50);
  const legacy = { ...created, inventory: created.inventory.map(item => ({ ...item, manualLogs: [] })) };
  assert.throws(() => cancelBrewRecord(legacy, "r1"), /이력/);
  assert.equal(legacy.inventory[0].remainingWeight, 80);
});

test("cancellation restores a record linked to inventory after creation", () => {
  const withoutInventory = saveBrewRecord(payload(), { ...record("r1", 20, 4), inventoryId: undefined });
  const linked = saveBrewRecord(withoutInventory, record("r1", 20, 4, "a"));
  assert.equal(linked.inventory[0].remainingWeight, 80);
  const cancelled = cancelBrewRecord(linked, "r1");
  assert.equal(cancelled.inventory[0].remainingWeight, 100);
  assert.equal(cancelled.records.length, 0);
});

test("insufficient stock rejects correction without mutating prior data", () => {
  const created = saveBrewRecord(payload(), record("r1", 20, 4));
  assert.throws(() => saveBrewRecord(created, record("r1", 101, 4)), /사용량/);
  const depleted = { ...created, inventory: created.inventory.map(item => item.id === "a" ? { ...item, remainingWeight: 0 } : item) };
  assert.throws(() => saveBrewRecord(depleted, record("r1", 30, 4)), /잔량/);
  assert.equal(depleted.inventory[0].remainingWeight, 0);
});

test("editing initial stock keeps prior consumption", () => {
  const item = { initialWeight: 200, remainingWeight: 150 };
  assert.equal(reviseInitialWeight(item, 250).remainingWeight, 200);
  assert.equal(reviseInitialWeight(reviseInitialWeight(item, 250), 180).remainingWeight, 130);
});
