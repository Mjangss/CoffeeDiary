import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/lib/localDiary.ts"], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { localDiaryKey, parseDiary, parseAndMigratePayload, serializeDiary, emptyDiary, hasDiaryData } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

test("guest and each account use separate local keys", () => {
  const store = new Map();
  store.set(localDiaryKey(null), JSON.stringify({ records: [{ id: "guest" }] }));
  store.set(localDiaryKey("account-a"), JSON.stringify({ records: [{ id: "a" }] }));
  store.set(localDiaryKey("account-b"), JSON.stringify({ records: [{ id: "b" }] }));
  assert.equal(new Set(store.keys()).size, 3);
  assert.equal(store.has("notion-grind-engine-v3"), false);
  assert.equal(parseDiary(store.get(localDiaryKey("account-b"))).records[0].id, "b");
  assert.equal(parseDiary(store.get(localDiaryKey(null))).records[0].id, "guest");
});

test("older partial local data is preserved with safe defaults", () => {
  const loaded = parseDiary(JSON.stringify({ records: [{ id: "old" }], settings: { theme: { pointColor: "#123456" } } }));
  assert.equal(loaded.records[0].id, "old");
  assert.deepEqual(loaded.beans, []);
  assert.equal(loaded.settings.theme.pointColor, "#123456");
  assert.equal(typeof loaded.settings.theme.isDarkMode, "boolean");
  assert.equal(hasDiaryData(loaded), true);
  assert.equal(hasDiaryData(emptyDiary()), false);
});

test("malformed account data is rejected before it can replace another account", () => {
  assert.throws(() => parseDiary("{broken"));
  assert.throws(() => parseDiary(JSON.stringify({ records: "not-an-array" })));
  assert.throws(() => parseDiary(JSON.stringify({ records: [null] })));
  assert.throws(() => parseAndMigratePayload({ schemaVersion: 99, records: [] }));
  assert.throws(() => parseAndMigratePayload({ settings: { theme: null } }));
  assert.throws(() => parseAndMigratePayload({ settings: { theme: { uiScale: "huge" } } }));
  assert.throws(() => parseAndMigratePayload({ settings: { grinders: { bad: null } } }));
  assert.throws(() => parseAndMigratePayload({ recipes: [{ pours: [null] }] }));
});

test("backup and cloud data use the same migration", () => {
  const legacy = { records: [{ id: "old", method: "OXO", scoreAverage: 6.3 }], settings: { theme: { pointColor: "#123456" } } };
  const local = parseDiary(JSON.stringify(legacy));
  assert.deepEqual(local, parseAndMigratePayload(legacy));
  assert.equal(local.records[0].scoreAverage, 6.3);
  assert.equal(local.settings.theme.pointColor, "#123456");
  assert.equal(JSON.parse(serializeDiary(local)).schemaVersion, 4);
  assert.equal(serializeDiary(parseDiary(serializeDiary(local))), serializeDiary(local));
});

test("legacy data receives stable links without guessing duplicate beans", () => {
  const loaded = parseAndMigratePayload({
    schemaVersion: 2,
    beans: [{ name: "same", roastery: "A" }, { name: "same", roastery: "B" }, { name: "one", roastery: "C" }],
    inventory: [{ id: "a", beanName: "same", roastery: "A" }, { id: "b", beanName: "same" }, { id: "c", beanName: "one", roastery: "C" }],
    recipes: [{ id: "recipe", name: "daily", pours: [] }],
    records: [{ id: "record", bean: "one", recipe: "daily" }],
  });
  assert.ok(loaded.beans.every(bean => bean.id && bean.createdAt));
  assert.equal(loaded.inventory[0].beanId, loaded.beans[0].id);
  assert.equal(loaded.inventory[1].beanId, undefined);
  assert.equal(loaded.inventory[2].beanId, loaded.beans[2].id);
  assert.equal(loaded.records[0].beanId, loaded.beans[2].id);
  assert.equal(loaded.records[0].recipeId, "recipe");
  assert.equal(loaded.records[0].recipeSnapshot.name, "daily");
});
