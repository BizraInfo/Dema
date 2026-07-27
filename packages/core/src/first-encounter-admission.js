/**
 * DEMA-FIRST-ENCOUNTER-1A — admission boundary kernel.
 *
 * Pure and import-free on purpose: the same file is the proof surface under
 * `npm test` and the runtime surface the UI imports. No fs, no crypto, no clock.
 *
 * Root binding — ROOT-3 §III: FATE is the "constitutional boundary gate — no
 * action without consent and proof". ROOT-2 gates its own reader the same way
 * («الآن لحظة الاختيار توافق على القواعد أم لا») — the choice is presented
 * before the content, not after. This kernel is that gate for a folder.
 *
 * The boundary it enforces:
 *   METADATA_DISCOVERY → declare exact scope → exact human consent → CONTENT_ADMISSION
 *
 * What it does NOT do: read files, hash files, touch the network, or decide
 * anything the UI can override. The UI renders this verdict; it never mints one.
 */

export const FIRST_ENCOUNTER_ADMISSION_SCHEMA = "bizra.dema.first_encounter_admission.v0.1";

/** The only fields the metadata phase is permitted to carry. */
export const METADATA_FIELDS = Object.freeze([
  "relative_path",
  "extension",
  "size",
  "modified_time",
  "file_hash",
]);

/**
 * Keys that would mean content crossed the boundary. Presence is a hard refusal,
 * never a sanitise — silently stripping a leak would make the gate cosmetic.
 */
export const FORBIDDEN_CONTENT_KEYS = Object.freeze([
  "content",
  "contents",
  "preview",
  "text",
  "extracted_text",
  "excerpt",
  "body",
  "snippet",
  "embedding",
  "embeddings",
  "vector",
  "summary",
  "first_bytes",
  "head",
  "sample",
]);

const FIELD_SET = new Set(METADATA_FIELDS);
const FORBIDDEN_SET = new Set(FORBIDDEN_CONTENT_KEYS);

class AdmissionBoundaryError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "AdmissionBoundaryError";
    this.code = code;
  }
}

/**
 * Fails closed on anything that is not exactly the five declared metadata fields.
 * Returns a fresh record so a caller cannot smuggle a hidden prototype through.
 */
export function assertMetadataOnly(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new AdmissionBoundaryError("INVALID_METADATA_RECORD");
  }
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_SET.has(key)) {
      throw new AdmissionBoundaryError("CONTENT_LEAK_IN_METADATA_PHASE", key);
    }
    if (!FIELD_SET.has(key)) {
      throw new AdmissionBoundaryError("UNDECLARED_METADATA_FIELD", key);
    }
  }
  const clean = {};
  for (const field of METADATA_FIELDS) {
    if (!(field in record)) throw new AdmissionBoundaryError("MISSING_METADATA_FIELD", field);
    clean[field] = record[field];
  }
  if (typeof clean.relative_path !== "string" || clean.relative_path.length === 0) {
    throw new AdmissionBoundaryError("INVALID_RELATIVE_PATH");
  }
  if (!Number.isInteger(clean.size) || clean.size < 0) {
    throw new AdmissionBoundaryError("INVALID_SIZE");
  }
  return clean;
}

/**
 * Realpath clamp. Both arguments must already be absolute and symlink-resolved by
 * the caller — this kernel does no I/O, so it cannot resolve them itself.
 *
 * Segment-aware on purpose: a naive `startsWith` would admit `/demo/corpus-secret`
 * for root `/demo/corpus`.
 */
// Trailing-slash strip WITHOUT a regex. `/\/+$/` is a polynomial-ReDoS shape
// (CodeQL js/polynomial-redos): on a long run of slashes the engine retries `\/+$`
// from each start position, so a caller-supplied path of n slashes costs O(n^2).
// These paths come from the scanned filesystem, i.e. uncontrolled input. Scanning
// backwards and slicing once is O(n) with no backtracking.
function stripTrailingSlashes(value) {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) end -= 1;
  return value.slice(0, end);
}

export function isWithinRoot(rootRealPath, candidateRealPath) {
  if (typeof rootRealPath !== "string" || typeof candidateRealPath !== "string") return false;
  if (!rootRealPath.startsWith("/") || !candidateRealPath.startsWith("/")) return false;
  if (candidateRealPath.includes("\0") || rootRealPath.includes("\0")) return false;
  // An unresolved traversal segment means the caller did not realpath it. Fail closed.
  if (candidateRealPath.split("/").includes("..")) return false;
  const root = stripTrailingSlashes(rootRealPath);
  const candidate = stripTrailingSlashes(candidateRealPath);
  if (root === "") return false;
  return candidate === root || candidate.startsWith(root + "/");
}

/** Deterministic inventory. Same input set → same bytes, in any order. */
export function normalizeInventory(records) {
  if (!Array.isArray(records)) throw new AdmissionBoundaryError("INVALID_INVENTORY_INPUT");
  const clean = records.map(assertMetadataOnly);
  const seen = new Set();
  for (const f of clean) {
    if (seen.has(f.relative_path)) {
      throw new AdmissionBoundaryError("DUPLICATE_RELATIVE_PATH", f.relative_path);
    }
    seen.add(f.relative_path);
  }
  clean.sort((a, b) => (a.relative_path < b.relative_path ? -1 : a.relative_path > b.relative_path ? 1 : 0));
  const extensions = {};
  for (const f of clean) extensions[f.extension] = (extensions[f.extension] ?? 0) + 1;
  return Object.freeze({
    file_count: clean.length,
    total_bytes: clean.reduce((n, f) => n + f.size, 0),
    extensions: Object.freeze(extensions),
    files: Object.freeze(clean),
  });
}

/**
 * The exact phrase is derived from the scope, so a phrase minted for a wider
 * folder cannot be replayed against a narrower one — consent cannot silently widen.
 */
function derivePhrase(scope) {
  return `READ ${scope.file_count} FILES IN ${scope.root_real_path}`;
}

export function buildConsentContract({
  root_label,
  root_real_path,
  inventory,
  mission_question,
  manifest_hash = null,
}) {
  if (!inventory || typeof inventory.file_count !== "number") {
    throw new AdmissionBoundaryError("INVALID_INVENTORY");
  }
  if (typeof root_real_path !== "string" || !root_real_path.startsWith("/")) {
    throw new AdmissionBoundaryError("INVALID_ROOT_REAL_PATH");
  }
  const scope = Object.freeze({
    root_label: String(root_label ?? ""),
    root_real_path,
    file_count: inventory.file_count,
    total_bytes: inventory.total_bytes,
    manifest_hash,
  });
  return Object.freeze({
    schema: FIRST_ENCOUNTER_ADMISSION_SCHEMA,
    truth_label: "LOCAL_CONTENT_ADDRESSED",
    phase: "AWAITING_CONSENT",
    mission_question: String(mission_question ?? ""),
    scope,
    permission: Object.freeze({
      effect: "READ_FILE_CONTENT",
      write_permitted: false,
      delete_permitted: false,
      network_permitted: false,
      scope_is_exact: true,
      transfers_to_other_scopes: false,
    }),
    required_phrase: derivePhrase(scope),
    reject_option: Object.freeze({
      available: true,
      // ROOT-1: «إنه اختيارك أن تكمل وليس اختياري» — it is your choice to complete, not mine.
      effect_of_rejection: "NO_CONTENT_IS_READ_MISSION_STOPS",
    }),
  });
}

/** Renders a verdict. Callers display it; they do not get to disagree with it. */
export function evaluateAdmission({ contract, provided_phrase }) {
  if (!contract || contract.schema !== FIRST_ENCOUNTER_ADMISSION_SCHEMA) {
    throw new AdmissionBoundaryError("INVALID_CONTRACT");
  }
  const reason_codes = [];
  if (typeof provided_phrase !== "string" || provided_phrase.length === 0) {
    reason_codes.push("CONSENT_PHRASE_ABSENT");
  } else if (provided_phrase !== contract.required_phrase) {
    reason_codes.push("CONSENT_PHRASE_MISMATCH");
  }
  const admitted = reason_codes.length === 0;
  return Object.freeze({
    schema: FIRST_ENCOUNTER_ADMISSION_SCHEMA,
    truth_label: "LOCAL_CONTENT_ADDRESSED",
    state: admitted ? "ADMITTED" : "REFUSED",
    content_admitted: admitted,
    phase: admitted ? "CONTENT_ADMISSION" : "METADATA_DISCOVERY",
    granted_scope: admitted ? contract.scope : null,
    reason_codes: Object.freeze(reason_codes),
    requirement: "Exact phrase match; no fuzzy consent.",
    boundaries: Object.freeze({
      content_read_before_consent: false,
      network_used: false,
      source_mutation_performed: false,
      scope_widened_after_consent: false,
      challenge_key_in_scope: false,
    }),
  });
}
