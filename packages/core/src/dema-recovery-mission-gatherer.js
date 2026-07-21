// DEMA-RECOVERY-MISSION-GATHERER-1B — read-only gatherer that feeds real file
// METADATA into the DEMA-RECOVERY-MISSION-ENGINE-1A candidate reconstruction.
//
// Pure kernel: consumes INJECTED metadata rows (relative_path, extension,
// size_bytes, mtime_iso, root) + a declared source_boundary {roots, exclusions}
// + a reference time. NO fs / network / clock / random in this file — the
// read-only directory walk lives in the effect adapter
// (apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js), the only fs
// surface for this slice. `node:path` is used here only for pure string
// arithmetic (join/normalize on already-injected strings) — it performs no IO.
//
// Boundary enforcement (this kernel's own law, ahead of the reused helper): any
// row whose declared root is not in `source_boundary.roots`, whose resolved
// `root + relative_path` escapes that root (e.g. a `..` traversal), or whose
// resolved path falls under a declared exclusion is EXCLUDED into
// `not_accessed_report` and is NEVER constructed into an evidence item — it
// never reaches `reconstructRecoveryCandidates`, chronology, or candidates.
//
// METADATA-ONLY: this slice reads no file CONTENT. A row claiming
// `content_read: true` is refused at plan time (the whole request is blocked,
// not silently dropped) — content access is a declared future step requiring
// separate consent.
//
// Candidate reconstruction itself is REUSED, not reimplemented: this kernel
// maps accepted rows into the `evidence` shape
// `reconstructRecoveryCandidates({ evidence, source_boundary })` already
// expects (DEMA-RECOVERY-MISSION-ENGINE-1A) and returns its
// {candidates<=7, chronology, contradiction_map, not_accessed_report} as-is.
//
// Mirrors node0-realm-state-kernel / dema-recovery-mission-engine's
// plan -> build -> verify -> run shape and its declared limit: verify() proves
// internal body consistency only — it does NOT prove independent authenticity
// (a forger controlling every semantically permitted field and recomputing the
// hash is not detected without an external signature or anchor, a later
// slice).
//
// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// reviewed in this slice's PR.
import { isAbsolute, join, normalize, sep } from "node:path";

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { reconstructRecoveryCandidates } from "./dema-recovery-mission-engine.js";

export const DEMA_RECOVERY_MISSION_GATHERER_SCHEMA =
  "bizra.dema.recovery_mission_gatherer.v0.1";
export const DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL =
  "DEMA_RECOVERY_MISSION_GATHERER_MEASURED_REPO";
export const DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE =
  "GO: dema recovery mission gather preview";

// Bounded schema-local deep freeze (mirrors dema-recovery-mission-engine.js).
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

export function demaRecoveryMissionGathererBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
    content_read_performed: false,
  });
}

function boundaryAllFalse(b) {
  if (!b || typeof b !== "object") return false;
  const expected = demaRecoveryMissionGathererBoundary();
  const exp = Object.keys(expected).sort();
  const act = Object.keys(b).sort();
  if (exp.length !== act.length) return false;
  for (let i = 0; i < exp.length; i++) {
    if (exp[i] !== act[i] || b[exp[i]] !== false) return false;
  }
  return true;
}

function isValidRow(r) {
  return (
    !!r &&
    typeof r === "object" &&
    typeof r.root === "string" &&
    r.root !== "" &&
    isAbsolute(r.root) &&
    typeof r.relative_path === "string" &&
    r.relative_path !== "" &&
    typeof r.extension === "string" &&
    Number.isInteger(r.size_bytes) &&
    r.size_bytes >= 0 &&
    (r.mtime_iso === null ||
      r.mtime_iso === undefined ||
      (typeof r.mtime_iso === "string" && r.mtime_iso !== ""))
  );
}

function sourceBoundaryValid(sb) {
  return (
    sb &&
    typeof sb === "object" &&
    Array.isArray(sb.roots) &&
    sb.roots.length > 0 &&
    sb.roots.every((r) => typeof r === "string" && r !== "" && isAbsolute(r)) &&
    Array.isArray(sb.exclusions) &&
    sb.exclusions.every((r) => typeof r === "string" && r !== "")
  );
}

function rowAssetId(row) {
  return `${row.root}::${row.relative_path}`;
}

function normalizeBestEvidenceTime(mtime_iso) {
  return typeof mtime_iso === "string" && mtime_iso !== "" ? mtime_iso : null;
}

// Pure string arithmetic only — never touches the real filesystem. Rejects an
// absolute relative_path outright; a `..` escape is caught by the
// starts-with-root check in rowInBoundary below (normalize() collapses it).
function resolveRowPath(row) {
  if (isAbsolute(row.relative_path)) return null;
  return normalize(join(row.root, row.relative_path));
}

// This kernel's own boundary law (ahead of reconstructRecoveryCandidates's
// simpler root-membership check): the row's declared root must be one of the
// declared roots, the resolved path must stay under that root (no traversal
// escape), and the resolved path must not fall under any declared exclusion.
function rowInBoundary(row, roots, exclusions) {
  if (!roots.includes(row.root)) return false;
  const resolved = resolveRowPath(row);
  if (resolved === null) return false;
  if (!(resolved === row.root || resolved.startsWith(row.root + sep))) return false;
  if (exclusions.some((ex) => resolved === ex || resolved.startsWith(ex + sep))) return false;
  return true;
}

// Returns every reason the input is invalid — mirrors
// node0-consented-inventory-gatherer-preview's activeInventoryValidationBlocks.
function activeGathererValidationBlocks(input) {
  const blocked = [];
  if (!input || typeof input !== "object") {
    blocked.push("input_not_object");
    return blocked;
  }
  if (typeof input.objective_text !== "string" || input.objective_text === "") {
    blocked.push("objective_text_missing");
  }
  if (!sourceBoundaryValid(input.source_boundary)) blocked.push("source_boundary_invalid");
  if (typeof input.now_iso !== "string" || Number.isNaN(Date.parse(input.now_iso))) {
    blocked.push("now_iso_invalid");
  }
  if (!Array.isArray(input.files)) {
    blocked.push("files_not_array");
  } else {
    input.files.forEach((r, i) => {
      if (!isValidRow(r)) blocked.push(`file_row_invalid:${i}`);
    });
    // A row that claims content was read is refused — this slice is metadata-only.
    if (input.files.some((r) => r && r.content_read === true)) blocked.push("content_read_claimed");
    if (input.max_files !== undefined) {
      if (!(Number.isInteger(input.max_files) && input.max_files > 0)) {
        blocked.push("max_files_invalid");
      } else if (input.files.length > input.max_files) {
        blocked.push("max_files_exceeded");
      }
    }
  }
  return blocked;
}

export function planDemaRecoveryMissionGatherer({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  blocked_by.push(...activeGathererValidationBlocks(input));
  return Object.freeze({
    schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Pure derivation — assumes plan-validated input (called after an eligible
// plan in run(), or directly in tests with well-shaped rows: build() does not
// re-validate shape, only routes each row through the boundary law above).
export function buildDemaRecoveryMissionGathererPayload(input) {
  const roots = [...input.source_boundary.roots];
  const exclusions = [...input.source_boundary.exclusions];
  const files = Array.isArray(input.files) ? input.files : [];

  const evidence = [];
  const rowExclusions = [];
  for (const row of files) {
    if (rowInBoundary(row, roots, exclusions)) {
      evidence.push({
        asset_id: rowAssetId(row),
        root: row.root,
        ref: row.relative_path,
        best_evidence_time: normalizeBestEvidenceTime(row.mtime_iso),
        relevance: 0, // no relevance signal is derivable from metadata alone — never invented
        limitations: "metadata_only_no_content_read",
        claim: null,
        conflicts_with: Array.isArray(row.conflicts_with) ? row.conflicts_with : [],
      });
    } else {
      rowExclusions.push({
        asset_id: rowAssetId(row),
        root: row.root,
        ref: row.relative_path,
        reason: "out_of_source_boundary",
      });
    }
  }

  const reconstructed = reconstructRecoveryCandidates({
    evidence,
    source_boundary: { roots, exclusions },
  });

  const not_accessed_report = [...rowExclusions, ...reconstructed.not_accessed_report];

  const coreBody = {
    schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    objective_text: input.objective_text,
    source_boundary: { roots, exclusions },
    now_iso: input.now_iso,
    total_rows_in: files.length,
    accepted_count: evidence.length,
    excluded_count: rowExclusions.length,
    candidates: reconstructed.candidates,
    chronology: reconstructed.chronology,
    contradiction_map: reconstructed.contradiction_map,
    not_accessed_report,
    content_read_allowed: false,
    boundary: demaRecoveryMissionGathererBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(coreBody);
  return deepFreeze({ ...coreBody, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the WHOLE body
// minus its hash field, then check the slice's declared invariants with
// stable block codes. Internal semantic invariants are checked; independent
// authenticity is NOT proved (see file header limit).
export function verifyDemaRecoveryMissionGatherer(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const blocked_by = [];
  const { content_hash, ...body } = payload;
  if (payload.schema !== DEMA_RECOVERY_MISSION_GATHERER_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) {
    blocked_by.push("canonicalization_algorithm_mismatch");
  }
  if (payload.hash_algorithm !== "sha256") blocked_by.push("hash_algorithm_mismatch");
  if (payload.text_encoding !== "utf-8") blocked_by.push("text_encoding_mismatch");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.content_read_allowed !== false) blocked_by.push("content_read_allowed_true");
  if (!Array.isArray(payload.candidates) || payload.candidates.length > 7) {
    blocked_by.push("candidates_exceed_cap");
  }
  let rederived = null;
  try {
    rederived = sha256CanonicalJsonV1(body);
  } catch {
    blocked_by.push("body_not_canonicalizable");
  }
  if (rederived !== null && rederived !== content_hash) blocked_by.push("content_hash_mismatch");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Orchestrator the review gate + CLI adapter consume. plan -> build -> verify
// -> tamper-reject, ONCE, then expose two presentations of the same verified
// payload: `proof_payload` (the exact canonical builder payload the verifier
// accepted — independently re-verifiable after serialization) and `preview`
// (the existing reduced human/CLI envelope). ONE BUILD · ONE HASH · ONE
// PAYLOAD · ONE VERIFIER · TWO PRESENTATIONS (VERIFIABLE-ENVELOPE-1C). Any
// failure returns proof_payload null + a named block so the gate fails closed.
export function executeDemaRecoveryMissionGatherer({ consent, input } = {}) {
  const fail = (blocked_by) =>
    Object.freeze({
      proof_payload: null,
      preview: Object.freeze({
        ok: false,
        schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
        truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
        blocked_by: Object.freeze(blocked_by),
        boundary: demaRecoveryMissionGathererBoundary(),
      }),
    });

  const plan = planDemaRecoveryMissionGatherer({ consent, input });
  if (!plan.eligible) return fail([...plan.blocked_by]);

  const payload = buildDemaRecoveryMissionGathererPayload(input);
  const verdict = verifyDemaRecoveryMissionGatherer(payload);
  if (!verdict.ok) return fail([...verdict.blocked_by]);

  const tampered = verifyDemaRecoveryMissionGatherer({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) return fail(["tamper_check_failed"]);

  return Object.freeze({
    proof_payload: payload,
    preview: Object.freeze({
      ok: true,
      schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
      truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
      content_hash: payload.content_hash,
      boundary: demaRecoveryMissionGathererBoundary(),
      blocked_by: Object.freeze([]),
      objective_text: payload.objective_text,
      total_rows_in: payload.total_rows_in,
      accepted_count: payload.accepted_count,
      excluded_count: payload.excluded_count,
      candidates: payload.candidates,
      chronology: payload.chronology,
      contradiction_map: payload.contradiction_map,
      not_accessed_report: payload.not_accessed_report,
    }),
  });
}

// Backward-compatible envelope surface: identical output to pre-1C behavior.
export function runDemaRecoveryMissionGatherer({ consent, input } = {}) {
  return executeDemaRecoveryMissionGatherer({ consent, input }).preview;
}

// Fixtures shared by the review gate and the test file.
const CANONICAL_ROOT = "/fixture/corpus";
export const DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE = Object.freeze({
  objective_text: "Recover the 2019 family photo set referenced in the chat export",
  source_boundary: Object.freeze({
    roots: Object.freeze([CANONICAL_ROOT]),
    exclusions: Object.freeze([]),
  }),
  now_iso: "2026-07-18T00:00:00.000Z",
  files: Object.freeze([
    Object.freeze({
      root: CANONICAL_ROOT,
      relative_path: "photos/img1.jpg",
      extension: ".jpg",
      size_bytes: 204800,
      mtime_iso: "2019-05-01T00:00:00.000Z",
    }),
    Object.freeze({
      root: CANONICAL_ROOT,
      relative_path: "photos/img2.jpg",
      extension: ".jpg",
      size_bytes: 102400,
      mtime_iso: null, // unknown time -> UNKNOWN chronology bucket
    }),
  ]),
});

// Malicious fixture: a row claims content was read — must be refused.
export const DEMA_RECOVERY_MISSION_GATHERER_MALICIOUS_FIXTURE = Object.freeze({
  ...DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  files: Object.freeze([
    Object.freeze({
      root: CANONICAL_ROOT,
      relative_path: "photos/img1.jpg",
      extension: ".jpg",
      size_bytes: 204800,
      mtime_iso: "2019-05-01T00:00:00.000Z",
      content_read: true,
    }),
  ]),
});
