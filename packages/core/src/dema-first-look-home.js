// DEMA-QUALITY-DELIVERY-SPINE-1A · human-first default home (companion, not debug dump).
//
// NO file write. NO network. NO runtime. Pure read-and-render.

import { readFile, access, constants as fsConstants } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { hasAuthorshipKey } from "../../receipts/src/authorship-key-store.js";
import { listSeasons, loadSeasonHead } from "../../receipts/src/season-state-store.js";
import { gatherDemaRealmCheckpoint } from "./dema-realm-checkpoint.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { GREETING_TEMPLATES } from "./homebase-language-picker.js";
import {
  DEFAULT_RENDER_EFFECT_BOUNDARY,
  TRUTH_LABELS,
} from "./delivery-readiness-score.js";

export const FIRST_LOOK_HOME_SCHEMA = "bizra.dema.first_look_home.v1";

const PKG_VERSION = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "..", "..", "..", "package.json"), "utf8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const SIMPLE_ACTIONS = Object.freeze([
  Object.freeze({
    label: "Check health",
    command: "dema doctor",
    hint: "Diagnostics and readiness details",
  }),
  Object.freeze({
    label: "Draft a mission",
    command: "dema mission draft",
    hint: "Start a consent-gated mission draft",
  }),
  Object.freeze({
    label: "View receipts",
    command: "dema receipts",
    hint: "Read local proof receipts",
  }),
]);

async function fileReadable(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readProfile(home) {
  const candidates = [
    join(home, "profile.json"),
    join(home, "memory", "profile.json"),
  ];
  for (const path of candidates) {
    if (!(await fileReadable(path))) continue;
    try {
      const data = JSON.parse(await readFile(path, "utf8"));
      const name =
        (typeof data.preferred_name === "string" && data.preferred_name) ||
        (typeof data.name === "string" && data.name) ||
        null;
      const language_code =
        typeof data.language_code === "string" ? data.language_code : null;
      return { name, language_code, source_present: true };
    } catch {
      return { name: null, language_code: null, source_present: false };
    }
  }
  return { name: null, language_code: null, source_present: false };
}

function buildGreeting(profile) {
  const langCode = profile.language_code;
  const tmpl =
    langCode && GREETING_TEMPLATES[langCode]
      ? GREETING_TEMPLATES[langCode]
      : GREETING_TEMPLATES.en;
  if (!profile.source_present || !profile.name) {
    return Object.freeze({
      text: tmpl.welcome_new,
      has_name: false,
      language_code: langCode,
    });
  }
  return Object.freeze({
    text: tmpl.welcome_back.replace("{name}", profile.name),
    has_name: true,
    language_code: langCode,
  });
}

function buildRecommendedNextStep(profile, keyPresent, mission, checkpoint, continuation) {
  if (!profile.source_present) {
    return "Complete first setup with dema setup — your local companion stays preview-only until you choose.";
  }
  if (!keyPresent) {
    return "Initialize your authorship key with dema authorship init when you are ready to sign local work.";
  }
  if (continuation?.status === "CONTRADICTION") {
    const reasons = continuation.contradictions
      .map((entry) => entry.reason)
      .filter(Boolean)
      .join(", ");
    return "Resolve the continuation contradiction" + (reasons ? ": " + reasons : "") + ".";
  }
  if (continuation?.status === "BLOCKED") {
    return "Canonical continuation is blocked: " + continuation.reason + ".";
  }
  if (continuation?.status === "VERIFIED" && continuation.next_safe_action) {
    return "Continue the canonical mission: " + continuation.next_safe_action;
  }
  // A live mission outranks the generic suggestion. Without this the home
  // screen greets you and recommends reading receipts while a real mission is
  // open, which forces the human to be the pointer — the exact work the node
  // exists to carry.
  if (mission?.next_safe_action) {
    return `Continue the open mission: ${mission.next_safe_action}`;
  }
  if (checkpoint?.checkpoint?.resume_command) {
    return `Resume from your last checkpoint: ${checkpoint.checkpoint.resume_command}`;
  }
  return "Review your latest receipts with dema receipts — proof stays local until you explicitly share.";
}

/// The pointer is DESCRIPTIVE state, never authority. It is surfaced with its
/// own age so a stale pointer is visibly stale rather than silently obeyed, and
/// it can never widen what Dema is permitted to do.
function buildMissionView(mission, now) {
  if (!mission) {
    return Object.freeze({
      present: false,
      note: "No mission pointer found. Dema shows only local state.",
    });
  }
  const updatedAt = mission.updated_at_utc ?? null;
  const parsed = updatedAt ? Date.parse(updatedAt) : Number.NaN;
  const ageHours = Number.isFinite(parsed)
    ? Math.max(0, (now.getTime() - parsed) / 3_600_000)
    : null;
  return Object.freeze({
    present: true,
    status: mission.status ?? null,
    next_safe_action: mission.next_safe_action ?? null,
    updated_at_utc: updatedAt,
    age_hours: ageHours === null ? null : Number(ageHours.toFixed(1)),
    authority: "descriptive_only",
    note: "Pointer describes state; it does not grant authority. Disk wins.",
  });
}

function buildCheckpointView(checkpoint) {
  if (!checkpoint?.checkpoint_present || !checkpoint.checkpoint) {
    return Object.freeze({
      present: false,
      truth_label: checkpoint?.truth_label ?? "CHECKPOINT_ABSENT",
      authority: "descriptive_only",
    });
  }
  const cp = checkpoint.checkpoint;
  return Object.freeze({
    present: true,
    label: cp.label,
    stage: cp.stage,
    next_gear: cp.next_gear,
    resume_command: cp.resume_command,
    sealed_at_iso: cp.sealed_at_iso,
    truth_label: checkpoint.truth_label,
    authority: "descriptive_only",
  });
}

/// Read-only, fail-soft. An unreadable or malformed pointer must never break
/// the home screen: absence degrades to the generic next step, it does not
/// throw and it does not invent a mission.
async function readMissionPointer(explicitPath, home) {
  const localPath = join(home, "active-mission.json");
  const candidates = explicitPath
    ? [explicitPath]
    : [process.env.BIZRA_ACTIVE_MISSION, "/data/bizra/ACTIVE_MISSION.json"];
  if (!explicitPath) {
    try {
      const raw = await readFile(localPath, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      // A present but malformed home-local projection is a visible absence;
      // do not hide it by falling through to an ambient pointer.
      if (error?.code !== "ENOENT") return null;
    }
  }
  for (const path of candidates.filter(Boolean)) {
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      // Try the next descriptive projection only when no explicit path was
      // supplied. A malformed explicit fixture must remain malformed.
      if (explicitPath) return null;
    }
  }
  return null;
}

function compareProjection({ mission, checkpoint, savedAt, missionId, nextSafeAction }) {
  const savedMs = Date.parse(savedAt ?? "");
  const compare = (kind, present, projectionMissionId, projectionNext, updatedAt) => {
    if (!present) return Object.freeze({
      status: "ABSENT",
      stale: false,
      reason: null,
      contradictions: Object.freeze([]),
    });
    const contradictions = [];
    const ownerBound =
      missionId !== undefined &&
      missionId !== null &&
      nextSafeAction !== undefined &&
      nextSafeAction !== null;
    if (!ownerBound) {
      return Object.freeze({
        status: "PRESENT_UNBOUND",
        stale: false,
        reason: "projection_without_canonical_owner",
        contradictions: Object.freeze([]),
      });
    }
    if (
      projectionMissionId !== undefined &&
      projectionMissionId !== null &&
      projectionMissionId !== missionId
    ) {
      contradictions.push({
        kind,
        reason: "mission_id_mismatch",
        expected: missionId,
        observed: projectionMissionId,
      });
    }
    if (
      projectionNext !== undefined &&
      projectionNext !== null &&
      projectionNext !== nextSafeAction
    ) {
      contradictions.push({
        kind,
        reason: "next_safe_action_mismatch",
        expected: nextSafeAction,
        observed: projectionNext,
      });
    }
    const observedMs = Date.parse(updatedAt ?? "");
    const stale =
      Number.isFinite(savedMs) &&
      Number.isFinite(observedMs) &&
      observedMs < savedMs;
    return Object.freeze({
      status: contradictions.length
        ? "CONTRADICTION"
        : stale
          ? "STALE"
          : "MATCHING",
      stale,
      reason:
        contradictions[0]?.reason ??
        (stale ? "projection_older_than_canonical" : null),
      contradictions: Object.freeze(contradictions),
    });
  };

  return Object.freeze({
    mission_pointer: compare(
      "mission_pointer",
      Boolean(mission),
      mission?.mission_id,
      mission?.next_safe_action,
      mission?.updated_at_utc,
    ),
    realm_checkpoint: compare(
      "realm_checkpoint",
      Boolean(checkpoint?.checkpoint_present && checkpoint.checkpoint),
      undefined,
      checkpoint?.checkpoint?.next_gear,
      checkpoint?.checkpoint?.sealed_at_iso,
    ),
  });
}

/**
 * Resolve continuation from the existing durable Season owner. The mission
 * pointer and Realm checkpoint remain projections: they can match, be absent,
 * or contradict the owner, but they never win and are never repaired here.
 */
export async function resolveCanonicalContinuation({
  demaHome,
  mission = null,
  checkpoint = null,
} = {}) {
  const listed = await listSeasons({ demaHome });
  const owner = "season-state-store/HEAD.json";
  if (!listed.ok) {
    return Object.freeze({
      status: "BLOCKED",
      present: false,
      owner,
      reason: "season_listing_failed",
      projections: compareProjection({ mission, checkpoint }),
      contradictions: Object.freeze([]),
      authority_delta: 0,
    });
  }
  if (listed.season_ids.length > 1) {
    return Object.freeze({
      status: "CONTRADICTION",
      present: false,
      owner,
      reason: "season_ambiguous",
      season_ids: listed.season_ids,
      contradictions: Object.freeze([
        { kind: "owner", reason: "season_ambiguous", observed: listed.season_ids },
      ]),
      projections: compareProjection({ mission, checkpoint }),
      authority_delta: 0,
    });
  }
  if (listed.season_ids.length === 0) {
    return Object.freeze({
      status: "ABSENT",
      present: false,
      owner,
      reason: "canonical_continuation_absent",
      projection_only: Boolean(mission || checkpoint?.checkpoint_present),
      projections: compareProjection({ mission, checkpoint }),
      contradictions: Object.freeze([]),
      authority_delta: 0,
    });
  }

  const seasonId = listed.season_ids[0];
  const loaded = await loadSeasonHead({ demaHome, seasonId });
  if (!loaded.ok) {
    return Object.freeze({
      status: "BLOCKED",
      present: false,
      owner,
      season_id: seasonId,
      reason: loaded.reason,
      projections: compareProjection({ mission, checkpoint }),
      contradictions: Object.freeze([]),
      authority_delta: 0,
    });
  }
  if (loaded.outcome === "EMPTY") {
    return Object.freeze({
      status: "ABSENT",
      present: false,
      owner,
      season_id: seasonId,
      reason: "canonical_continuation_absent",
      projection_only: Boolean(mission || checkpoint?.checkpoint_present),
      projections: compareProjection({ mission, checkpoint }),
      contradictions: Object.freeze([]),
      authority_delta: 0,
    });
  }

  const state = loaded.state;
  const projections = compareProjection({
    mission,
    checkpoint,
    savedAt: loaded.receipt.saved_at,
    missionId: state.mission_id,
    nextSafeAction: state.next_safe_action,
  });
  const contradictions = Object.freeze([
    ...(projections.mission_pointer.contradictions ?? []),
    ...(projections.realm_checkpoint.contradictions ?? []),
  ]);
  const status = contradictions.length > 0 ? "CONTRADICTION" : "VERIFIED";
  return Object.freeze({
    status,
    present: status === "VERIFIED",
    owner,
    truth_label:
      status === "VERIFIED"
        ? "SEASON_HEAD_VERIFIED"
        : "CONTINUATION_CONTRADICTION",
    season_id: state.season_id,
    mission_id: state.mission_id,
    mission_phase: state.mission_phase,
    next_safe_action: state.next_safe_action,
    state_sequence: state.state_sequence,
    state_hash: state.state_hash,
    receipt_hash: loaded.receipt.receipt_hash,
    receipt_verified: true,
    pending_consent_count: state.pending_consent.length,
    consent_granted: false,
    authority_delta: 0,
    projections,
    contradictions,
  });
}

export async function gatherFirstLookContext({
  demaHome,
  now = new Date(),
  missionPointerPath,
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const profile = await readProfile(home);
  const keyPresent = await hasAuthorshipKey(home);
  const mission = await readMissionPointer(missionPointerPath, home);
  const checkpoint = await gatherDemaRealmCheckpoint({ demaHome: home, now });
  const continuation = await resolveCanonicalContinuation({
    demaHome: home,
    mission,
    checkpoint,
  });
  return Object.freeze({
    dema_home: home,
    profile,
    key_present: keyPresent,
    mission,
    checkpoint,
    continuation,
    now,
  });
}

/// COMPOSITION, not new capability. The bases and the council already existed
/// as their own kernels and neither reached the screen the operator actually
/// types. Surfacing them here is the difference between a node that HAS
/// awareness and a node that SHOWS it. Both are injected, so this stays pure
/// and the home screen degrades to its old shape when either is absent.
function buildNodeView(constellation, council) {
  const bases = constellation?.bases ?? null;
  return Object.freeze({
    bases_known: bases ? bases.length : null,
    dark_capacity_gb: constellation?.dark_capacity_gb ?? null,
    attached_not_enrolled: constellation?.attached_not_enrolled ?? null,
    council_seats: council?.convened ? council.seat_count : null,
    // Carried verbatim from the council rather than recomputed, so the home
    // screen can never present convening as thinking.
    council_reasoning_performed: council?.convened
      ? council.reasoning_performed
      : null,
  });
}

export function buildFirstLookHome(ctx) {
  const greeting = buildGreeting(ctx.profile);
  const mission = buildMissionView(ctx.mission ?? null, ctx.now);
  const checkpoint = buildCheckpointView(ctx.checkpoint ?? null);
  const continuation = ctx.continuation ?? Object.freeze({
    status: "NOT_OBSERVED",
    present: false,
    owner: "season-state-store/HEAD.json",
    reason: "not_supplied",
    authority_delta: 0,
  });
  const node = buildNodeView(ctx.constellation ?? null, ctx.council ?? null);
  const recommended_next_step = buildRecommendedNextStep(
    ctx.profile,
    ctx.key_present,
    ctx.mission ?? null,
    ctx.checkpoint ?? null,
    continuation,
  );
  const boundary = Object.freeze({
    mode: "preview_only",
    runtime_execution_performed: false,
    network_used: false,
    ...DEFAULT_RENDER_EFFECT_BOUNDARY,
  });
  const proof_boundary = Object.freeze({
    truth_label: TRUTH_LABELS[2], // TESTED_LOCAL when gates pass in CI
    what_this_proves:
      "The default Dema face renders a human-first companion home without internal debug jargon.",
    what_this_does_not_prove:
      "Does not prove Node0 runtime readiness, gateway connectivity, federation, or signed economic claims.",
  });
  const envelope = Object.freeze({
    schema: FIRST_LOOK_HOME_SCHEMA,
    truth_label: "IMPLEMENTED_LOCAL",
    mode: "preview_only",
    rendered_at: ctx.now.toISOString(),
    dema_version: PKG_VERSION,
    greeting,
    recommended_next_step,
    mission,
    checkpoint,
    continuation,
    node,
    simple_actions: SIMPLE_ACTIONS,
    preview_boundary:
      "Preview-only · no runtime execution from this screen. Governed work stays behind explicit consent.",
    operator_paths: Object.freeze({
      diagnostics: "dema doctor",
      internal_debug: "dema realm --debug",
      technical_homebase: "dema homebase",
    }),
    boundary,
    proof_boundary,
    effect_boundary: DEFAULT_RENDER_EFFECT_BOUNDARY,
  });
  const rendered_text = renderFirstLookHome(envelope, { noColor: true });
  return Object.freeze({ ...envelope, rendered_text });
}

export function renderFirstLookHome(envelope, { noColor = false, useColor } = {}) {
  const colorOn = useColor !== undefined ? useColor : !noColor;
  const bold = (s) => (colorOn ? `\x1b[1m${s}\x1b[0m` : s);
  const dim = (s) => (colorOn ? `\x1b[2m${s}\x1b[0m` : s);

  const continuityLines =
    envelope.continuation?.status === "VERIFIED"
      ? [
          bold("Journey continuity"),
          "  " +
            envelope.continuation.mission_id +
            " · sequence " +
            envelope.continuation.state_sequence,
          dim("  canonical Season state · receipt verified"),
          "",
        ]
      : envelope.continuation?.status === "CONTRADICTION"
        ? [
            bold("Journey continuity"),
            "  CONTRADICTION · " +
              (envelope.continuation.contradictions
                ?.map((entry) => entry.reason)
                .filter(Boolean)
                .join(", ") || envelope.continuation.reason),
            dim("  recovery is read-only; no state was rewritten"),
            "",
          ]
        : envelope.continuation?.status === "BLOCKED"
          ? [
              bold("Journey continuity"),
              "  BLOCKED · " + envelope.continuation.reason,
              dim("  recovery is read-only; no state was rewritten"),
              "",
            ]
          : [];

  const lines = [
    bold("Dema"),
    dim(`companion · v${envelope.dema_version}`),
    "",
    envelope.greeting.text,
    "",
    ...continuityLines,
    "",
    bold("Recommended next step"),
    `  ${envelope.recommended_next_step}`,
    "",
    ...(envelope.mission?.present
      ? [
          bold("Open mission"),
          `  ${envelope.mission.status ?? "(no status)"}`,
          dim(
            `  observed ${envelope.mission.age_hours ?? "?"}h ago · descriptive only, not authority`,
          ),
          "",
        ]
      : []),
    ...(envelope.checkpoint?.present
      ? [
          bold("Last checkpoint"),
          `  ${envelope.checkpoint.label}` +
            (envelope.checkpoint.stage
              ? ` · ${envelope.checkpoint.stage}`
              : ""),
          dim(
            `  resume: ${envelope.checkpoint.resume_command} · descriptive only, not authority`,
          ),
          "",
        ]
      : []),
    ...(envelope.node?.bases_known || envelope.node?.council_seats
      ? [
          bold("Your node"),
          ...(envelope.node.bases_known
            ? [
                `  ${envelope.node.bases_known} base(s)` +
                  (envelope.node.dark_capacity_gb
                    ? ` · ${envelope.node.dark_capacity_gb} GB unreachable`
                    : "") +
                  (envelope.node.attached_not_enrolled
                    ? ` · ${envelope.node.attached_not_enrolled} attached, not enrolled`
                    : ""),
              ]
            : []),
          ...(envelope.node.council_seats
            ? [
                `  ${envelope.node.council_seats} council seats` +
                  (envelope.node.council_reasoning_performed === false
                    ? dim(" · convened, not yet reasoning")
                    : ""),
              ]
            : []),
          "",
        ]
      : []),
    bold("Three simple actions"),
    ...envelope.simple_actions.map(
      (a, i) => `  ${i + 1}. ${a.label} — ${dim(a.command)}`,
    ),
    "",
    dim(envelope.preview_boundary),
    "",
    dim(`Diagnostics: ${envelope.operator_paths.diagnostics}`),
    dim(`Internal detail: ${envelope.operator_paths.internal_debug}`),
  ];
  return lines.join("\n");
}
