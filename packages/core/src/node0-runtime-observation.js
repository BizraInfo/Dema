// NODE0-BRIDGE-READINESS-CORRECTION-1B — one typed runtime observation.
//
// The 1A slice proved that health CONSUMES an adapter status instead of a
// constant. It did not prove WHO produced that status. Two holes made the
// difference invisible:
//
//   1. `normalizeNode0Status` ASSIGNS `node: "Node0"`. It is not read from the
//      runtime, so any command emitting four accepted fields was "Node0".
//   2. `DEMA_NODE0_STATUS_COMMAND` is an operator-owned shell-out. Favourable
//      JSON from an arbitrary script was indistinguishable from a governed
//      runtime answering for itself.
//
// This kernel is the contract that separates "a status source answered" from
// "the exact runtime I claim to observe answered". It is PURE: no fs, no net,
// no clock, no randomness — every fact is injected, so the classification can
// be replayed byte-for-byte from the recorded observation.
//
// Nothing here grants authority. `authority_delta` is 0 on every path, and
// availability never implies activation.

export const NODE0_RUNTIME_OBSERVATION_SCHEMA =
  "bizra.dema.node0_runtime_observation.v0.1";

// The domain a governed Node0 must claim for itself. An endpoint that answers
// but does not claim this domain is a MISMATCH, never a healthy node — that is
// the difference between "something is listening" and "Node0 is listening".
export const CANONICAL_RUNTIME_DOMAIN = "bizra.node0";

export const OBSERVATION_VERDICTS = Object.freeze([
  "UNCONFIGURED",              // nothing configured; nothing was contacted
  "CONFIGURED_NOT_OBSERVED",   // configured, but the observation did not land
  "OPERATOR_ASSERTED_STATUS",  // a human-owned command asserted it; not proof
  "OBSERVED_IDENTITY_MISMATCH",// answered, but is not the claimed runtime
  "OBSERVED_UNHEALTHY",        // genuinely observed, and not healthy
  "OBSERVED_HEALTHY",          // genuinely observed, healthy, identity bound
]);

// Only a genuinely observed, identity-bound, healthy runtime may support a
// Node0-closure CLEAN. OPERATOR_ASSERTED_STATUS is deliberately excluded: it is
// useful for diagnostics and cannot mint closure evidence.
export const CLEAN_ELIGIBLE_VERDICTS = Object.freeze(["OBSERVED_HEALTHY"]);

export const EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED",        // a real bounded observation of a real endpoint
  "OPERATOR_ASSERTED", // an operator-owned command spoke on the node's behalf
  "TEST_INJECTION",  // composition testing only; never bridge readiness
  "NONE",
]);

const LOOPBACK_HOSTS = Object.freeze(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Loopback-only by contract. A non-local endpoint is refused rather than
 * observed — Dema's boundary forbids reaching an external provider by default,
 * and an observation that silently crossed the machine would launder a remote
 * claim into local evidence.
 *
 * Parsing is deliberate and total: anything unparseable is NOT local.
 */
export function isLoopbackEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length === 0) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return LOOPBACK_HOSTS.includes(url.hostname) ||
    LOOPBACK_HOSTS.includes(`[${url.hostname}]`);
}

const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;

/**
 * Build one deep-frozen, replayable observation.
 *
 * `hash` is injected (purity): the caller supplies the digest function, so this
 * kernel never imports crypto and the hash can be re-derived independently.
 * The hash covers the OBSERVED FACTS only — never `observed_at`, which is
 * metadata and would make an otherwise identical observation unrecognisable to
 * a witness bound to it.
 */
export function buildRuntimeObservation({
  adapterMode = null,
  configuredEndpoint = null,
  observedEndpoint = null,
  protocol = null,
  inspectedHome = null,
  raw = null,
  evidenceClass = "NONE",
  observedAt = null,
  repositoryCommit = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildRuntimeObservation requires an injected `hash`");
  }

  const blocked = [];
  const configured = isNonEmptyString(configuredEndpoint) || isNonEmptyString(adapterMode);

  // Identity is READ, never assigned. `normalizeNode0Status` hardcodes
  // node:"Node0"; this contract refuses to inherit that lie, so a payload that
  // does not name itself has no identity here.
  const runtimeIdentity = isNonEmptyString(raw?.runtime_identity)
    ? raw.runtime_identity
    : isNonEmptyString(raw?.node_id)
      ? raw.node_id
      : null;
  const runtimeDomain = isNonEmptyString(raw?.runtime_domain)
    ? raw.runtime_domain
    : null;

  const runtimeReady = raw?.ready === true;
  const consoleReady = raw?.console_ready === true || raw?.consoleReady === true;
  const activationGate = isNonEmptyString(raw?.activation_gate)
    ? raw.activation_gate
    : isNonEmptyString(raw?.activationGate)
      ? raw.activationGate
      : "BLOCKED";
  const runtimeHealth = isNonEmptyString(raw?.health) ? raw.health : null;

  let verdict;
  if (!configured) {
    verdict = "UNCONFIGURED";
    blocked.push("no_adapter_configured");
  } else if (evidenceClass === "TEST_INJECTION") {
    // An injected observation can exercise composition and can never be
    // promoted into bridge readiness, whatever it claims about itself.
    verdict = "CONFIGURED_NOT_OBSERVED";
    blocked.push("test_injection_is_not_observation");
  } else if (evidenceClass === "OPERATOR_ASSERTED") {
    // A shell-out is the operator speaking for the node. Real, useful, and not
    // the node's own authenticated answer.
    verdict = "OPERATOR_ASSERTED_STATUS";
    blocked.push("operator_asserted_status_cannot_prove_runtime_identity");
  } else if (evidenceClass === "NONE") {
    // An adapter was configured but produced no observation. Reporting this as
    // an endpoint refusal would describe a rejection that never happened —
    // "nothing answered" and "something wrong answered" are different facts and
    // must not be collapsed.
    verdict = "CONFIGURED_NOT_OBSERVED";
    blocked.push("adapter_configured_but_no_observation_produced");
  } else if (!raw || typeof raw !== "object") {
    verdict = "CONFIGURED_NOT_OBSERVED";
    blocked.push("no_response_or_malformed_response");
  } else if (!isLoopbackEndpoint(observedEndpoint)) {
    // Refused BEFORE any health reading, so a remote endpoint can never be
    // reported as healthy on the way to being rejected.
    verdict = "OBSERVED_IDENTITY_MISMATCH";
    blocked.push("non_local_endpoint_refused");
  } else if (runtimeDomain !== CANONICAL_RUNTIME_DOMAIN || !runtimeIdentity) {
    verdict = "OBSERVED_IDENTITY_MISMATCH";
    blocked.push(
      runtimeIdentity
        ? `runtime_domain_mismatch:${runtimeDomain ?? "absent"}`
        : "runtime_identity_absent",
    );
  } else if (!runtimeReady || runtimeHealth === "unhealthy") {
    verdict = "OBSERVED_UNHEALTHY";
    blocked.push("runtime_reports_not_ready");
  } else {
    verdict = "OBSERVED_HEALTHY";
  }

  // Availability must never grant activation: the gate is reported exactly as
  // the runtime stated it, and a healthy observation with a BLOCKED gate stays
  // healthy-and-unauthorized rather than becoming permission.
  if (activationGate !== "EXPLICIT_GO_REQUIRED") {
    blocked.push(`activation_gate_not_explicit_go:${activationGate}`);
  }

  const facts = {
    schema: NODE0_RUNTIME_OBSERVATION_SCHEMA,
    verdict,
    adapter_mode: adapterMode,
    configured_endpoint: configuredEndpoint,
    observed_endpoint: observedEndpoint,
    protocol,
    runtime_identity: runtimeIdentity,
    runtime_domain: runtimeDomain,
    runtime_health: runtimeHealth,
    runtime_ready: runtimeReady,
    console_ready: consoleReady,
    activation_gate: activationGate,
    inspected_home: inspectedHome,
    repository_commit: repositoryCommit,
    executed_code_hash: executedCodeHash,
    evidence_class: EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE",
    // Capability disclosure travels WITH the observation, so the health receipt
    // can no longer contradict what the adapter actually did.
    local_loopback_used: evidenceClass === "OBSERVED" && isLoopbackEndpoint(observedEndpoint),
    public_network_used: false,
    child_process_invoked: evidenceClass === "OPERATOR_ASSERTED",
    external_call_performed:
      evidenceClass === "OBSERVED" || evidenceClass === "OPERATOR_ASSERTED",
    activation_performed: false,
    authority_delta: 0,
    blocked_by: Object.freeze([...blocked]),
  };

  // The hash covers the facts only. `observed_at` is appended afterwards as
  // metadata so two identical observations taken a second apart still bind to
  // the same witness.
  const observation_hash = hash(facts);
  return Object.freeze({
    ...facts,
    observed_at: observedAt,
    observation_hash,
  });
}

/** Re-derive the hash from the observation's own fields — never trust the one it carries. */
export function verifyObservationHash(observation, hash) {
  if (typeof hash !== "function") {
    throw new TypeError("verifyObservationHash requires an injected `hash`");
  }
  if (!observation || typeof observation !== "object") return false;
  const { observed_at, observation_hash, ...facts } = observation;
  return hash(facts) === observation_hash;
}

/** Only a genuinely observed, healthy, identity-bound runtime may support CLEAN. */
export function isCleanEligibleObservation(observation) {
  return (
    !!observation &&
    CLEAN_ELIGIBLE_VERDICTS.includes(observation.verdict) &&
    observation.evidence_class === "OBSERVED" &&
    observation.activation_gate === "EXPLICIT_GO_REQUIRED" &&
    observation.authority_delta === 0
  );
}
