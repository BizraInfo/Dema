// Genesis Composition Blueprint Preview — NODE0-OSTREE-1B surface.
//
// Pure deterministic builder. No I/O. No process.env. No Date. No network.
// It exposes the professional delivery blueprint around the already-tested
// NODE0-OSTREE-1A manifest kernel without building, signing, deploying, or
// persisting a composition manifest.

import { buildPreviewBoundary, PREVIEW_BOUNDARY_CANONICAL_KEYS } from "./preview-boundary.js";

export const GENESIS_COMPOSITION_BLUEPRINT_SCHEMA =
  "bizra.dema.genesis_composition_blueprint_preview.v0.1";

const MANIFEST_SCHEMA = "bizra.dema.node0_composition_manifest.v0.1";

const BLUEPRINT_DOMAINS = Object.freeze([
  Object.freeze({
    id: "management_body_of_knowledge",
    standard:
      "PMBOK-style value, stakeholder, risk, quality, and change control",
    dema_embodiment:
      "project-status preview, explicit typed-GO gates, risk register discipline, and proof-first phase progression",
    evidence_anchor: "packages/core/src/project-status-preview.js",
  }),
  Object.freeze({
    id: "devops_operating_model",
    standard:
      "immutable, rollback-aware, no-secret, no-hidden-daemon operations",
    dema_embodiment:
      "stdlib-only preview kernel, no libostree dependency, no daemon, no deploy surface, local-only verification",
    evidence_anchor: "docs/02-architecture/NODE0_OSTREE_TAD_v0_1.md",
  }),
  Object.freeze({
    id: "ci_cd_pipeline_automation",
    standard:
      "repeatable gate ladder with machine-readable evidence before release claims",
    dema_embodiment:
      "native Node tests, review scripts, release readiness, GTM readiness, URP discovery, proof-room replay, and git diff hygiene",
    evidence_anchor: "package.json",
  }),
  Object.freeze({
    id: "performance_quality_assurance",
    standard:
      "deterministic, adversarial, thresholded quality with bounded resource use",
    dema_embodiment:
      "composition manifest tests, canonical 16-key boundary, coverage thresholds, no repo scan, no clock in pure kernels",
    evidence_anchor: "tests/node0-composition-manifest.test.js",
  }),
]);

const PIPELINE_GATES = Object.freeze([
  Object.freeze({
    id: "composition_manifest_unit",
    command: "node --test tests/node0-composition-manifest.test.js",
    stage: "verify",
    purpose:
      "prove the manifest builder/verifier remains deterministic, signed, and fail-closed",
  }),
  Object.freeze({
    id: "full_native_test",
    command: "npm test",
    stage: "verify",
    purpose: "run the full native Node behavior suite",
  }),
  Object.freeze({
    id: "repo_check",
    command: "npm run check",
    stage: "quality_gate",
    purpose:
      "run review, canon, integration, readiness, proof-room, and closeout checks",
  }),
  Object.freeze({
    id: "llm_guidance",
    command: "npm run llm:guidance",
    stage: "governance_gate",
    purpose:
      "ensure agent routing still points to the canonical Dema system flow",
  }),
  Object.freeze({
    id: "release_readiness",
    command: "npm run release:readiness",
    stage: "release_gate",
    purpose: "verify release-blocking risks without publishing artifacts",
  }),
  Object.freeze({
    id: "gtm_readiness",
    command: "npm run gtm:readiness",
    stage: "market_gate",
    purpose: "verify public-claim and operator-gate readiness without outreach",
  }),
  Object.freeze({
    id: "urp_discovery",
    command: "npm run urp:discovery",
    stage: "resource_boundary_gate",
    purpose: "verify shared-runtime discovery stays discovery-only",
  }),
  Object.freeze({
    id: "proof_room",
    command: "npm run proof:room",
    stage: "evidence_bundle_gate",
    purpose: "compose replayable proof evidence without writing by default",
  }),
  Object.freeze({
    id: "diff_hygiene",
    command: "git diff --check",
    stage: "hygiene_gate",
    purpose: "reject whitespace and patch hygiene drift before commit",
  }),
]);

const BLOCKED_UNTIL_EXPLICIT_GO = Object.freeze([
  "seal_block0",
  "real_libostree_adoption",
  "atomic_deploy_or_rollback_surface",
  "federation_or_remote_pull",
  "receipt_mint_or_chain_advance",
  "modify_ci_workflows",
]);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

export function buildGenesisCompositionBlueprintPreview() {
  return deepFreeze({
    schema: GENESIS_COMPOSITION_BLUEPRINT_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    receipt_shape_ready: true,
    manifest_surface: {
      route: "NODE0-OSTREE-1A",
      schema: MANIFEST_SCHEMA,
      implementation_path: "packages/genesis/src/node0-composition-manifest.js",
      test_path: "tests/node0-composition-manifest.test.js",
      architecture_doc: "docs/02-architecture/NODE0_OSTREE_TAD_v0_1.md",
      cli_surface: "dema genesis composition blueprint",
      proof_boundary:
        "declares the delivery blueprint for a signed composition manifest; does not build or sign one",
    },
    blueprint_domains: BLUEPRINT_DOMAINS,
    delivery_model: {
      strategy: "preview_first_then_exact_go",
      management_cadence:
        "plan -> implement with failing tests -> verify -> evidence summary -> halt before irreversible acts",
      deployment_posture:
        "No libostree. No daemon. No federation. No deploy surface. Real adoption requires a separate typed GO.",
      rollback_model:
        "current state remains unchanged; future deploy/rollback belongs outside this Dema preview slice",
    },
    pipeline: {
      automation_model: "local_gate_ladder_before_any_release_or_public_claim",
      ci_workflow_mutation_allowed: false,
      gates: PIPELINE_GATES,
    },
    quality_thresholds: {
      coverage: {
        lines: 95,
        branches: 84,
        functions: 95,
        command: "npm run coverage",
      },
      boundary_keys_required: PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
      adversarial_test_posture:
        "fail-closed build and verify paths, tamper detection, external-pubkey-only authority",
      release_claim_rule:
        "green local gates do not close operator or external-evidence gates",
    },
    performance_model: {
      algorithmic_shape: "O(n) over supplied composition payload",
      repo_scan_performed: false,
      network_used: false,
      clock_read_inside_kernel: false,
      dependency_posture: "zero runtime dependency; no libostree in this slice",
      resource_control:
        "hash and signature work is bounded by the caller-supplied composition size",
    },
    risk_controls: Object.freeze([
      "exact-string consent before identity-bound or irreversible acts",
      "CI workflow mutation is halt-gated",
      "real libostree adoption is halt-gated because it changes dependency posture",
      "public claims remain tied to release, GTM, and proof-room gates",
      "Dema remains the face; governed runtime owns execution",
    ]),
    blocked_until_explicit_go: BLOCKED_UNTIL_EXPLICIT_GO,
    what_this_proves: Object.freeze([
      "The next delivery slice is professionally framed across management, DevOps, CI/CD, performance, and QA controls.",
      "The Node0 composition manifest remains a preview-governed delivery surface here.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "A sealed Block0, a live OSTree repo, deployment, rollback, federation, token activity, or receipt mint.",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function formatGenesisCompositionBlueprintPreview(preview) {
  const gates = preview.pipeline.gates
    .map((gate) => `  - ${gate.command} (${gate.stage})`)
    .join("\n");
  const domains = preview.blueprint_domains
    .map((domain) => `  - ${domain.id}: ${domain.dema_embodiment}`)
    .join("\n");
  return [
    "Node0 Composition Blueprint",
    "===========================",
    `Schema: ${preview.schema}`,
    `Manifest: ${preview.manifest_surface.schema}`,
    `Route: ${preview.manifest_surface.route}`,
    "",
    "Blueprint Domains:",
    domains,
    "",
    "Gate Ladder:",
    gates,
    "",
    `Quality: coverage lines ${preview.quality_thresholds.coverage.lines}% · branches ${preview.quality_thresholds.coverage.branches}% · functions ${preview.quality_thresholds.coverage.functions}%`,
    `Performance: ${preview.performance_model.algorithmic_shape}`,
    "",
    "Boundary:",
    `  ${preview.delivery_model.deployment_posture}`,
    "  No runtime execution. No network. No receipt mint.",
  ].join("\n");
}
