// UX-2A · Dema Realm Live Status (read-only heartbeat).
//
// Turns the Realm from beautiful-static-world into system-aware local cockpit.
// Aggregates live counters from disk and emits a single schema-tagged
// envelope that future Realm surfaces (Council card augmentation, Mission
// Board live derivation, Checkpoint Journal counters) can consume.
//
// Read-only. NO mutation, NO network, NO model call, NO key load.
//
// Sources scanned:
//   $DEMA_HOME/keys/active-key.json (via loader) → identity status
//   $DEMA_HOME/receipts/authorship-*.json      → authorship_receipts_count
//   $DEMA_HOME/urp/indexes/urp-index-*.json    → urp_indexes_count
//   $DEMA_HOME/realm/last-checkpoint.json      → checkpoint state
//   $DEMA_HOME/realm/timeline.json             → timeline state
//
// Truth label: LOCAL_REALM_LIVE_STATUS

import { readdir, readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ANSI } from "./theme.js";
import { inspectActiveIdentity } from "../../receipts/src/authorship-key-store.js";

export const DEMA_REALM_LIVE_STATUS_SCHEMA =
  "bizra.dema.realm_live_status.v0.1";

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function countMatching(dirPath, pattern) {
  try {
    const entries = await readdir(dirPath);
    return entries.filter((f) => pattern.test(f)).length;
  } catch {
    return 0;
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

export async function gatherDemaRealmStatus({
  demaHome,
  now = new Date(),
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");

  const receiptsDir = join(home, "receipts");
  const urpIndexesDir = join(home, "urp", "indexes");
  const checkpointPath = join(home, "realm", "last-checkpoint.json");
  const timelinePath = join(home, "realm", "timeline.json");

  // Finding #3: VERIFIED requires loadActiveKeyPair() success, not presence.
  // Finding #4: PRESENT_UNVERIFIED (legacy home) stays distinct from
  // UNINITIALIZED and carries a migrate recommendation, not an init one.
  const identity = await inspectActiveIdentity(home);
  const identityPresent = identity.state === "VERIFIED";
  const identityStatus =
    identity.state === "VERIFIED"
      ? "VERIFIED"
      : identity.state === "ABSENT"
        ? "UNINITIALIZED"
        : identity.state; // PRESENT_UNVERIFIED / BLOCKED_*
  const identityRecommendedAction = identity.recommended_action ?? "NONE";

  const authorshipReceiptsCount = await countMatching(
    receiptsDir,
    /^authorship-[a-f0-9]{64}\.json$/,
  );

  const urpIndexesCount = await countMatching(
    urpIndexesDir,
    /^urp-index-[a-f0-9]{64}\.json$/,
  );

  const rawCheckpoint = await readJsonOrNull(checkpointPath);
  const checkpointPresent = isCheckpointShape(rawCheckpoint);
  const lastCheckpointLabel = checkpointPresent ? rawCheckpoint.label : null;

  const rawTimeline = await readJsonOrNull(timelinePath);
  const timelinePresent = isTimelineShape(rawTimeline);
  const timelineEventsCount = timelinePresent ? rawTimeline.events.length : 0;
  const mostRecentTimelineEvent =
    timelinePresent && timelineEventsCount > 0
      ? Object.freeze({
          at: rawTimeline.events[timelineEventsCount - 1].at,
          label: rawTimeline.events[timelineEventsCount - 1].label,
        })
      : null;

  const awakenedLine = identityPresent
    ? "The sovereign seed is awake."
    : "The sovereign seed awaits initialization.";

  return Object.freeze({
    schema: DEMA_REALM_LIVE_STATUS_SCHEMA,
    truth_label: "LOCAL_REALM_LIVE_STATUS",
    rendered_at_iso: now.toISOString(),
    dema_home: home,
    identity_status: identityStatus,
    identity_recommended_action: identityRecommendedAction,
    awakened_line: awakenedLine,
    authorship_receipts_count: authorshipReceiptsCount,
    urp_indexes_count: urpIndexesCount,
    checkpoint_present: checkpointPresent,
    last_checkpoint_label: lastCheckpointLabel,
    timeline_events_count: timelineEventsCount,
    most_recent_timeline_event: mostRecentTimelineEvent,
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

function statusValueColor(value) {
  if (value === "VERIFIED") return ANSI.proofVerified;
  if (value === "UNINITIALIZED") return ANSI.neutral;
  return ANSI.neutral;
}

function countColor(n) {
  return n > 0 ? ANSI.proofVerified : ANSI.neutral;
}

export function renderDemaRealmStatus(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · LIVE STATUS", ANSI.gold + ANSI.bold, useColor),
    color(
      `truth: ${state.truth_label}  ·  rendered: ${state.rendered_at_iso}`,
      ANSI.dim + ANSI.neutral,
      useColor,
    ),
    "",
    color("Identity:", ANSI.gold, useColor),
    `  ${color(state.identity_status, statusValueColor(state.identity_status), useColor)}  ·  ${color(state.awakened_line, state.identity_status === "VERIFIED" ? ANSI.proofVerified : ANSI.gold, useColor)}`,
    "",
    color("Receipts:", ANSI.gold, useColor),
    `  ${color("authorship", ANSI.neutral, useColor)}  ${color(String(state.authorship_receipts_count), countColor(state.authorship_receipts_count) + ANSI.bold, useColor)}`,
    `  ${color("URP indexes", ANSI.neutral, useColor)} ${color(String(state.urp_indexes_count), countColor(state.urp_indexes_count) + ANSI.bold, useColor)}`,
    "",
    color("Checkpoint:", ANSI.gold, useColor),
  ];
  if (state.checkpoint_present) {
    lines.push(
      `  ${color("present", ANSI.proofVerified, useColor)}  ·  ${color(state.last_checkpoint_label, ANSI.proofVerified, useColor)}`,
    );
  } else {
    lines.push(
      `  ${color("—", ANSI.neutral, useColor)}  ${color("(no checkpoint yet · use `dema realm checkpoint save`)", ANSI.dim + ANSI.neutral, useColor)}`,
    );
  }
  lines.push("", color("Timeline:", ANSI.gold, useColor));
  if (state.timeline_events_count > 0 && state.most_recent_timeline_event) {
    lines.push(
      `  ${color(String(state.timeline_events_count) + " events", countColor(state.timeline_events_count) + ANSI.bold, useColor)}  ·  ${color("latest:", ANSI.neutral, useColor)} ${color(state.most_recent_timeline_event.at, ANSI.dim + ANSI.neutral, useColor)} · ${state.most_recent_timeline_event.label}`,
    );
  } else {
    lines.push(
      `  ${color("0 events", ANSI.neutral, useColor)}  ${color("(no persisted timeline yet)", ANSI.dim + ANSI.neutral, useColor)}`,
    );
  }
  lines.push("");
  lines.push(
    color(
      "Boundary: file_write=false · network=false · federation=false · mutation=false (10 flags · all-false read-only)",
      ANSI.dim + ANSI.neutral,
      useColor,
    ),
  );
  return lines.join("\n");
}
