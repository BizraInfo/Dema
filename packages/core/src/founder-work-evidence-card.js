// PEAK-RECEIPT-REVIEW-1A — digest a sealed founder-work index receipt into an
// evidence card. Read-only: no fs in kernel; CLI loads receipt JSON.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  FOUNDER_WORK_INDEX_RECEIPT_SCHEMA,
  verifyFounderWorkIndexReport,
} from "./founder-work-indexer.js";

export const FOUNDER_WORK_EVIDENCE_CARD_SCHEMA =
  "bizra.dema.founder_work_evidence_card.v0.1";

export const FOUNDER_WORK_EVIDENCE_CARD_SCOPE = "PEAK-RECEIPT-REVIEW-1A";

export const FOUNDER_WORK_EVIDENCE_CARD_TRUTH_LABEL =
  "FOUNDER_WORK_EVIDENCE_CARD_NOT_IMPACT_VERIFIED";

const AUTHOR_LABEL_PRIORITY = Object.freeze({
  VERIFIED: 0,
  MEASURED: 1,
  DECLARED: 2,
  UNKNOWN: 3,
  PLANNED: 4,
  DESIGNED_NOT_LIVE: 5,
});

const LOAD_BEARING_TERMS = Object.freeze([
  "undo-proven",
  "node0_governed_action",
  "receipt",
  "boundary",
  "proof",
  "dema",
  "node0",
  "founder",
  "index_hash",
  "content_read",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function truncateQuote(quote, max = 220) {
  if (typeof quote !== "string") return "";
  const trimmed = quote.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function scoreLabeledClaim(claim) {
  const label = claim.label ?? claim.truth_label ?? "UNKNOWN";
  const base = AUTHOR_LABEL_PRIORITY[label] ?? 99;
  const haystack = (claim.quote ?? "").toLowerCase();
  let bonus = 0;
  for (const term of LOAD_BEARING_TERMS) {
    if (haystack.includes(term)) bonus -= 2;
  }
  return base + bonus;
}

export function summarizeFactKinds(facts) {
  const by_kind = Object.create(null);
  const structural_by_kind = Object.create(null);
  const author_assertion_truth_labels = Object.create(null);

  for (const fact of facts) {
    by_kind[fact.kind] = (by_kind[fact.kind] ?? 0) + 1;
    if (fact.kind === "structural") {
      const sk = fact.structural_kind ?? "unknown";
      structural_by_kind[sk] = (structural_by_kind[sk] ?? 0) + 1;
    }
    if (fact.kind === "labeled_claim") {
      const label = fact.truth_label ?? fact.label ?? "UNKNOWN";
      author_assertion_truth_labels[label] =
        (author_assertion_truth_labels[label] ?? 0) + 1;
    }
  }

  return deepFreeze({
    by_kind: Object.freeze(by_kind),
    structural_by_kind: Object.freeze(structural_by_kind),
    author_assertion_truth_labels: Object.freeze(author_assertion_truth_labels),
  });
}

export function buildFounderWorkEvidenceCard(envelope, { topClaimsLimit = 12 } = {}) {
  if (!envelope || envelope.schema !== FOUNDER_WORK_INDEX_RECEIPT_SCHEMA) {
    throw new Error("buildFounderWorkEvidenceCard: invalid receipt envelope");
  }
  if (envelope.no_mint !== true) {
    throw new Error("buildFounderWorkEvidenceCard: receipt must have no_mint true");
  }

  const report = {
    index_allowed: true,
    payload: envelope.payload,
    index_hash: envelope.index_hash,
    fact_count: envelope.fact_count,
    rejected_unprovenanced: envelope.rejected_unprovenanced,
    no_mint: true,
  };
  const verified = verifyFounderWorkIndexReport(report);
  if (!verified.valid) {
    throw new Error(`buildFounderWorkEvidenceCard: ${verified.reason}`);
  }

  const facts = envelope.payload?.facts ?? [];
  const kind_summary = summarizeFactKinds(facts);

  const lexical_anchors = facts
    .filter((f) => f.kind === "lexical_anchor")
    .map((f) =>
      Object.freeze({
        term: f.term,
        count: f.count,
        line_span: f.line_span,
      }),
    )
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

  const labeled_claims = facts.filter((f) => f.kind === "labeled_claim");
  const top_founder_claims = [...labeled_claims]
    .sort((a, b) => scoreLabeledClaim(a) - scoreLabeledClaim(b))
    .slice(0, topClaimsLimit)
    .map((claim) =>
      Object.freeze({
        label: claim.label,
        quote: truncateQuote(claim.quote),
        line_span: claim.line_span,
        file: claim.file,
      }),
    );

  const structural_count = kind_summary.by_kind.structural ?? 0;
  const lexical_count = kind_summary.by_kind.lexical_anchor ?? 0;
  const labeled_count = kind_summary.by_kind.labeled_claim ?? 0;
  const navigation_structural =
    (kind_summary.structural_by_kind.turn_marker ?? 0) +
    (kind_summary.structural_by_kind.code_fence ?? 0);

  const signal_assessment = Object.freeze({
    total_facts: facts.length,
    structural_facts: structural_count,
    lexical_anchor_facts: lexical_count,
    labeled_claim_facts: labeled_count,
    navigation_structural_facts: navigation_structural,
    high_signal_facts: lexical_count + labeled_count,
    navigation_ratio:
      facts.length === 0 ? 0 : navigation_structural / facts.length,
    labeled_claim_ratio:
      facts.length === 0 ? 0 : labeled_count / facts.length,
    assessment:
      labeled_count >= 1
        ? "labeled_claims_present"
        : "structural_and_lexical_only",
  });

  const card = deepFreeze({
    schema: FOUNDER_WORK_EVIDENCE_CARD_SCHEMA,
    truth_label: FOUNDER_WORK_EVIDENCE_CARD_TRUTH_LABEL,
    scope_label: FOUNDER_WORK_EVIDENCE_CARD_SCOPE,
    source_file: envelope.payload.source_file,
    source_sha256: envelope.payload.source_sha256,
    index_hash: envelope.index_hash,
    fact_count: envelope.fact_count,
    rejected_unprovenanced: envelope.rejected_unprovenanced,
    no_mint: true,
    kind_summary,
    lexical_anchors: Object.freeze(lexical_anchors),
    author_assertion_truth_labels: kind_summary.author_assertion_truth_labels,
    top_founder_claims,
    signal_assessment,
    receipt_generated_at: envelope.generated_at ?? null,
  });

  const card_hash = sha256(stableStringify(card));
  return Object.freeze({ ...card, card_hash });
}

export function formatFounderWorkEvidenceCard(card) {
  const lines = [
    "DEMA · FOUNDER WORK EVIDENCE CARD",
    "",
    `source: ${card.source_file}`,
    `index_hash: ${card.index_hash}`,
    `facts: ${card.fact_count} (rejected_unprovenanced: ${card.rejected_unprovenanced})`,
    `no_mint: ${card.no_mint}`,
    "",
    "Facts by kind:",
    ...Object.entries(card.kind_summary.by_kind).map(
      ([kind, count]) => `  ${kind}: ${count}`,
    ),
    "",
    "Author assertion truth-labels (labeled_claim only):",
    ...Object.entries(card.author_assertion_truth_labels).map(
      ([label, count]) => `  ${label}: ${count}`,
    ),
    "",
    "Top lexical anchors:",
    ...card.lexical_anchors.slice(0, 10).map(
      (a) => `  ${a.term}: ${a.count} (lines ${a.line_span.start}-${a.line_span.end})`,
    ),
    "",
    "Top founder claims:",
    ...card.top_founder_claims.map(
      (c, i) =>
        `  ${i + 1}. [${c.label}] L${c.line_span.start}: ${c.quote}`,
    ),
    "",
    `Signal: ${card.signal_assessment.assessment} · navigation_ratio=${card.signal_assessment.navigation_ratio.toFixed(3)} · labeled_claim_ratio=${card.signal_assessment.labeled_claim_ratio.toFixed(3)}`,
    "",
    "Boundary: read-only receipt digest · no model · no network · no mint.",
  ];
  return lines.join("\n");
}
