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
// Reuses (no new crypto): signPayload/verifyPayload, loadActiveKeyPair, sha256/stableStringify.
//
// SCOPE (1A): pure kernel — builder returns the receipt, verifier walks a chain.
// NO write into the live ~/.dema/receipts ledger (RECEIPT-CHAIN-1B). No
// token/PoI/economy/federation. Fail-closed on consent + structure.

import { createPublicKey } from "node:crypto";
import { signPayload, verifyPayload } from "./authorship-signature.js";
import { loadActiveKeyPair } from "./authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  classifySuccessionBody,
  validateSuccessionIntentBody,
  validateSuccessionCommitBody,
  successionBindingDrift,
} from "./authority-succession.js";

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
// True only if the value round-trips through JSON: rejects function / undefined
// / bigint / symbol / NaN / Infinity and circular references. A canonical body
// that is not JSON-safe cannot be content-addressed or replayed.
function isJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (t !== "object") return false; // function / undefined / bigint / symbol
  if (seen.has(value)) return false; // circular
  seen.add(value);
  const members = Array.isArray(value) ? value : Object.values(value);
  return members.every((m) => isJsonSafe(m, seen));
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
  // created_at_iso must be a real, parseable timestamp (it is committed to the
  // receipt_id + signature; a malformed string would mint a nonsensical receipt).
  if (!isNonEmptyString(now) || Number.isNaN(Date.parse(now))) {
    return fail("created_at_iso_required");
  }
  if (!isPlainObject(canonicalBody) || !isJsonSafe(canonicalBody)) {
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

  // PROOF-SPINE-GUARD-1A: block #101 (empty genesis receipt {}) and ensure
  // genesis (fresh-state root of trust) has non-empty body. Ed25519 path is
  // enforced by key load + signPayload below (#103).
  if (prevHash === null) {
    if (!canonicalBody || Object.keys(canonicalBody).length === 0) {
      return fail("genesis_receipt_body_must_not_be_empty");
    }
  }

  // PROOF-SPINE-GUARD-1A #102: refuse builds that would settle/mint on
  // QUARANTINED or bad pulse state (Dema face guard; substrate must match).
  if (
    canonicalBody &&
    (canonicalBody.pulse_state === "QUARANTINED" ||
      canonicalBody.quarantined === true ||
      canonicalBody.state === "QUARANTINED")
  ) {
    return fail("refuse_on_quarantined_pulse");
  }

  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) {
    return fail("no_authorship_key");
  }

  // Fail-closed even on crypto/serialization faults (corrupt key PEM, etc.):
  // never throw out of a builder documented as fail-closed.
  try {
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
  } catch {
    return fail("signing_failed");
  }
}

function reject(reason, at_index) {
  return at_index === undefined
    ? Object.freeze({ verified: false, reason })
    : Object.freeze({ verified: false, reason, at_index });
}

/**
 * Everything about entry `i` that does NOT depend on which key is trusted:
 * schema, signature presence, genesis body, prev_hash linkage, receipt_id and
 * body_hash re-derivation, truth label.
 *
 * Extracted so the single-key verifier and the authority-succession verifier
 * share one definition of structural validity. Two copies would drift, and the
 * drift would show up as one verifier accepting a chain the other refuses.
 *
 * Returns `{ ok: true, body, signature }` or a rejection.
 */
function checkEntryStructure(entries, i) {
  const entry = entries[i];
  if (!isPlainObject(entry) || entry.schema !== CANONICAL_RECEIPT_SCHEMA) {
    return reject("receipt_schema_mismatch", i);
  }
  if (
    !entry.receipt_signature_b64 ||
    typeof entry.receipt_signature_b64 !== "string" ||
    entry.receipt_signature_b64.trim().length === 0
  ) {
    return reject("empty_or_missing_signature", i);
  }
  if (
    i === 0 &&
    (!entry.canonical_body || Object.keys(entry.canonical_body || {}).length === 0)
  ) {
    return reject("genesis_receipt_body_empty", i);
  }
  if (i === 0) {
    if (entry.prev_hash !== null) return reject("genesis_prev_hash_not_null", 0);
  } else if (
    !isSha256Hex(entry.prev_hash) ||
    entry.prev_hash !== entries[i - 1].receipt_id
  ) {
    return reject("prev_hash_mismatch", i);
  }
  if (
    typeof entry.receipt_id !== "string" ||
    typeof entry.receipt_signature_b64 !== "string"
  ) {
    return reject("receipt_id_mismatch", i);
  }
  const { receipt_id, receipt_signature_b64, ...body } = entry;
  try {
    if (sha256(stableStringify(body)) !== receipt_id) {
      return reject("receipt_id_mismatch", i);
    }
    if (sha256(stableStringify(body.canonical_body)) !== body.body_hash) {
      return reject("body_hash_mismatch", i);
    }
    if (!VALID_TRUTH_LABELS.includes(body.truth_label)) {
      return reject("truth_label_invalid", i);
    }
  } catch {
    return reject("receipt_id_mismatch", i); // unserializable → reject
  }
  return { ok: true, body, signature: receipt_signature_b64 };
}

/// Signature check isolated so a hostile body can never throw out of a verifier.
function signatureHolds(body, signature, pubkeyPem) {
  try {
    return verifyPayload(body, signature, pubkeyPem) === true;
  } catch {
    return false;
  }
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
    // PROOF-SPINE-GUARD-1A: reject empty/missing sig (#107) and empty genesis body (#101)
    // even on historical bad data. Ed25519 sig verification remains mandatory (#103).
    const structural = checkEntryStructure(entries, i);
    if (!structural.ok) return structural;
    // signature — external pubkey ONLY (embedded fingerprint never trusted)
    if (!signatureHolds(structural.body, structural.signature, pubkeyPem)) {
      return reject("signature_invalid", i);
    }
  }

  return Object.freeze({
    verified: true,
    total_entries: entries.length,
    chain_root_hash: entries[entries.length - 1].receipt_id,
  });
}

/**
 * ISNAD-AUTHORITY-SUCCESSION-1A — verify a chain whose signing authority may
 * legitimately change, without ever letting the chain appoint its own signer.
 *
 * `verifyCanonicalChain` asks only "did key K sign this?". This asks BOTH that
 * and "was K the established authority here?", by walking forward from an
 * externally supplied genesis key and advancing the trusted key ONLY across a
 * valid two-half succession link.
 *
 * THE ANCHOR IS THE CALLER'S. Nothing here reads the active key, the active
 * pointer, the retirement registry, or a fingerprint an entry declares about
 * itself. The successor's full public key travels inside the intent body, so a
 * verifier holding the genesis key and the entries needs no filesystem at all.
 * A machine may report its current state; it may not certify its own ancestry.
 *
 * `pendingSuccessor` is returned rather than treated as failure: a chain that
 * ends on an authorized-but-uncommitted intent is a legible crash state, and
 * the appender uses it to allow exactly the successor to write the commit.
 *
 * @returns {{verified:true, total_entries, chain_root_hash,
 *            final_authority_pem, final_authority_fingerprint,
 *            successions:Array, pending_successor:object|null}
 *          | {verified:false, reason, at_index?}}
 */
export function verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem } = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return reject("entries_empty");
  }
  if (typeof genesisPubkeyPem !== "string" || !genesisPubkeyPem.includes("BEGIN PUBLIC KEY")) {
    return reject("external_pubkey_required");
  }

  let trustedPem = genesisPubkeyPem;
  let trustedFp = fingerprintFromPem(genesisPubkeyPem);
  let pending = null;
  const successions = [];

  for (let i = 0; i < entries.length; i += 1) {
    const structural = checkEntryStructure(entries, i);
    if (!structural.ok) return structural;
    const { body, signature } = structural;
    const kind = classifySuccessionBody(body.canonical_body);

    if (kind === "COMMIT") {
      const cb = body.canonical_body;
      const shape = validateSuccessionCommitBody(cb);
      if (!shape.ok) return reject(`succession_${shape.reason}`, i);
      if (!pending) return reject("succession_commit_without_intent", i);

      // Bindings first, signature second: a commit that does not match the
      // authorized intent must be refused as a MISMATCH, not reported as a bad
      // signature, or "wrong successor" and "forged successor" would collapse
      // into one indistinguishable reason.
      if (successionBindingDrift(pending.intentBody, cb).length > 0) {
        return reject("succession_binding_drift", i);
      }
      if (cb.intent_receipt_id !== pending.intentReceiptId) {
        return reject("succession_intent_receipt_mismatch", i);
      }
      // Possession proof: only the exact successor the predecessor authorized
      // can produce this signature.
      if (!signatureHolds(body, signature, pending.successorPem)) {
        return reject("succession_possession_proof_invalid", i);
      }

      trustedPem = pending.successorPem;
      trustedFp = pending.successorFingerprint;
      successions.push(Object.freeze({
        rotation_tx_id: cb.rotation_tx_id,
        predecessor_fingerprint: cb.predecessor_fingerprint,
        successor_fingerprint: cb.successor_fingerprint,
        intent_index: pending.index,
        commit_index: i,
      }));
      pending = null;
      continue;
    }

    // Every non-commit entry — ordinary receipts AND the intent itself — must
    // be signed by the authority currently in force. This is what stops an
    // unannounced key appending, and what stops a retired predecessor writing
    // ordinary entries after its succession completed.
    if (!signatureHolds(body, signature, trustedPem)) {
      return reject("signature_invalid", i);
    }

    if (kind === "INTENT") {
      const ib = body.canonical_body;
      const shape = validateSuccessionIntentBody(ib);
      if (!shape.ok) return reject(`succession_${shape.reason}`, i);
      if (pending) return reject("succession_intent_overlaps_open_intent", i);
      // The predecessor an intent names must BE the authority that signed it.
      if (ib.predecessor_fingerprint !== trustedFp) {
        return reject("succession_predecessor_not_trusted_authority", i);
      }
      // Re-derive the successor's identity from its own key material. A
      // declared fingerprint is a claim; the derived one is the fact.
      let derivedFp;
      let derivedHash;
      try {
        derivedFp = fingerprintFromPem(ib.successor_public_key_pem);
        derivedHash = sha256(ib.successor_public_key_pem);
      } catch {
        return reject("succession_successor_key_unreadable", i);
      }
      if (derivedFp !== ib.successor_fingerprint) {
        return reject("succession_successor_fingerprint_mismatch", i);
      }
      if (derivedHash !== ib.successor_public_key_sha256) {
        return reject("succession_successor_key_hash_mismatch", i);
      }
      pending = Object.freeze({
        index: i,
        intentBody: ib,
        intentReceiptId: entries[i].receipt_id,
        successorPem: ib.successor_public_key_pem,
        successorFingerprint: derivedFp,
      });
    }
  }

  return Object.freeze({
    verified: true,
    total_entries: entries.length,
    chain_root_hash: entries[entries.length - 1].receipt_id,
    final_authority_pem: trustedPem,
    final_authority_fingerprint: trustedFp,
    successions: Object.freeze(successions),
    pending_successor: pending
      ? Object.freeze({
          rotation_tx_id: pending.intentBody.rotation_tx_id,
          successor_fingerprint: pending.successorFingerprint,
          successor_public_key_pem: pending.successorPem,
          intent_receipt_id: pending.intentReceiptId,
          intent_index: pending.index,
        })
      : null,
  });
}
