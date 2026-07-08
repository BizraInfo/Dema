/**
 * PLAN-BRANCH-PREVIEW-1A
 *
 * Pure preview-only Materialization Pulse planning kernel.
 *
 * Purpose:
 *   Preserve candidate plan branches, one chosen branch, and rejected branches
 *   as content-addressed evidence before FATE or execution.
 *
 * Law:
 *   Rejected branches are evidence. A safe system must remember what it refused,
 *   not only what it chose. (Materialization Pulse Step 2 · pi.dev-shape branch tree.)
 *
 * Boundary:
 *   No execution. No model invocation. No network. No filesystem. No daemon.
 *   No wallet. No mint. No federation. No live URP. authority_delta = 0.
 *
 * Pure kernel: no fs / network / process / clock / random.
 */

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const PLAN_BRANCH_PREVIEW_SCHEMA = "bizra.dema.plan_branch_preview.v0.1";
export const PLAN_BRANCH_PREVIEW_TRUTH_LABEL = "PLAN_BRANCH_PREVIEW_MEASURED_REPO";
export const PLAN_BRANCH_PREVIEW_GO_PHRASE = "GO: build plan branch preview";

export const PLAN_BRANCH_REJECTION_REASONS = Object.freeze([
  "higher_risk",
  "weaker_evidence",
  "higher_cost",
  "lower_ihsan",
  "consent_gap",
  "scope_violation",
  "overclaim_risk",
  "unsafe_boundary",
]);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashBody(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function canonicalBranchId(id) {
  return typeof id === "string" ? id.trim() : "";
}

function isCanonicalAllFalseBoundary(boundary) {
  if (!isObject(boundary)) return false;
  const canonical = buildPreviewBoundary();
  const expected = Object.keys(canonical).sort();
  const actual = Object.keys(boundary).sort();
  if (actual.length !== expected.length) return false;
  return expected.every((key, index) => actual[index] === key && boundary[key] === false);
}

function normalizeBranch(branch) {
  const evidence_refs = asArray(branch?.evidence_refs).filter((x) => typeof x === "string");
  return Object.freeze({
    id: canonicalBranchId(branch?.id),
    title: typeof branch?.title === "string" ? branch.title : "",
    summary: typeof branch?.summary === "string" ? branch.summary : "",
    risk_score: Number.isFinite(branch?.risk_score) ? branch.risk_score : null,
    ihsan_score: Number.isFinite(branch?.ihsan_score) ? branch.ihsan_score : null,
    estimated_cost: Number.isFinite(branch?.estimated_cost) ? branch.estimated_cost : null,
    consent_required: branch?.consent_required === true,
    authority_delta: Number.isFinite(branch?.authority_delta) ? branch.authority_delta : 0,
    evidence_refs: Object.freeze(evidence_refs),
  });
}

function normalizeRejectedBranch(rejected) {
  return Object.freeze({
    branch_id: canonicalBranchId(rejected?.branch_id),
    rejection_reason: typeof rejected?.rejection_reason === "string" ? rejected.rejection_reason : "",
    rejection_basis: typeof rejected?.rejection_basis === "string" ? rejected.rejection_basis : "",
    evidence_refs: Object.freeze(asArray(rejected?.evidence_refs).filter((x) => typeof x === "string")),
  });
}

export function evaluatePlanBranches({ mission_id, niyyah_hash, branches, chosen_branch_id, rejected_branches } = {}) {
  const blocked_by = [];

  if (typeof mission_id !== "string" || mission_id.trim().length === 0) blocked_by.push("mission_id_missing");
  if (typeof niyyah_hash !== "string" || !HASH_RE.test(niyyah_hash)) blocked_by.push("niyyah_hash_malformed");

  const normalizedBranches = asArray(branches).map(normalizeBranch);
  const normalizedRejected = asArray(rejected_branches).map(normalizeRejectedBranch);
  const chosenId = canonicalBranchId(chosen_branch_id);

  if (normalizedBranches.length === 0) blocked_by.push("no_candidate_branches");
  if (!chosenId) blocked_by.push("chosen_branch_missing");

  const ids = normalizedBranches.map((b) => b.id);
  const nonEmptyIds = ids.filter(Boolean);
  if (nonEmptyIds.length !== ids.length) blocked_by.push("branch_id_missing");

  const uniqueIds = new Set(nonEmptyIds);
  if (uniqueIds.size !== nonEmptyIds.length) blocked_by.push("duplicate_branch_id");
  if (chosenId && !uniqueIds.has(chosenId)) blocked_by.push("chosen_branch_not_in_candidates");

  const chosenBranch = normalizedBranches.find((b) => b.id === chosenId) ?? null;
  if (chosenBranch && chosenBranch.authority_delta !== 0) blocked_by.push("chosen_authority_delta_nonzero");

  for (const branch of normalizedBranches) {
    if (branch.authority_delta !== 0) blocked_by.push(`branch_authority_delta_nonzero:${branch.id}`);
    if (branch.risk_score !== null && (branch.risk_score < 0 || branch.risk_score > 1)) {
      blocked_by.push(`risk_score_out_of_range:${branch.id}`);
    }
    if (branch.ihsan_score !== null && (branch.ihsan_score < 0 || branch.ihsan_score > 1)) {
      blocked_by.push(`ihsan_score_out_of_range:${branch.id}`);
    }
  }

  const rejectedIds = new Set();
  for (const rejected of normalizedRejected) {
    if (!rejected.branch_id) blocked_by.push("rejected_branch_id_missing");
    if (rejected.branch_id === chosenId) blocked_by.push("chosen_branch_also_rejected");
    if (rejectedIds.has(rejected.branch_id)) blocked_by.push(`duplicate_rejected_branch:${rejected.branch_id}`);
    rejectedIds.add(rejected.branch_id);
    if (rejected.branch_id && !uniqueIds.has(rejected.branch_id)) {
      blocked_by.push(`rejected_branch_not_in_candidates:${rejected.branch_id}`);
    }
    if (!PLAN_BRANCH_REJECTION_REASONS.includes(rejected.rejection_reason)) {
      blocked_by.push(`rejection_reason_invalid:${rejected.branch_id || "unknown"}`);
    }
    if (!rejected.rejection_basis) {
      blocked_by.push(`rejection_basis_missing:${rejected.branch_id || "unknown"}`);
    }
  }

  const unaccounted = normalizedBranches
    .map((b) => b.id)
    .filter(Boolean)
    .filter((id) => id !== chosenId && !rejectedIds.has(id));
  for (const id of unaccounted) blocked_by.push(`branch_unaccounted:${id}`);

  return Object.freeze({
    ok: blocked_by.length === 0,
    chosen_branch: chosenBranch,
    rejected_count: normalizedRejected.length,
    candidate_count: normalizedBranches.length,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function planPlanBranchPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== PLAN_BRANCH_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!isObject(input)) blocked_by.push("input_not_object");
  else blocked_by.push(...evaluatePlanBranches(input).blocked_by);
  return Object.freeze({
    schema: PLAN_BRANCH_PREVIEW_SCHEMA,
    truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function buildPlanBranchPreviewPayload(input = {}) {
  const normalizedBranches = asArray(input.branches).map(normalizeBranch);
  const normalizedRejected = asArray(input.rejected_branches).map(normalizeRejectedBranch);
  const evaluation = evaluatePlanBranches(input);
  const chosenId = canonicalBranchId(input.chosen_branch_id);
  const chosenBranch = normalizedBranches.find((b) => b.id === chosenId) ?? null;

  const body = {
    schema: PLAN_BRANCH_PREVIEW_SCHEMA,
    truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    mission_id: typeof input.mission_id === "string" ? input.mission_id : null,
    niyyah_hash: typeof input.niyyah_hash === "string" ? input.niyyah_hash : null,
    candidate_count: normalizedBranches.length,
    chosen_branch_id: chosenId || null,
    chosen_branch: chosenBranch,
    rejected_branch_count: normalizedRejected.length,
    rejected_branches: Object.freeze(normalizedRejected),
    candidate_branch_refs: Object.freeze(normalizedBranches.map((b) => hashBody(b))),
    rejected_branch_refs: Object.freeze(normalizedRejected.map((b) => hashBody(b))),
    evaluation_ok: evaluation.ok,
    evaluation_blocked_by: evaluation.blocked_by,
    rejected_branches_are_evidence: true,
    action_allowed: false,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    wallet_used: false,
    federation_live: false,
    model_invocation_performed: false,
    boundary: buildPreviewBoundary(),
    what_this_proves:
      "Candidate, chosen, and rejected plan branches were bound into a preview-only planning receipt: exactly one chosen branch, every non-chosen branch accounted for with a valid rejection reason + basis, and the rejected branches preserved as content-addressed evidence.",
    what_this_does_not_prove:
      "It does not execute the plan, invoke a model, authorize action, verify external truth, mint, use a wallet, federate, or prove live URP.",
  };

  return Object.freeze({ ...body, content_hash: hashBody(body) });
}

export function verifyPlanBranchPreview(payload) {
  if (!isObject(payload)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });

  const blocked_by = [];
  const { content_hash, ...body } = payload;

  if (content_hash !== hashBody(body)) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== PLAN_BRANCH_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== PLAN_BRANCH_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.mode !== "preview_only") blocked_by.push("mode_not_preview_only");
  if (typeof payload.mission_id !== "string" || payload.mission_id.length === 0) blocked_by.push("mission_id_missing");
  if (typeof payload.niyyah_hash !== "string" || !HASH_RE.test(payload.niyyah_hash)) blocked_by.push("niyyah_hash_malformed");
  if (!Number.isInteger(payload.candidate_count) || payload.candidate_count <= 0) blocked_by.push("candidate_count_invalid");
  if (typeof payload.chosen_branch_id !== "string" || payload.chosen_branch_id.length === 0) blocked_by.push("chosen_branch_id_missing");
  if (!isObject(payload.chosen_branch)) blocked_by.push("chosen_branch_missing");
  if (!Array.isArray(payload.rejected_branches)) blocked_by.push("rejected_branches_not_array");
  if (!Array.isArray(payload.candidate_branch_refs)) blocked_by.push("candidate_branch_refs_not_array");
  if (!Array.isArray(payload.rejected_branch_refs)) blocked_by.push("rejected_branch_refs_not_array");
  if (payload.rejected_branches_are_evidence !== true) blocked_by.push("rejected_branches_not_marked_evidence");
  if (payload.evaluation_ok !== true) blocked_by.push("evaluation_not_ok");
  if (!Array.isArray(payload.evaluation_blocked_by)) blocked_by.push("evaluation_blocked_by_not_array");
  else if (payload.evaluation_blocked_by.length !== 0) blocked_by.push("evaluation_has_blocks");
  if (payload.action_allowed !== false) blocked_by.push("action_allowed_true");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.wallet_used !== false) blocked_by.push("wallet_used_true");
  if (payload.federation_live !== false) blocked_by.push("federation_live_true");
  if (payload.model_invocation_performed !== false) blocked_by.push("model_invocation_true");
  if (!isCanonicalAllFalseBoundary(payload.boundary)) blocked_by.push("boundary_not_all_false");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: PLAN_BRANCH_PREVIEW_SCHEMA,
    truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

export function runPlanBranchPreview({ consent, input } = {}) {
  const boundary = buildPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: PLAN_BRANCH_PREVIEW_SCHEMA,
      truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
      status: "blocked",
      authority_delta: 0,
      blocked_by: Object.freeze([...new Set(codes)]),
      boundary,
    });

  const plan = planPlanBranchPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildPlanBranchPreviewPayload(input);
  const verified = verifyPlanBranchPreview(payload);
  if (!verified.ok) return refuse(verified.blocked_by);

  const hashTamper = verifyPlanBranchPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const { content_hash: _d1, ...noHash1 } = { ...payload, authority_delta: 1 };
  const forgedAuthority = verifyPlanBranchPreview({ ...noHash1, content_hash: hashBody(noHash1) });
  const { content_hash: _d2, ...noHash2 } = { ...payload, action_allowed: true };
  const forgedAction = verifyPlanBranchPreview({ ...noHash2, content_hash: hashBody(noHash2) });
  if (hashTamper.ok || forgedAuthority.ok || forgedAction.ok) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: PLAN_BRANCH_PREVIEW_SCHEMA,
    truth_label: PLAN_BRANCH_PREVIEW_TRUTH_LABEL,
    status: "plan_branch_preview_bound",
    mission_id: payload.mission_id,
    niyyah_hash: payload.niyyah_hash,
    chosen_branch_id: payload.chosen_branch_id,
    candidate_count: payload.candidate_count,
    rejected_branch_count: payload.rejected_branch_count,
    rejected_branches_are_evidence: true,
    content_hash: payload.content_hash,
    action_allowed: false,
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    wallet_used: false,
    federation_live: false,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
