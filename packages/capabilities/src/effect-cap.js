import { lookupConsent, verifyConsentHashTable } from "../../consent/src/consent-hash-table.js";

export const EFFECT_CAP_DECISION_SCHEMA = "bizra.dema.effect_cap_decision.v0.1";

function boundary() {
  return {
    approval_recorded: false,
    capability_minted: false,
    execution_enabled: false,
    mutation_performed: false,
    receipt_minted: false
  };
}

function deny(reason, detail, extra = {}) {
  return {
    schema: EFFECT_CAP_DECISION_SCHEMA,
    mode: "PREVIEW_ONLY",
    allowed: false,
    reason,
    detail,
    ...extra,
    boundary: boundary()
  };
}

export function decideEffectCap({
  request,
  consentTable,
  committed_hash: committedHash,
  now = new Date()
} = {}) {
  if (typeof committedHash !== "string" || committedHash.length === 0) {
    return deny("missing_committed_hash", "EffectCap decision requires a committed consent hash.");
  }

  const integrity = verifyConsentHashTable(consentTable);
  if (!integrity.ok) {
    return deny(
      "consent_table_hash_mismatch",
      "Live ConsentHashTable does not match its own commitment hash.",
      { integrity }
    );
  }

  if (consentTable.commitment_hash !== committedHash) {
    return deny(
      "cap_commitment_hash_mismatch",
      "EffectCap committed hash does not match the live ConsentHashTable hash.",
      {
        expected_commitment_hash: committedHash,
        actual_commitment_hash: consentTable.commitment_hash
      }
    );
  }

  const lookup = lookupConsent(consentTable, request, { now });
  if (!lookup.allowed) {
    return deny(lookup.reason, lookup.detail, {
      lookup,
      committed_hash: committedHash
    });
  }

  return {
    schema: EFFECT_CAP_DECISION_SCHEMA,
    mode: "PREVIEW_ONLY",
    allowed: true,
    reason: "committed_consent_scope_found",
    detail: "Preview decision only. No runtime capability is minted and no effect is executed.",
    key: lookup.key,
    committed_hash: committedHash,
    boundary: boundary()
  };
}
