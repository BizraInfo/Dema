// KEYCONSENT-1C · CLI wrapper for `dema consent verify`.
//
// Reads a consent proof file + an EXTERNAL public key file (operator brings
// their own copy of the signer's pubkey — embedded operator_public_key_
// fingerprint is NOT trusted as authority, same invariant as
// verdict-receipt REJECT-4 and verdict-attest KEYCONSENT-1B BAR-4).
//
// Permissionless: no consent required (verification is by design open).
// No token / PoI / economy field anywhere.

import { readFile } from "node:fs/promises";
import { verifyConsentProof } from "./consent-proof.js";

function rejectShape(reason, extra = {}) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
    ...extra,
  });
}

export async function runConsentVerifyCli({
  proofPath,
  pubkeyPath,
  expectedActionType,
  expectedTargetHash,
  now,
}) {
  if (!proofPath) {
    return rejectShape("missing_proof_path", { required: "<proof.json>" });
  }
  if (!pubkeyPath) {
    return rejectShape("missing_pubkey_path", {
      required: "--pubkey <external-pem-path>",
    });
  }

  let consentProof;
  try {
    const raw = await readFile(proofPath, "utf8");
    consentProof = JSON.parse(raw);
  } catch (e) {
    return rejectShape("proof_read_failed", {
      details: String(e?.message ?? e),
    });
  }

  let pubkeyPem;
  try {
    pubkeyPem = await readFile(pubkeyPath, "utf8");
  } catch (e) {
    return rejectShape("pubkey_read_failed", {
      details: String(e?.message ?? e),
    });
  }

  const expectedActionScope =
    expectedActionType || expectedTargetHash
      ? {
          action_type:
            expectedActionType || consentProof?.action_scope?.action_type,
          target_hash:
            expectedTargetHash || consentProof?.action_scope?.target_hash,
        }
      : undefined;

  return verifyConsentProof({
    consentProof,
    pubkeyPem,
    expectedActionScope,
    now,
  });
}
