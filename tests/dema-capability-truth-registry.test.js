import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  buildDemaCapabilityTruthRegistry,
  verifyDemaCapabilityTruthRegistry,
  runDemaCapabilityTruthRegistryGate,
  DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA,
  DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL,
  CAPABILITY_TRUTH_STATUSES,
  REQUIRED_CAPABILITY_IDS,
} from "../packages/core/src/dema-capability-truth-registry.js";

function pathExists(path) {
  return existsSync(path);
}

function capability(registry, capabilityId) {
  return registry.capabilities.find((row) => row.capability_id === capabilityId);
}

test("builds deterministic frozen 33-capability truth registry", () => {
  const first = buildDemaCapabilityTruthRegistry();
  const second = buildDemaCapabilityTruthRegistry();

  assert.equal(first.schema, DEMA_CAPABILITY_TRUTH_REGISTRY_SCHEMA);
  assert.equal(first.truth_label, DEMA_CAPABILITY_TRUTH_REGISTRY_TRUTH_LABEL);
  assert.deepEqual(first.supported_statuses, CAPABILITY_TRUTH_STATUSES);
  assert.equal(first.capability_count, 44);
  assert.equal(first.measured_repo_count, 44);
  assert.match(first.registry_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.registry_hash, second.registry_hash);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.capabilities[0].evidence.source_paths));
});

test("contains exactly the required pre-action spine capability rows", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  assert.deepEqual(
    registry.capabilities.map((row) => row.capability_id).sort(),
    [...REQUIRED_CAPABILITY_IDS].sort(),
  );
  for (const row of registry.capabilities) {
    assert.equal(row.status, "MEASURED_REPO");
    assert.equal(row.runtime_status, "PREVIEW_ONLY");
    assert.equal(row.execution_allowed, false);
    assert.equal(row.eligible_for_execution, false);
    assert.equal(row.action_capable, false);
    assert.equal(row.claims_live_execution, false);
    assert.equal(row.claims_token_or_wallet, false);
    assert.ok(Array.isArray(row.source_files));
    assert.ok(Array.isArray(row.test_files));
    assert.ok(Array.isArray(row.review_gate));
    assert.ok(Array.isArray(row.receipt_doc));
    assert.ok(row.what_this_proves.length > 0);
    assert.ok(row.what_this_does_not_prove.length > 0);
    assert.equal(row.promotion_rule, row.blocked_promotion_rule);
    assert.ok(row.blocked_promotion_rule.length > 0);
    assert.deepEqual(row.blocked_by, []);
  }
});

test("#301 is MEASURED_REPO only with checked-out source, test, gate, receipt, and docs on disk", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const row = capability(
    registry,
    "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A",
  );

  assert.equal(row.status, "MEASURED_REPO");
  assert.equal(row.runtime_status, "PREVIEW_ONLY");
  assert.ok(
    row.evidence.source_paths.includes(
      "packages/core/src/node0-governed-reversible-action-preview.js",
    ),
  );
  assert.ok(
    row.evidence.test_paths.includes(
      "tests/node0-governed-reversible-action-preview.test.js",
    ),
  );
  assert.ok(
    row.evidence.review_gate_paths.includes(
      "scripts/review/node0-governed-reversible-action-preview-check.mjs",
    ),
  );
  assert.ok(
    row.evidence.receipt_paths.includes(
      "docs/receipts/NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_1A.md",
    ),
  );
  assert.deepEqual(row.source_files, row.evidence.source_paths);
  assert.deepEqual(row.test_files, row.evidence.test_paths);
  assert.deepEqual(row.review_gate, row.evidence.review_gate_paths);
  assert.ok(row.receipt_doc.includes(row.evidence.receipt_paths[0]));
  assert.equal(row.promotion_dependency.from_status, "PREVIEW_ONLY");
  assert.equal(row.promotion_dependency.to_status, "ACTION_ELIGIBLE_PREVIEW");
  assert.equal(row.promotion_dependency.eligible_for_execution, false);
  for (const requirement of [
    "exact_go_phrase",
    "reversible_plan",
    "backup_manifest",
    "undo_manifest",
    "receipt_preview",
    "no_boundary_violation",
  ]) {
    assert.ok(row.promotion_dependency.requires.includes(requirement));
  }
  assert.equal(verifyDemaCapabilityTruthRegistry(registry, { pathExists }).ok, true);
});

test("MEASURED_REPO rows require source, test, review gate, and receipt or doc evidence", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const row = capability(registry, "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A");
  const missingSource = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((candidate) =>
      candidate.capability_id === row.capability_id
        ? {
            ...candidate,
            evidence: {
              ...candidate.evidence,
              source_paths: ["missing/apr-source.js"],
            },
          }
        : candidate,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(missingSource, {
    pathExists,
  });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "missing_source:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
    ),
  );
});

test("default verifier fails closed without a pathExists hook", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const missingSource = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((candidate) =>
      candidate.capability_id === "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A"
        ? {
            ...candidate,
            evidence: {
              ...candidate.evidence,
              source_paths: ["missing/apr-source.js"],
            },
          }
        : candidate,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(missingSource);

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "missing_source:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
    ),
  );
});

test("all required capability rows must stay MEASURED_REPO", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const downgraded = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((candidate) =>
      candidate.capability_id === "DEMA_NODE_SPACE_FILE_STEWARD_1A"
        ? {
            ...candidate,
            status: "PLANNED",
            evidence: {
              ...candidate.evidence,
              source_paths: [],
              test_paths: [],
              review_gate_paths: [],
              receipt_paths: [],
              documentation_paths: [],
            },
          }
        : candidate,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(downgraded, {
    pathExists,
  });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "required_capability_not_measured_repo:DEMA_NODE_SPACE_FILE_STEWARD_1A",
    ),
  );
});

test("review gate fails on missing test and missing review gate evidence", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const row = capability(registry, "AASR_NODE0_STATE_ROUTER_PREVIEW_1A");
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((candidate) =>
      candidate.capability_id === row.capability_id
        ? {
            ...candidate,
            evidence: {
              ...candidate.evidence,
              test_paths: [],
              review_gate_paths: [],
            },
          }
        : candidate,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "missing_test:AASR_NODE0_STATE_ROUTER_PREVIEW_1A",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "missing_review_gate:AASR_NODE0_STATE_ROUTER_PREVIEW_1A",
    ),
  );
});

test("PREVIEW_ONLY rows cannot imply execution or live claims", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "DEMA_NODE_SPACE_FILE_STEWARD_1A"
        ? {
            ...row,
            execution_allowed: true,
            claims_live_execution: true,
          }
        : row,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "preview_implies_execution:DEMA_NODE_SPACE_FILE_STEWARD_1A",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "preview_claims_live_execution:DEMA_NODE_SPACE_FILE_STEWARD_1A",
    ),
  );
});

test("unsupported status or runtime promotion fails closed", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "NODE0_MULTI_DEVICE_URP_MANIFEST_1A"
        ? {
            ...row,
            status: "LIVE",
            runtime_status: "EXECUTION_LIVE",
            action_capable: true,
            eligible_for_execution: true,
          }
        : row,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "unsupported_status:NODE0_MULTI_DEVICE_URP_MANIFEST_1A:LIVE",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "unsupported_runtime_status:NODE0_MULTI_DEVICE_URP_MANIFEST_1A:EXECUTION_LIVE",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "action_capable_assignment_unsupported:NODE0_MULTI_DEVICE_URP_MANIFEST_1A",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "eligible_for_execution_not_false:NODE0_MULTI_DEVICE_URP_MANIFEST_1A",
    ),
  );
});

test("execution and live claims are rejected even when runtime status is tampered", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A"
        ? {
            ...row,
            runtime_status: "MEASURED_REPO",
            execution_allowed: true,
            claims_live_execution: true,
          }
        : row,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "execution_allowed_not_false:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "claims_live_execution_not_false:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A",
    ),
  );
});

test("promotion rule alias mismatch fails clearly", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "AASR_NODE0_STATE_ROUTER_PREVIEW_1A"
        ? {
            ...row,
            promotion_rule: "canonical rule",
            blocked_promotion_rule: "different legacy alias",
          }
        : row,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "promotion_rule_alias_mismatch:AASR_NODE0_STATE_ROUTER_PREVIEW_1A",
    ),
  );
});

test("token, wallet, live URP federation, live RSI, and live PoI stay DESIGNED_NOT_LIVE", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const statusBySurface = new Map(
    registry.blocked_surfaces.map((surface) => [
      surface.surface_id,
      surface.status,
    ]),
  );

  for (const surface of [
    "TOKEN_ECONOMY",
    "WALLET_ACTIONS",
    "LIVE_URP_FEDERATION",
    "LIVE_RSI",
    "LIVE_POI",
  ]) {
    assert.equal(statusBySurface.get(surface), "DESIGNED_NOT_LIVE");
  }

  const tampered = buildDemaCapabilityTruthRegistry({
    blocked_surfaces: registry.blocked_surfaces.map((surface) =>
      surface.surface_id === "TOKEN_ECONOMY"
        ? { ...surface, status: "MEASURED_REPO" }
        : surface,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });
  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "live_surface_not_designed_not_live:TOKEN_ECONOMY",
    ),
  );
});

test("registry output hash detects tampering", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = {
    ...registry,
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "COVERAGE_TRUTH_GATE_1A"
        ? { ...row, summary: "tampered" }
        : row,
    ),
  };
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("registry_hash_mismatch"));
});

test("gate passes against the real merged repository files", () => {
  const gate = runDemaCapabilityTruthRegistryGate({ pathExists });

  assert.equal(gate.ok, true);
  assert.equal(gate.capability_count, 44);
  assert.equal(gate.measured_repo_count, 44);
  assert.equal(gate.blocked_live_surface_count, 5);
  assert.match(gate.registry_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(gate.verified.blocked_by, []);
});

test("all registry boundaries remain false", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  for (const [key, value] of Object.entries(registry.boundaries)) {
    assert.equal(value, false, `${key} must remain false`);
  }

  const tampered = {
    ...registry,
    boundaries: { ...registry.boundaries, network_used: true },
  };
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("registry:boundary_not_false:network_used"));
});

test("row boundary flips fail closed", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const tampered = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A"
        ? {
            ...row,
            boundary: { ...row.boundary, live_execution_performed: true },
          }
        : row,
    ),
  });
  const verified = verifyDemaCapabilityTruthRegistry(tampered, { pathExists });

  assert.equal(verified.ok, false);
  assert.ok(
    verified.blocked_by.includes(
      "row:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A:boundary_not_false:live_execution_performed",
    ),
  );
});

test("missing and extra boundary keys fail closed", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const missingRegistryBoundary = {
    ...registry,
    boundaries: Object.fromEntries(
      Object.entries(registry.boundaries).filter(([key]) => key !== "network_used"),
    ),
  };
  const missingRegistryVerified = verifyDemaCapabilityTruthRegistry(
    missingRegistryBoundary,
    { pathExists },
  );

  assert.equal(missingRegistryVerified.ok, false);
  assert.ok(
    missingRegistryVerified.blocked_by.includes(
      "registry:boundary_key_missing:network_used",
    ),
  );

  const extraRowBoundary = buildDemaCapabilityTruthRegistry({
    capabilities: registry.capabilities.map((row) =>
      row.capability_id === "APR_NODE0_ROUTE_REFINERY_PREVIEW_1A"
        ? {
            ...row,
            boundary: { ...row.boundary, invented_live_flag: false },
          }
        : row,
    ),
  });
  const extraRowVerified = verifyDemaCapabilityTruthRegistry(extraRowBoundary, {
    pathExists,
  });

  assert.equal(extraRowVerified.ok, false);
  assert.ok(
    extraRowVerified.blocked_by.includes(
      "row:APR_NODE0_ROUTE_REFINERY_PREVIEW_1A:boundary_key_extra:invented_live_flag",
    ),
  );
});

test("malformed capability and blocked-surface collections fail closed without throwing", () => {
  const registry = buildDemaCapabilityTruthRegistry();
  const malformed = {
    ...registry,
    capabilities: "not an array",
    blocked_surfaces: "not an array",
  };

  assert.doesNotThrow(() =>
    verifyDemaCapabilityTruthRegistry(malformed, { pathExists }),
  );
  const verified = verifyDemaCapabilityTruthRegistry(malformed, { pathExists });
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("capabilities_missing"));
  assert.ok(
    verified.blocked_by.includes(
      "required_capability_missing:COVERAGE_TRUTH_GATE_1A",
    ),
  );
  assert.ok(
    verified.blocked_by.includes(
      "live_surface_not_designed_not_live:TOKEN_ECONOMY",
    ),
  );
});
