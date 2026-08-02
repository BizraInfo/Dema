// PEAK-EVIDENCE-GATHERER-1A — turns gate-run artefacts into evidence-bound signal
// events for `buildPeakSelfLoopPreview`.
//
// This is the caller the peak-self-loop kernel's CEILING note asks for. That kernel
// validates evidence SHAPE and cannot validate BINDING, because purity forbids it from
// reading `source_ref`. This module closes that gap: it computes `source_sha256` from
// the artefact's ACTUAL content, so a shape-valid envelope pointing at a nonexistent or
// altered file can no longer score.
//
// PURITY BY INJECTION — this module imports no `node:fs`. The caller supplies
// `readSource(source_ref) -> string | Buffer | null`, where `null` means unreadable.
// That keeps the module deterministic and lets tests model a hostile world directly.
// Boundary: no network, no child_process, no clock, no write, no execution.

import { createHash } from "node:crypto";

export const PEAK_EVIDENCE_GATHERER_SCHEMA =
  "bizra.dema.peak_evidence_gatherer.v0.1";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readOrNull(readSource, ref) {
  if (typeof readSource !== "function") return null;
  let content;
  try {
    content = readSource(ref);
  } catch {
    return null;
  }
  if (content === null || content === undefined) return null;
  if (typeof content !== "string" && !Buffer.isBuffer(content)) return null;
  return content;
}

/**
 * Bind each candidate to the real content at its `source_ref`.
 * Unreadable sources are excluded, never downgraded into a weaker event.
 */
export function gatherEvidenceSignals({ candidates = [], readSource } = {}) {
  const events = [];
  const excluded = [];
  const seenIds = new Set();

  for (const c of Array.isArray(candidates) ? candidates : []) {
    const id = c && typeof c === "object" && !Array.isArray(c) ? (c.id ?? null) : null;
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      excluded.push(Object.freeze({ id, gap: "not_an_object" }));
      continue;
    }
    if (typeof c.source_ref !== "string" || c.source_ref.trim() === "") {
      excluded.push(Object.freeze({ id, gap: "source_ref_missing" }));
      continue;
    }
    if (seenIds.has(id)) {
      excluded.push(Object.freeze({ id, gap: "duplicate_event_id" }));
      continue;
    }
    const content = readOrNull(readSource, c.source_ref);
    if (content === null) {
      excluded.push(Object.freeze({ id, gap: "source_unreadable" }));
      continue;
    }
    seenIds.add(id);
    events.push(
      Object.freeze({
        id,
        type: c.type ?? "gate_passed",
        weight: 1,
        label: c.label ?? id,
        truth_label: "MEASURED",
        source_ref: c.source_ref,
        source_sha256: sha256(content),
      }),
    );
  }

  return Object.freeze({
    schema: PEAK_EVIDENCE_GATHERER_SCHEMA,
    events: Object.freeze(events),
    excluded: Object.freeze(excluded),
    gathered_count: events.length,
    excluded_count: excluded.length,
  });
}

/**
 * Re-derive every event's hash from the world as it is NOW.
 * Never trusts the hash carried by the event — that is the whole point.
 */
export function verifyEvidenceSignals({ events = [], readSource } = {}) {
  const mismatches = [];
  let verified = 0;

  for (const e of Array.isArray(events) ? events : []) {
    const id = e && typeof e === "object" && !Array.isArray(e) ? (e.id ?? null) : null;
    if (!e || typeof e !== "object" || Array.isArray(e)) {
      mismatches.push(Object.freeze({ id, gap: "not_an_object" }));
      continue;
    }
    const content = readOrNull(readSource, e.source_ref);
    if (content === null) {
      mismatches.push(Object.freeze({ id, gap: "source_unreadable" }));
      continue;
    }
    if (sha256(content) !== e.source_sha256) {
      mismatches.push(Object.freeze({ id, gap: "sha256_mismatch" }));
      continue;
    }
    verified += 1;
  }

  return Object.freeze({
    schema: PEAK_EVIDENCE_GATHERER_SCHEMA,
    ok: mismatches.length === 0 && verified > 0,
    verified_count: verified,
    mismatches: Object.freeze(mismatches),
    boundary: Object.freeze({
      filesystem_write_performed: false,
      network_used: false,
      runtime_execution_performed: false,
      model_invocation_performed: false,
    }),
  });
}
