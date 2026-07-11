// DEMA-FDE-ISNAD-REPLAY-CAPSULE-PREVIEW-0A — PREVIEW_ONLY.
//
// A content-addressed capsule that preserves WHY a mission stopped and WHERE each
// claim came from — not only WHAT happened — and replays that verdict from the
// capsule ALONE, without the model. It composes four already-shipped pieces:
//   (a) evidence references (hashes only),
//   (b) an Isnād lineage for each claim (origin → … → verifier → status),
//   (c) an FDE failure diagnosis (dema-fde-dual-diagnostic vocabulary), and
//   (d) a routing decision ("Doxology route") DERIVED from the diagnosis,
// all under authority-monotonicity: a failure may never increase authority.
//
// Pure kernel: no fs / net / http / child_process / fetch, no Date.now, no
// Math.random, no model invocation — node:crypto (sha256) only. Content addressing
// binds the whole body; the routing is a pure function of the diagnosis + evidence,
// so replayCapsule re-derives the route + verdict from the capsule body alone (the
// mission survives the model). Boundary is the canonical all-false preview boundary;
// every claim is a preview. execution_allowed and mint_allowed are false always.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./boundary-schema.js";
import { FDE_FAILURE_CLASSES } from "./dema-fde-dual-diagnostic.js";

export const FDE_ISNAD_REPLAY_CAPSULE_SCHEMA =
  "bizra.dema.fde_isnad_replay_capsule.v0.1";
export const FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA =
  "bizra.dema.fde_isnad_replay_capsule_eval.v0.1";
export const FDE_ISNAD_REPLAY_CAPSULE_REPLAY_SCHEMA =
  "bizra.dema.fde_isnad_replay_capsule_replay.v0.1";
export const FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL = "PREVIEW_ONLY";

// The Isnād roles a lineage step may carry. Mirrors an isnād chain: where the claim
// came FROM (origin), when it first appeared, who/what authored it, how it was
// transformed, the supporting evidence and counter-evidence, who verified it, and
// its final status.
export const LINEAGE_ROLES = Object.freeze([
  "origin",
  "first_appearance",
  "author_or_model",
  "transformation",
  "evidence",
  "counterevidence",
  "verifier",
  "status",
]);

// The diagnosis vocabulary IS the FDE dual-diagnostic vocabulary — mirrored, not
// reinvented. A capsule diagnosis must be one of these classes.
export const DIAGNOSIS_CLASSES = FDE_FAILURE_CLASSES;

// The routing ("Doxology route") vocabulary. Every route is a bounded next-move
// proposal — never an executor.
export const CAPSULE_ROUTES = Object.freeze([
  "patch_proposal",
  "proof_repair_proposal",
  "operator_or_environment_repair",
  "stop",
  "insufficient_evidence_stop",
]);

// The whitelisted capsule body key set. Anything else in the input is dropped — no
// raw evidence text, no private key, no smuggled fields reach the hashed body.
export const EXPECTED_CAPSULE_KEYS = Object.freeze([
  "schema",
  "truth_label",
  "event_hash",
  "source_lineage",
  "source_lineage_hash",
  "diagnosis",
  "diagnosis_hash",
  "route",
  "route_hash",
  "authority_delta",
  "execution_allowed",
  "mint_allowed",
  "replay_exact",
  "capsule_hash",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// hashText addresses a single enum/string value (diagnosis, route) directly.
function hashText(value) {
  return `sha256:${sha256(String(value))}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// hashBody addresses a structured value (the lineage array, the whole capsule body).
function hashBody(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function str(value) {
  if (typeof value === "string") return value;
  return value == null ? "" : String(value);
}

// Whitelist each lineage step to exactly {step, ref_hash, role} — any smuggled
// raw_text / private_key / extra field is dropped here.
function normalizeLineage(lineage) {
  const arr = Array.isArray(lineage) ? lineage : [];
  return arr.map((s, i) => ({
    step: Number.isInteger(s?.step) ? s.step : i,
    ref_hash: str(s?.ref_hash),
    role: str(s?.role),
  }));
}

function hasEvidenceStep(lineage) {
  return lineage.some((s) => s.role === "evidence");
}

// The pure routing map. The routing is DERIVED from the diagnosis + whether the
// lineage carries evidence:
//   - boundary_violation has HIGHEST precedence → stop (wins over any other class);
//   - without an evidence step a repair cannot be justified → insufficient_evidence_stop;
//   - implementation_defect / test_drift → patch_proposal (inward code fix proposal);
//   - proof_gap / doc_drift → proof_repair_proposal;
//   - environment_gap / dependency_gap / permission_gap (outward) →
//     operator_or_environment_repair — an outward failure NEVER routes to a code patch;
//   - github_actions_billing_lock is an outward vendor failure → operator_or_environment_repair;
//   - unknown / any unmapped class → insufficient_evidence_stop (fail closed).
export function deriveCapsuleRoute(diagnosis, hasEvidence) {
  if (diagnosis === "boundary_violation") return "stop";
  if (!hasEvidence) return "insufficient_evidence_stop";
  switch (diagnosis) {
    case "implementation_defect":
    case "test_drift":
      return "patch_proposal";
    case "proof_gap":
    case "doc_drift":
      return "proof_repair_proposal";
    case "environment_gap":
    case "dependency_gap":
    case "permission_gap":
    case "github_actions_billing_lock":
      return "operator_or_environment_repair";
    default:
      return "insufficient_evidence_stop";
  }
}

// All-false canonical preview boundary. Composing a capsule is never executing it.
export function fdeIsnadReplayCapsuleBoundary() {
  return buildPreviewBoundary();
}

// Content-address a capsule body from its semantic fields. Re-derives every sub-hash
// (source_lineage_hash, diagnosis_hash, route_hash) and the whole-body capsule_hash.
// It does NOT re-derive `route` or force the effect guards — callers own those — so
// tests and the review gate can seal a forged capsule (a wrong route, a flipped
// guard) and prove the verifier still catches it independent of the hashes.
export function sealCapsuleBody(fields = {}) {
  const source_lineage = normalizeLineage(fields.source_lineage);
  const diagnosis = str(fields.diagnosis);
  const route = str(fields.route);
  const body = {
    schema: FDE_ISNAD_REPLAY_CAPSULE_SCHEMA,
    truth_label: FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
    event_hash: str(fields.event_hash),
    source_lineage,
    source_lineage_hash: hashBody(source_lineage),
    diagnosis,
    diagnosis_hash: hashText(diagnosis),
    route,
    route_hash: hashText(route),
    authority_delta:
      typeof fields.authority_delta === "number" ? fields.authority_delta : 0,
    execution_allowed: fields.execution_allowed === true,
    mint_allowed: fields.mint_allowed === true,
    replay_exact: fields.replay_exact !== false,
  };
  const capsule_hash = hashBody(body);
  return Object.freeze({
    ...body,
    source_lineage: Object.freeze(source_lineage.map((s) => Object.freeze(s))),
    capsule_hash,
  });
}

// Build a content-addressed capsule from injected input. The route is DERIVED — a
// caller-supplied route is ignored. A failure may never grant authority or unlock
// execution/mint, so an input that tries to is REJECTED at construction.
export function buildCapsule(input = {}) {
  const i = input && typeof input === "object" ? input : {};
  if (typeof i.authority_delta === "number" && i.authority_delta > 0) {
    throw new Error(
      "fde_isnad_capsule: authority_delta must be <= 0 (a failure may never increase authority)",
    );
  }
  if (i.execution_allowed === true) {
    throw new Error("fde_isnad_capsule: execution_allowed can never be true");
  }
  if (i.mint_allowed === true) {
    throw new Error("fde_isnad_capsule: mint_allowed can never be true");
  }
  const source_lineage = normalizeLineage(i.source_lineage);
  const diagnosis = str(i.diagnosis) || "unknown";
  const route = deriveCapsuleRoute(diagnosis, hasEvidenceStep(source_lineage));
  return sealCapsuleBody({
    event_hash: str(i.event_hash),
    source_lineage,
    diagnosis,
    route,
    authority_delta: 0,
    execution_allowed: false,
    mint_allowed: false,
    replay_exact: true,
  });
}

// Re-derive the route + verdict from the capsule body ALONE — no model, no external
// input. replay_exact is TRUE only when every content address (each sub-hash, the
// whole-body hash) and the derived route reproduce what the capsule stored. This is
// the "mission survives the model" property: swap the model out, the verdict remains.
export function replayCapsule(capsule) {
  const c = capsule && typeof capsule === "object" ? capsule : {};
  const source_lineage = normalizeLineage(c.source_lineage);
  const diagnosis = str(c.diagnosis);
  const re_derived_route = deriveCapsuleRoute(
    diagnosis,
    hasEvidenceStep(source_lineage),
  );
  const re_derived_source_lineage_hash = hashBody(source_lineage);
  const re_derived_diagnosis_hash = hashText(diagnosis);
  const re_derived_route_hash = hashText(re_derived_route);
  const { capsule_hash: _drop, ...bodyNoHash } = c;
  const re_derived_capsule_hash = hashBody({
    ...bodyNoHash,
    source_lineage,
    source_lineage_hash: re_derived_source_lineage_hash,
    diagnosis,
    diagnosis_hash: re_derived_diagnosis_hash,
    route: re_derived_route,
    route_hash: re_derived_route_hash,
  });
  const replay_exact =
    re_derived_route === str(c.route) &&
    re_derived_source_lineage_hash === str(c.source_lineage_hash) &&
    re_derived_diagnosis_hash === str(c.diagnosis_hash) &&
    re_derived_route_hash === str(c.route_hash) &&
    re_derived_capsule_hash === str(c.capsule_hash);
  return Object.freeze({
    schema: FDE_ISNAD_REPLAY_CAPSULE_REPLAY_SCHEMA,
    truth_label: FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
    re_derived_route,
    stored_route: str(c.route),
    re_derived_source_lineage_hash,
    re_derived_diagnosis_hash,
    re_derived_route_hash,
    re_derived_capsule_hash,
    replay_exact,
    verdict: replay_exact ? "REPLAY_EXACT" : "REPLAY_DRIFT",
    model_used: false,
    boundary: fdeIsnadReplayCapsuleBoundary(),
    authority_delta: 0,
  });
}

// Fail-closed verdict. Accepts a capsule ONLY when every binding holds. Returns
// { schema, accepted, verdict, reason, blocked_by[], boundary(all-false),
// authority_delta:0 }. authority_delta is always 0 — verifying a capsule grants none.
export function verifyCapsule({ capsule } = {}) {
  const boundary = fdeIsnadReplayCapsuleBoundary();
  const base = {
    schema: FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA,
    truth_label: FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
    boundary,
    authority_delta: 0,
  };
  const c = capsule && typeof capsule === "object" ? capsule : null;
  if (!c || c.schema !== FDE_ISNAD_REPLAY_CAPSULE_SCHEMA) {
    return Object.freeze({
      ...base,
      accepted: false,
      verdict: "BLOCK",
      reason: "invalid_schema",
      blocked_by: Object.freeze(["invalid_schema"]),
    });
  }

  const blocked_by = [];
  if (c.truth_label !== FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (str(c.event_hash).length === 0) blocked_by.push("event_hash_missing");

  const source_lineage = Array.isArray(c.source_lineage) ? c.source_lineage : null;
  if (!source_lineage || source_lineage.length === 0) {
    blocked_by.push("source_lineage_missing");
  } else {
    for (const step of source_lineage) {
      if (!LINEAGE_ROLES.includes(str(step?.role))) {
        blocked_by.push(`invalid_lineage_role:${str(step?.role)}`);
      }
      if (str(step?.ref_hash).length === 0) {
        blocked_by.push(`lineage_ref_hash_missing:${str(step?.step)}`);
      }
    }
    if (!hasEvidenceStep(normalizeLineage(source_lineage))) {
      blocked_by.push("missing_evidence");
    }
  }

  if (!DIAGNOSIS_CLASSES.includes(str(c.diagnosis))) {
    blocked_by.push("invalid_diagnosis_class");
  }

  // Content-address integrity: each sub-hash and the whole-body hash must re-derive.
  const normalized = normalizeLineage(c.source_lineage);
  if (hashBody(normalized) !== str(c.source_lineage_hash)) {
    blocked_by.push("source_lineage_hash_mismatch");
  }
  if (hashText(str(c.diagnosis)) !== str(c.diagnosis_hash)) {
    blocked_by.push("diagnosis_hash_mismatch");
  }
  if (hashText(str(c.route)) !== str(c.route_hash)) {
    blocked_by.push("route_hash_mismatch");
  }

  // Forged routing: the route MUST be the route the diagnosis + evidence derive.
  const expectedRoute = deriveCapsuleRoute(
    str(c.diagnosis),
    hasEvidenceStep(normalized),
  );
  if (str(c.route) !== expectedRoute) blocked_by.push("forged_route");

  // Authority monotonicity + effect guards can never be flipped on.
  if (c.authority_delta !== 0) blocked_by.push("authority_delta_not_zero");
  if (c.execution_allowed !== false) blocked_by.push("execution_allowed_not_false");
  if (c.mint_allowed !== false) blocked_by.push("mint_allowed_not_false");

  // Whole-body re-derivation: any field mutated after sealing breaks this.
  const { capsule_hash: _omit, ...bodyNoHash } = c;
  if (str(c.capsule_hash) !== hashBody({ ...bodyNoHash, source_lineage: normalized })) {
    blocked_by.push("capsule_hash_mismatch");
  }

  const accepted = blocked_by.length === 0;
  return Object.freeze({
    ...base,
    accepted,
    verdict: accepted ? "PERMIT_PREVIEW" : "BLOCK",
    reason: accepted ? "fde_isnad_capsule_permitted" : blocked_by[0],
    blocked_by: Object.freeze(blocked_by),
  });
}

// Orchestrator the review gate consumes: build a capsule, permit it, replay it
// model-free, then self-probe that a FORGED route is blocked (proving the routing is
// content-bound, not asserted). Boundary stays all-false; authority_delta stays 0.
export function runFdeIsnadReplayCapsulePreview({ input } = {}) {
  const boundary = fdeIsnadReplayCapsuleBoundary();
  const base = {
    schema: FDE_ISNAD_REPLAY_CAPSULE_EVAL_SCHEMA,
    truth_label: FDE_ISNAD_REPLAY_CAPSULE_TRUTH_LABEL,
    boundary,
    authority_delta: 0,
  };

  const capsule = buildCapsule(input);
  const permit = verifyCapsule({ capsule });
  if (!permit.accepted) {
    return Object.freeze({
      ...base,
      ok: false,
      blocked_by: Object.freeze(["canonical_capsule_not_permitted", ...permit.blocked_by]),
    });
  }

  const replay = replayCapsule(capsule);
  if (!replay.replay_exact) {
    return Object.freeze({ ...base, ok: false, blocked_by: Object.freeze(["replay_not_exact"]) });
  }

  // Self-probe: forge the route to a different valid route and re-seal — the verdict
  // MUST block, or routing is not content-bound.
  const otherRoute = CAPSULE_ROUTES.find((r) => r !== capsule.route);
  const forged = sealCapsuleBody({ ...capsule, route: otherRoute });
  if (verifyCapsule({ capsule: forged }).accepted) {
    return Object.freeze({ ...base, ok: false, blocked_by: Object.freeze(["forged_route_not_blocked"]) });
  }

  return Object.freeze({
    ...base,
    ok: true,
    verdict: permit.verdict,
    capsule_hash: capsule.capsule_hash,
    replay_exact: replay.replay_exact,
    blocked_by: Object.freeze([]),
  });
}
