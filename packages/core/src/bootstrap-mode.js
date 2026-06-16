// Bootstrap Mode v0.1 — the model-less, ephemeral first-entry preview.
//
// Composes existing pure builders (no reinvention) into a single ephemeral
// preview: a model-less broker descriptor, the canonical 7-stage onboarding
// lifecycle, and the canonical all-false preview boundary. It is a pure
// function — no filesystem write, no model invocation, no network. The persist
// / foundation-grant path (which requires exact-string consent) is a later
// slice; this kernel never writes.
//
// Contract: docs/02-architecture/dema-first-time-onboarding-protocol-v0.1.md
//   Law 2 (zero-model Bootstrap Mode) and Law 4 (preview-vs-live wording).

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildOnboardingLifecyclePreview,
  ONBOARDING_LIFECYCLE_STAGE_IDS,
} from "./onboarding-lifecycle.js";
import { buildModelBrokerPreview } from "../../models/src/model-broker-preview.js";

export const BOOTSTRAP_MODE_SCHEMA = "bizra.dema.bootstrap_mode.v0.1";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// Build the ephemeral Bootstrap Mode preview. Model-less by default (empty
// registry). Pure: returns a deeply-frozen result and writes nothing.
export function buildBootstrapModePreview({
  candidate_name = null,
  candidate_ordinal = null,
  registry = [],
} = {}) {
  const model_route = buildModelBrokerPreview({ registry });
  const lifecycle = buildOnboardingLifecyclePreview({
    candidate_name,
    candidate_ordinal,
  });

  return deepFreeze({
    schema: BOOTSTRAP_MODE_SCHEMA,
    mode: "ephemeral_preview",
    truth_label: "DECLARED",
    model_status: "MODEL_UNKNOWN",
    model_route,
    stages: [...ONBOARDING_LIFECYCLE_STAGE_IDS],
    lifecycle,
    next_safe_message: "session ready",
    boundary: buildPreviewBoundary(),
  });
}
