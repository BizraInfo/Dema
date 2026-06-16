import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProofConvergencePreview,
  PROOF_CONVERGENCE_PREVIEW_SCHEMA,
} from "../packages/core/src/proof-convergence-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// A claim where every rail carries strong, distinct evidence.
const STRONG_CLAIM = {
  id: "onboarding-protocol",
  statement: "First-time onboarding protocol is enforced.",
  rails: {
    formal: "spec_plus_test",
    cryptographic: "not_applicable",
    empirical: "passing_tests",
    economic: "not_applicable",
  },
};

test("derives each rail level from its evidence token, deterministically", () => {
  const out = buildProofConvergencePreview({ claims: [STRONG_CLAIM] });
  assert.equal(out.schema, PROOF_CONVERGENCE_PREVIEW_SCHEMA);
  const c = out.claims[0];
  assert.equal(c.rails.formal.level, 4);
  assert.equal(c.rails.formal.gap, 1);
  assert.equal(c.rails.empirical.level, 4);
  assert.equal(c.rails.cryptographic.level, null); // not_applicable
  assert.equal(c.rails.economic.level, null);
});

test("no claim above evidence: an unknown evidence token fails closed to level 0", () => {
  const out = buildProofConvergencePreview({
    claims: [
      {
        id: "x",
        statement: "y",
        rails: { formal: "OVERCLAIM_LEVEL_5", empirical: "none" },
      },
    ],
  });
  const c = out.claims[0];
  assert.equal(c.rails.formal.level, 0, "unrecognized evidence must map to 0");
  assert.equal(c.rails.empirical.level, 0);
});

test("floor_level = min of APPLICABLE rails; not_applicable excluded", () => {
  const out = buildProofConvergencePreview({ claims: [STRONG_CLAIM] });
  // applicable rails are formal(4) + empirical(4) → floor 4
  assert.equal(out.claims[0].floor_level, 4);
});

test("convergence label reflects the floor: CONVERGED / PARTIAL / DECLARED", () => {
  const out = buildProofConvergencePreview({
    claims: [
      {
        id: "a",
        statement: "",
        rails: { formal: "spec_plus_test", empirical: "passing_tests" },
      }, // floor 4
      {
        id: "b",
        statement: "",
        rails: { formal: "declared_spec", empirical: "structural_tests" },
      }, // floor 2
      { id: "c", statement: "", rails: { formal: "none", empirical: "none" } }, // floor 0
    ],
  });
  assert.equal(out.claims[0].convergence, "CONVERGED");
  assert.equal(out.claims[1].convergence, "PARTIAL");
  assert.equal(out.claims[2].convergence, "DECLARED");
});

test("summary counts the bands and names the weakest claim", () => {
  const out = buildProofConvergencePreview({
    claims: [
      {
        id: "a",
        statement: "",
        rails: { formal: "spec_plus_test", empirical: "passing_tests" },
      },
      {
        id: "weak",
        statement: "",
        rails: { formal: "none", empirical: "none" },
      },
    ],
  });
  assert.equal(out.summary.total, 2);
  assert.equal(out.summary.converged, 1);
  assert.equal(out.summary.declared, 1);
  assert.equal(out.summary.weakest_claim, "weak");
});

test("boundary is the canonical 16-key all-false frozen attestation", () => {
  const out = buildProofConvergencePreview({ claims: [STRONG_CLAIM] });
  assert.ok(Object.isFrozen(out.boundary));
  assert.deepEqual(
    Object.keys(out.boundary).sort(),
    [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort(),
  );
  for (const [k, v] of Object.entries(out.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("pure + deterministic + deeply frozen", () => {
  const a = buildProofConvergencePreview({ claims: [STRONG_CLAIM] });
  const b = buildProofConvergencePreview({ claims: [STRONG_CLAIM] });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.claims));
});

test("empty claim set yields an honest empty verdict, not a crash", () => {
  const out = buildProofConvergencePreview({ claims: [] });
  assert.equal(out.summary.total, 0);
  assert.equal(out.summary.weakest_claim, null);
});
