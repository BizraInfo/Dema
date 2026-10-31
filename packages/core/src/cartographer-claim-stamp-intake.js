// CARTOGRAPHER-CLAIM-STAMP-INTAKE-1A
//
// Map-only intake gate for PAT-Cartographer Peak Synthesis artifacts.
// PDF prose alone must never promote "48 triples / 20 claims verified" —
// the three claim-stamp files must be present and reparable.
//
// Pure assessor: callers inject listNames / readText / pathJoin. No default
// Downloads path, no foreign-repo write, no ingest, no mint.
// Spec: docs/02-architecture/release-readiness-cli-exit-teeth-1a-pseudocode/
//       phase_04_cartographer_artifact_intake_pseudocode.md

import { buildPreviewBoundary } from "./preview-boundary.js";

export const CARTOGRAPHER_INTAKE_SCHEMA =
  "bizra.dema.cartographer_claim_stamp_intake_preview.v0.1";

export const REQUIRED_CARTOGRAPHER_FILES = Object.freeze([
  "cross_repo_ledger.json",
  "bizra_hypergraph_triples.jsonl",
  "public_claims_audit.json",
]);

export const CARTOGRAPHER_INTAKE_TRUTH = Object.freeze({
  BLOCKED: "CARTOGRAPHER_INTAKE_BLOCKED",
  PARSE_FAILED: "CARTOGRAPHER_INTAKE_PARSE_FAILED",
  REPARSE_GREEN: "CARTOGRAPHER_INTAKE_REPARSE_GREEN",
  COUNT_MISMATCH: "CARTOGRAPHER_INTAKE_COUNT_MISMATCH",
});

function textVal(v) {
  return typeof v === "string" ? v : "";
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryParseNdjson(text) {
  const raw = textVal(text);
  if (!raw.trim()) return [];
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  return lines;
}

/**
 * Count claim entries. Returns null when a dedicated collection key is present
 * but not an array (e.g. `{ "claims": null }`) — that is PARSE_FAILED, not 1.
 */
function countClaimEntries(claims) {
  if (Array.isArray(claims)) return claims.length;
  if (!isPlainObject(claims)) return null;
  for (const key of ["claims", "entries", "badged_claims"]) {
    if (Object.prototype.hasOwnProperty.call(claims, key)) {
      return Array.isArray(claims[key]) ? claims[key].length : null;
    }
  }
  return Object.keys(claims).length;
}

function baseResult(extra) {
  return Object.freeze({
    schema: CARTOGRAPHER_INTAKE_SCHEMA,
    // Canonical preview boundary stays all-false (ADR). Content-read honesty
    // lives in io_disclosure so we never launder a true effect into the
    // all-false mint/network/federation stamp.
    boundary: buildPreviewBoundary(),
    authority_delta: 0,
    ...extra,
  });
}

function safeReadText(readText, absPath) {
  try {
    return { ok: true, text: readText(absPath) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

/**
 * Fail-closed cartographer claim-stamp intake assessment.
 *
 * @param {{
 *   intakeRoot?: string,
 *   listNames?: (root: string) => string[],
 *   readText?: (absPath: string) => string,
 *   pathJoin?: (...parts: string[]) => string,
 *   expectedCounts?: { ledger_keys?: number, triple_lines?: number, claim_entries?: number },
 * }} opts
 */
export function assessCartographerIntake({
  intakeRoot,
  listNames,
  readText,
  pathJoin = (...parts) => parts.join("/").replace(/\/+/g, "/"),
  expectedCounts,
} = {}) {
  const root = textVal(intakeRoot).trim();
  if (!root) {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.BLOCKED,
      ok: false,
      missing: Object.freeze(["intake_root"]),
      epistemic: "UNKNOWN",
    });
  }

  if (typeof listNames !== "function" || typeof readText !== "function") {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.BLOCKED,
      ok: false,
      missing: Object.freeze(["intake_io"]),
      epistemic: "UNKNOWN",
      note: "listNames and readText must be injected — no silent Downloads scan",
    });
  }

  let names;
  try {
    names = listNames(root);
  } catch (error) {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.BLOCKED,
      ok: false,
      missing: Object.freeze(["intake_root_unreadable"]),
      epistemic: "UNKNOWN",
      note: String(error?.message || error),
    });
  }

  const nameSet = new Set(
    (Array.isArray(names) ? names : []).map((n) => String(n)),
  );
  const missing = REQUIRED_CARTOGRAPHER_FILES.filter((f) => !nameSet.has(f));
  if (missing.length > 0) {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.BLOCKED,
      ok: false,
      missing: Object.freeze(missing),
      epistemic: "UNKNOWN",
      note: "PDF synthesis must not be promoted above DECLARED_IN_PDF",
      intake_root: root,
    });
  }

  const parse_errors = [];
  const read_errors = [];
  const counts = {};
  let contentRead = false;

  const ledgerRead = safeReadText(
    readText,
    pathJoin(root, "cross_repo_ledger.json"),
  );
  if (!ledgerRead.ok) {
    read_errors.push(`cross_repo_ledger.json:${ledgerRead.error}`);
  } else {
    contentRead = true;
    const ledger = tryParseJson(ledgerRead.text);
    if (!isPlainObject(ledger)) parse_errors.push("cross_repo_ledger.json");
    else counts.ledger_keys = Object.keys(ledger).length;
  }

  const claimsRead = safeReadText(
    readText,
    pathJoin(root, "public_claims_audit.json"),
  );
  if (!claimsRead.ok) {
    read_errors.push(`public_claims_audit.json:${claimsRead.error}`);
  } else {
    contentRead = true;
    const claims = tryParseJson(claimsRead.text);
    if (claims === null || (!isPlainObject(claims) && !Array.isArray(claims))) {
      parse_errors.push("public_claims_audit.json");
    } else {
      const claimCount = countClaimEntries(claims);
      if (claimCount === null) parse_errors.push("public_claims_audit.json");
      else counts.claim_entries = claimCount;
    }
  }

  const triplesRead = safeReadText(
    readText,
    pathJoin(root, "bizra_hypergraph_triples.jsonl"),
  );
  if (!triplesRead.ok) {
    read_errors.push(`bizra_hypergraph_triples.jsonl:${triplesRead.error}`);
  } else {
    contentRead = true;
    const triples = tryParseNdjson(triplesRead.text);
    if (triples === null) parse_errors.push("bizra_hypergraph_triples.jsonl");
    else counts.triple_lines = triples.length;
  }

  const io_disclosure = Object.freeze({ content_read: contentRead === true });

  if (read_errors.length > 0) {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.BLOCKED,
      ok: false,
      missing: Object.freeze(["artifact_unreadable"]),
      read_errors: Object.freeze(read_errors),
      epistemic: "UNKNOWN",
      intake_root: root,
      io_disclosure,
    });
  }

  if (parse_errors.length > 0) {
    return baseResult({
      truth_label: CARTOGRAPHER_INTAKE_TRUTH.PARSE_FAILED,
      ok: false,
      parse_errors: Object.freeze(parse_errors),
      epistemic: "DECLARED_PARTIAL",
      intake_root: root,
      io_disclosure,
    });
  }

  if (expectedCounts && isPlainObject(expectedCounts)) {
    const mismatches = [];
    for (const key of ["ledger_keys", "triple_lines", "claim_entries"]) {
      if (
        expectedCounts[key] !== undefined &&
        expectedCounts[key] !== counts[key]
      ) {
        mismatches.push(
          `${key}:expected=${expectedCounts[key]}:got=${counts[key]}`,
        );
      }
    }
    if (mismatches.length > 0) {
      return baseResult({
        truth_label: CARTOGRAPHER_INTAKE_TRUTH.COUNT_MISMATCH,
        ok: false,
        counts: Object.freeze({ ...counts }),
        mismatches: Object.freeze(mismatches),
        epistemic: "CONTRADICTS",
        note: "expectedCounts mismatch — do not mint burst verified",
        intake_root: root,
        io_disclosure,
      });
    }
  }

  return baseResult({
    truth_label: CARTOGRAPHER_INTAKE_TRUTH.REPARSE_GREEN,
    ok: true,
    counts: Object.freeze({ ...counts }),
    epistemic: "MEASURED_FROM_ARTIFACTS",
    intake_root: root,
    io_disclosure,
  });
}
