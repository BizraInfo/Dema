// HOMEBASE-SCAN-CONSENT-1A — PURE consent-ceremony kernel.
//
// Dema must ASK before she looks. This kernel produces the consent ceremony for
// a homebase metadata scan — the honest disclosure of what will and will not
// happen, the exact phrase the operator must type, and the verdict for an
// offered phrase. It performs NO scan and touches NO filesystem: it only gates.
// The CLI runs the existing metadata-only scanner (local-asset-awareness.js)
// ONLY after this kernel returns scan_allowed === true. Keeping the gate pure
// means the consent decision is testable in-memory and the kernel stays clean
// under scripts/review/kernel-purity-check.mjs.
//
// Exact-string consent (ADR-005): the offered phrase must equal
// EXPECTED_SCAN_CONSENT_PHRASE byte-for-byte — a near-miss (extra whitespace,
// different casing) does NOT verify. Fail-closed is the default.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const HOMEBASE_SCAN_CONSENT_SCHEMA =
  "bizra.dema.homebase_scan_consent.v0.1";

export const EXPECTED_SCAN_CONSENT_PHRASE = "GO: scan homebase metadata only";

const TRUTH_LABEL = "HOMEBASE_SCAN_CONSENT_LOCAL_ONLY";

const WHAT_THIS_PROVES = Object.freeze([
  "A consent ceremony gates the homebase metadata scan: nothing is scanned until the exact phrase is typed.",
  "The exact-string consent check is fail-closed — a near-miss does not pass.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "The homebase was scanned — this kernel performs no scan; it only authorizes one.",
  "Any file content was read.",
  "An inventory artifact was written.",
  "A model was invoked, a task ran, or any runtime was activated.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// The kernel never scans, so every boundary flag is false on every path. The
// CLI composes the scanner's own boundary (homebase_scan_performed: true) only
// when it actually runs the scan after consent.
function buildBoundary() {
  return deepFreeze({
    ...buildPreviewBoundary(),
    homebase_scan_performed: false,
    file_content_read: false,
    scanned_root_mutated: false,
    symlink_followed: false,
    network_used: false,
    model_invoked: false,
    task_executed: false,
    runtime_activated: false,
    federation_used: false,
    token_minted: false,
    poi_score_calculated: false,
    reward_emitted: false,
  });
}

function buildExplanation(scanRoot) {
  return Object.freeze([
    "Dema may inspect metadata to understand the shape of your homebase.",
    typeof scanRoot === "string" && scanRoot.length > 0
      ? `She will scan metadata under: ${scanRoot}`
      : "She will scan metadata under your configured homebase root.",
    "She will NOT read file contents.",
    "She will NOT upload anything.",
    "She will NOT follow symlinks.",
    "She will NOT mutate the scanned root.",
    "She will only create or update a local inventory artifact under DEMA_HOME.",
    "The scan can be skipped — nothing happens until you type the exact phrase.",
  ]);
}

export function buildHomebaseScanConsent({
  offeredConsent = null,
  scanRoot = null,
} = {}) {
  // Exact-string match only — fail-closed. No trim, no case-fold.
  const consentVerified = offeredConsent === EXPECTED_SCAN_CONSENT_PHRASE;
  const scanAllowed = consentVerified;

  return deepFreeze({
    schema: HOMEBASE_SCAN_CONSENT_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    consent_required: true,
    expected_consent_phrase: EXPECTED_SCAN_CONSENT_PHRASE,
    consent_verified: consentVerified,
    scan_allowed: scanAllowed,
    scan_root: typeof scanRoot === "string" && scanRoot.length > 0 ? scanRoot : null,
    explanation_lines: buildExplanation(scanRoot),
    next_safe_actions: scanAllowed
      ? Object.freeze(["run_homebase_metadata_scan"])
      : Object.freeze(["grant_exact_consent_to_scan", "skip_scan"]),
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
