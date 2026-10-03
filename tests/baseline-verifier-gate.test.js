import test from "node:test";
import assert from "node:assert/strict";

import {
  runBaselineVerifierGate,
  BASELINE_VERIFIER_GATE_GO_PHRASE,
} from "../packages/core/src/baseline-verifier-gate.js";
import { verifyOneEventEnvelope } from "../packages/core/src/node0-sse-envelope-stream.js";

test("BASELINE-VERIFIER-01: consent mismatch is refused", () => {
  const result = runBaselineVerifierGate({
    consent: "WRONG PHRASE",
    input: { proposalText: "some proposal" },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("consent_phrase_mismatch"));
});

test("BASELINE-VERIFIER-02: missing proposal text is refused", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: 123 },
  });
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("proposal_not_string"));
});

test("BASELINE-VERIFIER-03: proposal with GO consent returns verifiable SSE event (verified=true)", () => {
  const proposal = `Plan: test\n${BASELINE_VERIFIER_GATE_GO_PHRASE}\nEnd`;
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: proposal },
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.kind, "state");
  assert.equal(result.event.seq, 1);
  assert.equal(result.event.stream_id, "baseline-verifier-gate-1a");
  assert.equal(result.event.payload.verified, true);
  assert.ok(result.event.payload.reason.includes("contains required GO consent"));

  // The event must be individually verifiable by the SSE envelope contract
  const blocked = [];
  const hash = verifyOneEventEnvelope(result.event, 1, null, blocked, "event_1");
  assert.equal(blocked.length, 0, `event must verify: ${blocked}`);
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hash, result.event.event_hash);
});

test("BASELINE-VERIFIER-04: proposal without GO consent returns verifiable SSE event (verified=false)", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: "Plan: test without consent" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.payload.verified, false);
  assert.ok(result.event.payload.reason.includes("missing required GO consent"));

  // Event must still be individually verifiable by the SSE envelope contract
  const blocked = [];
  const hash = verifyOneEventEnvelope(result.event, 1, null, blocked, "event_1");
  assert.equal(blocked.length, 0, `event must verify: ${blocked}`);
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(hash, result.event.event_hash);
});

test("BASELINE-VERIFIER-05: boundary is all-false", () => {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: `test ${BASELINE_VERIFIER_GATE_GO_PHRASE}` },
  });
  assert.equal(result.ok, true);
  for (const [key, value] of Object.entries(result.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});
