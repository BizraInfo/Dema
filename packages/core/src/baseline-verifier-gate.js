// BASELINE-VERIFIER-GATE-1A — Proactive verification gate inspired by Manus: checks proposal consent and returns a verifiable SSE envelope stream event.
// This gate is itself hash-chained and verifiable by the node0-sse-envelope-stream contract, enabling pre-Done verification in the Dema loop.

import { buildSseStreamEvent } from "./node0-sse-envelope-stream.js";

export const BASELINE_VERIFIER_GATE_SCHEMA = "bizra.dema.baseline_verifier_gate.v0.1";
export const BASELINE_VERIFIER_GATE_TRUTH_LABEL = "BASELINE_VERIFIER_GATE_MEASURED_REPO";
export const BASELINE_VERIFIER_GATE_GO_PHRASE = "GO: baseline verifier gate preview";

/**
 * Run baseline verifier gate: verify proposal has exact GO consent and return a verifiable SSE stream event.
 * @param {{ consent: string, input: { proposalText: string } }} params
 * @returns {{ ok: boolean, schema: string, truth_label: string, event: Object, boundary: Object }}
 *   On success: ok:true, event: a verifiable SSE stream event (state kind, seq=1, payload with verified/reason)
 *   On failure: ok:false, blocked_by: array of refusal codes
 */
export function runBaselineVerifierGate({ consent, input } = {}) {
  // Consent gate (exact phrase only)
  if (consent !== BASELINE_VERIFIER_GATE_GO_PHRASE) {
    return Object.freeze({
      ok: false,
      schema: BASELINE_VERIFIER_GATE_SCHEMA,
      truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
      boundary: Object.freeze({
        execution_allowed: false,
        daemon_started: false,
        network_used: false,
        token_minted: false,
        wallet_accessed: false,
        live_execution_performed: false,
        file_mutation_performed: false,
        model_invocation_performed: false,
      }),
      blocked_by: Object.freeze(["consent_phrase_mismatch"]),
    });
  }

  // Input validation
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({
      ok: false,
      schema: BASELINE_VERIFIER_GATE_SCHEMA,
      truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
      boundary: Object.freeze({
        execution_allowed: false,
        daemon_started: false,
        network_used: false,
        token_minted: false,
        wallet_accessed: false,
        live_execution_performed: false,
        file_mutation_performed: false,
        model_invocation_performed: false,
      }),
      blocked_by: Object.freeze(["input_not_object"]),
    });
  }

  if (typeof input.proposalText !== "string") {
    return Object.freeze({
      ok: false,
      schema: BASELINE_VERIFIER_GATE_SCHEMA,
      truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
      boundary: Object.freeze({
        execution_allowed: false,
        daemon_started: false,
        network_used: false,
        token_minted: false,
        wallet_accessed: false,
        live_execution_performed: false,
        file_mutation_performed: false,
        model_invocation_performed: false,
      }),
      blocked_by: Object.freeze(["proposal_not_string"]),
    });
  }

  // Proactive verification: check that proposalText contains the exact GO phrase for this gate
  // (In a real system, this might check a proposal file or a more complex condition)
  const hasConsent = input.proposalText.includes(BASELINE_VERIFIER_GATE_GO_PHRASE);
  const reason = hasConsent
    ? "Proposal contains required GO consent"
    : "Proposal missing required GO consent";

  // Build a single SSE stream event representing the verification result
  // This event is itself verifiable by the node0-sse-envelope-stream contract
  const event = buildSseStreamEvent({
    streamId: "baseline-verifier-gate-1a",
    seq: 1,
    kind: "state",
    payload: {
      verified: hasConsent,
      reason,
      timestamp: "2026-08-27T00:00:00.000Z", // fixed for determinism in preview
    },
    previousEventHash: null, // genesis event
  });

  // All-false boundary invariant (pure kernel preview)
  const boundary = Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });

  return Object.freeze({
    ok: true,
    schema: BASELINE_VERIFIER_GATE_SCHEMA,
    truth_label: BASELINE_VERIFIER_GATE_TRUTH_LABEL,
    event, // the verifiable SSE stream event
    boundary,
    blocked_by: Object.freeze([]),
  });
}
