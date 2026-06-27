import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0ProofArtifactManifest,
  buildNode0ReleaseVerdictArtifact,
  evaluateProofArtifactWrite,
  verifyNode0ProofArtifactManifest,
  redactNode0ProofArtifactManifest,
  formatNode0ProofArtifactReplay,
  PROOF_ARTIFACT_WRITE_CONSENT,
  PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT,
  NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
  NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
  NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL,
} from "../packages/core/src/node0-proof-artifact-bundle.js";
import {
  buildNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";
import {
  buildNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
} from "../packages/core/src/node0-ci-evidence-attestation.js";
import { gatherNode0ProofArtifactBundle } from "../scripts/proof/export-node0-proof-artifact-bundle.mjs";

function buildFixtureBundle() {
  const commit = HERMETIC_CONTROL_PLANE_FIXTURE.commit;
  const ledger = buildNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
  const attestation = buildNode0CiEvidenceAttestation({
    commit,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  const release_verdict_artifact = buildNode0ReleaseVerdictArtifact({ ledger });
  const manifest = buildNode0ProofArtifactManifest({
    commit,
    ledger,
    release_verdict_artifact,
    ci_evidence_attestation: attestation,
    attestation_merged: true,
  });
  return { ledger, attestation, release_verdict_artifact, manifest };
}

test("PAE-01: manifest schema and receipt hash verify", () => {
  const { manifest } = buildFixtureBundle();
  assert.equal(manifest.schema, NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA);
  assert.equal(manifest.truth_label, NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL);
  assert.match(manifest.manifest_receipt_hash, /^sha256:[a-f0-9]{64}$/);
  const verified = verifyNode0ProofArtifactManifest(manifest);
  assert.equal(verified.ok, true);
});

test("PAE-02: write boundary requires exact micro-consent", () => {
  const deny = evaluateProofArtifactWrite({ consent_phrase: "GO: nope" });
  assert.equal(deny.allowed, false);
  const allow = evaluateProofArtifactWrite({
    consent_phrase: PROOF_ARTIFACT_WRITE_CONSENT,
  });
  assert.equal(allow.allowed, true);
  const publicAllow = evaluateProofArtifactWrite({
    consent_phrase: PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT,
    required_phrase: PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT,
  });
  assert.equal(publicAllow.allowed, true);
});

test("PAE-03: redact produces share-safe truth label and re-verifies", () => {
  const { manifest } = buildFixtureBundle();
  const redacted = redactNode0ProofArtifactManifest(manifest);
  assert.equal(redacted.redacted, true);
  assert.equal(redacted.public_safe, true);
  assert.equal(redacted.truth_label, NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL);
  assert.equal(verifyNode0ProofArtifactManifest(redacted).ok, true);
});

test("PAE-04: replay text lists proof chain commands", () => {
  const { manifest } = buildFixtureBundle();
  const text = formatNode0ProofArtifactReplay(manifest);
  assert.match(text, /proof:truth/);
  assert.match(text, /proof:verdict/);
  assert.match(text, /proof:attest:ci:aggregate/);
  assert.match(text, /READY_LOCAL/);
});

test("PAE-05: hermetic gather export bundle is READY_LOCAL", () => {
  const bundle = gatherNode0ProofArtifactBundle({ hermetic: true });
  assert.equal(bundle.ok, true);
  assert.equal(bundle.manifest.release_verdict, "READY_LOCAL");
  assert.equal(bundle.attestation_merged, true);
});

test("PAE-06: review gate script passes hermetic check", async () => {
  const { runNode0ProofArtifactExportCheck } = await import(
    "../scripts/review/node0-proof-artifact-export-check.mjs"
  );
  const result = runNode0ProofArtifactExportCheck();
  assert.equal(result.ok, true);
});

test("PAE-07: tampered manifest receipt fails verify", () => {
  const { manifest } = buildFixtureBundle();
  const tampered = { ...manifest, manifest_receipt_hash: "sha256:deadbeef" };
  const verified = verifyNode0ProofArtifactManifest(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("manifest_receipt_hash_mismatch"));
});
