import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  buildOptimizationRoadmapPreview,
  formatOptimizationRoadmapPreview,
} from "../packages/core/src/optimization-roadmap.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const modulePath = fileURLToPath(
  new URL("../packages/core/src/optimization-roadmap.js", import.meta.url),
);

function assertAcyclic(report) {
  const edgesBySource = new Map();
  for (const edge of report.risk_graph.edges) {
    edgesBySource.set(edge.from, [
      ...(edgesBySource.get(edge.from) ?? []),
      edge.to,
    ]);
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    assert.equal(visiting.has(id), false, `cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of edgesBySource.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  }

  for (const node of report.risk_graph.nodes) visit(node.id);
}

test("buildOptimizationRoadmapPreview emits a schema-tagged preview without effects", () => {
  const report = buildOptimizationRoadmapPreview();

  assert.equal(report.schema, "bizra.dema.optimization_roadmap_preview.v0.1");
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.boundary.execution_enabled, false);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.ci_workflow_modified, false);
  assert.equal(report.boundary.deployment_attempted, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.boundary.gates_enforced, false);
  assert.equal(report.boundary.gate_enforcement_changed, false);
  assert.equal(report.boundary.roadmap_executed, false);
  assert.equal(report.boundary.economic_claim_made, false);
});

test("buildOptimizationRoadmapPreview keeps proof pillars canonical and non-certifying", () => {
  const report = buildOptimizationRoadmapPreview();

  assert.deepEqual(Object.keys(report.proof_of_truth_convergence), [
    "formal",
    "cryptographic",
    "empirical",
    "economic",
  ]);
  assert.ok(
    Object.values(report.proof_of_truth_convergence).every(
      (pillar) =>
        pillar.certifies === false &&
        pillar.status !== "PERMIT" &&
        pillar.evidence_kind,
    ),
  );
});

test("roadmap items are advisory, ordered, and dependency-safe", () => {
  const report = buildOptimizationRoadmapPreview();
  const ids = new Set(report.roadmap_items.map((item) => item.id));
  const byId = new Map(report.roadmap_items.map((item) => [item.id, item]));
  const edgeKeys = new Set(
    report.risk_graph.edges.map((edge) => `${edge.from}->${edge.to}`),
  );

  assert.equal(ids.size, report.roadmap_items.length);
  assert.deepEqual(
    report.roadmap_items.map((item) => item.priority),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.ok(
    report.roadmap_items.every((item) => item.effect_class === "advisory_only"),
  );
  assert.ok(
    report.roadmap_items.every(
      (item) =>
        !/\b(implement|deploy|execute|mint|federate)\b/i.test(item.title),
    ),
  );
  assert.ok(report.roadmap_items.every((item) => item.blueprint_focus));
  assert.ok(
    report.roadmap_items.every((item) => item.management_knowledge_area),
  );
  assert.ok(report.roadmap_items.every((item) => item.quality_signal));
  assert.ok(report.roadmap_items.every((item) => item.pipeline_surface));
  assert.ok(report.roadmap_items.every((item) => item.integrity_constraint));

  for (const item of report.roadmap_items) {
    for (const dependency of item.depends_on) {
      assert.ok(ids.has(dependency));
      assert.notEqual(dependency, item.id);
      assert.ok(byId.get(dependency).priority < item.priority);
      assert.ok(edgeKeys.has(`${dependency}->${item.id}`));
    }
  }
  for (const edge of report.risk_graph.edges) {
    assert.ok(ids.has(edge.from));
    assert.ok(ids.has(edge.to));
    assert.ok(byId.get(edge.from).priority < byId.get(edge.to).priority);
  }
  assert.equal(
    report.risk_graph.edges.length,
    report.roadmap_items.reduce(
      (count, item) => count + item.depends_on.length,
      0,
    ),
  );
  assertAcyclic(report);
});

test("roadmap lenses and gates remain evidence-tagged and non-enforcing", () => {
  const report = buildOptimizationRoadmapPreview();
  const allowedGateStatuses = new Set([
    "already_local_practice",
    "advisory_read_only",
    "not_enforced",
  ]);

  assert.ok(report.pmbok_lenses.every((lens) => lens.canon_source));
  assert.ok(
    report.management_body_of_knowledge.every((lens) => lens.canon_source),
  );
  assert.ok(report.snr_lenses.every((lens) => lens.canon_source));
  assert.ok(report.sape_lenses.every((lens) => lens.canon_source));
  assert.ok(
    report.proposed_gates.some((gate) => gate.status === "not_enforced"),
  );
  assert.ok(
    report.proposed_gates.every((gate) => allowedGateStatuses.has(gate.status)),
  );
  assert.ok(report.proposed_gates.every((gate) => gate.enforcement_owner));
  assert.ok(
    report.proposed_gates.every(
      (gate) => gate.effect_class === "advisory_only",
    ),
  );
  assert.ok(report.proposed_gates.every((gate) => gate.enforced === false));
  assert.ok(report.proposed_gates.every((gate) => gate.status !== "PERMIT"));
});

test("roadmap covers CI/CD, pipeline automation, quality, performance, and ethics without effects", () => {
  const report = buildOptimizationRoadmapPreview();
  const blueprintDomains = new Set(
    report.blueprint_coverage.map((entry) => entry.domain),
  );
  const itemWorkstreams = new Set(
    report.roadmap_items.map((item) => item.workstream),
  );
  const itemBlueprints = new Set(
    report.roadmap_items.map((item) => item.blueprint_focus),
  );
  const gateBlueprints = new Set(
    report.proposed_gates.map((gate) => gate.blueprint_domain),
  );

  for (const domain of [
    "devops",
    "ci_cd",
    "pipeline_automation",
    "performance_quality_assurance",
    "ethical_integrity",
  ]) {
    assert.ok(
      blueprintDomains.has(domain),
      `${domain} missing from blueprint coverage`,
    );
    assert.ok(
      itemBlueprints.has(domain),
      `${domain} missing from roadmap items`,
    );
    assert.ok(
      gateBlueprints.has(domain) || domain === "devops",
      `${domain} missing from proposed gates`,
    );
  }

  assert.ok(itemWorkstreams.has("ci_cd"));
  assert.ok(itemWorkstreams.has("pipeline"));
  assert.ok(itemWorkstreams.has("performance"));
  assert.ok(itemWorkstreams.has("management"));
  assert.ok(
    report.blueprint_coverage.every((entry) =>
      entry.non_goal.startsWith("no "),
    ),
  );
});

test("buildOptimizationRoadmapPreview is deterministic and returns fresh objects", () => {
  const first = buildOptimizationRoadmapPreview();
  const second = buildOptimizationRoadmapPreview();

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

  first.roadmap_items[0].title = "mutated";
  first.boundary.execution_enabled = true;
  const third = buildOptimizationRoadmapPreview();
  assert.notEqual(third.roadmap_items[0].title, "mutated");
  assert.equal(third.boundary.execution_enabled, false);
});

test("formatOptimizationRoadmapPreview renders lenses, gates, proof, and boundary", () => {
  const output = formatOptimizationRoadmapPreview(
    buildOptimizationRoadmapPreview(),
  );

  assert.match(output, /DEMA Optimization Roadmap Preview/);
  assert.match(output, /PMBOK lenses/);
  assert.match(output, /Management-body-of-knowledge/);
  assert.match(output, /SNR lenses/);
  assert.match(output, /SAPE lenses/);
  assert.match(output, /Blueprint coverage/);
  assert.match(output, /Prioritized roadmap/);
  assert.match(output, /Proof-of-Truth Convergence/);
  assert.match(
    output,
    /Boundary: preview-only; no execution; no mutation; no gates enforced/,
  );
});

test("optimization roadmap module has no network or child process side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from "node:(net|http|https|tls|dgram|child_process)"/,
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("dema roadmap preview prints a human-readable advisory preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "roadmap",
    "preview",
  ]);

  assert.match(stdout, /DEMA Optimization Roadmap Preview/);
  assert.match(stdout, /advisory_only/);
  assert.match(stdout, /no roadmap dispatch/);
});

test("dema roadmap preview --json emits the schema-tagged roadmap", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "roadmap",
    "preview",
    "--json",
  ]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.optimization_roadmap_preview.v0.1");
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.boundary.items_dispatched, false);
  assert.equal(report.boundary.ci_workflow_modified, false);
  assert.ok(report.roadmap_items.some((item) => item.workstream === "ethics"));
  assert.ok(
    report.blueprint_coverage.some((entry) => entry.domain === "ci_cd"),
  );
});

test("dema roadmap rejects unknown subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "roadmap", "execute"]),
    /Unknown roadmap command/,
  );
});
