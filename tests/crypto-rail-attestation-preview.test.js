// Red-first proof contract for NODE0-CRYPTO-RAIL-ATTEST-1A.
//
// Contract: a claim's cryptographic convergence rail may only rise from
// `schema_only` (level 1) to `local_signed` (level 4) when an actual Ed25519
// signature — bound to the claim's canonical body — verifies. Any tamper, any
// missing verifier, any leaked key material fails CLOSED to `schema_only`.
//
// The signature is produced by the real #307 primitives (signPayload /
// verifyPayload), so this test drives the kernel against genuine crypto, not a
// mock. That is the undeniable loop: sign -> verify -> rail raised.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateEd25519Keypair,
  signPayload,
  verifyPayload,
} from "../packages/receipts/src/authorship-signature.js";
import { buildProofConvergencePreview } from "../packages/core/src/proof-convergence-preview.js";
import {
  CRYPTO_RAIL_ATTESTATION_SCHEMA,
  buildClaimAttestationPayload,
  deriveCryptographicRail,
  attestClaimCryptographicRail,
  verifyCryptoRailAttestation,
} from "../packages/core/src/crypto-rail-attestation-preview.js";

// A representative preview claim: strong on formal + empirical, schema-only on
// crypto — exactly the shape the peak-self-loop backlog reports (gap 4).
function sampleClaim() {
  return {
    id: "delivery-spine-face",
    statement: "Bare dema renders human-first companion home",
    rails: {
      formal: "spec_plus_test",
      cryptographic: "schema_only",
      empirical: "passing_tests",
      economic: "not_applicable",
    },
  };
}

function signAttestation(claim, keys, overrides = {}) {
  const payload = buildClaimAttestationPayload(claim);
  return {
    schema: "bizra.dema.crypto_rail_attestation_receipt.v0.1",
    algorithm: "ed25519",
    signed_at: "2026-07-02T00:00:00.000Z",
    signature: {
      algorithm: "ed25519",
      value: signPayload(payload, keys.private_key_pem),
      public_key_pem: keys.public_key_pem,
      public_key_fingerprint: keys.public_key_fingerprint,
    },
    ...overrides,
  };
}

test("schema constant is stable and versioned", () => {
  assert.equal(
    CRYPTO_RAIL_ATTESTATION_SCHEMA,
    "bizra.dema.crypto_rail_attestation_preview.v0.1",
  );
});

test("valid body-bound signature derives local_signed", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  const out = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature: verifyPayload,
  });

  assert.equal(out.evidence, "local_signed");
  assert.equal(out.verified, true);
  assert.deepEqual(out.refusal_reasons, []);
  assert.equal(out.key_fingerprint, keys.public_key_fingerprint);
  // boundary must be all-false preview
  assert.equal(out.boundary.runtime_execution_performed, false);
  assert.equal(out.boundary.network_used, false);
});

test("attested claim lifts convergence floor 1 -> 4 (PARTIAL -> CONVERGED)", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();

  const before = buildProofConvergencePreview({ claims: [claim] });
  assert.equal(before.claims[0].rails.cryptographic.level, 1);
  assert.equal(before.claims[0].floor_level, 1);
  assert.equal(before.claims[0].convergence, "PARTIAL");

  const attested = attestClaimCryptographicRail(claim, signAttestation(claim, keys), {
    verifySignature: verifyPayload,
  });
  const after = buildProofConvergencePreview({ claims: [attested] });

  assert.equal(after.claims[0].rails.cryptographic.evidence, "local_signed");
  assert.equal(after.claims[0].rails.cryptographic.level, 4);
  assert.equal(after.claims[0].floor_level, 4);
  assert.equal(after.claims[0].convergence, "CONVERGED");
});

test("tampered claim body fails CLOSED to schema_only", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  // Attacker keeps the valid signature but rewrites the statement.
  const forged = { ...claim, statement: "Bare dema mints founder tokens" };

  const out = deriveCryptographicRail({
    claim: forged,
    attestation,
    verifySignature: verifyPayload,
  });

  assert.equal(out.evidence, "schema_only");
  assert.equal(out.verified, false);
  assert.ok(out.refusal_reasons.includes("signature_invalid"));

  // And the rail must NOT rise in the scorer.
  const attested = attestClaimCryptographicRail(forged, attestation, {
    verifySignature: verifyPayload,
  });
  const after = buildProofConvergencePreview({ claims: [attested] });
  assert.equal(after.claims[0].rails.cryptographic.level, 1);
  assert.equal(after.claims[0].convergence, "PARTIAL");
});

test("tampering any other rail also breaks the binding", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  const forged = {
    ...claim,
    rails: { ...claim.rails, empirical: "measured_remote_ci" },
  };
  const out = deriveCryptographicRail({
    claim: forged,
    attestation,
    verifySignature: verifyPayload,
  });
  assert.equal(out.evidence, "schema_only");
  assert.ok(out.refusal_reasons.includes("signature_invalid"));
});

test("wrong key fails CLOSED", () => {
  const keys = generateEd25519Keypair();
  const other = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);
  attestation.signature.public_key_pem = other.public_key_pem;

  const out = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature: verifyPayload,
  });
  assert.equal(out.evidence, "schema_only");
  assert.equal(out.verified, false);
});

test("missing verifier NEVER silently passes", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  const out = deriveCryptographicRail({ claim, attestation });
  assert.equal(out.evidence, "schema_only");
  assert.ok(out.refusal_reasons.includes("verifier_not_injected"));
});

test("no attestation is unproven, not rejected", () => {
  const out = deriveCryptographicRail({
    claim: sampleClaim(),
    verifySignature: verifyPayload,
  });
  assert.equal(out.evidence, "schema_only");
  assert.equal(out.verified, false);
  assert.ok(out.refusal_reasons.includes("no_attestation"));
});

test("leaked private key material is refused", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys, {
    private_key_pem: keys.private_key_pem,
  });

  const out = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature: verifyPayload,
  });
  assert.equal(out.evidence, "schema_only");
  assert.ok(out.refusal_reasons.includes("private_key_material_present"));
});

test("a thrown verifier is caught and fails CLOSED", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  const out = deriveCryptographicRail({
    claim,
    attestation,
    verifySignature: () => {
      throw new Error("boom");
    },
  });
  assert.equal(out.evidence, "schema_only");
  assert.ok(out.refusal_reasons.includes("verification_error"));
});

test("verifyCryptoRailAttestation re-derives and confirms local_signed", () => {
  const keys = generateEd25519Keypair();
  const claim = sampleClaim();
  const attestation = signAttestation(claim, keys);

  const ok = verifyCryptoRailAttestation({
    claim,
    attestation,
    expected_evidence: "local_signed",
    verifySignature: verifyPayload,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.derived_evidence, "local_signed");

  const bad = verifyCryptoRailAttestation({
    claim: { ...claim, statement: "x" },
    attestation,
    expected_evidence: "local_signed",
    verifySignature: verifyPayload,
  });
  assert.equal(bad.ok, false);
});

test("buildClaimAttestationPayload is deterministic and excludes the crypto rail", () => {
  const claim = sampleClaim();
  const a = buildClaimAttestationPayload(claim);
  const b = buildClaimAttestationPayload({
    ...claim,
    rails: { ...claim.rails, cryptographic: "grounded_rederivable" },
  });
  // Changing only the cryptographic token must not change the signed body,
  // otherwise the attestation would be circular.
  assert.deepEqual(a, b);
});

test("kernel source performs no fs / network / process effects", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL(
      "../packages/core/src/crypto-rail-attestation-preview.js",
      import.meta.url,
    ),
    "utf8",
  );
  for (const forbidden of [
    "node:fs",
    "node:net",
    "node:child_process",
    "node:http",
    "fetch(",
    "process.env",
  ]) {
    assert.ok(
      !src.includes(forbidden),
      `kernel must not reference ${forbidden}`,
    );
  }
});
