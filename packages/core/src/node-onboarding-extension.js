// Node Onboarding Extension — ADR-011 Phase 1
//
// Pure deterministic builder that emits 5 schema blocks extending the
// onboarding-lifecycle preview with ADR-011's canonical output schema.
//
// Laws enforced structurally (caller injection ignored):
//   Law #3  → model_readiness.scan_consent_required === true always
//   Law #5  → model_readiness.local_models_required === false always
//   Law #6  → ordinals 3 and 4 refused per canon_registry forbidden_topology_phrases
//   Law #8  → blocked_effects.federation === true always
//            → blocked_effects.poi_scoring === true always
//            → blocked_effects.model_scan_without_consent === true always
//            → blocked_effects.model_invocation === true always
//            → blocked_effects.auto_advance_to_node_n_plus_1 === true always
//   Law #9  → node_topology.paired_receipt_required === true when candidate_ordinal >= 1
//
// No I/O. No process.env. No Date. No Math.random(). Deep-frozen output.

export const EXTENSION_SCHEMA_VERSION =
  "bizra.dema.onboarding_lifecycle.adr011_extension.v0.1";

// Ordinals forbidden per canon_registry.json forbidden_topology_phrases
const FORBIDDEN_ORDINALS = new Set([3, 4]);

const VALID_MODEL_STATUSES = new Set([
  "MODEL_UNKNOWN",
  "MODEL_LESS_DECLARED",
  "MODEL_INVENTORY_PENDING_CONSENT",
  "MODEL_INVENTORY_DECLARED",
  "MODEL_AVAILABLE",
]);

const VALID_LANGUAGE_SOURCES = new Set([
  "unset",
  "first_run_picker",
  "profile_load",
  "reset_explicit",
]);

const VALID_ONBOARDING_TRIGGERS = new Set([
  "first_run",
  "reset_explicit",
  "candidate_invite",
]);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function sanitizeLanguageCode(code) {
  if (typeof code !== "string") return null;
  // ISO 639-1: exactly 2 lowercase letters
  if (/^[a-z]{2}$/.test(code)) return code;
  return null;
}

function sanitizeLongString(val) {
  if (typeof val !== "string") return null;
  // Cap at 500 chars to guard against payload stuffing
  return val.slice(0, 500);
}

export function buildNodeOnboardingExtension(input = {}) {
  // Defensive copy — do not trust prototype or caller mutation
  const {
    current_ordinal,
    candidate_ordinal,
    paired_receipt_id,
    ordinal_monotonicity_verified,
    model_status,
    scan_performed,
    model_invocation_allowed,
    language_code,
    secondary_language_code,
    secondary_language_offered,
    returning_user_load,
    language_source,
    is_first_run,
    is_returning_user,
    onboarding_trigger,
    stage_skipped_due_to_profile,
  } = Object.assign({}, input);

  // ── node_topology ───────────────────────────────────────────────────────────

  const resolvedCurrentOrdinal =
    typeof current_ordinal === "number" &&
    Number.isInteger(current_ordinal) &&
    current_ordinal >= 0
      ? current_ordinal
      : 0;

  // Law #6: ordinals 3 and 4 are forbidden — coerce to null
  const rawCandidateOrdinal =
    typeof candidate_ordinal === "number" &&
    Number.isInteger(candidate_ordinal) &&
    candidate_ordinal >= 0
      ? candidate_ordinal
      : null;

  const resolvedCandidateOrdinal =
    rawCandidateOrdinal !== null && FORBIDDEN_ORDINALS.has(rawCandidateOrdinal)
      ? null
      : rawCandidateOrdinal;

  // Law #9 (ordinal): paired_receipt_required is true when candidate_ordinal >= 1
  const pairedReceiptRequired =
    resolvedCandidateOrdinal !== null && resolvedCandidateOrdinal >= 1;

  const resolvedPairedReceiptId = sanitizeLongString(
    typeof paired_receipt_id === "string" ? paired_receipt_id : null,
  );

  const resolvedOrdinalMonotonicityVerified =
    ordinal_monotonicity_verified === true;

  const node_topology = {
    current_ordinal: resolvedCurrentOrdinal,
    candidate_ordinal: resolvedCandidateOrdinal,
    paired_receipt_required: pairedReceiptRequired,
    paired_receipt_id: resolvedPairedReceiptId,
    ordinal_monotonicity_verified: resolvedOrdinalMonotonicityVerified,
  };

  // ── model_readiness ─────────────────────────────────────────────────────────

  const resolvedModelStatus =
    typeof model_status === "string" && VALID_MODEL_STATUSES.has(model_status)
      ? model_status
      : "MODEL_UNKNOWN";

  const model_readiness = {
    status: resolvedModelStatus,
    local_models_required: false, // Law #5: structurally false — cannot be injected true
    scan_consent_required: true, // Law #3: structurally true — cannot be injected false
    scan_performed: scan_performed === true,
    model_invocation_allowed: model_invocation_allowed === true,
    fallback_path: "continue_model_less_onboarding",
  };

  // ── language_state ──────────────────────────────────────────────────────────

  const resolvedLanguageCode = sanitizeLanguageCode(language_code);
  const resolvedSecondaryCode = sanitizeLanguageCode(secondary_language_code);

  const resolvedLanguageSource =
    typeof language_source === "string" &&
    VALID_LANGUAGE_SOURCES.has(language_source)
      ? language_source
      : "unset";

  const language_state = {
    language_set: resolvedLanguageCode !== null,
    language_code: resolvedLanguageCode,
    consent_phrases_will_render_in: resolvedLanguageCode,
    secondary_language_code: resolvedSecondaryCode,
    secondary_language_offered: secondary_language_offered === true,
    returning_user_load: returning_user_load === true,
    language_source: resolvedLanguageSource,
  };

  // ── candidate_lifecycle ─────────────────────────────────────────────────────

  const resolvedOnboardingTrigger =
    typeof onboarding_trigger === "string" &&
    VALID_ONBOARDING_TRIGGERS.has(onboarding_trigger)
      ? onboarding_trigger
      : null;

  const resolvedStageSkipped = Array.isArray(stage_skipped_due_to_profile)
    ? stage_skipped_due_to_profile.filter((s) => typeof s === "string")
    : [];

  const candidate_lifecycle = {
    is_first_run: is_first_run !== false, // default true; only false if explicitly false
    is_returning_user: is_returning_user === true,
    onboarding_trigger: resolvedOnboardingTrigger,
    stage_skipped_due_to_profile: resolvedStageSkipped,
  };

  // ── blocked_effects ─────────────────────────────────────────────────────────
  // Law #8: all 8 entries structurally true — caller cannot flip any to false

  const blocked_effects = {
    federation: true,
    raw_data_sharing: true,
    public_broadcast: true,
    economic_activation: true,
    poi_scoring: true,
    model_scan_without_consent: true,
    model_invocation: true,
    auto_advance_to_node_n_plus_1: true,
  };

  return deepFreeze({
    node_topology,
    model_readiness,
    language_state,
    candidate_lifecycle,
    blocked_effects,
  });
}
