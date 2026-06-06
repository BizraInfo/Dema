// Central humanizer for next_safe_action / next_step_observable codes.
// Producers emit snake_case identifiers (schema-stable, machine-readable).
// Renderers call humanizeNextAction() at display time to convert codes
// into operator-facing sentences. The raw codes remain in JSON / --json
// output and in allowlist enforcement — only the human-rendered string
// is rewritten.

export const OBSERVATION_HUMANIZER = Object.freeze({
  // Process-mining observation codes (from process-mining-preview.js)
  no_ring_1_artifact_observable:
    "No Ring 1 artifact observable yet — seal a Lighthouse pack to advance.",
  ring_1_pack_sealed_observable:
    "Ring 1 pack sealed locally — send to a candidate reviewer to earn Ring 1.",
  ring_1_pack_sealed_observable_and_commits_held_observable:
    "Ring 1 pack sealed locally; commits also held from origin — review held work and ship the pack.",
  external_reviewer_form_present_observable:
    "External reviewer form on record — Ring 1 earned. Mint the corresponding receipt.",

  // Generic state / readiness codes (from node0-homebase-state-preview.js,
  // shared-urp-world-preview.js, process-value-preview.js)
  continue_preview_only_readiness:
    "Continue preview-only readiness work — no runtime escalation needed.",
  fix_malformed_process_inputs:
    "Fix malformed process inputs before the next slice.",
  restore_clean_baseline:
    "Restore a clean baseline — current state has drift to reconcile.",
  hold_step7_ceremony: "Hold the Step 7 ceremony — preconditions are ready.",
  reduce_noise_before_next_slice:
    "Reduce signal-to-noise before starting the next slice.",
  continue_verified_micro_slice:
    "Continue the verified micro-slice — current trajectory is healthy.",

  // LLM router codes (from local-llm-router-preview.js)
  install_local_model_to_unblock_routing:
    "Install a local model to unblock routing — none are currently available.",
});

// SNAKE_CASE_RE matches lowercase-letter-leading snake_case identifiers
// (the convention used by all known process-mining / state observation
// codes). Strings already containing spaces or capital letters are
// treated as pre-humanized and passed through unchanged.
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

export function humanizeNextAction(code) {
  if (typeof code !== "string" || code.length === 0) return code;
  if (OBSERVATION_HUMANIZER[code]) return OBSERVATION_HUMANIZER[code];
  if (SNAKE_CASE_RE.test(code)) {
    const words = code.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1) + ".";
  }
  return code;
}
