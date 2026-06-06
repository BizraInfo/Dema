// C6 · Multi-Agent Orchestrator (per ADR-008 §C6).
//
// The glue between 7 PATs + 5 SATs + operator. Coordinates:
//   - Agent registry (PATs + SATs by id)
//   - Verification pipeline (run SATs in sequence on PAT drafts)
//   - Unified verdict (aggregate per-SAT verdicts into one shape)
//   - Consent-bounded routing (no SAT runs without operator-typed scope)
//
// Pure-function v0.1 · message-bus pattern as data structures · no I/O.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildPATMissionScribePreview,
  buildPATMissionScribeEffectCap,
} from "./pat-mission-scribe.js";
import {
  buildPATResearchCompanionPreview,
  buildPATResearchCompanionEffectCap,
} from "./pat-research-companion.js";
import {
  buildPATCodeApprenticePreview,
  buildPATCodeApprenticeEffectCap,
} from "./pat-code-apprentice.js";
import {
  buildPATMemoryCuratorPreview,
  buildPATMemoryCuratorEffectCap,
} from "./pat-memory-curator.js";
import {
  buildPATConsentDrafterPreview,
  buildPATConsentDrafterEffectCap,
} from "./pat-consent-drafter.js";
import {
  buildPATReceiptRecorderPreview,
  buildPATReceiptRecorderEffectCap,
} from "./pat-receipt-recorder.js";
import {
  buildPATReflectionWitnessPreview,
  buildPATReflectionWitnessEffectCap,
} from "./pat-reflection-witness.js";
import {
  buildSATBoundaryVerifierPreview,
  verifyArtifactBoundary,
} from "./sat-boundary-verifier.js";
import {
  buildSATConsentAuditorPreview,
  auditAction,
} from "./sat-consent-auditor.js";
import {
  buildSATDoctrineCompliancePreview,
  auditArtifactDoctrine,
} from "./sat-doctrine-compliance.js";
import {
  buildSATReceiptChainVerifierPreview,
  verifyReceiptChain,
} from "./sat-receipt-chain-verifier.js";
import {
  buildSATIdentityVerifierPreview,
  verifyIdentity,
} from "./sat-identity-verifier.js";

const SCHEMA = "bizra.dema.multi_agent_orchestrator.v0.1";
const VERIFICATION_PIPELINE_SCHEMA =
  "bizra.dema.orchestrator_verification_pipeline.v0.1";

const PAT_IDS = Object.freeze([
  "pat-1-mission-scribe",
  "pat-2-research-companion",
  "pat-3-code-apprentice",
  "pat-4-memory-curator",
  "pat-5-consent-drafter",
  "pat-6-receipt-recorder",
  "pat-7-reflection-witness",
]);

const SAT_IDS = Object.freeze([
  "sat-1-boundary-verifier",
  "sat-2-consent-auditor",
  "sat-3-doctrine-compliance",
  "sat-4-receipt-chain-verifier",
  "sat-5-identity-verifier",
]);

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "execute_runtime_without_pipeline",
  "skip_sat_verification",
  "approve_pat_proposal_without_operator_consent",
  "auto_resolve_pat_sat_conflict_without_operator",
  "chain_advance_without_full_verification",
  "federation_invocation",
  "mint_without_consent",
  "modify_agent_personas",
]);

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function buildPatRegistry() {
  return Object.freeze({
    "pat-1-mission-scribe": {
      preview: buildPATMissionScribePreview(),
      effect_cap: buildPATMissionScribeEffectCap(),
    },
    "pat-2-research-companion": {
      preview: buildPATResearchCompanionPreview(),
      effect_cap: buildPATResearchCompanionEffectCap(),
    },
    "pat-3-code-apprentice": {
      preview: buildPATCodeApprenticePreview(),
      effect_cap: buildPATCodeApprenticeEffectCap(),
    },
    "pat-4-memory-curator": {
      preview: buildPATMemoryCuratorPreview(),
      effect_cap: buildPATMemoryCuratorEffectCap(),
    },
    "pat-5-consent-drafter": {
      preview: buildPATConsentDrafterPreview(),
      effect_cap: buildPATConsentDrafterEffectCap(),
    },
    "pat-6-receipt-recorder": {
      preview: buildPATReceiptRecorderPreview(),
      effect_cap: buildPATReceiptRecorderEffectCap(),
    },
    "pat-7-reflection-witness": {
      preview: buildPATReflectionWitnessPreview(),
      effect_cap: buildPATReflectionWitnessEffectCap(),
    },
  });
}

function buildSatRegistry() {
  return Object.freeze({
    "sat-1-boundary-verifier": { preview: buildSATBoundaryVerifierPreview() },
    "sat-2-consent-auditor": { preview: buildSATConsentAuditorPreview() },
    "sat-3-doctrine-compliance": {
      preview: buildSATDoctrineCompliancePreview(),
    },
    "sat-4-receipt-chain-verifier": {
      preview: buildSATReceiptChainVerifierPreview(),
    },
    "sat-5-identity-verifier": { preview: buildSATIdentityVerifierPreview() },
  });
}

export function buildMultiAgentOrchestrator() {
  const patRegistry = buildPatRegistry();
  const satRegistry = buildSatRegistry();

  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    pat_count: PAT_IDS.length,
    sat_count: SAT_IDS.length,
    pat_ids: PAT_IDS,
    sat_ids: SAT_IDS,
    pat_registry: patRegistry,
    sat_registry: satRegistry,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    routing_law: Object.freeze([
      "Every PAT proposal is piped through SAT verification before action",
      "SAT-1 (boundary) runs first · refuse non-canonical artifacts immediately",
      "SAT-3 (doctrine) runs next · refuse non-compliant claims",
      "SAT-2 (consent) runs before any L3+ action",
      "SAT-5 (identity) runs at session boundaries",
      "SAT-4 (chain) runs before receipt mint (C12 territory)",
      "Operator typed consent required between propose and act · always",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

// Run the verification pipeline against a PAT-drafted artifact.
//
// Pipeline order:
//   1. SAT-1 verifyArtifactBoundary (refuse immediately if not canonical)
//   2. SAT-3 auditArtifactDoctrine (only if claims_door is provided)
//   3. SAT-2 auditAction (only if an action descriptor is provided)
//   4. SAT-4 verifyReceiptChain (only if receipts provided)
//   5. SAT-5 verifyIdentity (only if profile provided)
//
// Each SAT runs only when its inputs are present. Verdict aggregates.
export function runVerificationPipeline({
  artifact = null,
  doctrine_inputs = null,
  action = null,
  receipts = null,
  profile = null,
  previous_snapshot = null,
} = {}) {
  const safeArtifact = safeObject(artifact);
  const sats_run = [];
  const sats_passed = [];
  const sats_failed = [];
  const per_sat_verdicts = {};

  // SAT-1 always runs (every artifact has a boundary)
  if (safeArtifact) {
    sats_run.push("sat-1-boundary-verifier");
    const v1 = verifyArtifactBoundary({ artifact: safeArtifact });
    per_sat_verdicts["sat-1-boundary-verifier"] = v1;
    if (v1.passed) sats_passed.push("sat-1-boundary-verifier");
    else sats_failed.push("sat-1-boundary-verifier");
  }

  // SAT-3 runs if doctrine inputs provided
  if (doctrine_inputs && typeof doctrine_inputs === "object") {
    sats_run.push("sat-3-doctrine-compliance");
    const v3 = auditArtifactDoctrine({
      artifact: safeArtifact,
      ...doctrine_inputs,
    });
    per_sat_verdicts["sat-3-doctrine-compliance"] = v3;
    if (v3.passed) sats_passed.push("sat-3-doctrine-compliance");
    else sats_failed.push("sat-3-doctrine-compliance");
  }

  // SAT-2 runs if action provided
  if (action && typeof action === "object") {
    sats_run.push("sat-2-consent-auditor");
    const v2 = auditAction({ action });
    per_sat_verdicts["sat-2-consent-auditor"] = v2;
    if (v2.passed) sats_passed.push("sat-2-consent-auditor");
    else sats_failed.push("sat-2-consent-auditor");
  }

  // SAT-4 runs if receipts provided
  if (Array.isArray(receipts) && receipts.length > 0) {
    sats_run.push("sat-4-receipt-chain-verifier");
    const v4 = verifyReceiptChain({ receipts });
    per_sat_verdicts["sat-4-receipt-chain-verifier"] = v4;
    if (v4.passed) sats_passed.push("sat-4-receipt-chain-verifier");
    else sats_failed.push("sat-4-receipt-chain-verifier");
  }

  // SAT-5 runs if profile provided
  if (profile && typeof profile === "object") {
    sats_run.push("sat-5-identity-verifier");
    const v5 = verifyIdentity({ profile, previous_snapshot });
    per_sat_verdicts["sat-5-identity-verifier"] = v5;
    if (v5.passed) sats_passed.push("sat-5-identity-verifier");
    else sats_failed.push("sat-5-identity-verifier");
  }

  const all_passed = sats_run.length > 0 && sats_failed.length === 0;
  const overall_verdict =
    sats_run.length === 0
      ? "no_inputs_no_verdict"
      : all_passed
        ? "pipeline_verified"
        : "pipeline_violated";

  return Object.freeze({
    schema: VERIFICATION_PIPELINE_SCHEMA,
    truth_label: all_passed
      ? "MEASURED"
      : sats_run.length === 0
        ? "NO_VERDICT"
        : "PIPELINE_VIOLATION",
    mode: "pipeline_result",
    artifact_schema: safeArtifact?.schema || null,
    sats_run: Object.freeze(sats_run),
    sats_passed: Object.freeze(sats_passed),
    sats_failed: Object.freeze(sats_failed),
    per_sat_verdicts: Object.freeze(per_sat_verdicts),
    overall_verdict,
    passed: all_passed,
    audit_trail_required: true,
    receipt_shape_ready: all_passed,
    boundary: buildPreviewBoundary(),
  });
}

export function buildMultiAgentOrchestratorSummary() {
  const orch = buildMultiAgentOrchestrator();
  return Object.freeze({
    schema: "bizra.dema.multi_agent_orchestrator_summary.v0.1",
    truth_label: orch.truth_label,
    mode: "summary",
    source_schema: orch.schema,
    pat_count: orch.pat_count,
    sat_count: orch.sat_count,
    total_agent_count: orch.pat_count + orch.sat_count,
    routing_law_count: orch.routing_law.length,
    blocked_effect_count: orch.blocked_effects.length,
    boundary: orch.boundary,
  });
}

export const MULTI_AGENT_ORCHESTRATOR_SCHEMA_NAME = SCHEMA;
export const MULTI_AGENT_ORCHESTRATOR_PIPELINE_SCHEMA_NAME =
  VERIFICATION_PIPELINE_SCHEMA;
export const MULTI_AGENT_PAT_IDS = PAT_IDS;
export const MULTI_AGENT_SAT_IDS = SAT_IDS;
