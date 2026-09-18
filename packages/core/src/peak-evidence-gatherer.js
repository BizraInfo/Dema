// PEAK-EVIDENCE-GATHERER-1B — turns gate-run artefacts into evidence-bound signal
// events for `buildPeakSelfLoopPreview`.
//
// 1A closed the byte-binding gap: source_sha256 is always re-derived from the
// artefact's ACTUAL content. 1B closes the next false-GREEN class: readable,
// hash-matching bytes are provenance, not proof that the event's semantic claim
// is true. A JavaScript source file labelled `gate_passed` must never become a
// MEASURED positive signal merely because the file exists.
//
// This slice deliberately supports one narrow semantic proof shape:
//   type: gate_passed -> JSON receipt with { gate: <candidate id>, exit: 0 }
// Everything else is excluded rather than guessed. New event classes must earn
// their own explicit semantic verifier before they can raise SNR.
//
// PURITY BY INJECTION — this module imports no `node:fs`. The caller supplies
// `readSource(source_ref) -> string | Buffer | null`, where `null` means unreadable.
// Boundary: no network, no child_process, no clock, no write, no execution.

import { createHash } from "node:crypto";

export const PEAK_EVIDENCE_GATHERER_SCHEMA =
  "bizra.dema.peak_evidence_gatherer.v0.2";

const GATE_RECEIPT_VERIFIER = "gate_receipt_exit_0_v1";

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

function parseJsonObject(content) {
  try {
    const parsed = JSON.parse(Buffer.isBuffer(content) ? content.toString("utf8") : content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function verifySemanticEvidence(candidate, content) {
  const type = candidate?.type ?? "gate_passed";
  if (type !== "gate_passed") {
    return Object.freeze({
      ok: false,
      gap: `semantic_evidence_unsupported:${String(type)}`,
      verifier: null,
    });
  }

  const receipt = parseJsonObject(content);
  if (!receipt) {
    return Object.freeze({
      ok: false,
      gap: "gate_receipt_json_required",
      verifier: GATE_RECEIPT_VERIFIER,
    });
  }
  if (receipt.gate !== candidate.id) {
    return Object.freeze({
      ok: false,
      gap: "gate_receipt_id_mismatch",
      verifier: GATE_RECEIPT_VERIFIER,
    });
  }
  if (receipt.exit !== 0) {
    return Object.freeze({
      ok: false,
      gap: "gate_receipt_exit_not_zero",
      verifier: GATE_RECEIPT_VERIFIER,
    });
  }

  return Object.freeze({ ok: true, gap: null, verifier: GATE_RECEIPT_VERIFIER });
}

/**
 * Bind each candidate to the real content at its `source_ref`, then prove the
 * narrow semantic claim represented by its event type.
 *
 * Unreadable or semantically unsupported sources are excluded, never downgraded
 * into a weaker positive event.
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

    const semantic = verifySemanticEvidence(c, content);
    if (!semantic.ok) {
      excluded.push(Object.freeze({ id, gap: semantic.gap }));
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
        semantic_verifier: semantic.verifier,
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
 * Re-derive every event's hash and semantic claim from the world as it is NOW.
 * Never trusts the hash or semantic_verifier carried by the event.
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

    const semantic = verifySemanticEvidence(e, content);
    if (!semantic.ok) {
      mismatches.push(Object.freeze({ id, gap: semantic.gap }));
      continue;
    }
    if (e.semantic_verifier !== semantic.verifier) {
      mismatches.push(Object.freeze({ id, gap: "semantic_verifier_mismatch" }));
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
