// CONVERGENCE-ATTEST-1A · sign + ground the Proof-of-Truth convergence verdict.
//
// FLYWHEEL-REPLAY-1B (verifyConvergentTaskChain) proves a bound canonical task
// chain converges across Formal | Cryptographic | Empirical | Economic — but
// that verdict is ephemeral. This kernel turns it into a portable, signed,
// content-addressed attestation, and — crucially — a Level-B GROUNDED one: its
// verifier re-runs the convergence check against the LIVE chain and rejects if
// the attested verdict no longer re-derives.
//
// The masterpiece property: tamper the chain AFTER attesting and the signature
// (Level-A) still verifies, but Level-B grounding fails. Signed ≠ true;
// grounded = true. This is the artifact Block0 §18 needs to seal "one full
// flywheel run" — and it caps the proof spine: verify -> ATTEST -> seal.
//
// Pure-with-key-load: loads the operator key to sign (mirrors SAT-VALIDATE-1A's
// sign-the-verdict precedent — no consent phrase, no value mutation, no disk
// write; the caller persists if it wishes). Authority for verification is
// ONLY the external pubkey (embedded fingerprint never trusted — REJECT-4).

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadPrivateKey,
  loadPublicKey,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { loadCanonicalLedger } from "../../receipts/src/canonical-ledger.js";
import { verifyConvergentTaskChain } from "./flywheel-task-convergence.js";

export const CONVERGENCE_ATTESTATION_SCHEMA =
  "bizra.dema.convergence_attestation.v0.1";
export const CONVERGENCE_VERIFIER_RULE_ID = "flywheel_task_convergence.v0.1";

function fail(error, extra = {}) {
  return Object.freeze({
    schema: CONVERGENCE_ATTESTATION_SCHEMA,
    attested: false,
    truth_label: "LOCAL_CONVERGENCE_ATTESTATION_REFUSED",
    error,
    ...extra,
  });
}

function reject(stage, reason, extra = {}) {
  return Object.freeze({ verified: false, stage, reason, ...extra });
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  return sha256(pk.export({ type: "spki", format: "der" }).toString("hex"));
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

async function chainHead(demaHome) {
  const entries = await loadCanonicalLedger({ demaHome });
  return entries.length ? entries[entries.length - 1].receipt_id : null;
}

// Build the canonical attestation body — basis for both the signature and the
// content address. Excludes ONLY the two derived fields.
function buildAttestationBody({
  convergence_schema,
  canonical_chain_root,
  chain_length,
  task_count,
  task_fingerprint,
  layers,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: CONVERGENCE_ATTESTATION_SCHEMA,
    verifier_rule_id: CONVERGENCE_VERIFIER_RULE_ID,
    convergence_schema,
    canonical_chain_root,
    chain_length,
    task_count,
    task_fingerprint,
    layers,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

/**
 * Attest that the persisted canonical task chain converges. Pure-with-key-load.
 * Fail-closed: a non-convergent chain cannot be attested.
 */
export async function attestConvergence({
  demaHome,
  operatorPubkeyPem,
  now,
} = {}) {
  if (!isNonEmptyString(now) || Number.isNaN(Date.parse(now))) {
    return fail("created_at_iso_required");
  }

  const convergence = await verifyConvergentTaskChain({
    demaHome,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!convergence.convergent) {
    return fail("not_convergent", { convergence });
  }

  const privateKeyPem = await loadPrivateKey(demaHome);
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!privateKeyPem || !publicKeyPem) {
    return fail("no_authorship_key");
  }
  const fingerprint = fingerprintFromPem(publicKeyPem);
  // The attestation is signed with the local key; the convergence it certifies
  // was verified under operatorPubkeyPem. If they differ, the attestation would
  // be unverifiable under the claimed operator authority — fail closed.
  if (fingerprint !== fingerprintFromPem(operatorPubkeyPem)) {
    return fail("operator_key_mismatch");
  }

  const body = buildAttestationBody({
    convergence_schema: convergence.schema,
    canonical_chain_root: await chainHead(demaHome),
    chain_length: convergence.chain_length,
    task_count: convergence.task_count,
    // Commit to the exact set of verified tasks so the attestation cannot be
    // replayed against a different chain that merely also converges.
    task_fingerprint: sha256(stableStringify(convergence.tasks)),
    layers: convergence.layers,
    created_at_iso: now,
    operator_public_key_fingerprint: fingerprint,
  });
  const attestation_id = sha256(stableStringify(body));
  const attestation_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: CONVERGENCE_ATTESTATION_SCHEMA,
    attested: true,
    truth_label: "LOCAL_CONVERGENCE_ATTESTATION_LEVEL_B_GROUNDED",
    attestation: Object.freeze({
      ...body,
      attestation_id,
      attestation_signature_b64,
    }),
  });
}

/**
 * Verify a convergence attestation. Level-A: signature + content address under
 * the EXTERNAL pubkey. Level-B: re-run the convergence check against the live
 * chain and confirm the attested verdict still re-derives. Async (reads ledger).
 */
export async function verifyConvergenceAttestation({
  attestation,
  demaHome,
  pubkeyPem,
} = {}) {
  // ── Structural ────────────────────────────────────────────────────
  if (
    !attestation ||
    typeof attestation !== "object" ||
    Array.isArray(attestation)
  ) {
    return reject("structural", "attestation_missing_or_malformed");
  }
  if (attestation.schema !== CONVERGENCE_ATTESTATION_SCHEMA) {
    return reject("structural", "attestation_schema_mismatch");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("structural", "external_pubkey_required");
  }
  for (const f of [
    "verifier_rule_id",
    "convergence_schema",
    "canonical_chain_root",
    "chain_length",
    "task_count",
    "task_fingerprint",
    "layers",
    "created_at_iso",
    "operator_public_key_fingerprint",
    "attestation_id",
    "attestation_signature_b64",
  ]) {
    if (attestation[f] === undefined || attestation[f] === null) {
      return reject("structural", `structural_missing_field_${f}`);
    }
  }
  if (!isSha256Hex(attestation.attestation_id)) {
    return reject("structural", "attestation_id_invalid");
  }

  // ── Level-A: content address + signature ──────────────────────────
  const { attestation_id, attestation_signature_b64, ...body } = attestation;
  if (sha256(stableStringify(body)) !== attestation_id) {
    return reject("signature", "attestation_id_mismatch");
  }
  if (!verifyPayload(body, attestation_signature_b64, pubkeyPem)) {
    return reject("signature", "signature_invalid");
  }

  // ── Level-B: the attested verdict must still re-derive on the live chain ──
  const live = await verifyConvergentTaskChain({ demaHome, pubkeyPem });
  if (!live.convergent) {
    return reject("grounding", "live_chain_not_convergent", {
      level_a_signature_valid: true,
      live,
    });
  }
  if (live.chain_length !== attestation.chain_length) {
    return reject("grounding", "chain_length_mismatch", {
      level_a_signature_valid: true,
    });
  }
  const liveRoot = await chainHead(demaHome);
  if (liveRoot !== attestation.canonical_chain_root) {
    return reject("grounding", "chain_root_mismatch", {
      level_a_signature_valid: true,
    });
  }
  if (sha256(stableStringify(live.tasks)) !== attestation.task_fingerprint) {
    return reject("grounding", "task_fingerprint_mismatch", {
      level_a_signature_valid: true,
    });
  }

  return Object.freeze({
    verified: true,
    level: "B",
    level_a_signature_valid: true,
    attestation_id,
    task_count: attestation.task_count,
  });
}
