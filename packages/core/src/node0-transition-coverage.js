// NODE0-TRANSITION-COVERAGE-1A — the three-valued contract for
// `receipt_per_transition` <- node0_transition_receipt_chain.
//
// NOT ML. NOT runtime. It judges a registry summary and a set of counterexamples
// it is handed; it reads nothing and executes nothing.
//
// THE ASYMMETRY IS THE WHOLE DESIGN. The canonical question is "is EVERY state
// change hash-chained and tamper-evident?", and a universal claim breaks
// differently in each direction:
//
//   To SATISFY it you must have looked everywhere — so an incomplete registry
//   blocks SATISFIED, because an unclassified domain could hold a violation.
//
//   To VIOLATE it you need ONE counterexample — so an incomplete registry does
//   NOT erase a proven one. An unclassified domain can only ever ADD violations.
//
// And absence of evidence is UNKNOWN, never VIOLATED: a row cannot be refuted by
// not having looked.
//
// WHAT MAKES A COUNTEREXAMPLE PROVEN. Not an assertion that a receipt is
// missing — anything is missing if you never looked for it. It must carry the
// control that the receipt mechanism EXISTS AND IS USED ELSEWHERE. Without that,
// "no receipt here" is indistinguishable from "this tree receipts nothing", and
// the finding would be about the estate rather than about the writer.
//
// Pure: no fs, no network, no process, no clock, no random, no model call.

export const NODE0_TRANSITION_COVERAGE_SCHEMA =
  "bizra.dema.node0_transition_coverage.v0.1";

export const NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE = "node0_transition_receipt_chain";

export const COVERAGE_EVIDENCE_CLASSES = Object.freeze(["OBSERVED", "OPERATOR_ASSERTED", "TEST_INJECTION", "NONE"]);

export const COVERAGE_VERDICTS = Object.freeze([
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "NO_COVERAGE_EVIDENCE",
  "REGISTRY_INCOMPLETE",
  "COVERAGE_INCOMPLETE",
  "COVERAGE_VIOLATED",
  "COVERAGE_SATISFIED",
]);

const AUTHORITATIVE = "AUTHORITATIVE";
const isStr = (v) => typeof v === "string" && v.length > 0;
const isInt = (v) => Number.isInteger(v) && v >= 0;

/**
 * The single gate for "this counterexample is real".
 *
 * `receipt_mechanism_exists_elsewhere` is the control, not a formality: it is
 * what separates "this writer skips the receipt everyone else writes" from
 * "nothing in this system receipts anything", which are different findings.
 */
export function isProvenCounterexample(cx) {
  if (!cx || typeof cx !== "object") return false;
  if (cx.classification !== AUTHORITATIVE) return false;
  for (const k of ["domain_id", "writer", "transition", "authority_source", "verified_by"]) {
    if (!isStr(cx[k])) return false;
  }
  if (cx.verified_by !== "independent_source_trace") return false;
  // Alleging a violation while reporting the receipt call present is incoherent.
  if (cx.receipt_call_present !== false) return false;
  if (cx.receipt_mechanism_exists_elsewhere !== true) return false;
  return true;
}

function classify(registry, proven, cls) {
  if (cls === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (cls !== "OBSERVED") return "NOT_OBSERVED";
  // One proven counterexample falsifies the universal, whatever else is unknown.
  if (proven.length > 0) return "COVERAGE_VIOLATED";
  if (!registry) return "NO_COVERAGE_EVIDENCE";
  if (!isInt(registry.unclassified_count) || !isInt(registry.authoritative_domains)) return "NO_COVERAGE_EVIDENCE";
  if (registry.unclassified_count > 0) return "REGISTRY_INCOMPLETE";
  if (registry.authoritative_domains === 0 || !isInt(registry.receipted_domains)) return "NO_COVERAGE_EVIDENCE";
  // Coverage is a set comparison, never an inference from chain validity: a valid
  // chain holding 9 of 10 authoritative transitions is still a failure.
  if (registry.receipted_domains < registry.authoritative_domains) return "COVERAGE_INCOMPLETE";
  if (registry.receipted_domains === 0) return "NO_COVERAGE_EVIDENCE";
  return "COVERAGE_SATISFIED";
}

/// Only two verdicts contribute an `observed` value. Everything else contributes
/// `null`, which the evaluator scores as UNKNOWN — the correct answer when the
/// row is neither established nor refuted.
function observedFor(verdict) {
  if (verdict === "COVERAGE_VIOLATED") return false;
  if (verdict === "COVERAGE_SATISFIED") return true;
  return null;
}

export function buildTransitionCoverageObservation({
  registry = null,
  counterexamples = [],
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildTransitionCoverageObservation requires an injected `hash`");
  }
  const cls = COVERAGE_EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE";
  const all = Array.isArray(counterexamples) ? counterexamples : [];
  const proven = all.filter(isProvenCounterexample);
  const coverage_verdict = classify(registry, proven, cls);

  const body = {
    schema: NODE0_TRANSITION_COVERAGE_SCHEMA,
    evidence_class: cls,
    scope: NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE,
    coverage_verdict,
    observed: observedFor(coverage_verdict),
    // Each domain keeps its own record. Collapsing them into "some receipt
    // missing" would lose the fact that they may need different repairs.
    counterexample_domains: Object.freeze(proven.map((c) => c.domain_id)),
    counterexamples: Object.freeze(
      proven.map((c) =>
        Object.freeze({
          domain_id: c.domain_id,
          writer: c.writer,
          transition: c.transition,
          authority_source: c.authority_source,
          consumers_count: c.consumers_count ?? null,
          receipt_mechanism: c.receipt_mechanism ?? null,
        }),
      ),
    ),
    proven_counterexample_count: proven.length,
    rejected_counterexample_count: all.length - proven.length,
    registry_unclassified_count: registry?.unclassified_count ?? null,
    registry_authoritative_domains: registry?.authoritative_domains ?? null,
    registry_receipted_domains: registry?.receipted_domains ?? null,
    executed_code_hash: executedCodeHash,
    authority_delta: 0,
  };

  return Object.freeze({ ...body, observed_at: observedAt, observation_hash: hash(body) });
}

export function verifyTransitionCoverageHash(observation, hash) {
  if (!observation || typeof hash !== "function") return false;
  const { observed_at: _o, observation_hash: carried, ...body } = observation;
  return isStr(carried) && hash(body) === carried;
}
