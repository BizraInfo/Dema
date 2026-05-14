import {
  MICRO_CONSENT_SHAPE,
  PREVIEW_BOUNDARY,
  PREVIEW_PROOF_OF_TRUTH,
  SCHEMA,
  sha256,
  stableStringify
} from "./consent-common.js";
import {
  buildAnalogicalNotes,
  extractIntentShape
} from "./consent-extract.js";

export { formatConsentPlanPreview } from "./consent-format.js";

export function buildConsentPlanPreview({ intent, now = new Date() } = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  if (!naturalLanguage) {
    throw new Error("Consent planning requires a non-empty intent.");
  }

  const shape = extractIntentShape(naturalLanguage);
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    mission_draft: {
      natural_language: naturalLanguage,
      category: shape.category,
      risk_level: shape.risk_level
    },
    permissions: shape.permissions,
    analogical_notes: buildAnalogicalNotes(naturalLanguage, shape.permissions),
    commitment_hash: sha256(stableStringify(shape.permissions)),
    micro_consent: {
      status: "draft_only",
      approval_recorded: false,
      exact_consent_required: true,
      minimum_shape: MICRO_CONSENT_SHAPE
    },
    proof_of_truth: PREVIEW_PROOF_OF_TRUTH,
    boundary: PREVIEW_BOUNDARY
  };
}
