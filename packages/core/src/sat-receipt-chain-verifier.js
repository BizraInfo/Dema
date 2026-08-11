// C5 · SAT-4 · Receipt Chain Verifier (per ADR-008 §C5).
//
// Verifies receipt-chain integrity. Each receipt has a content hash and
// (when applicable) a prev_hash linking to the previous receipt. SAT-4
// verifies the chain links match · checks for forgery · detects gaps.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.sat_receipt_chain_verifier.v0.1";
const VERDICT_SCHEMA = "bizra.dema.receipt_chain_verdict.v0.1";

const SAT4_PERSONA = Object.freeze({
  sat_number: 4,
  sat_id: "sat-4-receipt-chain-verifier",
  role_name: "receipt_chain_verifier",
  role_description:
    "Verifies receipt chain integrity: every receipt has a 64-char hex hash · " +
    "prev_hash chain links correctly · no gaps · no forgery. NEVER modifies " +
    "receipts · NEVER waives chain verification · NEVER infers prev_hash.",
  primary_capabilities: Object.freeze([
    "verify_receipt_hash_format",
    "verify_chain_link_integrity",
    "detect_chain_gaps",
    "report_specific_chain_violations",
  ]),
  primary_refusals: Object.freeze([
    "modify_receipts",
    "waive_chain_verification",
    "infer_missing_prev_hash",
    "approve_partial_chain",
  ]),
});

const SAT4_EFFECT_CAP_ALLOWED = Object.freeze([
  "read_local_file",
  "compute_hash",
  "render_terminal_output",
]);
const SAT4_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "modify_receipt",
  "waive_chain_verification",
  "infer_prev_hash",
]);
const SAT4_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke SAT-4 receipt_chain_verifier to verify";

const HASH_REGEX = /^[a-f0-9]{64}$/;

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function buildSATReceiptChainVerifierEffectCap() {
  return buildEffectCap({
    name: "sat_receipt_chain_verifier",
    description: SAT4_PERSONA.role_description,
    allowed_effects: SAT4_EFFECT_CAP_ALLOWED,
    blocked_effects: SAT4_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: SAT4_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildSATReceiptChainVerifierPreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: SAT4_PERSONA,
    effect_cap: buildSATReceiptChainVerifierEffectCap(),
    consent_phrase_template: SAT4_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${SAT4_PERSONA.sat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    hash_format: "sha256_hex_64_chars",
    refusal_invariants: Object.freeze([
      "SAT-4 never modifies a receipt · examination is read-only",
      "SAT-4 never waives chain verification",
      "SAT-4 never infers a missing prev_hash · gap is named honestly",
      "SAT-4 never approves a partial chain · all links must verify",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildSATReceiptChainVerifierKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: SAT4_PERSONA.sat_id,
    agent_role: "sat_receipt_chain_verifier",
    mission_intent: typeof mission_intent === "string" ? mission_intent : "",
    max_iterations,
  });
}

// Verify a chain of receipts. Returns verdict with specific link failures.
export function verifyReceiptChain({ receipts = [] } = {}) {
  const list = safeArray(receipts).filter((r) => r && typeof r === "object");
  const violations = [];
  const linkResults = [];

  // NO_VACUOUS_PROOF: absence is not a verified chain. An empty input cannot
  // establish integrity because there is no receipt, link, or genesis fact to
  // inspect. Preserve the distinct empty_chain verdict, but never promote it to
  // MEASURED or receipt-ready proof.
  if (list.length === 0) {
    return buildVerdict({
      verdict: "empty_chain",
      passed: false,
      receipt_count: 0,
      violations: ["chain_is_empty_no_proof"],
      link_results: [],
    });
  }

  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const hash =
      typeof r.receipt_id === "string"
        ? r.receipt_id
        : typeof r.candidate_hash === "string"
          ? r.candidate_hash
          : typeof r.content_hash === "string"
            ? r.content_hash
            : null;
    const prevHash =
      typeof r.prev_hash === "string"
        ? r.prev_hash
        : typeof r.prev_receipt_hash === "string"
          ? r.prev_receipt_hash
          : null;

    const linkResult = {
      index: i,
      hash,
      prev_hash: prevHash,
      hash_format_valid: hash !== null && HASH_REGEX.test(hash),
      prev_hash_format_valid:
        prevHash === null ||
        prevHash === "genesis" ||
        HASH_REGEX.test(prevHash),
      links_to_previous: false,
      issues: [],
    };

    if (hash === null) {
      linkResult.issues.push("no_hash_field");
    } else if (!linkResult.hash_format_valid) {
      linkResult.issues.push(`invalid_hash_format · '${hash}'`);
    }

    if (prevHash && !linkResult.prev_hash_format_valid) {
      linkResult.issues.push(`invalid_prev_hash_format · '${prevHash}'`);
    }

    if (i > 0) {
      const expectedPrev =
        list[i - 1].receipt_id ||
        list[i - 1].candidate_hash ||
        list[i - 1].content_hash;
      if (prevHash === null) {
        linkResult.issues.push("missing_prev_hash_for_non_genesis_receipt");
      } else if (prevHash !== expectedPrev) {
        linkResult.issues.push(
          `prev_hash_mismatch · expected '${expectedPrev}' · got '${prevHash}'`,
        );
      } else {
        linkResult.links_to_previous = true;
      }
    } else {
      // Genesis receipt: prev_hash should be null OR explicitly "genesis"
      if (prevHash !== null && prevHash !== "genesis") {
        linkResult.issues.push(
          `unexpected_prev_hash_on_genesis · got '${prevHash}'`,
        );
      }
    }

    if (linkResult.issues.length > 0) {
      violations.push(`receipt[${i}] · ${linkResult.issues.join(" · ")}`);
    }
    linkResults.push(
      Object.freeze({
        ...linkResult,
        issues: Object.freeze(linkResult.issues),
      }),
    );
  }

  const passed = violations.length === 0;
  return buildVerdict({
    verdict: passed ? "chain_verified" : "chain_violated",
    passed,
    receipt_count: list.length,
    violations,
    link_results: linkResults,
  });
}

function buildVerdict({
  verdict,
  passed,
  receipt_count,
  violations,
  link_results,
}) {
  return Object.freeze({
    schema: VERDICT_SCHEMA,
    truth_label:
      verdict === "empty_chain"
        ? "UNKNOWN"
        : passed
          ? "MEASURED"
          : "CHAIN_VIOLATION",
    mode: "verdict",
    verified_by: SAT4_PERSONA.sat_id,
    verified_at: new Date().toISOString(),
    receipt_count,
    verdict,
    passed,
    violations: Object.freeze(violations),
    link_results: Object.freeze(link_results),
    audit_trail_required: true,
    receipt_shape_ready: passed,
    boundary: buildPreviewBoundary(),
  });
}

export function buildSATReceiptChainVerifierSummary() {
  const preview = buildSATReceiptChainVerifierPreview();
  return Object.freeze({
    schema: "bizra.dema.sat_receipt_chain_verifier_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    sat_number: preview.persona.sat_number,
    role_name: preview.persona.role_name,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    boundary: preview.boundary,
  });
}

export const SAT_RECEIPT_CHAIN_VERIFIER_SCHEMA_NAME = SCHEMA;
export const SAT_RECEIPT_CHAIN_VERIFIER_VERDICT_SCHEMA_NAME = VERDICT_SCHEMA;
export const SAT_RECEIPT_CHAIN_VERIFIER_PERSONA = SAT4_PERSONA;
