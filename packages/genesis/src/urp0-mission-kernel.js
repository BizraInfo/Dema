// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// BIZRA-GENESIS-LOCAL-MISSION-0 — the bounded metadata inventory. This file is
// the PURE half: mission contract, consent context, and the derivation of the
// mission result from an injected observation. The actual filesystem walk lives
// in scripts/genesis/urp0-scan.mjs (I/O tier) and hands its folded counters here.
//
// The split matters constitutionally: what the mission is ALLOWED to do is
// decided by a pure, testable contract; what it DID is a set of counters that
// SAT re-derives. Neither half can quietly grant itself more authority.
//
// PURE KERNEL: no fs / net / http / child_process / clock / random.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  URP0_MISSION_ID,
  urp0ConsentContextHash,
  urp0MissionConsentPhrase,
} from "./urp0-kernel.js";

export const MISSION_CONTRACT_SCHEMA = "bizra.genesis.mission_contract.v0.1";
export const MISSION_RESULT_SCHEMA = "bizra.genesis.mission_result.v0.1";
export const MISSION_RECEIPT_SCHEMA = "bizra.genesis.mission_receipt.v0.1";
export const MISSION_CONSENT_CONTEXT_SCHEMA = "bizra.genesis.consent_context.v0.1";
export const MISSION_PERMITTED_OPERATION = "METADATA_INVENTORY_READ_ONLY";

// What the mission may do. Enumerated positively so a reviewer reads the whole
// authority in one screen.
export const MISSION_PERMITTED_ACTIONS = Object.freeze([
  "validate_exact_root",
  "inspect_filesystem_metadata",
  "count_files_directories_symlinks",
  "total_observed_file_bytes",
  "classify_broad_file_types",
  "record_skipped_entries",
  "write_runtime_receipt_outside_source_root",
]);

// What the mission may never do. Each has a matching observed counter that SAT-4
// re-derives from the result — a forbidden action is detected, not merely
// promised against.
export const MISSION_FORBIDDEN_ACTIONS = Object.freeze([
  "read_file_contents",
  "hash_file_contents",
  "follow_symlinks",
  "rename_files",
  "move_files",
  "delete_files",
  "change_permissions",
  "access_network",
  "escape_selected_root",
  "execute_discovered_content",
]);

// Broad, fixed categories. A closed set keeps the histogram within the canonical
// object-key cap and keeps the classification auditable.
export const MISSION_TYPE_CATEGORIES = Object.freeze([
  "code",
  "document",
  "data",
  "image",
  "audio",
  "video",
  "archive",
  "other",
  "no_extension",
]);

export const MISSION_SKIP_REASONS = Object.freeze([
  "permission_denied",
  "depth_cap",
  "entry_cap",
  "deadline",
  "outside_root",
  "unreadable",
]);

const EXTENSION_CATEGORIES = Object.freeze({
  js: "code", mjs: "code", cjs: "code", ts: "code", tsx: "code", jsx: "code",
  py: "code", rs: "code", go: "code", c: "code", h: "code", cpp: "code", java: "code",
  sh: "code", rb: "code", php: "code", swift: "code", kt: "code", sql: "code",
  md: "document", txt: "document", pdf: "document", doc: "document", docx: "document",
  rtf: "document", odt: "document", tex: "document",
  json: "data", yaml: "data", yml: "data", toml: "data", xml: "data", csv: "data",
  tsv: "data", ndjson: "data", ini: "data", lock: "data",
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image", webp: "image",
  bmp: "image", ico: "image", tiff: "image",
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", m4a: "audio", aac: "audio",
  mp4: "video", mov: "video", mkv: "video", avi: "video", webm: "video",
  zip: "archive", tar: "archive", gz: "archive", bz2: "archive", xz: "archive",
  "7z": "archive", rar: "archive",
});

// Pure classifier — shared by the scanner and by any verifier that wants to
// re-derive the histogram. Name only; contents are never opened.
export function classifyEntryName(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "no_extension";
  const ext = name.slice(dot + 1).toLowerCase();
  return EXTENSION_CATEGORIES[ext] ?? "other";
}

function isNonEmptyString(v) {
  return typeof v === "string" && v !== "";
}

function isCount(v) {
  return Number.isInteger(v) && v >= 0;
}

// The mission contract. Everything the operator is consenting to, in one
// hashable body. The contract hash is bound into the consent phrase, so consent
// cannot survive a contract edit.
export function buildMissionContract({ mission_id = URP0_MISSION_ID, canonical_root, limits } = {}) {
  const body = {
    schema: MISSION_CONTRACT_SCHEMA,
    mission_id,
    type: "BOUNDED_METADATA_INVENTORY",
    canonical_root,
    permitted_operation: MISSION_PERMITTED_OPERATION,
    metadata_only: true,
    network: false,
    permitted_actions: MISSION_PERMITTED_ACTIONS,
    forbidden_actions: MISSION_FORBIDDEN_ACTIONS,
    limits: {
      max_entries: limits?.max_entries,
      max_depth: limits?.max_depth,
      wall_clock_seconds: limits?.wall_clock_seconds,
      storage_write_bytes: limits?.storage_write_bytes,
    },
  };
  return Object.freeze({ body: Object.freeze(body), contract_hash: sha256CanonicalJsonV1(body) });
}

// The consent context. Includes the nonce and the validity window, so a captured
// consent phrase from one request cannot authorize a second one.
export function buildConsentContext({ mission_id, canonical_root, contract_hash, nonce, created_at_iso, expires_at_iso }) {
  const context = {
    schema: MISSION_CONSENT_CONTEXT_SCHEMA,
    mission_id,
    canonical_root,
    contract_hash,
    nonce,
    created_at_iso,
    expires_at_iso,
    permitted_operation: MISSION_PERMITTED_OPERATION,
  };
  const consent_context_hash = urp0ConsentContextHash(context);
  return Object.freeze({
    context: Object.freeze(context),
    consent_context_hash,
    required_phrase: urp0MissionConsentPhrase({ mission_id, canonical_root, contract_hash }),
  });
}

// The consent card: what the operator is shown BEFORE anything is written or
// executed. Deriving a card must never touch the journal or the filesystem.
export function buildConsentCard({ contract, contract_hash, consent }) {
  return Object.freeze({
    schema: "bizra.genesis.consent_card.v0.1",
    mission_id: contract.mission_id,
    canonical_root: contract.canonical_root,
    contract_hash,
    consent_context_hash: consent.consent_context_hash,
    required_phrase: consent.required_phrase,
    nonce: consent.context.nonce,
    created_at_iso: consent.context.created_at_iso,
    expires_at_iso: consent.context.expires_at_iso,
    permitted_operation: MISSION_PERMITTED_OPERATION,
    permitted_actions: contract.permitted_actions,
    forbidden_actions: contract.forbidden_actions,
    limits: contract.limits,
    writes_performed: false,
    execution_performed: false,
  });
}

// Positive shape validation of what the gatherer reported. A missing counter is
// a block, never a zero — absence of evidence is not evidence of a clean run.
export function validateObservation(observation) {
  const blocked_by = [];
  if (!observation || typeof observation !== "object") return Object.freeze(["observation_not_object"]);
  if (!isNonEmptyString(observation.root_realpath)) blocked_by.push("root_realpath_missing");
  const c = observation.counts;
  if (!c || typeof c !== "object") {
    blocked_by.push("counts_missing");
  } else {
    for (const key of ["files", "directories", "symlinks", "skipped"]) {
      if (!isCount(c[key])) blocked_by.push(`count_invalid:${key}`);
    }
  }
  if (!isCount(observation.total_file_bytes)) blocked_by.push("total_file_bytes_invalid");
  const hist = observation.type_histogram;
  if (!hist || typeof hist !== "object") {
    blocked_by.push("type_histogram_missing");
  } else {
    for (const key of Object.keys(hist)) {
      if (!MISSION_TYPE_CATEGORIES.includes(key)) blocked_by.push(`type_category_unknown:${key}`);
      else if (!isCount(hist[key])) blocked_by.push(`type_count_invalid:${key}`);
    }
  }
  const skipped = observation.skipped_reasons;
  if (!skipped || typeof skipped !== "object") {
    blocked_by.push("skipped_reasons_missing");
  } else {
    for (const key of Object.keys(skipped)) {
      if (!MISSION_SKIP_REASONS.includes(key)) blocked_by.push(`skip_reason_unknown:${key}`);
      else if (!isCount(skipped[key])) blocked_by.push(`skip_count_invalid:${key}`);
    }
  }
  for (const key of ["symlinks_followed", "entries_outside_root", "elapsed_ms"]) {
    if (!isCount(observation[key])) blocked_by.push(`observation_invalid:${key}`);
  }
  for (const key of ["contents_read", "contents_hashed", "network_used", "source_mutated"]) {
    if (observation[key] !== false) blocked_by.push(`observation_must_be_false:${key}`);
  }
  if (typeof observation.limits_honored !== "boolean") blocked_by.push("limits_honored_invalid");
  return Object.freeze(blocked_by);
}

// Derive the mission result. Counters only — never a per-entry list, so the
// canonical array cap can never be reached and no path inventory leaks into the
// receipt. The histogram and skip map are normalized to the full closed key set
// so two runs with the same shape hash identically.
export function deriveMissionResult({ contract, contract_hash, observation }) {
  const blocked_by = [...validateObservation(observation)];
  if (contract_hash !== sha256CanonicalJsonV1(contract)) blocked_by.push("contract_hash_mismatch");
  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), result: null, result_hash: null });
  }

  // Containment and non-mutation are re-derived here, not trusted: any escape,
  // any followed symlink, any content read fails the mission itself.
  if (observation.entries_outside_root !== 0) blocked_by.push("root_containment_violated");
  if (observation.symlinks_followed !== 0) blocked_by.push("symlink_followed");
  if (observation.limits_honored !== true) blocked_by.push("limits_exceeded");
  if (observation.root_realpath !== contract.canonical_root) blocked_by.push("root_realpath_mismatch");
  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), result: null, result_hash: null });
  }

  const type_histogram = {};
  for (const key of MISSION_TYPE_CATEGORIES) type_histogram[key] = observation.type_histogram[key] ?? 0;
  const skipped_reasons = {};
  for (const key of MISSION_SKIP_REASONS) skipped_reasons[key] = observation.skipped_reasons[key] ?? 0;

  const result = {
    schema: MISSION_RESULT_SCHEMA,
    mission_id: contract.mission_id,
    contract_hash,
    canonical_root: contract.canonical_root,
    metadata_only: true,
    permitted_operation: MISSION_PERMITTED_OPERATION,
    counts: {
      files: observation.counts.files,
      directories: observation.counts.directories,
      symlinks: observation.counts.symlinks,
      skipped: observation.counts.skipped,
    },
    total_file_bytes: observation.total_file_bytes,
    type_histogram,
    skipped_reasons,
    limits: contract.limits,
    limits_honored: true,
    observed: {
      contents_read: false,
      contents_hashed: false,
      symlinks_followed: 0,
      entries_outside_root: 0,
      network_used: false,
      source_mutated: false,
    },
  };
  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    result: Object.freeze(result),
    result_hash: sha256CanonicalJsonV1(result),
  });
}

// The mission receipt: the one artifact that binds contract, consent, result and
// judgment together, plus the state roots either side of the transition.
export function buildMissionReceipt({
  mission_id,
  contract_hash,
  consent_context_hash,
  consent_receipt_hash,
  result_hash,
  judgment_hash,
  previous_state_root,
  executed_at_iso,
}) {
  const body = {
    schema: MISSION_RECEIPT_SCHEMA,
    mission_id,
    contract_hash,
    consent_context_hash,
    consent_receipt_hash,
    result_hash,
    judgment_hash,
    previous_state_root,
    executed_at_iso,
    permitted_operation: MISSION_PERMITTED_OPERATION,
    metadata_only: true,
    network_used: false,
    token_minted: false,
  };
  return Object.freeze({ body: Object.freeze(body), receipt_hash: sha256CanonicalJsonV1(body) });
}

// The admission contract for Human-0. Separate from the mission contract: it is
// the founder's own submission to the ordinary path, with every privilege denied.
export function buildAdmissionContract({ human_id, node_id, roles }) {
  const body = {
    schema: "bizra.genesis.admission_contract.v0.1",
    human_id,
    node_id,
    roles,
    founder_bypass: false,
    self_approval: false,
    sat_exemption: false,
    mint_authority: false,
    treasury_authority: false,
    unbounded_resource_authority: false,
  };
  return Object.freeze({ body: Object.freeze(body), contract_hash: sha256CanonicalJsonV1(body) });
}

export function admissionConsentPhrase({ human_id, node_id, contract_hash }) {
  return `GO: admit ${human_id} to ${node_id} without founder bypass under ${contract_hash}`;
}
