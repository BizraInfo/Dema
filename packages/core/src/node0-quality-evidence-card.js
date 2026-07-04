// NODE0-QUALITY-EVIDENCE-CARD-1B — internal quality evidence card (not certification).
//
// Pure kernel: composes declared audit assessments with caller-supplied measured
// closeout evidence. Does not run tests, coverage, or git. Does not grade itself
// into a single sealed overall score.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_QUALITY_EVIDENCE_CARD_SCHEMA =
  "bizra.dema.node0_quality_evidence_card.v0.1";

export const NODE0_QUALITY_EVIDENCE_CARD_SCOPE = "NODE0-QUALITY-EVIDENCE-CARD-1B";

export const NODE0_QUALITY_EVIDENCE_CARD_TRUTH_LABEL =
  "INTERNAL_QUALITY_EVIDENCE_NOT_PRODUCTION_CERTIFICATION";

export const SELF_AUDIT_DISCLOSURE =
  "This is an internal evidence-based audit produced by an assistant working from public GitHub state, uploaded local logs, and conversation context. It is not an independent third-party security audit, not production certification, and not legal/compliance assurance. External review is required before production, financial, security, Shariah, or public-token claims.";

const DEFAULT_NOT_COMPARABLE_TO = Object.freeze([
  "externally audited fintech",
  "production security platform",
  "regulated financial infrastructure",
]);

const DEFAULT_ARCHITECTURE_SCORES = Object.freeze({
  design_architecture: Object.freeze({
    score: 90,
    truth_label: "DECLARED_INTERNAL_ASSESSMENT",
    rationale:
      "Consent, receipts, proof spine, truth labels, local-first posture are coherent.",
  }),
  measured_runtime_architecture: Object.freeze({
    score: 66,
    truth_label: "DECLARED_INTERNAL_ASSESSMENT",
    rationale:
      "N=1 local receipts and sandbox spine exist; activation, federation, PoI, token economy, and shared URP are not live.",
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeRotationReceipt(rotationReceipt) {
  if (rotationReceipt == null) return null;
  if (typeof rotationReceipt === "string" && rotationReceipt.length > 0) {
    return Object.freeze({ path: rotationReceipt });
  }
  if (typeof rotationReceipt === "object" && typeof rotationReceipt.path === "string") {
    return Object.freeze({ path: rotationReceipt.path });
  }
  return null;
}

export function resolveP0KeyCustodyStatus(rotationReceipt) {
  const normalized = normalizeRotationReceipt(rotationReceipt);
  if (normalized) {
    return Object.freeze({
      status: "CLOSED_ROTATION_RECEIPT_PRESENT",
      rotation_receipt: normalized,
    });
  }
  return Object.freeze({
    status: "OPEN_UNTIL_ROTATION_RECEIPT_EXISTS",
    rotation_receipt: null,
    resolution_requires: Object.freeze([
      "old key retired",
      "new key generated outside repo",
      "public verify artifact produced",
      "no secret material in repo/logs",
      "rotation receipt sealed",
    ]),
  });
}

export function buildCoverageField(coverageInput) {
  if (!coverageInput || coverageInput.lines == null) {
    return Object.freeze({
      coverage_percent: null,
      threshold_enforced: false,
      threshold_target_declared: "95/84/95",
      status: "MISSING_LOAD_BEARING_FIELD",
    });
  }

  const thresholdEnforced = coverageInput.threshold_enforced === true;
  return Object.freeze({
    coverage_percent: Object.freeze({
      lines: coverageInput.lines,
      branches: coverageInput.branches ?? null,
      functions: coverageInput.functions ?? null,
    }),
    threshold_enforced: thresholdEnforced,
    threshold_target_declared: "95/84/95",
    status: thresholdEnforced
      ? "MEASURED_THRESHOLD_BOUND"
      : "MEASURED_ADVISORY_NOT_THRESHOLD_BOUND",
  });
}

export function buildNode0QualityEvidenceCard({
  closeout = null,
  coverage = null,
  rotationReceipt = null,
  zeroDependencyOk = null,
  comparisonClass = "local-alpha AI tooling / zero-dependency CLI projects",
  notComparableTo = DEFAULT_NOT_COMPARABLE_TO,
  generatedAt = null,
} = {}) {
  const regression =
    closeout &&
    typeof closeout.commit_sha === "string" &&
    Number.isInteger(closeout.tests_total) &&
    Number.isInteger(closeout.tests_pass) &&
    Number.isInteger(closeout.tests_fail)
      ? Object.freeze({
          commit_sha: closeout.commit_sha,
          tests_total: closeout.tests_total,
          tests_pass: closeout.tests_pass,
          tests_fail: closeout.tests_fail,
          check_pass: closeout.check_pass === true,
          llm_guidance_pass: closeout.llm_guidance_pass === true,
          diff_check_clean: closeout.diff_check_clean === true,
          truth_label: "MEASURED_LOCAL_CLOSEOUT",
        })
      : Object.freeze({
          truth_label: "MISSING_LOAD_BEARING_FIELD",
        });

  const cardBody = Object.freeze({
    schema: NODE0_QUALITY_EVIDENCE_CARD_SCHEMA,
    truth_label: NODE0_QUALITY_EVIDENCE_CARD_TRUTH_LABEL,
    scope_label: NODE0_QUALITY_EVIDENCE_CARD_SCOPE,
    self_audit_disclosure: SELF_AUDIT_DISCLOSURE,
    audit_position: "INTERNAL_SELF_AUDIT",
    external_audit_status: "NOT_PERFORMED",
    production_certification: false,
    architecture_scores: DEFAULT_ARCHITECTURE_SCORES,
    scores_disclaimer:
      "Architecture scores are DECLARED internal assessments, not measured proof. No overall grade is sealed.",
    regression_evidence: regression,
    coverage: buildCoverageField(coverage),
    p0_key_custody: resolveP0KeyCustodyStatus(rotationReceipt),
    zero_dependency:
      zeroDependencyOk === true
        ? Object.freeze({
            ok: true,
            truth_label: "MEASURED_FROM_PACKAGE_JSON",
          })
        : zeroDependencyOk === false
          ? Object.freeze({
              ok: false,
              truth_label: "MEASURED_FROM_PACKAGE_JSON",
            })
          : Object.freeze({ ok: null, truth_label: "MISSING_LOAD_BEARING_FIELD" }),
    comparison_class: comparisonClass,
    not_comparable_to: Object.freeze([...notComparableTo]),
    no_mint: true,
    boundary: buildPreviewBoundary(),
    generated_at: generatedAt,
  });

  const card_hash = sha256(stableStringify(cardBody));
  return deepFreeze({ ...cardBody, card_hash });
}

export function formatNode0QualityEvidenceCard(card) {
  const lines = [
    "DEMA · NODE0 QUALITY EVIDENCE CARD (INTERNAL — NOT CERTIFICATION)",
    "",
    card.self_audit_disclosure,
    "",
    `audit_position: ${card.audit_position}`,
    `external_audit_status: ${card.external_audit_status}`,
    `production_certification: ${card.production_certification}`,
    "",
    "Architecture scores (DECLARED internal assessment — not measured proof):",
    `  design_architecture: ${card.architecture_scores.design_architecture.score}`,
    `  measured_runtime_architecture: ${card.architecture_scores.measured_runtime_architecture.score}`,
    "",
    "Regression evidence:",
    JSON.stringify(card.regression_evidence, null, 2),
    "",
    "Coverage:",
    JSON.stringify(card.coverage, null, 2),
    "",
    "P0 key custody:",
    JSON.stringify(card.p0_key_custody, null, 2),
    "",
    `comparison_class: ${card.comparison_class}`,
    `not_comparable_to: ${card.not_comparable_to.join("; ")}`,
    "",
    `no_mint: ${card.no_mint}`,
    `card_hash: ${card.card_hash}`,
    "",
    "Boundary: internal audit artifact · no production claim · no external audit claim.",
  ];
  return lines.join("\n");
}
