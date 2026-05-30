// RECEIPT-CHAIN-1A · canonical signed prev_hash receipt ledger kernel
//
// The trustless proof spine. buildCanonicalReceipt produces a signed,
// content-addressed receipt that chains to a prior one (prev_hash);
// verifyCanonicalChain walks the chain and confirms it with ZERO trust in the
// producer — the first real step toward "Node2 verifies Node1 without trusting
// Node1". Closes the disk-verified gap: ~/.dema/receipts is currently a flat
// bag of receipts with no prev_hash chain.
//
// Authority rule (same as verdict-receipt REJECT-4 / KEYCONSENT-1A): the
// signature is verified with ONLY the externally-supplied pubkey; the receipt's
// embedded operator_public_key_fingerprint is a CLAIM, never trusted.
//
// Reuses (no new crypto): signPayload/verifyPayload, loadPrivateKey/
// loadPublicKey, sha256/stableStringify.
//
// SCOPE (1A): pure kernel — builder returns the receipt, verifier walks a chain.
// NO write into the live ~/.dema/receipts ledger (RECEIPT-CHAIN-1B). No
// token/PoI/economy/federation. Fail-closed on consent + structure.

import { createPublicKey } from "node:crypto";
import { signPayload, verifyPayload } from "./authorship-signature.js";
import { loadPrivateKey, loadPublicKey } from "./authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const CANONICAL_RECEIPT_SCHEMA = "bizra.dema.canonical_receipt.v0.1";
export const CANONICAL_RECEIPT_CONSENT_PHRASE = "APPEND CANONICAL RECEIPT";

// Truth ladder (master checklist §1 + §7). A receipt MUST self-label.
export const VALID_TRUTH_LABELS = Object.freeze([
  "DESIGNED_NOT_LIVE",
  "SIMULATED_NOT_LIVE",
  "PARTIAL",
  "MEASURED_LOCAL",
  "REMOTE_CI_VERIFIED",
  "BLOCKED",
  "UNKNOWN",
  "ASSUMED_WITH_IHSAN",
  "LEVEL_A_SIGNED",
  "LEVEL_B_GROUNDED",
  "CANONICAL",
]);

const SHA256_HEX = /^[a-f0-9]{64}$/;

function isSha256Hex(s) {
  return typeof s === "string" && SHA256_HEX.test(s);
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function fail(error) {
  return Object.freeze({ built: false, error });
}
function fingerprintFromPem(pubkeyPem) {
  const der = createPublicKey(pubkeyPem).export({
    type: "spki",
    format: "der",
  });
  return sha256(der.toString("hex"));
}

/**
 * Build one canonical receipt, chained to prevHash (null for genesis), signed
 * with the operator's on-disk key. Pure-with-key-load: returns the receipt;
 * does NOT write to disk (that is 1B). Fail-closed on consent + structure.
 *
 * @returns {{built:true, receipt, signer_public_key_pem} | {built:false, error}}
 */
export async function buildCanonicalReceipt({
  canonicalBody,
  prevHash = null,
  truthLabel,
  whatProves,
  whatDoesNotProve,
  consent,
  demaHome,
  now,
} = {}) {
  if (consent !== CANONICAL_RECEIPT_CONSENT_PHRASE) {
    return fail("consent_required");
  }
  if (!isNonEmptyString(now)) {
    return fail("created_at_iso_required");
  }
  if (!isPlainObject(canonicalBody)) {
    return fail("canonical_body_invalid");
  }
  if (!VALID_TRUTH_LABELS.includes(truthLabel)) {
    return fail("truth_label_invalid");
  }
  if (!isNonEmptyString(whatProves)) {
    return fail("what_this_proves_required");
  }
  if (!isNonEmptyString(whatDoesNotProve)) {
    return fail("what_this_does_not_prove_required");
  }
  if (prevHash !== null && !isSha256Hex(prevHash)) {
    return fail("prev_hash_invalid");
  }

  const privateKeyPem = await loadPrivateKey(demaHome);
  const publicKeyPem = await loadPublicKey(demaHome);
  if (!privateKeyPem || !publicKeyPem) {
    return fail("no_authorship_key");
  }

  // body is exactly what the signature + receipt_id commit to.
  const body = {
    schema: CANONICAL_RECEIPT_SCHEMA,
    prev_hash: prevHash,
    body_hash: sha256(stableStringify(canonicalBody)),
    canonical_body: canonicalBody,
    truth_label: truthLabel,
    what_this_proves: whatProves,
    what_this_does_not_prove: whatDoesNotProve,
    operator_public_key_fingerprint: fingerprintFromPem(publicKeyPem),
    created_at_iso: now,
  };
  const receipt_id = sha256(stableStringify(body));
  const receipt_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    built: true,
    receipt: Object.freeze({ ...body, receipt_id, receipt_signature_b64 }),
    signer_public_key_pem: publicKeyPem,
  });
}

function reject(reason, at_index) {
  return at_index === undefined
    ? Object.freeze({ verified: false, reason })
    : Object.freeze({ verified: false, reason, at_index });
}

/**
 * Walk a canonical receipt chain and confirm it with zero trust in the
 * producer. Pure (no I/O). Refuses on the first failure with a structured
 * reason + index. Signature authority is ONLY the external pubkeyPem.
 *
 * @returns {{verified:true, total_entries, chain_root_hash}
 *          | {verified:false, reason, at_index?}}
 */
export function verifyCanonicalChain({ entries, pubkeyPem } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return reject("entries_empty");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!isPlainObject(entry) || entry.schema !== CANONICAL_RECEIPT_SCHEMA) {
      return reject("receipt_schema_mismatch", i);
    }

    // prev_hash chain
    if (i === 0) {
      if (entry.prev_hash !== null) {
        return reject("genesis_prev_hash_not_null", 0);
      }
    } else if (
      !isSha256Hex(entry.prev_hash) ||
      entry.prev_hash !== entries[i - 1].receipt_id
    ) {
      return reject("prev_hash_mismatch", i);
    }

    // receipt_id re-derivation (catches any non-canonical body drift)
    if (
      typeof entry.receipt_id !== "string" ||
      typeof entry.receipt_signature_b64 !== "string"
    ) {
      return reject("receipt_id_mismatch", i);
    }
    const { receipt_id, receipt_signature_b64, ...body } = entry;
    if (sha256(stableStringify(body)) !== receipt_id) {
      return reject("receipt_id_mismatch", i);
    }

    // body_hash binds the content independently of the chain metadata
    if (sha256(stableStringify(body.canonical_body)) !== body.body_hash) {
      return reject("body_hash_mismatch", i);
    }

    // signature — external pubkey ONLY (embedded fingerprint never trusted)
    let sigValid;
    try {
      sigValid = verifyPayload(body, receipt_signature_b64, pubkeyPem);
    } catch {
      sigValid = false;
    }
    if (!sigValid) {
      return reject("signature_invalid", i);
    }
  }

  return Object.freeze({
    verified: true,
    total_entries: entries.length,
    chain_root_hash: entries[entries.length - 1].receipt_id,
  });
}
