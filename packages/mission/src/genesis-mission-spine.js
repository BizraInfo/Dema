// GENESIS-MISSION-SPINE-1A — contract BIZRA-GENESIS-LOOP-1A §5, stages 1–5,
// composed entirely from shipped kernels and HALTING AT THE CONSENT GATE.
//
//   INTENTION      → compileIntentPacket (fail-closed atoms; unknown intent refuses)
//   RISK_ENVELOPE  → GENESIS-MISSION-001 stays inside reversible-local effect:
//                    every atom's risk class must be LOW or MEDIUM. HIGH (SIGN,
//                    MERGE, …) refuses here — a spine walk can never smuggle a
//                    sovereign-class act toward the gate.
//   PREVIEW        → buildDemaReversibleFileStewardPayload seals the effect as a
//                    content-addressed job; its content_hash IS the preview hash
//                    (§5.4 — machine-readable, hash-bound, undo-bearing).
//   CONSENT_GATE   → evaluateCorridorSeasonConsentBridge, with
//                    prepared_intent_hash = preview_hash. §5.5: the human
//                    consents to THIS preview, not to a category of work — a
//                    material change to the effect changes the preview hash,
//                    which changes the consent context, which invalidates any
//                    previously captured phrase. That law is enforced by the
//                    existing root-bound consent evaluator, not re-implemented.
//
// THE HALT IS STRUCTURAL. This module imports no execution surface: not the
// steward execution module, not the season store, not fs, not child_process.
// Season state and the executing repository arrive INJECTED from the caller's
// trusted seams. PERMIT_PREVIEW is the terminal success of this slice and
// grants nothing — no nonce, no pending effect, no transaction, no mutation,
// authority_delta 0. Stages 6–9 (bounded action, judge-free verification,
// receipt, undo) are later, separately consented acts.
//
// Pure kernel. Deterministic given its inputs. No disk, no clock, no network.

import { compileIntentPacket } from "../../core/src/node0-task-decomposition-engine.js";
import { buildDemaReversibleFileStewardPayload } from "../../core/src/dema-reversible-file-steward.js";
import { evaluateCorridorSeasonConsentBridge } from "./corridor-season-consent-bridge.js";

export const GENESIS_MISSION_SPINE_SCHEMA = "bizra.dema.genesis_mission_spine.v0.1";
export const GENESIS_MISSION_SPINE_TRUTH_LABEL = "GENESIS_MISSION_SPINE_PREVIEW";

/// The walk's closed stage vocabulary, in walk order. A refusal names the stage
/// that refused; a stage not listed here cannot be reported.
export const SPINE_STAGES = Object.freeze([
  "INTENTION",
  "RISK_ENVELOPE",
  "PREVIEW",
  "CONSENT_GATE",
]);

/// GENESIS-MISSION-001's risk envelope: reversible local effect only.
export const SPINE_RISK_ENVELOPE = Object.freeze(["LOW", "MEDIUM"]);

function frozenResult(over = {}) {
  return Object.freeze({
    schema: GENESIS_MISSION_SPINE_SCHEMA,
    truth_label: GENESIS_MISSION_SPINE_TRUTH_LABEL,
    ok: false,
    stage: null,
    verdict: "REFUSED",
    reason: null,
    intent_packet_hash: null,
    atom_count: 0,
    risk_classes: Object.freeze([]),
    preview: null,
    preview_hash: null,
    consent: null,
    // The non-grant invariants — true on EVERY path, by construction.
    authority_delta: 0,
    grants_execution: false,
    effect_executed: false,
    nonce_claimed: false,
    pending_effect_created: false,
    blocked_by: Object.freeze([]),
    ...over,
  });
}

/**
 * Walk GENESIS-MISSION-001's spine from a raw human intention to the consent
 * gate, and stop there.
 *
 * `seasonLoad` is the result of the authoritative store loader (loadSeasonHead)
 * and `executingRepository` the result of the trusted git seam — both injected,
 * exactly as the consent bridge requires, so the spine stays pure and can never
 * select its own authority (a state cannot prove its own binding).
 */
export function walkGenesisMissionSpine({
  intention,
  effect,
  seasonLoad,
  executingRepository,
  actionId,
  corridorContext,
  presentedPhrase,
  presentedConsentContextHash,
  now,
  usedNonces = [],
  compileIntent = compileIntentPacket,
  buildPreview = buildDemaReversibleFileStewardPayload,
  evaluateGate = evaluateCorridorSeasonConsentBridge,
} = {}) {
  // ── 1. INTENTION — language is untrusted until compiled ──
  const packet = compileIntent({ input: typeof intention === "string" ? intention : "" });
  if (!packet || packet.route_eligible !== true) {
    return frozenResult({
      stage: "INTENTION",
      reason: "intent_not_route_eligible",
      intent_packet_hash: packet?.content_hash ?? null,
      atom_count: packet?.atom_count ?? 0,
      blocked_by: Object.freeze([...(packet?.blocked_by ?? [])]),
    });
  }

  // ── 2. RISK_ENVELOPE — reversible-local only ──
  const riskClasses = Object.freeze([
    ...new Set(packet.compiled_atoms.map((a) => a.risk_class)),
  ]);
  const outside = riskClasses.filter((c) => !SPINE_RISK_ENVELOPE.includes(c));
  if (outside.length > 0) {
    return frozenResult({
      stage: "RISK_ENVELOPE",
      reason: "risk_exceeds_reversible_envelope",
      intent_packet_hash: packet.content_hash,
      atom_count: packet.atom_count,
      risk_classes: riskClasses,
      blocked_by: Object.freeze(outside.map((c) => `risk:${c}`)),
    });
  }

  // ── 3. PREVIEW — seal the effect as a content-addressed reversible job ──
  const preview = buildPreview(effect ?? {});
  const previewExecutable =
    preview &&
    preview.atom_count > 0 &&
    preview.bounded === true &&
    preview.all_reversible === true &&
    preview.all_clean === true &&
    preview.executable_count === preview.atom_count;
  if (!previewExecutable) {
    return frozenResult({
      stage: "PREVIEW",
      reason: "preview_not_executable",
      intent_packet_hash: packet.content_hash,
      atom_count: packet.atom_count,
      risk_classes: riskClasses,
      blocked_by: Object.freeze(
        [
          preview?.atom_count > 0 ? null : "preview_atoms_empty",
          preview?.bounded === true ? null : "preview_not_bounded",
          preview?.all_reversible === true ? null : "preview_atom_not_reversible",
          preview?.all_clean === true ? null : "preview_content_not_clean",
        ].filter(Boolean),
      ),
    });
  }

  // ── 4. CONSENT_GATE — §5.5: consent binds THIS preview ──
  const gate = evaluateGate({
    seasonLoad,
    executingRepository,
    actionId,
    corridorContext: {
      ...(corridorContext ?? {}),
      prepared_intent_hash: preview.content_hash,
    },
    presentedPhrase,
    presentedConsentContextHash,
    now,
    usedNonces,
  });

  const consent = Object.freeze({
    stage: gate?.stage ?? null,
    verdict: gate?.verdict ?? "REFUSED",
    reason: gate?.reason ?? null,
    required_phrase: gate?.required_phrase ?? null,
    consent_context_hash: gate?.consent_context_hash ?? null,
    consent_presented: gate?.consent_presented === true,
    consent_verified: gate?.consent_verified === true,
  });

  return frozenResult({
    ok: gate?.ok === true && gate?.verdict === "PERMIT_PREVIEW",
    stage: "CONSENT_GATE",
    verdict: consent.verdict,
    reason: gate?.reason ?? null,
    intent_packet_hash: packet.content_hash,
    atom_count: packet.atom_count,
    risk_classes: riskClasses,
    preview,
    preview_hash: preview.content_hash,
    consent,
    blocked_by: Object.freeze([...(gate?.blocked_by ?? [])]),
  });
}
