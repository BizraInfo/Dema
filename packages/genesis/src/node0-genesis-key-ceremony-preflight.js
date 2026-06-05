// NODE0-GENESIS-KEY-CEREMONY-1A-PREFLIGHT · read-only operator gate before key init.
//
// Composes:
// - cross-repo provenance next_gate (from committed summary or caller)
// - Block0 live-readiness precheck (read-only)
// - hasAuthorshipKey (stat only — no private key read)
//
// Does NOT generate keys, sign, migrate, or seal Block0.

import { assessBlock0LiveReadiness } from "./block0-live-readiness.js";
import {
  hasAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../../receipts/src/authorship-key-store.js";

export const NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA =
  "bizra.dema.node0_genesis_key_ceremony_preflight.v0.1";

export const ALLOWED_PROVENANCE_GATES = Object.freeze([
  "NODE0-GENESIS-KEY-CEREMONY-1A",
  "MIGRATE-HISTORICAL-GENESIS-PROOF-1A",
  "BLOCKED_BY_UNRESOLVED_PROVENANCE",
]);

/**
 * @param {object} opts
 * @param {string} [opts.demaHome]
 * @param {string|undefined} [opts.provenanceNextGate] - must be a value in ALLOWED_PROVENANCE_GATES;
 *   missing or invalid → fails closed as BLOCKED_BY_UNRESOLVED_PROVENANCE.
 * @param {object|null} [opts.block0LiveReadiness]
 */
export async function assessNode0GenesisKeyCeremonyPreflight({
  demaHome,
  provenanceNextGate,
  block0LiveReadiness = null,
} = {}) {
  const block0 =
    block0LiveReadiness ?? (await assessBlock0LiveReadiness({ demaHome }));

  const keyPresent = await hasAuthorshipKey(demaHome);

  /** @type {Array<{code:string,message:string}>} */
  const blockers = [];

  if (provenanceNextGate == null || provenanceNextGate === "") {
    blockers.push({
      code: "provenance_unresolved",
      message:
        "No provenance gate supplied; complete CROSS-REPO-GENESIS-PROVENANCE-1A before key ceremony.",
    });
  } else if (!ALLOWED_PROVENANCE_GATES.includes(provenanceNextGate)) {
    blockers.push({
      code: "unknown_provenance_gate",
      message: `Unknown provenance gate "${provenanceNextGate}"; must be one of: ${ALLOWED_PROVENANCE_GATES.join(", ")}.`,
    });
  } else if (provenanceNextGate === "BLOCKED_BY_UNRESOLVED_PROVENANCE") {
    blockers.push({
      code: "provenance_unresolved",
      message:
        "Cross-repo provenance is unresolved; complete CROSS-REPO-GENESIS-PROVENANCE-1A before key ceremony.",
    });
  } else if (provenanceNextGate === "MIGRATE-HISTORICAL-GENESIS-PROOF-1A") {
    blockers.push({
      code: "migrate_review_required",
      message:
        "Historical genesis artifacts may exist; operator must choose migrate vs fresh key before init.",
    });
  }

  if (keyPresent) {
    blockers.push({
      code: "authorship_key_already_present",
      message:
        "DEMA_HOME already has an authorship key; key init refuses second init.",
    });
  }

  if (!block0.operator_pubkey_present && !keyPresent) {
    // Expected path — not a blocker when gate is fresh ceremony.
  }

  const clearedForKeyInit =
    blockers.length === 0 &&
    provenanceNextGate === "NODE0-GENESIS-KEY-CEREMONY-1A" &&
    !keyPresent;

  return Object.freeze({
    schema: NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA,
    truth_label: clearedForKeyInit
      ? "NODE0_GENESIS_KEY_CEREMONY_CLEARED"
      : "NODE0_GENESIS_KEY_CEREMONY_BLOCKED",
    mode: "READ_ONLY_PREFLIGHT",
    cleared_for_key_init: clearedForKeyInit,
    provenance_next_gate: provenanceNextGate,
    consent_phrase: KEY_INIT_CONSENT_PHRASE,
    recommended_command: clearedForKeyInit
      ? `dema authorship key init --consent "${KEY_INIT_CONSENT_PHRASE}" --json`
      : null,
    block0_summary: Object.freeze({
      operator_pubkey_present: block0.operator_pubkey_present,
      ceremony_required: block0.ceremony_required,
      needs_operator_signing_count: block0.needs_operator_signing_count,
      poi_rule_verifiable: block0.poi_rule_verifiable,
    }),
    authorship_key_present: keyPresent,
    blockers: Object.freeze(blockers),
    boundary: Object.freeze({
      read_only: true,
      private_key_read: false,
      key_generated: false,
      signing_performed: false,
      block0_sealed: false,
      migration_performed: false,
      network_used: false,
    }),
  });
}
