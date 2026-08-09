// NODE0-CLOSURE-INVARIANTS-1A — the ten booleans that decide whether the seed
// is genetically complete.
//
// NOT ML. NOT runtime. NOT an activation. This asks ten questions of supplied
// evidence and returns a verdict; it executes nothing and closes nothing.
//
// WHY THIS EXISTS. Measured 2026-08-09: nine of the ten capabilities below
// already exist in this tree — replay/isnad in 96 files, authority_delta in 95,
// receipt chain in 50 — but NOT ONE was named as an invariant, and no kernel
// evaluated them together. The node therefore could not answer "am I closed?"
// The DNA was present; nothing read it as a whole. Only `remote_write` had no
// guard anywhere, which is why it is the one invariant that starts UNKNOWN
// rather than merely unnamed.
//
// CLOSURE IS NOT ENDURANCE. Seventy-two hours of uptime is later evidence, not
// the definition. Closure is: one bounded effect survives a kill, resumes
// deterministically, refuses a forged verification, seals a receipt, grants
// itself nothing, and returns without the human carrying the state by hand.
//
// FAIL-CLOSED, AND UNKNOWN IS NOT TRUE. An invariant with no evidence is
// UNKNOWN and counts against closure exactly as a violation does. A system that
// treated silence as satisfaction would declare itself closed the moment it
// stopped looking — which is the precise failure this whole estate exists to
// refuse.

export const NODE0_CLOSURE_INVARIANTS_SCHEMA =
  "bizra.dema.node0_closure_invariants.v0.3";
export const NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL = "IMPLEMENTED_LOCAL";
export const REMOTE_WRITE_OBSERVATION_SCOPE =
  "node0_deployment_remote_write";

export const INVARIANT_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  VIOLATED: "VIOLATED",
  UNKNOWN: "UNKNOWN",
});

/**
 * The ten. `required` is the value the invariant must hold. Two are inverted on
 * purpose: authority_delta must be zero and remote_write must be false, because
 * both describe something the node must NOT have done.
 *
 * `required_scope` names the KIND of observation that can settle the row. It is
 * mandatory on every invariant, not a special case: measured 2026-08-09, a source
 * scan that could only see declarations was one adapter away from settling
 * `remote_write`, a question about deployment. The scope is what makes an
 * instrument declare what it actually looked at, so a narrow one cannot be
 * mistaken for a broad one. Nine of these rows have no adapter yet — the rule is
 * installed before the first arrives rather than retrofitted after.
 */
export const CLOSURE_INVARIANTS = Object.freeze([
  Object.freeze({
    id: "mission_is_primary_state",
    required: true,
    required_scope: "node0_runtime_state_ownership",
    question: "Is the mission contract the primary state, with models as temporary workers?",
  }),
  Object.freeze({
    id: "worker_is_replaceable",
    required: true,
    required_scope: "node0_runtime_worker_handoff",
    question: "If a worker exits, can another resume from the checkpoint?",
  }),
  Object.freeze({
    id: "contract_is_immutable",
    required: true,
    required_scope: "node0_contract_artifact_immutability",
    question: "Is the contract frozen, so the system cannot widen its own scope?",
  }),
  Object.freeze({
    id: "acceptance_is_model_blind",
    required: true,
    required_scope: "node0_acceptance_function_model_blindness",
    question: "Does acceptance judge the output without knowing which model produced it?",
  }),
  Object.freeze({
    id: "verification_is_external",
    required: true,
    required_scope: "node0_verifier_independence",
    question: "Is verification performed by something that did not do the work?",
  }),
  Object.freeze({
    id: "authority_delta",
    required: 0,
    required_scope: "node0_cycle_authority_delta",
    question: "Did the cycle grant itself any authority? It must be exactly zero.",
  }),
  Object.freeze({
    id: "recovery_after_worker_exit",
    required: true,
    required_scope: "node0_runtime_kill_resume",
    question: "After a kill, does the loop resume deterministically without human hands?",
  }),
  Object.freeze({
    id: "receipt_per_transition",
    required: true,
    required_scope: "node0_transition_receipt_chain",
    question: "Is every state change hash-chained and tamper-evident?",
  }),
  Object.freeze({
    id: "full_history_replayable",
    required: true,
    required_scope: "node0_history_replay",
    question: "Can the past be reconstructed exactly from the chain?",
  }),
  Object.freeze({
    id: "remote_write",
    required: false,
    required_scope: REMOTE_WRITE_OBSERVATION_SCOPE,
    question: "Can any external party silently mutate local sovereign state? It must not.",
  }),
]);

export const INVARIANT_IDS = Object.freeze(CLOSURE_INVARIANTS.map((i) => i.id));

/// Evidence must be an OBSERVATION, not an assertion. A bare `true` is refused:
/// the shape carries where the value came from, so a caller cannot satisfy an
/// invariant by simply believing it.
function readObservation(evidence, invariant) {
  const entry = evidence?.[invariant.id];
  if (entry === undefined || entry === null) {
    return { present: false, reason: "no_evidence" };
  }
  if (typeof entry !== "object" || Array.isArray(entry)) {
    // A raw boolean is exactly the self-assertion this refuses.
    return { present: false, reason: "unsourced_assertion" };
  }
  if (!("observed" in entry)) {
    return { present: false, reason: "no_observed_value" };
  }
  if (typeof entry.source !== "string" || entry.source.trim() === "") {
    return { present: false, reason: "no_source" };
  }
  // Scope is mandatory for every invariant. A row that declared no scope would
  // accept any observation at all, so it fails closed rather than falling back to
  // the permissive behaviour — that fallback is what let a source scan reach a
  // deployment question in the first place.
  if (typeof invariant.required_scope !== "string" || invariant.required_scope === "") {
    return { present: false, reason: "invariant_declares_no_scope" };
  }
  if (entry.scope !== invariant.required_scope) {
    return { present: false, reason: "observation_scope_mismatch" };
  }
  return {
    present: true,
    observed: entry.observed,
    source: entry.source,
    scope: entry.scope ?? null,
  };
}

/**
 * Pure. Evaluates the ten invariants against supplied observations.
 * Returns CLOSED only when all ten are SATISFIED.
 */
export function evaluateNode0ClosureInvariants(evidence = {}) {
  const results = CLOSURE_INVARIANTS.map((inv) => {
    const obs = readObservation(evidence, inv);
    if (!obs.present) {
      return Object.freeze({
        id: inv.id,
        status: INVARIANT_STATUS.UNKNOWN,
        required: inv.required,
        observed: null,
        source: null,
        scope: null,
        required_scope: inv.required_scope ?? null,
        reason: obs.reason,
      });
    }
    const satisfied = Object.is(obs.observed, inv.required);
    return Object.freeze({
      id: inv.id,
      status: satisfied ? INVARIANT_STATUS.SATISFIED : INVARIANT_STATUS.VIOLATED,
      required: inv.required,
      observed: obs.observed,
      source: obs.source,
      scope: obs.scope,
      required_scope: inv.required_scope ?? null,
      reason: null,
    });
  });

  const satisfied = results.filter((r) => r.status === INVARIANT_STATUS.SATISFIED);
  const violated = results.filter((r) => r.status === INVARIANT_STATUS.VIOLATED);
  const unknown = results.filter((r) => r.status === INVARIANT_STATUS.UNKNOWN);

  // Unknown counts against closure exactly as a violation does.
  const closed = satisfied.length === CLOSURE_INVARIANTS.length;

  return Object.freeze({
    schema: NODE0_CLOSURE_INVARIANTS_SCHEMA,
    truth_label: NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL,
    node0_closed: closed,
    verdict: closed ? "CLOSED" : "OPEN",
    satisfied_count: satisfied.length,
    violated_count: violated.length,
    unknown_count: unknown.length,
    total: CLOSURE_INVARIANTS.length,
    blocked_by: Object.freeze(
      [...violated, ...unknown].map((r) =>
        Object.freeze({ id: r.id, status: r.status, reason: r.reason }),
      ),
    ),
    invariants: Object.freeze(results),
    what_this_proves:
      "Whether the ten closure invariants are satisfied by supplied, sourced observations.",
    what_this_does_not_prove:
      "Does not prove endurance, federation readiness, activation, or that any observation was itself honestly measured; it checks the ledger of answers, not the instruments that produced them.",
  });
}

/// Re-derives the verdict from the per-invariant rows, so a hand-edited summary
/// cannot report CLOSED over a set that does not support it.
export function verifyClosureVerdict(report) {
  const rows = report?.invariants;
  if (!Array.isArray(rows) || rows.length !== CLOSURE_INVARIANTS.length) {
    return Object.freeze({ ok: false, reason: "invariant_row_count_mismatch" });
  }
  const ids = rows.map((r) => r.id);
  if (ids.join("|") !== INVARIANT_IDS.join("|")) {
    return Object.freeze({ ok: false, reason: "invariant_set_mismatch" });
  }
  const allSatisfied = rows.every((r) => r.status === INVARIANT_STATUS.SATISFIED);
  if (allSatisfied !== report.node0_closed) {
    return Object.freeze({ ok: false, reason: "verdict_not_supported_by_rows" });
  }
  return Object.freeze({ ok: true });
}
