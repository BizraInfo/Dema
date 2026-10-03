// BASELINE-VERIFIER-GATE-1A — minimal pre-action verification kernel.
//
// Purpose: prove that a consent-aware verifier can emit evidence under the
// existing Node0 SSE event-envelope law before any effect is authorized.
// Pure preview: no fs, network, process, clock, random, model, or execution.
// The emitted SSE event is hash-chained and independently verifiable.

import { createHash } from "node:crypto";
import { buildSseStreamEvent } from "./node0-sse-envelope-stream.js";

export const BASELINE_VERIFIER_GATE_SCHEMA = "bizra.dema.baseline_verifier_gate.v0.1";
export const BASELINE_VERIFIER_GATE_TRUTH_LABEL = "BASELINE_VERIFIER_GATE_MEASURED_REPO";
export const BASELINE_VERIFIER_GATE_GO_PHRASE = "GO: baseline verifier gate preview";

function boundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
    merge_authority: false,
    authority_delta: 0,
  });
}

function refuse(code) {
  return Object.freeze({
    ok: false,
    schema: BASELINE_VERIFIER_GATE_SCHEMA,
    truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
    boundary: boundary(),
    blocked_by: Object.freeze([code]),
  });
}

function isWellFormedUtf16(text) {
  if (typeof text.isWellFormed === "function") return text.isWellFormed();
  // Fallback for engines without String#isWellFormed.
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
    text,
  );
}

function proposalHash(proposalText) {
  return `sha256:${createHash("sha256").update(proposalText, "utf8").digest("hex")}`;
}

/** Exact whole-line match after trim — not a substring / prefix / suffix hit. */
export function proposalHasExactGoPhrase(proposalText) {
  return proposalText
    .split(/\r?\n/)
    .some((line) => line.trim() === BASELINE_VERIFIER_GATE_GO_PHRASE);
}

/**
 * Verify the absolute minimum proposal contract and emit one tamper-evident
 * state event. `ok` means the preview kernel executed correctly; the proposal
 * decision itself is carried by event.payload.verified and bound to
 * event.payload.proposal_hash.
 */
export function runBaselineVerifierGate({ consent, input } = {}) {
  if (consent !== BASELINE_VERIFIER_GATE_GO_PHRASE) {
    return refuse("consent_phrase_mismatch");
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return refuse("input_not_object");
  }
  if (typeof input.proposalText !== "string") {
    return refuse("proposal_not_string");
  }
  if (!isWellFormedUtf16(input.proposalText)) {
    return refuse("proposal_not_well_formed");
  }

  const verified = proposalHasExactGoPhrase(input.proposalText);
  const event = buildSseStreamEvent({
    streamId: "baseline-verifier-gate-1a",
    seq: 1,
    kind: "state",
    payload: {
      verified,
      proposal_hash: proposalHash(input.proposalText),
      reason: verified
        ? "Proposal contains required GO consent"
        : "Proposal missing required GO consent",
    },
    previousEventHash: null,
  });

  return Object.freeze({
    ok: true,
    schema: BASELINE_VERIFIER_GATE_SCHEMA,
    truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
    event,
    boundary: boundary(),
    blocked_by: Object.freeze([]),
  });
}
