import test from "node:test";
import assert from "node:assert/strict";

import {
  BASELINE_VERIFIER_GATE_GO_PHRASE,
  runBaselineVerifierGate,
} from "../packages/core/src/baseline-verifier-gate.js";
import { verifyOneEventEnvelope } from "../packages/core/src/node0-sse-envelope-stream.js";

test("BASELINE-VERIFIER-01: consent mismatch is refused", () => {
  const result = runBaselineVerifierGate({
    consent: "WRONG PHRASE",
    input: { proposalText: "some proposal" },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.blocked_by, ["consent_phrase_mismatch"]);
});

test("BASELINE-VERIFIER-02: malformed proposal is refused", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: 123 },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.blocked_by, ["proposal_not_string"]);
});

test("BASELINE-VERIFIER-03: consented proposal emits a valid verified event", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: `Plan\n${BASELINE_VERIFIER_GATE_GO_PHRASE}\nEnd` },
  });

  assert.equal(result.ok, true);
  assert.equal(result.event.stream_id, "baseline-verifier-gate-1a");
  assert.equal(result.event.seq, 1);
  assert.equal(result.event.kind, "state");
  assert.equal(result.event.payload.verified, true);

  const blocked = [];
  const hash = verifyOneEventEnvelope(result.event, 1, null, blocked, "event_1");
  assert.deepEqual(blocked, []);
  assert.equal(hash, result.event.event_hash);
});

test("BASELINE-VERIFIER-04: unconsented proposal emits valid negative evidence", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: "Plan without the required authorization phrase" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.event.payload.verified, false);

  const blocked = [];
  const hash = verifyOneEventEnvelope(result.event, 1, null, blocked, "event_1");
  assert.deepEqual(blocked, []);
  assert.equal(hash, result.event.event_hash);
});

test("BASELINE-VERIFIER-05: preview boundary cannot widen authority", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: BASELINE_VERIFIER_GATE_GO_PHRASE },
  });
  assert.equal(result.ok, true);
  assert.ok(Object.values(result.boundary).every((value) => value === false));
});
