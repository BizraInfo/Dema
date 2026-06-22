// DEMA-BIRTH-LOOP-1A — PURE composition kernel.
//
// Detects the Node0 node-state from a CALLER-PROVIDED operator profile and
// produces a local-only "birth loop" envelope that greets and routes. It is
// preview-only: it does NOT scan the home base, invoke models, run tasks, or
// activate any runtime. The caller performs the filesystem read (e.g. via
// operator-profile.js) and passes the parsed `profile` (or a `profileError`
// string) in; this kernel itself reads nothing from disk, so it stays clean
// under scripts/review/kernel-purity-check.mjs — it imports no side-effect
// surface (filesystem, network, http(s), child-process, os) and no global
// fetch.
//
// Model: mirrors node-resource-passport-preview.js — imports only
// ./preview-boundary.js, uses a local deepFreeze(), spreads
// buildPreviewBoundary(), returns a deep-frozen envelope, and has a
// fail-closed CORRUPT path (no greeting-by-name, no scan suggestion).

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_BIRTH_LOOP_SCHEMA = "bizra.dema.birth_loop.v0.1";

const TRUTH_LABEL = "DEMA_BIRTH_LOOP_LOCAL_ONLY";
const PROFILE_SCHEMA = "bizra.dema.profile.v0.1";

const NEXT_SAFE_ACTIONS = Object.freeze({
  NEW_NODE: Object.freeze(["setup_profile", "choose_language"]),
  EXISTING_NODE: Object.freeze([
    "request_homebase_scan_consent",
    "check_local_models",
    "start_today_mission",
    "rest_handoff",
  ]),
  PARTIAL_NODE: Object.freeze([
    "repair_profile_via_setup",
    "choose_language",
  ]),
  CORRUPT_NODE: Object.freeze(["rerun_setup_to_rebuild_profile"]),
});

const PROFILE_STATUS = Object.freeze({
  NEW_NODE: "absent",
  EXISTING_NODE: "valid",
  PARTIAL_NODE: "partial",
  CORRUPT_NODE: "malformed",
});

const WHAT_THIS_PROVES = Object.freeze([
  "A caller-provided operator profile can be classified into a Node0 node-state with zero side effects.",
  "Routing to the next safe action is derived locally, in-memory, from the profile shape alone.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "The home base has been scanned.",
  "A local model has been invoked.",
  "A task has been executed.",
  "Any runtime or federation is active.",
  "A receipt has been minted.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Display-safe non-empty string, else null. Mirrors operator-profile.js's
// pickString: empty string is treated as "not set".
function pickString(obj, key) {
  const value = obj?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Resolve the operator's display name, preserving operator-profile.js:23's
// legacy `name` fallback — profiles.js still WRITES `name:`, so a valid
// returning operator can have `name` and no `preferred_name`. Without this
// fallback such a profile would misclassify as PARTIAL_NODE ("incomplete")
// instead of EXISTING_NODE, insulting the exact returning user we greet.
function pickPreferredName(profile) {
  return pickString(profile, "preferred_name") ?? pickString(profile, "name");
}

// ISO-639-1 code (or "other"), with the legacy `language` fallback, mirroring
// operator-profile.js's readOperatorLanguage.
function pickLanguageCode(profile) {
  return pickIso639_1(profile, "language_code") ?? pickIso639_1(profile, "language");
}

function pickIso639_1(obj, key) {
  const v = obj?.[key];
  if (typeof v !== "string") return null;
  if (/^[a-z]{2}$/.test(v) || v === "other") return v;
  return null;
}

function buildBoundary() {
  return deepFreeze({
    ...buildPreviewBoundary(),
    network_used: false,
    model_invoked: false,
    file_content_read: false,
    homebase_scan_performed: false,
    task_executed: false,
    runtime_activated: false,
    federation_used: false,
    token_minted: false,
    poi_score_calculated: false,
    reward_emitted: false,
  });
}

function classify({ profile, profileError }) {
  if (typeof profileError === "string" && profileError.length > 0) {
    return "CORRUPT_NODE";
  }
  if (profile === null || profile === undefined) {
    return "NEW_NODE";
  }
  if (!isPlainObject(profile) || profile.schema !== PROFILE_SCHEMA) {
    return "CORRUPT_NODE";
  }
  const preferredName = pickPreferredName(profile);
  const languageCode = pickLanguageCode(profile);
  if (preferredName === null || languageCode === null) {
    return "PARTIAL_NODE";
  }
  return "EXISTING_NODE";
}

function buildGreeting(nodeState, preferredName) {
  switch (nodeState) {
    case "EXISTING_NODE":
      return `Welcome back, ${preferredName}.`;
    case "NEW_NODE":
      return "Welcome. Let's set up your Node0 together.";
    case "PARTIAL_NODE":
      return "Welcome back. Your profile is incomplete — let's repair it.";
    case "CORRUPT_NODE":
    default:
      return "Your profile could not be read. Let's rebuild it from setup.";
  }
}

function buildLanguageStatus({ nodeState, profile }) {
  // Only read language from a structurally-trusted profile. A CORRUPT/absent
  // profile yields an unset language status (no leakage of malformed fields).
  const trustable =
    (nodeState === "EXISTING_NODE" || nodeState === "PARTIAL_NODE") &&
    isPlainObject(profile);
  const languageCode = trustable ? pickLanguageCode(profile) : null;
  const secondaryLanguageCode = trustable
    ? pickIso639_1(profile, "secondary_language_code")
    : null;
  return {
    language_code: languageCode,
    secondary_language_code: secondaryLanguageCode,
    status: languageCode === null ? "unset" : "set",
  };
}

export function buildDemaBirthLoop({ profile = null, profileError = null } = {}) {
  const nodeState = classify({ profile, profileError });

  // Only EXISTING_NODE may greet by name; every other state stays name-free.
  const preferredName =
    nodeState === "EXISTING_NODE" && isPlainObject(profile)
      ? pickPreferredName(profile)
      : null;

  return deepFreeze({
    schema: DEMA_BIRTH_LOOP_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    valid: true,
    node_state: nodeState,
    profile_status: PROFILE_STATUS[nodeState],
    greeting: buildGreeting(nodeState, preferredName),
    language_status: buildLanguageStatus({ nodeState, profile }),
    next_safe_actions: NEXT_SAFE_ACTIONS[nodeState],
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
