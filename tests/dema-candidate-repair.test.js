import test from "node:test";
import assert from "node:assert/strict";
import { buildCandidateRepair, surfaceCandidateRepairs, CANDIDATE_REPAIR_SCHEMA } from "../packages/core/src/dema-candidate-repair.js";

const NOW = "2026-08-13T06:30:00Z";

// ── CD-01 a whitespace finding becomes a bounded candidate repair task ─────────
test("CD-01: buildCandidateRepair maps a whitespace finding to a reversible_local task", () => {
  const c = buildCandidateRepair({ kind: "whitespace", scope: "packages/core/src/x.js" }, { now: NOW });
  assert.equal(c.effect_class, "reversible_local");
  assert.equal(c.capability_id, "repo.patch_bounded");
  assert.equal(c.task.state, "PENDING");
  assert.match(c.task.task_id, /^repair:whitespace:/);
});

// ── CD-02 THE POINT: a lease-less candidate lands WAITING_SOVEREIGN, never executes ─
test("CD-02: a candidate with no lease is WAITING_SOVEREIGN and the executor is NEVER called", () => {
  const out = surfaceCandidateRepairs({ findings: [{ kind: "whitespace", scope: "docs/TESTING.md" }], now: NOW });
  assert.equal(out.schema, CANDIDATE_REPAIR_SCHEMA);
  assert.equal(out.candidates.length, 1);
  assert.equal(out.candidates[0].state, "WAITING_SOVEREIGN");
  assert.equal(out.candidates[0].reason, "no_standing_lease");
  assert.equal(out.needs_lease_count, 1);
  // needed_lease tells the operator exactly what to grant
  assert.equal(out.candidates[0].needed_lease.capability_id, "repo.patch_bounded");
  assert.equal(out.candidates[0].needed_lease.effect_class, "reversible_local");
  assert.equal(out.authority_delta, 0);
});

// ── CD-03 unknown/malformed findings are refused, not turned into tasks ─────────
test("CD-03: unknown and malformed findings are refused", () => {
  assert.match(buildCandidateRepair({ kind: "quantum_flux" }).error, /unknown_finding_kind:quantum_flux/);
  assert.equal(buildCandidateRepair(null).error, "finding_malformed");
  const out = surfaceCandidateRepairs({ findings: [{ kind: "quantum_flux" }, null], now: NOW });
  assert.equal(out.candidates.length, 0);
  assert.equal(out.refused.length, 2);
});

// ── CD-04 multiple findings surface multiple candidates, all gated ─────────────
test("CD-04: multiple findings all surface as WAITING_SOVEREIGN candidates", () => {
  const out = surfaceCandidateRepairs({
    findings: [
      { kind: "whitespace", scope: "a.js" },
      { kind: "trailing_newline", scope: "b.js" },
    ],
    now: NOW,
  });
  assert.equal(out.candidates.length, 2);
  assert.ok(out.candidates.every((c) => c.state === "WAITING_SOVEREIGN"));
  assert.equal(out.needs_lease_count, 2);
});
