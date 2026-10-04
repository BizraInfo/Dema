import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  BASELINE_VERIFIER_GATE_GO_PHRASE,
  proposalHasExactGoPhrase,
  runBaselineVerifierGate,
} from "../packages/core/src/baseline-verifier-gate.js";
import { verifyOneEventEnvelope } from "../packages/core/src/node0-sse-envelope-stream.js";

function sha256Text(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

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

test("BASELINE-VERIFIER-02b: non-object input is refused", () => {
  for (const input of [null, ["not", "object"], "string"]) {
    const result = runBaselineVerifierGate({
      consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
      input,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["input_not_object"]);
  }
});

test("BASELINE-VERIFIER-03: consented proposal emits a valid verified event", () => {
  const proposalText = `Plan\n${BASELINE_VERIFIER_GATE_GO_PHRASE}\nEnd`;
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText },
  });

  assert.equal(result.ok, true);
  assert.equal(result.event.stream_id, "baseline-verifier-gate-1a");
  assert.equal(result.event.seq, 1);
  assert.equal(result.event.kind, "state");
  assert.equal(result.event.payload.verified, true);
  assert.equal(result.event.payload.proposal_hash, sha256Text(proposalText));

  const blocked = [];
  const hash = verifyOneEventEnvelope(result.event, 1, null, blocked, "event_1");
  assert.deepEqual(blocked, []);
  assert.equal(hash, result.event.event_hash);
});

test("BASELINE-VERIFIER-04: unconsented proposal emits valid negative evidence", () => {
  const proposalText = "Plan without the required authorization phrase";
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText },
  });

  assert.equal(result.ok, true);
  assert.equal(result.event.payload.verified, false);
  assert.equal(result.event.payload.proposal_hash, sha256Text(proposalText));

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
  assert.equal(result.boundary.merge_authority, false);
  assert.equal(result.boundary.authority_delta, 0);
  for (const [key, value] of Object.entries(result.boundary)) {
    if (key === "authority_delta") {
      assert.equal(value, 0, `boundary.${key} must be 0`);
    } else {
      assert.equal(value, false, `boundary.${key} must be false`);
    }
  }
});

test("BASELINE-VERIFIER-06: substring / suffix GO text is not exact consent", () => {
  assert.equal(
    proposalHasExactGoPhrase(
      `DO NOT AUTHORIZE: ${BASELINE_VERIFIER_GATE_GO_PHRASE}x`,
    ),
    false,
  );
  assert.equal(
    proposalHasExactGoPhrase(`prefix ${BASELINE_VERIFIER_GATE_GO_PHRASE}`),
    false,
  );
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: {
      proposalText: `DO NOT AUTHORIZE: ${BASELINE_VERIFIER_GATE_GO_PHRASE}x`,
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.event.payload.verified, false);
});

test("BASELINE-VERIFIER-07: distinct proposals produce distinct event hashes", () => {
  const a = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: `A\n${BASELINE_VERIFIER_GATE_GO_PHRASE}` },
  });
  const b = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: `B\n${BASELINE_VERIFIER_GATE_GO_PHRASE}` },
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.event.payload.verified, true);
  assert.equal(b.event.payload.verified, true);
  assert.notEqual(a.event.payload.proposal_hash, b.event.payload.proposal_hash);
  assert.notEqual(a.event.event_hash, b.event.event_hash);
});

test("BASELINE-VERIFIER-08: ill-formed UTF-16 is refused before hashing", () => {
  const loneSurrogate = `Plan\n${BASELINE_VERIFIER_GATE_GO_PHRASE}\n` + "\uD800";
  const replaced = `Plan\n${BASELINE_VERIFIER_GATE_GO_PHRASE}\n` + "\uFFFD";
  const ill = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: loneSurrogate },
  });
  assert.equal(ill.ok, false);
  assert.deepEqual(ill.blocked_by, ["proposal_not_well_formed"]);

  const well = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: { proposalText: replaced },
  });
  assert.equal(well.ok, true);
  assert.equal(well.event.payload.verified, true);
});
