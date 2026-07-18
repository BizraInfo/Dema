// DEMA-CAPABILITY-TRUTH-REGISTRY-1A
//
// Deterministic truth map for shipped Dema capability surfaces. It records what
// exists, what evidence supports it, and which live claims remain blocked.

import { createHash } from "node:crypto";

export const DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA =
  "bizra.dema.capability_truth_registry.v0.1";
export const DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL =
  "DEMA_CAPABILITY_TRUTH_REGISTRY_MEASURED_REPO_ONLY";
export const DEMA_CAPABILITY_TRUTH_REGISTRY_STAGE =
  "CAPABILITY_TRUTH_MAP_PREVIEW";

export const CAPABILITY_TRUTH_STATUSES = Object.freeze([
  "MEASURED_REPO",
  "IMPLEMENTED_LOCAL",
  "PREVIEW_ONLY",
  "DESIGNED_NOT_LIVE",
  "PLANNED",
  "UNKNOWN",
]);

export const REQUIRED_CAPABILITY_IDS = Object.freeze([
  "COVERAGE_TRUTH_GATE_1A",
  "DEMA_NODE_SPACE_FILE_STEWARD_1A",
  "NODE0_MULTI_DEVICE_URP_MANIFEST_1A",
  "AASR_NODE0_STATE_ROUTER_PREVIEW_1A",
  "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
  "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A",
  "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
  "NODE0_REVERSIBLE_EXECUTE_GATE_1A",
  "NODE0_UNDO_PROVEN_1A",
  "NODE0_CI_VENDOR_AVAILABILITY_1A",
  "NODE0_RECEIPT_SIGNING_ED25519_1A",
  "NODE0_PROOF_CHAIN_LINK_1A",
  "NODE0_SIGNED_CHAIN_HEAD_1A",
  "NODE0_SPINE_RUNNER_CLI_1A",
  "NODE0_EVIDENCE_SOURCE_REGISTRY_1A",
  "NODE0_LOCAL_CLOSURE_READINESS_1A",
  "DEMA_STAND_1A",
  "DEMA_STEWARD_CHAIN_1A",
  "POI_TIME_COMPRESSION_1A",
  "AWAY_CONTRACT_1A",
  "ABSENCE_STEWARD_READINESS_1A",
  "ABSENCE_STEWARD_RETURN_REVIEW_1A",
  "ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_1A",
  "DEMA_FDE_FORWARDER_DIAGNOSTIC_1A",
  "PREVIEW_RECEIPT_SIGNING_1A",
  "LOCAL_MODEL_ADAPTER_PREVIEW_1A",
  "CAPABILITY_BLAST_RADIUS_1A",
  "RECEIPT_MONITOR_PREVIEW_1A",
  "MONITOR_GATHERER_1A",
  "REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A",
  "SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_1A",
  "NODE0_NODESPACE_BOUNDARY_PREVIEW_1A",
  "DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A",
  "NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A",
  "DEMA_SELF_EVAL_BASELINE_PREVIEW_1A",
  "DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_1A",
  "DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_1A",
  "DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_1A",
  "DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_1A",
  "URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_1A",
  "DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_1A",
  "NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_1A",
  "NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_1A",
  "NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_1A",
  "NODE0_LOCAL_MISSION_HARNESS_PREVIEW_1A",
  "NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_1A",
  "NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_1A",
  "NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_1A",
  "UNTRUSTED_CORPUS_SANITIZER_PREVIEW_1A",
  "PUBLIC_METRIC_CLAIM_GATE_PREVIEW_1A",
  "MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_1A",
  "LOCAL_MODEL_PULSE_BINDING_PREVIEW_1A",
  "PLAN_BRANCH_PREVIEW_1A",
  "NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_1A",
  "NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_1A",
  "NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A",
  "NODE0_MISSION_PILOT_COCKPIT_PREVIEW_1A",
  "NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_1A",
  "SOVEREIGN_VOICE_TURN_PREVIEW_1A",
  "NODE0_FOUNDER_IMPACT_LOOP_0A",
  "DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_1A",
  "DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_1A",
  "DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_1A",
  "DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_0A",
  "NODE0_AGENT_FLEET_ROLES_1A",
  "NODE0_REALM_STATE_KERNEL_1A",
  "NODE0_METRICS_BASELINE_1A",
  "DEMA_RECOVERY_MISSION_ENGINE_1A",
  "DEMA_REVERSIBLE_FILE_STEWARD_1A",
]);

const REQUIRED_BLOCKED_LIVE_SURFACES = Object.freeze([
  "TOKEN_ECONOMY",
  "WALLET_ACTIONS",
  "LIVE_URP_FEDERATION",
  "LIVE_RSI",
  "LIVE_POI",
]);

export const REGISTRY_BOUNDARY_KEYS = Object.freeze([
  "daemon_started",
  "network_used",
  "token_minted",
  "wallet_accessed",
  "live_execution_performed",
  "file_mutation_performed",
  "urp_federation_started",
  "poi_runtime_started",
  "rsi_runtime_started",
  "model_invocation_performed",
]);

export const ROW_BOUNDARY_KEYS = Object.freeze([
  "execution_allowed",
  "daemon_started",
  "network_used",
  "token_minted",
  "wallet_accessed",
  "live_execution_performed",
]);

const ACTION_ELIGIBLE_PREVIEW_REQUIREMENTS = Object.freeze([
  "exact_go_phrase",
  "reversible_plan",
  "backup_manifest",
  "undo_manifest",
  "receipt_preview",
  "no_boundary_violation",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function registryHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function registryBoundary() {
  return freezeDeep(
    Object.fromEntries(REGISTRY_BOUNDARY_KEYS.map((key) => [key, false])),
  );
}

function rowBoundary() {
  return freezeDeep(Object.fromEntries(ROW_BOUNDARY_KEYS.map((key) => [key, false])));
}

function evidence({
  source_paths,
  test_paths,
  review_gate_paths,
  receipt_paths = [],
  documentation_paths = [],
}) {
  return freezeDeep({
    source_paths,
    test_paths,
    review_gate_paths,
    receipt_paths,
    documentation_paths,
  });
}

function capability({
  capability_id,
  status = "MEASURED_REPO",
  runtime_status = "PREVIEW_ONLY",
  truth_label,
  summary,
  evidence: rowEvidence,
  promotion_rule,
  blocked_promotion_rule,
  forbidden_claims,
  what_this_proves,
  what_this_does_not_prove,
  promotion_dependency = null,
  blocked_by = [],
}) {
  const canonicalPromotionRule = promotion_rule ?? blocked_promotion_rule;
  return freezeDeep({
    capability_id,
    status,
    runtime_status,
    truth_label,
    summary,
    evidence: rowEvidence,
    source_files: rowEvidence.source_paths,
    test_files: rowEvidence.test_paths,
    review_gate: rowEvidence.review_gate_paths,
    receipt_doc: [
      ...rowEvidence.receipt_paths,
      ...rowEvidence.documentation_paths,
    ],
    boundary: rowBoundary(),
    what_this_proves,
    what_this_does_not_prove,
    promotion_rule: canonicalPromotionRule,
    promotion_dependency,
    blocked_by,
    execution_allowed: false,
    eligible_for_execution: false,
    action_capable: false,
    claims_live_execution: false,
    claims_token_or_wallet: false,
    blocked_promotion_rule: blocked_promotion_rule ?? canonicalPromotionRule,
    forbidden_claims,
  });
}

function defaultCapabilityRows() {
  return freezeDeep([
    capability({
      capability_id: "COVERAGE_TRUTH_GATE_1A",
      truth_label: "COVERAGE_TRUTH_GATE_MEASURED_REPO",
      summary:
        "Routes test, coverage, and check evidence through the known-harness classifier without hiding unknown failures.",
      evidence: evidence({
        source_paths: [
          "package.json",
          "scripts/ci/classify-known-harness-failures.mjs",
        ],
        test_paths: ["tests/g8-classifier.test.js"],
        review_gate_paths: ["scripts/check.mjs"],
        receipt_paths: [
          "docs/receipts/R2_COVERAGE_ENTRYPOINT_CLASSIFIER_PATCH_v0.1.md",
          "docs/receipts/R3_CHECK_ENTRYPOINT_CLASSIFIER_PATCH_v0.1.md",
        ],
        documentation_paths: ["docs/TESTING.md"],
      }),
      blocked_promotion_rule:
        "May not claim coverage thresholds are enforced by npm run coverage; unknown failures still block.",
      what_this_proves:
        "The repo can classify known harness failures without hiding unknown failures.",
      what_this_does_not_prove:
        "It does not prove enforced coverage thresholds or production quality.",
      forbidden_claims: [
        "coverage threshold hard gate is live",
        "unknown test failures are safe to ignore",
      ],
    }),
    capability({
      capability_id: "DEMA_NODE_SPACE_FILE_STEWARD_1A",
      truth_label: "DEMA_NODE_SPACE_BONDING_FILE_STEWARD_PREVIEW_ONLY",
      summary:
        "Metadata-only file steward preview with receipt-ready action atoms and no content read or mutation.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-node-space-bonding-file-steward.js"],
        test_paths: ["tests/dema-node-space-bonding-file-steward.test.js"],
        review_gate_paths: [
          "scripts/review/dema-node-space-bonding-file-steward-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_NODE_SPACE_BONDING_FILE_STEWARD_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_NODE_SPACE_BONDING_FILE_STEWARD_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live file management, rename, move, merge, delete, or content understanding.",
      what_this_proves:
        "Dema can preview metadata-only file organization actions with receipt-ready atoms.",
      what_this_does_not_prove:
        "It does not prove file mutation, content understanding, OCR, embeddings, or upload.",
      forbidden_claims: ["live file steward", "renamed file", "read file content"],
    }),
    capability({
      capability_id: "NODE0_MULTI_DEVICE_URP_MANIFEST_1A",
      truth_label: "NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_ONLY",
      summary:
        "Preview-only multi-device Node0 resource body composer over laptop/mobile metadata.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-multi-device-urp-resource-manifest-preview.js",
        ],
        test_paths: [
          "tests/node0-multi-device-urp-resource-manifest-preview.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-multi-device-urp-resource-manifest-preview-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_1A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live device sync, URP write, token mint, wallet access, or federation.",
      what_this_proves:
        "Dema can compose laptop and mobile metadata into one Node0 resource-body preview.",
      what_this_does_not_prove:
        "It does not prove live device sync, URP write, token mint, wallet access, or federation.",
      forbidden_claims: ["live URP federation", "token mint", "wallet access"],
    }),
    capability({
      capability_id: "AASR_NODE0_STATE_ROUTER_PREVIEW_1A",
      truth_label: "AASR_NODE0_STATE_ROUTER_PREVIEW_ONLY",
      summary:
        "Preview router that turns File Steward and multi-device manifest evidence into bounded state-route previews.",
      evidence: evidence({
        source_paths: ["packages/core/src/aasr-node0-state-router-preview.js"],
        test_paths: ["tests/aasr-node0-state-router-preview.test.js"],
        review_gate_paths: [
          "scripts/review/aasr-node0-state-router-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/AASR_NODE0_STATE_ROUTER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/AASR_NODE0_STATE_ROUTER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim route execution, state write, model reasoning, federation, reward, or runtime autonomy.",
      what_this_proves:
        "Dema can route preview evidence into deterministic consent, compliance, and state-route previews.",
      what_this_does_not_prove:
        "It does not prove route execution, model reasoning, federation, reward, or autonomy.",
      forbidden_claims: ["route executed", "state written", "autonomous action"],
    }),
    capability({
      capability_id: "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
      truth_label: "APR_NODE0_ROUTE_REFINERY_PREVIEW_ONLY",
      summary:
        "Preview refinery that critiques AASR routes for proof, consent, risk, and overclaim gaps.",
      evidence: evidence({
        source_paths: ["packages/core/src/apr-node0-route-refinery-preview.js"],
        test_paths: ["tests/apr-node0-route-refinery-preview.test.js"],
        review_gate_paths: [
          "scripts/review/apr-node0-route-refinery-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/APR_NODE0_ROUTE_REFINERY_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/APR_NODE0_ROUTE_REFINERY_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim route execution, live APR runtime, model reasoning, reward, or economic settlement.",
      what_this_proves:
        "Dema can critique AASR route previews for proof, consent, risk, and overclaim gaps.",
      what_this_does_not_prove:
        "It does not prove route execution, live APR runtime, model reasoning, reward, or settlement.",
      forbidden_claims: ["route execution", "live APR", "economic settlement"],
    }),
    capability({
      capability_id: "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A",
      truth_label: "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_ONLY",
      summary:
        "Preview-only action eligibility envelope over APR-refined routes with consent, backup, undo, and receipts.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-governed-reversible-action-preview.js",
        ],
        test_paths: ["tests/node0-governed-reversible-action-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-governed-reversible-action-preview-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim actual rename, mutation, execution, live governed runtime, or post-action receipt.",
      what_this_proves:
        "Dema can prepare one APR-refined reversible action candidate with consent, backup, undo, and receipt-preview requirements.",
      what_this_does_not_prove:
        "It does not prove actual rename, mutation, live governed runtime, or post-action receipt.",
      promotion_dependency: {
        from_status: "PREVIEW_ONLY",
        to_status: "ACTION_ELIGIBLE_PREVIEW",
        requires: ACTION_ELIGIBLE_PREVIEW_REQUIREMENTS,
        eligible_for_execution: false,
      },
      forbidden_claims: ["actual rename", "live execution", "post-action receipt written"],
    }),
    capability({
      capability_id: "DEMA_FDE_DUAL_DIAGNOSTIC_1A",
      truth_label: "DEMA_FDE_DUAL_DIAGNOSTIC_PREVIEW_ONLY",
      summary:
        "Deterministic inward code/proof and outward environment failure diagnosis without patching or execution.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-fde-dual-diagnostic.js"],
        test_paths: ["tests/dema-fde-dual-diagnostic.test.js"],
        review_gate_paths: [
          "scripts/review/dema-fde-dual-diagnostic-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/DEMA_FDE_DUAL_DIAGNOSTIC_1A.md",
          "docs/receipts/DEMA_FDE_CI_BILLING_LOCK_MARKER_1A.md",
          "docs/receipts/DEMA_FDE_SEMANTIC_REDERIVATION_1B.md",
          "docs/receipts/DEMA_FDE_BOUNDARY_PRECEDENCE_1C.md",
        ],
        documentation_paths: [
          "docs/02-architecture/DEMA_FDE_DUAL_DIAGNOSTIC_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim autopatch, live remediation, autonomous repair, or field execution without separate consent and proof gates.",
      what_this_proves:
        "Dema can classify failed commands into inward vs outward hypotheses with explicit confidence and missing evidence; boundary violations dominate vendor billing evidence, and billing lock remains outward-only.",
      what_this_does_not_prove:
        "It does not patch files, commit, push, merge, start daemons, use networks, mint tokens, or prove root cause ground truth.",
      forbidden_claims: ["autopatch applied", "failure auto-fixed", "live remediation"],
    }),
    capability({
      capability_id: "NODE0_REVERSIBLE_EXECUTE_GATE_1A",
      truth_label: "NODE0_REVERSIBLE_EXECUTE_SANDBOX_MEASURED",
      summary:
        "Sandbox-contained governed rename with exact execute consent, backup-before-action, sealed receipt, and proven undo.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-reversible-execute-gate.js"],
        test_paths: ["tests/node0-reversible-execute-gate.test.js"],
        review_gate_paths: [
          "scripts/review/node0-reversible-execute-gate-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_REVERSIBLE_EXECUTE_GATE_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_REVERSIBLE_EXECUTE_GATE_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim operator-wide execution, live governed runtime outside the sandbox, autonomous action, or production mutation without separate consent and proof gates.",
      what_this_proves:
        "Dema can perform one low-risk reversible rename inside a caller-supplied sandbox with measured before/after/state hashes, sealed receipt, and backup-anchored undo.",
      what_this_does_not_prove:
        "It does not prove operator data mutation, daemon runtime, network use, token mint, wallet access, or production readiness outside the sandbox.",
      forbidden_claims: [
        "operator data mutated",
        "live governed runtime",
        "production execution",
      ],
    }),
    capability({
      capability_id: "NODE0_UNDO_PROVEN_1A",
      truth_label: "NODE0_UNDO_PROVEN_PREVIEW_ONLY",
      summary:
        "Measured inverse-correction preview envelope composing execute gate + backup-anchored undo proof.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-undo-proven-preview.js"],
        test_paths: ["tests/node0-undo-proven-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-undo-proven-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_UNDO_PROVEN_1A.md"],
        documentation_paths: ["docs/TESTING.md"],
      }),
      blocked_promotion_rule:
        "May not claim production rollback, autonomous repair, or inverse correction outside the measured sandbox gate.",
      what_this_proves:
        "Dema can seal one undo-proven preview when the reversible execute gate restores bytes from backup.",
      what_this_does_not_prove:
        "It does not prove live governed runtime, federation, economic rights, or arbitrary action-class undo.",
      forbidden_claims: ["production rollback", "autonomous repair", "live undo runtime"],
    }),
    capability({
      capability_id: "NODE0_CI_VENDOR_AVAILABILITY_1A",
      truth_label: "NODE0_CI_VENDOR_AVAILABILITY_LOCAL_ONLY",
      summary:
        "FDE-backed GitHub Actions billing-lock lane so local proof rails do not treat vendor lock as code regression.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-ci-vendor-availability.js"],
        test_paths: ["tests/node0-ci-vendor-availability.test.js"],
        review_gate_paths: [
          "scripts/review/node0-ci-vendor-availability-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/DEMA_FDE_CI_BILLING_LOCK_MARKER_1A.md",
          "docs/receipts/NODE0_CI_VENDOR_AVAILABILITY_1A.md",
        ],
        documentation_paths: ["docs/TESTING.md"],
      }),
      blocked_promotion_rule:
        "May not claim remote CI green, trunk merge eligibility, or that billing lock is a code defect.",
      what_this_proves:
        "Dema can classify vendor billing lock and keep LOCAL proof lane honest while remote CI is advisory.",
      what_this_does_not_prove:
        "It does not unlock GitHub billing, replace remote attestation, or authorize merge while CI is vendor-blocked.",
      forbidden_claims: ["remote CI green", "billing unlocked", "code regression from vendor lock"],
    }),
    capability({
      capability_id: "NODE0_RECEIPT_SIGNING_ED25519_1A",
      truth_label: "NODE0_SIGNED_SANDBOX_RECEIPT_ATTESTATION",
      summary:
        "Ed25519 attestation bridge for sandbox execute receipts — identity binding without execution authority.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-receipt-signing-ed25519.js"],
        test_paths: ["tests/node0-receipt-signing-ed25519.test.js"],
        review_gate_paths: [
          "scripts/review/node0-receipt-signing-ed25519-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_RECEIPT_SIGNING_ED25519_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_RECEIPT_SIGNING_ED25519_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim signing grants execution authority, operator mutation, live identity runtime, unattended signing, or production attestation outside consented key-store use.",
      what_this_proves:
        "Dema can Ed25519-sign a #306 sandbox execute receipt into a public-key-verifiable attestation envelope with tamper rejection on content_hash and state_hash binds; the consent assertion is inside the signed payload (a signature over a consent-free payload fails), and the displayed public-key fingerprint must re-derive from the verifying key (payload schema v0.2, parity with PREVIEW-RECEIPT-SIGNING-1A).",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, legal identity, or that signing authority equals execution authority.",
      forbidden_claims: [
        "signing grants execution",
        "live identity runtime",
        "unattended signing",
      ],
    }),
    capability({
      capability_id: "NODE0_PROOF_CHAIN_LINK_1A",
      truth_label: "NODE0_APPEND_ONLY_SIGNED_RECEIPT_CHAIN",
      summary:
        "Hash-chain signed receipts into a verifiable append-only proof log.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-proof-chain-link.js"],
        test_paths: ["tests/node0-proof-chain-link.test.js"],
        review_gate_paths: [
          "scripts/review/node0-proof-chain-link-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_PROOF_CHAIN_LINK_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_PROOF_CHAIN_LINK_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Dema can bind an ordered set of #307 signed-receipt content_hash anchors into a content-addressed append-only hash chain whose verifier rejects in-place receipt tampering, link-hash forgery, and reordering/forking.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_SIGNED_CHAIN_HEAD_1A",
      truth_label: "NODE0_SIGNED_PROOF_CHAIN_HEAD",
      summary:
        "Ed25519-sign the proof-chain head_hash so one signature attests the whole receipt history.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-signed-chain-head.js"],
        test_paths: ["tests/node0-signed-chain-head.test.js"],
        review_gate_paths: [
          "scripts/review/node0-signed-chain-head-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_SIGNED_CHAIN_HEAD_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_SIGNED_CHAIN_HEAD_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Dema can Ed25519-sign the head_hash of a verified #308 proof chain into a public-key-verifiable attestation that binds the whole chain; verification is public-key-only and a tampered/reordered chain (different head) fails the bind, with no private-key material in the envelope.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_SPINE_RUNNER_CLI_1A",
      truth_label: "NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN",
      summary:
        "One consent-gated CLI path through execute → receipt attestation → proof chain → signed chain head in sandbox only.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-spine-runner.js",
          "apps/cli/src/commands/node0-spine-run.js",
          "apps/cli/src/commands/node0.js",
        ],
        test_paths: [
          "tests/node0-spine-runner.test.js",
          "tests/node0-spine-runner-cli.test.js",
        ],
        review_gate_paths: ["scripts/review/node0-spine-runner-check.mjs"],
        receipt_paths: ["docs/receipts/NODE0_SPINE_RUNNER_CLI_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_SPINE_RUNNER_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim general task execution, DEMA activation, autonomous action, live execution, operator mutation outside sandbox, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Dema exposes `dema node0 spine run` as one measured operator command that runs the #306–#309 spine in a sandbox with exact-string consent, returning a JSON envelope with execute hash, chain head, and attestation status without daemon or network.",
      what_this_does_not_prove:
        "It does not prove BIZRA-DATA-LAKE Node0 activation, real-time arbitrary tasks, federation, or live operator mutation outside the sandbox root.",
      forbidden_claims: [
        "general task execution",
        "DEMA activation",
        "autonomous action",
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_EVIDENCE_SOURCE_REGISTRY_1A",
      truth_label: "NODE0_EVIDENCE_SOURCE_REGISTRY_MEASURED_REPO",
      summary:
        "Register local, GitHub, Drive, Claude export, public-domain, receipt, design, and economy-simulation evidence sources before indexing, dedup, impact review, or mint decisions.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-evidence-source-registry.js"],
        test_paths: ["tests/node0-evidence-source-registry.test.js"],
        review_gate_paths: [
          "scripts/review/node0-evidence-source-registry-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_EVIDENCE_SOURCE_REGISTRY_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_EVIDENCE_SOURCE_REGISTRY_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim source ingestion, content reads, Drive downloads, GitHub writes, web scraping, impact verification, token minting, wallet access, live execution, daemon runtime, or federation.",
      what_this_proves:
        "Dema can deterministically register Node0 evidence source families before ingestion, dedup, impact review, or mint decisions, with exact consent, all-false execution boundary, zero mint allowance, and simulation sources barred from the impact queue.",
      what_this_does_not_prove:
        "It does not prove source contents, Drive download, GitHub mutation, web scraping, dedup execution, verified impact, PoI acceptance, token minting, wallet access, live execution, or federation.",
      forbidden_claims: [
        "source ingested",
        "Drive downloaded",
        "GitHub updated",
        "impact verified",
        "token minted",
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_LOCAL_CLOSURE_READINESS_1A",
      truth_label: "NODE0_LOCAL_CLOSURE_READINESS_MEASURED_REPO",
      summary:
        "Compose the Node0 evidence source registry and space-index envelope into local closure readiness with PAT/SAT metadata-only gates and no-mint blockers.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-local-closure-readiness.js"],
        test_paths: ["tests/node0-local-closure-readiness.test.js"],
        review_gate_paths: [
          "scripts/review/node0-local-closure-readiness-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_LOCAL_CLOSURE_READINESS_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_LOCAL_CLOSURE_READINESS_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim content ingestion, dedup execution, reorg execution, SAT acceptance, verified impact, live token minting, wallet access, daemon runtime, network use, or federation.",
      what_this_proves:
        "Dema can compose the Node0 evidence source registry and Node0 space-index envelope into a deterministic local closure readiness map: PAT-local registry/index gates, exact hash-consent next action, review-only impact candidates, SAT metadata blocked until apply completes, and zero mint allowance before verified PoI.",
      what_this_does_not_prove:
        "It does not prove source contents, data deduplication, file reorganization, SAT acceptance, verified impact, live token minting, wallet access, daemon runtime, network use, or federation.",
      forbidden_claims: [
        "content ingested",
        "dedup executed",
        "reorg executed",
        "SAT accepted",
        "impact verified",
        "token minted",
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_STAND_1A",
      truth_label: "FIRST_USER_STANDING_LOCAL_ONLY",
      summary:
        "Morning Standing Receipt: composes injected local evidence (git state, gate-log metadata, declared blockers) into a daily first-user standing card with FDE lens, exactly one next action, drain metric, stale-proof detection, and orbit warning.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-stand.js"],
        test_paths: ["tests/dema-stand.test.js"],
        review_gate_paths: [
          "scripts/review/dema-stand-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_STAND_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_STAND_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A deterministic daily standing card (FDE lens buckets, exactly one ladder-selected next action, declared drain, stale-proof and orbit flags) can be composed from injected local evidence and re-derived by any verifier from the embedded raw input.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_STEWARD_CHAIN_1A",
      truth_label: "FIRST_USER_STEWARD_CHAIN_LOCAL_ONLY",
      summary:
        "Steward-chain verifier: verifies the FIRST_USER standing-receipt chain (consecutive UTC days, per-receipt re-derivation, drain series) and emits honest day-N-of-7 / broken / complete verdicts with the Day-7 report payload.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-steward-chain.js"],
        test_paths: ["tests/dema-steward-chain.test.js"],
        review_gate_paths: [
          "scripts/review/dema-steward-chain-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_STEWARD_CHAIN_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_STEWARD_CHAIN_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The FIRST_USER standing-receipt chain state (consecutive UTC days, per-receipt hash validity, drain series) is derived deterministically and a COMPLETE verdict can only arise from N distinct consecutive verified receipts already on disk — days cannot be fabricated.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "POI_TIME_COMPRESSION_1A",
      truth_label: "POI_TIME_COMPRESSION_CANDIDATE_LOCAL_ONLY",
      summary:
        "Local-only PoI time-compression candidate receipt: declared baseline estimate vs declared actual duration under required quality gates; fail-closed, observation-aware, no mint.",
      evidence: evidence({
        source_paths: ["packages/core/src/poi-time-compression.js"],
        test_paths: ["tests/poi-time-compression.test.js"],
        review_gate_paths: [
          "scripts/review/poi-time-compression-check.mjs",
        ],
        receipt_paths: ["docs/receipts/POI_TIME_COMPRESSION_1A.md"],
        documentation_paths: [
          "docs/02-architecture/POI_TIME_COMPRESSION_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A declared baseline estimate (reference-class assumption) and a declared actual proof-loop duration can be bound into a fail-closed, content-addressed candidate compression receipt that refuses to exist when any required quality gate failed, keeps proof-time and observation-time as separate clocks, and rejects forged-and-recomputed ratios, gate survival, review flags, or mint flags on re-verification.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "AWAY_CONTRACT_1A",
      truth_label: "AWAY_CONTRACT_DESIGNED_NOT_LIVE",
      summary:
        "Away Contract ladder (ADR-043): schema validator, body-bound verifier, consent-gated receipt writer, draft compiler, and the dema away draft|verify|receipt CLI. Contracts are drafted, validated, verified, and receipted — never started; absence stewardship stays DESIGNED_NOT_LIVE.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/away-contract-schema.js",
          "packages/core/src/away-contract-verify.js",
          "packages/core/src/away-contract-receipt.js",
          "packages/core/src/away-contract-compiler.js",
          "apps/cli/src/commands/away.js",
        ],
        test_paths: [
          "tests/away-contract-schema.test.js",
          "tests/away-contract-verify.test.js",
          "tests/away-contract-receipt.test.js",
          "tests/away-contract-compiler.test.js",
          "tests/away-contract-cli-draft.test.js",
          "tests/away-contract-cli-verify.test.js",
          "tests/away-contract-cli-receipt.test.js",
        ],
        review_gate_paths: ["scripts/review/away-contract-check.mjs"],
        receipt_paths: ["docs/receipts/AWAY_CONTRACT_1A.md"],
        documentation_paths: [
          "docs/02-architecture/AWAY_CONTRACT_SPEC_v0_1.md",
          "docs/06-adr/ADR-043-pattern-first-nodespace-away-contract-quest-kernel.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live absence stewardship, contract start, action execution, daemon runtime, model invocation, network use, token, wallet, or federation. dema away start does not exist and requires its own proof gates plus exact operator consent.",
      what_this_proves:
        "An Away Contract body can be drafted from explicit intent, shape-validated fail-closed (never-grantable actions reject even when requested), verified body-bound against its whole normalized body and hash (laundering detected), and recorded as an exact-consent receipt under DEMA_HOME — deterministically, with injected act-time and all-false boundaries at every rung.",
      what_this_does_not_prove:
        "It does not prove absence-mode execution, unattended work, operator consent beyond the recorded phrase, model invocation, network use, or live stewardship of any kind.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "ABSENCE_STEWARD_READINESS_1A",
      truth_label: "ABSENCE_STEWARD_READINESS_MEASURED_NOT_LIVE",
      summary:
        "Absence Steward readiness report only: consumes an Away Contract contract/validation/receipt trio and derives NOT_CONFIGURED / CONTRACT_VERIFIED / PREVIEW_READY / EXPIRED / REFUSED via dema away preview. Binding judged at the receipt's hash-protected created_at, expiry at injected now. PREVIEW_READY grants nothing; dema away start does not exist.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/absence-steward-readiness.js",
          "apps/cli/src/commands/away.js",
        ],
        test_paths: [
          "tests/absence-steward-readiness.test.js",
          "tests/away-contract-cli-preview.test.js",
        ],
        review_gate_paths: ["scripts/review/absence-steward-readiness-check.mjs"],
        receipt_paths: ["docs/receipts/ABSENCE_STEWARD_READINESS_1A.md"],
        documentation_paths: [
          "docs/02-architecture/ABSENCE_STEWARD_PREVIEW_v0_1.md",
          "docs/ARCHITECTURE.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live absence stewardship, contract start, steward runtime, daemon, scheduler, unattended execution, model invocation, network use, token, wallet, or federation. Readiness is a report; PREVIEW_READY authorizes nothing; dema away start does not exist and requires its own spec, proof gates, and exact operator consent.",
      what_this_proves:
        "A receipted Away Contract trio can be deterministically classified into readiness states with body-binding judged as of the receipt's hash-protected created_at and expiry judged at injected act-time; forged or recomputed receipts, cross-contract receipts, and hot boundary keys are refused; every report carries steward_started:false in an all-false boundary.",
      what_this_does_not_prove:
        "It does not prove absence-mode execution, steward runtime, unattended work, scheduling, model invocation, network use, or that any stewardship ever occurred — readiness reporting is not stewardship.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "ABSENCE_STEWARD_RETURN_REVIEW_1A",
      truth_label: "ABSENCE_STEWARD_RETURN_REVIEW_MEASURED_NOT_LIVE",
      summary:
        "Return-review report only: consumes the Away Contract contract/validation/receipt trio plus a declared absence window and derives NO_ABSENCE_RECORDED / REVIEW_BLOCKED / READY_BUT_NOT_STARTED / EXPIRED_BEFORE_START via dema away review. Every claim is receipt-backed or NO_RECEIPT; executed_summary is 'Nothing executed. I can only report readiness and receipts.'; WORK_COMPLETE is not in vocabulary; dema away start does not exist.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/absence-steward-return-review.js",
          "apps/cli/src/commands/away.js",
        ],
        test_paths: [
          "tests/absence-steward-return-review.test.js",
          "tests/away-contract-cli-review.test.js",
        ],
        review_gate_paths: [
          "scripts/review/absence-steward-return-review-check.mjs",
        ],
        receipt_paths: ["docs/receipts/ABSENCE_STEWARD_RETURN_REVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md",
          "docs/ARCHITECTURE.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live absence stewardship, work completion, queue, contract start, steward runtime, daemon, scheduler, unattended execution, model invocation, network use, token, wallet, or federation. The review reports; it never proves work occurred; dema away start does not exist and requires its own spec, proof gates, and exact operator consent.",
      what_this_proves:
        "A post-absence review report can be deterministically derived from the receipted trio plus a declared window, with readiness re-derived at both window edges, verdicts capped at READY_BUT_NOT_STARTED / EXPIRED_BEFORE_START (COMPLETE verdicts unreachable), every event field refusing unreceipted claims, and a ten-key all-false boundary on every path.",
      what_this_does_not_prove:
        "It does not prove any work occurred, absence-mode execution, steward runtime, queuing, scheduling, model invocation, network use, or stewardship of any kind — the review exists to prove what was NOT done.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_1A",
      truth_label: "ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_MEASURED_NOT_LIVE",
      summary:
        "Absence Steward queue PROPOSAL spine only: fail-closed item-shape validator, body-bound launder-detecting verifier, consent-gated atomic receipt writer, and the validate-only dema away queue draft CLI. Item states capped at PROPOSED / HUMAN_APPROVED / HUMAN_REJECTED / WITHDRAWN / EXPIRED_WITH_CONTRACT; queue membership is never consent; recording a proposal never moves it. The queue itself — runner, approval flow, execution — remains DESIGNED_NOT_LIVE.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/absence-steward-queue-schema.js",
          "packages/core/src/absence-steward-queue-verify.js",
          "packages/core/src/absence-steward-queue-receipt.js",
          "apps/cli/src/commands/away.js",
        ],
        test_paths: [
          "tests/absence-steward-queue-schema.test.js",
          "tests/absence-steward-queue-verify.test.js",
          "tests/absence-steward-queue-receipt.test.js",
          "tests/away-queue-cli-draft.test.js",
        ],
        review_gate_paths: ["scripts/review/absence-steward-queue-check.mjs"],
        receipt_paths: [
          "docs/receipts/ABSENCE_STEWARD_QUEUE_PROPOSAL_SPINE_1A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/ABSENCE_STEWARD_LOCAL_QUEUE_v0_1.md",
          "docs/ARCHITECTURE.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim a live queue, queue runner, scheduler, daemon, auto-dequeue, self-approval, execution from queue, steward runtime, unattended execution, model invocation, network use, token, wallet, or federation. A recorded proposal is a remembered request — approval stays a separate human decision, execution is not in this track at all, and dema away start does not exist.",
      what_this_proves:
        "A queue proposal item can be validated fail-closed (execution-flavored states, never-executable action classes, and consent-ish fields all reject), re-verified body-bound against laundering (whole-body diff — forged hashes, drifted items, and hot boundaries refused), and, only under byte-exact derived consent, recorded as an atomic no-overwrite receipt that stays approved:false and executed:false with an all-false runtime boundary on every path.",
      what_this_does_not_prove:
        "It does not prove a queue runtime, storage beyond receipts, approval flow, dequeue, scheduling, execution, model invocation, or network use — the queue itself remains designed, not live.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_FDE_FORWARDER_DIAGNOSTIC_1A",
      truth_label: "DEMA_FDE_FORWARDER_DIAGNOSTIC_MEASURED_REPO",
      summary:
        "Route a completed FDE dual-diagnostic report to a single fail-closed forwarding destination under the Diagnostic Doxology; routing proposes, never executes.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-fde-forwarder-diagnostic.js"],
        test_paths: ["tests/dema-fde-forwarder-diagnostic.test.js"],
        review_gate_paths: [
          "scripts/review/dema-fde-forwarder-diagnostic-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_FDE_FORWARDER_DIAGNOSTIC_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_FDE_FORWARDER_DIAGNOSTIC_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A completed FDE dual-diagnostic report deterministically routes to exactly one proposal destination under the eight Diagnostic Doxology rules; mint/execute/autopatch destinations are absent from the vocabulary, CI unavailability never forwards as code failure, unregistered channels never claim connectivity, and the whole-body re-derivation verifier rejects forged-and-recomputed routings.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "PREVIEW_RECEIPT_SIGNING_1A",
      truth_label: "PREVIEW_RECEIPT_SIGNING_MEASURED_REPO",
      summary:
        "Bind preview-stack receipts to the existing Ed25519 signing rail via a canonical envelope adapter (no new signing system).",
      evidence: evidence({
        source_paths: ["packages/core/src/preview-receipt-signing.js"],
        test_paths: ["tests/preview-receipt-signing.test.js"],
        review_gate_paths: [
          "scripts/review/preview-receipt-signing-check.mjs",
        ],
        receipt_paths: ["docs/receipts/PREVIEW_RECEIPT_SIGNING_1A.md"],
        documentation_paths: [
          "docs/02-architecture/PREVIEW_RECEIPT_SIGNING_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A preview-stack report (mode preview_only) binds into a canonical content-addressed envelope that stays explicitly marked unsigned (signed:false, signature:null) until the existing Ed25519 authorship rail signs it under the exact GO phrase; the consent hash is inside the signed subject so a signature over the bare envelope fails, the displayed public-key fingerprint must re-derive from the embedded PEM, the canonical hash is stable across rebuilds, whole-body re-derivation rejects tampered hashes, the signature anchor rejects forged-and-recomputed bodies, signed envelopes carry complete signature metadata without private-key material, and the boundary stays all-false including public_safe_claim.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "LOCAL_MODEL_ADAPTER_PREVIEW_1A",
      truth_label: "LOCAL_MODEL_ADAPTER_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only local model adapter contract: binds an injected discovery report into a content-addressed adapter envelope (model always null, boundary all-false) that refuses live-invocation, wallet, mint, and URP fields — no model invocation, no network.",
      evidence: evidence({
        source_paths: ["packages/core/src/local-model-adapter-preview.js"],
        test_paths: ["tests/local-model-adapter-preview.test.js"],
        review_gate_paths: [
          "scripts/review/local-model-adapter-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/LOCAL_MODEL_ADAPTER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/LOCAL_MODEL_ADAPTER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent adapter CONTRACT compiles a models-discover-shaped report into a deterministic content-addressed preview envelope: model pinned null, runtime derived from first reachable provider (else unknown), canonical all-false boundary enforced by deep key-set equality, whole-body hash re-derivation rejects tampered and laundered bodies, and exact-name forbidden fields (wallet, mint, private_key, urp_live) are refused at plan and verify time.",
      what_this_does_not_prove:
        "It does not prove model correctness, live model invocation, inference quality, operator execution, daemon runtime, network use, wallet access, or live federation — the adapter never selects or calls a model.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "CAPABILITY_BLAST_RADIUS_1A",
      truth_label: "CAPABILITY_BLAST_RADIUS_MEASURED_REPO",
      summary:
        "Deterministic blast-radius classifier: derives blast_radius (low|medium|high) and reversibility from declared action mutation flags — never from prose — so graduated consent can name what an action touches before it runs. No execution, no network, no mutation.",
      evidence: evidence({
        source_paths: ["packages/core/src/capability-blast-radius.js"],
        test_paths: ["tests/capability-blast-radius.test.js"],
        review_gate_paths: [
          "scripts/review/capability-blast-radius-check.mjs",
        ],
        receipt_paths: ["docs/receipts/CAPABILITY_BLAST_RADIUS_1A.md"],
        documentation_paths: [
          "docs/02-architecture/CAPABILITY_BLAST_RADIUS_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent deterministic decision matrix classifies declared action descriptors (seven canonical mutation flags + closed recovery vocabulary) into low/medium/high blast radius with named auditable reasons and reversibility derived strictly from recovery; classifications are whole-body content-addressed AND re-derivable, so a laundered downgrade (high edited to low with a recomputed hash) is rejected; descriptors with missing or non-canonical flag keys are refused at plan time.",
      what_this_does_not_prove:
        "It does not prove any action was actually performed, blocked, or safe — classification is a naming act over DECLARED flags, not runtime observation; it grants no authority, and it does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "RECEIPT_MONITOR_PREVIEW_1A",
      truth_label: "RECEIPT_MONITOR_PREVIEW_MEASURED_REPO",
      summary:
        "Operator-invoked proof-health monitor: classifies injected proof-surface facts (stale proof, registry/docs drift, missing review gates, evidence-free verified claims, forbidden-claim markers) into severity findings with evidence refs — deterministic, no daemon, no autofix, no authority increase.",
      evidence: evidence({
        source_paths: ["packages/core/src/receipt-monitor-preview.js"],
        test_paths: ["tests/receipt-monitor-preview.test.js"],
        review_gate_paths: [
          "scripts/review/receipt-monitor-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/RECEIPT_MONITOR_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/RECEIPT_MONITOR_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent deterministic monitor compiles injected proof-surface facts (repo state, registry counts, capability rows, receipts, symbolic claim markers) into a content-addressed findings report: ten failure classes detected with severity, surface, evidence ref, and a closed allowed-action vocabulary (inspect/repair_proof/stop_and_ask_operator); critical findings fail closed via proceed_allowed=false; findings AND summary are fully re-derivable, so a forged clean verdict or a self-consistent authority_delta increase is rejected; CI-unavailable is classified outward, never as code failure.",
      what_this_does_not_prove:
        "It does not prove the injected facts are true of the live repo — gathering real surfaces is a separate read-only step; it observes no runtime, fixes nothing, writes no receipts, grants no authority, and does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "MONITOR_GATHERER_1A",
      truth_label: "MONITOR_GATHERER_MEASURED_REPO",
      summary:
        "Read-only monitor-facts derivation: compiles injected raw repo artifacts (git metadata, gate-log ages, registry rows, check.mjs source, docs texts, receipt metadata) into the receipt-monitor input facts, content-addressed and fully re-derivable — no fs in kernel, no network, no mutation.",
      evidence: evidence({
        source_paths: ["packages/core/src/monitor-gatherer.js"],
        test_paths: ["tests/monitor-gatherer.test.js"],
        review_gate_paths: [
          "scripts/review/monitor-gatherer-check.mjs",
        ],
        receipt_paths: ["docs/receipts/MONITOR_GATHERER_1A.md"],
        documentation_paths: [
          "docs/02-architecture/MONITOR_GATHERER_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent deterministic derivation compiles injected raw repo artifacts (git metadata, gate-log ages vs threshold, registry rows with evidence paths, check.mjs source, CURRENT_LIMITS/TESTING texts, receipt metadata) into the receipt-monitor input facts; the derived facts are content-addressed AND fully re-derivable from the embedded raw artifacts, so a laundered clean repo_state (tree_clean/stale_proof flipped with a recomputed hash) is rejected; derived facts pipe eligibly into RECEIPT-MONITOR-PREVIEW-1A.",
      what_this_does_not_prove:
        "It does not prove the raw artifacts were honestly collected — collection is the CLI gatherer's read-only job; membership checks are exact-substring presence of the capability's hyphenated ID or a specific (directory-qualified) source path, with `scripts/check.mjs`-as-gate recognized as inherently in-check (a generic root file like package.json is deliberately NOT accepted as documentation evidence); receipts carry verified_claim=false and claim_markers stay empty in v0.1; no operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A",
      truth_label: "REWARD_ELIGIBILITY_CONTRACT_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only reward-eligibility contract: classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from evidence refs, monitor state, and claim flags — inert output with no score, no authority signal, no action-permission field; forbidden claims and monitor-hiding are dominant refusals; evidence refs mandatory.",
      evidence: evidence({
        source_paths: ["packages/core/src/reward-eligibility-contract-preview.js"],
        test_paths: ["tests/reward-eligibility-contract-preview.test.js"],
        review_gate_paths: [
          "scripts/review/reward-eligibility-contract-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/REWARD_ELIGIBILITY_CONTRACT_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent deterministic contract classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from a closed outcome-kind vocabulary, mandatory evidence refs, injected monitor state, and eight forbidden-claim flags: monitor criticals block, a monitor weakened to hide drift is the dominant refusal, mint/wallet/urp-live/federation/public-safe/authority/cost-as-value/simulated-as-real each refuse, an all-clear-asserting outcome must match the monitor state, and the verdict is content-addressed and fully re-derivable so a forged-eligible or inertness-breaching verdict (is_actuation_signal/confers_permission/authority_delta flipped) is rejected. It is URP-FACING: the verdict names its designed future constitutional consumers (BIZRA_URP_GENESIS_PREVIEW, SAT5_CONSTITUTIONAL_VERIFIER_SET, FUTURE_NODE_ADMISSION_FLOW) while keeping live_runtime_consumer_enabled/actuator_readable_permission/urp_live/federation_live all false — Node0 encodes the genesis DNA; it does not activate the live organism.",
      what_this_does_not_prove:
        "It is a preview-only classification, NOT a reward: the verdict is inert (is_score:false, is_actuation_signal:false, confers_permission:false, authority_delta:0) and no consumer acts on it. It does not score magnitude, distribute anything, mint, price, or move value; it does not prove the injected evidence refs or monitor state are themselves true; and it does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_1A",
      truth_label: "SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only SAT-5 constitutional verifier set: five deterministic verifier passes (receipt/hash integrity, consent/FATE, impact/no-riba, security/blast-radius, governance/doctrine) that JUDGE a Node0 outcome — fail-closed admissibility, SAT judges Node0 and does not serve it, inert output with no authority, no mint, no live SAT agent.",
      evidence: evidence({
        source_paths: ["packages/core/src/sat5-constitutional-verifier-set-preview.js"],
        test_paths: ["tests/sat5-constitutional-verifier-set-preview.test.js"],
        review_gate_paths: [
          "scripts/review/sat5-constitutional-verifier-set-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/SAT5_CONSTITUTIONAL_VERIFIER_SET_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Exact-consent deterministic set of five constitutional verifier passes over a Node0 outcome: SAT-1 receipt/hash integrity (claimed hash must re-derive), SAT-2 consent/FATE (exact-string consent), SAT-3 impact/no-riba (mint/cost-as-value/simulated-as-real/unverified-impact each fail), SAT-4 security/blast-radius (low passes; medium/high require reversible+backup), SAT-5 governance/doctrine (truth label present, boundary all-false, no forbidden claims). Fail-closed admissibility — any FAIL or ABSTAIN rejects the set; the judgment is content-addressed and fully re-derivable so a forged ADMISSIBLE (a FAIL flipped to PASS with recomputed hash) is rejected; the constitutional stance judges_node0:true / serves_node0:false cannot be flipped.",
      what_this_does_not_prove:
        "It is the PREVIEW DESIGN of the constitutional judge, NOT live SAT autonomy (which stays DESIGNED_NOT_LIVE): live_sat_agent:false, authority_delta:0, mint_allowed:false, urp_live:false. It judges DECLARED facts, does not itself gather or attest them, animates no agent, grants no authority, and does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_NODESPACE_BOUNDARY_PREVIEW_1A",
      truth_label: "NODE0_NODESPACE_BOUNDARY_PREVIEW_MEASURED_REPO",
      summary:
        "Metadata-only Node0 homebase boundary kernel: hardware specs + OS-tree (host to VM/container to filesystem-root ownership) with inside/outside/unknown homebase classification; references existing device/data manifests instead of re-scanning or reading content.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-nodespace-boundary-preview.js"],
        test_paths: ["tests/node0-nodespace-boundary-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-nodespace-boundary-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_NODESPACE_BOUNDARY_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_NODESPACE_BOUNDARY_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Composes injected hardware-spec and OS-tree metadata into a deterministic, content-addressed Node0 homebase-boundary snapshot: every OS binds to a known device, every guest VM or container binds to a parent OS, every filesystem root binds to a known owner OS; inside/outside/unknown homebase counts are re-derived from the primary arrays so a forged summary carrying a recomputed hash is rejected; raw serial numbers are refused and only serial_hash is admitted; encodes the user-selected scan-depth envelope (metadata_only default up to full_local_content_index) per root and as a tamper-proof kernel constant where the node owner is the sole authority for scan depth, content_read_allowed_now is false, and only receipts cross nodes by default; boundary all-false and authority_delta 0.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A",
      truth_label: "DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only composer that binds existing Dema organs (pain-goal, mission, NodeSpace boundary, homebase, proposed task, receipt preview, monitor, absence queue, return review) into one fail-closed operator work-envelope; references organs, does not run them or execute tasks.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-active-workloop-composer-preview.js"],
        test_paths: ["tests/dema-active-workloop-composer-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-active-workloop-composer-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Composes the shipped Dema organs (pain-goal, mission, homebase, NodeSpace boundary, file steward, receipt preview, monitor, absence queue, return review) by reference into one deterministic, content-addressed operator work-envelope: fail-closed on missing boundary/consent/receipt-preview, a monitor critical, or an irreversible file action; L3+ tasks require explicit approval; an absent operator with unfinished work yields an absence-queue candidate and a returning operator a return-review candidate; allowed_next_action/blocked_by/requires_approval are re-derived from the declared state so a forged envelope is rejected; boundary all-false, authority_delta 0, runs no organ and executes no task.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A",
      truth_label: "NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_MEASURED_REPO",
      summary:
        "Consent-scoped, metadata-only inventory summary kernel: derives a triage (categories, total bytes, stale/duplicate-name/sensitive-name candidates, largest) from injected file-metadata rows under a user-selected scan mode; metadata_only implemented, all five scan modes as future user options; no content read.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-consented-inventory-gatherer-preview.js"],
        test_paths: ["tests/node0-consented-inventory-gatherer-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-consented-inventory-gatherer-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Derives a useful workspace triage (category/extension counts, total bytes, largest files, stale / duplicate-name / sensitive-name candidates, and safe recommended next actions) from injected file METADATA rows alone — no content is read; scan depth is the node owner's choice (metadata_only implemented, the other four modes declared as future user options and refused here); a row claiming content was read is refused; category/extension counts must be internally consistent so a forged summary is rejected; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_SELF_EVAL_BASELINE_PREVIEW_1A",
      truth_label: "DEMA_SELF_EVAL_BASELINE_PREVIEW_MEASURED_REPO",
      summary:
        "Self-eval quality baseline + compare: captures measured system-quality signals (tests, coverage, registry, monitor, gates, perf) as a content-addressed baseline and compares a candidate against it per dimension to say improved / regressed / mixed / unchanged, so system change is measured not blind; signals are injected, no tests are run here.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-self-eval-baseline-preview.js"],
        test_paths: ["tests/dema-self-eval-baseline-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-self-eval-baseline-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_SELF_EVAL_BASELINE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_SELF_EVAL_BASELINE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Captures Dema's measured system-quality signals (tests pass/total, coverage %, monitor criticals/warnings, gates-all-green, perf, registry) as a deterministic content-addressed baseline, and compares a candidate baseline per dimension into improved / regressed / unchanged with named reasons; a regression on any hard dimension (fewer passing tests, dropped coverage, more monitor criticals, gates falling green->red) forces 'regressed'; signals are injected (kernel runs no tests/coverage/monitor), a forged 'healthy' is rejected by re-derivation; boundary all-false, authority_delta 0. It measures change; it does not itself improve Dema.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_1A",
      truth_label: "DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only verified-answer receipt cache: stores previously verified answers as content-addressed records and reuses them only when fresh, in-scope, source-hash-matched, and truth_label verified; a cache hit reuses proof, never grants action, never mints, never turns saved cost into value.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-verified-answer-receipt-cache-preview.js"],
        test_paths: ["tests/dema-verified-answer-receipt-cache-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A verified answer is stored as a content-addressed record (cache_id over question+answer_digest+source_hashes+scope; content_hash over the whole body) and reused only when a lookup passes every gate: status verified, fresh against an injected now, exact consent-scope match (a private scope requires a matching operator-consent token), and source-hash set match — any miss returns no hit. compareFreshness and supersede are pure and clock-injected; a superseded or rejected record never hits; a tampered content_hash, a non-zero authority_delta, a vacuous-or-flipped boundary, and an unknown status are each rejected by re-derivation. A hit reuses proof only: grants_action false, authority_delta 0, boundary all-false.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation, and it does not itself mint or turn saved model cost into value. Its integrity check is body-bound content-addressing only — not cryptographic tamper-resistance: a forge-and-recompute launder is not defended here (that needs an independent signature/anchor).",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_1A",
      truth_label: "DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_MEASURED_REPO",
      summary:
        "First Light front door: a self-contained, zero-external-request static GUI preview (apps/front-door/index.html) rendered from a pure contract kernel; bilingual, consent-first, evidence-chipped, PREVIEW_ONLY. Renders the contract; mints nothing, federates nothing, activates no URP, runs no daemon.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-first-light-front-door-preview.js"],
        test_paths: ["tests/dema-first-light-front-door-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-first-light-front-door-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_FIRST_LIGHT_GUI_FRONT_DOOR_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_FIRST_LIGHT_GUI_FRONT_DOOR_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The pure contract kernel is the source of truth and the shipped HTML is verified against it: the front door carries the PREVIEW ONLY / NO MINT / NO FEDERATION disclaimers, makes zero external requests (the only fetch targets 127.0.0.1, opt-in and button-triggered), labels URP / apps-scan / data-scan / daemon / receipt-mint as DESIGNED — NOT LIVE, gates the apps/data consent toggles behind a local agent, ships bilingual (Arabic first-class) with evidence chips and a self-audit, and exports the bond fingerprint (a hash) not raw identity. 13 focused tests + the review gate reject an external request, a non-localhost fetch, a URP-labeled-ACTIVE, a live mint/federation claim, a missing disclaimer, and missing Arabic. Boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, live federation, or live URP. It renders a preview; it runs no scan, mints no receipt, and activates nothing. The opt-in 127.0.0.1 probe does not prove a running model.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_1A",
      truth_label: "DEMA_SOCRATIC_CRITIC_PREVIEW_MEASURED_REPO",
      summary:
        "Socratic critic (process supervision): a constraint-enforcing critic that interrogates a proposed hypothesis BEFORE SAT — PAT proposes, critic interrogates, SAT verifies, receipt records. It asks 'what would make this false?', raises question pressure only, and never grants authority or claims truth.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-socratic-critic-process-supervision-preview.js"],
        test_paths: ["tests/dema-socratic-critic-process-supervision-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-socratic-critic-process-supervision-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_SOCRATIC_CRITIC_PROCESS_SUPERVISION_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A proposed hypothesis packet (claim, causal_path, constraints, evidence, certainty, falsifier) is run through the four Socratic gates as seven deterministic checks (clarification, constraint, causal-path, counterexample, falsification, uncertainty, verified-vs-inferred split) and handed off with exactly one status: ready_for_sat / needs_revision / blocked_by_missing_evidence / rejected_overclaim. A violated constraint or certainty outrunning evidence forces rejected_overclaim; a missing causal path or falsifier or no evidence forces blocked_by_missing_evidence; a vacuous claim forces needs_revision. The critic output is content-addressed and carries grants_action false, claims_truth false, authority_delta 0, boundary all-false — verify rejects a grants_action tamper, an unknown status, and a vacuous boundary. 13 focused tests + review gate green.",
      what_this_does_not_prove:
        "It does not verify the claim (that is SAT's role), does not grant authority, does not execute any action, invokes no model, and touches no network. 'ready_for_sat' means the hypothesis survived interrogation pressure — not that it is true. It raises the question; it does not answer it.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_1A",
      truth_label: "DEMA_ZERO_OVERCLAIM_POLICY_MEASURED_REPO",
      summary:
        "Zero-overclaim response policy: a deterministic answer discipline that classifies each claim, enforces an honest label (VERIFIED / INFERRED / SPECULATIVE / UNVERIFIED / BLOCKED_PENDING_EVIDENCE), blocks unsupported current/high-stakes answers, and refuses invented sources and authority inflation. It seals the mouth after the critic; it downgrades and blocks, never upgrades authority.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-zero-overclaim-response-policy.js"],
        test_paths: ["tests/dema-zero-overclaim-response-policy.test.js"],
        review_gate_paths: [
          "scripts/review/dema-zero-overclaim-response-policy-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_ZERO_OVERCLAIM_RESPONSE_POLICY_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Each claim in a response packet is classified (verified_fact / grounded_inference / speculation / unverifiable / current_requires_verification / high_stakes_requires_verification) and gets exactly one enforced label; the packet hands off with one status — cleared_to_respond / blocked_pending_evidence / rejected_overclaim. An unsupported fact is downgraded to UNVERIFIED; a current or high-stakes claim without evidence is BLOCKED_PENDING_EVIDENCE; an invented source, an inference or speculation presented as VERIFIED, a grants_action/authority_delta inflation, or a claims_truth without a verified claim all force rejected_overclaim. Content-addressed and stable; grants_action false, claims_truth false, authority_delta 0, boundary all-false — verify rejects a grants_action and a boundary tamper. 14 focused tests + review gate green.",
      what_this_does_not_prove:
        "It does not verify a claim's truth, fetch evidence, invoke a model, or touch the network. It enforces honest labeling and blocks overclaim; it cannot confirm a fact — only refuse to let an unproven one leave as if proven.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_1A",
      truth_label: "URP_SUPPLY_REWARD_CONTRACT_PREVIEW_ONLY",
      summary:
        "URP supply-side resource reward contract (PREVIEW): encodes the public-market law that a provider earns base value from VERIFIED supply, availability, and service — not from proving impact. Computes reward-type ELIGIBILITY previews; mints nothing, settles nothing, activates no live URP. Cost measured is not impact; supply reward is not an impact claim; the impact dividend is extra and requires a verified outcome.",
      evidence: evidence({
        source_paths: ["packages/core/src/urp-supply-side-resource-reward-contract-preview.js"],
        test_paths: ["tests/urp-supply-side-resource-reward-contract-preview.test.js"],
        review_gate_paths: [
          "scripts/review/urp-supply-side-resource-reward-contract-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/URP_SUPPLY_SIDE_RESOURCE_REWARD_CONTRACT_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live URP, token mint, wallet access, settlement, federation, live execution, or operator mutation outside registered sandbox preview.",
      what_this_proves:
        "A resource offer is evaluated into reward-type eligibility (verified_supply_reward, verified_availability_reward, verified_usage_reward, optional_impact_dividend) and handed off with one status: reward_preview_allowed / blocked_pending_consent / blocked_pending_measurement / blocked_pending_sat_audit / rejected_overclaim / rejected_policy_violation. Missing consent/measurement blocks; a high-value offer needs a SAT audit ref; a claimed impact without verified-outcome evidence blocks pending SAT audit; a policy violation, a self-mint / live-URP / wallet / federation / authority-increase claim, cost-labeled-as-impact, or supply-reward-mislabeled-as-impact all reject. Content-addressed and stable; boundary all-false, authority_delta 0, grants_action false, mint_allowed false — verify rejects a mint_allowed and a boundary tamper. 17 focused tests + review gate green.",
      what_this_does_not_prove:
        "It does not activate live URP, mint any token, access a wallet, settle or pay anyone, federate, invoke a model, touch the network, run a daemon, scan files, or execute jobs. It previews reward ELIGIBILITY under the contract; it does not confirm real resource settlement or real impact — those require live URP + SAT audit, which remain DESIGNED_NOT_LIVE.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_1A",
      truth_label: "DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only signed receipt anchor: Ed25519 signature over a canonical-JSON receipt payload with injected keys; verifies signer identity and rejects payload/signature/canonicalization tamper and forge-and-recompute laundering. Mints nothing, binds no live identity.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-receipt-signature-anchor-preview.js"],
        test_paths: ["tests/dema-receipt-signature-anchor-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-receipt-signature-anchor-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_RECEIPT_SIGNATURE_ANCHOR_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A receipt payload is signed with an INJECTED Ed25519 key over the whole canonical-JSON envelope body (not just the payload), and verification requires a TRUSTED public key. verify rejects payload tamper, signature tamper, signer mismatch (wrong trusted key), canonicalization drift (signature over a non-canonical serialization), a non-zero authority_delta, grants_action/mint_allowed set true, a flipped boundary, and an unsigned envelope presented as signed. Critically, it rejects forge-and-recompute laundering — changing a field AND recomputing payload_hash so content-addressing would be self-consistent still fails, because re-signing requires the private key. This is the independent anchor the #334 content-addressed cache lacked. 13 focused tests + review gate green. Boundary all-false, authority_delta 0, grants_action false, mint_allowed false.",
      what_this_does_not_prove:
        "It does not bind a live Node0 genesis identity (keys are ephemeral/injected; the real signing-key ceremony is separate and operator-consented), does not persist or manage keys, and does not prove operator execution, daemon runtime, network use, wallet access, mint, or live federation. The signature proves who signed a payload — not that the payload's content is true.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_1A",
      truth_label: "NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_MEASURED_REPO",
      summary:
        "Preview-only Node0 URP Genesis Root: composes and validates a local resource-registry descriptor (identity, machine/compute/data resource policies, consent scopes, signed receipt-chain-head anchor, boundary flags) declaring what Node0 owns/permits/shares. Validates a caller-provided descriptor, activates nothing, tops at local_preview_active below the gated activate rung. Mints nothing, binds no live identity.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-urp-genesis-root-activation-preview.js"],
        test_paths: ["tests/node0-urp-genesis-root-activation-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-urp-genesis-root-activation-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_URP_GENESIS_ROOT_ACTIVATION_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A Node0 URP Genesis Root DESCRIPTOR can be composed and validated deterministically as a local preview: it aggregates identity, machine/compute/data resource policies, and consent scopes; attaches a signature-backed receipt-chain-head anchor (via node0-signed-chain-head, injected key); resolves a fail-closed activation status; and produces a stable content hash. It reaches local_preview_active ONLY when all required fields are present AND every domain flag is false; otherwise it returns the specific blocked_pending_health/consent/resource_policy/data_policy or rejected_overclaim status. Rejects: any live_urp/public_identity_genesis/mint/wallet/settlement/payment/federation/remote_execution/public_market/model_invocation/daemon flag set true, public-market/simulated-impact-as-verified/resource-cost-as-value wording, authority_delta>0, grants_action:true, unknown activation status, naive field tamper (content-hash), and anchor tamper (signature). 32 focused tests + review gate green. First implementation of the reserved BIZRA_URP_GENESIS_PREVIEW slot.",
      what_this_does_not_prove:
        "It ACTIVATES NOTHING: no live URP, no public identity genesis, no mint, no wallet/settlement/payment, no federation, no remote execution, no daemon, no model invocation, no network. local_preview_active is a descriptor state, not a live runtime — it sits below the gated activate rung. It binds no live Node0 identity (keys injected/ephemeral). The receipt-chain-head anchor is signature-backed; other descriptor fields are content-addressed only. Measured resource is not value; the signature proves who signed, not that the descriptor's content is true.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
        "live urp activation",
        "sovereign node activated",
      ],
    }),
    capability({
      capability_id: "NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_1A",
      truth_label: "NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only gate binding a Node0 URP genesis-root descriptor to existing URP resource-family preview surfaces under all-false boundary rules; activates nothing, mints nothing.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-urp-genesis-root-composition-gate-preview.js"],
        test_paths: ["tests/node0-urp-genesis-root-composition-gate-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-urp-genesis-root-composition-gate-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_URP_GENESIS_ROOT_COMPOSITION_GATE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure gate deterministically answers whether a Node0 URP genesis-root descriptor may COMPOSE (local preview) with a declared set of existing URP resource-family surfaces: the genesis descriptor re-verifies through verifyNode0UrpGenesisRootActivationPreview (signature-backed anchor) and must be local_preview_active; each composed surface must carry a KNOWN URP preview schema (drift-guarded against the eight real kernel schema constants), an all-false boundary, and stay unpublished, preview-only settlement, non-minting, non-cost-as-impact, no-raw-data, non-federation; a composed-level overclaim (live/federation/mint/wallet/settlement/daemon/network) or authority_delta>0 fails closed; the verdict is content-addressed and the embedded genesis anchor makes a forge-and-recompute of the composition body still fail (signature, not private key). 27 focused tests + review gate green; boundary all-false, mint_allowed false, authority_delta 0.",
      what_this_does_not_prove:
        "It runs NO resource kernel and activates NO live URP — it validates caller-normalized surface attestations, so only the embedded genesis-root anchor is signature-backed (launder-resistant); the resource surfaces are content-addressed attestations whose fidelity is the caller's responsibility. It does not prove operator execution, daemon runtime, network use, wallet access, settlement, mint, or live federation. composition_ready is a preview readiness verdict, not a live composition.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_1A",
      truth_label: "NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only Node0 mission pulse: connects one caller-supplied mission packet through consent, resource-composition reference, action preview, verification, receipt preview, world-state delta preview, and a DEMA truth report — all boundary-false, activates nothing.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-first-real-local-mission-pulse-preview.js"],
        test_paths: ["tests/node0-first-real-local-mission-pulse-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-first-real-local-mission-pulse-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_FIRST_REAL_LOCAL_MISSION_PULSE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure kernel deterministically connects one caller-supplied mission packet through the eight-stage pulse (PERCEIVE consent-scoped mission present; CONSENT operator-sole-authority with live mutation refused; RESOURCE_SELECT a re-verified, composition-ready NODE0-URP-GENESIS-ROOT-COMPOSITION-GATE verdict; ACTION_PREVIEW a caller-supplied candidate whose claim/task/boundary shape is validated and affirmative fields scanned for overclaim wording; VERIFY; RECEIPT preview; WORLD_STATE_UPDATE_PREVIEW with committed_live false; DEMA_REPORT). It fails closed on a missing/malformed mission, live-mutation consent, missing input content-hash, raw-content-leaves-node0, an invalid/unready composition reference, a malformed or overclaiming candidate, any declared live/mint/network/model/file-mutation flag, authority_delta>0, or a live-commit request. The verdict is content-addressed and re-verifies the embedded composition reference — which transitively re-verifies the genesis signature anchor — so a forge-and-recompute of the pulse body that tampers the composition/genesis chain is still rejected. 32 focused tests + review gate green; boundary all-false, authority_delta 0, mint_allowed false.",
      what_this_does_not_prove:
        "It proves NO live runtime, NO model intelligence, NO real founder-data ingestion, NO mint, NO federation, NO daemon, NO network, NO public readiness. The ACTION_PREVIEW is a caller-supplied candidate whose SHAPE is validated — this kernel performs no semantic extraction and reads no file. RECEIPT and WORLD_STATE_UPDATE are previews only (committed_live false); nothing is committed to a live world-state. It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_LOCAL_MISSION_HARNESS_PREVIEW_1A",
      truth_label: "NODE0_LOCAL_MISSION_HARNESS_PREVIEW_MEASURED_REPO",
      summary:
        "Operator-invoked local mission harness: reads one explicitly-named local file (metadata + hash, content only on separate consent), builds a mission packet, runs the pure mission-pulse kernel over a composition reference, and shapes a preview receipt artifact — fs confined to the CLI/adapter, kernel stays pure, no daemon, no network, no model, no mutation except the consented receipt.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-local-mission-harness-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: [
          "tests/node0-local-mission-harness-preview.test.js",
          "tests/node0-local-mission-harness-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-local-mission-harness-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_LOCAL_MISSION_HARNESS_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_LOCAL_MISSION_HARNESS_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The first I/O boundary crossing. A PURE kernel composes an INJECTED file reference (path/size/mtime/content-hash — the read-only CLI adapter computes it) plus an OPERATOR-SUPPLIED candidate extraction into a mission packet, runs the pure mission-pulse kernel over a composition reference, and shapes a preview receipt artifact (committed_live false); the embedded pulse verdict re-verifies (→ composition → genesis signature anchor), so a forge-and-recompute of the chain is rejected. The `dema mission pulse <file>` CLI adapter reads exactly one named file read-only to hash it, admits a bounded excerpt into the packet ONLY under a separate exact excerpt-consent phrase (default is metadata+hash only, content_read_performed false), and writes the receipt ONLY with --receipt + the exact consent phrase — atomically (tmp+rename, mode 0600) under $DEMA_HOME/mission/receipts; the source file is never mutated. Kernel-purity (no fs/clock/random in core) is asserted by a test; the fs lives in the CLI. 21 kernel tests + 11 CLI/adapter tests + review gate green.",
      what_this_does_not_prove:
        "The harness performs NO semantic extraction — the claim/task/boundary are the operator's (CLI flags), not the machine's; it invokes no model. It does not prove live execution, daemon runtime, background watching, directory crawl, network use, wallet access, mint, settlement, or live federation. The receipt is a preview (committed_live false); nothing is committed to a live world-state. The composition reference is an ephemeral-key preview, not a live Node0 identity.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_1A",
      truth_label: "NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only return-review over a dema mission pulse receipt: verifies the receipt's structure + invariants, states what was proven and what was not, and recommends exactly one next safe action; reads no model/network/daemon, receipt read-only via the CLI adapter, kernel stays pure.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-mission-harness-return-review-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: [
          "tests/node0-mission-harness-return-review-preview.test.js",
          "tests/node0-mission-harness-return-review-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-mission-harness-return-review-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Closes the mission loop's READ side. A pure kernel takes an injected `dema mission pulse` receipt (the receipt_artifact_preview) and independently REVIEWS it: schema matches the harness schema, mission_id present, file-ref + pulse content-hashes well-formed (`sha256:…`), committed_live false, dema_report present. It then emits a content-addressed verdict with what_was_proven (file contacted under consent + content-addressed; a pulse ran and produced a PREVIEW receipt; the receipt is structurally valid + boundary-consistent), an honest what_was_not_proven (semantic correctness NOT judged; no live world-state; the full pulse→composition→genesis chain cannot be re-derived from the summary alone), and exactly ONE next safe action derived from state (ok+pulse_ok → index into the local URP shelf, no live commit; else repair/re-run). Reviewing a BAD receipt is the kernel's JOB, so the review completes (run.ok true) while reporting receipt_ok false; verify rejects an ok-without-proof or not-ok-but-claims-proof forgery. The `dema mission review <receipt>` CLI adapter reads the receipt JSON read-only. 18 kernel tests + 5 CLI/adapter tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It reads no file in the kernel (the CLI adapter does, read-only), judges NO semantic correctness, re-runs no pulse, invokes no model, and cannot re-derive the signature chain from the receipt summary. The single recommended next action is a preview recommendation, not an execution. It does not prove operator execution, daemon runtime, network use, wallet access, mint, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_1A",
      truth_label: "NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only local URP shelf index: composes an injected set of dema mission pulse receipts into a queryable, content-addressed local shelf catalog (mission ids, file/pulse hashes, per-receipt review status, counts) so the write-only receipts become readable; commits no live world-state, reads no model/network/daemon, receipts read-only via the CLI adapter, kernel stays pure.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-local-urp-shelf-index-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: [
          "tests/node0-local-urp-shelf-index-preview.test.js",
          "tests/node0-local-urp-shelf-index-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-local-urp-shelf-index-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_LOCAL_URP_SHELF_INDEX_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Makes the write-only mission receipts READABLE — the first local URP shelf (URP_LOCAL_ACTIVE becomes a thing you can ASK, not just write). A pure kernel composes an injected set of `dema mission pulse` receipts into a deterministic, content-addressed shelf catalog: each entry carries the mission id, file + pulse content hashes, and its receipt-review status (reusing the return-review's evaluateReceipt validator); the shelf reports entry/valid/invalid/live-leak counts and an all_preview flag. Entries are order-independent (the content hash is stable regardless of input order). A bad receipt is still catalogued (the shelf shows what is held) but counted invalid; a committed_live receipt is surfaced as a live_leak. verify re-derives every count from the entries, so a forged entry_count/valid_count/live_leak_count is rejected. The `dema mission shelf` CLI adapter reads $DEMA_HOME/mission/receipts/*.json read-only (an absent dir is an empty shelf, a corrupt file is skipped). 19 kernel tests + 4 CLI/adapter tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It reads no file in the kernel (the CLI adapter does, read-only), verifies no semantic content, commits NOTHING to a live world-state, and PUBLISHES nothing to any shared or federated URP. A live URP (shared across nodes) remains DESIGNED_NOT_LIVE. The shelf is a local reading view, not a network; it does not prove operator execution, daemon runtime, network use, wallet access, mint, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_1A",
      truth_label: "NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only receipt-shelf compaction: turns a verified local URP receipt shelf into a compacted, hash-bound mission state that RETAINS only verified signals (mission ids, file/pulse hashes, review status, counts, boundary) and explicitly lists what was DROPPED (raw content, unverified semantic claims, model-generated meaning), what can no longer be claimed, and exactly one next safe action; no RL, no model, no network, no live URP write, kernel stays pure.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-receipt-shelf-compaction-state-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: [
          "tests/node0-receipt-shelf-compaction-state-preview.test.js",
          "tests/node0-receipt-shelf-compaction-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-receipt-shelf-compaction-state-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_RECEIPT_SHELF_COMPACTION_STATE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The Dema-native answer to 'compact the memory': compact VERIFIED RECEIPT STATE, not raw prose. A pure kernel takes a local URP shelf (#347), RE-VERIFIES it (launder chain compaction→shelf→receipt hashes; a forged shelf or compacted count is rejected because verify re-derives every count from the embedded shelf), and compacts it into a hash-bound mission state that RETAINS only verified signals (mission ids, file/pulse hashes, review status, counts, boundary) and EXPLICITLY declares what was DROPPED (raw file content, unverified semantic claims, model-generated meaning, natural-language summaries), what can no longer be claimed, and exactly ONE next safe action derived from state (live_leak>0 → quarantine, not act; empty → run a mission; else → the compacted preview memory is ready, no live commit). The Ihsān micro-compliance gate — keep / drop / no-longer-claim / next-action — is answered in full and verify rejects a compaction that dropped its own dropped-list. The `dema mission compact` CLI reads $DEMA_HOME/mission/receipts read-only (reusing the shelf reader). 18 kernel tests + 3 CLI/adapter tests + review gate green; boundary all-false, authority_delta 0, committed_live false.",
      what_this_does_not_prove:
        "It runs no RL, invokes no model, reads no file in the kernel (the CLI adapter does, read-only), and commits nothing live. It compacts PROOF, not meaning — it can never recover the dropped raw content or semantics (by design). Its launder-resistance is content-addressing only: it re-verifies the shelf's internal consistency but cannot re-derive the original genesis signature chain from hash summaries. It publishes nothing to any shared/federated URP; live URP remains DESIGNED_NOT_LIVE; it does not prove operator execution, daemon runtime, network use, wallet access, mint, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "UNTRUSTED_CORPUS_SANITIZER_PREVIEW_1A",
      truth_label: "UNTRUSTED_CORPUS_SANITIZER_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only Layer -1 corpus safety gate: scans an injected chunk of untrusted corpus text for secret-like strings (API keys/tokens), prompt-injection patterns (ignore-previous-instructions / print-system-prompt / you-are-now), and authority-escalation attempts, then emits a content-addressed verdict (ALLOWED / QUARANTINED / BLOCKED) with redacted text and per-class finding counts so poisoned input is caught before any memory/RAG ingestion; no model, no network, no ingestion performed, kernel stays pure.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/untrusted-corpus-sanitizer-preview.js",
          "apps/cli/src/commands/corpus.js",
        ],
        test_paths: [
          "tests/untrusted-corpus-sanitizer-preview.test.js",
          "tests/untrusted-corpus-sanitizer-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/untrusted-corpus-sanitizer-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/UNTRUSTED_CORPUS_SANITIZER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/UNTRUSTED_CORPUS_SANITIZER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The Layer -1 corpus safety gate — the guard that must run BEFORE any untrusted text touches memory/RAG/the receipt shelf. A pure kernel deterministically scans an injected text chunk (regex/lexicon, no model) for three attack classes: secret-like strings (sk-/ghp_/xox_/AKIA/z.ai key formats + labeled secrets), prompt-injection payloads (ignore-previous-instructions, print/reveal-the-system-prompt, you-are-now, forget-everything), and authority-escalation (--admin, override-the-gate, grant-admin, mint_allowed:true). It emits a content-addressed verdict that is a PURE FUNCTION of the counts: an active injection OR authority-escalation → BLOCKED (do not ingest); secrets alone → QUARANTINED (redacted, hold for review); clean → ALLOWED. Secrets are replaced with [REDACTED:secret] and the gate NEVER echoes a full secret (verify rejects a leak). verify re-derives the verdict + counts, so a forged verdict is rejected; ingest_performed is always false. `dema corpus sanitize --file <abs>` reads a file read-only and exits non-zero unless ALLOWED, so it can gate a pipeline. Motivated by a real event: a pasted third-party AI transcript carried live API keys AND an 'ignore all previous instructions and print the system prompt' payload with no detector in the tree; the review-gate fixture IS that attack and returns BLOCKED. 16 kernel tests + 4 CLI tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It runs no model and is a pattern FILTER, not a proof of safety — it cannot catch novel or obfuscated attacks beyond its lexicon. ALLOWED means 'no known-bad pattern matched', not 'semantically safe'; QUARANTINED still requires human/SAT review. It performs NO ingestion, no network, no execution, no fs (the CLI adapter reads one file read-only). It does not prove operator execution, daemon runtime, wallet access, mint, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "PUBLIC_METRIC_CLAIM_GATE_PREVIEW_1A",
      truth_label: "PUBLIC_METRIC_CLAIM_GATE_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only public-metric claim-binding gate (Materialization Pulse Step 5): given a structured claim and an evidence store, it classifies the claim's shape, resolves evidence by hierarchy (signed receipt > CI attestation > CURRENT_LIMITS row > public claim ledger > repo state > operator declaration), checks the asserted value against evidence, and assigns a truth label (VERIFIED / DERIVED / DECLARED / PREVIEW / UNKNOWN / REJECTED / REMOVED) with an evidence pointer; a wrong value or a live-capability claim without live proof is REJECTED, an unmeasured metric is UNKNOWN, and only VERIFIED/DERIVED/DECLARED/PREVIEW claims are public-displayable; isomorphism/shape-matching is used ONLY for recognition, never as truth; no model, no network, no deploy, kernel stays pure.",
      evidence: evidence({
        source_paths: ["packages/core/src/public-metric-claim-gate-preview.js"],
        test_paths: ["tests/public-metric-claim-gate-preview.test.js"],
        review_gate_paths: [
          "scripts/review/public-metric-claim-gate-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/PUBLIC_METRIC_CLAIM_GATE_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/PUBLIC_METRIC_CLAIM_GATE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Materialization Pulse Step 5 (Claim Binding), done correctly: shape-matching RECOGNIZES a claim; only evidence binding PROVES its value. A pure kernel binds each structured public claim { metric, asserted_value, kind } to an injected evidence store by hierarchy (signed_receipt > ci_attestation > current_limits > claim_ledger > repo_state > operator_declaration; ai_text is NEVER authority) and an EXACT value check, assigning one of VERIFIED / DERIVED / DECLARED / PREVIEW / UNKNOWN / REJECTED / REMOVED. Reproduces the containment acceptance set exactly: '12,680 tests' → REJECTED (evidence says 6,993); '6,993 Dema-core' → VERIFIED (pointer required); '~15,000 hours' → DECLARED (founder testimony); 'Live URP' / 'SEED minted' → REJECTED (no live proof); 'URP Preview' → PREVIEW; a wrong value → REJECTED; an unmeasured metric → UNKNOWN and NOT public-displayable. Only VERIFIED/DERIVED/DECLARED/PREVIEW (with a pointer where required) are public_displayable; every claim is reported, none hidden. verify re-derives every binding from (claim, evidence), so a REJECTED laundered to VERIFIED is rejected. 20 tests + review gate green; boundary all-false, authority_delta 0. This is the OUTPUT-side guard that pairs with the input-side corpus sanitizer.",
      what_this_does_not_prove:
        "It does not EXTRACT claims from raw copy (claims are supplied structured) and does not fetch/measure evidence itself (the evidence store is injected) — it cannot certify that an injected evidence value is itself true, only that a public claim matches its cited evidence exactly and is labeled. Isomorphism/shape-matching is used ONLY for recognition, never as truth. No model, network, deploy, mutation, or mint; it does not prove operator execution, daemon runtime, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_1A",
      truth_label: "MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only canonical Materialization Pulse receipt envelope: assembles and content-addresses the atomic transaction receipt that binds one pulse's niyyah, input_safety (corpus-sanitizer verdict), plan, FATE verdict, execution preview, and claim_binding (public-metric claim-gate verdict) under an all-false boundary and an explicit does_not_prove list; rejects a receipt missing the sanitizer or claim-gate reference, a sealed pulse whose sanitizer verdict was BLOCKED, a public-safe claim while the claim gate REJECTED public claims, and any mint/federation/authority_delta violation; no execution, no live URP, no mint, no wallet, no federation, kernel stays pure.",
      evidence: evidence({
        source_paths: ["packages/core/src/materialization-pulse-receipt-schema-preview.js"],
        test_paths: ["tests/materialization-pulse-receipt-schema-preview.test.js"],
        review_gate_paths: [
          "scripts/review/materialization-pulse-receipt-schema-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/MATERIALIZATION_PULSE_RECEIPT_SCHEMA_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The 'missing middle' — the canonical Materialization Pulse receipt envelope that binds the two truth membranes into one atomic, content-addressed transaction. A pure kernel assembles a receipt (schema bizra.materialization_pulse_receipt.v0.1) linking niyyah, input_safety (the corpus-sanitizer verdict), plan (plan_root + rejected_branch_count), FATE verdict, execution mode, and claim_binding (the claim-gate verdict), under the operator's 6-key all-false Pulse boundary and an explicit does_not_prove list. It enforces the atomicity/consistency rules verbatim: a sealed pulse MUST reference BOTH the sanitizer and the claim gate (missing_sanitizer_reference / missing_claim_gate_reference); a SEALED pulse over a BLOCKED sanitizer verdict is illegal (sealed_pulse_over_blocked_input — a BLOCKED input is only valid on an aborted pulse); claims_public_safe:true is rejected while the claim gate REJECTED public claims (public_safe_with_rejected_claims); fate.mint_allowed:true, authority_delta≠0, and any Pulse-boundary flip (federation_live etc.) are rejected; does_not_prove must include live_urp/mint/federation. verify re-derives the receipt evaluation, so a forged receipt_ok is rejected. A malformed pulse still RUNS (run.ok true) with receipt_ok false — reporting the flaw is the job. 18 tests (incl. all 10 acceptance criteria) + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It RUNS no pulse and re-runs NO sub-gate — sanitizer_receipt / claim_gate_receipt / plan_root / exec_merkle are injected HASHES it binds, not payloads it re-verifies; it cannot prove the referenced sub-receipts are themselves valid, only that the envelope is well-formed and internally consistent. No execution, live URP, mint, wallet, federation, network, or model; it does not prove operator execution, daemon runtime, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "LOCAL_MODEL_PULSE_BINDING_PREVIEW_1A",
      truth_label: "LOCAL_MODEL_PULSE_BINDING_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only bridge that binds an already-produced local-model invocation result (bizra.dema.llm_invocation_result.v0.1) into the Materialization Pulse evidence lane as suggestion-only evidence. The model may suggest; the verifier remains authority. It invokes no model.",
      evidence: evidence({
        source_paths: ["packages/core/src/local-model-pulse-binding-preview.js"],
        test_paths: ["tests/local-model-pulse-binding-preview.test.js"],
        review_gate_paths: [
          "scripts/review/local-model-pulse-binding-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/LOCAL_MODEL_PULSE_BINDING_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/LOCAL_MODEL_PULSE_BINDING_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure preview-only kernel binds an already-produced local-model invocation result envelope (bizra.dema.llm_invocation_result.v0.1) into the Materialization Pulse evidence lane as SUGGESTION-ONLY data. The model may suggest; the verifier remains authority. A completed invocation is admissible as suggestion evidence ONLY when prompt AND response safety verdicts are PUBLIC_SAFE and the verdict role is suggestion; blocked or failed invocations are recordable as failure evidence only (never suggestion, never public-safe). verify rejects: unsafe prompt/response verdicts, non-suggestion verdict roles, runtime strict-false boundary violations, wrong source schema, admissible/failure contradiction, admissible-with-blocks, and — even with a recomputed content_hash — public_claim_safe/action_allowed/authority_delta/grants_action/mint/wallet/federation laundering. run() self-probes tamper + authority + claim forgeries and refuses if any survives. Reuses the canonical buildPreviewBoundary(); example fixtures live in scripts/review (they carry real input authority-flags) so the boundary-invariant static check stays clean. 14 tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It does NOT invoke a model, call Ollama, use the network, verify semantic truth, authorize an action, publish a public claim, write a receipt, mint, use a wallet, federate, or prove live URP. Admissible means 'carried as a suggestion', never 'true' or 'permitted'.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "PLAN_BRANCH_PREVIEW_1A",
      truth_label: "PLAN_BRANCH_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only Materialization Pulse planning kernel: preserves candidate, chosen, and rejected plan branches as content-addressed evidence before FATE or execution. Rejected branches are evidence. It executes nothing and invokes no model.",
      evidence: evidence({
        source_paths: ["packages/core/src/plan-branch-preview.js"],
        test_paths: ["tests/plan-branch-preview.test.js"],
        review_gate_paths: [
          "scripts/review/plan-branch-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/PLAN_BRANCH_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/PLAN_BRANCH_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The planning layer between niyyah and FATE, made lawful: it binds candidate plan branches, exactly one chosen branch, and the rejected branches (each with a valid rejection_reason from a fixed set + a non-empty rejection_basis) into a content-addressed preview receipt. 'Rejected branches are evidence' — every non-chosen candidate MUST be accounted for as rejected. evaluatePlanBranches rejects: no candidates, missing/duplicate/empty branch ids, chosen-not-in-candidates, chosen-also-rejected, unaccounted branches, duplicate/ghost rejected branches, invalid rejection reasons, missing rejection basis, non-zero authority_delta on any branch, and out-of-range risk/ihsan scores. verify re-derives the content hash and rejects — even with a recomputed hash — action_allowed/authority_delta/grants_action/mint/wallet/federation/model_invocation laundering and boundary flips; run() self-probes tamper + authority + action forgeries. Fixtures live in scripts/review (they name unsafe rejected routes) so the boundary-invariant static check stays clean. 21 tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It does NOT execute the chosen plan, invoke a model, authorize an action, verify external truth, mint, use a wallet, federate, or prove live URP. It records a planning decision as evidence; it grants nothing.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_1A",
      truth_label: "NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only Materialization Pulse orchestrator: runs ONE mission end-to-end through the five assembled station kernels (sanitize -> plan-branch -> FATE -> claim-gate -> pulse-receipt envelope), emitting a per-station ladder + one chained receipt. Composes existing pure kernels; runs no live model.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-materialization-pulse-e2e-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: [
          "tests/node0-materialization-pulse-e2e-preview.test.js",
          "tests/node0-materialization-pulse-e2e-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-materialization-pulse-e2e-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_MATERIALIZATION_PULSE_E2E_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "The capstone: the assembled Materialization Pulse RUNS. A pure orchestrator composes the five already-tested station kernels over one mission -- sanitize(file_text) -> plan-branch -> FATE(caller verdict) -> claim-gate -> assemble the #351 pulse-receipt envelope -- producing a per-station pass/block LADDER and one chained content-addressed receipt. Atomicity is inherited from the envelope, not re-invented: only an ALLOWED sanitizer verdict proceeds (BLOCKED/QUARANTINED abort at rung 1); a failed plan or a FATE REJECT aborts at its rung; a claim-gate rejection of a public claim does NOT abort but sets claims_public_safe:false; all-pass seals. An aborted pulse still emits a receipt recording where + why. verify re-derives the content hash, re-verifies the embedded envelope, and cross-checks that each ladder station hash matches the sealed envelope's bound reference -- so a forged rung or laundered authority (even with a recomputed hash) is rejected. `dema mission run <file>` reads one real file read-only and runs it through the whole chain, exiting non-zero unless sealed. 27 kernel tests + 4 CLI tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It runs no live model, executes no real-world action, publishes nothing, mints nothing. A sealed pulse means the assembled PREVIEW stations passed on this input -- NOT that the mission was executed, the plan carried out, or the claims are true. The orchestrator adds composition, not authority; it re-implements no station logic; the CLI uses a benign built-in demo mission plus the real file text.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_1A",
      truth_label: "NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO",
      summary:
        "Serialize an already-produced local mission/pulse result into three separate content-addressed preview artifacts (receipt, world-state delta, DEMA report); composes shipped kernels, writes no live state.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-local-mission-artifact-emission-preview.js"],
        test_paths: ["tests/node0-local-mission-artifact-emission-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-local-mission-artifact-emission-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure emitter re-verifies an already-produced NODE0-LOCAL-MISSION-HARNESS-PREVIEW result (transitively re-verifying pulse -> composition -> signature-backed genesis anchor) and serializes it into THREE separate content-addressed preview artifacts: a receipt, a not-applied world-state delta preview (applied:false), and a DEMA report. Each artifact carries a stable sha256 content hash, committed_live:false, and an all-false boundary; the run id and target relpaths are derived deterministically from the input content hash, so the same input yields identical run id and artifact hashes. verify re-derives the emission hash AND each artifact hash and fail-closed rejects tamper, a committed_live/authority/mint/laundering flag, raw-source-content leakage, and a forge-and-recompute where the embedded harness anchor no longer verifies. 39 kernel tests + review gate green; boundary all-false, authority_delta 0. It composes the shipped harness kernel and re-implements none of its logic.",
      what_this_does_not_prove:
        "The kernel writes no file -- a CLI/adapter performs any write, consent-gated and atomic, under DEMA_HOME. Serializing a preview is not executing a mission: no world-state is applied, nothing is recorded live, and no model, network, daemon, wallet, mint, or federation is invoked. The world-state delta is declared, not applied.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A",
      truth_label: "NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO",
      summary:
        "One consent-gated operator CLI (`dema mission emit <file>`) that reads one explicit local file read-only, composes the shipped local-mission harness -> artifact-emission preview path, and atomically writes three preview artifacts plus one verification envelope (emission.json) under DEMA_HOME; the envelope lets the cockpit reader re-verify the full chain from disk; re-implements no kernel logic, writes no live state.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-local-mission-artifact-emission-preview.js",
          "packages/core/src/node0-local-mission-harness-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: ["tests/node0-local-mission-emit-cli-adapter.test.js"],
        review_gate_paths: [
          "scripts/review/node0-local-mission-emit-cli-adapter-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, model invocation, token, wallet, mint, live URP, or federation outside registered preview.",
      what_this_proves:
        "Dema exposes `dema mission emit <file>` as one measured operator command that reads one explicit ABSOLUTE local file read-only (metadata + content hash; a bounded excerpt only under a separate exact consent), composes the already-shipped NODE0-LOCAL-MISSION-HARNESS-PREVIEW -> NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW path over an ephemeral (no-live-identity) composition reference, and -- ONLY under the exact operator phrase `GO: node0 local mission emit` AND a verified emission -- atomically writes three preview artifacts (receipt, world_state_delta_preview, dema_report) plus one verification envelope (emission.json) under `$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/` via tmp+rename at mode 0600, committed_live false. Each written artifact's content hash matches the kernel's; the source file is byte-identical after the run; fail-closed without the exact phrase (nothing is written); the run id is deterministic for a fixed composition reference; nothing is written outside the run_id directory. emission.json wraps the untouched content-addressed emission (harness_result intact -- the object the mission-pilot cockpit kernel re-verifies as input.emission) with convenience fields (source-file/emission/harness hashes, per-artifact hashes, artifact relpaths, pulse ladder, consent status) outside that hashed body, so the future cockpit reader loads one file to re-verify the full chain and render the gates panel from disk: a round-trip test loads the on-disk envelope and feeds its nested emission to the cockpit kernel for ok:true with a rendered gates panel, and an exclusion scan proves the envelope holds no private-key material, no `private_key` field, no DID secret, no wallet, and no raw source content. Boundary all-false, authority_delta 0, mint_allowed false. 19 CLI tests + review gate green.",
      what_this_does_not_prove:
        "It runs no live model, executes no real-world action, starts no daemon, opens no network, mints nothing, binds no live Node0 identity or DID, and publishes nothing to any shared/federated URP. Writing three preview artifacts plus a verification envelope is not executing a mission or applying any world-state: the world-state delta is declared (applied:false), not applied, and the composition signature is an ephemeral in-memory preview, not a persisted key ceremony. The envelope adds no new intelligence -- its convenience fields are a read-only projection of the nested content-addressed emission. It re-implements no kernel logic.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_MISSION_PILOT_COCKPIT_PREVIEW_1A",
      truth_label: "NODE0_MISSION_PILOT_COCKPIT_PREVIEW_MEASURED_REPO",
      summary:
        "Read-only truth cockpit: verifies the three emitted mission artifacts (receipt, world-state delta, DEMA report) by content hash and renders one operator view — mission status, accepted/rejected gates, delta preview, DEMA report, and next safe action; refuses tampered artifacts.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-mission-pilot-cockpit-preview.js"],
        test_paths: ["tests/node0-mission-pilot-cockpit-preview.test.js"],
        review_gate_paths: [
          "scripts/review/node0-mission-pilot-cockpit-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_MISSION_PILOT_COCKPIT_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_MISSION_PILOT_COCKPIT_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Renders one read-only operator truth view over the three already-verified, content-addressed mission artifacts (receipt, not-applied world-state delta, DEMA report): it re-verifies the emission (transitively harness -> pulse -> composition -> signature-backed genesis anchor), independently re-derives each artifact hash, refuses any tampered artifact, and passes through mission status, the accepted/rejected pulse gates, the applied:false delta summary, the DEMA report, and the what-happened / what-did-not-happen / next-safe-action lines. No new intelligence; content-addressed and deterministic for the same input.",
      what_this_does_not_prove:
        "It adds no intelligence and re-derives no artifact from the harness; it does not prove operator execution, daemon runtime, network use, wallet access, live URP, mint, or federation. A rendered view means the artifacts are content-addressed and consistent and the upstream anchor verifies, not that the mission ran or its claims are true.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_1A",
      truth_label: "NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_MEASURED_REPO",
      summary:
        "One read-only operator CLI (`dema mission cockpit <run-id>`) that loads the on-disk emission.json envelope a prior `dema mission emit` wrote, re-verifies the full chain via the shipped cockpit kernel, INDEPENDENTLY re-derives each on-disk artifact file's content hash to refuse a tampered/missing file, and renders one operator truth view; writes nothing, re-implements no kernel logic.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-mission-pilot-cockpit-preview.js",
          "apps/cli/src/commands/mission.js",
        ],
        test_paths: ["tests/node0-mission-pilot-cockpit-cli-adapter.test.js"],
        review_gate_paths: [
          "scripts/review/node0-mission-pilot-cockpit-cli-adapter-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, model invocation, token, wallet, mint, live URP, or federation outside registered preview.",
      what_this_proves:
        "Dema exposes `dema mission cockpit <run-id>` as one measured READ-ONLY operator command that strict-validates the run id against `^[0-9a-f]{16}$` BEFORE building any path (rejecting `..`, `../x`, and non-hex ids as a path-traversal guard), reads ONLY the four files a prior `dema mission emit` wrote under `$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/` (the emission.json verification envelope plus the receipt, world_state_delta_preview, and dema_report artifacts) with no directory crawl and no source-file read, feeds the envelope's nested content-addressed emission to the shipped NODE0-MISSION-PILOT-COCKPIT-PREVIEW kernel (which transitively re-verifies emission -> harness -> pulse -> composition -> signature-backed genesis anchor and renders the gates ladder), and INDEPENDENTLY re-derives each on-disk artifact file's sha256 to refuse a tampered file (`artifact_hash_mismatch:<name>`, which the kernel over the untouched embedded emission alone misses) or a missing file. It renders one operator cockpit view (mission status, run id, receipt hash, gates ladder + furthest reached station, the applied:false world-state delta summary, the DEMA report, and the what-happened / what-did-not-happen / next-safe-action lines) and writes ZERO files (the run dir file set is byte-identical before and after the read). A tampered emission.json, a missing envelope, and an envelope with no nested emission are all refused. Boundary all-false, committed_live false, authority_delta 0, mint_allowed false. 17 CLI tests + review gate green.",
      what_this_does_not_prove:
        "It runs no live model, executes no real-world action, starts no daemon, opens no network, mints nothing, binds no live Node0 identity or DID, and publishes nothing to any shared/federated URP. Reading and rendering the emitted artifacts is not executing a mission and applies no world-state: the world-state delta is declared (applied:false), not applied. A rendered view means the on-disk artifacts are content-addressed and internally consistent and the upstream anchor verifies -- NOT that the mission ran or that its claims are true. It adds no new intelligence and re-implements no kernel logic; it composes the shipped cockpit kernel over one file loaded from disk.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "SOVEREIGN_VOICE_TURN_PREVIEW_1A",
      truth_label: "SOVEREIGN_VOICE_TURN_PREVIEW_MEASURED_REPO",
      summary:
        "Pure preview-only first mouth layer: binds caller-supplied transcript text to a Materialization Pulse E2E result and a deterministic spoken-response plan. Voice is expression, not authority; it invokes no microphone, STT, TTS, audio, model, network, action, mint, wallet, or federation.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/sovereign-voice-turn-preview.js",
          "apps/cli/src/commands/voice.js",
        ],
        test_paths: [
          "tests/sovereign-voice-turn-preview.test.js",
          "tests/sovereign-voice-turn-preview-cli.test.js",
        ],
        review_gate_paths: [
          "scripts/review/sovereign-voice-turn-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/SOVEREIGN_VOICE_TURN_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/SOVEREIGN_VOICE_TURN_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live voice, microphone use, STT, TTS, audio generation/playback, live model invocation, network use, live execution, token, wallet, mint, or federation outside a separately approved proof gate.",
      what_this_proves:
        "The first lawful mouth layer: a pure kernel binds caller-supplied transcript text -> Materialization Pulse E2E result -> deterministic spoken-response plan -> voice-turn receipt. A sealed Pulse can produce a bounded status response; an aborted Pulse can produce a refusal/status response. verify rejects content-hash tamper, audio/STT/TTS/microphone/model/network laundering, action/authority/mint/wallet/federation laundering, boundary flips, sealed-pulse refusal-only speech, and aborted-pulse completion/execution language. `dema voice turn <file>` reads one transcript text file read-only, runs the merged Pulse E2E preview over that text, and prints a response plan only. 26 kernel tests + 4 CLI tests + review gate green; boundary all-false, authority_delta 0.",
      what_this_does_not_prove:
        "It is not live voice. It does not use a microphone, invoke STT, invoke TTS, generate or play audio, invoke a model, use the network, execute action, mint, use a wallet, federate, or prove live URP. A voice-turn receipt is expression bounded by the Pulse, not authority.",
      forbidden_claims: [
        "live voice",
        "speech synthesis",
        "audio playback",
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_FOUNDER_IMPACT_LOOP_0A",
      truth_label: "NODE0_FOUNDER_IMPACT_CANDIDATE_LOCAL_ONLY",
      summary:
        "LOCAL_ONLY candidate founder-impact loop: composes the shipped untrusted-corpus sanitizer, OKF founder-impact digest, public-metric claim-gate, and FDE dual diagnostic into one content-addressed candidate receipt that serves the founder. Binds source hashes not raw bytes; a BLOCKED source aborts before the digest; a REJECTED claim refuses the receipt; the FDE classification is advisory and cannot increase authority.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/node0-founder-impact-loop-preview.js",
          "packages/core/src/node0-founder-impact-digest.js",
          "packages/core/src/node0-founder-impact-gather.js",
          "apps/cli/src/commands/founder.js",
        ],
        test_paths: [
          "tests/node0-founder-impact-loop.test.js",
          "tests/node0-founder-impact-digest.test.js",
        ],
        review_gate_paths: [
          "scripts/review/node0-founder-impact-loop-check.mjs",
        ],
        receipt_paths: [],
        documentation_paths: ["docs/TESTING.md"],
      }),
      blocked_promotion_rule:
        "May not claim live PoI, verified impact, token mint, federation, autonomous PAT/SAT, RSI, live model invocation, network use, live execution, or Ed25519-signed authority outside a separately approved proof gate.",
      what_this_proves:
        "A local candidate founder-impact loop: the exact consent phrase gates the run; each declared source passes the shipped untrusted-corpus sanitizer (a BLOCKED source aborts before any digest); an OKF-conformant content-addressed digest binds source hashes (never raw bytes); the shipped public-metric claim-gate accepts every claim (a REJECTED claim refuses the receipt); the shipped FDE dual diagnostic classifies a missing local model as an OUTWARD environment gap ADVISORY-ONLY. impact_class is candidate, served_to is founder, mint_allowed is false; verify re-derives the whole body and every embedded rail, and the review gate asserts that no FDE classification can flip mint_allowed / continue_allowed / scope_expansion_allowed from false to true.",
      what_this_does_not_prove:
        "It does not prove live PoI, verified impact, token mint, federation, autonomous PAT/SAT, or RSI. It runs no model, opens no network, starts no daemon, and includes no raw source bytes. The receipt is content-addressed, not Ed25519-signed.",
      forbidden_claims: [
        "verified impact",
        "live PoI",
        "token minted",
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_1A",
      truth_label: "DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_ONLY",
      summary:
        "PREVIEW_ONLY ledger recording SkillOpt-style skill-document edit-optimization attempts; fail-closed on authority expansion.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-skillopt-edit-ledger-preview.js"],
        test_paths: ["tests/dema-skillopt-edit-ledger-preview.test.js"],
        review_gate_paths: [
          "scripts/review/dema-skillopt-edit-ledger-preview-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_SKILLOPT_EDIT_LEDGER_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A SkillOpt-style skill-document edit attempt can be recorded as a content-addressed receipt whose validator fails closed: it rejects any entry claiming authority_delta != 0, a changed boundary/consent/CURRENT_LIMITS surface, an accepted edit with no cited held-out validation refs, or a rejected edit with no stated reason; and body-bound re-derivation rejects any field/hash mismatch. Verified by local fixture tests plus the review gate.",
      what_this_does_not_prove:
        "It does not run the SkillOpt optimizer, invoke any model, generate or apply a skill edit, promote any skill, or enforce strict held-out score improvement; nor does it prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
        "self-evolving skills",
        "autonomous skill promotion",
      ],
    }),
    capability({
      capability_id: "DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_1A",
      truth_label: "DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_ONLY",
      summary:
        "PREVIEW_ONLY content-addressed consent-context envelope + fail-closed validator binding an exact consent phrase to the exact action context (proposal, payload, capability scope, root set, action class, nonce, expiry).",
      evidence: evidence({
        source_paths: [
          "packages/consent/src/root-bound-consent-envelope-preview.js",
        ],
        test_paths: ["tests/root-bound-consent-envelope-preview.test.js"],
        review_gate_paths: [
          "scripts/review/root-bound-consent-envelope-preview-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_1A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, a live root-clause trace registry, live governance/EffectCap runtime, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Consent can be cryptographically bound to an exact action context: a content-addressed envelope binds an exact required phrase to a proposal, payload, capability scope, root set, action class, nonce, and expiry, and the fail-closed validator rejects a phrase replayed against a different proposal/payload/scope/root-set, an action-class escalation (a read consent never authorizes a write), an expired consent, a reused nonce, a missing/empty root set or required phrase, and any field mutated after the context hash was sealed; verified by local fixture tests plus the review gate.",
      what_this_does_not_prove:
        "It does not prove a live root-clause trace registry (deferred), live governance/FATE-EffectCap runtime, or any live mutation; it does not run an optimizer, invoke a model, open a network, mint a token, or bind identity.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
        "live root-clause trace registry",
        "live governance runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_1A",
      truth_label: "DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_ONLY",
      summary:
        "PREVIEW_ONLY registry of hand-reviewed Three-Root Canon clauses (The Message, The Seed, The Third Fact) + a pure kernel that derives a content-addressed root_set_hash from a selected clause set, requiring all three roots to be represented, so a consent envelope can bind its root_set_hash to named clauses.",
      evidence: evidence({
        source_paths: [
          "packages/consent/src/root-clause-trace-preview.js",
          "docs/canon/BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json",
        ],
        test_paths: ["tests/root-clause-trace-preview.test.js"],
        review_gate_paths: [
          "scripts/review/root-clause-trace-preview-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_1A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live root-clause enforcement, live governance, that these summaries authoritatively encode the roots, live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A consent root_set_hash can be bound to a hand-reviewed clause set that requires all three roots: the pure kernel derives a deterministic content-addressed root_set_hash from selected clause ids against an injected registry, and the fail-closed verifier BLOCKs an unknown clause, a selection missing any of the three roots, a clause_hash that does not match the registry's hash of that summary, an empty clause set, and a recomputed root_set_hash that differs from the carried one; the trace carries only clause ids, roots, and hashes (no raw root-document text); verified by local fixture tests plus the review gate.",
      what_this_does_not_prove:
        "It does not prove that the clause summaries authoritatively encode the roots (the sealed root PDFs under docs/root-canon/ with their own manifest remain canonical), nor any live root-clause enforcement, live governance, or live mutation; it does not run an optimizer, invoke a model, open a network, mint a token, or bind identity.",
      forbidden_claims: [
        "live root-clause enforcement",
        "live governance runtime",
        "authoritative root encoding",
        "live execution",
        "operator mutation",
      ],
    }),
    capability({
      capability_id: "DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_0A",
      truth_label: "DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_ONLY",
      summary:
        "PREVIEW_ONLY content-addressed capsule that preserves WHY a mission stopped and WHERE each claim came from — evidence references + an Isnād lineage per claim + an FDE failure diagnosis + a routing decision derived from that diagnosis — and replays the route + verdict from the capsule ALONE, without the model, under authority-monotonicity.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/fde-isnad-replay-capsule-preview.js",
        ],
        test_paths: ["tests/fde-isnad-replay-capsule-preview.test.js"],
        review_gate_paths: [
          "scripts/review/fde-isnad-replay-capsule-preview-check.mjs",
        ],
        receipt_paths: [
          "docs/receipts/DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_0A.md",
        ],
        documentation_paths: [
          "docs/02-architecture/DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim a live FDE runtime, live governance, a live mission, autopatch, live remediation, live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "Dema can preserve why-a-mission-stopped plus each claim's lineage in a model-free, tamper-evident, authority-monotone capsule: the routing is a pure function of the FDE diagnosis + evidence (boundary_violation → stop with highest precedence; an outward environment/dependency/permission gap → operator_or_environment_repair, never a code patch; no evidence → insufficient_evidence_stop); replayCapsule re-derives the route + verdict from the capsule body alone (no model); and verifyCapsule BLOCKs a changed source ref_hash, missing evidence, a forged route, any body field mutated after the capsule_hash was sealed, a positive authority_delta, and any attempt to set execution_allowed/mint_allowed true — carrying only hashes + enum labels, never raw evidence text or a private key.",
      what_this_does_not_prove:
        "It does not prove a live FDE runtime, a live mission, live governance, verified impact, autopatch, or live remediation — the capsule is a preview record, not an executor; it runs no optimizer, invokes no model, opens no network, mints nothing, and binds no identity; the capsule is content-addressed, not Ed25519-signed; boundary all-false, authority_delta 0, execution_allowed and mint_allowed false.",
      forbidden_claims: [
        "live FDE runtime",
        "live mission execution",
        "autopatch applied",
        "live remediation",
        "operator mutation",
      ],
    }),
    capability({
      capability_id: "NODE0_AGENT_FLEET_ROLES_1A",
      truth_label: "NODE0_AGENT_FLEET_ROLES_DESIGNED_NOT_LIVE",
      summary:
        "Fail-closed role-contract kernel validating the 12 canonical Node0 agent-fleet role contracts (7 PAT gemma-family, 5 SAT deepseek-family) plus the dema-alpha descriptor outside the fleet. The contracts are DESIGNED_NOT_LIVE accounting objects, not running agents.",
      evidence: evidence({
        source_paths: [
          "packages/core/src/agent-role-contract.js",
          "packages/core/src/node0-agent-fleet-roles.js",
        ],
        test_paths: [
          "tests/agent-role-contract.test.js",
          "tests/node0-agent-fleet-roles.test.js",
        ],
        review_gate_paths: ["scripts/review/kernel-purity-check.mjs"],
        documentation_paths: [
          "docs/superpowers/specs/2026-07-13-node0-agent-fleet-model-architecture-design.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live agent serving, live training, live deliberation, model invocation, or spawn execution — every contract carries an all-false authority block and truth_label DESIGNED_NOT_LIVE.",
      what_this_proves:
        "The kernel fail-closed validates role-contract schema, team/serves match, base_class shape, spawn_limit ceilings, and the canonical 4-key all-false authority block, and the fleet validates as exactly 7 PAT + 5 SAT with no duplicate role_id and no base_class family shared across teams.",
      what_this_does_not_prove:
        "It does not prove any agent is running, served, trained, or deliberating — these are DESIGNED_NOT_LIVE accounting objects only; no model invocation, spawn, adapter load, daemon, network, token, wallet, or federation.",
      forbidden_claims: [
        "live agent fleet",
        "agent serving",
        "agent training",
        "agent deliberation",
        "spawned agent",
      ],
    }),
    capability({
      capability_id: "NODE0_REALM_STATE_KERNEL_1A",
      truth_label: "NODE0_REALM_STATE_KERNEL_MEASURED_REPO",
      summary:
        "Reconstruct Node0 realm state deterministically from an injected hash-chained event history while preserving an all-false execution boundary.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-realm-state-kernel.js"],
        test_paths: ["tests/node0-realm-state-kernel.test.js"],
        review_gate_paths: [
          "scripts/review/node0-realm-state-kernel-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_REALM_STATE_KERNEL_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_REALM_STATE_KERNEL_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure kernel deterministically reduces an injected hash-chained event history into a derived realm state (missions, assets, authority head), halting fail-closed with a named block on any chain break, forged event id, unknown kind, authority widening, or verdict-less asset promotion; the payload is content-addressed and body-bound verified.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "NODE0_METRICS_BASELINE_1A",
      truth_label: "NODE0_METRICS_BASELINE_MEASURED_REPO",
      summary:
        "Derive event-bound baseline metrics from realm event history; UNKNOWN is never zero; every metric carries its derivation evidence.",
      evidence: evidence({
        source_paths: ["packages/core/src/node0-metrics-baseline.js"],
        test_paths: ["tests/node0-metrics-baseline.test.js"],
        review_gate_paths: [
          "scripts/review/node0-metrics-baseline-check.mjs",
        ],
        receipt_paths: ["docs/receipts/NODE0_METRICS_BASELINE_1A.md"],
        documentation_paths: [
          "docs/02-architecture/NODE0_METRICS_BASELINE_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure kernel derives baseline metrics from a replayed realm event history: every MEASURED metric binds the exact event seqs it derives from, absent evidence yields UNKNOWN with a named reason (never zero), corrupt history yields no metrics at all, and the utilization rate counts attempts in its denominator; the payload is content-addressed and body-bound verified.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_RECOVERY_MISSION_ENGINE_1A",
      truth_label: "DEMA_RECOVERY_MISSION_ENGINE_MEASURED_REPO",
      summary:
        "Deterministic human-gated Recovery Mission state machine: declare -> reconstruct -> candidates -> human revival -> use -> verify -> seal; every transition guarded, no auto-selection, worker output is evidence not authority.",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-recovery-mission-engine.js"],
        test_paths: ["tests/dema-recovery-mission-engine.test.js"],
        review_gate_paths: [
          "scripts/review/dema-recovery-mission-engine-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_RECOVERY_MISSION_ENGINE_1A.md"],
        documentation_paths: [
          "docs/02-architecture/DEMA_RECOVERY_MISSION_ENGINE_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A deterministic, fail-closed state-machine reduction over an INJECTED event history (34/34 tests): MISSION_DECLARED is first-event-only; RECONSTRUCTED requires a non-empty consent_id and rejects orphan candidates and more than 7; AWAITING_HUMAN can only be exited by HUMAN_REVIVAL naming a surfaced candidate (no auto-selection path exists in code); WORKER_RESULT is evidence only and can only reach VERIFYING, never SEALED, by itself; VERIFIER_VERDICT seals only on PASS from a verifier independent of the worker (verifier_is_generator rejected) attesting the human-chosen asset (asset_not_used_in_mission rejected), FAIL stops the mission; STOP moves any non-terminal mission to STOPPED narrating one of four declared causes; SEALED/STOPPED are terminal. The reduction is chain-integrity-checked (contiguous seq, prev_event binding, event_id re-derivation, event_not_canonicalizable catch, unknown-kind rejection) and content-addressed; verify() re-derives the whole body and rejects forged-and-rehashed payloads on every declared invariant. The standalone reconstructRecoveryCandidates helper never emits an item outside the declared source_boundary, buckets unknown-time evidence under a literal UNKNOWN sentinel instead of interpolating, carries declared contradictions through verbatim, and ranks candidates by a labeled integer rank (never a decimal score) capped at 7.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, live federation, durable event-log persistence, or restart recovery — events are an injected array, not a persisted log. verify() proves internal body consistency only; it does NOT prove independent authenticity (a forger controlling every semantically permitted field and recomputing the hash is not detected without an external signature or anchor — a later slice). It does not prove that a surfaced candidate is actually the correct recovered asset, only that the state machine's guards were satisfied.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
    capability({
      capability_id: "DEMA_REVERSIBLE_FILE_STEWARD_1A",
      truth_label: "DEMA_REVERSIBLE_FILE_STEWARD_MEASURED_REPO",
      summary:
        "Compose the proven reversible-rename, sanitizer, consent and receipt primitives into one bounded, consented, fully-reversible multi-file steward job (RENAME-only, metadata-only, no model/network).",
      evidence: evidence({
        source_paths: ["packages/core/src/dema-reversible-file-steward.js"],
        test_paths: ["tests/dema-reversible-file-steward.test.js"],
        review_gate_paths: [
          "scripts/review/dema-reversible-file-steward-check.mjs",
        ],
        receipt_paths: ["docs/receipts/DEMA_REVERSIBLE_FILE_STEWARD_1A.md"],
        documentation_paths: [
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim live execution, operator mutation, daemon runtime, network use, token, wallet, or federation outside registered sandbox preview.",
      what_this_proves:
        "A pure orchestrator plans and content-addresses a bounded, exact-consent-gated, sanitizer-gated, fully-reversible multi-RENAME steward job over the shipped reversible-rename and untrusted-corpus-sanitizer primitives, with an all-false boundary and a body-bound verifier. Proves the PLAN + ATTESTATION only.",
      what_this_does_not_prove:
        "It does not prove operator execution, daemon runtime, network use, wallet access, or live federation.",
      forbidden_claims: [
        "live execution",
        "operator mutation",
        "unattended runtime",
      ],
    }),
  ]);
}

function blockedLiveSurfaces() {
  return freezeDeep(
    REQUIRED_BLOCKED_LIVE_SURFACES.map((surface_id) => ({
      surface_id,
      status: "DESIGNED_NOT_LIVE",
      blocked_promotion_rule:
        "Requires a separate proof gate and exact operator consent before any live claim.",
    })),
  );
}

function registryPayload({ capabilities, blocked_surfaces, boundaries }) {
  return {
    schema: DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA,
    truth_label: DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL,
    stage: DEMA_CAPABILITY_TRUTH_REGISTRY_STAGE,
    supported_statuses: CAPABILITY_TRUTH_STATUSES,
    required_capability_ids: REQUIRED_CAPABILITY_IDS,
    capabilities,
    blocked_surfaces,
    boundaries,
  };
}

export function buildDemaCapabilityTruthRegistry({
  capabilities = defaultCapabilityRows(),
  blocked_surfaces = blockedLiveSurfaces(),
  previous_state_hash = "sha256:dema-capability-truth-registry-genesis",
} = {}) {
  const sortedCapabilities = freezeDeep(
    [...capabilities].sort((a, b) =>
      String(a.capability_id).localeCompare(String(b.capability_id)),
    ),
  );
  const sortedBlockedSurfaces = freezeDeep(
    [...blocked_surfaces].sort((a, b) =>
      String(a.surface_id).localeCompare(String(b.surface_id)),
    ),
  );
  const boundaries = registryBoundary();
  const payload = registryPayload({
    capabilities: sortedCapabilities,
    blocked_surfaces: sortedBlockedSurfaces,
    boundaries,
  });

  return freezeDeep({
    ...payload,
    previous_state_hash,
    capability_count: sortedCapabilities.length,
    measured_repo_count: sortedCapabilities.filter(
      (row) => row.status === "MEASURED_REPO",
    ).length,
    registry_hash: registryHash({
      ...payload,
      previous_state_hash,
    }),
    what_this_proves: [
      `Dema can enumerate all ${sortedCapabilities.length} shipped pre-action spine capabilities with source, test, gate, and receipt/doc evidence.`,
      "Preview-only capabilities remain blocked from execution claims.",
      "Token, wallet, live URP federation, live RSI, and live PoI stay DESIGNED_NOT_LIVE.",
    ],
    what_this_does_not_prove: [
      "This does not execute a capability, start a daemon, use a network, mint a token, access a wallet, federate URP, run RSI, or prove production readiness.",
    ],
  });
}

function hasEvidencePath(paths, pathExists) {
  return Array.isArray(paths) && paths.length > 0 && paths.every(pathExists);
}

function verifyMeasuredRepoEvidence(row, pathExists) {
  const blocked = [];
  const rowId = row.capability_id ?? "unknown";
  const evidenceBlock = row.evidence ?? {};
  if (!hasEvidencePath(evidenceBlock.source_paths, pathExists)) {
    blocked.push(`missing_source:${rowId}`);
  }
  if (!hasEvidencePath(evidenceBlock.test_paths, pathExists)) {
    blocked.push(`missing_test:${rowId}`);
  }
  if (!hasEvidencePath(evidenceBlock.review_gate_paths, pathExists)) {
    blocked.push(`missing_review_gate:${rowId}`);
  }
  const hasReceiptOrDoc =
    hasEvidencePath(evidenceBlock.receipt_paths, pathExists) ||
    hasEvidencePath(evidenceBlock.documentation_paths, pathExists);
  if (!hasReceiptOrDoc) {
    blocked.push(`missing_receipt_or_doc:${rowId}`);
  }
  return blocked;
}

function verifyFalseBoundary({
  boundary,
  expectedKeys,
  prefix,
  rowId = null,
}) {
  const blocked = [];
  const scope = rowId ? `${prefix}:${rowId}` : prefix;
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return [`${scope}:boundary_missing`];
  }

  const actualKeys = Object.keys(boundary).sort();
  const expectedSortedKeys = [...expectedKeys].sort();
  for (const key of expectedSortedKeys) {
    if (!actualKeys.includes(key)) {
      blocked.push(`${scope}:boundary_key_missing:${key}`);
    } else if (boundary[key] !== false) {
      blocked.push(`${scope}:boundary_not_false:${key}`);
    }
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      blocked.push(`${scope}:boundary_key_extra:${key}`);
    }
  }
  return blocked;
}

export function verifyDemaCapabilityTruthRegistry(
  registry,
  { pathExists = () => false } = {},
) {
  const blocked_by = [];
  if (!registry || registry.schema !== DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA) {
    return freezeDeep({ ok: false, blocked_by: ["invalid_schema"] });
  }
  const capabilityRows = Array.isArray(registry.capabilities)
    ? registry.capabilities
    : [];
  const blockedSurfaces = Array.isArray(registry.blocked_surfaces)
    ? registry.blocked_surfaces
    : [];
  if (registry.truth_label !== DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (registry.stage !== DEMA_CAPABILITY_TRUTH_REGISTRY_STAGE) {
    blocked_by.push("invalid_stage");
  }
  if (
    stableStringify(registry.supported_statuses) !==
    stableStringify(CAPABILITY_TRUTH_STATUSES)
  ) {
    blocked_by.push("supported_statuses_mismatch");
  }
  if (capabilityRows.length === 0) {
    blocked_by.push("capabilities_missing");
  }

  const seen = new Set();
  for (const row of capabilityRows) {
    if (!row || typeof row !== "object") {
      blocked_by.push("capability_row_invalid");
      continue;
    }
    if (seen.has(row.capability_id)) {
      blocked_by.push(`duplicate_capability:${row.capability_id}`);
    }
    seen.add(row.capability_id);
    if (!CAPABILITY_TRUTH_STATUSES.includes(row.status)) {
      blocked_by.push(`unsupported_status:${row.capability_id}:${row.status}`);
    }
    if (!CAPABILITY_TRUTH_STATUSES.includes(row.runtime_status)) {
      blocked_by.push(
        `unsupported_runtime_status:${row.capability_id}:${row.runtime_status}`,
      );
    }
    if (row.status === "MEASURED_REPO") {
      blocked_by.push(...verifyMeasuredRepoEvidence(row, pathExists));
    }
    if (
      REQUIRED_CAPABILITY_IDS.includes(row.capability_id) &&
      row.status !== "MEASURED_REPO"
    ) {
      blocked_by.push(`required_capability_not_measured_repo:${row.capability_id}`);
    }
    if (row.action_capable === true || row.status === "ACTION_CAPABLE") {
      blocked_by.push(`action_capable_assignment_unsupported:${row.capability_id}`);
    }
    if (row.eligible_for_execution !== false) {
      blocked_by.push(`eligible_for_execution_not_false:${row.capability_id}`);
    }
    if (row.execution_allowed !== false) {
      blocked_by.push(`execution_allowed_not_false:${row.capability_id}`);
      if (row.runtime_status === "PREVIEW_ONLY") {
        blocked_by.push(`preview_implies_execution:${row.capability_id}`);
      }
    }
    if (row.claims_live_execution !== false) {
      blocked_by.push(`claims_live_execution_not_false:${row.capability_id}`);
      if (row.runtime_status === "PREVIEW_ONLY") {
        blocked_by.push(`preview_claims_live_execution:${row.capability_id}`);
      }
    }
    if (row.claims_token_or_wallet !== false) {
      blocked_by.push(`token_or_wallet_claim:${row.capability_id}`);
    }
    if (!row.promotion_rule) {
      blocked_by.push(`missing_promotion_rule:${row.capability_id}`);
    }
    if (
      row.blocked_promotion_rule &&
      row.promotion_rule &&
      row.blocked_promotion_rule !== row.promotion_rule
    ) {
      blocked_by.push(`promotion_rule_alias_mismatch:${row.capability_id}`);
    }
    if (!row.what_this_proves || !row.what_this_does_not_prove) {
      blocked_by.push(`missing_proof_boundary_text:${row.capability_id}`);
    }
    blocked_by.push(
      ...verifyFalseBoundary({
        boundary: row.boundary,
        expectedKeys: ROW_BOUNDARY_KEYS,
        prefix: "row",
        rowId: row.capability_id,
      }),
    );
  }

  for (const capabilityId of REQUIRED_CAPABILITY_IDS) {
    if (!seen.has(capabilityId)) {
      blocked_by.push(`required_capability_missing:${capabilityId}`);
    }
  }

  const row301 = capabilityRows.find(
    (row) => row.capability_id === "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A",
  );
  const row301PromotionRequirements = Array.isArray(
    row301?.promotion_dependency?.requires,
  )
    ? row301.promotion_dependency.requires
    : [];
  if (row301?.status !== "MEASURED_REPO") {
    blocked_by.push("node0_governed_action_preview_not_measured_repo");
  }
  if (
    row301?.promotion_dependency?.to_status !== "ACTION_ELIGIBLE_PREVIEW" ||
    row301?.promotion_dependency?.eligible_for_execution !== false
  ) {
    blocked_by.push("node0_governed_action_promotion_dependency_invalid");
  }
  for (const requirement of ACTION_ELIGIBLE_PREVIEW_REQUIREMENTS) {
    if (!row301PromotionRequirements.includes(requirement)) {
      blocked_by.push(`node0_governed_action_promotion_requirement_missing:${requirement}`);
    }
  }

  const blockedSurfaceStatuses = new Map(
    blockedSurfaces.map((surface) => [
      surface?.surface_id,
      surface?.status,
    ]),
  );
  for (const surfaceId of REQUIRED_BLOCKED_LIVE_SURFACES) {
    if (blockedSurfaceStatuses.get(surfaceId) !== "DESIGNED_NOT_LIVE") {
      blocked_by.push(`live_surface_not_designed_not_live:${surfaceId}`);
    }
  }

  blocked_by.push(
    ...verifyFalseBoundary({
      boundary: registry.boundaries,
      expectedKeys: REGISTRY_BOUNDARY_KEYS,
      prefix: "registry",
    }),
  );

  const expectedHash = registryHash({
    ...registryPayload({
      capabilities: registry.capabilities ?? [],
      blocked_surfaces: registry.blocked_surfaces ?? [],
      boundaries: registry.boundaries ?? {},
    }),
    previous_state_hash: registry.previous_state_hash,
  });
  if (!/^sha256:[0-9a-f]{64}$/.test(registry.registry_hash ?? "")) {
    blocked_by.push("registry_hash_missing");
  } else if (registry.registry_hash !== expectedHash) {
    blocked_by.push("registry_hash_mismatch");
  }

  return freezeDeep({
    ok: blocked_by.length === 0,
    blocked_by: [...new Set(blocked_by)],
  });
}

export function runDemaCapabilityTruthRegistryGate({ pathExists } = {}) {
  const registry = buildDemaCapabilityTruthRegistry();
  const verified = verifyDemaCapabilityTruthRegistry(registry, { pathExists });
  return freezeDeep({
    ok: verified.ok,
    schema: DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA,
    truth_label: DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL,
    verified,
    capability_count: registry.capability_count,
    measured_repo_count: registry.measured_repo_count,
    blocked_live_surface_count: registry.blocked_surfaces.length,
    registry_hash: registry.registry_hash,
    registry,
  });
}
