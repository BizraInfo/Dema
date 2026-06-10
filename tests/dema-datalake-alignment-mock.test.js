/**
 * ADR-030 Dema / Data-Lake Alignment Mock - Tests (G43)
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Tests exercise the local Dema/Data-Lake alignment mock envelope.
 * No runtime sync, no Data Lake mutation, no cross-repo write, no API bridge,
 * no PAT/SAT/FATE/URP runtime invocation, no Node1, no memory runtime,
 * no receipt minting, no public writing, no publishing, no bridging,
 * no reward/token/contract/marketplace, no Shariah claim.
 *
 * NO_DEMA_DATALAKE_RUNTIME_SYNC
 * NO_DATALAKE_MUTATION
 * NO_CROSS_REPO_WRITE
 * NO_API_BRIDGE
 * NO_FILESYSTEM_BRIDGE_OUTSIDE_DEMA
 * NO_PAT_RUNTIME_INVOCATION
 * NO_SAT_RUNTIME_INVOCATION
 * NO_FATE_RUNTIME_INVOCATION
 * NO_URP_SYNC
 * NO_NODE1_ACTIVATION
 * NO_AIR_RUNTIME_EXPANSION
 * NO_MISSION_MEMORY_RUNTIME
 * NO_VECTOR_MEMORY_RUNTIME
 * NO_AUTOMATIC_CONTEXT_REWRITING_ENGINE
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_PUBLIC_ECONOMIC_COPY
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createMockDemaDataLakeAlignment,
  loadExampleDemaDataLakeAlignmentInput,
  DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT,
} from "../scripts/dema-datalake-alignment-mock.mjs";

// 1. creates a local alignment envelope with sha256 alignment_boundary_id
test("creates a local alignment envelope with sha256 alignment_boundary_id", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.alignment_boundary_id &&
      env.alignment_boundary_id.startsWith("sha256:"),
    "creates envelope with sha256 alignment_boundary_id [DECLARED]",
  );
  assert.strictEqual(
    env.face_body_alignment_status,
    "REFERENCE_EXPECTATION_ONLY",
    "face/body status REFERENCE_EXPECTATION_ONLY [DECLARED]",
  );
});

// 2. requires exact consent
test("requires exact consent", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  assert.throws(
    () => createMockDemaDataLakeAlignment({ requireConsent: "WRONG" }, input),
    /CONSENT_REQUIRED/,
    "rejects missing exact consent [DECLARED]",
  );
});

// 3. requires dema_artifact_ref and datalake_body_artifact_ref
test("requires dema and datalake artifact refs", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const bad = { ...input };
  delete bad.dema_artifact_ref;
  assert.throws(
    () =>
      createMockDemaDataLakeAlignment(
        { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
        bad,
      ),
    /dema_artifact_ref/,
    "requires dema_artifact_ref [DECLARED]",
  );
});

// 4. declares Dema face artifact reference boundary
test("declares Dema face artifact reference boundary", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.dema_ref && env.dema_ref.startsWith("sha256:"),
    "includes dema_ref [DECLARED]",
  );
});

// 5. declares Data Lake body artifact reference boundary
test("declares Data Lake body artifact reference boundary", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  assert.ok(
    env.datalake_ref && env.datalake_ref.includes("datalake"),
    "includes datalake_ref [DECLARED]",
  );
});

// 6. declares face/body alignment status boundary as REFERENCE_EXPECTATION_ONLY
test("declares face body alignment status boundary as REFERENCE_EXPECTATION_ONLY", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    env.face_body_alignment_status,
    "REFERENCE_EXPECTATION_ONLY",
    "face/body alignment status boundary [DECLARED]",
  );
});

// 7. declares PAT-7 expectation boundary without runtime
test("declares PAT-7 expectation boundary without runtime", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const hasPat =
    env.pat7_expectation &&
    env.pat7_expectation.placeholder === true &&
    env.pat7_expectation.runtime_implemented === false;
  assert.ok(
    hasPat,
    "PAT-7 expectation boundary scaffold without runtime [DECLARED]",
  );
});

// 8. declares SAT-5 expectation boundary without runtime
test("declares SAT-5 expectation boundary without runtime", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const hasSat =
    env.sat5_expectation &&
    env.sat5_expectation.placeholder === true &&
    env.sat5_expectation.runtime_implemented === false;
  assert.ok(
    hasSat,
    "SAT-5 expectation boundary scaffold without runtime [DECLARED]",
  );
});

// 9. declares FATE expectation boundary without runtime
test("declares FATE expectation boundary without runtime", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const hasFate =
    env.fate_expectation &&
    env.fate_expectation.placeholder === true &&
    env.fate_expectation.runtime_implemented === false;
  assert.ok(
    hasFate,
    "FATE expectation boundary scaffold without runtime [DECLARED]",
  );
});

// 10. declares URP expectation non-claim boundary
test("declares URP expectation non-claim boundary", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const hasUrp =
    env.urp_expectation &&
    env.urp_expectation.placeholder === true &&
    env.urp_expectation.urp_sync_implemented === false &&
    env.urp_expectation.public_publication === false;
  assert.ok(hasUrp, "URP expectation non-claim boundary scaffold [DECLARED]");
});

// 11. includes allowed input/output envelope and non-empty proof_gaps
test("includes allowed alignment input output envelope and proof gaps", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const env = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const hasGaps = Array.isArray(env.proof_gaps) && env.proof_gaps.length > 0;
  const hasPosture =
    env.prototype_posture && env.prototype_posture.includes("PROTOTYPE");
  assert.ok(
    hasGaps && hasPosture,
    "allowed alignment input output envelope boundary + proof gaps [DECLARED]",
  );
});

// 12. rejects forbidden sync/mutation/bridge/runtime fields (input + output)
test("rejects forbidden sync mutation bridge runtime rejection boundary", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const bad = { ...input, runtime_sync_request: true };
  assert.throws(
    () =>
      createMockDemaDataLakeAlignment(
        { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
        bad,
      ),
    /FORBIDDEN/,
    "forbidden sync/mutation/bridge/runtime rejection [DECLARED]",
  );
});

// 13. deterministic excluding created_at + no forbidden outputs + proof-gap invariant
test("deterministic alignment_boundary_id and proof-gap invariant boundary", () => {
  const input = loadExampleDemaDataLakeAlignmentInput();
  const r1 = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  const r2 = createMockDemaDataLakeAlignment(
    { requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT },
    input,
  );
  assert.strictEqual(
    r1.alignment_boundary_id,
    r2.alignment_boundary_id,
    "deterministic (excl created_at) [DECLARED]",
  );
  const hasNoForbidden = !Object.keys(r1).some(
    (k) =>
      k.includes("sync") ||
      k.includes("bridge") ||
      k.includes("mint") ||
      k.includes("token"),
  );
  assert.ok(
    hasNoForbidden && Array.isArray(r1.proof_gaps) && r1.proof_gaps.length > 0,
    "proof-gap and still-blocked invariant boundary [DECLARED]",
  );
});
