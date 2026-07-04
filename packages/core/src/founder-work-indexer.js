// FOUNDER-WORK-INDEXER-1A — deterministic single-file extraction with provenance.
//
// Pure kernel: reads source text in-memory only (no fs/net/model). The CLI
// performs the governed file read after exact-string consent and seals the
// receipt under $DEMA_HOME. Every emitted fact carries (file, line_span).
// No provenance → drop + count (fail-closed). Receipt payload hash excludes
// timestamps for reproducibility.

import { CANON_GLOSSARY } from "./canon-glossary.js";
import {
  buildPreviewBoundary,
  buildRuntimeEmissionBoundary,
} from "./preview-boundary.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const FOUNDER_WORK_INDEXER_SCHEMA =
  "bizra.dema.founder_work_indexer.v0.1";

export const FOUNDER_WORK_INDEX_RECEIPT_SCHEMA =
  "bizra.dema.founder_work_index_receipt.v0.1";

export const FOUNDER_WORK_INDEXER_TOOL = "founder-work-indexer";
export const FOUNDER_WORK_INDEXER_VERSION = "1a";
export const FOUNDER_WORK_INDEXER_SCOPE = "FOUNDER-WORK-INDEXER-1A";

export const FOUNDER_WORK_INDEX_TRUTH_LABEL =
  "FOUNDER_WORK_INDEXED_NOT_IMPACT_VERIFIED";

const LABELED_CLAIM_RE =
  /\b(MEASURED|DECLARED|DESIGNED_NOT_LIVE|DESIGNED-NOT-LIVE|PLANNED|VERIFIED|UNKNOWN)\b/;

const STRUCTURAL_PATTERNS = [
  { kind: "heading", re: /^(#{1,6})\s+(.+)$/ },
  { kind: "turn_marker", re: /^\*\*(You|Claude)\*\*\s*$/ },
  { kind: "code_fence", re: /^```/ },
];

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function expectedContentReadConsent(sourceFile) {
  if (typeof sourceFile !== "string" || sourceFile.length === 0) {
    throw new Error("expectedContentReadConsent: sourceFile is required");
  }
  return `GO: content_read ${sourceFile}`;
}

function normalizeTruthLabelTag(tag) {
  if (tag === "DESIGNED-NOT-LIVE") return "DESIGNED_NOT_LIVE";
  return tag;
}

function hasValidLineSpan(lineSpan) {
  return (
    lineSpan &&
    typeof lineSpan === "object" &&
    Number.isInteger(lineSpan.start) &&
    Number.isInteger(lineSpan.end) &&
    lineSpan.start >= 1 &&
    lineSpan.end >= lineSpan.start
  );
}

export function finalizeFactCandidates(candidates, sourceFile) {
  const facts = [];
  let rejected_unprovenanced = 0;
  for (const candidate of candidates) {
    const lineSpan = candidate?.line_span;
    if (!hasValidLineSpan(lineSpan)) {
      rejected_unprovenanced += 1;
      continue;
    }
    if (typeof candidate.file !== "string" || candidate.file.length === 0) {
      rejected_unprovenanced += 1;
      continue;
    }
    const file = candidate.file;
    facts.push(
      deepFreeze({
        ...candidate,
        file,
        line_span: Object.freeze({ start: lineSpan.start, end: lineSpan.end }),
      }),
    );
  }
  return Object.freeze({ facts: deepFreeze(facts), rejected_unprovenanced });
}

function extractStructuralFacts(sourceFile, lines) {
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    for (const pattern of STRUCTURAL_PATTERNS) {
      const match = line.match(pattern.re);
      if (!match) continue;
      const value =
        pattern.kind === "heading"
          ? match[2].trim()
          : pattern.kind === "turn_marker"
            ? match[1]
            : line.trim();
      candidates.push({
        kind: "structural",
        structural_kind: pattern.kind,
        value,
        truth_label: "MEASURED",
        file: sourceFile,
        line_span: { start: lineNo, end: lineNo },
      });
      break;
    }
  }
  return candidates;
}

function extractLexicalFacts(sourceFile, lines) {
  const candidates = [];
  const lowerLines = lines.map((line) => line.toLowerCase());
  for (const term of CANON_GLOSSARY.keys()) {
    const hitLines = [];
    for (let i = 0; i < lowerLines.length; i++) {
      if (lowerLines[i].includes(term)) hitLines.push(i + 1);
    }
    if (hitLines.length === 0) continue;
    candidates.push({
      kind: "lexical_anchor",
      term,
      count: hitLines.length,
      lines: Object.freeze([...hitLines]),
      truth_label: "MEASURED",
      file: sourceFile,
      line_span: {
        start: hitLines[0],
        end: hitLines[hitLines.length - 1],
      },
    });
  }
  return candidates;
}

function extractLabeledClaimFacts(sourceFile, lines) {
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    const match = line.match(LABELED_CLAIM_RE);
    if (!match) continue;
    candidates.push({
      kind: "labeled_claim",
      label: normalizeTruthLabelTag(match[1]),
      quote: line.trim(),
      truth_label: normalizeTruthLabelTag(match[1]),
      file: sourceFile,
      line_span: { start: lineNo, end: lineNo },
    });
  }
  return candidates;
}

export function extractFounderWorkFacts({ sourceFile, sourceText }) {
  if (typeof sourceFile !== "string" || sourceFile.length === 0) {
    throw new Error("extractFounderWorkFacts: sourceFile is required");
  }
  if (typeof sourceText !== "string") {
    throw new Error("extractFounderWorkFacts: sourceText must be a string");
  }
  const lines = sourceText.split(/\r?\n/);
  const candidates = [
    ...extractStructuralFacts(sourceFile, lines),
    ...extractLexicalFacts(sourceFile, lines),
    ...extractLabeledClaimFacts(sourceFile, lines),
  ];
  return finalizeFactCandidates(candidates, sourceFile);
}

export function buildFounderWorkIndexPayload({
  sourceFile,
  sourceSha256,
  sourceText,
}) {
  const { facts, rejected_unprovenanced } = extractFounderWorkFacts({
    sourceFile,
    sourceText,
  });
  const payload = Object.freeze({
    tool: FOUNDER_WORK_INDEXER_TOOL,
    version: FOUNDER_WORK_INDEXER_VERSION,
    source_file: sourceFile,
    source_sha256: sourceSha256,
    facts,
  });
  return Object.freeze({ payload, rejected_unprovenanced });
}

export function computeFounderWorkIndexHash(payload) {
  return sha256(stableStringify(payload));
}

function summarizeTruthLabels(facts) {
  const counts = Object.create(null);
  for (const fact of facts) {
    if (fact.kind !== "labeled_claim") continue;
    const label = fact.truth_label ?? fact.label ?? "UNKNOWN";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function summarizeFactKinds(facts) {
  const by_kind = Object.create(null);
  const structural_by_kind = Object.create(null);

  for (const fact of facts) {
    by_kind[fact.kind] = (by_kind[fact.kind] ?? 0) + 1;
    if (fact.kind === "structural") {
      const sk = fact.structural_kind ?? "unknown";
      structural_by_kind[sk] = (structural_by_kind[sk] ?? 0) + 1;
    }
  }

  return Object.freeze({
    by_kind: Object.freeze(by_kind),
    structural_by_kind: Object.freeze(structural_by_kind),
  });
}

export function buildFounderWorkIndexReport({
  sourceFile,
  sourceSha256,
  sourceText,
  offeredConsent = null,
  generatedAt = null,
  inputKind = "file",
}) {
  const expected_consent_phrase = expectedContentReadConsent(sourceFile);
  const consent_verified =
    typeof offeredConsent === "string" &&
    offeredConsent === expected_consent_phrase;

  if (inputKind !== "file") {
    return deepFreeze({
      schema: FOUNDER_WORK_INDEXER_SCHEMA,
      truth_label: FOUNDER_WORK_INDEX_TRUTH_LABEL,
      scope_label: FOUNDER_WORK_INDEXER_SCOPE,
      index_allowed: false,
      refused: true,
      reason_code: "invalid_input_kind",
      expected_consent_phrase,
      consent_verified: false,
      boundary: buildPreviewBoundary(),
      no_mint: true,
    });
  }

  if (!consent_verified) {
    return deepFreeze({
      schema: FOUNDER_WORK_INDEXER_SCHEMA,
      truth_label: FOUNDER_WORK_INDEX_TRUTH_LABEL,
      scope_label: FOUNDER_WORK_INDEXER_SCOPE,
      index_allowed: false,
      refused: true,
      reason_code:
        offeredConsent === null ? "consent_missing" : "consent_mismatch",
      expected_consent_phrase,
      consent_verified: false,
      boundary: buildPreviewBoundary(),
      no_mint: true,
    });
  }

  const { payload, rejected_unprovenanced } = buildFounderWorkIndexPayload({
    sourceFile,
    sourceSha256,
    sourceText,
  });
  const index_hash = computeFounderWorkIndexHash(payload);
  const truth_label_summary = summarizeTruthLabels(payload.facts);
  const fact_kind_summary = summarizeFactKinds(payload.facts);

  return deepFreeze({
    schema: FOUNDER_WORK_INDEXER_SCHEMA,
    truth_label: FOUNDER_WORK_INDEX_TRUTH_LABEL,
    scope_label: FOUNDER_WORK_INDEXER_SCOPE,
    index_allowed: true,
    refused: false,
    reason_code: null,
    expected_consent_phrase,
    consent_verified: true,
    payload,
    index_hash,
    generated_at: generatedAt,
    fact_count: payload.facts.length,
    rejected_unprovenanced,
    truth_label_summary,
    fact_kind_summary,
    no_mint: true,
    boundary: buildRuntimeEmissionBoundary({
      content_read: true,
      consent_collected: true,
      filesystem_write_performed: false,
    }),
  });
}

export function buildFounderWorkIndexReceiptEnvelope(report, { generatedAt }) {
  if (!report?.index_allowed || !report.payload) {
    throw new Error(
      "buildFounderWorkIndexReceiptEnvelope: report must be index_allowed with payload",
    );
  }
  return deepFreeze({
    schema: FOUNDER_WORK_INDEX_RECEIPT_SCHEMA,
    truth_label: FOUNDER_WORK_INDEX_TRUTH_LABEL,
    scope_label: FOUNDER_WORK_INDEXER_SCOPE,
    index_hash: report.index_hash,
    payload: report.payload,
    generated_at: generatedAt,
    fact_count: report.fact_count,
    rejected_unprovenanced: report.rejected_unprovenanced,
    truth_label_summary: report.truth_label_summary,
    fact_kind_summary: report.fact_kind_summary,
    no_mint: true,
    boundary: report.boundary,
  });
}

export function verifyFounderWorkIndexReport(report) {
  if (!report || typeof report !== "object") {
    return Object.freeze({ valid: false, reason: "missing_report" });
  }
  if (!report.index_allowed || !report.payload) {
    return Object.freeze({ valid: false, reason: "not_index_allowed" });
  }
  const recomputed = computeFounderWorkIndexHash(report.payload);
  if (recomputed !== report.index_hash) {
    return Object.freeze({
      valid: false,
      reason: "index_hash_mismatch",
      expected: recomputed,
      received: report.index_hash,
    });
  }
  for (const fact of report.payload.facts) {
    if (!hasValidLineSpan(fact.line_span) || !fact.file) {
      return Object.freeze({ valid: false, reason: "fact_missing_provenance" });
    }
  }
  if (report.no_mint !== true) {
    return Object.freeze({ valid: false, reason: "no_mint_not_true" });
  }
  return Object.freeze({ valid: true, index_hash: recomputed });
}
