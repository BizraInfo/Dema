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
]);

const REQUIRED_BLOCKED_LIVE_SURFACES = Object.freeze([
  "TOKEN_ECONOMY",
  "WALLET_ACTIONS",
  "LIVE_URP_FEDERATION",
  "LIVE_RSI",
  "LIVE_POI",
]);

const REGISTRY_BOUNDARY_KEYS = Object.freeze([
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

const ROW_BOUNDARY_KEYS = Object.freeze([
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
  blocked_promotion_rule,
  forbidden_claims,
  what_this_proves,
  what_this_does_not_prove,
  promotion_dependency = null,
  blocked_by = [],
}) {
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
    promotion_rule: blocked_promotion_rule,
    promotion_dependency,
    blocked_by,
    execution_allowed: false,
    eligible_for_execution: false,
    action_capable: false,
    claims_live_execution: false,
    claims_token_or_wallet: false,
    blocked_promotion_rule,
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
      "Dema can enumerate the six shipped pre-action spine capabilities with source, test, gate, and receipt/doc evidence.",
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
  { pathExists = () => true } = {},
) {
  const blocked_by = [];
  if (!registry || registry.schema !== DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA) {
    return freezeDeep({ ok: false, blocked_by: ["invalid_schema"] });
  }
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
  if (!Array.isArray(registry.capabilities) || registry.capabilities.length === 0) {
    blocked_by.push("capabilities_missing");
  }

  const seen = new Set();
  for (const row of registry.capabilities ?? []) {
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
    if (!row.blocked_promotion_rule) {
      blocked_by.push(`missing_blocked_promotion_rule:${row.capability_id}`);
    }
    if (!row.promotion_rule) {
      blocked_by.push(`missing_promotion_rule:${row.capability_id}`);
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

  const row301 = (registry.capabilities ?? []).find(
    (row) => row.capability_id === "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A",
  );
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
    if (!row301?.promotion_dependency?.requires?.includes(requirement)) {
      blocked_by.push(`node0_governed_action_promotion_requirement_missing:${requirement}`);
    }
  }

  const blockedSurfaceStatuses = new Map(
    (registry.blocked_surfaces ?? []).map((surface) => [
      surface.surface_id,
      surface.status,
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
