export const STEP7_CONSENT_REFUSAL_PREVIEW_SCHEMA = "bizra.dema.step7_consent_refusal_preview.v0.1";

const MAX_OBSERVED_TEXT_LENGTH = 4096;

const NEXT_SAFE_ACTIONS = Object.freeze([
  "fix_malformed_process_inputs",
  "hold_step7_ceremony"
]);

// Diagnostic only: drives observed_text_class and refusal_reason, not verdict.
// Verdict is HOLD by default; classifier accuracy does not bear on safety.
const AUTHORIZATION_INTENT_PATTERN = /\b(authori[sz]e|authori[sz]ation|permission|permit|approve|approval|consent|proceed)\b/i;

const INVARIANT_BLOCKED_ACTIONS = Object.freeze([
  "runtime_start",
  "federation_start",
  "node_connection",
  "receipt_mint",
  "capability_mint",
  "authorization_emit",
  "step7_mint_without_exact_authorization"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeNow(now) {
  const candidate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(candidate.getTime())) {
    return { malformed: true, iso: null };
  }
  return { malformed: false, iso: candidate.toISOString() };
}

function classifyObservedText(observedText) {
  if (observedText === undefined || observedText === null || observedText === "") {
    return {
      malformed: false,
      refusalReason: "missing_observed_text",
      observedTextClass: "absent"
    };
  }
  if (typeof observedText !== "string") {
    return {
      malformed: true,
      refusalReason: "malformed_observed_text",
      observedTextClass: "malformed"
    };
  }
  if (observedText.length > MAX_OBSERVED_TEXT_LENGTH) {
    return {
      malformed: true,
      refusalReason: "observed_text_too_long",
      observedTextClass: "malformed"
    };
  }
  const trimmed = observedText.trim();
  if (!trimmed) {
    return {
      malformed: false,
      refusalReason: "missing_observed_text",
      observedTextClass: "absent"
    };
  }
  if (AUTHORIZATION_INTENT_PATTERN.test(trimmed)) {
    return {
      malformed: false,
      refusalReason: "broad_authorization_not_exact",
      observedTextClass: "authorization_like_text"
    };
  }
  return {
    malformed: false,
    refusalReason: "no_consent_attempt_detected",
    observedTextClass: "non_authorization_text"
  };
}

function buildBoundary() {
  return {
    runtime_started: false,
    federation_started: false,
    socket_opened: false,
    node_connection_attempted: false,
    receipt_minted: false,
    capability_minted: false,
    authorization_emitted: false,
    authorization_phrase_emitted: false,
    step7_authorization_observed: false,
    filesystem_write_performed: false,
    cli_wired: false,
    push_performed: false
  };
}

export function buildSelfProactiveHarness({ malformed, nextSafeAction }) {
  return deepFreeze({
    mode: "DETERMINISTIC_REFUSAL_PREVIEW",
    recommended_micro_action: nextSafeAction,
    gates: [
      { gate: "observed_text_structured", pass: !malformed },
      { gate: "step7_hold_boundary", pass: true },
      { gate: "authorization_phrase_not_emitted", pass: true },
      { gate: "receipt_mint_blocked", pass: true },
      { gate: "runtime_boundary_closed", pass: true }
    ]
  });
}

export function buildSelfCritique({ malformed }) {
  return deepFreeze({
    confidence: malformed ? "rejected" : "bounded_refusal_preview",
    limitation: "This preview refuses or classifies supplied consent language only; it is not the governed Step 7 ceremony gate.",
    weakest_link: malformed ? "input_shape" : "exact_authorization_is_intentionally_not_known_here"
  });
}

export function buildMicroCompliance({ malformed }) {
  return deepFreeze({
    preview_only: true,
    deterministic: true,
    refusal_only: true,
    no_runtime: true,
    no_federation: true,
    no_node_connection: true,
    no_receipt_mint: true,
    no_authorization_emit: true,
    no_observed_text_echo: true,
    fail_closed_on_malformed_input: malformed
  });
}

export function buildMicroConsent() {
  return deepFreeze({
    preview_scope: "step7_consent_refusal_preview_only",
    exact_string_required_for_gated_actions: true,
    consent_observed_in_preview: false,
    action_authorized_by_preview: false,
    future_step7_mint_requires_fresh_current_operator_turn: true,
    reusable_authorization_created: false,
    broad_consent_allowed: false
  });
}

export function buildAnalogicalModel() {
  return deepFreeze({
    model: "locked_door_sign_not_key",
    mapping: "The preview can label a door as locked and explain why broad permission is not the key; it cannot unlock the door."
  });
}

function buildHarness({ malformed, refusalReason, nextSafeAction }) {
  return {
    self_proactive_harness: buildSelfProactiveHarness({ malformed, nextSafeAction }),
    self_critique: buildSelfCritique({ malformed }),
    micro_compliance: buildMicroCompliance({ malformed }),
    micro_consent: buildMicroConsent(),
    analogical_model: buildAnalogicalModel(),
    refusal_interpretation: refusalReason
  };
}

export function buildStep7ConsentRefusalPreview({ observedText, now = new Date() } = {}) {
  const checkedAt = normalizeNow(now);
  const observed = classifyObservedText(observedText);
  const malformed = observed.malformed || checkedAt.malformed;
  const refusalReason = checkedAt.malformed ? "malformed_now" : observed.refusalReason;
  const nextSafeAction = malformed ? "fix_malformed_process_inputs" : "hold_step7_ceremony";
  const boundary = buildBoundary();
  const blockedActions = clone(INVARIANT_BLOCKED_ACTIONS);
  const harness = buildHarness({ malformed, refusalReason, nextSafeAction });

  return deepFreeze({
    schema: STEP7_CONSENT_REFUSAL_PREVIEW_SCHEMA,
    truth_label: "DECLARED",
    mode: "PREVIEW_ONLY",
    certifies: false,
    checked_at: checkedAt.iso,
    verdict: malformed ? "PREVIEW_REJECT" : "HOLD",
    process_state: malformed ? "preview_reject" : "step7_consent_not_accepted",
    refusal_reason: refusalReason,
    observed_text_class: checkedAt.malformed ? "malformed" : observed.observedTextClass,
    observed_text_echoed: false,
    next_safe_action: nextSafeAction,
    next_safe_action_allowed: NEXT_SAFE_ACTIONS.includes(nextSafeAction),
    ...harness,
    blocked_actions: blockedActions,
    checks: [
      { check: "checked_at_valid", pass: !checkedAt.malformed },
      { check: "observed_text_structured", pass: !observed.malformed },
      { check: "next_safe_action_allowlisted", pass: NEXT_SAFE_ACTIONS.includes(nextSafeAction) },
      {
        check: "blocked_actions_invariant",
        pass: INVARIANT_BLOCKED_ACTIONS.every((action) => blockedActions.includes(action))
      },
      { check: "authorization_phrase_not_emitted", pass: boundary.authorization_phrase_emitted === false },
      { check: "observed_text_not_echoed", pass: true }
    ],
    boundary,
    note: "Step 7 consent refusal preview is hold-only. It emits no authorization phrase, grants no authority, writes no receipt, and starts no runtime."
  });
}
