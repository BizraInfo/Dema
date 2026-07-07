// NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A — Operator-invoked local mission harness (PURE composition
// layer). Given an INJECTED file reference (path + size + mtime + content-hash, computed by the CLI
// adapter — this kernel reads no file), an operator-supplied candidate extraction, and a composition
// reference, it builds a mission packet, runs the pure mission-pulse kernel, and shapes a preview
// receipt artifact. The filesystem read and the receipt write live in the CLI/adapter
// (apps/cli/src/commands/mission.js) — NOT here; this kernel stays pure.
//
// Honesty boundary: the harness performs NO semantic extraction. The candidate {claim, task,
// boundary} is OPERATOR-SUPPLIED (CLI flags) — the human does the extraction, the harness reads +
// hashes the file and runs the pulse over both. No model, no daemon, no network, no live autonomy.
//
// Pure kernel: no fs / network / process / clock / random. now_iso is INJECTED (defaults to null).
// createHash is a deterministic digest.

import { createHash } from "node:crypto";
import {
  buildNode0FirstRealLocalMissionPulsePreviewPayload,
  verifyNode0FirstRealLocalMissionPulsePreview,
} from "./node0-first-real-local-mission-pulse-preview.js";

export const NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA = "bizra.dema.node0_local_mission_harness_preview.v0.1";
export const NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL = "NODE0_LOCAL_MISSION_HARNESS_PREVIEW_MEASURED_REPO";
export const NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE = "GO: node0 local mission harness preview";

const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

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

function nonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function basename(p) {
  return typeof p === "string" ? p.split("/").pop() : null;
}

export function node0LocalMissionHarnessPreviewBoundary() {
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

function boundaryAllFalse(b) {
  const keys = Object.keys(node0LocalMissionHarnessPreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Validate the injected file reference (the adapter's read result). content_read_performed is the
// adapter's honest flag: true ONLY when an excerpt was read under explicit excerpt consent.
function evaluateFileRef(fileRef) {
  const b = [];
  if (!fileRef || typeof fileRef !== "object") {
    b.push("missing_file_ref");
    return b;
  }
  if (!nonEmptyString(fileRef.path)) b.push("file_ref_missing_path");
  if (!CONTENT_HASH_RE.test(fileRef.content_hash || "")) b.push("file_ref_missing_content_hash");
  if (typeof fileRef.size_bytes !== "number" || fileRef.size_bytes < 0) b.push("file_ref_missing_size");
  if (fileRef.content_read_performed !== true && fileRef.content_read_performed !== false) {
    b.push("file_ref_missing_content_read_flag");
  }
  // An excerpt may be present ONLY if content_read_performed is true (excerpt consent was given).
  if (fileRef.excerpt !== undefined && fileRef.excerpt !== null && fileRef.content_read_performed !== true) {
    b.push("excerpt_without_content_consent");
  }
  // Raw content must never be declared as leaving Node0.
  if (fileRef.raw_content_leaves_node0 === true) b.push("raw_content_leaves_node0");
  return b;
}

// Build the mission input this harness feeds to the pulse kernel. mission_id is derived from the file
// content hash (deterministic, no clock). The input_packet carries the hash + metadata; an excerpt is
// admitted only when the adapter read one under consent, and it stays local (raw_content_leaves_node0
// false). The candidate is operator-supplied.
export function composeMissionInput({ fileRef, compositionRef, candidate }) {
  const hash8 = (fileRef?.content_hash || "").replace("sha256:", "").slice(0, 8);
  return {
    mission: {
      mission_id: `node0-local-mission-${hash8 || "unknown"}`,
      sovereign_intent: "Record one operator-supplied claim, task, and boundary against a local file, as a preview.",
      mission_type: "local_file_mission_preview",
    },
    consent: {
      operator_is_sole_authority: true,
      scope: "supplied_file_and_candidate_only",
      allows_world_state_preview: true,
      allows_live_mutation: false,
    },
    input_packet: {
      source_label: basename(fileRef?.path) ?? "local_file",
      content_hash: fileRef?.content_hash ?? null,
      sensitivity: "local_private",
      raw_content_leaves_node0: false,
    },
    composition_ref: compositionRef,
    candidate_extraction: candidate,
    authority_delta: 0,
    request_live_commit: false,
    declared_flags: Object.freeze({
      live_urp: false,
      federation: false,
      mint_allowed: false,
      wallet_accessed: false,
      settlement: false,
      daemon_started: false,
      network_used: false,
      model_invocation_performed: false,
      file_mutation_performed: false,
    }),
  };
}

export function planNode0LocalMissionHarnessPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    if (!input.file_ref || typeof input.file_ref !== "object") blocked_by.push("missing_file_ref");
    if (!input.composition_ref || typeof input.composition_ref !== "object") blocked_by.push("missing_composition_ref");
    if (!input.candidate_extraction || typeof input.candidate_extraction !== "object") blocked_by.push("missing_candidate_extraction");
  }
  return Object.freeze({
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed harness verdict. Embeds the whole pulse verdict (which embeds the composition
// verdict, which embeds the signature-backed genesis anchor) so a forge-and-recompute of the harness
// body that tampers that chain is still rejected. Shapes the receipt artifact that the CLI would WRITE.
export function buildNode0LocalMissionHarnessPreviewPayload(input) {
  const fileRef = input?.file_ref ?? null;
  const fileBlocks = evaluateFileRef(fileRef);

  const missionInput = composeMissionInput({
    fileRef,
    compositionRef: input?.composition_ref,
    candidate: input?.candidate_extraction,
  });
  // Embed the pulse PAYLOAD (content-addressed, verifiable) — not the run envelope. Its embedded
  // composition_ref carries the signature-backed genesis anchor, so the harness verify re-derives
  // the whole chain.
  const pulse = buildNode0FirstRealLocalMissionPulsePreviewPayload(missionInput);
  const pulseVerify = verifyNode0FirstRealLocalMissionPulsePreview(pulse);

  const blocked_by = [...fileBlocks];
  if (!pulse.pulse_ready) blocked_by.push(...(pulse.blocked_by || []).map((c) => `pulse:${c}`));
  if (!pulseVerify.ok) blocked_by.push(...(pulseVerify.blocked_by || []).map((c) => `pulse_verify:${c}`));
  const harness_ready = blocked_by.length === 0;

  const now_iso = typeof input?.now_iso === "string" ? input.now_iso : null;
  const mission_id = missionInput.mission.mission_id;

  const receipt_artifact_preview = Object.freeze({
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    mission_id,
    file_ref: fileRef
      ? Object.freeze({
          path: fileRef.path ?? null,
          size_bytes: fileRef.size_bytes ?? null,
          mtime_iso: fileRef.mtime_iso ?? null,
          content_hash: fileRef.content_hash ?? null,
          content_read_performed: fileRef.content_read_performed === true,
        })
      : null,
    pulse_ok: pulse.pulse_ready === true,
    pulse_content_hash: pulse.content_hash ?? null,
    dema_report: pulse.dema_report ?? null,
    generated_at_iso: now_iso,
    committed_live: false,
  });

  const body = {
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
    file_ref: receipt_artifact_preview.file_ref,
    pulse_verdict: pulse,
    pulse_content_hash: pulse.content_hash ?? null,
    harness_ready,
    receipt_artifact_preview,
    receipt_target_relpath: `mission/receipts/${mission_id}.json`,
    boundary: node0LocalMissionHarnessPreviewBoundary(),
    authority_delta: 0,
    grants_action: false,
    mint_allowed: false,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    what_this_proves:
      "An operator-invoked local file (metadata + content-hash, computed by the read-only adapter) plus an OPERATOR-SUPPLIED candidate extraction were composed into a mission packet and run through the pure mission pulse; a preview receipt artifact was shaped (committed_live false) with a stable content hash, and the embedded pulse verdict re-verifies (composition → genesis signature anchor).",
    what_this_does_not_prove:
      "The harness reads no file in this kernel (the adapter does, read-only, and injects the result) and performs NO semantic extraction — the claim/task/boundary are the operator's. It writes nothing here; the receipt is a preview the CLI writes only under explicit consent, atomically, under DEMA_HOME. No live URP, no mint, no wallet, no settlement, no federation, no daemon, no model, no network, no source-file mutation.",
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

export function verifyNode0LocalMissionHarnessPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.grants_action !== false) blocked_by.push("grants_action_true");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  const receipt = payload.receipt_artifact_preview;
  if (!receipt || typeof receipt !== "object") blocked_by.push("receipt_artifact_missing");
  else if (receipt.committed_live !== false) blocked_by.push("receipt_committed_live");
  // Independent anchor: re-verify the embedded pulse verdict (→ composition → genesis signature).
  const pv = verifyNode0FirstRealLocalMissionPulsePreview(payload.pulse_verdict);
  if (!pv.ok) blocked_by.push("pulse_anchor_invalid");
  if (payload.pulse_content_hash !== (payload.pulse_verdict?.content_hash ?? null)) {
    blocked_by.push("pulse_hash_ref_mismatch");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
    harness_ready: payload.harness_ready === true,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Pure example harness input given an already-built composition verdict packet (the CLI/gate builds
// it — it needs keys for the genesis anchor, which the pure kernel never generates). The file_ref is
// a synthetic INJECTED read result; no file is read here.
export function exampleHarnessInput(compositionRefPayload) {
  return {
    file_ref: {
      path: "docs/BUILDER_SPACE.md",
      size_bytes: 128,
      mtime_iso: "2026-07-07T00:00:00.000Z",
      content_hash: `sha256:${"b".repeat(64)}`,
      content_read_performed: false,
      raw_content_leaves_node0: false,
    },
    composition_ref: compositionRefPayload,
    candidate_extraction: {
      claim: "This local file is the operator-declared source for one preview mission.",
      task: "Record the operator's claim, task, and boundary against this file's content hash.",
      boundary: "No live URP, no mint, no daemon, no model, no network, no source mutation.",
    },
    now_iso: "2026-07-07T12:00:00.000Z",
  };
}

export function runNode0LocalMissionHarnessPreview({ consent, input } = {}) {
  const plan = planNode0LocalMissionHarnessPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
      truth_label: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      harness_ready: false,
      boundary: node0LocalMissionHarnessPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      grants_action: false,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0LocalMissionHarnessPreviewPayload(input);
  const verified = verifyNode0LocalMissionHarnessPreview(payload);
  const blocked_by = [];
  if (!payload.harness_ready) blocked_by.push(...payload.blocked_by);
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_HARNESS_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "verified_preview_harness" : "blocked_preview_harness",
    content_hash: payload.content_hash,
    harness_ready: payload.harness_ready,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    grants_action: false,
    receipt_artifact_preview: payload.receipt_artifact_preview,
    receipt_target_relpath: payload.receipt_target_relpath,
    dema_report: payload.receipt_artifact_preview.dema_report,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
