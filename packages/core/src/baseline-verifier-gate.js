// BASELINE-VERIFIER-GATE-1A — minimal pre-action verification kernel.
//
// Purpose: prove that a consent-aware verifier can emit evidence under the
// existing Node0 SSE event-envelope law before any effect is authorized.
// Pure preview: no fs, network, process, clock, random, model, or execution.

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

/**
 * Verify the absolute minimum proposal contract and emit one tamper-evident
 * state event. `ok` means the preview kernel executed correctly; the proposal
 * decision itself is carried by event.payload.verified.
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

  const verified = input.proposalText.includes(BASELINE_VERIFIER_GATE_GO_PHRASE);
  const event = buildSseStreamEvent({
    streamId: "baseline-verifier-gate-1a",
    seq: 1,
    kind: "state",
    payload: {
      verified,
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
