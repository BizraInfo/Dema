// NODE0-SSE-ENVELOPE-STREAM-1A — Pure hash-chained SSE event-envelope stream contract: ordered, gap-detecting, tamper-evident, exactly-once terminal — the verifiable wire law for the PROD-02 persistent transport.
//
// WHAT THIS SLICE IS: the articulation characterization of the composition
// "envelope pattern + persistent connection + server-sent events". A stream is
// provable, not felt: every SSE frame carries a content-addressed envelope that
// binds its predecessor by hash, so any receiver — including one that joined
// late or reconnected — can independently verify ORDER (seq 1..n, no gaps),
// COMPLETENESS (exactly one terminal event, nothing after it), LIVENESS
// (heartbeats advance seq while carrying no application state), and INTEGRITY
// (any flipped byte breaks the chain). This is the wire law PROD-02's execution
// transport must speak; the transport itself (sockets, ports, runtime) is out
// of scope and stays forbidden here.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.
// Hash-bearing: the ONE canonical byte contract (packages/canon) — no local serializer.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_SSE_ENVELOPE_STREAM_SCHEMA = "bizra.dema.node0_sse_envelope_stream.v0.1";
export const NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL = "NODE0_SSE_ENVELOPE_STREAM_MEASURED_REPO";
export const NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE = "GO: node0 sse envelope stream preview";

export const NODE0_SSE_STREAM_EVENT_SCHEMA = "bizra.dema.node0_sse_stream_event.v0.1";

// Closed kind set. An unlisted kind is refused, not tolerated: an open set would
// let two processes agree on bytes while disagreeing on meaning.
export const NODE0_SSE_STREAM_EVENT_KINDS = Object.freeze([
  "state", // application state transition — carries a payload
  "heartbeat", // liveness only — payload MUST be exactly {}
  "error", // bounded failure report — carries a payload
  "stream_end", // terminal — exactly once, always last
]);

const STREAM_ID_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function refuse(...codes) {
  return Object.freeze({ ok: false, outcome: "REFUSED", blocked_by: Object.freeze([...new Set(codes)]) });
}

// ── event construction ──────────────────────────────────────────────────────

/**
 * Build ONE hash-bound stream event. `previousEventHash` binds it to its
 * predecessor (null for the genesis event). The hash covers the whole body
 * MINUS the hash field under the repo's single canonical byte contract.
 */
export function buildSseStreamEvent({ streamId, seq, kind, payload, previousEventHash = null } = {}) {
  if (typeof streamId !== "string" || !STREAM_ID_RE.test(streamId)) {
    throw new Error("stream_id_malformed");
  }
  if (!Number.isInteger(seq) || seq < 1) throw new Error("seq_malformed");
  if (!NODE0_SSE_STREAM_EVENT_KINDS.includes(kind)) throw new Error("event_kind_unknown");
  if (!isPlainObject(payload)) throw new Error("payload_not_object");
  if (kind === "heartbeat" && Object.keys(payload).length > 0) {
    throw new Error("heartbeat_carries_state");
  }
  const body = {
    schema: NODE0_SSE_STREAM_EVENT_SCHEMA,
    stream_id: streamId,
    seq,
    kind,
    payload,
    previous_event_hash: previousEventHash ?? null,
  };
  const event_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, event_hash });
}

/**
 * Build a complete stream from ordered frames: seqs are derived (callers cannot
 * create gaps), hashes are chained, and the stream commits to its final event
 * hash. Frames are `{ kind, payload }`; the LAST frame should be `stream_end`.
 */
export function buildSseStream({ streamId, frames } = {}) {
  if (typeof streamId !== "string" || !STREAM_ID_RE.test(streamId)) {
    throw new Error("stream_id_malformed");
  }
  if (!Array.isArray(frames) || frames.length === 0) throw new Error("frames_empty");
  const events = [];
  let previous = null;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!isPlainObject(f) || !NODE0_SSE_STREAM_EVENT_KINDS.includes(f.kind)) {
      throw new Error(`frame_${i}_malformed`);
    }
    const ev = buildSseStreamEvent({
      streamId, seq: i + 1, kind: f.kind, payload: f.payload ?? {}, previousEventHash: previous,
    });
    events.push(ev);
    previous = ev.event_hash;
  }
  return Object.freeze({
    stream_id: streamId,
    events: Object.freeze(events),
    event_count: events.length,
    stream_hash: previous,
    terminal_seq: events[events.length - 1].kind === "stream_end" ? events.length : null,
  });
}

// ── stream verification (fail-closed, order matters only for diagnostics) ───

function verifyOneEventEnvelope(ev, expectedSeq, prevHash, blocked, label) {
  if (!isPlainObject(ev)) { blocked.push(`${label}:event_not_object`); return null; }
  const { event_hash, ...body } = ev;
  if (typeof event_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(event_hash)) {
    blocked.push(`${label}:event_hash_malformed`);
    return null;
  }
  if (body.schema !== NODE0_SSE_STREAM_EVENT_SCHEMA) blocked.push(`${label}:schema_mismatch`);
  if (!Number.isInteger(body.seq) || body.seq !== expectedSeq) {
    blocked.push(`${label}:${!Number.isInteger(body.seq) ? "seq_malformed" : "seq_gap_or_duplicate"}`);
  }
  if (!NODE0_SSE_STREAM_EVENT_KINDS.includes(body.kind)) blocked.push(`${label}:event_kind_unknown`);
  if (!isPlainObject(body.payload)) blocked.push(`${label}:payload_not_object`);
  else if (body.kind === "heartbeat" && Object.keys(body.payload).length > 0) {
    blocked.push(`${label}:heartbeat_carries_state`);
  }
  if ((body.previous_event_hash ?? null) !== (prevHash ?? null)) blocked.push(`${label}:chain_break`);
  if (sha256CanonicalJsonV1(body) !== event_hash) blocked.push(`${label}:event_hash_mismatch`);
  return event_hash;
}

/**
 * Verify a received event sequence against every law this slice names:
 * shape, closed kinds, consecutive seq from 1, hash-chain linkage, per-event
 * tamper evidence, heartbeat purity, and exactly-one-terminal-at-the-end.
 * UNKNOWN/absent evidence refuses — never averages into a pass.
 */
export function verifySseStream(events) {
  if (!Array.isArray(events) || events.length === 0) return refuse("events_empty");
  const blocked = [];
  let prevHash = null;
  let terminalSeen = false;

  for (let i = 0; i < events.length; i++) {
    const label = `event_${i + 1}`;
    if (terminalSeen) { blocked.push(`${label}:after_terminal`); continue; }
    const hash = verifyOneEventEnvelope(events[i], i + 1, prevHash, blocked, label);
    if (hash === null) { terminalSeen = false; continue; }
    if (events[i].kind === "stream_end") terminalSeen = true;
    prevHash = hash;
  }

  if (!terminalSeen) blocked.push("terminal_missing");
  return Object.freeze({
    ok: blocked.length === 0,
    outcome: blocked.length === 0 ? "OK" : "REFUSED",
    blocked_by: Object.freeze(blocked),
    event_count: events.length,
    stream_id: isPlainObject(events[0]) ? (events[0].stream_id ?? null) : null,
    ...(blocked.length === 0 ? { stream_hash: prevHash } : {}),
  });
}

// ── SSE wire serialization (the articulation layer) ─────────────────────────

/** Serialize events to the SSE wire format. The data line carries the WHOLE
 * canonical envelope, so the wire bytes themselves are verifiable downstream. */
export function serializeSseFrames(events) {
  const frames = [];
  for (const ev of events) {
    // SSE frames are terminated by a BLANK line — the terminator belongs to
    // every frame including the last.
    frames.push(`event: ${ev.kind}\nid: ${ev.seq}\ndata: ${JSON.stringify(ev)}\n\n`);
  }
  return frames.join("");
}

/** Parse SSE wire text back into envelopes, refusing malformed frames. */
export function parseSseFrames(text) {
  if (typeof text !== "string") return refuse("wire_not_text");
  const blocked = [];
  const events = [];
  const blocks = text.split("\n\n").filter((b) => b.length > 0);
  for (let b = 0; b < blocks.length; b++) {
    // Empty lines inside a block are legal SSE noise and are ignored; only
    // NON-empty lines must be well-formed `field: value`.
    const lines = blocks[b].split("\n").filter((l) => l.length > 0);
    let kind = null, id = null, data = null;
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) { blocked.push(`frame_${b + 1}:line_malformed`); continue; }
      const field = line.slice(0, idx), value = line.slice(idx + 1).trimStart();
      if (field === "event") kind = value;
      else if (field === "id") id = value;
      else if (field === "data") data = value;
      else blocked.push(`frame_${b + 1}:unknown_field`);
    }
    if (kind === null || id === null || data === null) {
      blocked.push(`frame_${b + 1}:incomplete`);
      continue;
    }
    try {
      const ev = JSON.parse(data);
      if (String(ev.seq) !== id) blocked.push(`frame_${b + 1}:id_seq_mismatch`);
      if (ev.kind !== kind) blocked.push(`frame_${b + 1}:kind_mismatch`);
      events.push(ev);
    } catch {
      blocked.push(`frame_${b + 1}:data_unparseable`);
    }
  }
  if (events.length === 0 && blocked.length > 0) return refuse(...blocked);
  return Object.freeze({ ok: blocked.length === 0, outcome: blocked.length === 0 ? "OK" : "REFUSED", blocked_by: Object.freeze(blocked), events: Object.freeze(events) });
}

// ── all-false boundary invariant ─────────────────────────────────────────────

export function node0SseEnvelopeStreamBoundary() {
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

// ── consent gate (exact phrase only) ─────────────────────────────────────────

export function planNode0SseEnvelopeStream({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_SSE_ENVELOPE_STREAM_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    if (typeof input.stream_id !== "string" || !STREAM_ID_RE.test(input.stream_id)) {
      blocked_by.push("stream_id_malformed");
    }
    if (!Array.isArray(input.frames) || input.frames.length === 0) {
      blocked_by.push("frames_empty");
    } else if (
      input.frames.some((f) => !isPlainObject(f) || !NODE0_SSE_STREAM_EVENT_KINDS.includes(f.kind))
    ) {
      blocked_by.push("frame_kind_unknown");
    }
  }
  return Object.freeze({
    schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
    truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// ── content-addressed proof payload ──────────────────────────────────────────

/**
 * Body carries the caller's frames PLUS a compact stream commitment
 * (event_count, stream_hash, terminal_seq). Verify re-derives the events from
 * the frames alone and holds the commitment against the derivation — a forged
 * frame OR a forged commitment breaks verification even before the outer
 * content_hash is consulted.
 */
export function buildNode0SseEnvelopeStreamPayload(input) {
  const stream = buildSseStream({ streamId: input.stream_id, frames: input.frames });
  const body = {
    schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
    truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    stream: {
      stream_id: stream.stream_id,
      event_count: stream.event_count,
      stream_hash: stream.stream_hash,
      terminal_seq: stream.terminal_seq,
    },
    boundary: node0SseEnvelopeStreamBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

/**
 * Body-bound re-derivation verifier. Three independent layers must agree:
 *  1. the outer content_hash recomputes over the body minus its hash field;
 *  2. the events REBUILT from body.input.frames verify under every stream law;
 *  3. the rebuilt commitments equal the stored body.stream commitments.
 */
export function verifyNode0SseEnvelopeStream(payload) {
  if (!isPlainObject(payload)) return refuse("payload_not_object");
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string") return refuse("content_hash_missing");
  if (sha256CanonicalJsonV1(body) !== content_hash) return refuse("content_hash_mismatch");

  let rebuilt;
  try {
    rebuilt = buildSseStream({ streamId: body.input?.stream_id, frames: body.input?.frames });
  } catch (err) {
    return refuse(`stream_derivation_refused:${err?.message ?? "unknown"}`);
  }
  const streamVerdict = verifySseStream(rebuilt.events);
  if (!streamVerdict.ok) return refuse(...streamVerdict.blocked_by.map((b) => `stream:${b}`));

  const s = body.stream;
  if (
    !isPlainObject(s) ||
    s.event_count !== rebuilt.event_count ||
    s.stream_hash !== rebuilt.stream_hash ||
    s.terminal_seq !== rebuilt.terminal_seq
  ) {
    return refuse("stream_commitment_mismatch");
  }
  if (body.boundary && Object.values(body.boundary).some((v) => v !== false)) {
    return refuse("boundary_not_all_false");
  }
  return Object.freeze({
    ok: true, outcome: "OK", blocked_by: Object.freeze([]),
    event_count: rebuilt.event_count, stream_hash: rebuilt.stream_hash,
    terminal_seq: rebuilt.terminal_seq,
  });
}

// ── orchestrator consumed by the review gate ─────────────────────────────────

/**
 * Run plan -> build -> verify -> tamper-reject controls, then return the proof
 * envelope. The negative controls are load-bearing: a verifier that accepted
 * anything roughly the right shape would still produce ok:true here otherwise.
 */
export function runNode0SseEnvelopeStream({ consent, input } = {}) {
  const blocked_by = [];
  const plan = planNode0SseEnvelopeStream({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false, schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
      truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
      boundary: node0SseEnvelopeStreamBoundary(),
      blocked_by: plan.blocked_by,
    });
  }

  const payload = buildNode0SseEnvelopeStreamPayload(input);
  const verdict = verifyNode0SseEnvelopeStream(payload);
  if (!verdict.ok) {
    return Object.freeze({
      ok: false, schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
      truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
      boundary: node0SseEnvelopeStreamBoundary(),
      blocked_by: verdict.blocked_by,
    });
  }

  // Negative control 1: a flipped content_hash must be rejected.
  const tamperedHash = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  if (verifyNode0SseEnvelopeStream(tamperedHash).ok) blocked_by.push("tamper_control_hash_failed");

  // Negative control 2: a mutated frame under the ORIGINAL hash must be rejected.
  const mutatedInput = {
    ...input,
    frames: input.frames.map((f, i) => (i === 0 ? { ...f, payload: { ...f.payload, __mutated__: true } } : f)),
  };
  const mutated = { ...payload, input: mutatedInput };
  if (verifyNode0SseEnvelopeStream(mutated).ok) blocked_by.push("tamper_control_frame_failed");

  // Negative control 3: dropping the terminal event must be rejected.
  const noTerminal = buildNode0SseEnvelopeStreamPayload({
    stream_id: input.stream_id,
    frames: input.frames.filter((f) => f.kind !== "stream_end"),
  });
  if (verifyNode0SseEnvelopeStream(noTerminal).ok && input.frames.some((f) => f.kind === "stream_end")) {
    blocked_by.push("tamper_control_terminal_failed");
  }

  if (blocked_by.length > 0) {
    return Object.freeze({
      ok: false, schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
      truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
      boundary: node0SseEnvelopeStreamBoundary(),
      blocked_by: Object.freeze(blocked_by),
    });
  }

  return Object.freeze({
    ok: true,
    schema: NODE0_SSE_ENVELOPE_STREAM_SCHEMA,
    truth_label: NODE0_SSE_ENVELOPE_STREAM_TRUTH_LABEL,
    content_hash: payload.content_hash,
    stream: payload.stream,
    boundary: node0SseEnvelopeStreamBoundary(),
    blocked_by: Object.freeze([]),
  });
}
