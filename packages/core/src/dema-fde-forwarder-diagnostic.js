// DEMA-FDE-FORWARDER-DIAGNOSTIC-1A — Route a completed FDE dual-diagnostic report to a
// single fail-closed forwarding destination under the Diagnostic Doxology; routing
// proposes, never executes.
//
// PREVIEW_ONLY routing derivation — NOT a runtime, NOT a dispatcher, NOT a queue,
// NOT model invocation. The forwarder reads an upstream fde_dual_diagnostic report
// (declared fields only, bound by its diagnostic_hash) and derives ONE destination
// proposal. Every destination is a proposal for a human; nothing is executed,
// patched, minted, or transmitted.
//
// Pure kernel: no fs / network / process / clock / random. crypto.createHash only,
// for content addressing. Boundary is all-false; the canonical key set is exported
// so verifiers can reject vacuous (key-omitting) boundaries.

import { createHash } from "node:crypto";

import {
  DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA,
  FDE_FAILURE_CLASSES,
  FDE_MEASURED_STATUSES,
  buildDemaFdeDualDiagnostic,
  defaultDemaFdeDualDiagnosticFixture,
} from "./dema-fde-dual-diagnostic.js";

export const DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA =
  "bizra.dema.fde_forwarder_diagnostic.v0.1";
export const DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL =
  "DEMA_FDE_FORWARDER_DIAGNOSTIC_MEASURED_REPO";
export const DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE =
  "GO: dema fde forwarder diagnostic preview";

// The Diagnostic Doxology — verbatim routing law. Rules are cited by id in
// derived routings; the table itself never changes at runtime.
export const DEMA_FDE_FORWARDER_DOXOLOGY = Object.freeze([
  Object.freeze({ rule_id: "R1", text: "If the code failed, patch the code." }),
  Object.freeze({ rule_id: "R2", text: "If the proof failed, repair the proof." }),
  Object.freeze({ rule_id: "R3", text: "If the world failed, repair the environment." }),
  Object.freeze({ rule_id: "R4", text: "If consent is missing, stop." }),
  Object.freeze({ rule_id: "R5", text: "If impact is simulated, do not mint." }),
  Object.freeze({ rule_id: "R6", text: "If cost is measured, do not call it value." }),
  Object.freeze({
    rule_id: "R7",
    text: "If CI is unavailable, do not call it code failure.",
  }),
  Object.freeze({
    rule_id: "R8",
    text: "If the phone is not registered, do not pretend it is connected.",
  }),
]);

// Every destination is a PROPOSAL name. There is deliberately no destination for
// mint, execute, autopatch, deploy, or merge — such a destination cannot be routed
// to because it does not exist in the vocabulary.
export const FDE_FORWARD_DESTINATIONS = Object.freeze([
  "patch_code_proposal",
  "repair_proof_proposal",
  "repair_environment_proposal",
  "ci_unavailable_operator_action",
  "halt_boundary_violation",
  "insufficient_evidence_stop",
]);

export const FDE_FORWARD_CHANNEL_STATUSES = Object.freeze([
  "NO_CHANNEL",
  "DECLARED_REGISTERED_NOT_VERIFIED",
  "UNREGISTERED_NOT_CONNECTED",
]);

const DIAGNOSTIC_HASH_RE = /^sha256:[0-9a-f]{64}$/;

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

function freezeDeep(value) {
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) freezeDeep(value[key]);
    return Object.freeze(value);
  }
  return value;
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export const FDE_FORWARDER_BOUNDARY_KEYS = Object.freeze([
  "execution_allowed",
  "daemon_started",
  "network_used",
  "token_minted",
  "wallet_accessed",
  "live_execution_performed",
  "file_mutation_performed",
  "model_invocation_performed",
]);

export function demaFdeForwarderDiagnosticBoundary() {
  const boundary = {};
  for (const key of FDE_FORWARDER_BOUNDARY_KEYS) boundary[key] = false;
  return Object.freeze(boundary);
}

// A boundary is all-false ONLY when it carries exactly the canonical key set with
// every value false. `Object.values(b).every(v => v === false)` is vacuously true
// for `{}` — never use it.
function boundaryIsCanonicalAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const keys = Object.keys(boundary).sort();
  const canonical = [...FDE_FORWARDER_BOUNDARY_KEYS].sort();
  if (keys.length !== canonical.length) return false;
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== canonical[i]) return false;
  }
  return FDE_FORWARDER_BOUNDARY_KEYS.every((k) => boundary[k] === false);
}

// Positive validation + normalization. Declared fields only — the forwarder never
// infers a failure class, a channel state, or an impact claim. Returns
// { blocked_by, normalized }; normalized is null unless blocked_by is empty.
export function validateDemaFdeForwarderInput(input) {
  const blocked_by = [];
  if (!input || typeof input !== "object") {
    return freezeDeep({ blocked_by: ["input_not_object"], normalized: null });
  }

  const report = input.fde_report;
  if (!report || typeof report !== "object") {
    blocked_by.push("fde_report_missing");
  } else {
    if (report.schema !== DEMA_FDE_DUAL_DIAGNOSTIC_SCHEMA) {
      blocked_by.push("fde_report_schema_mismatch");
    }
    if (!FDE_FAILURE_CLASSES.includes(report.failure_class)) {
      blocked_by.push("fde_report_failure_class_unknown");
    }
    if (!FDE_MEASURED_STATUSES.includes(report.measured_status)) {
      blocked_by.push("fde_report_measured_status_unknown");
    }
    if (
      typeof report.diagnostic_hash !== "string" ||
      !DIAGNOSTIC_HASH_RE.test(report.diagnostic_hash)
    ) {
      blocked_by.push("fde_report_diagnostic_hash_malformed");
    }
    if (report.consent_required !== true) {
      blocked_by.push("fde_report_consent_not_required");
    }
    if (report.eligible_for_autopatch !== false) {
      blocked_by.push("autopatch_claim_rejected");
    }
    if (
      report.code_implicated !== null &&
      report.code_implicated !== true &&
      report.code_implicated !== false &&
      report.code_implicated !== undefined
    ) {
      blocked_by.push("fde_report_code_implicated_invalid");
    }
    if (
      report.failure_class === "github_actions_billing_lock" &&
      report.code_implicated === true
    ) {
      // R7: CI unavailability may never be laundered into a code failure.
      blocked_by.push("billing_lock_code_implicated_contradiction");
    }
  }

  const channel = input.channel;
  if (channel !== undefined) {
    if (
      !channel ||
      typeof channel !== "object" ||
      typeof channel.name !== "string" ||
      channel.name.trim() === "" ||
      typeof channel.registered !== "boolean"
    ) {
      blocked_by.push("channel_shape_invalid");
    }
  }

  const impact = input.impact;
  if (impact !== undefined) {
    if (!impact || typeof impact !== "object" || typeof impact.simulated !== "boolean") {
      blocked_by.push("impact_shape_invalid");
    }
  }

  const cost = input.cost;
  if (cost !== undefined) {
    if (
      !cost ||
      typeof cost !== "object" ||
      typeof cost.measured !== "boolean" ||
      (cost.description !== undefined && typeof cost.description !== "string")
    ) {
      blocked_by.push("cost_shape_invalid");
    }
  }

  if (blocked_by.length > 0) {
    return freezeDeep({ blocked_by, normalized: null });
  }

  const normalized = {
    fde_report: {
      schema: report.schema,
      failure_class: report.failure_class,
      measured_status: report.measured_status,
      diagnostic_hash: report.diagnostic_hash,
      consent_required: true,
      eligible_for_autopatch: false,
      code_implicated:
        report.code_implicated === undefined ? null : report.code_implicated,
    },
    channel:
      channel === undefined
        ? null
        : { name: channel.name.trim(), registered: channel.registered },
    impact: impact === undefined ? null : { simulated: impact.simulated },
    cost:
      cost === undefined
        ? null
        : {
            measured: cost.measured,
            description: cost.description === undefined ? null : cost.description,
          },
  };
  return freezeDeep({ blocked_by: [], normalized });
}

// Deterministic routing under the Doxology. Precedence (first match wins):
// boundary_violation > github_actions_billing_lock > insufficient evidence
// (unknown class OR UNKNOWN status) > inward code > inward proof > outward world.
export function deriveDemaFdeForwardRouting(normalized) {
  const { fde_report } = normalized;
  const cls = fde_report.failure_class;

  let destination;
  let fired_doxology_rules;
  let rationale;

  if (cls === "boundary_violation") {
    destination = "halt_boundary_violation";
    fired_doxology_rules = ["R4"];
    rationale =
      "A constitutional boundary was implicated upstream; the only lawful forward is stop.";
  } else if (cls === "github_actions_billing_lock") {
    destination = "ci_unavailable_operator_action";
    fired_doxology_rules = ["R7"];
    rationale =
      "CI was unavailable; this is not a code failure and may not be forwarded as one.";
  } else if (cls === "unknown" || fde_report.measured_status === "UNKNOWN") {
    destination = "insufficient_evidence_stop";
    fired_doxology_rules = ["R4"];
    rationale =
      "Evidence is insufficient to name a failure; forwarding an unmeasured diagnosis is zann — stop.";
  } else if (cls === "implementation_defect" || cls === "test_drift") {
    destination = "patch_code_proposal";
    fired_doxology_rules = ["R1"];
    rationale = "The code failed; propose patching the code.";
  } else if (cls === "proof_gap" || cls === "doc_drift") {
    destination = "repair_proof_proposal";
    fired_doxology_rules = ["R2"];
    rationale = "The proof surface failed; propose repairing the proof.";
  } else {
    // environment_gap | dependency_gap | permission_gap
    destination = "repair_environment_proposal";
    fired_doxology_rules = ["R3"];
    rationale = "The world failed; propose repairing the environment.";
  }

  const code_implicated_forwarded =
    cls === "github_actions_billing_lock" ? false : fde_report.code_implicated;

  return freezeDeep({
    destination,
    fired_doxology_rules,
    rationale,
    proposal_only: true,
    executed: false,
    consent_required_downstream: true,
    code_implicated_forwarded,
  });
}

// Always-on Doxology guards (R5, R6, R8) — these hold on EVERY routing, not just
// when the matching input is present.
export function deriveDemaFdeForwardGuards(normalized) {
  const channel = normalized.channel;
  let channel_status;
  if (channel === null) {
    channel_status = "NO_CHANNEL";
  } else if (channel.registered === true) {
    // Registration is declared, never verified here — no connectivity claim.
    channel_status = "DECLARED_REGISTERED_NOT_VERIFIED";
  } else {
    channel_status = "UNREGISTERED_NOT_CONNECTED";
  }

  return freezeDeep({
    mint_blocked: true,
    simulated_impact_declared: normalized.impact === null ? false : normalized.impact.simulated,
    cost_forwarded_as:
      normalized.cost !== null && normalized.cost.measured
        ? "cost_only_never_value"
        : "no_measured_cost_declared",
    connected_claim_made: false,
    channel_status,
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planDemaFdeForwarderDiagnostic({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_FDE_FORWARDER_DIAGNOSTIC_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  const validation = validateDemaFdeForwarderInput(input);
  blocked_by.push(...validation.blocked_by);
  return Object.freeze({
    schema: DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
    truth_label: DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Throws on invalid input — a payload over
// an unvalidated input must not exist.
export function buildDemaFdeForwarderDiagnosticPayload(input) {
  const validation = validateDemaFdeForwarderInput(input);
  if (validation.blocked_by.length > 0) {
    throw new Error(`invalid_input:${validation.blocked_by.join(",")}`);
  }
  const normalized = validation.normalized;
  const body = {
    schema: DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
    truth_label: DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
    input: normalized,
    routing: deriveDemaFdeForwardRouting(normalized),
    doxology_guards: deriveDemaFdeForwardGuards(normalized),
    boundary: demaFdeForwarderDiagnosticBoundary(),
    what_this_proves: [
      "A completed FDE dual-diagnostic report can be routed to exactly one fail-closed proposal destination by deterministic Doxology rules.",
      "Mint, execution, autopatch, and connectivity claims are structurally unreachable: no such destination exists in the vocabulary and the guards hold on every routing.",
    ],
    what_this_does_not_prove: [
      "The forwarder does not execute, patch, transmit, mint, or verify channel connectivity; a destination is a proposal for a human, not an action.",
      "Routing correctness does not prove the upstream diagnosis is ground truth.",
    ],
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return freezeDeep({ ...body, content_hash });
}

// Body-bound re-derivation verifier. Two independent checks:
//  1. hash recompute over the body minus content_hash (tamper without recompute);
//  2. WHOLE-body re-derivation from payload.input (forge-AND-recompute: a
//     self-consistent forged routing still fails because the body must equal what
//     the kernel derives from the same input).
export function verifyDemaFdeForwarderDiagnostic(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return freezeDeep({ ok: false, blocked_by: ["payload_not_object"] });
  }
  if (payload.schema !== DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA) {
    blocked_by.push("schema_mismatch");
  }
  if (payload.truth_label !== DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL) {
    blocked_by.push("truth_label_mismatch");
  }
  if (!boundaryIsCanonicalAllFalse(payload.boundary)) {
    blocked_by.push("boundary_not_canonical_all_false");
  }
  if (typeof payload.content_hash !== "string") {
    blocked_by.push("content_hash_missing");
  } else {
    const { content_hash, ...bodyWithoutHash } = payload;
    const recomputed = `sha256:${sha256(stableStringify(bodyWithoutHash))}`;
    if (recomputed !== content_hash) {
      blocked_by.push("content_hash_mismatch");
    }
  }

  if (blocked_by.length === 0) {
    let rederived;
    try {
      rederived = buildDemaFdeForwarderDiagnosticPayload(payload.input);
    } catch {
      rederived = null;
      blocked_by.push("input_rederivation_rejected");
    }
    if (rederived && stableStringify(rederived) !== stableStringify(payload)) {
      blocked_by.push("body_rederivation_mismatch");
    }
  }

  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

// Canonical fixture: a REAL upstream report built by the FDE kernel from its own
// default fixture — the forwarder is proven against the true upstream shape, not a
// hand-typed imitation.
export function defaultDemaFdeForwarderDiagnosticFixture() {
  const upstream = buildDemaFdeDualDiagnostic(defaultDemaFdeDualDiagnosticFixture());
  return freezeDeep({
    fde_report: {
      schema: upstream.schema,
      failure_class: upstream.failure_class,
      measured_status: upstream.measured_status,
      diagnostic_hash: upstream.diagnostic_hash,
      consent_required: upstream.consent_required,
      eligible_for_autopatch: upstream.eligible_for_autopatch,
      code_implicated: upstream.code_implicated,
    },
    channel: { name: "local-terminal", registered: false },
    impact: { simulated: true },
    cost: { measured: true, description: "proof-loop hours, cost only" },
  });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
export function runDemaFdeForwarderDiagnostic({ consent, input } = {}) {
  const boundary = demaFdeForwarderDiagnosticBoundary();
  const plan = planDemaFdeForwarderDiagnostic({ consent, input });
  if (!plan.eligible) {
    return freezeDeep({
      ok: false,
      schema: DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
      truth_label: DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
      blocked_by: [...plan.blocked_by],
      boundary,
    });
  }

  const payload = buildDemaFdeForwarderDiagnosticPayload(input);
  const verdict = verifyDemaFdeForwarderDiagnostic(payload);
  const blocked_by = [...verdict.blocked_by];

  if (verdict.ok) {
    const hashTamper = verifyDemaFdeForwarderDiagnostic({
      ...payload,
      content_hash: `sha256:${"0".repeat(64)}`,
    });
    if (hashTamper.ok) blocked_by.push("tamper_probe_hash_not_rejected");
    const fieldTamper = verifyDemaFdeForwarderDiagnostic({
      ...payload,
      truth_label: "FORGED",
    });
    if (fieldTamper.ok) blocked_by.push("tamper_probe_field_not_rejected");
  }

  return freezeDeep({
    ok: blocked_by.length === 0,
    schema: DEMA_FDE_FORWARDER_DIAGNOSTIC_SCHEMA,
    truth_label: DEMA_FDE_FORWARDER_DIAGNOSTIC_TRUTH_LABEL,
    content_hash: payload.content_hash,
    destination: payload.routing.destination,
    boundary,
    blocked_by,
  });
}
