import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/cloudSyncQueue.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { CloudConflictError, CloudSyncQueue } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const payload = (record, theme = false) => ({
  profiles: {}, records: record ? [{ id: record }] : [], beans: [], inventory: [], recipes: [],
  settings: { theme: { isDarkMode: theme } },
});

const harness = (write) => {
  const staged = new Map();
  const phases = [];
  const queue = new CloudSyncQueue({
    write,
    persist: (uid, change) => staged.set(uid, structuredClone(change)),
    clear: (uid) => staged.delete(uid),
    report: (phase) => phases.push(phase),
  }, 60_000);
  return { queue, staged, phases };
};

test("any persisted edit is staged before a cloud write and clears after success", async () => {
  const writes = [];
  const { queue, staged, phases } = harness(async (uid, revision, data) => {
    writes.push({ uid, revision, data });
    return revision + 1;
  });
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("new-record"));
  assert.equal(staged.get("user-a").payload.records[0].id, "new-record");
  assert.equal(writes.length, 0);
  await queue.flush();
  assert.equal(writes[0].revision, 0);
  assert.equal(queue.currentRevision, 1);
  assert.equal(staged.size, 0);
  queue.observe(payload("new-record", true));
  await queue.flush();
  assert.equal(writes[1].data.settings.theme.isDarkMode, true);
  assert.equal(writes[1].revision, 1);
  assert.equal(phases.at(-1), "saved");
  queue.stop();
});

test("a manual force writes an unchanged payload", async () => {
  const writes = [];
  const { queue, staged, phases } = harness(async (_uid, revision, data) => {
    writes.push({ revision, data });
    return revision + 1;
  });
  const saved = payload("unchanged");
  queue.start("user-a", 4, saved);
  queue.force(saved);
  assert.equal(staged.get("user-a").payload.records[0].id, "unchanged");
  await queue.flush();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].revision, 4);
  assert.equal(staged.size, 0);
  assert.equal(phases.at(-1), "saved");
  queue.stop();
});

test("a newer edit during an in-flight write is serialized onto the new revision", async () => {
  let releaseFirst;
  const writes = [];
  const { queue, staged } = harness((uid, revision, data) => {
    writes.push({ uid, revision, data });
    if (writes.length === 1) return new Promise((resolve) => { releaseFirst = resolve; });
    return Promise.resolve(revision + 1);
  });
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("first"));
  const first = queue.flush();
  queue.observe(payload("second"));
  assert.equal(staged.get("user-a").revision, 0);
  releaseFirst(1);
  await first;
  assert.equal(staged.get("user-a").revision, 1);
  await queue.flush();
  assert.deepEqual(writes.map((write) => [write.revision, write.data.records[0].id]), [[0, "first"], [1, "second"]]);
  assert.equal(staged.size, 0);
  queue.stop();
});

test("reverting during an in-flight write remains staged until the revert is committed", async () => {
  let releaseFirst;
  const writes = [];
  const { queue, staged } = harness((_uid, revision, data) => {
    writes.push({ revision, data });
    if (writes.length === 1) return new Promise((resolve) => { releaseFirst = resolve; });
    return Promise.resolve(revision + 1);
  });
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("temporary"));
  const first = queue.flush();
  queue.observe(payload(null));
  assert.equal(staged.get("user-a").revision, 0);
  assert.deepEqual(staged.get("user-a").payload.records, []);
  releaseFirst(1);
  await first;
  await queue.flush();
  assert.deepEqual(writes.map(({ revision, data }) => [revision, data.records.length]), [[0, 1], [1, 0]]);
  assert.equal(staged.size, 0);
  queue.stop();
});

test("a conflicting remote revision never overwrites the remote and retains local edits", async () => {
  let calls = 0;
  const { queue, staged, phases } = harness(async () => {
    calls += 1;
    throw new CloudConflictError();
  });
  queue.start("user-a", 3, payload(null));
  queue.observe(payload("local"));
  await queue.flush();
  assert.equal(queue.isConflict, true);
  assert.equal(staged.get("user-a").revision, 3);
  queue.observe(payload("local-newer"));
  assert.equal(staged.get("user-a").payload.records[0].id, "local-newer");
  assert.equal(staged.get("user-a").revision, 3);
  await queue.flush();
  assert.equal(calls, 1);
  assert.equal(phases.at(-1), "conflict");
  queue.stop();
});

test("a recovered conflict retains its original base revision across further edits", () => {
  const { queue, staged } = harness(async () => 10);
  queue.start("user-a", 9, payload("saved-locally"), false, true, 4);
  queue.observe(payload("edited-again"));
  assert.equal(staged.get("user-a").revision, 4);
  assert.equal(staged.get("user-a").conflict, true);
  queue.stop();
});

test("a failed write remains pending and can be retried", async () => {
  let calls = 0;
  const { queue, staged, phases } = harness(async (_uid, revision) => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return revision + 1;
  });
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("offline-record"));
  await queue.flush();
  assert.equal(staged.get("user-a").payload.records[0].id, "offline-record");
  assert.equal(phases.at(-1), "error");
  await queue.flush();
  assert.equal(staged.size, 0);
  assert.equal(calls, 2);
  queue.stop();
});

test("a slow write times out for the caller without dropping the staged change", async () => {
  let release;
  const { queue, staged } = harness((_uid, revision) => new Promise((resolve) => {
    release = () => resolve(revision + 1);
  }));
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("slow-record"));
  void queue.flush();
  assert.equal(await queue.waitForWrite(1), false);
  assert.equal(staged.get("user-a").payload.records[0].id, "slow-record");
  release();
  assert.equal(await queue.waitForWrite(100), true);
  assert.equal(staged.size, 0);
  queue.stop();
});

test("a recovered pending snapshot is staged and uploaded from its saved base revision", async () => {
  const writes = [];
  const { queue, staged } = harness(async (_uid, revision, data) => {
    writes.push({ revision, data });
    return revision + 1;
  });
  queue.start("user-a", 7, payload("recovered"), true);
  assert.equal(staged.get("user-a").revision, 7);
  await queue.flush();
  assert.equal(writes[0].revision, 7);
  assert.equal(writes[0].data.records[0].id, "recovered");
  assert.equal(staged.size, 0);
  queue.stop();
});

test("completion of an old account write cannot clear the new account's pending data", async () => {
  let releaseOld;
  const { queue, staged } = harness((uid, revision) => {
    if (uid === "user-a") return new Promise((resolve) => { releaseOld = resolve; });
    return Promise.resolve(revision + 1);
  });
  queue.start("user-a", 0, payload(null));
  queue.observe(payload("a"));
  const oldWrite = queue.flush();
  queue.start("user-b", 0, payload(null));
  queue.observe(payload("b"));
  releaseOld(1);
  await oldWrite;
  await queue.flush();
  assert.equal(queue.accountId, "user-b");
  assert.equal(queue.currentRevision, 1);
  assert.equal(staged.get("user-a").payload.records[0].id, "a");
  assert.equal(staged.has("user-b"), false);
  queue.stop();
});
