// NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A — Read-only truth cockpit (PURE VIEWER). Given the three
// already-emitted, content-addressed mission artifacts (a receipt, a not-applied world-state delta
// preview, and a DEMA report) as ONE injected emission result, it re-verifies that emission (which
// transitively re-verifies harness → pulse → composition → signature-backed genesis anchor),
// independently re-derives EACH artifact's content hash, refuses any tampered artifact, and renders one
// operator cockpit view: mission status, the accepted/rejected pulse gates, the not-applied world-state
// delta summary, the DEMA report, and the what-happened / what-did-not-happen / next-safe-action lines.
//
// Honesty boundary: no new intelligence — truth display only. It composes the shipped emission kernel and
// re-implements none of its logic; it re-derives NO artifact from the harness and asserts nothing the
// verified artifacts do not already state. It reads no file (the CLI/adapter loads the three JSON
// artifacts; this kernel takes them injected), executes nothing, applies no world-state, records nothing
// live, and invokes no model, network, daemon, wallet, mint, or federation.
//
// Pure kernel: no fs / network / process / clock / random. now_iso is INJECTED (defaults to null).
// createHash is a deterministic digest; stableStringify mirrors the emission kernel's canonical form.

import { createHash } from "node:crypto";
import {
  verifyNode0LocalMissionArtifactEmissionPreview,
  ARTIFACT_NAMES,
} from "./node0-local-mission-artifact-emission-preview.js";

export const NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA = "bizra.dema.node0_mission_pilot_cockpit_preview.v0.1";
export const NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL = "NODE0_MISSION_PILOT_COCKPIT_PREVIEW_MEASURED_REPO";
export const NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE = "GO: node0 mission pilot cockpit preview";

export const COCKPIT_VIEW_SCHEMA = `${NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA}.cockpit_view`;
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

// All-false boundary invariant. These keys mirror the capability-truth-registry row boundary — keep them
// all false; flipping any one is an execution claim.
export function node0MissionPilotCockpitPreviewBoundary() {
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
  const keys = Object.keys(node0MissionPilotCockpitPreviewBoundary());
  return (
    !!b &&
    typeof b === "object" &&
    !Array.isArray(b) &&
    Object.keys(b).length === keys.length &&
    keys.every((k) => b[k] === false)
  );
}

// Content-address one body: freeze `{ ...body, content_hash }` bound over the WHOLE body.
function contentAddress(body) {
  return Object.freeze({ ...body, content_hash: `sha256:${sha256(stableStringify(body))}` });
}

// Independently re-derive each artifact's content hash and collect per-artifact rejections. This is the
// cockpit's own tamper check — it never trusts the emission's self-report; it recomputes.
function scanArtifacts(emission) {
  const blocked_by = [];
  const artifacts = emission?.artifacts;
  for (const name of ARTIFACT_NAMES) {
    const art = artifacts?.[name];
    if (!art || typeof art !== "object") {
      blocked_by.push(`missing_artifact:${name}`);
      continue;
    }
    const { content_hash: aHash, ...aBody } = art;
    if (!CONTENT_HASH_RE.test(aHash || "")) {
      blocked_by.push(`artifact_hash_malformed:${name}`);
    } else if (aHash !== `sha256:${sha256(stableStringify(aBody))}`) {
      blocked_by.push(`tampered_artifact:${name}`);
    }
    if (art.committed_live !== false) blocked_by.push(`artifact_committed_live:${name}`);
  }
  return blocked_by;
}

// Render the read-only cockpit view. PURE DISPLAY: every field is passed through from the verified
// artifacts (and the pulse ladder embedded in the emission) — nothing is invented. Content-addressed so
// the same emission always renders the same view hash.
export function deriveCockpitView(emission) {
  const artifacts = emission?.artifacts ?? {};
  const receipt = artifacts.receipt ?? null;
  const wsd = artifacts.world_state_delta_preview ?? null;
  const dr = artifacts.dema_report ?? null;

  // The pulse ladder is the already-computed, hash-bound stage map carried inside the emission.
  const pulse = emission?.harness_result?.pulse_verdict ?? null;
  const stages = Array.isArray(pulse?.stage_results) ? pulse.stage_results : [];
  const accepted = stages.filter((s) => s && s.ok === true).map((s) => s.stage);
  const rejected = stages.filter((s) => !s || s.ok !== true).map((s) => s && s.stage).filter(Boolean);
  // Furthest stage reached in ladder order (last accepted before any rejection); null if none passed.
  let reached_station = null;
  for (const s of stages) {
    if (s && s.ok === true) reached_station = s.stage;
    else break;
  }

  const gates = Object.freeze({
    ladder: Object.freeze(stages.map((s) => Object.freeze({ stage: s?.stage ?? null, ok: s?.ok === true }))),
    accepted: Object.freeze([...accepted]),
    rejected: Object.freeze([...rejected]),
    reached_station,
    blocked_by: Object.freeze(Array.isArray(pulse?.blocked_by) ? [...pulse.blocked_by] : []),
  });

  const view = {
    schema: COCKPIT_VIEW_SCHEMA,
    mission_status: dr?.status ?? null,
    run_id: emission?.run_id ?? null,
    receipt_hash: receipt?.content_hash ?? null,
    gates,
    world_state_delta_preview: Object.freeze({
      operation: wsd?.operation ?? null,
      target: wsd?.target ?? null,
      applied: wsd?.applied ?? null,
      committed_live: wsd?.committed_live ?? null,
      would_append_receipt: wsd?.declares?.would_append_receipt ?? null,
      receipt_content_hash: wsd?.declares?.receipt_content_hash ?? null,
    }),
    dema_report: Object.freeze({
      status: dr?.status ?? null,
      next_safe_action: dr?.next_safe_action ?? null,
    }),
    // The three operator lines — passed through verbatim from the artifacts, no synthesis.
    what_happened: dr?.what_happened ?? null,
    what_did_not_happen: wsd?.note ?? null,
    next_safe_action: dr?.next_safe_action ?? null,
  };
  return contentAddress(view);
}

// Fail-closed plan. Shape gate only (consent + an emission object); the deep re-verification, per-artifact
// hash re-derivation, and laundering guards run in build so `run` surfaces them in one place. Absence of a
// block is NEVER validation.
export function planNode0MissionPilotCockpitPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_MISSION_PILOT_COCKPIT_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!input.emission || typeof input.emission !== "object") {
    blocked_by.push("missing_emission");
  }
  return Object.freeze({
    schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed cockpit payload. EMBEDS the source emission (so verify can re-run the
// emission anchor → genesis signature) and the rendered, content-addressed cockpit view.
export function buildNode0MissionPilotCockpitPreviewPayload(input) {
  const emission = input?.emission ?? null;
  const now_iso = typeof input?.now_iso === "string" ? input.now_iso : null;
  const blocked_by = [];

  if (!emission || typeof emission !== "object") {
    blocked_by.push("emission_not_object");
  } else {
    // Independent anchor: re-verify the whole emission (→ harness → pulse → composition → genesis signature).
    const ev = verifyNode0LocalMissionArtifactEmissionPreview(emission);
    if (!ev.ok) for (const c of ev.blocked_by || []) blocked_by.push(`emission_verify:${c}`);

    // The cockpit's OWN per-artifact hash re-derivation (refuse tampered artifacts).
    for (const c of scanArtifacts(emission)) blocked_by.push(c);

    // Top-level source laundering guards (committed_live / authority / mint / boundary).
    if (emission.committed_live !== false) blocked_by.push("source_committed_live_true");
    if (emission.authority_delta !== 0) blocked_by.push("source_authority_delta_nonzero");
    if (emission.mint_allowed !== false) blocked_by.push("source_mint_allowed_true");
    if (!boundaryAllFalse(emission.boundary)) blocked_by.push("source_boundary_not_all_false");
  }

  const cockpit_view = deriveCockpitView(emission);
  const cockpit_ready = blocked_by.length === 0;

  const body = {
    schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
    run_id: emission?.run_id ?? null,
    cockpit_view,
    source_emission: emission,
    source_emission_content_hash: emission?.content_hash ?? null,
    generated_at_iso: now_iso,
    boundary: node0MissionPilotCockpitPreviewBoundary(),
    mint_allowed: false,
    authority_delta: 0,
    committed_live: false,
    cockpit_ready,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    what_this_proves:
      "Given the three already-emitted, content-addressed mission artifacts (a receipt, a not-applied world-state delta preview with applied:false, and a DEMA report) as one injected emission result, it re-verified the emission (transitively re-verifying harness → pulse → composition → signature-backed genesis anchor), independently re-derived each artifact's content hash, and rendered ONE read-only operator cockpit view — mission status, the accepted/rejected pulse gates, the not-applied world-state delta summary, the DEMA report status + next safe action, and the what-happened / what-did-not-happen / next-safe-action operator lines — content-addressed and deterministic for the same input. It refuses any tampered artifact.",
    what_this_does_not_prove:
      "It is a pure truth viewer: it adds NO new intelligence, re-derives no artifact from the harness, and asserts nothing the verified artifacts do not already state. It executes nothing, applies no world-state, records nothing live, and invokes no model, network, daemon, wallet, mint, or federation; boundary all-false, authority_delta 0, committed_live false. A rendered cockpit view means the artifacts are content-addressed and internally consistent and the upstream emission anchor verifies — NOT that the mission ran or that its claims are true.",
  };
  return contentAddress(body);
}

// Body-bound re-derivation verifier. Re-derives the cockpit content hash AND the cockpit-view hash,
// re-checks EACH artifact hash (refuse tampered artifacts), binds the rendered view to the current source,
// re-runs the emission verify on the embedded source (independent anchor → genesis signature), and
// fail-closed rejects committed_live / authority / mint / boundary laundering on the cockpit body.
export function verifyNode0MissionPilotCockpitPreview(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) blocked_by.push("content_hash_mismatch");
  if (payload.schema !== NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (payload.committed_live !== false) blocked_by.push("committed_live_true");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");

  // Cockpit view internal consistency (content-addressed display object).
  const view = payload.cockpit_view;
  if (!view || typeof view !== "object") {
    blocked_by.push("cockpit_view_missing");
  } else {
    const { content_hash: vHash, ...vBody } = view;
    if (vHash !== `sha256:${sha256(stableStringify(vBody))}`) blocked_by.push("cockpit_view_hash_mismatch");
  }

  // Source emission: hash-ref binding, per-artifact tamper re-check, independent anchor, view-vs-source bind.
  const emission = payload.source_emission;
  if (!emission || typeof emission !== "object") {
    blocked_by.push("source_emission_missing");
  } else {
    if (payload.source_emission_content_hash !== (emission.content_hash ?? null)) {
      blocked_by.push("source_emission_hash_ref_mismatch");
    }
    for (const c of scanArtifacts(emission)) blocked_by.push(c);
    const ev = verifyNode0LocalMissionArtifactEmissionPreview(emission);
    if (!ev.ok) for (const c of ev.blocked_by || []) blocked_by.push(`emission_verify:${c}`);
    if (view && typeof view === "object") {
      const expected = deriveCockpitView(emission);
      if (expected.content_hash !== view.content_hash) blocked_by.push("cockpit_view_source_mismatch");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
    run_id: payload.run_id ?? null,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Orchestrator the review gate consumes: plan → build → verify → tamper-reject, failing closed.
export function runNode0MissionPilotCockpitPreview({ consent, input } = {}) {
  const plan = planNode0MissionPilotCockpitPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
      truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
      status: "blocked_pending_consent",
      run_id: null,
      content_hash: null,
      cockpit_view: null,
      boundary: node0MissionPilotCockpitPreviewBoundary(),
      mint_allowed: false,
      authority_delta: 0,
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0MissionPilotCockpitPreviewPayload(input);
  const verified = verifyNode0MissionPilotCockpitPreview(payload);
  const blocked_by = [];
  if (!payload.cockpit_ready) blocked_by.push(...payload.blocked_by);
  if (!verified.ok) blocked_by.push(...verified.blocked_by);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_SCHEMA,
    truth_label: NODE0_MISSION_PILOT_COCKPIT_PREVIEW_TRUTH_LABEL,
    status: blocked_by.length === 0 ? "verified_preview_cockpit" : "blocked_preview_cockpit",
    run_id: payload.run_id,
    content_hash: payload.content_hash,
    cockpit_view: payload.cockpit_view,
    boundary: payload.boundary,
    mint_allowed: false,
    authority_delta: 0,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}
