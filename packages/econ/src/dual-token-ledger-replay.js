// ECON-1B · Pure Dual-Token Ledger Replay Verifier.
//
// Permissionless, pure verifier that walks an ordered array of
// `bizra.dema.dual_token_ledger_entry.v0.1` envelopes (built by ECON-1A's
// `buildLedgerEntry`) and confirms:
//
//   - entries[0].prev_hash === null (genesis convention for the chain root)
//   - entries[i].prev_hash === entries[i-1].entry_hash for every i >= 1
//   - each entry's signature verifies under the EXTERNAL pubkeyPem
//     (mirrors ECON-1A and KEYCONSENT-1A trust invariant: the embedded
//     `operator_public_key_fingerprint` is informational only)
//   - each entry's body hash recomputes from the stable body
//   - schema, entry_type, token_class are all valid
//   - NO public economic claim field appears anywhere in any entry
//
// Purity:
//   - no I/O (no file write, no file read, no network)
//   - no Date.now, no Math.random
//   - external pubkey is the only trust anchor
//   - output is a single frozen object
//
// Spec reference: docs/security/ECON_0_PREFLIGHT.md (§3.2 envelope) and the
// ECON-1B slice contract — chain walker over ECON-1A entries.
//
// Boundary: no public transfer claim, no mint claim, no exchange value claim
// emitted by the verifier; refuses on first failure with a structured reason.

import { verifyPayload } from "../../receipts/src/authorship-signature.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  DUAL_TOKEN_LEDGER_ENTRY_SCHEMA,
  VALID_ENTRY_TYPES,
  VALID_TOKEN_CLASSES,
} from "./dual-token-ledger.js";

export { DUAL_TOKEN_LEDGER_ENTRY_SCHEMA };

// Field names whose mere presence on ANY entry signals public economic claim
// drift. The verifier refuses up front — these are not allowed in v0.1, no
// matter the value. List intentionally aligned with ECON-0 §6 non-goals and
// ECON-1A negative tests.
const FORBIDDEN_PUBLIC_ECONOMIC_CLAIM_FIELDS = Object.freeze([
  "exchange_value",
  "fiat_value",
  "public_mint",
  "market_price",
  "federation_target",
  "settlement_target",
  "transfer_target",
  "public_transfer",
  "mint_authority",
  "supply_curve",
]);

function fail(reason, at_index) {
  if (at_index === undefined) {
    return Object.freeze({ verified: false, reason });
  }
  return Object.freeze({ verified: false, reason, at_index });
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function hasPublicEconomicClaimField(entry) {
  for (const name of FORBIDDEN_PUBLIC_ECONOMIC_CLAIM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, name)) {
      return true;
    }
  }
  return false;
}

export function verifyLedgerReplay({ entries, pubkeyPem } = {}) {
  // ── (0) entries must be a non-empty array ────────────────────────
  if (!Array.isArray(entries) || entries.length === 0) {
    return fail("entries_empty");
  }

  // ── walk each entry ──────────────────────────────────────────────
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    // structural sanity
    if (!isPlainObject(entry)) {
      return fail("entry_schema_mismatch", i);
    }
    if (entry.schema !== DUAL_TOKEN_LEDGER_ENTRY_SCHEMA) {
      return fail("entry_schema_mismatch", i);
    }

    // public economic claim guard — refuse before signature checks so that
    // a polluted entry cannot be propagated even if it carries a valid sig.
    if (hasPublicEconomicClaimField(entry)) {
      return fail("public_economic_claim_present", i);
    }

    if (!VALID_TOKEN_CLASSES.includes(entry.token_class)) {
      return fail("token_class_invalid", i);
    }
    if (!VALID_ENTRY_TYPES.includes(entry.entry_type)) {
      return fail("entry_schema_mismatch", i);
    }

    // genesis prev_hash rule
    if (i === 0) {
      if (entry.prev_hash !== null) {
        return fail("genesis_prev_hash_not_null", 0);
      }
    } else {
      const expectedPrev = entries[i - 1].entry_hash;
      if (!isSha256Hex(entry.prev_hash) || entry.prev_hash !== expectedPrev) {
        return fail("prev_hash_mismatch", i);
      }
    }

    // body hash recomputation
    if (
      typeof entry.entry_hash !== "string" ||
      typeof entry.entry_signature_b64 !== "string"
    ) {
      return fail("entry_hash_mismatch", i);
    }
    const { entry_signature_b64, entry_hash, ...stableBody } = entry;
    const recomputed = sha256(stableStringify(stableBody));
    if (recomputed !== entry_hash) {
      return fail("entry_hash_mismatch", i);
    }

    // signature check using ONLY the external pubkey
    let sigValid;
    try {
      sigValid = verifyPayload(stableBody, entry_signature_b64, pubkeyPem);
    } catch {
      sigValid = false;
    }
    if (!sigValid) {
      return fail("signature_invalid", i);
    }
  }

  return Object.freeze({
    verified: true,
    total_entries: entries.length,
    chain_root_hash: entries[entries.length - 1].entry_hash,
  });
}
