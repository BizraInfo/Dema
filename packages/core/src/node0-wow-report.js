// NODE0-WOW-REPORT-1A — PURE "wow mirror" kernel.
//
// Turns the EXISTING (already-consented) local-asset inventory into an honest
// human story. The "wow" is the TRUE shape of the operator's assets — not a
// promise. The §0 / no-zann discipline applied to delight: `can_help_today`
// lists ONLY capabilities that are actually live today; everything aspirational
// is named honestly in `not_yet_available` (DESIGNED-NOT-LIVE). A wow report
// that overclaims would be the exact riba/zann the constitution forbids.
//
// Pure + read-only: it takes the inventory object as input (the CLI reads the
// artifact written by `dema scan`), performs no scan, reads no file content,
// invokes no model. Imports only ./preview-boundary.js.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_WOW_REPORT_SCHEMA = "bizra.dema.node0_wow_report.v0.1";

const TRUTH_LABEL = "NODE0_WOW_REPORT_LOCAL_ONLY";

// Honest, file-level labels. The scanner classifies by file TYPE only
// (extension/name — classifyLocalAsset never opens a file), so these count
// FILES of each type, NOT composed entities: a lone `.js` is a "code file", not
// a "project"; a `.csv` is a "data file", not a "dataset". Asserting
// project-hood / dataset-hood from a metadata heuristic would be zann.
const CATEGORY_LABELS = Object.freeze({
  code_project: "code files",
  document: "documents",
  receipt_or_proof: "proof & receipt files",
  model_artifact: "model files",
  dataset: "data files",
  media: "media files",
  archive: "archives",
  unknown: "uncategorized files",
});

// Honest, currently-live capabilities only. Each is something Dema can do TODAY
// at the preview/local layer — verifiable against shipped commands.
const CAN_HELP_TODAY = Object.freeze([
  "Map the shape of your homebase locally — re-run `dema scan` whenever it changes.",
  "Remember you and greet you in your language (`dema start`).",
  "Keep everything local — nothing here leaves your machine.",
]);

// Honest disclosure of what is NOT live yet (DESIGNED-NOT-LIVE). Naming these is
// what keeps the wonder from becoming an overclaim.
const NOT_YET_AVAILABLE = Object.freeze([
  "Reading or analyzing the CONTENTS of your files (today is metadata only).",
  "Running a local model over your assets (designed, not live).",
  "Building, refactoring, or running tasks for you (designed, not live — the bounded task runner is a later slice).",
  "Semantic search or embeddings across your assets (not live).",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "The local asset inventory can be rendered as an honest, human-readable map of the homebase, fully offline.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "Any file content was read or understood (the report sees categories + counts, not contents).",
  "A model, semantic index, or embedding analyzed the assets.",
  "Dema can perform any capability listed under not_yet_available.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Structural + lenient validation of a local-asset inventory. We do NOT hard-
// match the exact schema string (verified on disk as
// "bizra.dema.local_asset_awareness_inventory.v0.1") so a version bump cannot
// silently break the mirror — the shape (categories + summary) is what we read.
function looksLikeInventory(v) {
  return (
    isObject(v) &&
    typeof v.schema === "string" &&
    v.schema.includes("local_asset") &&
    v.schema.includes("inventory") &&
    isObject(v.categories) &&
    isObject(v.summary)
  );
}

// Read-only: the report never scans, never reads content, never runs anything.
function buildBoundary() {
  return deepFreeze({
    ...buildPreviewBoundary(),
    homebase_scan_performed: false,
    file_content_read: false,
    model_invoked: false,
    embedding_generated: false,
    network_used: false,
    task_executed: false,
    runtime_activated: false,
    federation_used: false,
    token_minted: false,
    poi_score_calculated: false,
    reward_emitted: false,
  });
}

function safeCount(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

export function buildNode0WowReport({ inventory = null } = {}) {
  const ok = looksLikeInventory(inventory);

  if (!ok) {
    return deepFreeze({
      schema: NODE0_WOW_REPORT_SCHEMA,
      truth_label: TRUTH_LABEL,
      mode: "preview_only",
      valid: false,
      status: "REFUSED_NO_INVENTORY",
      hint: [
        "I have not looked at your homebase yet.",
        'Run `dema scan --consent "GO: scan homebase metadata only"` first, then ask me again.',
      ],
      boundary: buildBoundary(),
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  const category_story = Object.entries(inventory.categories)
    .map(([category, count]) => ({
      category,
      count: safeCount(count),
      label: CATEGORY_LABELS[category] ?? category,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return deepFreeze({
    schema: NODE0_WOW_REPORT_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    valid: true,
    totals: {
      records: safeCount(inventory.summary.records_count),
      files: safeCount(inventory.summary.files_count),
      dirs: safeCount(inventory.summary.dirs_count),
    },
    category_story,
    can_help_today: CAN_HELP_TODAY,
    not_yet_available: NOT_YET_AVAILABLE,
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
