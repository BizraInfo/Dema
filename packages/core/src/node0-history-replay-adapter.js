// NODE0-HISTORY-REPLAY-ADAPTER-1A — the reader for `full_history_replayable`.
//
// One bounded file read. No execution, no mutation, no network. The artefact
// discloses `live_execution_performed: true` about the PRODUCER; this adapter
// performs none, so the review gate keeps declaring `execution_allowed: false`
// while still being able to learn the answer. Different subjects, both honest.
//
// Four ways to stay silent, and silence is not refusal: a missing artefact means
// nobody has run the producer on this machine, which the kernel scores UNKNOWN.
// Only an OBSERVED artefact whose body re-hashes, whose executed kernel bytes
// still match the kernel on disk, and whose verdict is RECONSTRUCTED_EXACT may
// settle the row.

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
  isCleanEligibleHistoryReplay,
} from "./node0-history-replay.js";

export const HISTORY_REPLAY_INVARIANT_ID = "full_history_replayable";

export const HISTORY_REPLAY_ARTEFACT_RELPATH = join(
  "node0",
  "history-replay",
  "observation.json",
);

const KERNEL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "node0-history-replay.js",
);

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
    return {
      state: err?.code === "ENOENT" ? "NOT_RECORDED" : "UNREADABLE",
      artefact: null,
    };
  }
  let a;
  try {
    a = JSON.parse(raw);
  } catch {
    return { state: "UNREADABLE", artefact: null };
  }
  if (!a || typeof a !== "object" || Array.isArray(a)) {
    return { state: "UNREADABLE", artefact: null };
  }
  if (a.schema !== NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  // The scope is matched here as well as by the kernel: a narrow instrument
  // must not be routed to this broad question by relabelling its artefact.
  if (a.scope !== NODE0_HISTORY_REPLAY_SCOPE) {
    return { state: "SCHEMA_MISMATCH", artefact: null };
  }
  if (!verifyHistoryReplayHash(a, sha256CanonicalJsonV1)) {
    return { state: "HASH_UNVERIFIED", artefact: null };
  }
  const k = currentHistoryReplayKernelHash(kernelPath);
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

export function fullHistoryReplayableObservation(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED" || !isCleanEligibleHistoryReplay(artefact)) return null;
  return Object.freeze({
    observed: true,
    source: `NODE0-HISTORY-REPLAY-1A ${artefact.replay_verdict} ${artefact.observation_hash}`,
    scope: NODE0_HISTORY_REPLAY_SCOPE,
  });
}

/** Why the adapter fell silent. Diagnostics never settle a row. */
export function historyReplayDiagnostic(opts = {}) {
  const { demaHome, kernelPath, readFile } = { ...defaults(), ...opts };
  const { state, artefact } = classify({ demaHome, kernelPath, readFile });
  if (state !== "ACCEPTED") {
    return Object.freeze({
      invariant_id: HISTORY_REPLAY_INVARIANT_ID,
      state,
      integrity_suspect: HISTORY_REPLAY_INTEGRITY_SUSPECT_STATES.includes(state),
    });
  }
  if (!isCleanEligibleHistoryReplay(artefact)) {
    return Object.freeze({
      invariant_id: HISTORY_REPLAY_INVARIANT_ID,
      state: "NOT_CLEAN_ELIGIBLE",
      replay_verdict: artefact.replay_verdict ?? null,
      replay_reason: artefact.replay_reason ?? null,
      integrity_suspect: false,
    });
  }
  return Object.freeze({
    invariant_id: HISTORY_REPLAY_INVARIANT_ID,
    state: "ACCEPTED",
    integrity_suspect: false,
  });
}
