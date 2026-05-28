// UX-1C · Dema Realm Checkpoint Journal (read-only v0).
//
// Answers the operator's third question after UX-1A ("Where am I?") and
// UX-1B ("What quests exist?"):
//
//   "Where did I stop, and what do I resume?"
//
// That is the MMORPG continuity layer Mumu asked for -- the feeling that
// the world remembers you between sessions.
//
// Read-only. Reads `$DEMA_HOME/realm/last-checkpoint.json` if present.
// Optional `$DEMA_HOME/realm/timeline.json` is read for the timeline section;
// absent is honest CHECKPOINT_ABSENT or "no persisted timeline yet"
// (UX-2B will wire the writer). NO mutation, NO network, NO file write.
//
// Truth labels:
//   LOCAL_CHECKPOINT_DECLARED  when last-checkpoint.json exists
//   CHECKPOINT_ABSENT          when missing

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const DEMA_REALM_CHECKPOINT_JOURNAL_SCHEMA =
  "bizra.dema.realm_checkpoint_journal.v0.1";

const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gold: "\x1b[38;2;212;175;55m",
  emerald: "\x1b[38;2;16;185;129m",
  crimson: "\x1b[38;2;239;68;68m",
  ash: "\x1b[38;2;156;163;175m",
});

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function isCheckpointShape(obj) {
  return Boolean(
    obj &&
    typeof obj === "object" &&
    typeof obj.label === "string" &&
    obj.label.length > 0,
  );
}

function isTimelineShape(obj) {
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

export async function gatherDemaRealmCheckpoint({
  demaHome,
  now = new Date(),
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const checkpointPath = join(home, "realm", "last-checkpoint.json");
  const timelinePath = join(home, "realm", "timeline.json");

  const rawCheckpoint = await readJsonOrNull(checkpointPath);
  const rawTimeline = await readJsonOrNull(timelinePath);

  const checkpointPresent = isCheckpointShape(rawCheckpoint);
  const truthLabel = checkpointPresent
    ? "LOCAL_CHECKPOINT_DECLARED"
    : "CHECKPOINT_ABSENT";

  const checkpoint = checkpointPresent
    ? Object.freeze({
        label: rawCheckpoint.label,
        stage: rawCheckpoint.stage ?? null,
        resume_command: rawCheckpoint.resume_command || "dema realm board",
        next_gear: rawCheckpoint.next_gear || rawCheckpoint.next_quest || null,
        sealed_at_iso: rawCheckpoint.sealed_at_iso ?? null,
        raw_truth_label: rawCheckpoint.truth_label ?? null,
      })
    : null;

  const timelinePresent = isTimelineShape(rawTimeline);
  const timeline = timelinePresent
    ? Object.freeze(
        rawTimeline.events.map((e) =>
          Object.freeze({ at: e.at, label: e.label }),
        ),
      )
    : Object.freeze([]);

  return Object.freeze({
    schema: DEMA_REALM_CHECKPOINT_JOURNAL_SCHEMA,
    truth_label: truthLabel,
    rendered_at_iso: now.toISOString(),
    dema_home: home,
    checkpoint_path: checkpointPath,
    timeline_path: timelinePath,
    checkpoint_present: checkpointPresent,
    checkpoint,
    timeline_present: timelinePresent,
    timeline,
    boundary: Object.freeze({
      file_write_performed: false,
      network_used: false,
      federation_used: false,
      share_decision_made: false,
      poi_score_calculated: false,
      token_minted: false,
      economic_claim_made: false,
      private_key_loaded: false,
      raw_artifact_included: false,
      mutation_performed: false,
    }),
  });
}

export function renderDemaRealmCheckpoint(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · CHECKPOINT JOURNAL", ANSI.gold + ANSI.bold, useColor),
    "",
  ];

  if (state.checkpoint_present && state.checkpoint) {
    const cp = state.checkpoint;
    lines.push(color("Last Checkpoint:", ANSI.gold, useColor));
    lines.push(
      `  ${color("Label:", ANSI.ash, useColor)}  ${color(cp.label, ANSI.emerald, useColor)}`,
    );
    lines.push(
      `  ${color("Stage:", ANSI.ash, useColor)}  ${cp.stage ?? color("—", ANSI.ash, useColor)}`,
    );
    lines.push(
      `  ${color("Truth:", ANSI.ash, useColor)}  ${color(state.truth_label, ANSI.emerald, useColor)}`,
    );
    lines.push(
      `  ${color("Resume:", ANSI.ash, useColor)} ${color(cp.resume_command, ANSI.gold, useColor)}`,
    );
    lines.push(
      `  ${color("Next:", ANSI.ash, useColor)}   ${cp.next_gear ? color(cp.next_gear, ANSI.gold, useColor) : color("—", ANSI.ash, useColor)}`,
    );
    if (cp.sealed_at_iso) {
      lines.push(
        `  ${color("Sealed:", ANSI.ash, useColor)} ${color(cp.sealed_at_iso, ANSI.dim + ANSI.ash, useColor)}`,
      );
    }
  } else {
    lines.push(color("No checkpoint found.", ANSI.gold, useColor));
    lines.push(
      color(
        "Dema Realm can still boot, but continuity has not been initialized.",
        ANSI.dim + ANSI.ash,
        useColor,
      ),
    );
    lines.push(
      `  ${color("Truth:", ANSI.ash, useColor)}  ${color(state.truth_label, ANSI.gold, useColor)}`,
    );
    lines.push(
      `  ${color("Path:", ANSI.ash, useColor)}   ${color(state.checkpoint_path, ANSI.dim + ANSI.ash, useColor)}`,
    );
  }

  lines.push("");
  lines.push(color("Timeline:", ANSI.gold, useColor));
  if (state.timeline_present && state.timeline.length > 0) {
    for (const e of state.timeline) {
      lines.push(
        `  ${color(e.at, ANSI.dim + ANSI.ash, useColor)} · ${e.label}`,
      );
    }
  } else {
    lines.push(
      color(
        "  — no persisted timeline yet (UX-2B will wire it)",
        ANSI.dim + ANSI.ash,
        useColor,
      ),
    );
  }

  lines.push("");
  return lines.join("\n");
}
