// NODE0-WORKER-HANDOFF-1A — the adapter that turns a RECORDED handoff into one
// scoped closure observation.
//
// ── WHY THIS READS AN ARTEFACT INSTEAD OF MEASURING ──
// `worker_is_replaceable` cannot be settled by anything that does not kill a
// process and watch another resume. The review gate declares
// `execution_allowed: false` and must keep declaring it. Both stay true only if
// the two acts are separated: a PRODUCER executes and records, and this adapter
// READS. The observation carries `live_execution_performed: true` because the
// producer did execute — the gate's own boundary says the GATE did not. Those
// are different subjects and both statements are honest.
//
// This module performs no execution, no mutation, no network. One file read.
//
// ── WHAT WOULD MAKE THIS FORGEABLE, STATED PLAINLY ──
// The artefact binds to `executed_code_hash`: the bytes of the classification
// kernel that produced the verdict. That is a real property — loosen the kernel
// and every existing artefact stops validating — but it is NOT unforgeable. A
// party who can write into DEMA_HOME and read the kernel can hand-author a
// passing artefact. Closing that needs the producer to sign, which needs a
// signer, which is out of scope and gated. Until then this adapter can prove the
// verdict was computed by exactly these rules; it cannot prove a process died.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  verifyWorkerHandoffHash,
  isCleanEligibleHandoff,
  NODE0_WORKER_HANDOFF_SCHEMA,
  NODE0_WORKER_HANDOFF_SCOPE,
} from "./node0-worker-handoff.js";

/// The ONE invariant this adapter may address, and the ONE scope it may claim.
/// The scope is IMPORTED, never retyped — NCG-09 asserts this binding for every
/// registered adapter, and it exists because the first adapter retyped its own.
export const WORKER_HANDOFF_INVARIANT_ID = "worker_is_replaceable";
export { NODE0_WORKER_HANDOFF_SCOPE };

export const HANDOFF_ARTEFACT_RELPATH = join("node0", "handoff", "observation.json");

/// The kernel whose bytes an artefact must name. Resolved from this module so it
/// cannot drift from the kernel actually imported above.
const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-worker-handoff.js");

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

/** sha256 of the classification kernel's bytes as they exist right now. */
export function currentKernelHash(kernelPath = KERNEL_PATH) {
  try {
    return sha256CanonicalJsonV1({ bytes: readFileSync(kernelPath, "utf8") });
  } catch {
    return null;
  }
}

/// Every way the recorded handoff can be judged. Closed vocabulary: a state not
/// listed here cannot be reported.
export const HANDOFF_DIAGNOSTIC_STATES = Object.freeze([
  "NOT_RECORDED",          // no artefact — the system working, nothing has run
  "UNREADABLE",            // present but not parseable as an object
  "SCHEMA_MISMATCH",
  "SCOPE_MISMATCH",
  "HASH_UNVERIFIED",       // the carried digest does not re-derive
  "NOT_CLEAN_ELIGIBLE",    // injected, asserted, or an honestly failed handoff
  "KERNEL_BYTES_MISMATCH", // judged by rules that are no longer the rules
  "ACCEPTED",
]);

/// States that mean something is WRONG rather than merely absent.
///
/// `NOT_RECORDED` is deliberately excluded: nobody having run the producer is
/// the ordinary state of a clean machine. The three below are different — each
/// means an artefact exists and failed a check it should have passed, which is
/// what a hand-edited or misrouted artefact looks like. Collapsing them into
/// absence is the inverse of the estate's rule that an empty result from a
/// broken query reads exactly like a clean pass.
export const HANDOFF_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "HASH_UNVERIFIED",
  "NOT_CLEAN_ELIGIBLE",
  "KERNEL_BYTES_MISMATCH",
]);

/**
 * The ONE classifier. Both the evidence path and the diagnostic path consume
 * this, so an artefact can never be accepted by one and rejected by the other.
 * Returns `{ state, artefact }`; `artefact` is present only when ACCEPTED.
 */
function classifyHandoffArtefact({ demaHome, kernelPath, readFile }) {
  let raw;
  try {
    raw = readFile(join(demaHome, HANDOFF_ARTEFACT_RELPATH));
  } catch (err) {
    // "No file" and "a file I could not read" are different facts.
    return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null };
  }

  let artefact;
  try {
    artefact = JSON.parse(raw);
  } catch {
    return { state: "UNREADABLE", artefact: null };
  }
  if (!artefact || typeof artefact !== "object" || Array.isArray(artefact)) {
    return { state: "UNREADABLE", artefact: null };
  }

  if (artefact.schema !== NODE0_WORKER_HANDOFF_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  if (artefact.scope !== NODE0_WORKER_HANDOFF_SCOPE) {
    return { state: "SCOPE_MISMATCH", artefact: null };
  }
  // Re-derive rather than trust. An artefact edited after recording — including
  // one whose verdict was upgraded by hand — fails here.
  if (!verifyWorkerHandoffHash(artefact, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  // Only a genuinely observed, fully proven handoff. TEST_INJECTION and
  // OPERATOR_ASSERTED are refused by the kernel's own eligibility rule.
  if (!isCleanEligibleHandoff(artefact)) {
    return { state: "NOT_CLEAN_ELIGIBLE", artefact: null };
  }
  // The verdict must have been computed by the kernel as it stands now. Relax
  // the classification rules and every artefact recorded under the old ones
  // stops counting, which is the intended direction of failure.
  const kernelHash = currentKernelHash(kernelPath);
  if (kernelHash === null || artefact.executed_code_hash !== kernelHash) {
    return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  }
  return { state: "ACCEPTED", artefact };
}

/**
 * Read the recorded handoff, if any, and convert it into a closure observation.
 *
 * Returns `null` for every failure — absent, unparseable, unverified, injected,
 * unproven, or bound to different kernel bytes. Silence is the correct answer:
 * the kernel scores a missing observation as UNKNOWN, never as satisfaction, and
 * an adapter that explained itself by returning a partial observation would be
 * offering the ledger something it must not score.
 *
 * When you need to know WHY it fell silent, call `workerHandoffDiagnostic` —
 * which reports a reason and can never settle anything.
 */
export function workerHandoffObservation({
  demaHome = resolveDemaHome(),
  kernelPath = KERNEL_PATH,
  readFile = (p) => readFileSync(p, "utf8"),
} = {}) {
  const { state, artefact } = classifyHandoffArtefact({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED") return null;

  return Object.freeze({
    observed: true,
    // Binds to the exact recorded handoff, not merely to the kernel that judged
    // it: a source naming only the kernel would be satisfied by any run.
    source: `NODE0-WORKER-HANDOFF-1A ${artefact.verdict} ${artefact.observation_hash}`,
    scope: NODE0_WORKER_HANDOFF_SCOPE,
  });
}

/**
 * Why the row is UNKNOWN — a reason, never evidence.
 *
 * This exists because seven distinct refusals previously produced one identical
 * silence, so a hand-edited artefact was indistinguishable from a machine on
 * which nothing had ever run. The first is the system working; the others are
 * signals.
 *
 * It carries NO `observed` and NO `source` field, by construction: a diagnostic
 * that could be mistaken for an observation would be a second, weaker path to
 * SATISFIED. It also does not report the home path — the ledger is a publishable
 * truth surface and the operator's filesystem layout is not part of the claim.
 */
export function workerHandoffDiagnostic({
  demaHome = resolveDemaHome(),
  kernelPath = KERNEL_PATH,
  readFile = (p) => readFileSync(p, "utf8"),
} = {}) {
  const { state } = classifyHandoffArtefact({ demaHome, kernelPath, readFile });
  return Object.freeze({
    invariant_id: WORKER_HANDOFF_INVARIANT_ID,
    state,
    integrity_suspect: HANDOFF_INTEGRITY_SUSPECT_STATES.includes(state),
    settles_nothing: true,
  });
}
