import test from "node:test";
import assert from "node:assert/strict";
import {
  HERMETIC_CONTROL_PLANE_FIXTURE as fixture,
  buildNode0ProofOfTruthControlPlane,
  verifyNode0ProofOfTruthControlPlane,
  runNode0ProofOfTruthControlPlane,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";

for (const key of Object.keys(fixture.boundaries)) {
  test(`RVBI: producer and verifier agree on refused ${key}`, () => {
    const result = runNode0ProofOfTruthControlPlane({ ...fixture,
      boundaries: { ...fixture.boundaries, [key]: false } });
    assert.equal(result.ledger.release_verdict, "BLOCKED");
    assert.equal(result.ok, false, "An honest BLOCKED ledger is not runtime permission");
    assert.ok(result.verified.blocked_by.includes(`boundary_${key}`));
    assert.equal(result.verified.blocked_by.includes("status_summary_mismatch"), false);
    assert.equal(result.verified.blocked_by.includes("receipt_hash_mismatch"), false);
  });
}
test("RVBI: valid fixture still verifies at LOCAL_ONLY ceiling", () => {
  const result = runNode0ProofOfTruthControlPlane(fixture);
  assert.equal(result.ok, true);
  assert.equal(result.ledger.release_verdict, "READY_LOCAL");
  assert.equal(result.truth_label, "NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_LOCAL_ONLY");
});
test("RVBI: modifying a boundary after receipt construction fails verification", () => {
  const ledger = buildNode0ProofOfTruthControlPlane(fixture);
  const tampered = { ...ledger, boundary: { ...ledger.boundary, no_token_mint: false } };
  const verified = verifyNode0ProofOfTruthControlPlane(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("receipt_hash_mismatch"));
  assert.ok(verified.blocked_by.includes("boundary_no_token_mint"));
});
test("RVBI: repeated pure evaluation yields identical ledger bytes", () => {
  assert.equal(JSON.stringify(buildNode0ProofOfTruthControlPlane(fixture)),
    JSON.stringify(buildNode0ProofOfTruthControlPlane(fixture)));
});
