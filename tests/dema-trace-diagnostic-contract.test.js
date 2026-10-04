import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_STAGE,
  buildTraceDiagnosticContract,
  verifyTraceDiagnosticContract,
  defaultTraceDiagnosticFixture,
  runTraceDiagnosticContractGate,
  buildTraceDiagnosticContractV2,
  verifyTraceDiagnosticContractV2,
  computeTraceDiagnosticReplaySubjectHashV2,
  defaultTraceDiagnosticFixtureV2,
  runTraceDiagnosticContractGateV2,
} from "../packages/core/src/dema-trace-diagnostic-contract.js";

const HEX64 = (ch) => ch.repeat(64);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableJson(v) ?? "null").join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().flatMap((k) => {
      const serialized = stableJson(value[k]);
      return serialized === undefined ? [] : [`${JSON.stringify(k)}:${serialized}`];
    });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function withV2ReplaySubjectHash(input) {
  const replay_subject_hash = computeTraceDiagnosticReplaySubjectHashV2(
    input.trace_set,
    input.hypothesis_graph,
    input.insight_candidate,
  );
  return {
    ...input,
    verification: { ...input.verification, replay_subject_hash },
  };
}

function validTrace(id, sha = "a") {
  return {
    trace_id: id,
    scope: `code::${id}`,
    completeness: "SCOPED",
    correlation_limit: "static-code only; no runtime",
    source_ref: `packages/core/src/${id}.js`,
    source_sha256: HEX64(sha),
    observed_at: "2026-08-26T00:00:00.000Z",
  };
}

function validFixture() {
  return defaultTraceDiagnosticFixture();
}

// T01 — all four rails pass => INSIGHT_AUTHORIZED and gate PASS
test("T01: full contract authorizes insight", () => {
  const input = validFixture();
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.promotion_status, "INSIGHT_AUTHORIZED");
  assert.equal(built.rails.provenance.ok, true);
  assert.equal(built.rails.consistency.ok, true);
  assert.equal(built.rails.disambiguation.ok, true);
  assert.equal(built.rails.corroboration.ok, true);
  assert.equal(built.blocked_by.length, 0);
  assert.match(built.diagnostic_hash, /^sha256:[0-9a-f]{64}$/);
  const v = verifyTraceDiagnosticContract(built);
  assert.equal(v.ok, true);
  const gate = runTraceDiagnosticContractGate({ input });
  assert.equal(gate.ok, true);
});

// T02 — provenance fails closed: missing source_sha256 => BLOCKED (inadmissible)
test("T02: missing provenance blocks as BLOCKED", () => {
  const input = {
    ...validFixture(),
    trace_set: [{ ...validTrace("t1"), source_sha256: "" }],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.promotion_status, "BLOCKED");
  assert.equal(built.rails.provenance.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("source_sha256_invalid")));
  const v = verifyTraceDiagnosticContract(built);
  // BLOCKED report itself is still well-formed and verifiable (it correctly refuses)
  assert.equal(v.ok, true);
  // gate should NOT authorize insight when BLOCKED
  const gate = runTraceDiagnosticContractGate({ input });
  assert.equal(gate.ok, false);
  assert.equal(gate.promotion_status, "BLOCKED");
});

// T03 — consistency fails: hypothesis references unknown trace => REMAIN_TRACE
test("T03: unknown trace ref fails consistency => REMAIN_TRACE", () => {
  const input = {
    ...validFixture(),
    hypothesis_graph: [
      { hypothesis_id: "H1", explains_traces: ["trace.code_static_001"] },
      { hypothesis_id: "H2", explains_traces: ["trace.nonexistent"] },
    ],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("unknown_trace_ref")));
});

// T04 — disambiguation fails: single hypothesis => REMAIN_TRACE, not authorized
test("T04: single hypothesis fails disambiguation => REMAIN_TRACE", () => {
  const input = {
    ...validFixture(),
    hypothesis_graph: [{ hypothesis_id: "H1_only", explains_traces: ["trace.code_static_001"] }],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.disambiguation.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("at_least_two_hypotheses")));
});

// T05 — corroboration fails: replay not performed => REMAIN_TRACE
test("T05: missing corroboration => REMAIN_TRACE", () => {
  const input = {
    ...validFixture(),
    verification: { replay_performed: false, independent: false, independent_replay_hash: HEX64("c") },
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.corroboration.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
});

// T06 — scope not explicit fails provenance
test("T06: scope UNKNOWN is not explicit", () => {
  const input = {
    ...validFixture(),
    trace_set: [{ ...validTrace("t1"), scope: "UNKNOWN" }],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.provenance.ok, false);
  assert.equal(built.promotion_status, "BLOCKED");
});

// T07 — duplicate trace_id fails consistency/provenance
test("T07: duplicate trace_id is blocked", () => {
  const t = validTrace("dup");
  const input = { ...validFixture(), trace_set: [t, { ...t, source_sha256: HEX64("b") }] };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.provenance.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("duplicate_trace_id")));
});

// T08 — all-false boundary and frozen
test("T08: boundary all-false and report frozen", () => {
  const built = buildTraceDiagnosticContract(validFixture());
  for (const [k, v] of Object.entries(built.boundary)) assert.equal(v, false, k);
  assert.equal(Object.isFrozen(built), true);
  assert.equal(Object.isFrozen(built.rails), true);
  assert.throws(() => {
    built.promotion_status = "X";
  }, /Cannot assign|read only/);
});

// T09 — semantic rederivation rejects tampered promotion_status even with recomputed hash
test("T09: tampered promotion_status fails verify via rederivation", () => {
  const built = buildTraceDiagnosticContract(validFixture());
  const forgedBody = { ...built, promotion_status: "REMAIN_TRACE" };
  const { diagnostic_hash: _omit, ...hashBody } = forgedBody;
  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v) ?? "null").join(",")}]`;
    if (value && typeof value === "object") {
      const entries = Object.keys(value).sort().flatMap((k) => {
        const ser = stableStringify(value[k]);
        return ser === undefined ? [] : [`${JSON.stringify(k)}:${ser}`];
      });
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
  }
  const forgedHash = `sha256:${createHash("sha256").update(stableStringify(hashBody), "utf8").digest("hex")}`;
  const forged = { ...forgedBody, diagnostic_hash: forgedHash };
  const v = verifyTraceDiagnosticContract(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.includes("semantic_rederivation_mismatch") || c.includes("promotion_status_mismatch")));
});

// T10 — determinism: same input => same hash
test("T10: deterministic hash for same input", () => {
  const a = buildTraceDiagnosticContract(validFixture());
  const b = buildTraceDiagnosticContract(validFixture());
  assert.equal(a.diagnostic_hash, b.diagnostic_hash);
});

// T11 — completeness enum enforced
test("T11: invalid completeness is blocked", () => {
  const input = {
    ...validFixture(),
    trace_set: [{ ...validTrace("t1"), completeness: "FULL" }],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.provenance.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("completeness_invalid")));
});

// T12 — schema/truth/stage invariants and invalid verify
test("T12: verify rejects wrong schema and bad boundary", () => {
  const built = buildTraceDiagnosticContract(validFixture());
  const badSchema = { ...built, schema: "wrong" };
  assert.equal(verifyTraceDiagnosticContract(badSchema).ok, false);
  const badBoundary = { ...built, boundary: { ...built.boundary, network_used: true } };
  const rehashed = buildTraceDiagnosticContract({
    trace_set: badBoundary.trace_set,
    hypothesis_graph: badBoundary.hypothesis_graph,
    insight_candidate: badBoundary.insight_candidate,
    verification: badBoundary.verification,
  });
  const tampered = { ...rehashed, boundary: { ...rehashed.boundary, network_used: true } };
  const { diagnostic_hash: _o2, ...hb2 } = tampered;
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map((v) => stable(v) ?? "null").join(",")}]`;
    if (value && typeof value === "object") {
      const entries = Object.keys(value).sort().flatMap((k) => {
        const ser = stable(value[k]);
        return ser === undefined ? [] : [`${JSON.stringify(k)}:${ser}`];
      });
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
  }
  tampered.diagnostic_hash = `sha256:${createHash("sha256").update(stable(hb2), "utf8").digest("hex")}`;
  const v2 = verifyTraceDiagnosticContract(tampered);
  assert.equal(v2.ok, false);
  assert.ok(v2.blocked_by.some((c) => c.includes("boundary_not_false")));
});

// T13 — gate happy path emits INSIGHT_AUTHORIZED only on full contract
test("T13: gate distinguishes authorized vs remain", () => {
  const full = runTraceDiagnosticContractGate({ input: validFixture() });
  assert.equal(full.promotion_status, "INSIGHT_AUTHORIZED");
  assert.equal(full.ok, true);
  const partial = runTraceDiagnosticContractGate({
    input: { ...validFixture(), verification: { replay_performed: false, independent: false, independent_replay_hash: HEX64("c") } },
  });
  assert.equal(partial.promotion_status, "REMAIN_TRACE");
  assert.equal(partial.ok, false);
});

// T14 — duplicate hypothesis id
test("T14: duplicate hypothesis_id fails consistency", () => {
  const input = {
    ...validFixture(),
    hypothesis_graph: [
      { hypothesis_id: "H1", explains_traces: ["trace.code_static_001"] },
      { hypothesis_id: "H1", explains_traces: ["trace.runtime_harness_001"] },
    ],
  };
  const built = buildTraceDiagnosticContract(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("duplicate_hypothesis_id")));
});

// ═══════════════════════════════════════════════════════════════════════
// v0.2 TESTS — subject binding, evidence integrity, partial restriction
// ═══════════════════════════════════════════════════════════════════════

// T15 — v0.2 happy path: full contract with subject hash authorizes insight
test("T15: v0.2 full contract authorizes insight", () => {
  const input = defaultTraceDiagnosticFixtureV2();
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.schema, DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA);
  assert.equal(built.version, "0.2");
  assert.equal(built.promotion_status, "INSIGHT_AUTHORIZED");
  assert.equal(built.rails.provenance.ok, true);
  assert.equal(built.rails.consistency.ok, true);
  assert.equal(built.rails.disambiguation.ok, true);
  assert.equal(built.rails.corroboration.ok, true);
  assert.equal(built.blocked_by.length, 0);
  const v = verifyTraceDiagnosticContractV2(built);
  assert.equal(v.ok, true);
  const gate = runTraceDiagnosticContractGateV2({ input });
  assert.equal(gate.ok, true);
});

// T16 — v0.2 red-first: unknown evidence_ref in insight => REMAIN_TRACE
test("T16: v0.2 unknown evidence_ref fails consistency", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    insight_candidate: {
      claim: "test claim",
      evidence_refs: ["trace.code_static_001", "trace.nonexistent_ref"],
    },
  };
  // must recompute subject hash since insight changed
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("unknown_evidence_ref")));
});

// T17 — v0.2 red-first: PARTIAL evidence cited in insight => REMAIN_TRACE
test("T17: v0.2 PARTIAL evidence cited prevents authorization", () => {
  const partialTrace = {
    trace_id: "trace.partial_001",
    scope: "runtime::partial",
    completeness: "PARTIAL",
    correlation_limit: "limited scope",
    source_ref: "scripts/partial.mjs",
    source_sha256: HEX64("d"),
    observed_at: "2026-08-26T00:00:00.000Z",
  };
  const input = {
    trace_set: [
      { ...defaultTraceDiagnosticFixtureV2().trace_set[0] },
      { ...defaultTraceDiagnosticFixtureV2().trace_set[1] },
      deepFreeze(partialTrace),
    ],
    hypothesis_graph: [
      { hypothesis_id: "H1", explains_traces: ["trace.code_static_001"] },
      { hypothesis_id: "H2", explains_traces: ["trace.partial_001"] },
    ],
    insight_candidate: {
      claim: "partial evidence test",
      evidence_refs: ["trace.partial_001"],
    },
    verification: defaultTraceDiagnosticFixtureV2().verification,
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.equal(built.rails.disambiguation.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("partial_evidence_cited")));
  assert.ok(built.blocked_by.some((c) => c.includes("disambiguation_partial_trace_ref")));
});

// T18 — v0.2 red-first: orphan evidence_ref (not covered by any hypothesis) => REMAIN_TRACE
test("T18: v0.2 orphan evidence_ref fails consistency", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    insight_candidate: {
      claim: "orphan evidence test",
      evidence_refs: ["trace.code_static_001", "trace.runtime_harness_001"],
    },
    hypothesis_graph: [
      // H1 explains trace.code_static_001 but NOT trace.runtime_harness_001
      { hypothesis_id: "H1", explains_traces: ["trace.code_static_001"] },
      { hypothesis_id: "H2", explains_traces: ["trace.code_static_001"] },
    ],
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("orphan_evidence_ref")));
});

// T19 — v0.2 red-first: missing replay_subject_hash => REMAIN_TRACE
test("T19: v0.2 missing subject hash fails corroboration", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    verification: {
      replay_performed: true,
      independent: true,
      independent_replay_hash: HEX64("c"),
      // replay_subject_hash deliberately omitted
    },
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.corroboration.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("replay_subject_hash_missing")));
});

// T20 — v0.2 red-first: wrong replay_subject_hash => REMAIN_TRACE
test("T20: v0.2 wrong subject hash fails corroboration", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    verification: {
      replay_performed: true,
      independent: true,
      independent_replay_hash: HEX64("c"),
      replay_subject_hash: HEX64("x"), // wrong hash
    },
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.corroboration.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.some((c) => c.includes("replay_subject_hash_mismatch")));
});

// T21 — v0.2 red-first: empty insight claim => REMAIN_TRACE
test("T21: v0.2 empty insight claim fails consistency", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    insight_candidate: { claim: "", evidence_refs: ["trace.code_static_001"] },
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("insight_claim_empty")));
});

// T22 — v0.2 red-first: empty evidence_refs => REMAIN_TRACE
test("T22: v0.2 empty evidence_refs fails consistency", () => {
  const input = {
    ...defaultTraceDiagnosticFixtureV2(),
    insight_candidate: { claim: "valid claim", evidence_refs: [] },
  };
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.consistency.ok, false);
  assert.ok(built.blocked_by.some((c) => c.includes("evidence_refs_empty")));
});

// T23 — v0.2: subject hash is deterministic and binds inputs
test("T23: v0.2 subject hash is deterministic", () => {
  const a = buildTraceDiagnosticContractV2(defaultTraceDiagnosticFixtureV2());
  const b = buildTraceDiagnosticContractV2(defaultTraceDiagnosticFixtureV2());
  assert.equal(a.diagnostic_hash, b.diagnostic_hash);
  // subject hash must appear in verification
  assert.match(a.verification.replay_subject_hash, /^[0-9a-f]{64}$/);
});

// T24 — v0.2: tampered subject hash fails verify via rederivation
test("T24: v0.2 tampered subject hash fails verify", () => {
  const built = buildTraceDiagnosticContractV2(defaultTraceDiagnosticFixtureV2());
  const tampered = {
    ...built,
    verification: { ...built.verification, replay_subject_hash: HEX64("x") },
  };
  // recompute hash for tampered body
  const { diagnostic_hash: _omit, ...hashBody } = tampered;
  tampered.diagnostic_hash = `sha256:${createHash("sha256").update(stableJson(hashBody), "utf8").digest("hex")}`;
  const v = verifyTraceDiagnosticContractV2(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.includes("replay_subject_hash_mismatch") || c.includes("semantic_rederivation_mismatch")));
});

// T25 — v0.1 backward compat: v0.1 fixture still works
test("T25: v0.1 backward compatibility preserved", () => {
  const v1 = runTraceDiagnosticContractGate();
  assert.equal(v1.ok, true);
  assert.equal(v1.schema, DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA);
  // v0.1 does NOT require subject hash
  const v1built = buildTraceDiagnosticContract(defaultTraceDiagnosticFixture());
  assert.equal(v1built.rails.corroboration.ok, true); // v0.1 ignores subject hash
});

// T26 — v0.2: evidence-laundering attack (evict hypothesis coverage after build)
test("T26: v0.2 evidence-laundering attack detected", () => {
  const input = defaultTraceDiagnosticFixtureV2();
  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.ok ?? built.promotion_status, "INSIGHT_AUTHORIZED");
  // Attack: remove hypothesis coverage for one cited evidence_ref
  const attacked = {
    ...built,
    hypothesis_graph: [
      // Only H1, which explains trace.code_static_001 but NOT trace.runtime_harness_001
      { hypothesis_id: "H1_inward_defect", explains_traces: ["trace.code_static_001"] },
    ],
  };
  // Re-derive with attacked graph — should fail
  const rederived = buildTraceDiagnosticContractV2({
    trace_set: attacked.trace_set,
    hypothesis_graph: attacked.hypothesis_graph,
    insight_candidate: attacked.insight_candidate,
    verification: attacked.verification,
  });
  assert.equal(rederived.rails.consistency.ok, false);
  assert.ok(rederived.blocked_by.some((c) => c.includes("orphan_evidence_ref")));
});

// T27 — v0.2: a second hypothesis that explains no admissible evidence is not
// a competing explanation and must never authorize an insight.
test("T27: v0.2 vacuous hypothesis remains trace", () => {
  const base = defaultTraceDiagnosticFixtureV2();
  const input = withV2ReplaySubjectHash({
    ...base,
    hypothesis_graph: [
      {
        hypothesis_id: "H1_evidence_bearing",
        explains_traces: ["trace.code_static_001", "trace.runtime_harness_001"],
      },
      { hypothesis_id: "H2_vacuous", explains_traces: [] },
    ],
  });

  const built = buildTraceDiagnosticContractV2(input);
  assert.equal(built.rails.provenance.ok, true);
  assert.equal(built.rails.consistency.ok, true);
  assert.equal(built.rails.corroboration.ok, true);
  assert.equal(built.rails.disambiguation.ok, false);
  assert.equal(built.promotion_status, "REMAIN_TRACE");
  assert.ok(built.blocked_by.includes("v2_disambiguation_hypothesis_without_evidence"));
});

// T28 — v0.2: enumeration is not disambiguation. Every listed alternative
// must answer to admissible evidence, and at least one trace must be shared by
// two distinct hypotheses.
test("T28: v0.2 rejects each non-competing disambiguation shape", () => {
  const base = defaultTraceDiagnosticFixtureV2();
  const allEvidence = ["trace.code_static_001", "trace.runtime_harness_001"];
  const cases = [
    {
      name: "one hypothesis only",
      hypothesis_graph: [{ hypothesis_id: "H1", explains_traces: allEvidence }],
      blockedBy: "v2_disambiguation_requires_at_least_two_hypotheses",
    },
    {
      name: "vacuous second hypothesis",
      hypothesis_graph: [
        { hypothesis_id: "H1", explains_traces: allEvidence },
        { hypothesis_id: "H2", explains_traces: [] },
      ],
      blockedBy: "v2_disambiguation_hypothesis_without_evidence",
    },
    {
      name: "both hypotheses vacuous",
      hypothesis_graph: [
        { hypothesis_id: "H1", explains_traces: [] },
        { hypothesis_id: "H2", explains_traces: [] },
      ],
      blockedBy: "v2_disambiguation_hypothesis_without_evidence",
    },
    {
      name: "nonexistent trace reference",
      hypothesis_graph: [
        { hypothesis_id: "H1", explains_traces: allEvidence },
        { hypothesis_id: "H2", explains_traces: ["trace.unknown"] },
      ],
      blockedBy: "v2_disambiguation_hypothesis_without_evidence",
    },
    {
      name: "duplicate hypothesis ids",
      hypothesis_graph: [
        { hypothesis_id: "H1", explains_traces: allEvidence },
        { hypothesis_id: "H1", explains_traces: ["trace.runtime_harness_001"] },
      ],
      blockedBy: "v2_disambiguation_requires_two_evidence_bearing_hypotheses",
    },
    {
      name: "evidence-bearing but disjoint hypotheses",
      hypothesis_graph: [
        { hypothesis_id: "H1", explains_traces: ["trace.code_static_001"] },
        { hypothesis_id: "H2", explains_traces: ["trace.runtime_harness_001"] },
      ],
      blockedBy: "v2_disambiguation_no_competing_evidence",
    },
  ];

  for (const { name, hypothesis_graph, blockedBy } of cases) {
    const built = buildTraceDiagnosticContractV2(
      withV2ReplaySubjectHash({ ...base, hypothesis_graph }),
    );
    assert.equal(built.rails.disambiguation.ok, false, name);
    assert.equal(built.promotion_status, "REMAIN_TRACE", name);
    assert.ok(built.blocked_by.includes(blockedBy), `${name}: ${built.blocked_by}`);
  }
});

test("T29: v0.2 authorizes genuinely competing admissible evidence", () => {
  const input = defaultTraceDiagnosticFixtureV2();
  const built = buildTraceDiagnosticContractV2(input);
  const [first, second] = input.hypothesis_graph;
  assert.ok(first.explains_traces.some((traceId) => second.explains_traces.includes(traceId)));
  assert.equal(built.rails.provenance.ok, true);
  assert.equal(built.rails.consistency.ok, true);
  assert.equal(built.rails.disambiguation.ok, true);
  assert.equal(built.rails.corroboration.ok, true);
  assert.equal(built.promotion_status, "INSIGHT_AUTHORIZED");
  assert.equal(verifyTraceDiagnosticContractV2(built).ok, true);
});

// helper for deep-freeze in tests
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
