// NODE0-RUNTIME-WRITE-SURFACE-1A — the reader for `remote_write`.
//
// One bounded file read. No execution, no mutation, no network, no probe. The
// artefact discloses that the PRODUCER inspected the real host; this adapter
// inspects nothing but the artefact. Same split as every other closure reader,
// for the same reason: the review gate can keep declaring execution_allowed:false
// honestly because the module the gate scans genuinely executes nothing.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_RUNTIME_WRITE_SURFACE_SCHEMA,
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  verifyRuntimeWriteSurfaceHash,
  isDecidedRuntimeWriteSurface,
} from "./node0-runtime-write-surface.js";

export const RUNTIME_WRITE_SURFACE_INVARIANT_ID = "remote_write";
export const RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH =
  join("node0", "write-surface", "observation.json");
const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-runtime-write-surface.js");

export const RUNTIME_WRITE_SURFACE_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "UNREADABLE", "SCHEMA_MISMATCH", "HASH_UNVERIFIED", "KERNEL_BYTES_MISMATCH",
]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

export function currentRuntimeWriteSurfaceKernelHash(kernelPath = KERNEL_PATH) {
  try {
    return `sha256:${createHash("sha256").update(readFileSync(kernelPath)).digest("hex")}`;
  } catch {
    return null;
  }
}

function classify({ demaHome, kernelPath, readFile }) {
  let raw;
  try {
    raw = readFile(join(demaHome, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH));
  } catch (err) {
    return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null };
  }
  let a;
  try { a = JSON.parse(raw); } catch { return { state: "UNREADABLE", artefact: null }; }
  if (!a || typeof a !== "object" || Array.isArray(a)) return { state: "UNREADABLE", artefact: null };
  if (a.schema !== NODE0_RUNTIME_WRITE_SURFACE_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  if (!verifyRuntimeWriteSurfaceHash(a, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  const k = currentRuntimeWriteSurfaceKernelHash(kernelPath);
  if (k === null || a.executed_code_hash !== k) {
    return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  }
  return { state: "ACCEPTED", artefact: a };
}

const defaults = () => ({
  demaHome: resolveDemaHome(),
  kernelPath: KERNEL_PATH,
  readFile: (p) => readFileSync(p, "utf8"),
});

/**
 * Sources the row only from a verdict that actually decided. An INCOMPLETE
 * surface contributes silence, which the evaluator scores UNKNOWN — never a
 * convenient `false`.
 */
export function remoteWriteObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isDecidedRuntimeWriteSurface(artefact)) return null;
  return Object.freeze({
    observed: artefact.observed,
    source: `NODE0-RUNTIME-WRITE-SURFACE-1A ${artefact.surface_verdict} ${artefact.observation_hash}`,
    scope: NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  });
}

/// A reason, never evidence: no `observed`, no `source`, no home path.
export function runtimeWriteSurfaceDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  return Object.freeze({
    state,
    integrity_suspect: RUNTIME_WRITE_SURFACE_INTEGRITY_SUSPECT_STATES.includes(state),
    surface_verdict: artefact?.surface_verdict ?? null,
    unavailable: artefact?.coverage?.unavailable ?? null,
    unresolved: artefact?.coverage?.unresolved ?? null,
    settles_nothing: true,
  });
}
