// ECON-1A · Pure Dual-Token Ledger Kernel.
//
// Local-only, replayable accounting kernel for the dual-token (RESOURCE,
// IMPACT) economy described in the ECON-0 preflight and the operator-PDF
// §9. This is a STRICTLY pure kernel:
//
//   - no CLI
//   - no file write (the durable writer is a separate slice, ECON-1B/2A)
//   - no integration with verdict / urp / authorship gates yet
//   - no network, no federation
//   - no public economic claim, no exchange value, no public mint
//
// Mint is gated by a KEYCONSENT-1A consent proof whose action_scope.action_type
// MUST equal "MINT_LEDGER_ENTRY". Verification is permissionless — the verifier
// supplies an external Ed25519 pubkey and the kernel ignores the entry's
// embedded fingerprint for trust (mirrors KEYCONSENT-1A and verdict-receipt
// REJECT-4).
//
// Reuses (no duplication):
//   - signPayload, verifyPayload              packages/receipts/src/authorship-signature.js
//   - loadActiveKeyPair           packages/receipts/src/authorship-key-store.js
//   - sha256, stableStringify                 packages/consent/src/consent-common.js
//   - CONSENT_PROOF_SCHEMA                    packages/receipts/src/consent-proof.js
//
// Spec reference: docs/security/ECON_0_PREFLIGHT.md (§3.2 envelope, §9 DOD).
//
// Envelope schema: bizra.dema.dual_token_ledger_entry.v0.1
//
// Token economy (ECON-0 + PDF §9):
//   - RESOURCE token:  compute / storage / tool / bandwidth / local
//                      infrastructure consumed.
//   - IMPACT token:    verified useful work / proof quality / mission
//                      completion / learning / knowledge contribution /
//                      bug prevention / optimization / agent improvement.
//
// This kernel deliberately keeps the envelope minimal in v0.1 — entry_type,
// token_class, amount, evidence hashes, chain link — to keep the
// invariant-set small. Component-level expansion (the full §3.2 components
// table) is gated to ECON-1B and beyond. v0.1 freezes the SHAPE of the
// kernel signature; richer decomposition extends rather than replaces it.

import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { CONSENT_PROOF_SCHEMA } from "../../receipts/src/consent-proof.js";
import { createPublicKey } from "node:crypto";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const DUAL_TOKEN_LEDGER_ENTRY_SCHEMA =
  "bizra.dema.dual_token_ledger_entry.v0.1";

export const REQUIRED_CONSENT_ACTION_TYPE = "MINT_LEDGER_ENTRY";

export const VALID_ENTRY_TYPES = Object.freeze([
  "RESOURCE_DEBIT",
  "RESOURCE_CREDIT",
  "IMPACT_CREDIT",
]);

export const VALID_TOKEN_CLASSES = Object.freeze(["RESOURCE", "IMPACT"]);

// Cross-table: which entry_type values are legal for which token_class.
// Locks the v0.1 economy: IMPACT_CREDIT only flows on the IMPACT token;
// RESOURCE_DEBIT/RESOURCE_CREDIT only flow on the RESOURCE token.
const ENTRY_TYPE_TO_TOKEN_CLASS = Object.freeze({
  RESOURCE_DEBIT: "RESOURCE",
  RESOURCE_CREDIT: "RESOURCE",
  IMPACT_CREDIT: "IMPACT",
});

// econ-domain boundary block (per per-module-domain-boundary-pattern).
// Coexists with the canonical 16-key shape; these keys capture the
// ECON-1A-specific risks: token minted true on success, but no public
// economic claim, no exchange value, no federation, no network, no file
// write at this slice. Mirrors the URP choose-writer pattern but with
// economy-specific vocabulary.
const ECON_BOUNDARY_OK = Object.freeze({
  local_only: true,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  token_minted: true,
  exchange_value_claimed: false,
});

const ECON_BOUNDARY_FAIL = Object.freeze({
  local_only: true,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  token_minted: false,
  exchange_value_claimed: false,
});

function fail(error, details = {}) {
  return Object.freeze({
    schema: DUAL_TOKEN_LEDGER_ENTRY_SCHEMA,
    error,
    ...details,
    boundary: ECON_BOUNDARY_FAIL,
  });
}

function reject(reason) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
  });
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function isValidPrevHash(s) {
  return s === null || isSha256Hex(s);
}

function isValidConsentProofShape(cp) {
  if (!cp || typeof cp !== "object" || Array.isArray(cp)) return false;
  if (cp.schema !== CONSENT_PROOF_SCHEMA) return false;
  if (
    !cp.action_scope ||
    typeof cp.action_scope !== "object" ||
    typeof cp.action_scope.action_type !== "string"
  ) {
    return false;
  }
  if (typeof cp.consent_proof_hash !== "string") return false;
  return true;
}

function isValidAmount(n) {
  return (
    typeof n === "number" && Number.isFinite(n) && Number.isInteger(n) && n >= 0
  );
}

function isValidEvidenceHashes(arr) {
  if (!Array.isArray(arr)) return false;
  for (const h of arr) {
    if (!isSha256Hex(h)) return false;
  }
  return true;
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

export async function buildLedgerEntry({
  entry_type,
  token_class,
  amount,
  evidence_receipt_hashes,
  prev_hash,
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // ── (1) Consent proof gate ────────────────────────────────────────
  // Must arrive first — without scoped consent, nothing else matters.
  if (!isValidConsentProofShape(consentProof)) {
    return fail("consent_proof_required");
  }
  if (consentProof.action_scope.action_type !== REQUIRED_CONSENT_ACTION_TYPE) {
    return fail("consent_scope_mismatch");
  }

  // ── (2) Entry / token-class structural validation ────────────────
  if (!VALID_ENTRY_TYPES.includes(entry_type)) {
    return fail("entry_type_invalid");
  }
  if (!VALID_TOKEN_CLASSES.includes(token_class)) {
    return fail("token_class_invalid");
  }
  if (ENTRY_TYPE_TO_TOKEN_CLASS[entry_type] !== token_class) {
    return fail("entry_type_token_class_mismatch");
  }

  // ── (3) Amount: integer ≥ 0 ──────────────────────────────────────
  // v0.1 stores the magnitude only; the entry_type carries the sign
  // semantics (DEBIT vs CREDIT). This keeps the on-disk encoding
  // unambiguous and prevents accidental sign drift across replays.
  if (!isValidAmount(amount)) {
    return fail("amount_invalid");
  }

  // ── (4) Evidence array: each entry must be sha256 hex ────────────
  if (!isValidEvidenceHashes(evidence_receipt_hashes)) {
    return fail("evidence_receipt_hashes_invalid");
  }

  // ── (5) Prev-hash: null for genesis, 64-hex for linked entries ───
  if (!isValidPrevHash(prev_hash)) {
    return fail("prev_hash_invalid");
  }

  // ── (6) Load operator's key ──────────────────────────────────────
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!publicKeyPem) {
    // Should not happen normally — the init writes both atomically — but
    // fail-closed defensively rather than crash on a half-wiped key dir.
    return fail("no_authorship_key");
  }

  const createdIso = createdAtIso || new Date().toISOString();
  const fingerprint = fingerprintFromPem(publicKeyPem);

  // Stable body — basis for both signature and entry_hash. Excludes ONLY
  // the two derived fields (entry_signature_b64, entry_hash) by
  // construction; the boundary attestation block IS part of the signed
  // body (mirrors URP-4.1A choose_hash discipline: any post-mint tamper
  // of the boundary block — e.g. flipping public_economic_claim_made to
  // true — breaks the hash AND the signature).
  const stableBody = Object.freeze({
    schema: DUAL_TOKEN_LEDGER_ENTRY_SCHEMA,
    entry_type,
    token_class,
    amount,
    evidence_receipt_hashes: Object.freeze([...evidence_receipt_hashes]),
    prev_hash,
    created_at_iso: createdIso,
    operator_public_key_fingerprint: fingerprint,
    boundary: ECON_BOUNDARY_OK,
  });

  const signature = signPayload(stableBody, privateKeyPem);
  const entryHash = sha256(stableStringify(stableBody));

  return Object.freeze({
    ...stableBody,
    entry_signature_b64: signature,
    entry_hash: entryHash,
  });
}

export function verifyLedgerEntry({ entry, pubkeyPem }) {
  // ── Structural validation ────────────────────────────────────────
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return reject("entry_missing_or_malformed");
  }
  if (entry.schema !== DUAL_TOKEN_LEDGER_ENTRY_SCHEMA) {
    return reject("entry_schema_mismatch");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  // Required structural fields
  const required = [
    "entry_type",
    "token_class",
    "amount",
    "evidence_receipt_hashes",
    "prev_hash",
    "created_at_iso",
    "operator_public_key_fingerprint",
    "entry_signature_b64",
    "entry_hash",
  ];
  for (const f of required) {
    if (entry[f] === undefined || (entry[f] === null && f !== "prev_hash")) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (!VALID_ENTRY_TYPES.includes(entry.entry_type)) {
    return reject("entry_type_invalid");
  }
  if (!VALID_TOKEN_CLASSES.includes(entry.token_class)) {
    return reject("token_class_invalid");
  }
  if (ENTRY_TYPE_TO_TOKEN_CLASS[entry.entry_type] !== entry.token_class) {
    return reject("entry_type_token_class_mismatch");
  }
  if (!isValidAmount(entry.amount)) {
    return reject("amount_invalid");
  }
  if (!isValidEvidenceHashes(entry.evidence_receipt_hashes)) {
    return reject("evidence_receipt_hashes_invalid");
  }
  if (!isValidPrevHash(entry.prev_hash)) {
    return reject("prev_hash_invalid");
  }

  // ── (1) Recompute entry_hash from stable body ────────────────────
  // Stable body = entry minus entry_signature_b64 minus entry_hash.
  // boundary IS part of the signed body (mirrors URP-4.1A choose_hash
  // discipline: post-mint tamper of any boundary flag breaks the hash).
  const { entry_signature_b64, entry_hash, ...stableBody } = entry;
  const recomputedHash = sha256(stableStringify(stableBody));
  if (recomputedHash !== entry_hash) {
    return reject("entry_hash_mismatch");
  }

  // ── (2) Verify Ed25519 signature using ONLY external pubkey ──────
  // Mirrors KEYCONSENT-1A trust invariant: the embedded
  // operator_public_key_fingerprint is informational only; trust comes
  // from the externally-supplied pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(stableBody, entry_signature_b64, pubkeyPem);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("entry_signature_invalid");
  }

  return Object.freeze({
    verified: true,
    entry_hash,
    entry_type: entry.entry_type,
    token_class: entry.token_class,
    amount: entry.amount,
    operator_public_key_fingerprint: entry.operator_public_key_fingerprint,
  });
}
