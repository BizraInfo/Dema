// NODE0-RUNTIME-MISSION-OBSERVATION-1A — the reader.
//
// Converts ONE recorded runtime artefact into up to TWO scoped closure
// observations — or into nothing at all. It performs a single file read: no
// execution, no mutation, no network. The artefact discloses
// `live_execution_performed: true` about the PRODUCER; this adapter performs
// none, and the review gate keeps declaring `execution_allowed: false`. Both
// statements are honest because they describe different subjects.
//
// EACH ROW IS JUDGED SEPARATELY. One artefact can honestly prove state ownership
// while failing contract immutability, and collapsing them would let a partial
// observation settle a row it never touched.
//
// SILENCE IS THE CORRECT ANSWER on every failure — absent, unparseable,
// unverified, injected, unproven, or bound to different kernel bytes. The
// evaluator scores a missing observation as UNKNOWN, never as satisfaction. When
// you need to know WHY, call the diagnostic, which can settle nothing.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_RUNTIME_MISSION_SCHEMA,
  NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE,
  NODE0_CONTRACT_IMMUTABILITY_SCOPE,
  verifyRuntimeMissionHash,
  isCleanEligibleStateOwnership,
  isCleanEligibleContractImmutability,
} from "./node0-runtime-mission-observation.js";

export const STATE_OWNERSHIP_INVARIANT_ID = "mission_is_primary_state";
export const CONTRACT_IMMUTABILITY_INVARIANT_ID = "contract_is_immutable";
export const RUNTIME_MISSION_ARTEFACT_RELPATH = join("node0", "runtime-mission", "observation.json");

const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-runtime-mission-observation.js");

/// Three of these mean the artefact is suspect; NOT_RECORDED deliberately does
/// not, because a clean machine is not a suspicious machine.
export const RUNTIME_MISSION_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "UNREADABLE",
  "SCHEMA_MISMATCH",
  "HASH_UNVERIFIED",
  "KERNEL_BYTES_MISMATCH",
]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

export function currentRuntimeKernelHash(kernelPath = KERNEL_PATH) {
  try {
    return `sha256:${createHash("sha256").update(readFileSync(kernelPath)).digest("hex")}`;
  } catch {
    return null;
  }
}

function classifyRuntimeArtefact({ demaHome, kernelPath, readFile }) {
  let raw;
  try {
    raw = readFile(join(demaHome, RUNTIME_MISSION_ARTEFACT_RELPATH));
  } catch (err) {
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
  if (artefact.schema !== NODE0_RUNTIME_MISSION_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  // Re-derive rather than trust. An artefact edited after recording — including
  // one whose verdict was upgraded by hand — fails here.
  if (!verifyRuntimeMissionHash(artefact, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  // The verdict must have been computed by the kernel as it stands now. Relax the
  // classification rules and every artefact recorded under the old ones stops
  // counting, which is the intended direction of failure.
  const kernelHash = currentRuntimeKernelHash(kernelPath);
  if (kernelHash === null || artefact.executed_code_hash !== kernelHash) {
    return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  }
  return { state: "ACCEPTED", artefact };
}

const readerDefaults = () => ({
  demaHome: resolveDemaHome(),
  kernelPath: KERNEL_PATH,
  readFile: (p) => readFileSync(p, "utf8"),
});

/// `mission_is_primary_state`. Binds to the exact recorded observation, not merely
/// to the kernel that judged it: a source naming only the kernel would be
/// satisfied by any run.
export function missionPrimaryStateObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...readerDefaults(), ...opts };
  const { state, artefact } = classifyRuntimeArtefact({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isCleanEligibleStateOwnership(artefact)) return null;
  return Object.freeze({
    observed: true,
    source: `NODE0-RUNTIME-MISSION-1A ${artefact.state_ownership_verdict} ${artefact.observation_hash}`,
    scope: NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE,
  });
}

/// `contract_is_immutable`. Judged independently of the row above.
export function contractImmutabilityObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...readerDefaults(), ...opts };
  const { state, artefact } = classifyRuntimeArtefact({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isCleanEligibleContractImmutability(artefact)) return null;
  return Object.freeze({
    observed: true,
    source: `NODE0-RUNTIME-MISSION-1A ${artefact.contract_immutability_verdict} ${artefact.observation_hash}`,
    scope: NODE0_CONTRACT_IMMUTABILITY_SCOPE,
  });
}

/// Why a row fell silent — a reason, never evidence. It carries no `observed` and
/// no `source` by construction, and it does not report the home path: the ledger
/// is a publishable truth surface and the operator's filesystem layout is not
/// part of the claim.
export function runtimeMissionDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...readerDefaults(), ...opts };
  const { state, artefact } = classifyRuntimeArtefact({ demaHome, kernelPath, readFile });
  return Object.freeze({
    state,
    integrity_suspect: RUNTIME_MISSION_INTEGRITY_SUSPECT_STATES.includes(state),
    state_ownership_verdict: artefact?.state_ownership_verdict ?? null,
    contract_immutability_verdict: artefact?.contract_immutability_verdict ?? null,
    settles_nothing: true,
  });
}
