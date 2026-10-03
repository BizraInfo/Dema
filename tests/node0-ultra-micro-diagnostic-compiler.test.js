import test from "node:test";
import assert from "node:assert/strict";

import {
  compileNode0UltraMicroDiagnostic,
  decodeNode0DiagnosticHHMM,
  recallNode0DiagnosticHypergraph,
  verifyNode0UltraMicroDiagnosticPacket,
  NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_TRUTH_LABEL,
} from "../packages/core/src/node0-ultra-micro-diagnostic-compiler.js";
import {
  buildNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";

function fullTrace() {
  return [
    "SIGNAL_ESTATE",
    "SNR",
    "VERIFICATION",
    "AMPLIFICATION",
    "MAXIMIZATION",
    "EXECUTION",
    "RECEIPT",
  ];
}

function validLedger() {
  return buildNode0ProofOfTruthControlPlane(HERMETIC_CONTROL_PLANE_FIXTURE);
}

function cleanEpisode(overrides = {}) {
  return {
    id: "ep-clean",
    intent: "write bounded local artifact",
    boundary: "workspace:write",
    actor_id: "pat-1",
    attestor: "sat-1",
    stage_trace: fullTrace(),
    outcome: "CROSSED",
    effects_started: true,
    consent: { granted: true, source: "principal" },
    artifact_hashes: ["sha256:artifact-1"],
    measured_cost: 0.25,
    realized_value: 1,
    mintable: false,
    failure_recorded: true,
    ...overrides,
  };
}

test("UMDC-01 clean bounded episode stays diagnostic-only with authority_delta=0", () => {
  const input = {
    subject_id: "node0-test",
    proof_ledger: validLedger(),
    episodes: [cleanEpisode()],
    query: { boundary: "workspace:write", attestor: "sat-1" },
  };
  const packet = compileNode0UltraMicroDiagnostic(input);
  assert.equal(packet.truth_label, NODE0_ULTRA_MICRO_DIAGNOSTIC_COMPILER_TRUTH_LABEL);
  assert.equal(packet.compliance.authority_delta, 0);
  assert.equal(packet.compliance.effects_started, 0);
  assert.equal(packet.compliance.mintable, false);
  assert.equal(packet.compliance.runtime_execution, false);
  assert.equal(packet.self_harness.self_certified_independence, false);
  assert.equal(packet.self_harness.hidden_chain_of_thought_required, false);
  assert.deepEqual(verifyNode0UltraMicroDiagnosticPacket(input, packet), { ok: true });
});

test("UMDC-02 empty evidence remains UNKNOWN and cannot manufacture convergence", () => {
  const packet = compileNode0UltraMicroDiagnostic({ subject_id: "empty", episodes: [] });
  assert.equal(packet.latent_health.state, "UNKNOWN");
  assert.equal(packet.proof_convergence.converged, false);
  assert.ok(packet.critique.unknowns.includes("no_episodes"));
  assert.ok(packet.critique.unknowns.includes("proof_ledger_missing"));
  assert.equal(packet.snr.frontier.length, 0);
});

test("UMDC-03 one noisy launder observation does not flip latent health pathologically", () => {
  const d = decodeNode0DiagnosticHHMM([
    { observation: "clean", stage: "SIGNAL_ESTATE" },
    { observation: "clean", stage: "SNR" },
    { observation: "launder_risk", stage: "VERIFICATION" },
    { observation: "clean", stage: "AMPLIFICATION" },
    { observation: "clean", stage: "MAXIMIZATION" },
    { observation: "clean", stage: "RECEIPT" },
  ]);
  assert.notEqual(d.state, "PATHOLOGIC");
  assert.equal(d.parameter_source, "hand_specified_prior_not_trained");
});

test("UMDC-04 sustained laundering flips latent health PATHOLOGIC", () => {
  const d = decodeNode0DiagnosticHHMM(
    Array.from({ length: 6 }, () => ({ observation: "launder_risk", stage: "EXECUTION" })),
  );
  assert.equal(d.state, "PATHOLOGIC");
});

test("UMDC-05 prefix-keyed memo does not leak HEALTHY into unrelated pathology", () => {
  const memo = new Map();
  const clean = decodeNode0DiagnosticHHMM(Array(6).fill("clean"), memo);
  assert.equal(clean.state, "HEALTHY");
  const pathological = decodeNode0DiagnosticHHMM(Array(6).fill("launder_risk"), memo);
  assert.equal(pathological.state, "PATHOLOGIC");
  assert.equal(pathological.memo_hits, 0);
});

test("UMDC-06 DEMA-1A refusal classification outranks infrastructure retryability", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "refusal-priority",
    episodes: [
      cleanEpisode({
        id: "ep-refusal",
        outcome: "HALTED",
        effects_started: false,
        artifact_hashes: [],
        boundary_attempted: true,
        failure_recorded: true,
        failure: { kind: "INFRA", rc: 127, refused: true, infrastructure: true },
      }),
    ],
  });
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.observation === "refusal" && f.evidence_ref === "ep-refusal"
  ), true);
});

test("UMDC-06B infrastructure failure remains explicitly infrastructure, not code", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "infra-classification",
    episodes: [
      cleanEpisode({
        id: "ep-infra",
        outcome: "HALTED",
        effects_started: false,
        artifact_hashes: [],
        boundary_attempted: true,
        failure_recorded: true,
        failure: { kind: "INFRA", rc: 127, infrastructure: true },
      }),
    ],
  });
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.observation === "infra_failure" &&
    f.reason === "infrastructure_unavailable_not_code_failure"
  ), true);
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.observation === "code_failure"
  ), false);
});

test("UMDC-07 outward failure without a durable record is a laundering risk", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "r2",
    episodes: [
      cleanEpisode({
        id: "ep-outward-failure",
        outcome: "HALTED",
        effects_started: false,
        artifact_hashes: [],
        boundary_attempted: true,
        failure_recorded: false,
        failure: { kind: "REFUSAL", refused: true },
      }),
    ],
  });
  assert.ok(packet.critique.contradictions.includes(
    "ep-outward-failure:outward_failure_unrecorded",
  ));
});

test("UMDC-08 simulated impact cannot mint or realize positive value", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "r3",
    episodes: [
      cleanEpisode({
        id: "ep-sim",
        simulated: true,
        dry_run: true,
        mintable: true,
        realized_value: 1,
      }),
    ],
  });
  assert.ok(packet.critique.contradictions.includes("ep-sim:simulated_impact_would_mint"));
  assert.equal(packet.compliance.mintable, false);
});

test("UMDC-09 missing consent stops effect claims at the diagnostic boundary", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "r4",
    episodes: [
      cleanEpisode({
        id: "ep-no-consent",
        consent: { granted: false, source: "principal" },
      }),
    ],
  });
  assert.ok(packet.critique.contradictions.includes("ep-no-consent:effect_started_without_consent"));
});

test("UMDC-10 self-consent is never treated as FATE authority", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "self-consent",
    episodes: [cleanEpisode({ id: "ep-self", self_consent: true, consent: { granted: true, source: "self" } })],
  });
  assert.ok(packet.critique.contradictions.includes("ep-self:self_consent_is_not_fate_authority"));
  assert.equal(packet.compliance.self_consent_permitted, false);
});

test("UMDC-11 actor equals attestor is surfaced as self-attestation", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "independence",
    episodes: [cleanEpisode({ id: "ep-self-attest", actor_id: "same", attestor: "same" })],
  });
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.observation === "self_attested"
  ), true);
});

test("UMDC-12 crossing with no artifact is unbound evidence", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "binding",
    episodes: [cleanEpisode({ id: "ep-unbound", artifact_hashes: [] })],
  });
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.observation === "unbound"
  ), true);
});

test("UMDC-13 process mining distinguishes conformant halt from nonconformant sequence", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "process",
    episodes: [
      cleanEpisode({
        id: "ep-halt",
        stage_trace: ["SIGNAL_ESTATE", "SNR", "VERIFICATION"],
        outcome: "HALTED",
        effects_started: false,
        artifact_hashes: [],
        failure: { kind: "REFUSAL" },
        failure_recorded: true,
      }),
      cleanEpisode({
        id: "ep-bad-order",
        stage_trace: ["SIGNAL_ESTATE", "SNR", "EXECUTION"],
      }),
    ],
  });
  assert.equal(packet.reasoning_hierarchy.level_1_findings.some((f) =>
    f.evidence_ref === "ep-bad-order" && f.observation === "nonconformant"
  ), true);
  assert.equal(packet.process.variants.length, 2);
});

test("UMDC-14 SNR is fixed-k and rejections are explicitly recorded", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "snr",
    snr_keep: 2,
    episodes: [
      cleanEpisode({ id: "a", actor_id: "same", attestor: "same" }),
      cleanEpisode({ id: "b", artifact_hashes: [] }),
      cleanEpisode({ id: "c", realized_value: 2, measured_cost: undefined }),
      cleanEpisode({
        id: "d",
        outcome: "HALTED",
        effects_started: false,
        artifact_hashes: [],
        boundary_attempted: true,
        failure: { kind: "REFUSAL" },
        failure_recorded: true,
      }),
    ],
  });
  assert.equal(packet.snr.frontier.length, 2);
  assert.equal(packet.snr.coupling, "topological_fixed_k");
  assert.equal(packet.snr.rejected.length, packet.diffusion.candidate_count - 2);
});

test("UMDC-15 typed hypergraph recall prefers a two-type join", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "hypergraph",
    episodes: [
      cleanEpisode({ id: "e1", boundary: "workspace:write", attestor: "sat-a" }),
      cleanEpisode({ id: "e2", boundary: "workspace:write", attestor: "sat-b" }),
    ],
    query: { boundary: "workspace:write", attestor: "sat-a" },
  });
  assert.equal(packet.hypergraph.recall[0].evidence_ref, "e1");
  assert.equal(packet.hypergraph.recall[0].matched_types, 2);

  const independent = recallNode0DiagnosticHypergraph(
    { edges: packet.hypergraph.edges },
    { boundary: "workspace:write", attestor: "sat-a" },
    5,
  );
  assert.equal(independent[0].evidence_ref, "e1");
});

test("UMDC-15B existing LOCAL_ONLY proof ledger does not fabricate economic convergence", () => {
  const packet = compileNode0UltraMicroDiagnostic({
    subject_id: "economic-ceiling",
    proof_ledger: validLedger(),
    episodes: [cleanEpisode()],
  });
  assert.equal(packet.proof_convergence.ledger_verified, true);
  assert.equal(packet.proof_convergence.channels.economic, false);
  assert.equal(packet.proof_convergence.converged, false);
  assert.ok(packet.critique.unknowns.includes("proof_channel_open:economic"));
});

test("UMDC-16 verifier re-derives semantics and catches forged packet", () => {
  const input = {
    subject_id: "tamper",
    proof_ledger: validLedger(),
    episodes: [cleanEpisode()],
  };
  const honest = compileNode0UltraMicroDiagnostic(input);
  const forged = {
    ...honest,
    compliance: {
      ...honest.compliance,
      authority_delta: 1,
    },
  };
  assert.equal(verifyNode0UltraMicroDiagnosticPacket(input, forged).ok, false);
});
