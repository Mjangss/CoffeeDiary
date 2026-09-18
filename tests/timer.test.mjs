import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const output = await build({
  entryPoints: ["src/utils/timer.ts"],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const { nextTimerElapsed } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);

test("timer elapsed freezes at the recipe endpoint", () => {
  assert.equal(nextTimerElapsed(500, 0, 1000), 500);
  assert.equal(nextTimerElapsed(1000, 0, 1000), 1000);
  assert.equal(nextTimerElapsed(2000, 0, 1000), 1000);
  assert.equal(nextTimerElapsed(-100, 0, 1000), 0);
});
