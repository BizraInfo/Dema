/**
 * PROOF-OF-SPEND-1A — provenance-bound financial row facts + verifiable cost claims.
 * PREVIEW_ONLY · reuses FWI finalizeFactCandidates · no model · no network · no_mint.
 * truth_label: FOUNDER_COST_MEASURED_NOT_VALUE (cost ≠ value).
 */

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  buildPreviewBoundary,
  buildRuntimeEmissionBoundary,
} from "./preview-boundary.js";
import {
  expectedContentReadConsent,
  finalizeFactCandidates,
} from "./founder-work-indexer.js";

export { expectedContentReadConsent };

export const PROOF_OF_SPEND_INDEXER_TOOL = "proof-of-spend-1a";
export const PROOF_OF_SPEND_INDEXER_VERSION = "0.1";
export const PROOF_OF_SPEND_INDEXER_SCHEMA =
  "bizra.dema.proof_of_spend_indexer.v0.1";
export const PROOF_OF_SPEND_RECEIPT_SCHEMA =
  "bizra.dema.proof_of_spend_receipt.v0.1";
export const PROOF_OF_SPEND_TRUTH_LABEL = "FOUNDER_COST_MEASURED_NOT_VALUE";
export const PROOF_OF_SPEND_SCOPE =
  "single_csv_financial_source_read_under_exact_consent";

/** Six-month plan divisor when source rows are labeled as 6-month recurring totals. */
export const PROOF_OF_SPEND_PLAN_MONTHS = 6;

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

function hasValidLineSpan(lineSpan) {
  return (
    lineSpan &&
    typeof lineSpan.start === "number" &&
    typeof lineSpan.end === "number" &&
    lineSpan.start >= 1 &&
    lineSpan.end >= lineSpan.start
  );
}

function normalizeHeaderCell(cell) {
  return String(cell ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/**
 * Minimal RFC4180-style CSV row parse (quoted fields, commas).
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvRow(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

/**
 * Parse USD display strings to integer cents. "Free" → 0.
 * @param {string} raw
 * @returns {number|null} null if unparseable non-free
 */
export function parseUsdCents(raw) {
  const trimmed = String(raw ?? "").trim();
  if (trimmed.length === 0) return 0;
  if (/^free$/i.test(trimmed)) return 0;
  const normalized = trimmed.replace(/^\$/, "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  const cents =
    Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isFinite(cents) || cents < 0) return null;
  return cents;
}

function findColumnIndex(headers, ...names) {
  const normalized = headers.map(normalizeHeaderCell);
  for (const name of names) {
    const idx = normalized.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

function isSummaryRow(category, item) {
  const c = String(category ?? "").trim().toUpperCase();
  const i = String(item ?? "").trim().toLowerCase();
  return c === "SUMMARY" || i.includes("total (") || i.includes("total(");
}

/**
 * @param {object} params
 * @param {string} params.sourceFile
 * @param {string} params.sourceText
 */
export function extractSpendRowFacts({ sourceFile, sourceText }) {
  if (typeof sourceFile !== "string" || sourceFile.length === 0) {
    throw new Error("extractSpendRowFacts: sourceFile is required");
  }
  if (typeof sourceText !== "string") {
    throw new Error("extractSpendRowFacts: sourceText must be a string");
  }

  const lines = sourceText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return finalizeFactCandidates([], sourceFile);
  }

  const headerFields = parseCsvRow(lines[0]);
  const categoryIdx = findColumnIndex(headerFields, "category");
  const itemIdx = findColumnIndex(headerFields, "item");
  const costIdx = findColumnIndex(
    headerFields,
    "estimated_cost",
    "cost",
    "amount",
  );
  const typeIdx = findColumnIndex(headerFields, "type");
  const priorityIdx = findColumnIndex(headerFields, "priority");
  const notesIdx = findColumnIndex(headerFields, "notes");

  if (costIdx < 0) {
    throw new Error("extractSpendRowFacts: missing cost column (estimated_cost)");
  }

  const candidates = [];
  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const fields = parseCsvRow(lines[i]);
    const category = categoryIdx >= 0 ? fields[categoryIdx] ?? "" : "";
    const item = itemIdx >= 0 ? fields[itemIdx] ?? "" : "";
    if (isSummaryRow(category, item)) continue;

    const rawCost = fields[costIdx] ?? "";
    const costCents = parseUsdCents(rawCost);
    if (costCents === null) continue;

    const spendType =
      typeIdx >= 0 ? String(fields[typeIdx] ?? "").trim() : "";
    const normalizedType = spendType.toLowerCase();

    candidates.push({
      kind: "transaction_row",
      category: String(category).trim(),
      item: String(item).trim(),
      spend_type: spendType,
      estimated_cost_usd_cents: costCents,
      raw_estimated_cost: String(rawCost).trim(),
      priority: priorityIdx >= 0 ? String(fields[priorityIdx] ?? "").trim() : "",
      notes: notesIdx >= 0 ? String(fields[notesIdx] ?? "").trim() : "",
      file: sourceFile,
      line_span: { start: lineNo, end: lineNo },
    });
  }

  return finalizeFactCandidates(candidates, sourceFile);
}

/**
 * @param {readonly object[]} facts
 */
export function computeSpendClaims(facts) {
  const transactionFacts = facts.filter((f) => f.kind === "transaction_row");
  let totalRecurringUsdCents = 0;
  let totalOneTimeUsdCents = 0;
  const recurringLineSpans = [];

  for (const fact of transactionFacts) {
    const type = String(fact.spend_type ?? "").toLowerCase();
    const cents = fact.estimated_cost_usd_cents ?? 0;
    if (type === "recurring") {
      totalRecurringUsdCents += cents;
      if (hasValidLineSpan(fact.line_span)) {
        recurringLineSpans.push({ ...fact.line_span });
      }
    } else if (type === "one-time" || type === "one time") {
      totalOneTimeUsdCents += cents;
    }
  }

  const monthlyRecurringBurnUsdCents = Math.floor(
    totalRecurringUsdCents / PROOF_OF_SPEND_PLAN_MONTHS,
  );

  return Object.freeze([
    Object.freeze({
      claim_id: "monthly_recurring_burn_usd_cents",
      value: monthlyRecurringBurnUsdCents,
      unit: "usd_cents",
      formula: `floor(sum(recurring.estimated_cost_usd_cents) / ${PROOF_OF_SPEND_PLAN_MONTHS})`,
      provenance_line_spans: Object.freeze([...recurringLineSpans]),
      verifiable: true,
      disclaimer:
        "Measured estimated recurring plan cost amortized — not verified bank spend or economic value.",
    }),
    Object.freeze({
      claim_id: "total_recurring_plan_usd_cents",
      value: totalRecurringUsdCents,
      unit: "usd_cents",
      formula: "sum(recurring.estimated_cost_usd_cents)",
      provenance_line_spans: Object.freeze([...recurringLineSpans]),
      verifiable: true,
      disclaimer:
        "Sum of rows labeled Recurring in source — plan estimate, not ledger truth.",
    }),
    Object.freeze({
      claim_id: "total_one_time_usd_cents",
      value: totalOneTimeUsdCents,
      unit: "usd_cents",
      formula: "sum(one-time.estimated_cost_usd_cents)",
      provenance_line_spans: Object.freeze(
        transactionFacts
          .filter((f) =>
            ["one-time", "one time"].includes(
              String(f.spend_type ?? "").toLowerCase(),
            ),
          )
          .filter((f) => hasValidLineSpan(f.line_span))
          .map((f) => ({ ...f.line_span })),
      ),
      verifiable: true,
      disclaimer:
        "Sum of rows labeled One-time in source — estimate only.",
    }),
  ]);
}

export function buildProofOfSpendPayload({
  sourceFile,
  sourceSha256,
  sourceText,
}) {
  const { facts, rejected_unprovenanced } = extractSpendRowFacts({
    sourceFile,
    sourceText,
  });
  const claims = computeSpendClaims(facts);
  const payload = Object.freeze({
    tool: PROOF_OF_SPEND_INDEXER_TOOL,
    version: PROOF_OF_SPEND_INDEXER_VERSION,
    source_file: sourceFile,
    source_sha256: sourceSha256,
    facts,
    claims,
    plan_months: PROOF_OF_SPEND_PLAN_MONTHS,
  });
  return Object.freeze({ payload, rejected_unprovenanced });
}

export function computeProofOfSpendHash(payload) {
  return sha256(stableStringify(payload));
}

export function verifyConsentPhrase({ sourceFile, offeredConsent }) {
  const expected = expectedContentReadConsent(sourceFile);
  if (offeredConsent === null || offeredConsent === undefined) {
    return Object.freeze({
      consent_verified: false,
      expected_consent_phrase: expected,
      reason_code: "consent_missing",
    });
  }
  if (typeof offeredConsent !== "string") {
    return Object.freeze({
      consent_verified: false,
      expected_consent_phrase: expected,
      reason_code: "invalid_input_kind",
    });
  }
  if (offeredConsent !== expected) {
    return Object.freeze({
      consent_verified: false,
      expected_consent_phrase: expected,
      reason_code: "consent_mismatch",
    });
  }
  return Object.freeze({
    consent_verified: true,
    expected_consent_phrase: expected,
    reason_code: null,
  });
}

export function buildProofOfSpendReport({
  sourceFile,
  sourceSha256,
  sourceText,
  offeredConsent,
  generatedAt = new Date().toISOString(),
}) {
  const expected_consent_phrase = expectedContentReadConsent(sourceFile);
  const consent = verifyConsentPhrase({ sourceFile, offeredConsent });

  if (
    typeof sourceFile !== "string" ||
    typeof sourceSha256 !== "string" ||
    typeof sourceText !== "string"
  ) {
    return deepFreeze({
      schema: PROOF_OF_SPEND_INDEXER_SCHEMA,
      truth_label: PROOF_OF_SPEND_TRUTH_LABEL,
      scope_label: PROOF_OF_SPEND_SCOPE,
      index_allowed: false,
      refused: true,
      reason_code: "invalid_input_kind",
      expected_consent_phrase,
      consent_verified: false,
      boundary: buildPreviewBoundary(),
      no_mint: true,
    });
  }

  if (!consent.consent_verified) {
    return deepFreeze({
      schema: PROOF_OF_SPEND_INDEXER_SCHEMA,
      truth_label: PROOF_OF_SPEND_TRUTH_LABEL,
      scope_label: PROOF_OF_SPEND_SCOPE,
      index_allowed: false,
      refused: true,
      reason_code: consent.reason_code,
      expected_consent_phrase,
      consent_verified: false,
      boundary: buildPreviewBoundary(),
      no_mint: true,
    });
  }

  const { payload, rejected_unprovenanced } = buildProofOfSpendPayload({
    sourceFile,
    sourceSha256,
    sourceText,
  });
  const index_hash = computeProofOfSpendHash(payload);
  const primaryClaim =
    payload.claims.find((c) => c.claim_id === "monthly_recurring_burn_usd_cents") ??
    null;

  return deepFreeze({
    schema: PROOF_OF_SPEND_INDEXER_SCHEMA,
    truth_label: PROOF_OF_SPEND_TRUTH_LABEL,
    scope_label: PROOF_OF_SPEND_SCOPE,
    index_allowed: true,
    refused: false,
    reason_code: null,
    expected_consent_phrase,
    consent_verified: true,
    payload,
    index_hash,
    generated_at: generatedAt,
    fact_count: payload.facts.length,
    claim_count: payload.claims.length,
    primary_claim: primaryClaim,
    rejected_unprovenanced,
    no_mint: true,
    boundary: buildRuntimeEmissionBoundary({
      content_read: true,
      consent_collected: true,
      filesystem_write_performed: false,
    }),
  });
}

export function buildProofOfSpendReceiptEnvelope(report, { generatedAt }) {
  if (!report?.index_allowed || !report.payload) {
    throw new Error(
      "buildProofOfSpendReceiptEnvelope: report must be index_allowed with payload",
    );
  }
  return deepFreeze({
    schema: PROOF_OF_SPEND_RECEIPT_SCHEMA,
    truth_label: PROOF_OF_SPEND_TRUTH_LABEL,
    scope_label: PROOF_OF_SPEND_SCOPE,
    index_hash: report.index_hash,
    payload: report.payload,
    generated_at: generatedAt,
    fact_count: report.fact_count,
    claim_count: report.claim_count,
    primary_claim: report.primary_claim,
    rejected_unprovenanced: report.rejected_unprovenanced,
    no_mint: true,
    boundary: report.boundary,
  });
}

function recomputeClaimsFromFacts(facts) {
  return computeSpendClaims(facts);
}

export function verifyProofOfSpendReport(report) {
  if (!report || typeof report !== "object") {
    return Object.freeze({ valid: false, reason: "missing_report" });
  }
  if (!report.index_allowed || !report.payload) {
    return Object.freeze({ valid: false, reason: "not_index_allowed" });
  }
  if (report.truth_label !== PROOF_OF_SPEND_TRUTH_LABEL) {
    return Object.freeze({ valid: false, reason: "truth_label_mismatch" });
  }
  const recomputed = computeProofOfSpendHash(report.payload);
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
  const claimsCheck = recomputeClaimsFromFacts(report.payload.facts);
  const claimsJson = stableStringify(claimsCheck);
  const payloadClaimsJson = stableStringify(report.payload.claims);
  if (claimsJson !== payloadClaimsJson) {
    return Object.freeze({ valid: false, reason: "claims_not_verifiable" });
  }
  if (report.no_mint !== true) {
    return Object.freeze({ valid: false, reason: "no_mint_not_true" });
  }
  return Object.freeze({ valid: true, index_hash: recomputed });
}

export function serializeProofOfSpendForSave(envelope, { pretty = false } = {}) {
  if (pretty) return `${JSON.stringify(envelope, null, 2)}\n`;
  return `${JSON.stringify(envelope)}\n`;
}
