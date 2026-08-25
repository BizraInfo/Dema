import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_STAGE,
  buildTraceDiagnosticContract,
  verifyTraceDiagnosticContract,
  defaultTraceDiagnosticFixture,
  runTraceDiagnosticContractGate,
} from "../packages/core/src/dema-trace-diagnostic-contract.js";

const HEX64 = (ch) => ch.repeat(64);

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
