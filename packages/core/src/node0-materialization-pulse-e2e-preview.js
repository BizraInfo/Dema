// NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW-1A — Pure preview-only Materialization Pulse orchestrator.
//
// The capstone: it makes the assembled Pulse RUN. It composes the five already-tested station kernels
// in sequence over one mission and emits ONE chained receipt + a per-station ladder. It re-implements
// nothing — it imports each station's run/build and chains them:
//
//   rung 1  sanitize(file_text)   → input_safety
//   rung 2  plan-branch(branches) → plan
//   rung 3  FATE (caller verdict) → fate
//   rung 4  claim-gate(claims)    → claim_binding + claims_public_safe
//   rung 5  assemble #351 envelope → SEALED or ABORTED Pulse receipt
//
// Atomicity (inherited from the #351 envelope, not re-invented): sanitize must be ALLOWED to proceed
// (BLOCKED/QUARANTINED → abort @1); a failed plan or a FATE REJECT → abort; a claim-gate REJECT of a
// public claim does NOT abort but sets claims_public_safe:false; all pass → sealed. An aborted pulse
// still emits a receipt recording where + why (an abort is evidence).
//
// Pure kernel: composes PURE kernels; no fs / network / model / clock / random. The CLI adapter reads
// the one real file.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  runUntrustedCorpusSanitizerPreview,
  UNTRUSTED_CORPUS_SANITIZER_PREVIEW_GO_PHRASE,
} from "./untrusted-corpus-sanitizer-preview.js";
import {
  runPlanBranchPreview,
  PLAN_BRANCH_PREVIEW_GO_PHRASE,
} from "./plan-branch-preview.js";
import {
  runPublicMetricClaimGatePreview,
  PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE,
} from "./public-metric-claim-gate-preview.js";
import {
  buildMaterializationPulseReceiptSchemaPreviewPayload,
  verifyMaterializationPulseReceiptSchemaPreview,
  FATE_VERDICTS,
} from "./materialization-pulse-receipt-schema-preview.js";

export const NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA = "bizra.dema.node0_materialization_pulse_e2e_preview.v0.1";
export const NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL = "NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_MEASURED_REPO";
export const NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE = "GO: node0 materialization pulse e2e preview";

export const PULSE_STATIONS = Object.freeze(["sanitize", "plan_branch", "fate", "claim_gate", "pulse_receipt"]);

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

function hashBody(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function node0MaterializationPulseE2ePreviewBoundary() {
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

function metaBoundaryAllFalse(b) {
  const keys = Object.keys(node0MaterializationPulseE2ePreviewBoundary());
  return !!b && typeof b === "object" && !Array.isArray(b) && Object.keys(b).length === keys.length && keys.every((k) => b[k] === false);
}

function rung(station, ok, verdict, content_hash, blocked_by) {
  return Object.freeze({ station, ok, verdict, content_hash: content_hash ?? null, blocked_by: Object.freeze([...(blocked_by || [])]) });
}

// Compose the station kernels over one mission. Returns the ladder + the assembled Pulse envelope (or
// null if the chain aborted before rung 5). This is the heart: it RUNS the assembled stations.
export function runPulseStationLadder(mission = {}) {
  const ladder = [];
  const m = isObject(mission) ? mission : {};

  // rung 1 — sanitize the real file text (only ALLOWED input runs a mission).
  const san = runUntrustedCorpusSanitizerPreview({
    consent: UNTRUSTED_CORPUS_SANITIZER_PREVIEW_GO_PHRASE,
    input: { text: typeof m.file_text === "string" ? m.file_text : "", source: m.file_source ?? null },
  });
  const sanOk = san.verdict === "ALLOWED";
  ladder.push(rung("sanitize", sanOk, san.verdict, san.content_hash, sanOk ? [] : [`sanitize_${String(san.verdict).toLowerCase()}`]));
  if (!sanOk) return Object.freeze({ ladder: Object.freeze(ladder), reached_station: 1, pulse_status: "aborted", pulse_receipt: null });

  // rung 2 — plan-branch (rejected branches are evidence).
  const plan = runPlanBranchPreview({ consent: PLAN_BRANCH_PREVIEW_GO_PHRASE, input: m.plan });
  ladder.push(rung("plan_branch", plan.ok === true, plan.status, plan.content_hash, plan.blocked_by));
  if (plan.ok !== true) return Object.freeze({ ladder: Object.freeze(ladder), reached_station: 2, pulse_status: "aborted", pulse_receipt: null });

  // rung 3 — FATE (caller-supplied verdict; REJECT or authority/mint violation aborts).
  const fate = isObject(m.fate) ? m.fate : {};
  const fateOk =
    FATE_VERDICTS.includes(fate.verdict) && fate.verdict !== "REJECT" &&
    (fate.authority_delta ?? 0) === 0 && (fate.mint_allowed ?? false) === false && (fate.grants_action ?? false) === false;
  ladder.push(rung("fate", fateOk, fate.verdict ?? null, null, fateOk ? [] : ["fate_reject_or_authority_violation"]));
  if (!fateOk) return Object.freeze({ ladder: Object.freeze(ladder), reached_station: 3, pulse_status: "aborted", pulse_receipt: null });

  // rung 4 — claim-gate. A rejected PUBLIC claim does NOT abort (it just can't go public); only a
  // broken gate run aborts.
  const claims = runPublicMetricClaimGatePreview({ consent: PUBLIC_METRIC_CLAIM_GATE_PREVIEW_GO_PHRASE, input: m.claims });
  const claims_public_safe = claims.ok === true && (claims.rejected_count ?? 0) === 0;
  ladder.push(rung("claim_gate", claims.ok === true, claims.status, claims.content_hash, claims.blocked_by));
  if (claims.ok !== true) return Object.freeze({ ladder: Object.freeze(ladder), reached_station: 4, pulse_status: "aborted", pulse_receipt: null });

  // rung 5 — assemble the #351 Pulse-receipt envelope binding all the station verdicts.
  const pulse = {
    pulse_id: typeof m.pulse_id === "string" ? m.pulse_id : "pulse-e2e",
    mission_id: typeof m.mission_id === "string" ? m.mission_id : null,
    prev_pulse: m.prev_pulse ?? null,
    niyyah: { hash: m.niyyah_hash ?? null, truth_label: "DECLARED" },
    input_safety: { sanitizer_receipt: san.content_hash, verdict: san.verdict },
    plan: { plan_root: plan.content_hash, rejected_branch_count: plan.rejected_branch_count ?? 0 },
    fate: { verdict: fate.verdict, authority_delta: 0, grants_action: false, mint_allowed: false },
    execution: { mode: "preview", exec_merkle: null },
    claim_binding: { claim_gate_receipt: claims.content_hash, rejected_count: claims.rejected_count ?? 0, unknown_count: claims.unknown_count ?? 0 },
    claims_public_safe,
    pulse_status: "sealed",
  };
  const envelope = buildMaterializationPulseReceiptSchemaPreviewPayload({ pulse });
  ladder.push(rung("pulse_receipt", envelope.receipt_ok === true, envelope.receipt_ok ? "sealed" : "malformed", envelope.content_hash, envelope.receipt_blocked_by));
  return Object.freeze({
    ladder: Object.freeze(ladder),
    reached_station: 5,
    pulse_status: envelope.receipt_ok === true ? "sealed" : "aborted",
    pulse_receipt: envelope,
  });
}

export function planNode0MaterializationPulseE2ePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!isObject(input) || !isObject(input.mission)) blocked_by.push("missing_mission");
  return Object.freeze({
    schema: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
    truth_label: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildNode0MaterializationPulseE2ePreviewPayload(input = {}) {
  const mission = isObject(input.mission) ? input.mission : {};
  const ran = runPulseStationLadder(mission);
  const final_verdict = ran.pulse_status; // sealed | aborted
  const body = {
    schema: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
    truth_label: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
    mission_id: typeof mission.mission_id === "string" ? mission.mission_id : null,
    station_count: PULSE_STATIONS.length,
    ladder: ran.ladder,
    reached_station: ran.reached_station,
    pulse_status: ran.pulse_status,
    final_verdict,
    pulse_receipt: ran.pulse_receipt,
    claims_public_safe: ran.pulse_receipt ? ran.pulse_receipt.receipt.claims_public_safe : false,
    boundary: node0MaterializationPulseE2ePreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    what_this_proves:
      "One mission was run END-TO-END through the assembled Materialization Pulse stations (sanitize → plan-branch → FATE → claim-gate → pulse-receipt envelope), composing the five already-tested kernels, and produced a per-station ladder plus one chained content-addressed receipt. The assembled system MOVES: a clean mission seals; an unsafe input, an unaccounted plan branch, or a FATE reject aborts at its rung and is recorded as evidence.",
    what_this_does_not_prove:
      "It runs no live model, executes no real-world action, publishes nothing, mints nothing. A 'sealed' pulse means the assembled PREVIEW stations passed on this input — NOT that the mission was executed, the plan carried out, or the claims are true. Each station remains preview-only and boundary-all-false; the orchestrator adds composition, not authority.",
  };
  return Object.freeze({ ...body, content_hash: hashBody(body) });
}

export function verifyNode0MaterializationPulseE2ePreview(payload) {
  if (!isObject(payload)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== hashBody(body)) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!metaBoundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (!["sealed", "aborted"].includes(payload.pulse_status)) blocked_by.push("pulse_status_invalid");
  if (payload.final_verdict !== payload.pulse_status) blocked_by.push("final_verdict_mismatch");

  if (!Array.isArray(payload.ladder) || payload.ladder.length === 0) {
    blocked_by.push("ladder_missing");
  } else {
    const last = payload.ladder[payload.ladder.length - 1];
    // A sealed pulse must have reached rung 5 with a valid embedded envelope; an aborted pulse must
    // have a blocked last rung.
    if (payload.pulse_status === "sealed") {
      if (payload.reached_station !== 5 || last.station !== "pulse_receipt" || last.ok !== true) blocked_by.push("sealed_without_full_ladder");
      const env = verifyMaterializationPulseReceiptSchemaPreview(payload.pulse_receipt);
      if (!env.ok) blocked_by.push("embedded_pulse_receipt_invalid");
      // Cross-check: the ladder's station hashes must match the sealed envelope's bound references.
      const r = payload.pulse_receipt?.receipt;
      const byStation = Object.fromEntries(payload.ladder.map((x) => [x.station, x]));
      if (r) {
        if (byStation.sanitize?.content_hash !== r.input_safety?.sanitizer_receipt) blocked_by.push("ladder_sanitize_hash_mismatch");
        if (byStation.plan_branch?.content_hash !== r.plan?.plan_root) blocked_by.push("ladder_plan_hash_mismatch");
        if (byStation.claim_gate?.content_hash !== r.claim_binding?.claim_gate_receipt) blocked_by.push("ladder_claim_hash_mismatch");
      }
    } else {
      if (last.ok !== false) blocked_by.push("aborted_without_blocked_rung");
      if (payload.pulse_receipt !== null) blocked_by.push("aborted_with_pulse_receipt");
    }
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
    truth_label: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
    pulse_status: payload.pulse_status,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

export function runNode0MaterializationPulseE2ePreview({ consent, input } = {}) {
  const plan = planNode0MaterializationPulseE2ePreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
      truth_label: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      boundary: node0MaterializationPulseE2ePreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildNode0MaterializationPulseE2ePreviewPayload(input);
  const verified = verifyNode0MaterializationPulseE2ePreview(payload);
  const blocked_by = verified.ok ? [] : [...verified.blocked_by];
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_SCHEMA,
    truth_label: NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_TRUTH_LABEL,
    // run.ok means the ORCHESTRATOR ran + self-verified. pulse_status says whether the mission's pulse
    // sealed or aborted — an aborted pulse is a correct, honest run.
    status: blocked_by.length === 0 ? "pulse_e2e_complete" : "pulse_e2e_broken",
    content_hash: payload.content_hash,
    mission_id: payload.mission_id,
    pulse_status: payload.pulse_status,
    final_verdict: payload.final_verdict,
    reached_station: payload.reached_station,
    station_count: payload.station_count,
    claims_public_safe: payload.claims_public_safe,
    ladder: payload.ladder,
    pulse_receipt: payload.pulse_receipt,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
