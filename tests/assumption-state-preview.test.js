import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssumptionStatePreview,
  ASSUMPTION_STATE_PREVIEW_SCHEMA,
} from "../packages/core/src/assumption-state-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const V = { id: "v1", claim_state: "V", evidence_refs: ["docs/x.md"] };
const D = { id: "d1", claim_state: "D", derived_from: ["v1"] };
const A = {
  id: "a1",
  claim_state: "A",
  assumption: "the host is offline",
  ground: "no network probe ran",
  boundary: "holds only this session",
  rejectable: true,
};
const U = { id: "u1", claim_state: "U" };
const NAKED_V = { id: "bad", claim_state: "V" }; // no evidence_refs → unsupported_certainty

test("all V/D claims → GROUNDED, admissible, zero uncertainty surface", () => {
  const out = buildAssumptionStatePreview({ claims: [V, D] });
  assert.equal(out.schema, ASSUMPTION_STATE_PREVIEW_SCHEMA);
  assert.equal(out.summary.admissible, true);
  assert.equal(out.summary.posture, "GROUNDED");
  assert.equal(out.summary.uncertainty_surface, 0);
  assert.equal(out.summary.by_state.V, 1);
  assert.equal(out.summary.by_state.D, 1);
});

test("a well-formed A claim → valid, BOUNDED_UNCERTAINTY (declared, not refused)", () => {
  const out = buildAssumptionStatePreview({ claims: [V, A, U] });
  assert.equal(out.summary.admissible, true);
  assert.equal(out.summary.posture, "BOUNDED_UNCERTAINTY");
  assert.equal(out.summary.uncertainty_surface, 2); // A + U
  assert.equal(out.summary.by_state.A, 1);
  assert.equal(out.summary.by_state.U, 1);
});

test("no-overclaim / fail-closed: a naked claim makes the set REFUSED, not admissible", () => {
  const out = buildAssumptionStatePreview({ claims: [V, NAKED_V] });
  assert.equal(out.summary.admissible, false);
  assert.equal(out.summary.posture, "REFUSED");
  assert.equal(out.summary.invalid, 1);
  const bad = out.claims.find((c) => c.id === "bad");
  assert.equal(bad.valid, false);
  assert.equal(bad.error, "unsupported_certainty");
  assert.equal(
    bad.claim_state,
    null,
    "an invalid claim is not credited a state",
  );
});

test("an A claim missing its ground/rejectable is refused (naked assumption)", () => {
  const out = buildAssumptionStatePreview({
    claims: [{ id: "nakedA", claim_state: "A", assumption: "x" }],
  });
  assert.equal(out.summary.admissible, false);
  assert.equal(out.claims[0].valid, false);
});

test("boundary is the canonical 16-key all-false frozen attestation", () => {
  const out = buildAssumptionStatePreview({ claims: [V] });
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
  const a = buildAssumptionStatePreview({ claims: [V, A] });
  const b = buildAssumptionStatePreview({ claims: [V, A] });
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.claims));
});

test("empty set → admissible (nothing to refuse), GROUNDED, total 0", () => {
  const out = buildAssumptionStatePreview({ claims: [] });
  assert.equal(out.summary.total, 0);
  assert.equal(out.summary.admissible, true);
  assert.equal(out.summary.posture, "GROUNDED");
});
