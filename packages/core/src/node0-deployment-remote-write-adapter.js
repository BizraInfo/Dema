// NODE0-DEPLOYMENT-REMOTE-WRITE-ADAPTER-1A — the reader for `remote_write`.
//
// One bounded file read. No execution, no mutation, no network. The artefact
// discloses `live_execution_performed: true` about the PRODUCER, which ran on the
// host where the numbers are true; this module performs none, so the review gate
// keeps declaring `execution_allowed: false` honestly.
//
// This is the row that starts UNKNOWN because nothing anywhere guarded it, and it
// is the row that governs whether an outside party can write into the node. So
// the bar is set higher here than elsewhere: silence is the default, and only an
// OBSERVED artefact whose body re-hashes, whose kernel bytes still match the
// kernel on disk, whose scope is exact, and whose verdict is NO_EXTERNAL_WRITE_PATH
// may settle it. An INCOMPLETE artefact — which is what a namespaced observer
// produces — settles nothing.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA,
  NODE0_DEPLOYMENT_REMOTE_WRITE_LEGACY_SCHEMA,
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  deploymentSurfaceFacetCounts,
  evaluateDeploymentSurface,
  verifyDeploymentRemoteWriteHash,
  isCleanEligibleDeployment,
} from "./node0-deployment-remote-write.js";

export const REMOTE_WRITE_INVARIANT_ID = "remote_write";

export const REMOTE_WRITE_ARTEFACT_RELPATH = join("node0", "deployment", "observation.json");

const KERNEL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "node0-deployment-remote-write.js",
);
const COLLECTOR_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "scripts", "proof", "node0-deployment-remote-write-proof.mjs",
);
const MAX_OBSERVATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

export const REMOTE_WRITE_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "UNREADABLE",
  "SCHEMA_MISMATCH",
  "LEGACY_DERIVATION_UNVERIFIED",
  "HASH_UNVERIFIED",
  "KERNEL_BYTES_MISMATCH",
  "COLLECTOR_BYTES_MISMATCH",
  "DERIVATION_UNVERIFIED",
  "DERIVATION_MISMATCH",
  "INVALID_OBSERVED_AT",
  "OBSERVATION_FUTURE_DATED",
]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

function currentCodeHash(path) {
  try {
    return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
  } catch {
    return null;
  }
}

export function currentRemoteWriteKernelHash(kernelPath = KERNEL_PATH) {
  return currentCodeHash(kernelPath);
}

export function currentRemoteWriteCollectorHash(collectorPath = COLLECTOR_PATH) {
  return currentCodeHash(collectorPath);
}

function temporalState(observedAt, now) {
  const observedMs = typeof observedAt === "string" ? Date.parse(observedAt) : Number.NaN;
  const nowMs = typeof now === "function" ? now() : now;
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs)) return "INVALID_OBSERVED_AT";
  if (observedMs - nowMs > MAX_FUTURE_CLOCK_SKEW_MS) return "OBSERVATION_FUTURE_DATED";
  if (nowMs - observedMs > MAX_OBSERVATION_AGE_MS) return "OBSERVATION_STALE";
  return null;
}

function sameCanonicalJson(a, b) {
  return sha256CanonicalJsonV1(a) === sha256CanonicalJsonV1(b);
}

function classify({ demaHome, kernelPath, collectorPath, readFile, now }) {
  let raw;
  try {
    raw = readFile(join(demaHome, REMOTE_WRITE_ARTEFACT_RELPATH));
  } catch (err) {
    return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null };
  }
  let a;
  try { a = JSON.parse(raw); } catch { return { state: "UNREADABLE", artefact: null }; }
  if (!a || typeof a !== "object" || Array.isArray(a)) {
    return { state: "UNREADABLE", artefact: null };
  }
  if (a.schema === NODE0_DEPLOYMENT_REMOTE_WRITE_LEGACY_SCHEMA) {
    return { state: "LEGACY_DERIVATION_UNVERIFIED", artefact: null };
  }
  if (a.schema !== NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  // A narrow instrument must not be relabelled onto this broad question.
  if (a.scope !== NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  if (!verifyDeploymentRemoteWriteHash(a, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  const k = currentRemoteWriteKernelHash(kernelPath);
  if (k === null || a.executed_code_hash !== k) {
    return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  }
  const c = currentRemoteWriteCollectorHash(collectorPath);
  if (c === null || a.collector_code_hash !== c) {
    return { state: "COLLECTOR_BYTES_MISMATCH", artefact: null };
  }
  const timeState = temporalState(a.observed_at, now);
  if (timeState) return { state: timeState, artefact: null };
  if (!a.surface || typeof a.surface !== "object" || Array.isArray(a.surface)) {
    return { state: "DERIVATION_UNVERIFIED", artefact: null };
  }
  const derived = evaluateDeploymentSurface(a.surface);
  const derivedCounts = deploymentSurfaceFacetCounts(a.surface);
  if (
    a.remote_write_verdict !== derived.verdict ||
    a.remote_write_reason !== derived.reason ||
    a.external_write_path_present !== derived.external_write_path_present ||
    !Array.isArray(a.findings) ||
    !sameCanonicalJson(a.findings, derived.findings) ||
    !a.facet_counts || typeof a.facet_counts !== "object" || Array.isArray(a.facet_counts) ||
    !sameCanonicalJson(a.facet_counts, derivedCounts)
  ) {
    return { state: "DERIVATION_MISMATCH", artefact: null };
  }
  return { state: "ACCEPTED", artefact: a };
}

const defaults = () => ({
  demaHome: resolveDemaHome(),
  kernelPath: KERNEL_PATH,
  collectorPath: COLLECTOR_PATH,
  readFile: (p) => readFileSync(p, "utf8"),
  now: () => Date.now(),
});

/**
 * The invariant declares `required: false` — "no external party may silently
 * mutate local sovereign state". So a clean surface emits `observed: false`,
 * which the evaluator scores SATISFIED, and a surface carrying a write path emits
 * `observed: true`, which scores VIOLATED. A real refutation, not silence.
 */
const REMOTE_WRITE_ARTEFACT_RELPATH_REEVALUATION = join("node0", "deployment", "observation.json");

export function remoteWriteDeploymentObservation(opts = {}) {
  const { demaHome, kernelPath, collectorPath, readFile, now } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, collectorPath, readFile, now });
  if (state !== "ACCEPTED") return null;

  if (isCleanEligibleDeployment(artefact)) {
    return Object.freeze({
      observed: false,
      source: `NODE0-DEPLOYMENT-REMOTE-WRITE-1A ${artefact.remote_write_verdict} ${artefact.observation_hash}`,
      scope: NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
    });
  }
  // A measured surface that FOUND a write path is evidence, and it must be able
  // to refute the row rather than fall silent.
  if (
    artefact.evidence_class === "OBSERVED" &&
    artefact.remote_write_verdict === "EXTERNAL_WRITE_PATH_PRESENT"
  ) {
    return Object.freeze({
      observed: true,
      source: `NODE0-DEPLOYMENT-REMOTE-WRITE-1A ${artefact.remote_write_verdict} ${artefact.observation_hash}`,
      scope: NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
    });
  }
  // INCOMPLETE settles nothing.
  return null;
}

export function remoteWriteDeploymentDiagnostic(opts = {}) {
  const { demaHome, kernelPath, collectorPath, readFile, now } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, collectorPath, readFile, now });
  if (state !== "ACCEPTED") {
    return Object.freeze({
      invariant_id: REMOTE_WRITE_INVARIANT_ID,
      state,
      integrity_suspect: REMOTE_WRITE_INTEGRITY_SUSPECT_STATES.includes(state),
    });
  }
  return Object.freeze({
    invariant_id: REMOTE_WRITE_INVARIANT_ID,
    state: artefact.remote_write_verdict === "INCOMPLETE" ? "NOT_CLEAN_ELIGIBLE" : "ACCEPTED",
    remote_write_verdict: artefact.remote_write_verdict ?? null,
    remote_write_reason: artefact.remote_write_reason ?? null,
    finding_count: Array.isArray(artefact.findings) ? artefact.findings.length : null,
    integrity_suspect: false,
  });
}
