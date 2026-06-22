// DEMA-TALK-LOOP-1A — PURE talk-consent-preview kernel.
//
// Wraps the EXISTING, hardened llm-adapter PREVIEW path into a friendly talk
// consent ceremony. It makes NO model call — it reuses buildLLMInvocationPreview
// (which itself performs no network I/O) to compute the whitelist verdict, the
// exact per-model consent phrase, the localhost target, and the bounds, then
// frames them as a human-readable "here is what I would do, here is the phrase
// to allow it" ceremony. The LIVE invocation (invokeLocalLLM) is
// DEMA-TALK-LOOP-1B under its own explicit GO.
//
// Reuse over reinvention: the whitelist/consent/bound logic lives once in
// llm-adapter.js. Duplicating it here would risk the exact drift that bit the
// wow-report (an assumed-then-wrong constant). Importing llm-adapter.js is a
// sibling import (no node:fs/net token in THIS file), and the preview path it
// exposes performs no fetch, so this kernel stays pure and effect-free.

import { buildLLMInvocationPreview } from "./llm-adapter.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_TALK_LOOP_PREVIEW_SCHEMA = "bizra.dema.talk_loop_preview.v0.1";

const TRUTH_LABEL = "DEMA_TALK_LOOP_PREVIEW_ONLY";
const DEFAULT_MODEL = "qwen2.5";

const WHAT_THIS_PROVES = Object.freeze([
  "A local-model talk request can be previewed as an honest consent ceremony — model, exact phrase, and boundary — with no call made.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No model was called and no response was generated (this is preview only).",
  "The local model is installed or reachable (that is checked at live-invocation time, 1B).",
  "Any file was written or any receipt minted.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// The kernel never calls anything. Use the CANONICAL 16-key preview boundary —
// it already asserts model_invocation_performed / model_loaded / prompt_executed
// / network_used / external_call_performed / runtime_execution_performed /
// tool_executed all false. Do NOT coin a parallel vocabulary: `model_invoked` is
// NOT the canon's `model_invocation_performed`, and that drift would not match
// the 1B live-result envelope (which carries the canonical keys) — the exact
// assumed-then-wrong-constant trap this kernel's header warns against.
function buildBoundary() {
  return buildPreviewBoundary();
}

function buildExplanation(model, allowed) {
  return Object.freeze([
    `If you allow it, I would send your prompt to a LOCAL model (${model}) running on your own machine — localhost only.`,
    "I would NOT send anything to the internet, and I would NOT follow any remote endpoint.",
    "I would NOT write any file and NOT mint any receipt.",
    "My answer would be a SUGGESTION only — never an authority, never an action you didn't ask for.",
    "I would scan your prompt and my response for safety, before and after.",
    allowed
      ? `The model ${model} is on the allow-list, so a request would be permitted once you consent.`
      : `The model ${model} is NOT on the allow-list — I would refuse to call it.`,
    "Right now this is only a PREVIEW — I have not called or invoked anything.",
  ]);
}

export function buildDemaTalkPreview({ prompt = "", model = DEFAULT_MODEL } = {}) {
  const modelName = typeof model === "string" && model.length > 0 ? model : DEFAULT_MODEL;

  // Reuse the hardened preview path (no network I/O) for the authoritative
  // whitelist verdict, consent phrase, localhost target, and prompt bounds.
  const inv = buildLLMInvocationPreview({ model: modelName, prompt });

  return deepFreeze({
    schema: DEMA_TALK_LOOP_PREVIEW_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    model: inv.requested_model,
    model_allowed_in_whitelist: inv.model_allowed_in_whitelist,
    prompt_length_chars: inv.prompt_length_chars,
    prompt_too_long: inv.prompt_truncated,
    target_endpoint: inv.target_endpoint,
    target_is_localhost: inv.target_is_localhost,
    consent_required: inv.consent_required,
    model_invoked: false,
    explanation_lines: buildExplanation(
      inv.requested_model,
      inv.model_allowed_in_whitelist,
    ),
    next_safe_actions: Object.freeze([
      "grant_exact_consent_to_talk",
      "choose_a_different_model",
      "skip",
    ]),
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
