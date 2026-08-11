// NODE0-HISTORY-REPLAY-1A — the reader for `full_history_replayable`.
//
// One bounded file read. No execution, no mutation, no network. The artefact
// discloses that the PRODUCER spawned processes and killed one; this adapter
// spawns nothing. Different subjects, both honest — the same split the recovery
// adapter makes for the same reason.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA,
  NODE0_HISTORY_REPLAY_SCOPE,
  verifyHistoryReplayHash,
  isProvenHistoryReplay,
} from "./node0-history-replay-observation.js";

export const HISTORY_REPLAY_INVARIANT_ID = "full_history_replayable";
export const HISTORY_REPLAY_ARTEFACT_RELPATH = join("node0", "replay", "observation.json");
const KERNEL_PATH = join(dirname(fileURLToPath(import.meta.url)), "node0-history-replay-observation.js");

/// `NOT_RECORDED` is excluded on purpose: nobody having run the producer is the
/// system working. The rest mean an artefact exists and failed a check it should
/// have passed, which is what a hand-edited or misrouted artefact looks like.
export const HISTORY_REPLAY_INTEGRITY_SUSPECT_STATES = Object.freeze([
  "UNREADABLE",
  "SCHEMA_MISMATCH",
  "HASH_UNVERIFIED",
  "KERNEL_BYTES_MISMATCH",
]);

export function resolveDemaHome(env = process.env) {
  return env.DEMA_HOME || join(homedir(), ".dema");
}

export function currentHistoryReplayKernelHash(kernelPath = KERNEL_PATH) {
  try {
    return `sha256:${createHash("sha256").update(readFileSync(kernelPath)).digest("hex")}`;
  } catch {
    return null;
  }
}

function classify({ demaHome, kernelPath, readFile }) {
  let raw;
  try {
    raw = readFile(join(demaHome, HISTORY_REPLAY_ARTEFACT_RELPATH));
  } catch (err) {
    return { state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE", artefact: null };
  }
  let a;
  try { a = JSON.parse(raw); } catch { return { state: "UNREADABLE", artefact: null }; }
  if (!a || typeof a !== "object" || Array.isArray(a)) return { state: "UNREADABLE", artefact: null };
  if (a.schema !== NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  if (!verifyHistoryReplayHash(a, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  const k = currentHistoryReplayKernelHash(kernelPath);
  if (k === null || a.executed_code_hash !== k) return { state: "KERNEL_BYTES_MISMATCH", artefact: null };
  return { state: "ACCEPTED", artefact: a };
}

const defaults = () => ({
  demaHome: resolveDemaHome(),
  kernelPath: KERNEL_PATH,
  readFile: (p) => readFileSync(p, "utf8"),
});

export function fullHistoryReplayableObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isProvenHistoryReplay(artefact)) return null;
  return Object.freeze({
    observed: true,
    source: `NODE0-HISTORY-REPLAY-1A ${artefact.replay_verdict} ${artefact.observation_hash}`,
    scope: NODE0_HISTORY_REPLAY_SCOPE,
  });
}

/// A reason, never evidence: no `observed`, no `source`, no home path.
export function historyReplayDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  return Object.freeze({
    state,
    integrity_suspect: HISTORY_REPLAY_INTEGRITY_SUSPECT_STATES.includes(state),
    replay_verdict: artefact?.replay_verdict ?? null,
    settles_nothing: true,
  });
}
