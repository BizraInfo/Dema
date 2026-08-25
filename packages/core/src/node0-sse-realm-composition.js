// NODE0-REALM-SSE-COMPOSITION-1A — the join, proven.
//
// Three laws already frozen separately:
//   · NODE0-SSE-ENVELOPE-STREAM-1A  — the transport: hash-chained envelopes,
//     consecutive seq from 1, heartbeats carry nothing, one terminal last.
//   · DRS-REALM-CONTRACTS-1A        — the wire law + frame decode (§6.1/§13).
//   · DRS-PRESENCE-REDUCER-2A       — the projection: only law-surviving
//     transcripts render familiar state; everything else renders UNKNOWN.
//
// This kernel composes them and pins THE ONLY NEW THING a composition can
// pin: that a violation born at ANY layer surfaces as a NAMED block at the
// END of the pipe and degrades the render to UNKNOWN. No layer may be
// bypassed; no refusal may be averaged away; no stale success may survive.
//
// Boundary: all-false. Pure functions; bytes, credentials and time are
// injected inputs. No socket, server, port, daemon, runtime, key, token,
// wallet, federation, or live DEMA_HOME mutation exists here.

import { parseSseFrames, verifySseStream } from "./node0-sse-envelope-stream.js";
import {
  decodeRealmFrame,
  REALM_FRAME_LIMITS,
} from "./drs-realm-contracts.js";
import { deriveRenderRequest } from "./drs-presence-reducer.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_REALM_SSE_COMPOSITION_SCHEMA =
  "bizra.dema.node0_sse_realm_composition.v0.1";
export const NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL =
  "NODE0_REALM_SSE_COMPOSITION_MEASURED_REPO";
export const NODE0_REALM_SSE_COMPOSITION_GO_PHRASE =
  "GO: node0 sse realm composition";
export const NODE0_REALM_SSE_COMPOSITION_SCOPE = "node0_sse_realm_composition";

const TEXT_ENCODER = new TextEncoder();

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Consume one SSE text document as a Realm projection feed.
 *
 * Layer order is the proof: transport chain → frame law → wire law →
 * projection. The first refusing layer names itself (`sse:`, `sse-chain:`,
 * `frame:`, `realm:`); later layers do not run past a broken predecessor,
 * and the render degrades to UNKNOWN with no-stale-success inherited from
 * the reducer.
 */
export function consumeSseRealmComposition({
  sse_text,
  admitted,
  admission,
  peer,
  now_ms,
  hash,
} = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  const blocked = [];

  // Layer 1 — SSE wire parse.
  const parsed = parseSseFrames(sse_text);
  if (!parsed.ok) blocked.push(...parsed.blocked_by.map((c) => `sse:${c}`));

  // Layer 2 — envelope chain: consecutive seq from 1, hashes link, exactly
  // one terminal, nothing after it.
  let chain = null;
  if (parsed.ok) {
    chain = verifySseStream(parsed.events);
    if (!chain.ok) blocked.push(...chain.blocked_by.map((c) => `sse-chain:${c}`));
  }

  // Layer 3 — realm frame law on every state/error payload. Heartbeats
  // contribute liveness only; the terminal is transport, not transcript.
  const frames = [];
  if (chain?.ok) {
    for (const ev of parsed.events) {
      if (ev.kind === "stream_end" || ev.kind === "heartbeat") continue;
      let bytes;
      try {
        bytes = TEXT_ENCODER.encode(JSON.stringify(ev.payload));
      } catch {
        blocked.push("frame:payload_unserializable");
        continue;
      }
      const d = decodeRealmFrame(bytes);
      if (!d.ok) blocked.push(`frame:${d.reason_code}`);
      else frames.push(d.value);
    }
  }

  // Layer 4 — realm admission/wire law + projection in one derivation.
  let derivation = null;
  if (blocked.length === 0 && frames.length > 0) {
    derivation = deriveRenderRequest({
      transcript: frames,
      admitted: admitted ?? admission,
      peer,
      now_ms,
    });
    blocked.push(...derivation.blocked_by.map((c) => `realm:${c}`));
  }

  const ok = blocked.length === 0;
  const render = derivation?.render_request ?? null;
  const body = {
    wire_text: sse_text,
    admitted_used: admitted ?? admission ?? null,
    peer_used: peer ?? null,
    now_ms_used: now_ms ?? null,
    schema: NODE0_REALM_SSE_COMPOSITION_SCHEMA,
    scope: NODE0_REALM_SSE_COMPOSITION_SCOPE,
    transaction_id: "node0-sse-realm-composition",
    evidence_class: "COMPOSED_PREVIEW",
    frame_limits: REALM_FRAME_LIMITS,
    layers: {
      sse_parse: parsed.ok ? "OK" : "REFUSED",
      sse_chain: chain ? (chain.ok ? "VERIFIED" : "REFUSED") : "NOT_REACHED",
      frame_law: chain?.ok ? (blocked.some((b) => b.startsWith("frame:")) ? "REFUSED" : "OK") : "NOT_REACHED",
      realm_projection: derivation ? (ok ? "VERIFIED_DONE_OR_DERIVED" : "REFUSED") : "NOT_REACHED",
    },
    event_count: parsed.events.length ?? 0,
    ok,
    walk: derivation?.walk ?? null,
    simulated: render?.simulated === true,
    visible_state: render?.semantic_state ?? "UNKNOWN",
    render,
    boundary: Object.freeze({
      execution_allowed: false,
      mint_allowed: false,
      network_used: false,
      daemon_started: false,
      authority_delta: 0,
    }),
    what_this_proves:
      "That the SSE transport chain, the realm frame/wire law and the presence projection COMPOSE: any layer's refusal surfaces by name and the derived render degrades to UNKNOWN — never a familiar state, never stale success.",
    what_this_does_not_prove:
      "It does not prove a server, socket or persistent connection exists; that any bytes were sent over a network; that the payload anchor resists a forged body with recomputed transport hashes (the known no-independent-anchor ceiling); or that Node0 is closed.",
  };
  return Object.freeze({ ...body, blocked_by: Object.freeze(blocked), content_hash: hash(body) });
}

// ── universal slice contract ─────────────────────────────────────────────────

export function runNode0RealmSseComposition({ consent, input } = {}) {
  const plan = planNode0RealmSseComposition({ consent, input });
  if (!plan.ok) {
    return Object.freeze({
      ok: false,
      schema: NODE0_REALM_SSE_COMPOSITION_SCHEMA,
      truth_label: NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL,
      boundary: node0RealmSseCompositionBoundary(),
      blocked_by: Object.freeze(plan.blocked_by),
      content_hash: null,
    });
  }

  const payload = buildNode0RealmSseCompositionPayload(input);
  const verified = verifyNode0RealmSseComposition(payload);
  if (!verified.ok) return Object.freeze({ ...payload, ok: false, blocked_by: [`verify_failed:${verified.reason}`] });

  // Internal negative control: a tampered copy MUST fail verification.
  const tampered = JSON.parse(JSON.stringify(payload));
  tampered.truth_label = "TAMPER_PROBE";
  if (verifyNode0RealmSseComposition(tampered).ok) {
    return Object.freeze({ ...payload, ok: false, blocked_by: ["tamper_probe_passed"] });
  }

  const result = payload.result;
  return Object.freeze({
    ok: result.ok && verified.ok,
    schema: NODE0_REALM_SSE_COMPOSITION_SCHEMA,
    truth_label: NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: node0RealmSseCompositionBoundary(),
    blocked_by: result.blocked_by,
    visible_state: result.visible_state,
    layers: result.layers,
    walk: result.walk,
    render: result.render,
  });
}

export function node0RealmSseCompositionBoundary() {
  return Object.freeze({
    execution_allowed: false,
    mint_allowed: false,
    network_used: false,
    daemon_started: false,
    authority_delta: 0,
  });
}

export function planNode0RealmSseComposition({ consent, input } = {}) {
  if (consent !== NODE0_REALM_SSE_COMPOSITION_GO_PHRASE) {
    return Object.freeze({ ok: false, blocked_by: ["HALTED_FATE"] });
  }
  if (!isPlainObject(input) || typeof input.sse_text !== "string") {
    return Object.freeze({ ok: false, blocked_by: ["input_sse_text_missing"] });
  }
  return Object.freeze({ ok: true, blocked_by: [], plan: "parse→chain→frame→realm→render" });
}

export function buildNode0RealmSseCompositionPayload(input) {
  const result = consumeSseRealmComposition({ ...input, hash: sha256CanonicalJsonV1 });
  const body = {
    schema: NODE0_REALM_SSE_COMPOSITION_SCHEMA,
    truth_label: NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL,
    go_phrase_binding: NODE0_REALM_SSE_COMPOSITION_GO_PHRASE.length,
    result: JSON.parse(JSON.stringify(result)),
  };
  return Object.freeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

export function verifyNode0RealmSseComposition(payload) {
  if (!isPlainObject(payload)) return Object.freeze({ ok: false, reason: "payload_not_object" });
  const { content_hash, ...body } = payload;
  if (content_hash !== sha256CanonicalJsonV1(body)) {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch" });
  }
  if (body.schema !== NODE0_REALM_SSE_COMPOSITION_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (body.truth_label !== NODE0_REALM_SSE_COMPOSITION_TRUTH_LABEL) {
    return Object.freeze({ ok: false, reason: "truth_label_mismatch" });
  }
  const rederived = consumeSseRealmComposition({
    sse_text: body.result.wire_text,
    admitted: body.result.admitted_used,
    peer: body.result.peer_used,
    now_ms: body.result.now_ms_used,
    hash: sha256CanonicalJsonV1,
  });
  if (rederived.content_hash !== body.result.content_hash) {
    return Object.freeze({ ok: false, reason: "semantic_rederivation_mismatch" });
  }
  return Object.freeze({ ok: true, reason: null });
}
