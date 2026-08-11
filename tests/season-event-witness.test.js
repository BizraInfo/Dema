// SEASON-EVENT-WITNESS-1A — EW-01…EW-09.
//
// THE MEASURED GAP. `packages/core/src/event-log.js` is a content-addressed,
// hash-chained, append-only local event log with tests. It has ONE reader
// (`scripts/events.mjs`) and ZERO writers: nothing in `packages/` calls
// `appendEvent`, and the season store called it 0 times. A hardened kernel
// nothing calls is this estate's documented disease, not a missing design.
//
// What that costs, precisely: `saveSeasonState` reports
// `adopted_existing_publication` on its RETURN VALUE only. It is not in
// `RECEIPT_FIELDS` (schema · domain · season_id · state_hash · state_sequence ·
// previous_state_hash · saved_at · receipt_hash). So the caller learns a
// crash-repair adoption happened and the durable record does not — the
// distinction dies with the process.
//
// THE ORDERING LAW THIS SLICE ESTABLISHES. The same estate needs opposite
// orderings for two kinds of artefact, and which one applies is decided by
// whether the artefact is load-bearing:
//
//   AUTHORITY    (anchor, state, receipt, fence, HEAD)
//                write-AHEAD, fail-CLOSED. An authoritative HEAD must never
//                require something that is not already durable.
//
//   EXPLANATION  (this event log)
//                write-BEHIND, fail-OPEN. Authority must never depend on its
//                own narration.
//
// EW-04 is the load-bearing control. If a broken log could fail a save, the log
// would become authority through the back door: anyone able to make
// `$DEMA_HOME/events` unwritable could deny every save. Fail-open closes that.
//
// And the boundary stated plainly: this log sits OUTSIDE `receipt_hash`, so it
// is strippable and forgeable. It explains; it never proves.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { saveSeasonState, _internal } from "../packages/receipts/src/season-state-store.js";
import { readEvents } from "../packages/core/src/event-log.js";

const SHA = "a".repeat(40);
const SEASON = "SEASON_EW";

const input = (saved_at, over = {}) => ({
  season_id: SEASON,
  mission_id: "MISSION_EW",
  mission_phase: "PHASE_EW",
  next_safe_action: "RUN_PROOF_GATE",
  repository_commit: SHA,
  repository_tree: SHA,
  completed_steps: [],
  must_not_repeat: [],
  pending_consent: [],
  saved_at,
  ...over,
});

const home = () => mkdtemp(join(tmpdir(), "season-ew-"));
const events = (h) => readEvents({ home: h });
const saves = (h) => events(h).entries.filter((e) => e.command === "season.save");

/** Save, dying immediately after the fence is won and before HEAD is replaced. */
async function saveThenDieAfterFence(h, saved_at) {
  await assert.rejects(() =>
    saveSeasonState({
      demaHome: h,
      state: input(saved_at),
      hooks: { afterFencePublish: async () => { throw new Error("simulated death after fence"); } },
    }));
}

// ── EW-01 ──────────────────────────────────────────────────────────────────
test("EW-01: a successful save appends exactly one season.save event, outcome ok", async () => {
  const h = await home();
  const r = await saveSeasonState({ demaHome: h, state: input("2026-08-11T10:00:00Z") });
  assert.equal(r.ok, true, r.reason);

  const log = saves(h);
  assert.equal(log.length, 1, `expected 1 season.save event, got ${log.length}`);
  assert.equal(log[0].outcome, "ok");
  assert.equal(log[0].metadata.state_hash, r.state_hash);
  assert.equal(log[0].metadata.receipt_hash, r.receipt_hash);
  assert.equal(log[0].boundary.authority_delta, 0);
  assert.equal(log[0].boundary.consent_consumed, false);
});

// ── EW-02 ──────────────────────────────────────────────────────────────────
test("EW-02: a refused save is witnessed as refused, carrying its reason", async () => {
  const h = await home();
  // A sequence gap on an empty season: a real refusal from inside the save path.
  const r = await saveSeasonState({
    demaHome: h,
    state: input("2026-08-11T10:00:00Z", { state_sequence: 5 }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "sequence_gap");

  const log = saves(h);
  assert.equal(log.length, 1);
  assert.equal(log[0].outcome, "refused");
  assert.equal(log[0].metadata.reason, "sequence_gap");
  assert.equal(log[0].metadata.state_hash, null, "a refusal published no state");
});

// ── EW-03 · the durability gap this slice closes ───────────────────────────
test("EW-03: crash-repair adoption becomes durable, not just a return value", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T12:00:00Z");
  const retry = await saveSeasonState({ demaHome: h, state: input("2026-08-11T12:00:30Z") });
  assert.equal(retry.ok, true, retry.reason);
  assert.equal(retry.adopted_existing_publication, true, "fixture must exercise adoption");

  const log = saves(h);
  assert.equal(log.length, 2, "the crash attempt and the repair are both witnessed");
  assert.equal(log[0].outcome, "error", "the attempt that threw is witnessed as error");
  assert.equal(log[1].outcome, "ok");
  assert.equal(log[1].metadata.adopted_existing_publication, true,
    "adoption died with the process — the whole point of this slice");
  // A retry that ADOPTED published a receipt that is not its own candidate.
  assert.notEqual(log[1].metadata.candidate_receipt_hash, log[1].metadata.receipt_hash);
  assert.equal(log[1].metadata.receipt_hash, retry.receipt_hash);
});

// ── EW-04 · the load-bearing control ───────────────────────────────────────
test("EW-04: a broken event log does NOT fail the save (explanation is fail-open)", async () => {
  const h = await home();
  // Make $DEMA_HOME/events a FILE, so mkdirSync inside appendEvent throws.
  await writeFile(join(h, "events"), "not a directory\n");

  const r = await saveSeasonState({ demaHome: h, state: input("2026-08-11T15:00:00Z") });
  assert.equal(r.ok, true,
    `a save must survive an unwritable log, else the log is authority: ${r.reason}`);
  assert.equal(r.state_sequence, 1);
});

// ── EW-05 ──────────────────────────────────────────────────────────────────
test("EW-05: the hash chain stays intact and verified across many saves", async () => {
  const h = await home();
  for (let i = 0; i < 3; i += 1) {
    const r = await saveSeasonState({
      demaHome: h,
      state: input(`2026-08-11T16:0${i}:00Z`, { mission_phase: `PHASE_${i}` }),
    });
    assert.equal(r.ok, true, r.reason);
  }
  const log = events(h);
  assert.equal(log.count, 3);
  assert.equal(log.verified, true, "every event must re-derive its own content id");
  assert.equal(log.chain_intact, true, "prev_hash chain broken");
  assert.equal(log.corrupt_lines, 0);
});

// ── EW-06 ──────────────────────────────────────────────────────────────────
test("EW-06: no absolute path, home path or key material reaches the log", async () => {
  const h = await home();
  await saveSeasonState({ demaHome: h, state: input("2026-08-11T17:00:00Z") });

  const raw = await readFile(join(h, "events", "log.jsonl"), "utf8");
  assert.ok(raw.length > 0, "fixture must produce a log to scan");
  assert.equal(raw.includes(h), false, "the DEMA_HOME path leaked into the log");
  assert.equal(raw.includes(tmpdir()), false, "an absolute host path leaked into the log");
  for (const forbidden of ["PRIVATE KEY", "private_key", "secret", "state_path", "head_path"]) {
    assert.equal(raw.includes(forbidden), false, `"${forbidden}" leaked into the log`);
  }
});

// ── EW-07 · negative control ───────────────────────────────────────────────
test("EW-07: negative control — a mapper that ignores the result cannot tell ok from refused", () => {
  const okResult = { ok: true, state_hash: "s", receipt_hash: "r" };
  const refusal = { ok: false, outcome: "REFUSED", reason: "sequence_gap" };

  const real = (res) => _internal.seasonSaveEventFields(input("t"), res, null).outcome;
  const stub = () => "ok";

  assert.equal(real(okResult), "ok");
  assert.equal(real(refusal), "refused");
  // Both agree on the success case; only the real mapper survives the refusal.
  assert.equal(stub(okResult), real(okResult));
  assert.notEqual(stub(refusal), real(refusal),
    "the stub must differ from the real mapper, or EW-02 proves nothing");
});

// ── EW-08 · the witness changes no authority ───────────────────────────────
test("EW-08: identical input yields identical hashes whether the log works or not", async () => {
  const T = "2026-08-11T18:00:00Z";
  const good = await home();
  const broken = await home();
  await writeFile(join(broken, "events"), "not a directory\n");

  const a = await saveSeasonState({ demaHome: good, state: input(T) });
  const b = await saveSeasonState({ demaHome: broken, state: input(T) });

  assert.equal(a.ok && b.ok, true);
  assert.equal(a.state_hash, b.state_hash, "the witness perturbed the state hash");
  assert.equal(a.receipt_hash, b.receipt_hash, "the witness perturbed the receipt hash");
  // And the working log really did write, or this control is vacuous.
  assert.equal(saves(good).length, 1);
  assert.equal(saves(broken).length, 0);
});

// ── EW-09 ──────────────────────────────────────────────────────────────────
test("EW-09: a throw is witnessed as error and still propagates", async () => {
  const h = await home();
  await saveThenDieAfterFence(h, "2026-08-11T19:00:00Z");

  const log = saves(h);
  assert.equal(log.length, 1);
  assert.equal(log[0].outcome, "error");
  assert.equal(log[0].metadata.reason, "threw");
});

// ── correlation id safety ──────────────────────────────────────────────────
test("a malformed season id is still witnessed, with a bounded correlation id", async () => {
  const h = await home();
  const huge = "X".repeat(5000);
  const r = await saveSeasonState({ demaHome: h, state: input("2026-08-11T20:00:00Z", { season_id: huge }) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "season_id_malformed");

  const log = saves(h);
  assert.equal(log.length, 1);
  assert.ok(log[0].correlation_id.length <= 96,
    `correlation_id unbounded (${log[0].correlation_id.length}) — a caller could bloat the log`);
});

// ── boundary: a read never writes ──────────────────────────────────────────
test("the witness is on the save path only — reads append nothing", async () => {
  const h = await home();
  await saveSeasonState({ demaHome: h, state: input("2026-08-11T21:00:00Z") });
  const before = events(h).count;

  const { loadSeasonHead, seasonStatus, resumeSeason } = await import(
    "../packages/receipts/src/season-state-store.js");
  await loadSeasonHead({ demaHome: h, seasonId: SEASON });
  await seasonStatus({ demaHome: h, seasonId: SEASON });
  await resumeSeason({ demaHome: h, seasonId: SEASON, repositoryCommit: SHA, repositoryTree: SHA });

  assert.equal(events(h).count, before, "a read path wrote to the event log");
});
