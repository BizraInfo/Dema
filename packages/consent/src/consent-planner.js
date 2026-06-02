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
import { validateMaxLength, VALIDATION_LIMITS } from "../../core/src/input-validator.js";

export { formatConsentPlanPreview } from "./consent-format.js";

export async function buildConsentPlanPreview({ intent, now = new Date() } = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  
  // Security: Validate intent length to prevent DoS via massive input strings
  const lengthValidation = await validateMaxLength(
    naturalLanguage,
    VALIDATION_LIMITS.MAX_INTENT_LENGTH,
    "intent"
  );
  
  if (!lengthValidation.accepted) {
    throw new Error(lengthValidation.rejected_detail);
  }
  
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
    unsafe_file_references: shape.unsafe_file_references,
    analogical_notes: buildAnalogicalNotes(
      naturalLanguage,
      shape.permissions,
      shape.unsafe_file_references
    ),
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
