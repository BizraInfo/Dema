import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";
import {
  GENESIS_COMPOSITION_BLUEPRINT_SCHEMA,
  buildGenesisCompositionBlueprintPreview,
  formatGenesisCompositionBlueprintPreview,
} from "../packages/core/src/genesis-composition-blueprint-preview.js";

const execFileAsync = promisify(execFile);
const CLI_PATH = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const NODE = process.execPath;

function assertCanonicalBoundary(boundary) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
  assert.equal(
    Object.keys(boundary).length,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
  );
}

test("Genesis composition blueprint emits canonical preview schema and manifest target", () => {
  const preview = buildGenesisCompositionBlueprintPreview();
  assert.equal(preview.schema, GENESIS_COMPOSITION_BLUEPRINT_SCHEMA);
  assert.equal(
    preview.schema,
    "bizra.dema.genesis_composition_blueprint_preview.v0.1",
  );
  assert.equal(preview.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(preview.mode, "preview_only");
  assert.equal(
    preview.manifest_surface.schema,
    "bizra.dema.node0_composition_manifest.v0.1",
  );
  assert.equal(preview.manifest_surface.route, "NODE0-OSTREE-1A");
});

test("Genesis composition blueprint surfaces management, DevOps, CI/CD, and QA domains", () => {
  const preview = buildGenesisCompositionBlueprintPreview();
  const domains = preview.blueprint_domains.map((d) => d.id);
  assert.deepEqual(domains, [
    "management_body_of_knowledge",
    "devops_operating_model",
    "ci_cd_pipeline_automation",
    "performance_quality_assurance",
  ]);
  for (const domain of preview.blueprint_domains) {
    assert.ok(domain.standard.length > 0);
    assert.ok(domain.dema_embodiment.length > 0);
    assert.ok(domain.evidence_anchor.length > 0);
  }
});

test("Genesis composition blueprint lists the real local gate ladder and blocks CI mutation", () => {
  const preview = buildGenesisCompositionBlueprintPreview();
  const commands = preview.pipeline.gates.map((g) => g.command);
  for (const command of [
    "node --test tests/node0-composition-manifest.test.js",
    "npm test",
    "npm run check",
    "npm run llm:guidance",
    "npm run release:readiness",
    "npm run gtm:readiness",
    "npm run urp:discovery",
    "npm run proof:room",
    "git diff --check",
  ]) {
    assert.ok(commands.includes(command), `missing gate command: ${command}`);
  }
  assert.equal(preview.pipeline.ci_workflow_mutation_allowed, false);
  assert.ok(preview.blocked_until_explicit_go.includes("modify_ci_workflows"));
});

test("Genesis composition blueprint declares performance and quality thresholds", () => {
  const preview = buildGenesisCompositionBlueprintPreview();
  assert.equal(
    preview.performance_model.algorithmic_shape,
    "O(n) over supplied composition payload",
  );
  assert.equal(preview.performance_model.repo_scan_performed, false);
  assert.equal(preview.quality_thresholds.coverage.lines, 95);
  assert.equal(preview.quality_thresholds.coverage.branches, 85);
  assert.equal(preview.quality_thresholds.coverage.functions, 95);
  assert.equal(preview.quality_thresholds.boundary_keys_required, 16);
});

test("Genesis composition blueprint boundary is canonical all false and output is frozen", () => {
  const preview = buildGenesisCompositionBlueprintPreview();
  assertCanonicalBoundary(preview.boundary);
  assert.equal(Object.isFrozen(preview), true);
  assert.equal(Object.isFrozen(preview.pipeline.gates), true);
  assert.equal(Object.isFrozen(preview.boundary), true);
});

test("formatGenesisCompositionBlueprintPreview renders concise human evidence", () => {
  const out = formatGenesisCompositionBlueprintPreview(
    buildGenesisCompositionBlueprintPreview(),
  );
  assert.match(out, /Node0 Composition Blueprint/);
  assert.match(out, /bizra\.dema\.node0_composition_manifest\.v0\.1/);
  assert.match(out, /npm run check/);
  assert.match(out, /No libostree/);
  assert.match(out, /No daemon/);
});

test("dema genesis composition blueprint --json emits schema-tagged preview", async () => {
  const { stdout } = await execFileAsync(NODE, [
    CLI_PATH,
    "genesis",
    "composition",
    "blueprint",
    "--json",
  ]);
  const preview = JSON.parse(stdout);
  assert.equal(preview.schema, GENESIS_COMPOSITION_BLUEPRINT_SCHEMA);
  assert.equal(preview.boundary.federation_invoked, false);
});

test("dema genesis composition blueprint emits human summary", async () => {
  const { stdout } = await execFileAsync(NODE, [
    CLI_PATH,
    "genesis",
    "composition",
    "blueprint",
  ]);
  assert.match(stdout, /Node0 Composition Blueprint/);
  assert.match(stdout, /npm run check/);
  assert.match(stdout, /No libostree/);
});
