// DEMA-SOCRATIC-CRITIC-PROCESS-SUPERVISION-PREVIEW-1A — a constraint-enforcing critic that interrogates
// a proposed hypothesis BEFORE it reaches SAT. It does not ask "can we make this answer better?" — it
// asks "what would make this answer false?".
//
// Role in the spine:  PAT proposes → **Critic interrogates** → SAT verifies → Receipt records.
// The critic raises question pressure only. It does NOT grant authority, does NOT execute actions, does
// NOT claim truth, invokes no model, touches no network. Its output improves the question before SAT.
// Boundary all-false · authority_delta 0 · grants_action false.

import { createHash } from "node:crypto";

export const DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA = "bizra.dema.socratic_critic_process_supervision_preview.v0.1";
export const DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL = "DEMA_SOCRATIC_CRITIC_PREVIEW_MEASURED_REPO";
export const DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE = "GO: dema socratic critic process supervision preview";

// The critic hands off with exactly one of these — never "verified"/"true"; that is SAT's word.
export const CRITIC_STATUSES = Object.freeze([
  "ready_for_sat",
  "needs_revision",
  "blocked_by_missing_evidence",
  "rejected_overclaim",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function demaSocraticCriticPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// The four Socratic gates, expressed as seven deterministic checks over a hypothesis packet.
// A hypothesis packet: { claim, causal_path[], constraints[{id,satisfied}], evidence_refs[], certainty, falsifier }.
export function socraticInterrogate(hypothesis) {
  const h = hypothesis && typeof hypothesis === "object" ? hypothesis : {};
  const blocked_by = [];

  const claim = typeof h.claim === "string" ? h.claim.trim() : "";
  const causal = Array.isArray(h.causal_path) ? h.causal_path : [];
  const constraints = Array.isArray(h.constraints) ? h.constraints : [];
  const evidence = Array.isArray(h.evidence_refs) ? h.evidence_refs : [];
  const certainty = typeof h.certainty === "string" ? h.certainty : "unknown";
  const falsifier = typeof h.falsifier === "string" ? h.falsifier.trim() : "";

  // 1 · clarification — the claim must be non-vacuous.
  if (claim.length < 8) blocked_by.push("vacuous_claim");
  // 2 · constraint — the claim may not violate a declared constraint (system law, consent, repo fact, policy).
  const violated = constraints.filter((c) => c && c.satisfied === false).map((c) => c.id || "unnamed_constraint");
  if (violated.length > 0) blocked_by.push("constraint_violated");
  // 3 · causal path — the intermediate cause→effect steps must be present.
  if (causal.length === 0) blocked_by.push("missing_causal_path");
  // 5 · falsification — there must be a stated falsifier.
  if (!falsifier) blocked_by.push("missing_falsifier");
  // 6 · uncertainty — certainty may not outrun evidence.
  if (certainty === "certain" && evidence.length === 0) blocked_by.push("unsupported_certainty");
  // (missing evidence entirely is a hand-off blocker, not a rejection)
  const no_evidence = evidence.length === 0;

  const gates = Object.freeze({
    clarification_question: claim ? `What exactly is claimed by: "${claim.slice(0, 80)}"?` : null,
    constraint_check: Object.freeze({ declared: constraints.length, violated: Object.freeze(violated) }),
    causal_path_probe: causal.length ? `Explain each of the ${causal.length} step(s) cause→effect.` : null,
    counterexample_generation: claim ? `Name one observation under which "${claim.slice(0, 60)}" is false.` : null,
    falsification_condition: falsifier || null,
    uncertainty_label: certainty,
    verified_vs_inferred_split: Object.freeze({
      verified: evidence.length, // what evidence backs (SAT will confirm)
      inferred: causal.length, // what is reasoned, not yet confirmed
      unknown: falsifier ? 0 : 1, // no falsifier ⇒ an unknown remains
    }),
  });

  // Status: rejection outranks revision outranks missing-evidence outranks ready.
  let status;
  if (violated.length > 0 || blocked_by.includes("unsupported_certainty")) status = "rejected_overclaim";
  else if (blocked_by.includes("vacuous_claim")) status = "needs_revision";
  else if (blocked_by.includes("missing_causal_path") || blocked_by.includes("missing_falsifier") || no_evidence) {
    status = "blocked_by_missing_evidence";
  } else status = "ready_for_sat";

  return Object.freeze({
    schema: DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
    truth_label: DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
    gates,
    status,
    blocked_by: Object.freeze(blocked_by),
    // The critic raises question pressure only — it never grants authority or claims truth.
    grants_action: false,
    claims_truth: false,
    authority_delta: 0,
    boundary: demaSocraticCriticPreviewBoundary(),
  });
}

function hypothesisBlocks(input) {
  const b = [];
  if (!input || typeof input !== "object") {
    b.push("input_not_object");
    return b;
  }
  if (typeof input.claim !== "string") b.push("missing_claim");
  if (!Array.isArray(input.constraints)) b.push("missing_constraints");
  return b;
}

export function planDemaSocraticCriticPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_SOCRATIC_CRITIC_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  for (const code of hypothesisBlocks(input)) blocked_by.push(code);
  return Object.freeze({
    schema: DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
    truth_label: DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDemaSocraticCriticPreviewPayload(input) {
  const body = socraticInterrogate(input);
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyDemaSocraticCriticPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.claims_truth !== false) blocked_by.push("claims_truth_true");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!CRITIC_STATUSES.includes(payload.status)) blocked_by.push("unknown_status");
  const canonicalKeys = Object.keys(demaSocraticCriticPreviewBoundary());
  const pb = payload.boundary;
  if (!pb || typeof pb !== "object" || Object.keys(pb).length !== canonicalKeys.length || canonicalKeys.some((k) => pb[k] !== false)) {
    blocked_by.push("boundary_not_all_false");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
    truth_label: DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
    content_hash,
    boundary: demaSocraticCriticPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runDemaSocraticCriticPreview({ consent, input } = {}) {
  const plan = planDemaSocraticCriticPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
      truth_label: DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
      boundary: demaSocraticCriticPreviewBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaSocraticCriticPreviewPayload(input);
  const verdict = verifyDemaSocraticCriticPreview(payload);
  const tampered = { ...payload, grants_action: true };
  const tamperCaught = verifyDemaSocraticCriticPreview(tampered).ok === false;
  const blocked_by = [];
  if (!verdict.ok) blocked_by.push(...verdict.blocked_by);
  if (!tamperCaught) blocked_by.push("tamper_not_detected");
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_SOCRATIC_CRITIC_PREVIEW_SCHEMA,
    truth_label: DEMA_SOCRATIC_CRITIC_PREVIEW_TRUTH_LABEL,
    critic_status: payload.status,
    content_hash: payload.content_hash,
    boundary: demaSocraticCriticPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
