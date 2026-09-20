import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  stdin: {
    contents: 'export { hydratePersistedData } from "./src/utils/hydration.ts"; export { normalizeClock } from "./src/utils/index.ts";',
    resolveDir: process.cwd(),
    sourcefile: "hydration-check.ts",
    loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { hydratePersistedData, normalizeClock } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

const restore = hydratePersistedData;

test("colon times preserve minute and second boundaries", () => {
  assert.equal(normalizeClock("0:45"), "00:45");
  assert.equal(normalizeClock("1:30"), "01:30");
  assert.equal(normalizeClock("00:45"), "00:45");
  assert.equal(normalizeClock("0130"), "01:30");
  assert.equal(normalizeClock("1:999"), "00:00");
});

test("legacy cloud data keeps OXO filters, average precision and recipe times", () => {
  const result = restore({
    inventory: [{ id: "i", frozenRestDays: 12 }],
    recipes: [{ id: "recipe", pours: [{ order: 1, start: "0:45", end: "1:30", waterMl: 40, switchState: "닫힘" }] }],
    records: [{ id: "record", method: "OXO", oxoUpperFilter: "메탈", oxoLowerFilter: "없음", scoreAverage: 6.3 }],
  });
  assert.equal(result.records[0].oxoUpperFilter, "메탈");
  assert.equal(result.records[0].oxoLowerFilter, "없음");
  assert.equal(result.records[0].scoreAverage, 6.3);
  assert.equal(result.recipes[0].pours[0].start, "00:45");
  assert.equal(result.recipes[0].pours[0].end, "01:30");
  assert.equal(result.inventory[0].frozenRestDays, 12);
});

test("current cloud rows hydrate without reconstruction", () => {
  const records = [{ id: "record", method: "OXO", oxoUpperFilter: "메탈", oxoLowerFilter: "없음", scoreAverage: 6.3, memo: "  keep spaces  " }];
  const recipes = [{ id: "recipe", pours: [{ order: 2, start: "00:45", end: "01:30", waterMl: 40, switchState: "닫힘" }] }];
  const inventory = [{ id: "i", frozenRestDays: 12 }];
  const result = restore({ schemaVersion: 4, records, recipes, inventory });
  assert.deepEqual(result.records, records);
  assert.deepEqual(result.recipes, recipes);
  assert.deepEqual(result.inventory, inventory);
});

test("legacy pending rows keep a deleted recipe link when its snapshot remains", () => {
  const result = restore({
    records: [{ id: "record", bean: "bean", recipe: "deleted", recipeId: "recipe-1", recipeSnapshot: { name: "deleted", dose: 18 } }],
    recipes: [],
  });
  assert.equal(result.records[0].recipeId, "recipe-1");
  assert.equal(result.records[0].recipeSnapshot.name, "deleted");
});
