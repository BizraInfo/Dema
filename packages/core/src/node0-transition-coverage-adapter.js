// NODE0-TRANSITION-COVERAGE-1A — the reader for `receipt_per_transition`.
//
// One bounded file read. It emits an observation ONLY when the recorded run was
// OBSERVED, hash-verified, judged by the kernel bytes on disk, AND reached a
// verdict that carries an `observed` value. An UNKNOWN verdict yields null, so
// the evaluator scores the row UNKNOWN rather than being handed a refutation
// nobody measured.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_TRANSITION_COVERAGE_SCHEMA,
  NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE,
  verifyTransitionCoverageHash,
} from "./node0-transition-coverage.js";

export const TRANSITION_COVERAGE_INVARIANT_ID = "receipt_per_transition";
export const TRANSITION_COVERAGE_ARTEFACT_RELPATH = join("node0", "coverage", "observation.json");
const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-transition-coverage.js");

export const COVERAGE_INTEGRITY_SUSPECT_STATES = Object.freeze(["UNREADABLE", "SCHEMA_MISMATCH", "HASH_UNVERIFIED", "KERNEL_BYTES_MISMATCH"]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}
export function currentCoverageKernelHash(kernelPath = KERNEL_PATH) {
  try { return `sha256:${createHash("sha256").update(readFileSync(kernelPath)).digest("hex")}`; } catch { return null; }
}

function classify({ demaHome, kernelPath, readFile }) {
  let raw;
  try { raw = readFile(join(demaHome, TRANSITION_COVERAGE_ARTEFACT_RELPATH)); }
  catch (err) { return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null }; }
  let a;
  try { a = JSON.parse(raw); } catch { return { state: "UNREADABLE", artefact: null }; }
  if (!a || typeof a !== "object" || Array.isArray(a)) return { state: "UNREADABLE", artefact: null };
  if (a.schema !== NODE0_TRANSITION_COVERAGE_SCHEMA) return { state: "SCHEMA_MISMATCH", artefact: null };
  if (!verifyTransitionCoverageHash(a, sha256CanonicalJsonV1)) return { state: "HASH_UNVERIFIED", artefact: null };
  const k = currentCoverageKernelHash(kernelPath);
  if (k === null || a.executed_code_hash !== k) return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  return { state: "ACCEPTED", artefact: a };
}
const defaults = () => ({ demaHome: resolveDemaHome(), kernelPath: KERNEL_PATH, readFile: (p) => readFileSync(p, "utf8") });

/// Emits `observed:false` for a measured violation and `observed:true` for
/// measured full coverage. An UNKNOWN verdict emits nothing at all.
export function transitionCoverageObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED") return null;
  if (artefact.evidence_class !== "OBSERVED") return null;
  if (artefact.observed !== true && artefact.observed !== false) return null;
  return Object.freeze({
    observed: artefact.observed,
    source: `NODE0-TRANSITION-COVERAGE-1A ${artefact.coverage_verdict} [${(artefact.counterexample_domains ?? []).join("|")}] ${artefact.observation_hash}`,
    scope: NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE,
  });
}

export function transitionCoverageDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  return Object.freeze({
    state,
    integrity_suspect: COVERAGE_INTEGRITY_SUSPECT_STATES.includes(state),
    coverage_verdict: artefact?.coverage_verdict ?? null,
    settles_nothing: true,
  });
}
