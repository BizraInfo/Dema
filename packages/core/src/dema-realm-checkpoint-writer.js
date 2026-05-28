// UX-2B · Dema Realm Checkpoint Writer.
//
// The WRITER side that makes UX-1C's reader come alive. Persists operator-
// supplied checkpoint to $DEMA_HOME/realm/last-checkpoint.json (overwrite,
// atomic) AND appends one event to $DEMA_HOME/realm/timeline.json
// (append-only).
//
// Posture: operator memory aid. No identity binding, no outbound intent,
// no share/mint/network. No exact-string consent required (mirrors
// `authorship demo` discipline). Mutating but honestly attested:
// boundary block declares file_write_performed:true + mutation_performed:true.

import { mkdir, writeFile, readFile, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA =
  "bizra.dema.realm_checkpoint_save_result.v0.1";

const DEFAULT_RESUME_COMMAND = "dema realm board";
const MAX_LABEL_LENGTH = 200;

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

const SAVE_BOUNDARY_OK = Object.freeze({
  file_write_performed: true,
  mutation_performed: true,
  network_used: false,
  federation_used: false,
  share_decision_made: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
  private_key_loaded: false,
  raw_artifact_included: false,
});

const SAVE_BOUNDARY_FAIL = Object.freeze({
  file_write_performed: false,
  mutation_performed: false,
  network_used: false,
  federation_used: false,
  share_decision_made: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
  private_key_loaded: false,
  raw_artifact_included: false,
});

function fail(error, details = {}) {
  return Object.freeze({
    schema: DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA,
    saved: false,
    error,
    ...details,
    boundary: SAVE_BOUNDARY_FAIL,
  });
}

async function atomicWriteJson(targetPath, body) {
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(body, null, 2), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await rename(tmpPath, targetPath);
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function isExistingTimeline(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    Array.isArray(obj.events) &&
    obj.events.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof e.at === "string" &&
        typeof e.label === "string",
    ),
  );
}

function timestampHHMM(now) {
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function saveDemaRealmCheckpoint(
  { label, stage, nextGear, resumeCommand, timelineLabel } = {},
  { demaHome, now = new Date() } = {},
) {
  if (typeof label !== "string" || label.length === 0) {
    return fail("missing_label");
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return fail("label_too_long", {
      max_length: MAX_LABEL_LENGTH,
      received_length: label.length,
    });
  }

  const home = resolveHome(demaHome);
  const realmDir = join(home, "realm");
  const checkpointPath = join(realmDir, "last-checkpoint.json");
  const timelinePath = join(realmDir, "timeline.json");

  await mkdir(realmDir, { recursive: true, mode: 0o700 });

  // 1. Write checkpoint (overwrite, atomic)
  const checkpointBody = {
    label,
    stage: stage ?? null,
    next_gear: nextGear ?? null,
    resume_command: resumeCommand || DEFAULT_RESUME_COMMAND,
    sealed_at_iso: now.toISOString(),
    truth_label: "LOCAL_CHECKPOINT_DECLARED",
  };

  try {
    // Remove existing target so writeFile with flag:'wx' can create the tmp,
    // then rename overwrites the final path atomically.
    const tmpPath = `${checkpointPath}.tmp.${process.pid}.${Date.now()}`;
    await writeFile(tmpPath, JSON.stringify(checkpointBody, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(tmpPath, checkpointPath);
  } catch (err) {
    return fail("checkpoint_write_failed", {
      message: String(err?.message ?? err),
    });
  }

  // 2. Append timeline event
  let timelineBefore = await readJsonOrNull(timelinePath);
  if (!isExistingTimeline(timelineBefore)) {
    timelineBefore = { events: [] };
  }

  const eventLabel =
    typeof timelineLabel === "string" && timelineLabel.length > 0
      ? timelineLabel
      : label;
  const newEvent = Object.freeze({
    at: timestampHHMM(now),
    label: eventLabel,
  });
  const timelineAfter = {
    events: [...timelineBefore.events, newEvent],
  };

  try {
    const tmpPath = `${timelinePath}.tmp.${process.pid}.${Date.now()}`;
    await writeFile(tmpPath, JSON.stringify(timelineAfter, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(tmpPath, timelinePath);
  } catch (err) {
    return fail("timeline_append_failed", {
      message: String(err?.message ?? err),
      checkpoint_written: true,
      checkpoint_path: checkpointPath,
    });
  }

  // 3. Verify file modes on disk
  let modeOctal = null;
  try {
    const st = await stat(checkpointPath);
    modeOctal = `0o${(st.mode & 0o777).toString(8).padStart(3, "0")}`;
  } catch {
    // non-fatal -- result still reports saved:true if writes succeeded
  }

  return Object.freeze({
    schema: DEMA_REALM_CHECKPOINT_SAVE_RESULT_SCHEMA,
    saved: true,
    truth_label: "LOCAL_CHECKPOINT_SAVED",
    checkpoint_path: checkpointPath,
    timeline_path: timelinePath,
    checkpoint: Object.freeze(checkpointBody),
    timeline_event_appended: newEvent,
    timeline_total_events: timelineAfter.events.length,
    mode_octal: modeOctal,
    boundary: SAVE_BOUNDARY_OK,
  });
}
