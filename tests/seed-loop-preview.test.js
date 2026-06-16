import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSeedLoopPreview,
  SEED_LOOP_PREVIEW_SCHEMA,
  SEED_LOOP_STAGES,
} from "../packages/core/src/seed-loop-preview.js";
import { buildAssumptionStatePreview } from "../packages/core/src/assumption-state-preview.js";
import { buildProofConvergencePreview } from "../packages/core/src/proof-convergence-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// admissible (all V/D) assumption state
const ADMISSIBLE = buildAssumptionStatePreview({
  claims: [
    { id: "v", claim_state: "V", evidence_refs: ["docs/x.md"] },
    { id: "d", claim_state: "D", derived_from: ["v"] },
  ],
});
// non-admissible (a naked V) assumption state → REFUSED posture
const NAKED = buildAssumptionStatePreview({
  claims: [{ id: "bad", claim_state: "V" }],
});
// convergence with a CONVERGED claim
const CONVERGED = buildProofConvergencePreview({
  claims: [
    {
      id: "c",
      statement: "",
      rails: { formal: "spec_plus_test", empirical: "passing_tests" },
    },
  ],
});
// convergence with only DECLARED claims (nothing converged)
const WEAK = buildProofConvergencePreview({
  claims: [
    { id: "w", statement: "", rails: { formal: "none", empirical: "none" } },
  ],
});

test("admissible assumptions + converged evidence → ADVANCE", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "publish the digest" },
    assumption_state: ADMISSIBLE,
    convergence: CONVERGED,
  });
  assert.equal(out.schema, SEED_LOOP_PREVIEW_SCHEMA);
  assert.equal(out.posture, "ADVANCE");
  assert.equal(out.assumption.admissible, true);
  assert.equal(out.convergence.converged, 1);
  assert.match(out.next_safe_step, /consent/i);
});

test("a naked assumption REFUSES the loop (fail-closed, regardless of evidence)", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: NAKED,
    convergence: CONVERGED,
  });
  assert.equal(out.posture, "REFUSED");
  assert.equal(out.assumption.admissible, false);
});

test("admissible assumptions but no converged evidence → HOLD (stay, gather)", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: ADMISSIBLE,
    convergence: WEAK,
  });
  assert.equal(out.posture, "HOLD");
  assert.equal(out.convergence.converged, 0);
  assert.match(out.next_safe_step, /evidence/i);
});

test("the six canonical loop stages are present, in order", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: ADMISSIBLE,
    convergence: CONVERGED,
  });
  assert.deepEqual(out.stages, [...SEED_LOOP_STAGES]);
  assert.deepEqual(SEED_LOOP_STAGES, [
    "seed",
    "assumption",
    "meaning",
    "consent",
    "receipt",
    "growth",
  ]);
});

test("missing assumption_state → REFUSED, not a crash (fail-closed)", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "x" },
    convergence: CONVERGED,
  });
  assert.equal(out.posture, "REFUSED");
});

test("boundary is the canonical 16-key all-false frozen attestation", () => {
  const out = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: ADMISSIBLE,
    convergence: CONVERGED,
  });
  assert.ok(Object.isFrozen(out.boundary));
  assert.deepEqual(
    Object.keys(out.boundary).sort(),
    [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort(),
  );
  for (const [k, v] of Object.entries(out.boundary))
    assert.equal(v, false, `boundary.${k} false`);
});

test("pure + deterministic + deeply frozen", () => {
  const a = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: ADMISSIBLE,
    convergence: CONVERGED,
  });
  const b = buildSeedLoopPreview({
    seed: { intent: "x" },
    assumption_state: ADMISSIBLE,
    convergence: CONVERGED,
  });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.stages));
});
