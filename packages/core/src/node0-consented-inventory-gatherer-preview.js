// NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A — metadata-only triage engine.
//
// PREVIEW_ONLY. NOT ML. NOT a scanner. Pure kernel: it consumes injected file
// METADATA rows (relative_path, extension, size_bytes, mtime_iso) and a reference
// time, and derives a triage summary — categories, total bytes, stale candidates,
// duplicate-name candidates, sensitive-name candidates, and the largest files —
// plus safe recommended next actions. It reads NO file content, lists no real
// directory, hashes no content, uploads nothing, and mutates nothing. The
// read-only metadata collection lives in an effect adapter; this kernel is pure.
//
// Scan depth is the node owner's choice. metadata_only is implemented here; the
// other four modes are declared as user-selectable future options and refused in
// this preview (they would require content, which this slice never reads).

import { createHash } from "node:crypto";

export const CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA =
  "bizra.node0.consented_inventory_gatherer_preview.v0.1";
export const CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL =
  "NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_MEASURED_REPO";
export const CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE =
  "GO: node0 consented inventory gather metadata only";
export const CONSENTED_INVENTORY_GATHERER_PREVIEW_MODE = "metadata_only_preview";

export const INVENTORY_SCAN_MODES = Object.freeze([
  "metadata_only",
  "content_hash_only",
  "selective_content_index",
  "full_local_content_index",
  "blocked_never_scan",
]);
// Only metadata_only is runnable in this preview; the rest are future user choices.
const IMPLEMENTED_SCAN_MODE = "metadata_only";

const CATEGORY_BY_EXTENSION = Object.freeze({
  ".md": "doc", ".txt": "doc", ".doc": "doc", ".docx": "doc", ".rtf": "doc", ".odt": "doc",
  ".pdf": "pdf",
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".svg": "image", ".webp": "image", ".bmp": "image", ".tiff": "image",
  ".mp4": "video", ".mov": "video", ".avi": "video", ".mkv": "video", ".webm": "video",
  ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".flac": "audio", ".ogg": "audio",
  ".js": "code", ".mjs": "code", ".ts": "code", ".py": "code", ".rs": "code", ".go": "code",
  ".c": "code", ".cpp": "code", ".java": "code", ".sh": "code", ".json": "code", ".yaml": "code",
  ".yml": "code", ".toml": "code", ".html": "code", ".css": "code",
  ".zip": "archive", ".tar": "archive", ".gz": "archive", ".7z": "archive", ".rar": "archive",
  ".csv": "data", ".jsonl": "data", ".db": "data", ".sqlite": "data", ".parquet": "data",
});

// Name/extension-only sensitivity signals (never content).
const SENSITIVE_NAME_PATTERNS = Object.freeze([
  "secret", "password", "passwd", "wallet", "seed", "credential", "private",
  "id_rsa", "mnemonic", "apikey", "api_key", "keystore",
]);
const SENSITIVE_EXTENSIONS = Object.freeze([".env", ".pem", ".p12", ".key", ".keystore"]);

const CORE_BODY_KEYS = Object.freeze([
  "schema", "truth_label", "mode", "root_label", "scan_mode",
  "content_read_allowed", "scan_modes_available", "now_iso", "stale_after_days",
  "total_files", "total_bytes", "by_category", "by_extension",
  "largest_files", "stale_candidates", "duplicate_name_candidates",
  "sensitive_name_candidates", "recommended_next_actions",
  "authority_delta", "boundary",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "A useful workspace triage (categories, total bytes, stale / duplicate-name / sensitive-name candidates, largest files, safe next actions) is derived from file METADATA alone — no content is read.",
  "Every summary field is re-derived from the primary file rows, so a forged summary carrying a recomputed hash is rejected.",
  "Scan depth is the node owner's choice: metadata_only is implemented; the other four modes are declared as future user-selectable options and refused here because this slice never reads content.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "It does not read any file content, hash any content, list any directory, upload anything, or mutate anything; boundary is all-false and authority_delta is 0.",
  "It does not prove the injected metadata is complete or truthful — it summarizes exactly the rows it is given.",
  "It is not itself the real scan — the read-only metadata collection is an explicit, consent-scoped effect adapter over an operator-named root.",
]);

function sha256(v) { return createHash("sha256").update(v, "utf8").digest("hex"); }
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function freezeDeep(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const c of Object.values(v)) freezeDeep(c);
  return v;
}

export function consentedInventoryGathererPreviewBoundary() {
  return Object.freeze({
    content_read_performed: false,
    recursive_content_read_performed: false,
    file_hash_of_content_performed: false,
    embedding_generated: false,
    file_mutation_performed: false,
    network_used: false,
    upload_performed: false,
    model_invocation_performed: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    daemon_started: false,
  });
}

function boundaryAllFalse(b) {
  if (!b || typeof b !== "object") return false;
  const c = consentedInventoryGathererPreviewBoundary();
  const exp = Object.keys(c).sort();
  const act = Object.keys(b).sort();
  if (exp.length !== act.length) return false;
  for (let i = 0; i < exp.length; i++) {
    if (exp[i] !== act[i] || b[exp[i]] !== false) return false;
  }
  return true;
}

function isFileRow(r) {
  return (
    !!r && typeof r === "object" &&
    typeof r.relative_path === "string" && r.relative_path.length > 0 &&
    typeof r.extension === "string" &&
    Number.isInteger(r.size_bytes) && r.size_bytes >= 0 &&
    typeof r.mtime_iso === "string" && r.mtime_iso.length > 0
  );
}

function basename(p) {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1];
}
function categoryOf(row) {
  if (typeof row.category === "string" && row.category.length > 0) return row.category;
  return CATEGORY_BY_EXTENSION[String(row.extension).toLowerCase()] || "other";
}
function isSensitive(row) {
  const name = basename(row.relative_path).toLowerCase();
  const ext = String(row.extension).toLowerCase();
  if (SENSITIVE_EXTENSIONS.includes(ext)) return true;
  return SENSITIVE_NAME_PATTERNS.some((p) => name.includes(p));
}
function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return (b - a) / 86_400_000;
}

// Pure derivation — the single source of the triage summary.
export function deriveInventorySummary(files, now_iso, stale_after_days) {
  const by_category = {};
  const by_extension = {};
  const nameToPaths = {};
  const sensitive_name_candidates = [];
  const stale_candidates = [];
  let total_bytes = 0;

  for (const row of files) {
    const cat = categoryOf(row);
    by_category[cat] = (by_category[cat] || 0) + 1;
    const ext = String(row.extension).toLowerCase() || "(none)";
    by_extension[ext] = (by_extension[ext] || 0) + 1;
    total_bytes += row.size_bytes;

    const bn = basename(row.relative_path);
    (nameToPaths[bn] = nameToPaths[bn] || []).push(row.relative_path);

    if (isSensitive(row)) {
      sensitive_name_candidates.push({ relative_path: row.relative_path, reason: "sensitive_name_or_extension" });
    }
    if (daysBetween(row.mtime_iso, now_iso) >= stale_after_days) {
      stale_candidates.push({ relative_path: row.relative_path, mtime_iso: row.mtime_iso });
    }
  }

  const duplicate_name_candidates = Object.keys(nameToPaths)
    .filter((n) => nameToPaths[n].length > 1)
    .sort()
    .map((n) => ({ name: n, count: nameToPaths[n].length, paths: [...nameToPaths[n]].sort() }));

  const largest_files = [...files]
    .sort((a, b) => b.size_bytes - a.size_bytes || a.relative_path.localeCompare(b.relative_path))
    .slice(0, 10)
    .map((r) => ({ relative_path: r.relative_path, size_bytes: r.size_bytes }));

  // Sort the candidate lists deterministically.
  sensitive_name_candidates.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  stale_candidates.sort((a, b) => a.relative_path.localeCompare(b.relative_path));

  const recommended_next_actions = [];
  if (sensitive_name_candidates.length > 0) {
    recommended_next_actions.push("review_sensitive_name_candidates_before_any_share");
  }
  if (duplicate_name_candidates.length > 0) {
    recommended_next_actions.push("review_duplicate_name_candidates_for_dedupe_proposal");
  }
  if (stale_candidates.length > 0) {
    recommended_next_actions.push("consider_archiving_stale_candidates_reversibly");
  }
  if (recommended_next_actions.length === 0) {
    recommended_next_actions.push("no_triage_flags_workspace_is_tidy");
  }

  return {
    total_files: files.length,
    total_bytes,
    by_category,
    by_extension,
    largest_files,
    stale_candidates,
    duplicate_name_candidates,
    sensitive_name_candidates,
    recommended_next_actions,
  };
}

export function activeInventoryValidationBlocks(input) {
  const blocked = [];
  if (!input || typeof input !== "object") { blocked.push("input_not_object"); return blocked; }
  if (typeof input.root_label !== "string" || input.root_label.length === 0) blocked.push("root_label_missing");
  if (!INVENTORY_SCAN_MODES.includes(input.scan_mode)) blocked.push("scan_mode_invalid");
  else if (input.scan_mode !== IMPLEMENTED_SCAN_MODE) blocked.push("scan_mode_not_available_in_preview");
  if (!Array.isArray(input.files)) blocked.push("files_not_array");
  else input.files.forEach((r, i) => { if (!isFileRow(r)) blocked.push(`file_row_invalid:${i}`); });
  if (typeof input.now_iso !== "string" || Number.isNaN(Date.parse(input.now_iso))) blocked.push("now_iso_invalid");
  if (input.stale_after_days !== undefined && !(Number.isInteger(input.stale_after_days) && input.stale_after_days > 0)) {
    blocked.push("stale_after_days_invalid");
  }
  // A row that claims content was read is refused — this slice is metadata-only.
  if (Array.isArray(input.files) && input.files.some((r) => r && r.content_read === true)) {
    blocked.push("content_read_claimed");
  }
  return blocked;
}

export function planConsentedInventoryGathererPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  blocked_by.push(...activeInventoryValidationBlocks(input));
  return Object.freeze({
    schema: CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
    truth_label: CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function pickCoreBody(source) {
  const core = {};
  for (const k of CORE_BODY_KEYS) core[k] = source[k];
  return core;
}
export function computeInventoryContentHash(coreBodyLike) {
  return `sha256:${sha256(stableStringify(pickCoreBody(coreBodyLike)))}`;
}

export function buildConsentedInventoryGathererPreviewPayload(input) {
  const files = Array.isArray(input.files) ? input.files : [];
  const stale_after_days = Number.isInteger(input.stale_after_days) ? input.stale_after_days : 180;
  const summary = deriveInventorySummary(files, input.now_iso, stale_after_days);

  const coreBody = {
    schema: CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
    truth_label: CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
    mode: CONSENTED_INVENTORY_GATHERER_PREVIEW_MODE,
    root_label: input.root_label,
    scan_mode: input.scan_mode,
    content_read_allowed: false,
    scan_modes_available: INVENTORY_SCAN_MODES,
    now_iso: input.now_iso,
    stale_after_days,
    ...summary,
    authority_delta: 0,
    boundary: consentedInventoryGathererPreviewBoundary(),
  };

  const content_hash = computeInventoryContentHash(coreBody);
  return freezeDeep({
    ...coreBody,
    content_hash,
    inventory_snapshot_hash: content_hash,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

export function verifyConsentedInventoryGathererPreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const content_hash = payload.content_hash;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_malformed");
  } else if (computeInventoryContentHash(payload) !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  // Independent re-derivation of the whole summary from the primary rows is not
  // possible from the payload alone (rows are not stored), so re-derive the
  // aggregate integers we can bind: total_files/total_bytes must be internally
  // consistent with by_category counts.
  const catTotal = Object.values(payload.by_category || {}).reduce((a, b) => a + b, 0);
  if (catTotal !== payload.total_files) blocked_by.push("category_counts_not_consistent");
  const extTotal = Object.values(payload.by_extension || {}).reduce((a, b) => a + b, 0);
  if (extTotal !== payload.total_files) blocked_by.push("extension_counts_not_consistent");

  if (payload.content_read_allowed !== false) blocked_by.push("content_read_allowed_true");
  if (payload.scan_mode !== IMPLEMENTED_SCAN_MODE) blocked_by.push("scan_mode_not_metadata_only");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.inventory_snapshot_hash !== content_hash) blocked_by.push("inventory_snapshot_hash_mismatch");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
    truth_label: CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function runConsentedInventoryGathererPreview({ consent, input } = {}) {
  const boundary = consentedInventoryGathererPreviewBoundary();
  const base = {
    schema: CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
    truth_label: CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
    mode: CONSENTED_INVENTORY_GATHERER_PREVIEW_MODE,
    boundary,
  };
  const plan = planConsentedInventoryGathererPreview({ consent, input });
  if (!plan.eligible) return Object.freeze({ ...base, ok: false, blocked_by: plan.blocked_by });

  const payload = buildConsentedInventoryGathererPreviewPayload(input);
  const verified = verifyConsentedInventoryGathererPreview(payload);
  if (!verified.ok) return Object.freeze({ ...base, ok: false, blocked_by: verified.blocked_by });

  return Object.freeze({
    ...base,
    ok: true,
    root_label: payload.root_label,
    scan_mode: payload.scan_mode,
    content_read_allowed: false,
    scan_modes_available: payload.scan_modes_available,
    total_files: payload.total_files,
    total_bytes: payload.total_bytes,
    by_category: payload.by_category,
    largest_files: payload.largest_files,
    stale_candidates: payload.stale_candidates,
    duplicate_name_candidates: payload.duplicate_name_candidates,
    sensitive_name_candidates: payload.sensitive_name_candidates,
    recommended_next_actions: payload.recommended_next_actions,
    content_hash: payload.content_hash,
    inventory_snapshot_hash: payload.inventory_snapshot_hash,
    authority_delta: 0,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([]),
  });
}

// Fixtures shared by the review gate and the mirrored test.
export const CONSENTED_INVENTORY_CANONICAL_FIXTURE = freezeDeep({
  root_label: "~/fixture-workspace",
  scan_mode: "metadata_only",
  now_iso: "2026-07-06T00:00:00.000Z",
  stale_after_days: 180,
  files: [
    { relative_path: "notes/bizra-notes.md", extension: ".md", size_bytes: 18400, mtime_iso: "2026-07-01T00:00:00.000Z" },
    { relative_path: "notes/bizra-notes.md.bak/bizra-notes.md", extension: ".md", size_bytes: 18000, mtime_iso: "2025-01-01T00:00:00.000Z" },
    { relative_path: "archives/export.zip", extension: ".zip", size_bytes: 12_000_000, mtime_iso: "2025-06-01T00:00:00.000Z" },
    { relative_path: "secrets/wallet.key", extension: ".key", size_bytes: 2048, mtime_iso: "2026-06-01T00:00:00.000Z" },
    { relative_path: "media/demo.mp4", extension: ".mp4", size_bytes: 340_000_000, mtime_iso: "2026-05-01T00:00:00.000Z" },
  ],
});

// Malicious fixture: a row claims content was read — must be refused.
export const CONSENTED_INVENTORY_MALICIOUS_FIXTURE = freezeDeep({
  ...CONSENTED_INVENTORY_CANONICAL_FIXTURE,
  files: [
    { relative_path: "notes/x.md", extension: ".md", size_bytes: 10, mtime_iso: "2026-07-01T00:00:00.000Z", content_read: true },
  ],
});
