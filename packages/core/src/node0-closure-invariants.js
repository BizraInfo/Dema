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

import { types as nodeUtilTypes } from "node:util";

export const NODE0_CLOSURE_INVARIANTS_SCHEMA =
  "bizra.dema.node0_closure_invariants.v0.3";
export const NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL = "IMPLEMENTED_LOCAL";
export const REMOTE_WRITE_OBSERVATION_SCOPE =
  "node0_deployment_remote_write";

const WHAT_THIS_PROVES =
  "Whether the ten closure invariants are satisfied by supplied, sourced observations.";
const WHAT_THIS_DOES_NOT_PROVE =
  "Does not prove endurance, federation readiness, activation, or that any observation was itself honestly measured; it checks the ledger of answers, not the instruments that produced them.";

const REPORT_KEYS = Object.freeze([
  "schema",
  "truth_label",
  "node0_closed",
  "verdict",
  "satisfied_count",
  "violated_count",
  "unknown_count",
  "total",
  "blocked_by",
  "invariants",
  "what_this_proves",
  "what_this_does_not_prove",
]);
const ROW_KEYS = Object.freeze([
  "id",
  "status",
  "required",
  "observed",
  "source",
  "scope",
  "required_scope",
  "reason",
]);
const BLOCKER_KEYS = Object.freeze(["id", "status", "reason"]);
const UNKNOWN_REASON_CODES = Object.freeze([
  "no_evidence",
  "unsourced_assertion",
  "no_observed_value",
  "no_source",
  "observation_scope_mismatch",
]);

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
 * `remote_write`, a question about deployment.
 *
 * WHAT THE SCOPE IS AND IS NOT. It is a caller-supplied DECLARATION, matched
 * exactly, that stops a narrow instrument from being routed to a broad question.
 * It does not prove the declaration true: an adapter that stamps
 * `node0_deployment_remote_write` on a source scan still gets in. Scope makes the
 * lie explicit and attributable instead of implicit — which is the most a ledger
 * can do about instruments it does not run. Nine of these rows have no adapter
 * yet, so the rule is installed before the first arrives rather than retrofitted.
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
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

/// Reads one canonical in-process data record without invoking any accessor. The
/// returned object is a stable snapshot: verdict arithmetic never re-reads a
/// caller-controlled object after its shape has been accepted.
function readCanonicalRecord(value, expectedKeys) {
  if (value === null || typeof value !== "object") {
    return null;
  }
  if (nodeUtilTypes.isProxy(value) || Array.isArray(value)) {
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.length !== expectedKeys.length) return null;

  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      return null;
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

/// Reads a dense, ordinary array as data. Holes, accessors, annotations,
/// symbols, and custom prototypes are all non-canonical. `Array#every` cannot
/// enforce this because it deliberately skips holes.
function readCanonicalArray(value, expectedLength) {
  if (value !== null && typeof value === "object" && nodeUtilTypes.isProxy(value)) {
    return Object.freeze({ ok: false, reason: "shape_mismatch" });
  }
  if (!Array.isArray(value)) {
    return Object.freeze({ ok: false, reason: "not_array" });
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return Object.freeze({ ok: false, reason: "shape_mismatch" });
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !Object.hasOwn(lengthDescriptor, "value") ||
    lengthDescriptor.enumerable !== false
  ) {
    return Object.freeze({ ok: false, reason: "shape_mismatch" });
  }
  if (lengthDescriptor.value !== expectedLength) {
    return Object.freeze({ ok: false, reason: "length_mismatch" });
  }

  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.length !== expectedLength + 1) {
    return Object.freeze({ ok: false, reason: "shape_mismatch" });
  }

  const snapshot = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.enumerable !== true
    ) {
      return Object.freeze({ ok: false, reason: "shape_mismatch" });
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze({ ok: true, value: Object.freeze(snapshot) });
}

/// What a row's OWN evidence supports, re-derived against the canonical invariant
/// rather than read off the row's `status`. `null` means the row is not a row of
/// this ledger at all — it redefined what its invariant requires.
///
/// MEASURED DEFECT this refuses to inherit (2026-08-09): the previous verifier
/// compared "do all rows say SATISFIED" to `node0_closed` and nothing else, so a
/// report with ten rows claiming SATISFIED while carrying `source: null`,
/// `scope: null` and reason `no_evidence` returned `{ok: true}`. Only the summary
/// was bound to the rows; the rows were bound to nothing.
function rederiveRowStatus(row) {
  if (!row || typeof row !== "object") return null;
  const canon = CLOSURE_INVARIANTS.find((i) => i.id === row.id);
  if (!canon) return null;
  // A row may not restate its own contract. Letting it do so would mean a forger
  // supplies both the answer and the question it is graded against.
  if (!Object.is(row.required, canon.required)) return null;
  if (row.required_scope !== canon.required_scope) return null;

  const sourced = typeof row.source === "string" && row.source.trim() !== "";
  const scoped = row.scope === canon.required_scope;
  if (!sourced || !scoped) return INVARIANT_STATUS.UNKNOWN;
  return Object.is(row.observed, canon.required)
    ? INVARIANT_STATUS.SATISFIED
    : INVARIANT_STATUS.VIOLATED;
}

/// Verifies the whole canonical report envelope from the per-invariant rows, and
/// each decision-bearing row status from its normalized evidence, so neither a
/// hand-edited summary nor a hand-edited row set can report CLOSED over evidence
/// that does not support it. Schema, shape, truth label, proof boundaries, every
/// status, all four counts, `blocked_by` and the verdict are checked exactly.
///
/// UNKNOWN CAUSE IS NOT RE-DERIVED. Schema v0.3 normalizes every refused raw
/// observation to the same null evidence triple, so its specific diagnostic
/// reason is vocabulary-checked and structurally bound, not independently
/// reconstructed. Honest measurement and diagnostic provenance remain the
/// instrument's problem, not the ledger's.
function verifyCanonicalClosureVerdict(report) {
  const canonicalReport = readCanonicalRecord(report, REPORT_KEYS);
  if (canonicalReport === null) {
    return Object.freeze({ ok: false, reason: "report_shape_mismatch" });
  }
  if (canonicalReport.schema !== NODE0_CLOSURE_INVARIANTS_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (canonicalReport.truth_label !== NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL) {
    return Object.freeze({ ok: false, reason: "truth_label_mismatch" });
  }
  if (
    canonicalReport.what_this_proves !== WHAT_THIS_PROVES ||
    canonicalReport.what_this_does_not_prove !== WHAT_THIS_DOES_NOT_PROVE
  ) {
    return Object.freeze({ ok: false, reason: "proof_boundary_mismatch" });
  }

  const canonicalRows = readCanonicalArray(
    canonicalReport.invariants,
    CLOSURE_INVARIANTS.length,
  );
  if (
    !canonicalRows.ok &&
    (canonicalRows.reason === "not_array" || canonicalRows.reason === "length_mismatch")
  ) {
    return Object.freeze({ ok: false, reason: "invariant_row_count_mismatch" });
  }
  if (!canonicalRows.ok) {
    return Object.freeze({ ok: false, reason: "invariant_array_shape_mismatch" });
  }

  const rows = [];
  for (const row of canonicalRows.value) {
    const canonicalRow = readCanonicalRecord(row, ROW_KEYS);
    if (canonicalRow === null) {
      return Object.freeze({ ok: false, reason: "row_shape_mismatch" });
    }
    rows.push(canonicalRow);
  }
  Object.freeze(rows);

  const ids = rows.map((row) => row.id);
  if (ids.join("|") !== INVARIANT_IDS.join("|")) {
    return Object.freeze({ ok: false, reason: "invariant_set_mismatch" });
  }

  const derived = rows.map(rederiveRowStatus);
  if (derived.some((status) => status === null)) {
    return Object.freeze({ ok: false, reason: "invariant_definition_mismatch" });
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const derivedStatus = derived[index];
    if (row.status !== derivedStatus) {
      return Object.freeze({ ok: false, reason: "row_status_not_supported_by_row_evidence" });
    }
    if (
      derivedStatus === INVARIANT_STATUS.UNKNOWN &&
      (row.observed !== null || row.source !== null || row.scope !== null)
    ) {
      return Object.freeze({ ok: false, reason: "row_unknown_shape_not_canonical" });
    }
    const reasonIsCanonical =
      derivedStatus === INVARIANT_STATUS.UNKNOWN
        ? UNKNOWN_REASON_CODES.includes(row.reason)
        : row.reason === null;
    if (!reasonIsCanonical) {
      return Object.freeze({ ok: false, reason: "row_reason_not_supported_by_row_evidence" });
    }
  }

  const tally = (status) => derived.filter((derivedStatus) => derivedStatus === status).length;
  const satisfied = tally(INVARIANT_STATUS.SATISFIED);
  if (
    canonicalReport.satisfied_count !== satisfied ||
    canonicalReport.violated_count !== tally(INVARIANT_STATUS.VIOLATED) ||
    canonicalReport.unknown_count !== tally(INVARIANT_STATUS.UNKNOWN) ||
    canonicalReport.total !== CLOSURE_INVARIANTS.length
  ) {
    return Object.freeze({ ok: false, reason: "summary_not_supported_by_rows" });
  }

  // Violated first, then unknown — the order the evaluator publishes. Build the
  // expectation only from the stable row snapshots, never from live input.
  const expectedBlocked = [];
  for (const status of [INVARIANT_STATUS.VIOLATED, INVARIANT_STATUS.UNKNOWN]) {
    for (let index = 0; index < rows.length; index += 1) {
      if (derived[index] === status) {
        expectedBlocked.push(
          Object.freeze({
            id: rows[index].id,
            status,
            reason: rows[index].reason,
          }),
        );
      }
    }
  }

  const canonicalBlockers = readCanonicalArray(
    canonicalReport.blocked_by,
    expectedBlocked.length,
  );
  if (!canonicalBlockers.ok) {
    return Object.freeze({ ok: false, reason: "blocked_by_not_supported_by_rows" });
  }
  for (let index = 0; index < expectedBlocked.length; index += 1) {
    const claimed = readCanonicalRecord(canonicalBlockers.value[index], BLOCKER_KEYS);
    const expected = expectedBlocked[index];
    if (
      claimed === null ||
      claimed.id !== expected.id ||
      claimed.status !== expected.status ||
      claimed.reason !== expected.reason
    ) {
      return Object.freeze({ ok: false, reason: "blocked_by_not_supported_by_rows" });
    }
  }

  const closed = satisfied === CLOSURE_INVARIANTS.length;
  if (
    closed !== canonicalReport.node0_closed ||
    canonicalReport.verdict !== (closed ? "CLOSED" : "OPEN")
  ) {
    return Object.freeze({ ok: false, reason: "verdict_not_supported_by_rows" });
  }
  return Object.freeze({ ok: true });
}

export function verifyClosureVerdict(report) {
  try {
    if (nodeUtilTypes.isProxy(report)) {
      return Object.freeze({ ok: false, reason: "unreadable_report" });
    }
    return verifyCanonicalClosureVerdict(report);
  } catch {
    // Reflective input (for example a revoked Proxy) is unreadable evidence, not
    // an exception the caller must turn into a verdict.
    return Object.freeze({ ok: false, reason: "unreadable_report" });
  }
}
