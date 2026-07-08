// NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A — Pure EMITTER/SERIALIZER. Given an already-produced,
// already-verified NODE0-LOCAL-MISSION-HARNESS-PREVIEW result, it re-verifies that result (which
// transitively re-verifies pulse → composition → signature-backed genesis anchor) and serializes it into
// THREE separate content-addressed preview artifacts: a receipt, a not-applied world-state delta preview,
// and a DEMA report. It composes the shipped harness kernel and re-implements none of its logic.
//
// Honesty boundary: this kernel WRITES NOTHING. There is no live world-state; the world-state delta is a
// DECLARED preview of what a live append WOULD change (applied:false, committed_live:false). Any actual
// file write lives ONLY in a CLI/adapter (consent-gated, atomic, under DEMA_HOME) — never here. No model,
// no daemon, no network, no wallet, no mint, no federation, no live autonomy.
//
// Pure kernel: no fs / network / process / clock / random. now_iso is INJECTED (defaults to null).
// createHash is a deterministic digest; stableStringify mirrors the harness kernel's canonical form.

import { createHash } from "node:crypto";
import {
  verifyNode0LocalMissionHarnessPreview,
} from "./node0-local-mission-harness-preview.js";

export const NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA = "bizra.dema.node0_local_mission_artifact_emission_preview.v0.1";
export const NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL = "NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO";
export const NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE = "GO: node0 local mission artifact emission preview";

// Per-artifact schemas (each artifact is a stand-alone content-addressed object).
export const RECEIPT_ARTIFACT_SCHEMA = `${NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA}.receipt`;
export const WORLD_STATE_DELTA_ARTIFACT_SCHEMA = `${NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA}.world_state_delta`;
export const DEMA_REPORT_ARTIFACT_SCHEMA = `${NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA}.dema_report`;

export const ARTIFACT_NAMES = Object.freeze(["receipt", "world_state_delta_preview", "dema_report"]);
const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

// A caller may not declare any of these true — doing so claims a live capability the emitter refuses.
const FORBIDDEN_DECLARED_FLAGS = Object.freeze([
  "network_used",
  "model_invocation_performed",
  "token_minted",
  "wallet_accessed",
  "daemon_started",
  "federation",
  "file_mutation_performed",
  "live_execution_performed",
  "remote_execution",
]);

// Field names that would carry raw source content INTO an artifact. Admissible only when the harness
// file_ref recorded content_read_performed:true (excerpt consent) — mirrors the harness excerpt rule.
const RAW_CONTENT_KEYS = Object.freeze([
  "raw_content",
  "source_content",
  "file_content",
  "raw_excerpt",
  "excerpt",
  "plaintext",
  "file_bytes",
  "raw_text",
]);

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

// All-false boundary invariant. Keys mirror the capability-truth-registry row boundary — keep them all
// false; flipping any one is an execution claim.
export function node0LocalMissionArtifactEmissionPreviewBoundary() {
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
  const keys = Object.keys(node0LocalMissionArtifactEmissionPreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Content-address one artifact/envelope body: freeze `{ ...body, content_hash }` bound over the WHOLE body.
function contentAddress(body) {
  return Object.freeze({ ...body, content_hash: `sha256:${sha256(stableStringify(body))}` });
}

// Walk an artifact and collect any raw-content-bearing key holding a non-empty string.
function scanRawContentLeak(node) {
  const hits = [];
  const walk = (v) => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (RAW_CONTENT_KEYS.includes(k) && typeof val === "string" && val.trim() !== "") hits.push(k);
        walk(val);
      }
    }
  };
  walk(node);
  return hits;
}

// Deterministic run id: first 16 hex chars of the input mission (harness) content hash. Same input →
// same run id, so artifact target paths are stable and bounded.
function deriveRunId(harnessContentHash) {
  const hex = typeof harnessContentHash === "string" ? harnessContentHash.replace("sha256:", "") : "";
  return CONTENT_HASH_RE.test(harnessContentHash || "") ? hex.slice(0, 16) : "unknown";
}

function artifactRelpath(runId, name) {
  return `artifacts/proofs/node0-local-mission/${runId}/${name}.json`;
}

// Fail-closed plan. Shape gate only (consent + a harness_result object); the deep re-verification and the
// authority/laundering checks run in build so `run` surfaces them in one place.
export function planNode0LocalMissionArtifactEmissionPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!input.harness_result || typeof input.harness_result !== "object") {
    blocked_by.push("missing_harness_result");
  }
  return Object.freeze({
    schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Serialize the (re-verified) harness result into three content-addressed artifacts and one content-
// addressed emission envelope that EMBEDS the harness result (so verify can re-run the harness anchor).
export function buildNode0LocalMissionArtifactEmissionPreviewPayload(input) {
  const harness = input?.harness_result ?? null;
  const declared = input?.declared_flags;
  const now_iso = typeof input?.now_iso === "string" ? input.now_iso : null;

  const blocked_by = [];

  // Independent anchor: re-verify the harness result (→ pulse → composition → genesis signature).
  if (!harness || typeof harness !== "object") {
    blocked_by.push("missing_harness_result");
  } else {
    const hv = verifyNode0LocalMissionHarnessPreview(harness);
    if (!hv.ok) for (const c of hv.blocked_by || []) blocked_by.push(`harness_verify:${c}`);
  }

  // Emitter-level authority + laundering guards (never mutate the emission's own truthful all-false body).
  if (typeof input?.authority_delta === "number" && input.authority_delta !== 0) blocked_by.push("emitter_authority_delta_nonzero");
  if (input?.request_live_commit === true) blocked_by.push("emitter_request_live_commit");
  if (input?.mint_allowed === true) blocked_by.push("emitter_mint_allowed");
  if (declared && typeof declared === "object") {
    for (const f of FORBIDDEN_DECLARED_FLAGS) if (declared[f] === true) blocked_by.push(`declared_${f}`);
  }

  // Fields lifted from the (already-shaped) harness receipt preview. No raw file content is available
  // here — the harness carries metadata + hashes only.
  const receiptSource = harness?.receipt_artifact_preview ?? null;
  const missionId = receiptSource?.mission_id ?? null;
  const fileRef = receiptSource?.file_ref ?? null;
  const contentReadPerformed = fileRef?.content_read_performed === true;
  const pulseContentHash = harness?.pulse_content_hash ?? receiptSource?.pulse_content_hash ?? null;
  const demaReport = receiptSource?.dema_report ?? harness?.pulse_verdict?.dema_report ?? null;
  const inputContentHash = harness?.content_hash ?? null;
  const runId = deriveRunId(inputContentHash);

  // Artifact 1 — receipt: a content-addressed serialization of the harness receipt preview + pulse hash.
  const receipt = contentAddress({
    schema: RECEIPT_ARTIFACT_SCHEMA,
    artifact_type: "receipt",
    committed_live: false,
    mission_id: missionId,
    receipt: receiptSource,
    pulse_content_hash: pulseContentHash,
    boundary: node0LocalMissionArtifactEmissionPreviewBoundary(),
    what_this_proves:
      "A content-addressed serialization of the already-verified harness receipt preview: it records the mission id, the file reference (path + size + mtime + content hash, metadata only), the pulse hash, and committed_live:false.",
    what_this_does_not_prove:
      "Nothing is written to any live store; this is a preview serialization, not a recorded runtime event.",
  });

  // Artifact 2 — world_state_delta_preview: a DECLARED, not-applied delta. No live world-state exists.
  const world_state_delta_preview = contentAddress({
    schema: WORLD_STATE_DELTA_ARTIFACT_SCHEMA,
    artifact_type: "world_state_delta_preview",
    committed_live: false,
    applied: false,
    operation: "append_preview",
    target: "node0.world_state.mission_shelf",
    mission_id: missionId,
    declares: Object.freeze({
      would_append_receipt: true,
      receipt_content_hash: receipt.content_hash,
      mission_id_recorded: missionId,
    }),
    note: "Declared preview of what a live append WOULD change; no live world-state exists and nothing is applied here.",
    boundary: node0LocalMissionArtifactEmissionPreviewBoundary(),
    what_this_proves:
      "A declared, not-applied world-state delta preview: it names the append operation, the target shelf, the mission id, and the receipt that would be recorded, with applied:false and committed_live:false.",
    what_this_does_not_prove:
      "No world-state is mutated; there is no live shelf and no append is performed — the delta is declared, not applied.",
  });

  // Artifact 3 — dema_report: the operator-facing status + next safe action, content-addressed.
  const dema_report = contentAddress({
    schema: DEMA_REPORT_ARTIFACT_SCHEMA,
    artifact_type: "dema_report",
    committed_live: false,
    mission_id: missionId,
    status: demaReport?.status ?? null,
    next_safe_action: demaReport?.next_safe_action ?? null,
    what_happened: demaReport?.what_happened ?? null,
    dema_report: demaReport,
    boundary: node0LocalMissionArtifactEmissionPreviewBoundary(),
    what_this_proves:
      "A content-addressed serialization of the harness/pulse DEMA report: the operator-facing status and the next safe action, with committed_live:false.",
    what_this_does_not_prove:
      "The report is a preview serialization; it triggers no action and asserts no live runtime.",
  });

  const artifacts = Object.freeze({ receipt, world_state_delta_preview, dema_report });

  // Raw-content leak scan across every artifact (unless excerpt consent was recorded upstream).
  if (!contentReadPerformed) {
    for (const name of ARTIFACT_NAMES) {
      for (const k of scanRawContentLeak(artifacts[name])) blocked_by.push(`raw_content_leaked:${name}:${k}`);
    }
  }

  const artifact_paths = Object.freeze(ARTIFACT_NAMES.map((name) => artifactRelpath(runId, name)));
  const emission_ready = blocked_by.length === 0;

  const body = {
    schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
    run_id: runId,
    input_ref: Object.freeze({ harness_content_hash: inputContentHash, mission_id: missionId }),
    harness_result: harness ?? null,
    artifacts,
    artifact_paths,
    generated_at_iso: now_iso,
    boundary: node0LocalMissionArtifactEmissionPreviewBoundary(),
    mint_allowed: false,
    authority_delta: 0,
    committed_live: false,
    declared_flags: Object.freeze(Object.fromEntries(FORBIDDEN_DECLARED_FLAGS.map((f) => [f, false]))),
    emission_ready,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    what_this_proves:
      "An already-verified NODE0-LOCAL-MISSION-HARNESS-PREVIEW result was re-verified (pulse → composition → signature-backed genesis anchor) and serialized into three separate content-addressed preview artifacts — a receipt, a not-applied world-state delta preview, and a DEMA report — each with a stable sha256 content hash and an all-false boundary, plus a deterministic run id and target relpaths. The same input yields an identical run id and identical artifact hashes.",
    what_this_does_not_prove:
      "The kernel writes no file (a CLI/adapter performs any write, consent-gated and atomic, under DEMA_HOME); it applies no world-state, records nothing live, and invokes no model, network, daemon, wallet, mint, or federation. Serializing a preview is not executing a mission; the world-state delta is declared, not applied.",
  };
  return contentAddress(body);
}

// Body-bound re-derivation verifier. Re-derives the emission content hash AND each artifact's content
// hash, fail-closed rejects tamper / laundering / committed_live / authority / raw-content leakage, and
// re-runs the harness verify on the embedded input (independent anchor) so a forge-and-recompute of the
// upstream pulse/composition/genesis chain is still rejected.
export function verifyNode0LocalMissionArtifactEmissionPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.committed_live !== false) blocked_by.push("committed_live_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");

  const declared = payload.declared_flags;
  if (declared && typeof declared === "object") {
    for (const f of FORBIDDEN_DECLARED_FLAGS) if (declared[f] === true) blocked_by.push(`declared_${f}`);
  }

  // Exactly three content-addressed artifacts, each re-derivable, committed_live:false, no raw leakage.
  const artifacts = payload.artifacts;
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) {
    blocked_by.push("artifacts_missing");
  } else {
    if (Object.keys(artifacts).length !== ARTIFACT_NAMES.length) blocked_by.push("artifact_count_mismatch");
    const contentReadPerformed =
      payload.harness_result?.receipt_artifact_preview?.file_ref?.content_read_performed === true;
    for (const name of ARTIFACT_NAMES) {
      const art = artifacts[name];
      if (!art || typeof art !== "object") {
        blocked_by.push(`artifact_missing:${name}`);
        continue;
      }
      const { content_hash: aHash, ...aBody } = art;
      if (!CONTENT_HASH_RE.test(aHash || "")) blocked_by.push(`artifact_hash_malformed:${name}`);
      if (aHash !== `sha256:${sha256(stableStringify(aBody))}`) blocked_by.push(`artifact_content_hash_mismatch:${name}`);
      if (art.committed_live !== false) blocked_by.push(`artifact_committed_live:${name}`);
      if (!boundaryAllFalse(art.boundary)) blocked_by.push(`artifact_boundary_not_all_false:${name}`);
      if (!contentReadPerformed) {
        for (const k of scanRawContentLeak(art)) blocked_by.push(`raw_content_leaked:${name}:${k}`);
      }
    }
  }

  // Independent anchor: re-run the harness verify on the EMBEDDED input.
  const hv = verifyNode0LocalMissionHarnessPreview(payload.harness_result);
  if (!hv.ok) blocked_by.push("harness_anchor_invalid");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
    run_id: payload.run_id ?? null,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Orchestrator the review gate consumes: plan → build → verify → tamper-reject, failing closed.
export function runNode0LocalMissionArtifactEmissionPreview({ consent, input } = {}) {
  const plan = planNode0LocalMissionArtifactEmissionPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
      truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      run_id: null,
      content_hash: null,
      artifacts: Object.freeze({}),
      artifact_paths: Object.freeze([]),
      boundary: node0LocalMissionArtifactEmissionPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0LocalMissionArtifactEmissionPreviewPayload(input);
  const verified = verifyNode0LocalMissionArtifactEmissionPreview(payload);
  const blocked_by = [];
  if (!payload.emission_ready) blocked_by.push(...payload.blocked_by);
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_SCHEMA,
    truth_label: NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "verified_preview_emission" : "blocked_preview_emission",
    run_id: payload.run_id,
    content_hash: payload.content_hash,
    artifacts: payload.artifacts,
    artifact_paths: payload.artifact_paths,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
