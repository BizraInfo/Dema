// NODE0-RUNTIME-WRITE-SURFACE-1A — can anything outside the governed loop
// silently mutate this node's sovereign state?
//
// THE ROW THIS SETTLES, and the misreading it exists to end. `remote_write`
// declares `required_scope: node0_deployment_remote_write`, and that was read
// for a while as "a Node0 already deployed somewhere on the Internet". It does
// not mean that. The guard that refused the old source scan says exactly what a
// source scan misses: "another LOCAL process writing to DEMA_HOME, a cloud-sync
// daemon replaying a directory, a git remote fetched by a LOCAL action, or a
// mounted share." Every one of those is a property of the machine the node is
// running on. The axis is DECLARED-IN-SOURCE vs ACTUALLY-RUNNING, not local vs
// remote — and reading it the other way produced a circular dependency in which
// Node0 had to be deployed before it could be closed, and closed before it could
// be deployed.
//
// So the subject here is the Genesis host itself: the soil, not the network.
//
// ABSENCE OF EVIDENCE IS NOT EVIDENCE OF ABSENCE, and this kernel is built so
// that distinction cannot be lost. A probe that could not run does NOT report
// "no writer found" — it reports that it could not run, and one unmeasurable
// required surface is enough to hold the whole verdict at UNKNOWN. `ss` printing
// nothing because it lacks permission looks identical to `ss` printing nothing
// because there is nothing there, and only the probe knows which happened.
//
// A LISTENER IS NOT A WRITE PATH. A socket on the machine says nothing until it
// is connected causally to sovereign state:
//
//   LISTENER -> PROCESS -> HANDLER/CAPABILITY -> DEMA_HOME
//
// If the process behind a listener cannot be identified, that chain is broken at
// step two and the surface is UNRESOLVED — not clear. The same holds for git: a
// configured remote is not a writer. Only an automatic mechanism capable of
// mutating the relevant state counts.
//
// THREAT MODEL, STATED SO IT CANNOT BE OVERCLAIMED. A closed verdict means:
// "no externally controlled or independently operating write mechanism is
// observed across the required runtime surfaces, at observation time." It does
// NOT mean "nothing in the universe could ever modify this directory." A
// compromised kernel, a malicious root actor, firmware or a hypervisor sit
// underneath every probe here. Demanding proof against those would make closure
// impossible on any general-purpose machine, which is a different claim than the
// one the invariant asks for.
//
// Pure: no fs, no network, no clock, no random, no spawn. Probe results in,
// verdict out. The impure half lives in the gatherer, so every branch below is
// testable with injected results and no real host is ever touched to manufacture
// a witness.

export const NODE0_RUNTIME_WRITE_SURFACE_SCHEMA =
  "bizra.dema.node0_runtime_write_surface.v0.1";

/// Must equal REMOTE_WRITE_OBSERVATION_SCOPE in node0-closure-invariants.js.
/// Stated as a literal rather than imported so this kernel stays dependency-free;
/// a test pins the two together so they cannot drift apart silently.
export const NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE = "node0_deployment_remote_write";

export const RUNTIME_WRITE_EVIDENCE_CLASSES = Object.freeze([
  "OBSERVED", "OPERATOR_ASSERTED", "TEST_INJECTION", "NONE",
]);

export const RUNTIME_WRITE_VERDICTS = Object.freeze([
  "NOT_OBSERVED",
  "OPERATOR_ASSERTED_ONLY",
  "NO_SURFACE_EVIDENCE",
  "RUNTIME_WRITE_SURFACE_INCOMPLETE",
  "RUNTIME_WRITE_SURFACE_CLOSED",
  "REMOTE_WRITE_OBSERVED",
]);

/**
 * The surfaces that must ALL be measured before any closed verdict.
 *
 * Enumerated as data so adding one is a reviewable line rather than a change in
 * control flow, and so a reader can see the coverage contract without tracing
 * branches. Dropping a surface from this list weakens the claim and must be as
 * visible as adding one.
 */
export const REQUIRED_SURFACES = Object.freeze([
  "filesystem",       // who, other than the owner, may write DEMA_HOME
  "mount",            // is the backing store local, or shared/networked/synced
  "listener",         // is any bound socket causally connected to sovereign state
  "synchronization",  // is any replication agent watching the directory
  "git_automation",   // is any automatic fetch/update able to mutate it
]);

const isBool = (v) => typeof v === "boolean";
const isArr = (v) => Array.isArray(v);

/**
 * One surface's contribution.
 *
 * `writer_found === true`  a qualifying write mechanism was OBSERVED
 * `writer_found === false` the surface was measured and none was found
 * `measured === false`     the probe could not run — says nothing either way
 * `unresolved[]`           measured, but a sub-question could not be answered
 */
export function classifySurface(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return "MALFORMED";
  if (s.writer_found === true) return "WRITER_OBSERVED";
  if (!isBool(s.measured) || s.measured === false) return "UNMEASURED";
  if (!isBool(s.writer_found)) return "UNMEASURED";
  if (isArr(s.unresolved) && s.unresolved.length > 0) return "UNRESOLVED";
  return "CLEAR";
}

/**
 * Verdict over all surfaces.
 *
 * A WRITER anywhere outranks everything: it is a positive observation, and an
 * unmeasurable surface elsewhere cannot soften it. Otherwise every required
 * surface must be CLEAR — measured, no writer, nothing left unresolved — before
 * the verdict may close. Anything else is INCOMPLETE, which the evaluator scores
 * UNKNOWN, which blocks closure exactly as a violation does.
 */
function classify(surfaces, cls) {
  if (cls === "OPERATOR_ASSERTED") return "OPERATOR_ASSERTED_ONLY";
  if (cls !== "OBSERVED") return "NOT_OBSERVED";
  if (!surfaces || typeof surfaces !== "object" || Array.isArray(surfaces)) {
    return "NO_SURFACE_EVIDENCE";
  }
  const states = REQUIRED_SURFACES.map((id) => classifySurface(surfaces[id]));
  if (states.includes("WRITER_OBSERVED")) return "REMOTE_WRITE_OBSERVED";
  if (states.every((s) => s === "CLEAR")) return "RUNTIME_WRITE_SURFACE_CLOSED";
  return "RUNTIME_WRITE_SURFACE_INCOMPLETE";
}

/// Only an observed writer or a fully closed surface contributes a value.
/// `remote_write` declares `required:false`, so `observed:false` scores
/// SATISFIED and `observed:true` scores VIOLATED. Everything else is null.
function observedFor(verdict) {
  if (verdict === "REMOTE_WRITE_OBSERVED") return true;
  if (verdict === "RUNTIME_WRITE_SURFACE_CLOSED") return false;
  return null;
}

/// Coverage, reported beside the verdict so a reader never has to infer why a
/// verdict was withheld. These are REASONS, never evidence.
export function coverageOf(surfaces) {
  const measured = [];
  const unavailable = [];
  const unresolved = [];
  for (const id of REQUIRED_SURFACES) {
    const state = classifySurface(surfaces?.[id]);
    if (state === "CLEAR" || state === "WRITER_OBSERVED") measured.push(id);
    else if (state === "UNRESOLVED") {
      measured.push(id);
      for (const u of surfaces[id].unresolved) unresolved.push(`${id}:${u}`);
    } else unavailable.push(id);
  }
  return Object.freeze({
    measured: Object.freeze(measured),
    unavailable: Object.freeze(unavailable),
    unresolved: Object.freeze(unresolved),
  });
}

export function buildRuntimeWriteSurfaceObservation({
  surfaces = null,
  subject = null,
  evidenceClass = "NONE",
  observedAt = null,
  executedCodeHash = null,
  hash,
} = {}) {
  if (typeof hash !== "function") {
    throw new TypeError("buildRuntimeWriteSurfaceObservation requires an injected `hash`");
  }
  const cls = RUNTIME_WRITE_EVIDENCE_CLASSES.includes(evidenceClass) ? evidenceClass : "NONE";
  const surface_verdict = classify(surfaces, cls);
  const coverage = coverageOf(surfaces);

  const body = {
    schema: NODE0_RUNTIME_WRITE_SURFACE_SCHEMA,
    evidence_class: cls,
    scope: NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
    surface_verdict,
    observed: observedFor(surface_verdict),
    // Identity of what was observed. A verdict about an unnamed host is not a
    // verdict about THIS node.
    subject: Object.freeze({
      node_id: subject?.node_id ?? null,
      dema_home: subject?.dema_home ?? null,
    }),
    surface_states: Object.freeze(
      Object.fromEntries(REQUIRED_SURFACES.map((id) => [id, classifySurface(surfaces?.[id])])),
    ),
    writers_observed: Object.freeze(
      REQUIRED_SURFACES.filter((id) => surfaces?.[id]?.writer_found === true),
    ),
    coverage,
    threat_boundary:
      "No externally controlled or independently operating write mechanism is observed "
      + "across the required runtime surfaces at observation time. This does NOT prove that "
      + "a compromised kernel, root actor, firmware or hypervisor could never mutate the "
      + "directory; those sit beneath every probe here.",
    executed_code_hash: executedCodeHash,
    authority_delta: 0,
    effect_delta: 0,
    observed_at: observedAt,
  };
  return Object.freeze({ ...body, observation_hash: hash(body) });
}

export function verifyRuntimeWriteSurfaceHash(observation, hash) {
  if (!observation || typeof observation !== "object") return false;
  const { observation_hash, ...body } = observation;
  try {
    return hash(body) === observation_hash;
  } catch {
    return false;
  }
}

/// The adapter may source the row only from a verdict that actually decided.
export function isDecidedRuntimeWriteSurface(o) {
  return Boolean(o)
    && (o.surface_verdict === "RUNTIME_WRITE_SURFACE_CLOSED"
      || o.surface_verdict === "REMOTE_WRITE_OBSERVED")
    && typeof o.observed === "boolean";
}
