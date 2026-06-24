// NODE0-ACTIVATION-LADDER-1A — pure activation-ladder status kernel.
//
// Derives each activation-ladder rung's state from CALLER-GATHERED disk
// evidence (presence of its kernel file + an optional feature marker) into a
// deterministic, frozen, truth-labeled report. Zero I/O — the gatherer reads
// the disk; this kernel only classifies and hashes.
//
// PREVIEW_ONLY / LOCAL_ONLY. This is a STATUS MIRROR, not an activator:
// `SHIPPED` means the surface EXISTS on disk, NOT that the rung is
// runtime-correct. It executes nothing, invokes no model, activates no
// runtime, and the gated `activate` rung is never crossed here.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_ACTIVATION_LADDER_SCHEMA =
  "bizra.dema.node0_activation_ladder.v0.1";
export const NODE0_ACTIVATION_LADDER_TRUTH_LABEL =
  "NODE0_ACTIVATION_LADDER_LOCAL_ONLY";

// Canonical, ordered ladder. Single source of truth; the gatherer reads these
// evidence_file/marker entries from disk and the CLI displays the labels.
export const NODE0_ACTIVATION_LADDER = Object.freeze([
  Object.freeze({
    id: "observe",
    label: "Node0 activation observe",
    command: "dema node0 activation observe",
    evidence_file: "packages/core/src/node0-activation-observe.js",
    marker: null,
    tier: "preview",
  }),
  Object.freeze({
    id: "benchmark",
    label: "Local model eval baseline",
    command: "dema eval baseline",
    evidence_file: "packages/core/src/model-eval-baseline.js",
    marker: null,
    tier: "preview",
  }),
  Object.freeze({
    id: "route",
    label: "Deterministic role->model route preview",
    command: "dema eval route",
    evidence_file: "packages/core/src/model-routing-preview.js",
    marker: null,
    tier: "preview",
  }),
  Object.freeze({
    id: "hardware",
    label: "Hardware architecture profile",
    command: "dema hardware profile",
    evidence_file: "packages/core/src/node0-hardware-profile.js",
    marker: null,
    tier: "preview",
  }),
  Object.freeze({
    id: "talk_hint",
    label: "Measured talk env hint",
    command: "dema eval route",
    evidence_file: "packages/core/src/model-routing-preview.js",
    marker: "talk_env_hint",
    tier: "preview",
  }),
  Object.freeze({
    id: "mission_routing",
    label: "Measured routing context on plan dry-run",
    command: "dema mission plan --baseline",
    evidence_file: "packages/core/src/closed-dual-loop-dry-run.js",
    marker: "measured_routing_context",
    tier: "preview",
  }),
  Object.freeze({
    id: "blackboard",
    label: "PAT/SAT shared-state blackboard dry-run",
    command: "dema agent-loop blackboard",
    evidence_file: "packages/core/src/pat-sat-blackboard-dry-run.js",
    marker: null,
    tier: "preview",
  }),
  Object.freeze({
    id: "activate",
    label: "Live activation (governed runtime + identity)",
    command: null,
    evidence_file: null,
    marker: null,
    tier: "gated",
  }),
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function classify(rung, ev) {
  if (rung.tier === "gated") return "GATED_OPERATOR_ONLY";
  const kernel_present = ev.kernel_present === true;
  const marker_present = ev.marker_present === true;
  if (kernel_present && marker_present) return "SHIPPED";
  if (kernel_present) return "PARTIAL";
  return "MISSING";
}

export function buildNode0ActivationLadder({ evidence = {} } = {}) {
  const rungs = NODE0_ACTIVATION_LADDER.map((rung) => {
    // Gated rungs ignore caller evidence and are always operator-only.
    const ev =
      rung.tier === "gated"
        ? { kernel_present: false, marker_present: false }
        : {
            kernel_present: evidence?.[rung.id]?.kernel_present === true,
            marker_present: evidence?.[rung.id]?.marker_present === true,
          };
    return {
      id: rung.id,
      label: rung.label,
      command: rung.command,
      tier: rung.tier,
      status: classify(rung, ev),
      evidence: { kernel_present: ev.kernel_present, marker_present: ev.marker_present },
    };
  });

  const summary = { shipped: 0, partial: 0, missing: 0, gated: 0 };
  for (const r of rungs) {
    if (r.status === "SHIPPED") summary.shipped += 1;
    else if (r.status === "PARTIAL") summary.partial += 1;
    else if (r.status === "MISSING") summary.missing += 1;
    else if (r.status === "GATED_OPERATOR_ONLY") summary.gated += 1;
  }

  const next_gated_rung =
    rungs.find((r) => r.status === "GATED_OPERATOR_ONLY")?.id ?? null;

  const boundary = { ...buildPreviewBoundary() };

  const what_this_proves = [
    "each preview rung's kernel file (and any required feature marker) is PRESENT on disk",
    "the gated 'activate' rung is operator-only and is not crossed by this report",
  ];

  const what_this_does_not_prove = [
    "SHIPPED means the surface EXISTS on disk, NOT that the rung is runtime-correct or its output valid",
    "no rung is executed, no model is invoked, no runtime is activated",
    "the gated 'activate' rung requires governed runtime + identity + explicit operator GO outside this repo",
    "this is a STATUS MIRROR derived from disk presence, not a guarantee of activation readiness",
  ];

  const envelopeWithoutHash = {
    schema: NODE0_ACTIVATION_LADDER_SCHEMA,
    truth_label: NODE0_ACTIVATION_LADDER_TRUTH_LABEL,
    rungs,
    summary,
    next_gated_rung,
    boundary,
    what_this_proves,
    what_this_does_not_prove,
  };

  const report_hash = sha256(stableStringify(envelopeWithoutHash));
  return deepFreeze({ ...envelopeWithoutHash, report_hash });
}

export function verifyNode0ActivationLadder(report) {
  const blocked_by = [];
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }

  // Reconstruct the caller evidence from the report's own rungs, then
  // re-derive. Every field is a pure function of that evidence.
  const evidence = {};
  for (const r of Array.isArray(report.rungs) ? report.rungs : []) {
    if (r && typeof r.id === "string" && r.evidence) {
      evidence[r.id] = {
        kernel_present: r.evidence.kernel_present === true,
        marker_present: r.evidence.marker_present === true,
      };
    }
  }
  const expected = buildNode0ActivationLadder({ evidence });

  if (report.truth_label !== expected.truth_label) {
    blocked_by.push("truth_label_mismatch");
  }

  const boundary = report.boundary;
  const boundaryAllFalse =
    boundary &&
    typeof boundary === "object" &&
    Object.values(boundary).every((v) => v === false);
  if (!boundaryAllFalse) blocked_by.push("boundary_not_all_false");

  // Body-bound: the entire envelope (minus the hash) is a pure function of the
  // reconstructed evidence. Catches a forged status/summary/next_gated_rung or
  // tampered what_this_does_not_prove that leaves the honest hash untouched.
  const { report_hash: _rh, ...reportBody } = report;
  const { report_hash: _eh, ...expectedBody } = expected;
  if (stableStringify(reportBody) !== stableStringify(expectedBody)) {
    blocked_by.push("ladder_relaundered");
  }

  if (report.report_hash !== expected.report_hash) {
    blocked_by.push("report_hash_mismatch");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}
