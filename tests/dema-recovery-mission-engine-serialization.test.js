// DEMA-RECOVERY-MISSION-ENGINE-SERIALIZATION-1D — engine proof payloads must stay
// independently verifiable after JSON serialization. The verifier's object-valued
// projection checks (chronology, seal_receipt) use canonical JSON v1 structural
// equality; reference identity only holds in-memory. current_state stays strict
// (primitive). Semantic divergence must remain rejected even when the attacker
// recomputes the outer content hash.

import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDemaRecoveryMissionEvent,
  buildDemaRecoveryMissionEnginePayload,
  verifyDemaRecoveryMissionEngine,
  DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID,
} from "../packages/core/src/dema-recovery-mission-engine.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const CAND = Object.freeze({
  asset_id: "/fixture/corpus::a.md",
  source_lineage: [{ root: "/fixture/corpus", ref: "a.md" }],
  limitations: "metadata_only_no_content_read",
  rank: 1,
});
const CHRON = [
  { asset_id: CAND.asset_id, root: "/fixture/corpus", ref: "a.md", best_evidence_time: "2026-07-20T02:00:00.000Z" },
  { asset_id: "/fixture/corpus::b.md", root: "/fixture/corpus", ref: "b.md", best_evidence_time: "2026-07-20T03:00:00.000Z" },
];
const CAND_B = Object.freeze({
  asset_id: "/fixture/corpus::b.md",
  source_lineage: [{ root: "/fixture/corpus", ref: "b.md" }],
  limitations: "metadata_only_no_content_read",
  rank: 2,
});

function chain(upTo, { stopped = false } = {}) {
  const es = [];
  const push = (kind, payload) =>
    es.push(
      makeDemaRecoveryMissionEvent({
        seq: es.length + 1,
        kind,
        payload,
        prev_event: es.length ? es[es.length - 1].event_id : DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID,
      }),
    );
  push("MISSION_DECLARED", {
    mission_id: "FIX-1D",
    objective_text: "serialization fixture",
    source_boundary: { roots: ["/fixture/corpus"], exclusions: [] },
    success_definition: "fixture",
  });
  if (upTo >= 2)
    push("RECONSTRUCTED", {
      consent_id: "C1",
      chronology: CHRON,
      contradiction_map: [],
      candidates: [CAND, CAND_B],
      not_accessed_report: [],
    });
  if (upTo >= 3) push("AWAIT_HUMAN", {});
  if (upTo >= 4) push("HUMAN_REVIVAL", { chosen_asset_id: CAND.asset_id });
  if (stopped) {
    push("STOP", { cause: "budget_exhausted" });
    return es;
  }
  if (upTo >= 5) push("WORKER_RESULT", { worker_id: "worker_sim_a", result_ref: "result-1" });
  if (upTo >= 6)
    push("VERIFIER_VERDICT", { verifier_id: "verifier_sim_x", verdict: "PASS", used_asset_id: CAND.asset_id });
  return es;
}

function payloadAt(upTo, opts) {
  return buildDemaRecoveryMissionEnginePayload({ events: chain(upTo, opts) });
}

function roundTrip(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function rehash(copy) {
  const { content_hash, ...body } = copy;
  copy.content_hash = sha256CanonicalJsonV1(body);
  return copy;
}

// ── T01–T07: every reachable state survives a JSON round trip ──
const STATE_CASES = [
  ["T01 DECLARED", () => payloadAt(1), "DECLARED"],
  ["T02 CANDIDATES_READY", () => payloadAt(2), "CANDIDATES_READY"],
  ["T03 AWAITING_HUMAN", () => payloadAt(3), "AWAITING_HUMAN"],
  ["T04 IN_USE_MISSION", () => payloadAt(4), "IN_USE_MISSION"],
  ["T05 VERIFYING", () => payloadAt(5), "VERIFYING"],
  ["T06 SEALED (non-null seal_receipt)", () => payloadAt(6), "SEALED"],
  ["T07 STOPPED", () => payloadAt(4, { stopped: true }), "STOPPED"],
];
for (const [name, make, expectState] of STATE_CASES) {
  test(`${name} payload verifies after JSON round trip`, () => {
    const p = make();
    assert.equal(p.current_state, expectState);
    assert.deepEqual(verifyDemaRecoveryMissionEngine(p), { ok: true, blocked_by: [] });
    assert.deepEqual(verifyDemaRecoveryMissionEngine(roundTrip(p)), { ok: true, blocked_by: [] });
  });
}

test("T06b SEALED round trip carries a non-null seal_receipt", () => {
  const rt = roundTrip(payloadAt(6));
  assert.notEqual(rt.seal_receipt, null);
  assert.equal(rt.seal_receipt.asset_id, CAND.asset_id);
});

// ── T08/T09: canonically equal clones are accepted ──
test("T08 a structurally equal chronology clone is accepted", () => {
  const rt = roundTrip(payloadAt(4));
  rt.chronology = JSON.parse(JSON.stringify(rt.mission_state.chronology));
  assert.deepEqual(verifyDemaRecoveryMissionEngine(rt), { ok: true, blocked_by: [] });
});

test("T09 reordered object keys with identical canonical meaning are accepted", () => {
  const rt = roundTrip(payloadAt(4));
  rt.chronology = rt.mission_state.chronology.map((e) => ({
    best_evidence_time: e.best_evidence_time,
    ref: e.ref,
    root: e.root,
    asset_id: e.asset_id,
  }));
  assert.deepEqual(verifyDemaRecoveryMissionEngine(rt), { ok: true, blocked_by: [] });
});

// ── T10/T11: semantic divergence rejected even after outer rehash ──
test("T10 changed chronology value is rejected even after content_hash recompute", () => {
  const rt = roundTrip(payloadAt(4));
  rt.chronology[0].best_evidence_time = "2001-01-01T00:00:00.000Z";
  const v = verifyDemaRecoveryMissionEngine(rehash(rt));
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("chronology_mismatch"));
});

test("T11 semantically different array order is rejected even after recompute", () => {
  const rt = roundTrip(payloadAt(4));
  rt.chronology = [rt.chronology[1], rt.chronology[0]];
  const v = verifyDemaRecoveryMissionEngine(rehash(rt));
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("chronology_mismatch"));
});

// ── T12/T13: seal_receipt clone accepted; divergence rejected after rehash ──
test("T12 a canonically equal seal_receipt clone is accepted", () => {
  const rt = roundTrip(payloadAt(6));
  rt.seal_receipt = JSON.parse(JSON.stringify(rt.mission_state.seal_receipt));
  assert.deepEqual(verifyDemaRecoveryMissionEngine(rt), { ok: true, blocked_by: [] });
});

test("T13 a changed seal_receipt field is rejected even after content_hash recompute", () => {
  const rt = roundTrip(payloadAt(6));
  rt.seal_receipt.verifier_id = "forged_verifier";
  const v = verifyDemaRecoveryMissionEngine(rehash(rt));
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("seal_receipt_mismatch"));
});

// ── T14/T15: null-vs-null projections stay accepted ──
test("T14 null chronology against null mission-state chronology is accepted", () => {
  const rt = roundTrip(payloadAt(1));
  assert.equal(rt.chronology, null);
  assert.equal(rt.mission_state.chronology ?? null, null);
  assert.deepEqual(verifyDemaRecoveryMissionEngine(rt), { ok: true, blocked_by: [] });
});

test("T15 null seal_receipt against null mission-state seal_receipt is accepted", () => {
  const rt = roundTrip(payloadAt(4));
  assert.equal(rt.seal_receipt, null);
  const v = verifyDemaRecoveryMissionEngine(rt);
  assert.equal(v.blocked_by.includes("seal_receipt_mismatch"), false);
  assert.equal(v.ok, true);
});

// ── T16: current_state strict rule preserved ──
test("T16 current_state mismatch remains rejected after recompute", () => {
  const rt = roundTrip(payloadAt(4));
  rt.current_state = "SEALED";
  const v = verifyDemaRecoveryMissionEngine(rehash(rt));
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("current_state_mismatch"));
});

// ── T17: noncanonical projection fails closed, no escaping exception ──
test("T17 a noncanonical chronology value fails closed without throwing", () => {
  const rt = roundTrip(payloadAt(4));
  let deep = { v: 0 };
  for (let i = 0; i < 70; i++) deep = { nested: deep };
  rt.chronology = [deep];
  let v;
  assert.doesNotThrow(() => {
    v = verifyDemaRecoveryMissionEngine(rt);
  });
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("chronology_mismatch"));
});

// ── T18/T19: existing integrity rejections intact ──
test("T18 body tamper without recompute is still content_hash_mismatch", () => {
  const rt = roundTrip(payloadAt(4));
  rt.mission_state.mission_id = "FORGED";
  const v = verifyDemaRecoveryMissionEngine(rt);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

test("T19 forged truth label is still rejected", () => {
  const rt = roundTrip(payloadAt(4));
  rt.truth_label = "FORGED";
  const v = verifyDemaRecoveryMissionEngine(rehash(rt));
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("truth_label_mismatch"));
});

// ── T20 (hermetic mirror of the blocked phase_00 artifact shape): an
// IN_USE_MISSION payload serialized to text and parsed in a later context is
// accepted unchanged. The exact real phase_00 artifact is re-verified in the
// slice's evidence bundle (it lives outside the repository by design). ──
test("T20 serialized IN_USE_MISSION artifact text is accepted unchanged", () => {
  const text = JSON.stringify(payloadAt(4), null, 2);
  const parsed = JSON.parse(text);
  assert.equal(parsed.current_state, "IN_USE_MISSION");
  assert.equal(parsed.mission_state.chosen_asset_id, CAND.asset_id);
  assert.deepEqual(verifyDemaRecoveryMissionEngine(parsed), { ok: true, blocked_by: [] });
});
