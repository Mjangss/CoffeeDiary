import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/context/BrewContext.tsx"],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { brewFormReducer } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

const record = {
  id: "record-1", bean: "bean", method: "Brew", grinder: "Millab M01", brewWater: "water",
  brewWaterTemp: 92, immersionWaterTemp: 90, filterPaper: "paper", dripper: "V60",
  roastLevel: "중배전", cupScores: {}, restDays: 0, brewSec: 31, baseClick: 1.5,
  memo: "", recipe: "기본 레시피", recipeId: "recipe-1", dose: 30,
  recipeSnapshot: { name: "기본 레시피", dose: 20 },
};

const loaded = brewFormReducer({}, { type: "LOAD_RECORD", record, recipes: [{ id: "recipe-1" }] });
assert.equal(loaded.dose, 30);

const legacy = brewFormReducer({}, {
  type: "LOAD_RECORD", record: { ...record, dose: undefined }, recipes: [{ id: "recipe-1" }],
});
assert.equal(legacy.dose, 20);
