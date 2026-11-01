// NODE0-ENDURANCE-INSTRUMENTATION-FREEZE-1A — the pure kernel.
//
// A 72h endurance verdict is only as strong as the claim "these exact bytes
// observed the node the whole time". Measured 2026-08-16: a soak began and its
// own status bridge changed on disk mid-run — nothing in the record could say
// which instrumentation produced which sample. This kernel gives the record
// that voice: a manifest freezes the executing surface, its canonical hash is
// bound into the chain header, and every sample compares a fresh observation
// against the frozen contract. Any changed byte is INSTRUMENTATION_DRIFT.
//
// Pure by construction: no IO, no clock, no environment. Gathering lives with
// the runner (fs-only) and the host start script; judging lives here.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const INSTRUMENTATION_MANIFEST_SCHEMA =
  "bizra.dema.node0_instrumentation_manifest.v0.1";

// The verdict a sample carries when the executing surface no longer matches
// the frozen contract. ok:false always accompanies it — a drifted observer
// cannot certify health, whatever its probes say.
export const INSTRUMENTATION_DRIFT_VERDICT = "INSTRUMENTATION_DRIFT";

/**
 * Secret material must never enter evidence. The scan is fail-closed pattern
 * matching over every string in the manifest: JWT-shaped values (three
 * dot-joined base64url segments starting "eyJ") and PEM private-key banners.
 * Token FILE MODES are evidence; token BYTES are never.
 */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const PEM_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

export function scanForSecretMaterial(value, path = "$", findings = []) {
  if (typeof value === "string") {
    if (JWT_PATTERN.test(value)) findings.push(`${path}: jwt_shaped_value`);
    if (PEM_PATTERN.test(value)) findings.push(`${path}: private_key_material`);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForSecretMaterial(v, `${path}[${i}]`, findings));
    return findings;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      scanForSecretMaterial(v, `${path}.${k}`, findings);
    }
  }
  return findings;
}

/**
 * The bundle hash is THE identity of the instrumentation. Canonicalization is
 * stableStringify — the same authority the consent layer uses — so any two
 * surfaces (host start script, runner, verifier, extraction) that hash the
 * same manifest object agree byte-for-byte. There is exactly one
 * canonicalization; a second one would be a second source of truth.
 */
export function deriveInstrumentationBundleHash(manifest) {
  return sha256(stableStringify(manifest));
}

/**
 * Fail-closed shape gate. A manifest that cannot be validated never reaches
 * the chain header. `rederivable` is the load-bearing field: without it no
 * sample could re-check anything and the freeze would be an assertion.
 */
export function validateInstrumentationManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, problems: ["manifest_not_an_object"] };
  }
  if (manifest.schema !== INSTRUMENTATION_MANIFEST_SCHEMA) {
    problems.push(`schema_mismatch:${String(manifest.schema)}`);
  }
  const r = manifest.rederivable;
  if (!r || typeof r !== "object") {
    problems.push("rederivable_contract_missing");
  } else {
    if (!r.files || typeof r.files !== "object" || Object.keys(r.files).length === 0) {
      problems.push("rederivable_files_missing");
    }
    if (typeof r.node_version !== "string" || r.node_version.length === 0) {
      problems.push("rederivable_node_version_missing");
    }
  }
  const secrets = scanForSecretMaterial(manifest);
  for (const s of secrets) problems.push(`secret_material:${s}`);
  return { ok: problems.length === 0, problems };
}

/**
 * Pure exact comparison of a fresh observation against the frozen contract.
 *
 * Absence is drift: a file that vanished, or a field the observation could
 * not produce, is a changed surface — never a skipped check. The drift list
 * names every disagreement so the sample records WHAT moved, not just THAT
 * something moved.
 */
export function compareInstrumentationObservation({ frozen, observed } = {}) {
  const drift = [];
  if (!frozen || typeof frozen !== "object") {
    return { drifted: true, drift: ["frozen_contract_missing"] };
  }
  const obs = observed && typeof observed === "object" ? observed : {};

  const frozenFiles = frozen.files ?? {};
  const observedFiles = obs.files ?? {};
  for (const [path, hash] of Object.entries(frozenFiles)) {
    const got = observedFiles[path];
    if (got === undefined) drift.push(`file_missing:${path}`);
    else if (got !== hash) drift.push(`file_hash_changed:${path}`);
  }

  if (obs.node_version !== frozen.node_version) {
    drift.push(
      `node_version_changed:${String(frozen.node_version)}->${String(obs.node_version)}`,
    );
  }

  const frozenExe = frozen.node_executable ?? {};
  const obsExe = obs.node_executable ?? {};
  if (frozenExe.path !== undefined && obsExe.path !== frozenExe.path) {
    drift.push(`node_executable_path_changed:${String(obsExe.path)}`);
  }
  if (frozenExe.sha256 !== undefined && obsExe.sha256 !== frozenExe.sha256) {
    drift.push("node_executable_bytes_changed");
  }

  if (frozen.dema_home_realpath !== undefined
      && obs.dema_home_realpath !== frozen.dema_home_realpath) {
    drift.push(`dema_home_changed:${String(obs.dema_home_realpath)}`);
  }

  // The restart vector: Restart=on-failure re-reads the unit file into a NEW
  // process, so a mid-run unit edit surfaces as changed environment on resume.
  // Values here are operator-declared non-secret configuration (e.g. the
  // status command line) — never credentials.
  if (frozen.env !== undefined) {
    const obsEnv = obs.env ?? {};
    for (const [name, value] of Object.entries(frozen.env)) {
      if (obsEnv[name] !== value) {
        drift.push(`env_changed:${name}`);
      }
    }
  }

  return { drifted: drift.length > 0, drift };
}
