import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  stdin: {
    contents: 'export { brewFormReducer } from "./src/context/BrewContext.tsx"; export { INITIAL_BREW_FORM, defaultBaseClick } from "./src/constants/index.ts";',
    resolveDir: process.cwd(),
    sourcefile: "brew-form-check.ts",
    loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { brewFormReducer, INITIAL_BREW_FORM, defaultBaseClick } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

test("editing a record retains its click and OXO filters", () => {
  const record = {
    bean: "test", method: "OXO", grinder: "Millab M01", baseClick: 4.2,
    oxoUpperFilter: "메탈", oxoLowerFilter: "없음",
  };
  const form = brewFormReducer(INITIAL_BREW_FORM, { type: "LOAD_RECORD", record, recipes: [] });
  assert.equal(form.baseClick, 4.2);
  assert.equal(form.oxoUpperFilter, "메탈");
  assert.equal(form.oxoLowerFilter, "없음");
});

test("new and reset forms use grinder-valid defaults", () => {
  assert.equal(INITIAL_BREW_FORM.baseClick, 10);
  assert.equal(brewFormReducer(INITIAL_BREW_FORM, { type: "RESET_FORM" }).baseClick, 10);
  assert.equal(defaultBaseClick("Brew", "HammerHead"), 19);
  assert.equal(brewFormReducer(INITIAL_BREW_FORM, { type: "SET_METHOD", method: "Brew" }).baseClick, 10);
});

test("editing uses the recorded recipe link and preserves its snapshot", () => {
  const record = { bean: "test", beanId: "bean-1", baseClick: 4, recipe: "old", recipeId: "recipe-1", recipeSnapshot: { name: "old", dose: 18 } };
  const form = brewFormReducer(INITIAL_BREW_FORM, { type: "LOAD_RECORD", record, recipes: [{ id: "recipe-1", name: "renamed" }] });
  assert.equal(form.selectedBeanId, "bean-1");
  assert.equal(form.selectedRecipeId, "recipe-1");
  assert.equal(form.recipe, "old");
  assert.equal(form.dose, 18);
});

test("applying a recipe applies its method, switch and OXO filters", () => {
  const form = brewFormReducer(INITIAL_BREW_FORM, { type: "APPLY_RECIPE", recipe: {
    id: "recipe-1", name: "OXO", method: "OXO", drinkType: "hot", dose: 20, useSwitch: true,
    pours: [], dilutionGuide: "", memo: "", oxoUpperFilter: "메탈", oxoLowerFilter: "없음",
  } });
  assert.equal(form.method, "OXO");
  assert.equal(form.switchApplied, false);
  assert.equal(form.oxoUpperFilter, "메탈");
  assert.equal(form.oxoLowerFilter, "없음");
  assert.equal(form.dose, 20);
});
