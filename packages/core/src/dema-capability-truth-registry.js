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
        ],
        documentation_paths: [
          "docs/02-architecture/DEMA_FDE_DUAL_DIAGNOSTIC_v0_1.md",
          "docs/TESTING.md",
        ],
      }),
      blocked_promotion_rule:
        "May not claim autopatch, live remediation, autonomous repair, or field execution without separate consent and proof gates.",
      what_this_proves:
        "Dema can classify failed commands into inward vs outward hypotheses with explicit confidence and missing evidence.",
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
        "Dema can Ed25519-sign a #306 sandbox execute receipt into a public-key-verifiable attestation envelope with tamper rejection on content_hash and state_hash binds.",
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
