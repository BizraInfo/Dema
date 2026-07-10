// DEMA-SKILLOPT-EDIT-LEDGER-PREVIEW-1A — PREVIEW_ONLY ledger recording SkillOpt-style
// skill-document edit-optimization attempts; fail-closed on authority expansion.
//
// PREVIEW_ONLY. NOT the live SkillOpt optimizer, NOT agent RL, NOT a runtime skill
// promoter, NOT ML. Motivation only: arXiv:2605.23904 "SkillOpt: Executive Strategy
// for Self-Evolving Agent Skills" (text-space optimizer — bounded add/delete/replace
// edits to one skill document, accepted only on strict held-out improvement). This
// kernel does NOT run that optimizer, does NOT call a model, does NOT edit any skill,
// and does NOT promote anything. It only *records* an edit-attempt as a
// content-addressed receipt and fails closed if the attempt claims any authority /
// boundary / consent / honesty-map change. Distinct from agent-skill-ledger.js
// (AGENT-SKILL-1A = agent XP progression) — this is skill-DOCUMENT edit attempts.
//
// Core law: skills may improve; authority may not self-expand.
//
// Pure kernel: no fs / network / process / clock / random. Only node:crypto for
// content addressing (universal). Boundary is all-false; every claim is a preview.

import { createHash } from "node:crypto";

export const DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA = "bizra.dema.dema_skillopt_edit_ledger_preview.v0.1";
export const DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL = "DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_ONLY";
export const DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE = "GO: dema skillopt edit ledger preview 1a";

const EDIT_TYPES = Object.freeze(["add", "delete", "replace"]);
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function isStringArray(v) {
  return Array.isArray(v) && v.every(isNonEmptyString);
}

// All-false boundary invariant. Flipping any key is an execution/authority claim.
export function demaSkilloptEditLedgerPreviewBoundary() {
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

// Positive validation of one skill-edit ledger entry. Returns named blocks; empty
// array = well-formed. Absence of a block is NEVER validation — every precondition
// is checked positively. Shared by plan (pre) and verify (re-derivation).
export function validateSkilloptEditEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return ["input_not_object"];
  }
  const blocked_by = [];

  if (!isNonEmptyString(entry.skill_id)) blocked_by.push("skill_id_invalid");
  if (!isNonEmptyString(entry.skill_version)) blocked_by.push("skill_version_invalid");
  if (!HASH_RE.test(entry.base_skill_hash ?? "")) blocked_by.push("base_skill_hash_invalid");
  if (!HASH_RE.test(entry.candidate_skill_hash ?? "")) blocked_by.push("candidate_skill_hash_invalid");
  if (!EDIT_TYPES.includes(entry.edit_type)) blocked_by.push("edit_type_invalid");
  if (!isFiniteNumber(entry.edit_budget) || entry.edit_budget < 0) blocked_by.push("edit_budget_invalid");
  if (!isStringArray(entry.training_rollout_refs)) blocked_by.push("training_rollout_refs_invalid");
  if (!Array.isArray(entry.heldout_validation_refs) || !entry.heldout_validation_refs.every(isNonEmptyString)) {
    blocked_by.push("heldout_validation_refs_invalid");
  }
  if (!isFiniteNumber(entry.score_before)) blocked_by.push("score_before_invalid");
  if (!isFiniteNumber(entry.score_after)) blocked_by.push("score_after_invalid");
  if (typeof entry.accepted !== "boolean") blocked_by.push("accepted_invalid");

  // Constitutional core — fail closed. A skill edit may improve the doc, but it may
  // NOT expand authority, nor silently move any boundary / consent / honesty surface.
  if (entry.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (entry.boundary_unchanged !== true) blocked_by.push("boundary_changed");
  if (entry.consent_unchanged !== true) blocked_by.push("consent_changed");
  if (entry.current_limits_unchanged !== true) blocked_by.push("current_limits_changed");

  // Acceptance requires cited held-out validation refs (the acceptance evidence).
  // Rejection requires a stated reason (the rejected-edit buffer stores WHY).
  // ponytail: this preview records score_before/after but does NOT enforce
  // score_after > score_before; the strict-improvement acceptance rule is a future
  // invariant (needs an independent held-out anchor) — see receipt "does not prove".
  if (entry.accepted === true) {
    if (!Array.isArray(entry.heldout_validation_refs) || entry.heldout_validation_refs.length === 0) {
      blocked_by.push("accepted_without_heldout_validation");
    }
  } else if (entry.accepted === false) {
    if (!isNonEmptyString(entry.rejected_edit_reason)) {
      blocked_by.push("rejected_without_reason");
    }
  }
  return blocked_by;
}

// Fail-closed plan. Exact GO-phrase byte match — no fuzzy consent.
export function planDemaSkilloptEditLedgerPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...validateSkilloptEditEntry(input));
  return Object.freeze({
    schema: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA,
    truth_label: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, whitelisted ledger entry. Only known fields are carried (no smuggling
// of extra keys into the hashed body). receipt_hash/content_hash are DERIVED, never
// caller-supplied — so the hash binds the body, not a circular self-reference.
function normalizeEntry(input) {
  const e = input && typeof input === "object" ? input : {};
  return Object.freeze({
    skill_id: e.skill_id ?? null,
    skill_version: e.skill_version ?? null,
    base_skill_hash: e.base_skill_hash ?? null,
    candidate_skill_hash: e.candidate_skill_hash ?? null,
    edit_type: e.edit_type ?? null,
    edit_budget: e.edit_budget ?? null,
    training_rollout_refs: Object.freeze(Array.isArray(e.training_rollout_refs) ? [...e.training_rollout_refs] : []),
    heldout_validation_refs: Object.freeze(Array.isArray(e.heldout_validation_refs) ? [...e.heldout_validation_refs] : []),
    score_before: e.score_before ?? null,
    score_after: e.score_after ?? null,
    accepted: typeof e.accepted === "boolean" ? e.accepted : null,
    rejected_edit_reason: e.rejected_edit_reason ?? null,
    authority_delta: e.authority_delta ?? null,
    boundary_unchanged: e.boundary_unchanged ?? null,
    consent_unchanged: e.consent_unchanged ?? null,
    current_limits_unchanged: e.current_limits_unchanged ?? null,
  });
}

// Content-addressed receipt. content_hash binds the whole body; receipt_hash is an
// alias of it (the ledger's address of this attempt).
export function buildDemaSkilloptEditLedgerPreviewPayload(input) {
  const body = {
    schema: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA,
    truth_label: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL,
    ledger_entry: normalizeEntry(input),
    boundary: demaSkilloptEditLedgerPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash, receipt_hash: content_hash });
}

// Body-bound re-derivation verifier. Recompute the hash over the body MINUS its two
// derived hash fields; any mismatch rejects. Then re-run the entry invariants so a
// self-consistent-but-illegal payload (e.g. authority_delta > 0) also fails closed.
export function verifyDemaSkilloptEditLedgerPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, reasons: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, receipt_hash, ...body } = payload;
  const recomputed = `sha256:${sha256(stableStringify(body))}`;
  const reasons = [];
  if (content_hash !== recomputed) reasons.push("content_hash_mismatch");
  if (receipt_hash !== content_hash) reasons.push("receipt_hash_mismatch");
  reasons.push(...validateSkilloptEditEntry(body.ledger_entry));
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
// Boundary stays all-false: recording an attempt is never executing it.
export function runDemaSkilloptEditLedgerPreview({ consent, input } = {}) {
  const boundary = demaSkilloptEditLedgerPreviewBoundary();
  const base = {
    schema: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_SCHEMA,
    truth_label: DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_TRUTH_LABEL,
    boundary,
  };

  const plan = planDemaSkilloptEditLedgerPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({ ...base, ok: false, blocked_by: plan.blocked_by });
  }

  const payload = buildDemaSkilloptEditLedgerPreviewPayload(input);
  const verified = verifyDemaSkilloptEditLedgerPreview(payload);
  if (!verified.ok) {
    return Object.freeze({ ...base, ok: false, blocked_by: verified.reasons });
  }

  // Closed-loop self-check: a tampered attempt MUST be rejected or the gate lies.
  const tampered = {
    ...payload,
    ledger_entry: { ...payload.ledger_entry, authority_delta: 1 },
  };
  if (verifyDemaSkilloptEditLedgerPreview(tampered).ok) {
    return Object.freeze({ ...base, ok: false, blocked_by: Object.freeze(["tamper_not_rejected"]) });
  }

  return Object.freeze({
    ...base,
    ok: true,
    content_hash: payload.content_hash,
    receipt_hash: payload.receipt_hash,
    blocked_by: Object.freeze([]),
  });
}
