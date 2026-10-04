import test from "node:test";
import assert from "node:assert/strict";

import {
  FOUNDER_PAT_HARNESS_SCHEMA,
  FOUNDER_PAT_HARNESS_TRUTH_LABEL,
  FOUNDER_PAT_SEAT_ROLE_CONTRACTS,
  buildFounderPatHarnessCandidate,
  verifyFounderPatHarnessCandidate,
} from "../packages/core/src/founder-pat-harness.js";

const MISSION = {
  mission_id: "founder-useful-local-closure",
  permitted_evidence: [
    {
      evidence_ref: "mission:founder-useful-local-closure",
      source_ref: "campaign:mission-contract",
      source_sha256: "sha256:mission-contract",
    },
    {
      evidence_ref: "receipt:founder:baseline",
      source_ref: "receipt:founder:baseline",
      source_sha256: "sha256:founder-baseline",
    },
  ],
};

function seatOutputs() {
  return FOUNDER_PAT_SEAT_ROLE_CONTRACTS.map(({ role_id }) => ({
    role_id,
    output_text: `Scoped proposal for ${role_id} in ${MISSION.mission_id}.`,
    evidence_refs: ["mission:founder-useful-local-closure"],
  }));
}

function build(overrides = {}) {
  return buildFounderPatHarnessCandidate({
    mission: MISSION,
    seat_outputs: seatOutputs(),
    ...overrides,
  });
}

test("PAT-7 candidate owner exposes seven distinct canonical role contracts", () => {
  assert.equal(FOUNDER_PAT_SEAT_ROLE_CONTRACTS.length, 7);
  assert.deepEqual(
    FOUNDER_PAT_SEAT_ROLE_CONTRACTS.map((contract) => contract.role_id),
    [
      "pat-1-archivist",
      "pat-2-extractor",
      "pat-3-cartographer",
      "pat-4-scout",
      "pat-5-applicability-engineer",
      "pat-6-reproduction-engineer",
      "pat-7-scribe",
    ],
  );
  assert.equal(
    new Set(FOUNDER_PAT_SEAT_ROLE_CONTRACTS.map((contract) => contract.role_id)).size,
    7,
  );
});

test("candidate build is deterministic, frozen, proposal-only, and authority-free", () => {
  const first = build();
  const second = build();

  assert.deepEqual(first, second);
  assert.equal(first.schema, FOUNDER_PAT_HARNESS_SCHEMA);
  assert.equal(first.truth_label, FOUNDER_PAT_HARNESS_TRUTH_LABEL);
  assert.equal(first.status, "CANDIDATE_HARNESS_PROPOSAL_ONLY");
  assert.equal(first.authority_delta, 0);
  assert.equal(first.seat_receipts.length, 7);
  assert.ok(Object.values(first.boundary).every((value) => value === false));
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.seat_receipts[0].trace));
});

test("each seat has exactly one correlated invocation, result, and trace", () => {
  const candidate = build();
  const invocationIds = new Set();
  const resultIds = new Set();
  const traceIds = new Set();

  for (const seat of candidate.seat_receipts) {
    assert.equal(seat.role_contract.team, "PAT");
    assert.equal(seat.role_contract.role_id, seat.role_id);
    assert.equal(seat.invocation.role_id, seat.role_id);
    assert.equal(seat.result.role_id, seat.role_id);
    assert.equal(seat.trace.role_id, seat.role_id);
    assert.equal(seat.invocation.result_id, seat.result.result_id);
    assert.equal(seat.invocation.trace_id, seat.trace.trace_id);
    assert.equal(seat.result.invocation_id, seat.invocation.invocation_id);
    assert.equal(seat.result.trace_id, seat.trace.trace_id);
    assert.equal(seat.trace.invocation_id, seat.invocation.invocation_id);
    assert.equal(seat.trace.result_id, seat.result.result_id);
    assert.equal(seat.invocation.status, "NOT_INVOKED_CANDIDATE");
    assert.equal(seat.trace.status, "NOT_EXECUTED_CANDIDATE");
    invocationIds.add(seat.invocation.invocation_id);
    resultIds.add(seat.result.result_id);
    traceIds.add(seat.trace.trace_id);
  }

  assert.equal(invocationIds.size, 7);
  assert.equal(resultIds.size, 7);
  assert.equal(traceIds.size, 7);
});

test("permitted mission evidence grounds outputs and synthesis preserves source links", () => {
  const candidate = build();
  const admitted = candidate.seat_receipts.filter(
    (seat) => seat.result.grounding_status === "GROUNDED_PROPOSAL",
  );

  assert.equal(admitted.length, 7);
  assert.equal(candidate.synthesis.status, "GROUNDED_PROPOSAL_ONLY");
  assert.equal(candidate.synthesis.source_result_ids.length, 7);
  assert.equal(candidate.synthesis.source_trace_ids.length, 7);
  assert.deepEqual(candidate.synthesis.evidence_refs, [
    "mission:founder-useful-local-closure",
  ]);
  assert.deepEqual(
    candidate.synthesis.source_result_ids,
    admitted.map((seat) => seat.result.result_id),
  );
  assert.deepEqual(
    candidate.synthesis.source_trace_ids,
    admitted.map((seat) => seat.trace.trace_id),
  );
});

test("unpermitted evidence and unsupported entities are quarantined out of synthesis", () => {
  const outputs = seatOutputs();
  outputs[0] = {
    role_id: outputs[0].role_id,
    output_text: "FINDING: John Smith supplied an unsupported claim.",
    evidence_refs: ["evidence:not-permitted"],
  };
  const candidate = build({ seat_outputs: outputs });
  const seat = candidate.seat_receipts[0];

  assert.equal(seat.result.grounding_status, "QUARANTINED_UNSUPPORTED_ENTITY");
  assert.deepEqual(seat.result.grounded_evidence_refs, []);
  assert.deepEqual(seat.result.rejected_evidence_refs, ["evidence:not-permitted"]);
  assert.equal(candidate.synthesis.source_result_ids.length, 6);
  assert.ok(!candidate.synthesis.source_result_ids.includes(seat.result.result_id));
  assert.ok(!candidate.synthesis.output_text.includes("John Smith"));
});

test("verifier accepts the candidate and rejects correlation tampering", () => {
  const candidate = build();
  assert.equal(verifyFounderPatHarnessCandidate(candidate).ok, true);

  const tampered = structuredClone(candidate);
  tampered.seat_receipts[0].result.trace_id = "trace:tampered";
  const verification = verifyFounderPatHarnessCandidate(tampered);
  assert.equal(verification.ok, false);
  assert.ok(verification.blocked_by.length > 0);
});

test("missing mission identity is blocked without creating a runtime path", () => {
  const blocked = buildFounderPatHarnessCandidate({
    seat_outputs: seatOutputs(),
  });
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.blocked_by.includes("mission_id_required"));
  assert.equal(blocked.authority_delta, 0);
  assert.ok(Object.values(blocked.boundary).every((value) => value === false));
});

test("empty proposals remain quarantined and verifier fails closed on malformed shapes", () => {
  const empty = build({ seat_outputs: [] });
  assert.equal(empty.status, "CANDIDATE_HARNESS_PROPOSAL_ONLY");
  assert.equal(empty.synthesis.status, "NO_GROUNDED_PROPOSALS");
  assert.ok(empty.seat_receipts.every((seat) => seat.result.grounding_status === "QUARANTINED_EMPTY_RESULT"));
  assert.equal(verifyFounderPatHarnessCandidate(empty).ok, true);

  assert.deepEqual(verifyFounderPatHarnessCandidate(null).blocked_by, ["candidate_not_object"]);

  const unknownSeat = structuredClone(build());
  unknownSeat.seat_receipts[0].role_id = "pat-unknown";
  assert.ok(verifyFounderPatHarnessCandidate(unknownSeat).blocked_by.includes("seat:pat-unknown:role_unknown"));

  const contractMismatch = structuredClone(build());
  contractMismatch.seat_receipts[0].role_contract = {
    ...contractMismatch.seat_receipts[0].role_contract,
    role_id: contractMismatch.seat_receipts[1].role_id,
  };
  const mismatchResult = verifyFounderPatHarnessCandidate(contractMismatch);
  assert.ok(mismatchResult.blocked_by.includes("seat:pat-1-archivist:role_contract_mismatch"));
  assert.ok(mismatchResult.blocked_by.includes("seat:pat-1-archivist:role_contract_id_mismatch"));

  const noReceipts = structuredClone(build());
  noReceipts.seat_receipts = null;
  assert.ok(verifyFounderPatHarnessCandidate(noReceipts).blocked_by.includes("seat_receipts_not_array"));
});

test("verifier rejects every correlated evidence and hash boundary independently", () => {
  const tamperCases = [
    ["invocation correlation", (candidate) => { candidate.seat_receipts[0].invocation.trace_id = "trace:tampered"; }, "invocation_correlation_mismatch"],
    ["trace correlation", (candidate) => { candidate.seat_receipts[0].trace.result_id = "result:tampered"; }, "trace_correlation_mismatch"],
    ["missing correlation record", (candidate) => { candidate.seat_receipts[0].invocation = null; }, "correlation_record_missing"],
    ["role correlation", (candidate) => { candidate.seat_receipts[0].invocation.role_id = candidate.seat_receipts[1].role_id; }, "role_correlation_mismatch"],
    ["subtask scope", (candidate) => { candidate.seat_receipts[0].subtask_ref = "wrong/subtask"; }, "subtask_ref_mismatch"],
    ["invocation evidence scope", (candidate) => { candidate.seat_receipts[0].invocation.permitted_evidence_refs = [...candidate.seat_receipts[0].invocation.permitted_evidence_refs, "evidence:outside"]; }, "invocation_evidence_scope_mismatch"],
    ["result evidence scope", (candidate) => { candidate.seat_receipts[0].result.grounded_evidence_refs = [...candidate.seat_receipts[0].result.grounded_evidence_refs, "evidence:outside"]; }, "result_evidence_scope_mismatch"],
    ["trace evidence scope", (candidate) => { candidate.seat_receipts[0].trace.evidence_refs = [...candidate.seat_receipts[0].trace.evidence_refs, "evidence:outside"]; }, "trace_evidence_scope_mismatch"],
    ["trace hash", (candidate) => { candidate.seat_receipts[0].trace.trace_hash = "sha256:tampered"; }, "trace_hash_mismatch"],
    ["input hash", (candidate) => { candidate.seat_receipts[0].invocation.input_hash = "sha256:tampered"; }, "input_hash_mismatch"],
    ["unsupported claim admission", (candidate) => { candidate.seat_receipts[0].result.unsupported_entity = true; }, "unsupported_entity_admitted"],
    ["top-level subtask refs", (candidate) => { candidate.subtask_refs[0] = "wrong/subtask"; }, "subtask_refs_mismatch"],
    ["top-level synthesis refs", (candidate) => { candidate.synthesis_refs[0] = "wrong/ref"; }, "synthesis_refs_mismatch"],
    ["top-level role contracts", (candidate) => { candidate.seat_contracts[0].role_id = "pat-unknown"; }, "seat_contracts_mismatch"],
  ];

  for (const [label, mutate, expected] of tamperCases) {
    const candidate = structuredClone(build());
    mutate(candidate);
    const result = verifyFounderPatHarnessCandidate(candidate);
    assert.equal(result.ok, false, label);
    assert.ok(result.blocked_by.some((reason) => reason.endsWith(expected)), `${label}: ${result.blocked_by.join(", ")}`);
  }
});

test("role and seat-output normalization rejects missing, unknown, and duplicate contracts", () => {
  const shortContracts = buildFounderPatHarnessCandidate({
    mission: MISSION,
    role_contracts: FOUNDER_PAT_SEAT_ROLE_CONTRACTS.slice(0, 6),
    seat_outputs: [],
  });
  assert.ok(shortContracts.blocked_by.some((reason) => reason.startsWith("role_contract_count:")));
  assert.ok(shortContracts.blocked_by.some((reason) => reason.startsWith("missing_pat_role_contract:")));

  const duplicateContracts = [...FOUNDER_PAT_SEAT_ROLE_CONTRACTS];
  duplicateContracts[1] = duplicateContracts[0];
  const duplicate = buildFounderPatHarnessCandidate({ mission: MISSION, role_contracts: duplicateContracts, seat_outputs: [] });
  assert.ok(duplicate.blocked_by.includes("duplicate_role_contract:pat-1-archivist"));

  const unknownOutput = build({ seat_outputs: [{ role_id: "pat-unknown", output_text: "ignored", evidence_refs: [] }] });
  assert.ok(unknownOutput.blocked_by.includes("unknown_seat_output:pat-unknown"));

  const duplicateOutput = build({ seat_outputs: [
    { role_id: FOUNDER_PAT_SEAT_ROLE_CONTRACTS[0].role_id, output_text: "one", evidence_refs: [] },
    { role_id: FOUNDER_PAT_SEAT_ROLE_CONTRACTS[0].role_id, output_text: "two", evidence_refs: [] },
  ] });
  assert.ok(duplicateOutput.blocked_by.includes(`duplicate_seat_output:${FOUNDER_PAT_SEAT_ROLE_CONTRACTS[0].role_id}`));

  const stringEvidence = buildFounderPatHarnessCandidate({
    mission_id: MISSION.mission_id,
    permitted_evidence: ["mission:founder-useful-local-closure"],
    permitted_evidence_refs: ["mission:founder-useful-local-closure", "receipt:not-yet-bound"],
    seat_outputs: seatOutputs(),
  });
  assert.equal(stringEvidence.status, "CANDIDATE_HARNESS_PROPOSAL_ONLY");
  assert.equal(stringEvidence.mission.permitted_evidence[1].source_ref, null);

  const objectEvidence = buildFounderPatHarnessCandidate({
    mission_id: MISSION.mission_id,
    permitted_evidence: { "mission:founder-useful-local-closure": "campaign:mission-contract" },
    seat_outputs: seatOutputs(),
  });
  assert.equal(objectEvidence.mission.permitted_evidence[0].source_ref, "campaign:mission-contract");

  const unknownContract = [...FOUNDER_PAT_SEAT_ROLE_CONTRACTS];
  unknownContract[0] = { ...unknownContract[0], role_id: "pat-unknown" };
  const unknownContractResult = buildFounderPatHarnessCandidate({ mission: MISSION, role_contracts: unknownContract, seat_outputs: [] });
  assert.ok(unknownContractResult.blocked_by.includes("unknown_pat_role_contract:pat-unknown"));

  const mismatchedContract = [...FOUNDER_PAT_SEAT_ROLE_CONTRACTS];
  mismatchedContract[0] = { ...mismatchedContract[0], role_description: "tampered" };
  const mismatchedContractResult = buildFounderPatHarnessCandidate({ mission: MISSION, role_contracts: mismatchedContract, seat_outputs: [] });
  assert.ok(mismatchedContractResult.blocked_by.includes("role_contract_mismatch:pat-1-archivist"));

  const nonArrayContracts = buildFounderPatHarnessCandidate({ mission: MISSION, role_contracts: null, seat_outputs: [] });
  assert.ok(nonArrayContracts.blocked_by.includes("role_contracts_not_array"));
});
