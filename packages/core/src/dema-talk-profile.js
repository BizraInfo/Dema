// DEMA-TALK-PROFILE-1A — talk profile resolver (readiness → provider/model).
//
// Maps operator-facing talk profiles (canon, fast) to fleet-readiness preferred
// routes without invoking models, loading weights, starting daemons, writing
// config, or silently falling back. Composes with buildDemaTalkPreview for the
// consent ceremony using the resolved route.

import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildDemaTalkPreview } from "./dema-talk-loop-preview.js";
import {
  LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
} from "./local-llm-fleet-readiness.js";

export const DEMA_TALK_PROFILE_SCHEMA = "bizra.dema.talk_profile.v0.1";
export const DEMA_TALK_PROFILE_TRUTH_LABEL = "DEMA_TALK_PROFILE_PREVIEW_ONLY";

export const SUPPORTED_TALK_PROFILES = Object.freeze(["canon", "fast"]);

const PROFILE_TO_READINESS_KEY = Object.freeze({
  canon: "preferred_canon_qa",
  fast: "preferred_fast_reply",
});

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was called — profile resolution selects a route from a readiness snapshot only.",
  "A blocked profile does not auto-load models or start provider daemons.",
  "Default dema talk behavior is unchanged when --profile is omitted.",
  "Readiness was probed at resolution time; provider state may change afterward.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function resolveTalkProfileFromReadiness({ profile, readiness }) {
  const name = typeof profile === "string" ? profile.trim().toLowerCase() : "";
  if (!SUPPORTED_TALK_PROFILES.includes(name)) {
    return deepFreeze({
      ok: false,
      error: `unknown_talk_profile:${name || "(empty)"}`,
      known_profiles: SUPPORTED_TALK_PROFILES,
    });
  }
  const key = PROFILE_TO_READINESS_KEY[name];
  const pref = readiness?.[key];
  const route = pref?.route;
  if (!route || typeof route.provider !== "string" || typeof route.model !== "string") {
    return deepFreeze({
      ok: false,
      error: `readiness_missing_preferred_route:${name}`,
      profile: name,
    });
  }
  return deepFreeze({
    ok: true,
    profile: name,
    readiness_key: key,
    selection_reason: pref.selection_reason ?? null,
    resolved_provider: route.provider,
    resolved_model: route.model,
    live_talk_status: route.live_talk_status ?? "blocked",
    blocking_reason: route.blocking_reason ?? null,
    operator_note: route.operator_note ?? null,
    consent_phrase: route.consent_phrase ?? null,
    model_allowed: route.model_allowed === true,
    endpoint: route.endpoint ?? null,
  });
}

export function buildDemaTalkProfilePreview({
  profile,
  readiness,
  prompt = "",
  model = null,
  provider = null,
} = {}) {
  const resolution = resolveTalkProfileFromReadiness({ profile, readiness });
  if (!resolution.ok) {
    return deepFreeze({
      ok: false,
      schema: DEMA_TALK_PROFILE_SCHEMA,
      truth_label: DEMA_TALK_PROFILE_TRUTH_LABEL,
      error: resolution.error,
      known_profiles: resolution.known_profiles ?? SUPPORTED_TALK_PROFILES,
      model_invoked: false,
      boundary: buildPreviewBoundary(),
    });
  }

  const resolvedProvider =
    typeof provider === "string" && provider.length > 0
      ? provider
      : resolution.resolved_provider;
  const resolvedModel =
    typeof model === "string" && model.length > 0 ? model : resolution.resolved_model;

  const talk_preview = buildDemaTalkPreview({
    prompt,
    model: resolvedModel,
    provider: resolvedProvider,
  });

  return deepFreeze({
    ok: true,
    schema: DEMA_TALK_PROFILE_SCHEMA,
    truth_label: DEMA_TALK_PROFILE_TRUTH_LABEL,
    profile: resolution.profile,
    selection_reason: resolution.selection_reason,
    readiness_truth_label: readiness?.truth_label ?? LOCAL_LLM_FLEET_READINESS_TRUTH_LABEL,
    resolved_provider: resolvedProvider,
    resolved_model: resolvedModel,
    profile_resolved_provider: resolution.resolved_provider,
    profile_resolved_model: resolution.resolved_model,
    live_talk_status: resolution.live_talk_status,
    blocking_reason: resolution.blocking_reason,
    operator_note: resolution.operator_note,
    consent_phrase: talk_preview.consent_required,
    profile_consent_phrase: resolution.consent_phrase,
    model_invoked: false,
    provider: talk_preview.provider,
    model: talk_preview.model,
    consent_required: talk_preview.consent_required,
    model_allowed_in_whitelist: talk_preview.model_allowed_in_whitelist,
    target_endpoint: talk_preview.target_endpoint,
    target_is_localhost: talk_preview.target_is_localhost,
    prompt_length_chars: talk_preview.prompt_length_chars,
    prompt_too_long: talk_preview.prompt_too_long,
    explanation_lines: talk_preview.explanation_lines,
    talk_preview,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: buildPreviewBoundary(),
  });
}
