import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_HISTORY_REPLAY_SCOPE,
  HISTORY_REPLAY_VERDICTS,
  replaySeasonHistory,
} from "../packages/core/src/node0-history-replay.js";

import {
  buildSeasonState,
  buildSeasonReceipt,
  buildSeasonHead,
} from "../packages/core/src/node0-minimum-season-save-resume.js";

const COMMIT = "0".repeat(40);
const TREE = "1".repeat(40);
const SAVED = "2026-07-22T00:00:00.000Z";

/// Build a real N-link season chain using the SHIPPED builders. A fixture hand
/// -rolled here would only prove the replayer agrees with my guess about the
/// shape; these are the same functions that wrote the operator's store.
function buildChain(n, seasonId = "replay-test") {
  const seq = [];
  const states = {};
  const receipts = {};
  let prev = null;
  for (let i = 1; i <= n; i += 1) {
    const built = buildSeasonState({
      season_id: seasonId,
      mission_id: "NODE0-HISTORY-REPLAY-1A",
      mission_phase: "IMPLEMENTATION",
      completed_steps: [`step ${i}`],
      next_safe_action: "AWAIT_REPLAY",
      must_not_repeat: [],
      pending_consent: [],
      repository_commit: COMMIT,
      repository_tree: TREE,
      state_sequence: i,
      previous_state_hash: prev ? prev.state_hash : null,
      last_receipt_hash: prev ? prev.receipt_hash : null,
      saved_at: SAVED,
    });
    assert.equal(built.ok, true, `state ${i} did not build: ${JSON.stringify(built.blocked_by)}`);
    const state = built.state;
    // buildSeasonReceipt/buildSeasonHead return the record itself, not {ok, ...}
    const receipt = buildSeasonReceipt({
      season_id: seasonId,
      state_hash: state.state_hash,
      state_sequence: i,
      previous_state_hash: state.previous_state_hash,
      saved_at: SAVED,
    });
    assert.ok(receipt?.receipt_hash, `receipt ${i} did not build`);
    states[state.state_hash] = state;
    receipts[receipt.receipt_hash] = receipt;
    seq.push({
      state_sequence: i,
      state_hash: state.state_hash,
      receipt_hash: receipt.receipt_hash,
    });
    prev = { state_hash: state.state_hash, receipt_hash: receipt.receipt_hash };
  }
  const head = buildSeasonHead({
    season_id: seasonId,
    state_hash: prev.state_hash,
    receipt_hash: prev.receipt_hash,
    state_sequence: n,
  });
  assert.ok(head?.state_hash, "head did not build");
  return { seq, states, receipts, head };
}

const clone = (c) => JSON.parse(JSON.stringify(c));

describe("node0 history replay · reconstruction", () => {
  it("HR-01: a real 4-link chain reconstructs exactly from genesis", () => {
    const c = buildChain(4);
    const r = replaySeasonHistory(c);
    assert.equal(r.verdict, "RECONSTRUCTED_EXACT", `reason: ${r.reason}`);
    assert.equal(r.steps_replayed, 4);
    assert.equal(r.final_state_hash, c.head.state_hash);
  });

  it("HR-02: the verdict vocabulary is closed and scope is declared", () => {
    assert.equal(NODE0_HISTORY_REPLAY_SCOPE, "node0_history_replay");
    assert.ok(HISTORY_REPLAY_VERDICTS.includes("RECONSTRUCTED_EXACT"));
    assert.ok(HISTORY_REPLAY_VERDICTS.includes("DIVERGED"));
    assert.ok(HISTORY_REPLAY_VERDICTS.includes("INCOMPLETE"));
  });

  it("HR-03 NO VACUOUS PROOF: an empty chain is INCOMPLETE, never reconstructed", () => {
    const r = replaySeasonHistory({ seq: [], states: {}, receipts: {}, head: null });
    assert.notEqual(r.verdict, "RECONSTRUCTED_EXACT");
    assert.equal(r.verdict, "INCOMPLETE");
    // and the same for a wholly absent input
    assert.equal(replaySeasonHistory().verdict, "INCOMPLETE");
    assert.equal(replaySeasonHistory({}).verdict, "INCOMPLETE");
  });

  it("HR-04: a chain that does not start at genesis is INCOMPLETE", () => {
    const c = clone(buildChain(3));
    c.seq.shift(); // drop sequence 1
    const r = replaySeasonHistory(c);
    assert.notEqual(r.verdict, "RECONSTRUCTED_EXACT");
    assert.equal(r.verdict, "INCOMPLETE");
  });

  it("HR-05: a gap in the sequence is INCOMPLETE", () => {
    const c = clone(buildChain(4));
    c.seq.splice(2, 1); // drop sequence 3
    const r = replaySeasonHistory(c);
    assert.notEqual(r.verdict, "RECONSTRUCTED_EXACT");
    assert.equal(r.verdict, "INCOMPLETE");
  });

  it("HR-06: a state whose content was tampered DIVERGES on its own hash", () => {
    const c = clone(buildChain(3));
    const h = c.seq[1].state_hash;
    c.states[h].next_safe_action = "TAMPERED_ACTION";
    const r = replaySeasonHistory(c);
    assert.equal(r.verdict, "DIVERGED", `reason: ${r.reason}`);
  });

  it("HR-07: a broken previous_state_hash link DIVERGES", () => {
    const c = clone(buildChain(3));
    const h = c.seq[2].state_hash;
    c.states[h].previous_state_hash = `sha256:${"0".repeat(64)}`;
    const r = replaySeasonHistory(c);
    assert.equal(r.verdict, "DIVERGED", `reason: ${r.reason}`);
  });

  it("HR-08: a HEAD that disagrees with the replayed tail DIVERGES", () => {
    const c = clone(buildChain(3));
    c.head.state_hash = `sha256:${"9".repeat(64)}`;
    const r = replaySeasonHistory(c);
    assert.equal(r.verdict, "DIVERGED", `reason: ${r.reason}`);
  });

  it("HR-09: a missing state body is INCOMPLETE, not silently skipped", () => {
    const c = clone(buildChain(3));
    delete c.states[c.seq[1].state_hash];
    const r = replaySeasonHistory(c);
    assert.notEqual(r.verdict, "RECONSTRUCTED_EXACT");
    assert.equal(r.verdict, "INCOMPLETE");
  });

  it("HR-10: a receipt that does not bind its state DIVERGES", () => {
    const c = clone(buildChain(3));
    const rh = c.seq[1].receipt_hash;
    c.receipts[rh].state_hash = `sha256:${"8".repeat(64)}`;
    const r = replaySeasonHistory(c);
    assert.equal(r.verdict, "DIVERGED", `reason: ${r.reason}`);
  });

  it("HR-11 NEGATIVE-CONTROL INTEGRITY: a replayer that always said EXACT would fail above", () => {
    // Every refusal case must be reachable; if any tamper still reported
    // RECONSTRUCTED_EXACT the suite would be proving nothing.
    const bad = [
      (c) => { c.seq.shift(); return c; },
      (c) => { c.states[c.seq[1].state_hash].next_safe_action = "X"; return c; },
      (c) => { c.head.state_hash = `sha256:${"7".repeat(64)}`; return c; },
    ];
    for (const mutate of bad) {
      const r = replaySeasonHistory(mutate(clone(buildChain(3))));
      assert.notEqual(r.verdict, "RECONSTRUCTED_EXACT");
    }
    // and the untouched control still reconstructs
    assert.equal(replaySeasonHistory(buildChain(3)).verdict, "RECONSTRUCTED_EXACT");
  });
});

// ── the adapter · what may and may not settle the row ────────────────────────
// Every read is injected, so these exercise the classifier without touching a
// real DEMA_HOME. An adapter that returned an observation for any of the
// refusal cases below would let a row be settled by evidence nobody verified.

import {
  fullHistoryReplayableObservation,
  historyReplayDiagnostic,
  currentHistoryReplayKernelHash,
  HISTORY_REPLAY_INVARIANT_ID,
} from "../packages/core/src/node0-history-replay-adapter.js";
import { buildHistoryReplayObservation } from "../packages/core/src/node0-history-replay.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const KERNEL_HASH = currentHistoryReplayKernelHash();

function artefact({ verdict = "RECONSTRUCTED_EXACT", evidenceClass = "OBSERVED" } = {}) {
  return buildHistoryReplayObservation({
    facts: {
      verdict,
      reason: verdict === "RECONSTRUCTED_EXACT" ? null : "unknown_schema",
      seasons: [{ season_id: "s", verdict, reason: null, steps_replayed: 3 }],
    },
    evidenceClass,
    observedAt: "2026-07-22T00:00:00.000Z",
    executedCodeHash: KERNEL_HASH,
    hash: sha256CanonicalJsonV1,
  });
}
const reader = (obj) => () => JSON.stringify(obj);
const enoent = () => {
  const e = new Error("no such file");
  e.code = "ENOENT";
  throw e;
};

describe("node0 history replay · adapter", () => {
  it("HR-20: no artefact is SILENCE, not refusal — the row stays UNKNOWN", () => {
    assert.equal(fullHistoryReplayableObservation({ readFile: enoent }), null);
    assert.equal(historyReplayDiagnostic({ readFile: enoent }).state, "NOT_RECORDED");
    assert.equal(historyReplayDiagnostic({ readFile: enoent }).integrity_suspect, false);
  });

  it("HR-21: an OBSERVED, exactly-reconstructed artefact settles the row", () => {
    const o = fullHistoryReplayableObservation({ readFile: reader(artefact()) });
    assert.ok(o, "expected an observation");
    assert.equal(o.observed, true);
    assert.equal(o.scope, NODE0_HISTORY_REPLAY_SCOPE);
    assert.match(o.source, /^NODE0-HISTORY-REPLAY-1A RECONSTRUCTED_EXACT /);
  });

  it("HR-22: an INCOMPLETE verdict must NOT settle the row", () => {
    const a = artefact({ verdict: "INCOMPLETE" });
    assert.equal(fullHistoryReplayableObservation({ readFile: reader(a) }), null);
    assert.equal(historyReplayDiagnostic({ readFile: reader(a) }).state, "NOT_CLEAN_ELIGIBLE");
  });

  it("HR-23: a DIVERGED verdict must NOT settle the row", () => {
    const a = artefact({ verdict: "DIVERGED" });
    assert.equal(fullHistoryReplayableObservation({ readFile: reader(a) }), null);
  });

  it("HR-24 MUTATION CONTROL: a tampered body breaks its own hash", () => {
    const a = { ...artefact(), replay_verdict: "RECONSTRUCTED_EXACT", steps_replayed: 999 };
    assert.equal(fullHistoryReplayableObservation({ readFile: reader(a) }), null);
    const d = historyReplayDiagnostic({ readFile: reader(a) });
    assert.equal(d.state, "HASH_UNVERIFIED");
    assert.equal(d.integrity_suspect, true);
  });

  it("HR-25 MUTATION CONTROL: an artefact from other kernel bytes is refused", () => {
    const a = { ...artefact(), executed_code_hash: `sha256:${"0".repeat(64)}` };
    // rehash so ONLY the kernel binding is wrong, not the body hash
    const { observed_at: _o, observation_hash: _h, ...body } = a;
    const forged = { ...body, observed_at: _o, observation_hash: sha256CanonicalJsonV1(body) };
    assert.equal(fullHistoryReplayableObservation({ readFile: reader(forged) }), null);
    assert.equal(historyReplayDiagnostic({ readFile: reader(forged) }).state, "KERNEL_BYTES_MISMATCH");
  });

  it("HR-26 MUTATION CONTROL: a relabelled scope cannot answer this question", () => {
    const a = artefact();
    const { observed_at: _o, observation_hash: _h, ...body } = a;
    const relabelled = { ...body, scope: "node0_runtime_kill_resume" };
    const forged = { ...relabelled, observed_at: _o, observation_hash: sha256CanonicalJsonV1(relabelled) };
    assert.equal(fullHistoryReplayableObservation({ readFile: reader(forged) }), null);
    assert.equal(historyReplayDiagnostic({ readFile: reader(forged) }).state, "SCHEMA_MISMATCH");
  });

  it("HR-27: unreadable and non-JSON artefacts are integrity-suspect, not silent success", () => {
    assert.equal(fullHistoryReplayableObservation({ readFile: () => "{not json" }), null);
    assert.equal(historyReplayDiagnostic({ readFile: () => "{not json" }).state, "UNREADABLE");
    assert.equal(HISTORY_REPLAY_INVARIANT_ID, "full_history_replayable");
  });
});
