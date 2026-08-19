import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyStore, upsertTask, appendReceipt, getTask, listTasks, storeHash,
  loadStore, saveStore, MISSION_STORE_SCHEMA,
} from "../packages/core/src/dema-mission-store.js";
import { createTask } from "../packages/core/src/dema-task-lifecycle.js";

const NOW = "2026-08-13T07:00:00Z";
const mkTask = (id) => createTask({ task_id: id, now: NOW });

// ── MS-01 idempotent upsert by task_id ────────────────────────────────────────
test("MS-01: upsertTask is idempotent by task_id", () => {
  let s = emptyStore(NOW);
  s = upsertTask(s, mkTask("health"), { now: NOW });
  s = upsertTask(s, mkTask("health"), { now: NOW }); // same id -> replace, not duplicate
  s = upsertTask(s, mkTask("repair"), { now: NOW });
  assert.equal(Object.keys(s.tasks).length, 2);
  assert.equal(getTask(s, "health").task_id, "health");
});

// ── MS-02 an invalid task is refused ──────────────────────────────────────────
test("MS-02: an invalid task is refused, store unchanged", () => {
  const s = upsertTask(emptyStore(NOW), { nope: true }, { now: NOW });
  assert.equal(s.error, "task_invalid");
});

// ── MS-03 receipts append ─────────────────────────────────────────────────────
test("MS-03: appendReceipt appends; a non-object receipt is refused", () => {
  let s = appendReceipt(emptyStore(NOW), { schema: "x", ok: true }, { now: NOW });
  assert.equal(s.receipts.length, 1);
  assert.equal(appendReceipt(s, null, { now: NOW }).error, "receipt_invalid");
});

// ── MS-04 round-trip via injected io ──────────────────────────────────────────
test("MS-04: save then load round-trips the store via injected io", () => {
  let s = upsertTask(emptyStore(NOW), mkTask("mon"), { now: NOW });
  let written = null;
  const w = saveStore({ writeJson: (o) => { written = o; }, store: s, now: NOW });
  assert.equal(w.ok, true);
  assert.equal(w.task_count, 1);
  const loaded = loadStore({ readJson: () => written, now: NOW });
  assert.equal(loaded.store.schema, MISSION_STORE_SCHEMA);
  assert.equal(getTask(loaded.store, "mon").task_id, "mon");
});

// ── MS-05 absence and corruption never trust blindly ──────────────────────────
test("MS-05: absent store -> fresh; malformed store -> fresh with warning", () => {
  assert.equal(Object.keys(loadStore({ readJson: () => null, now: NOW }).store.tasks).length, 0);
  const bad = loadStore({ readJson: () => ({ not: "a store" }), now: NOW });
  assert.equal(bad.warning, "store_malformed_fresh");
  assert.equal(Object.keys(bad.store.tasks).length, 0);
  const threw = loadStore({ readJson: () => { throw new Error("EIO"); }, now: NOW });
  assert.equal(threw.warning, "store_unreadable_fresh");
});

// ── MS-06 load sanitizes a partially-corrupt store (drops invalid tasks) ───────
test("MS-06: load drops shape-invalid tasks, keeps the valid ones", () => {
  const corrupt = {
    schema: MISSION_STORE_SCHEMA,
    tasks: { good: mkTask("good"), bad1: { task_id: "bad1", state: "GARBAGE" }, bad2: { state: "PENDING" } },
    receipts: [], updated_at: NOW,
  };
  const loaded = loadStore({ readJson: () => corrupt, now: NOW });
  assert.equal(loaded.dropped_invalid, 2);
  assert.deepEqual(Object.keys(loaded.store.tasks), ["good"]);
});

// ── MS-07 query helpers + stable hash ─────────────────────────────────────────
test("MS-07: listTasks filters; storeHash is stable and content-addressed", () => {
  let s = upsertTask(emptyStore(NOW), mkTask("a"), { now: NOW });
  s = upsertTask(s, mkTask("b"), { now: NOW });
  assert.equal(listTasks(s).length, 2);
  assert.equal(listTasks(s, (t) => t.task_id === "a").length, 1);
  assert.match(storeHash(s), /^sha256:[0-9a-f]{64}$/);
  assert.equal(saveStore({ writeJson: () => { throw new Error("disk full"); }, store: s, now: NOW }).error.startsWith("write_failed:"), true);
});
