// NODE0-RECOVERY-OBSERVATION-1A — the reader for `recovery_after_worker_exit`.
//
// One bounded file read. No execution, no mutation, no network. The artefact
// discloses `live_execution_performed: true` about the PRODUCER and its
// supervisor; this adapter performs none, and the review gate keeps declaring
// `execution_allowed: false`. Different subjects, both honest.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_RECOVERY_OBSERVATION_SCHEMA,
  NODE0_RUNTIME_KILL_RESUME_SCOPE,
  verifyRecoveryHash,
  isCleanEligibleRecovery,
} from "./node0-recovery-observation.js";

export const RECOVERY_INVARIANT_ID = "recovery_after_worker_exit";
export const RECOVERY_ARTEFACT_RELPATH = join("node0", "recovery", "observation.json");
const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-recovery-observation.js");

export const RECOVERY_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "UNREADABLE",
  "SCHEMA_MISMATCH",
  "HASH_UNVERIFIED",
  "KERNEL_BYTES_MISMATCH",
]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

export function currentRecoveryKernelHash(kernelPath = KERNEL_PATH) {
  try {
    return `sha256:${createHash("sha256").update(readFileSync(kernelPath)).digest("hex")}`;
  } catch {
    return null;
  }
}

function classify({ demaHome, kernelPath, readFile }) {
  let raw;
  try {
    raw = readFile(join(demaHome, RECOVERY_ARTEFACT_RELPATH));
  } catch (err) {
    return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null };
  }
  let a;
  try { a = JSON.parse(raw); } catch { return { state: "UNREADABLE", artefact: null }; }
  if (!a || typeof a !== "object" || Array.isArray(a)) return { state: "UNREADABLE", artefact: null };
  if (a.schema !== NODE0_RECOVERY_OBSERVATION_SCHEMA) return { state: "SCHEMA_MISMATCH", artefact: null };
  if (!verifyRecoveryHash(a, sha256CanonicalJsonV1)) return { state: "HASH_UNVERIFIED", artefact: null };
  const k = currentRecoveryKernelHash(kernelPath);
  if (k === null || a.executed_code_hash !== k) return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  return { state: "ACCEPTED", artefact: a };
}

const defaults = () => ({ demaHome: resolveDemaHome(), kernelPath: KERNEL_PATH, readFile: (p) => readFileSync(p, "utf8") });

export function recoveryAfterWorkerExitObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isCleanEligibleRecovery(artefact)) return null;
  return Object.freeze({
    observed: true,
    source: `NODE0-RECOVERY-1A ${artefact.recovery_verdict} ${artefact.observation_hash}`,
    scope: NODE0_RUNTIME_KILL_RESUME_SCOPE,
  });
}

/// A reason, never evidence: no `observed`, no `source`, no home path.
export function recoveryDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  return Object.freeze({
    state,
    integrity_suspect: RECOVERY_INTEGRITY_SUSPECT_STATES.includes(state),
    recovery_verdict: artefact?.recovery_verdict ?? null,
    settles_nothing: true,
  });
}
