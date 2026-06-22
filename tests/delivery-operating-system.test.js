import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  DELIVERY_OPERATING_SYSTEM_SCHEMA,
  REQUIRED_GATE_CATEGORIES,
  DELIVERY_RAILS,
  buildDeliveryOperatingSystem,
  annotateDeliveryStatus,
} from "../packages/core/src/delivery-operating-system.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const GATE_REQUIRED_FIELDS = [
  "id",
  "command",
  "category",
  "rail",
  "purpose",
  "blocks_release",
  "current_status",
  "evidence_artifact",
  "failure_policy",
  "owner_role",
  "cadence",
  "notes",
];

test("schema, truth_label, mode, and maturity_stage are exact", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.equal(dos.schema, "bizra.dema.delivery_operating_system.v0.1");
  assert.equal(DELIVERY_OPERATING_SYSTEM_SCHEMA, dos.schema);
  assert.equal(dos.truth_label, "DEMA_DELIVERY_OPERATING_SYSTEM_LOCAL_ONLY");
  assert.equal(dos.mode, "policy_only");
  assert.equal(dos.maturity_stage, "node0_delivery_control_plane");
});

test("delivery_gates is a non-empty array and every gate has all required fields", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.ok(Array.isArray(dos.delivery_gates));
  assert.ok(dos.delivery_gates.length >= 12);
  for (const gate of dos.delivery_gates) {
    for (const field of GATE_REQUIRED_FIELDS) {
      assert.ok(
        Object.hasOwn(gate, field),
        `gate ${gate.id ?? "?"} missing field ${field}`,
      );
    }
    assert.equal(typeof gate.blocks_release, "boolean");
    assert.ok(typeof gate.command === "string" && gate.command.length > 0);
    assert.ok(typeof gate.purpose === "string" && gate.purpose.length > 0);
  }
});

test("every required gate category is present", () => {
  const dos = buildDeliveryOperatingSystem();
  const present = new Set(dos.delivery_gates.map((g) => g.category));
  for (const category of REQUIRED_GATE_CATEGORIES) {
    assert.ok(present.has(category), `missing required category: ${category}`);
  }
});

test("every gate maps to exactly one known Proof-of-Truth rail", () => {
  const dos = buildDeliveryOperatingSystem();
  const railSet = new Set(DELIVERY_RAILS);
  for (const gate of dos.delivery_gates) {
    assert.ok(railSet.has(gate.rail), `gate ${gate.id} has unknown rail ${gate.rail}`);
  }
});

test("gate_groups partition every gate into exactly one rail", () => {
  const dos = buildDeliveryOperatingSystem();
  const allIds = dos.delivery_gates.map((g) => g.id).sort();
  const grouped = [];
  for (const rail of DELIVERY_RAILS) {
    const group = dos.gate_groups[rail];
    assert.ok(group, `gate_groups missing rail ${rail}`);
    assert.ok(Array.isArray(group.gates), `rail ${rail} gates not an array`);
    grouped.push(...group.gates);
  }
  assert.deepEqual(
    grouped.slice().sort(),
    allIds,
    "gate_groups must partition all gates with no overlaps or omissions",
  );
});

test("economic rail is DESIGNED_NOT_LIVE with zero live gates", () => {
  const dos = buildDeliveryOperatingSystem();
  const econ = dos.gate_groups.economic_designed_not_live;
  assert.equal(econ.status, "DESIGNED_NOT_LIVE");
  assert.deepEqual(econ.gates, []);
});

test("default current_status is UNKNOWN for every gate", () => {
  const dos = buildDeliveryOperatingSystem();
  for (const gate of dos.delivery_gates) {
    assert.equal(gate.current_status, "UNKNOWN");
  }
});

test("measured results flow into current_status; unsupplied gates stay UNKNOWN", () => {
  const dos = buildDeliveryOperatingSystem({
    measured: { tests: "PASS", coverage: "FAIL" },
  });
  const byId = Object.fromEntries(dos.delivery_gates.map((g) => [g.id, g]));
  assert.equal(byId.tests.current_status, "PASS");
  assert.equal(byId.coverage.current_status, "FAIL");
  assert.equal(byId["static-check"].current_status, "UNKNOWN");
});

test("release_blockers and warning_only partition the gates by blocks_release", () => {
  const dos = buildDeliveryOperatingSystem();
  const blockers = new Set(dos.release_blockers);
  const warnings = new Set(dos.warning_only);
  for (const gate of dos.delivery_gates) {
    if (gate.blocks_release) {
      assert.ok(blockers.has(gate.id), `${gate.id} should be a release blocker`);
      assert.ok(!warnings.has(gate.id), `${gate.id} cannot be both`);
    } else {
      assert.ok(warnings.has(gate.id), `${gate.id} should be warning-only`);
      assert.ok(!blockers.has(gate.id), `${gate.id} cannot be both`);
    }
  }
  assert.equal(
    dos.release_blockers.length + dos.warning_only.length,
    dos.delivery_gates.length,
  );
});

test("boundary is the canonical 16-key all-false preview boundary", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.ok(isCanonicalBoundary(dos.boundary));
  // The directive's invented economic keys must NOT leak into the boundary.
  assert.ok(!Object.hasOwn(dos.boundary, "token_minted"));
  assert.ok(!Object.hasOwn(dos.boundary, "poi_score_calculated"));
  assert.ok(!Object.hasOwn(dos.boundary, "reward_emitted"));
});

test("required mappings and next_safe_actions are present", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.ok(dos.proof_of_truth_mapping && typeof dos.proof_of_truth_mapping === "object");
  assert.ok(dos.management_bok_mapping && typeof dos.management_bok_mapping === "object");
  assert.ok(dos.ci_cd_mapping && typeof dos.ci_cd_mapping === "object");
  assert.ok(dos.devops_mapping && typeof dos.devops_mapping === "object");
  assert.ok(dos.quality_assurance_mapping && typeof dos.quality_assurance_mapping === "object");
  assert.ok(Array.isArray(dos.next_safe_actions) && dos.next_safe_actions.length > 0);
});

test("management_bok_mapping covers the eight PMBoK knowledge areas", () => {
  const dos = buildDeliveryOperatingSystem();
  const required = [
    "scope",
    "quality",
    "risk",
    "integration",
    "stakeholder",
    "communications",
    "procurement",
    "schedule",
  ];
  for (const area of required) {
    assert.ok(
      Object.hasOwn(dos.management_bok_mapping, area),
      `management_bok_mapping missing ${area}`,
    );
  }
});

test("what_this_proves / what_this_does_not_prove are non-empty strings", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.ok(typeof dos.what_this_proves === "string" && dos.what_this_proves.length > 0);
  assert.ok(
    typeof dos.what_this_does_not_prove === "string" &&
      dos.what_this_does_not_prove.length > 0,
  );
});

test("output is deeply frozen (immutable policy)", () => {
  const dos = buildDeliveryOperatingSystem();
  assert.ok(Object.isFrozen(dos));
  assert.ok(Object.isFrozen(dos.delivery_gates));
  assert.ok(Object.isFrozen(dos.delivery_gates[0]));
  assert.ok(Object.isFrozen(dos.boundary));
  assert.ok(Object.isFrozen(dos.gate_groups));
});

test("annotateDeliveryStatus marks which gate commands are wired in package.json", () => {
  const dos = buildDeliveryOperatingSystem();
  const scripts = { test: "node --test", check: "node scripts/check.mjs" };
  const status = annotateDeliveryStatus(dos, { scripts });
  const byId = Object.fromEntries(status.gates.map((g) => [g.id, g]));
  // `npm test` and `npm run check` are wired in the supplied scripts.
  assert.equal(byId.tests.script_wired, true);
  assert.equal(byId["static-check"].script_wired, true);
  // coverage script is absent from the supplied scripts.
  assert.equal(byId.coverage.script_wired, false);
  // CI-enforced gates (no npm script) are flagged, not marked wired.
  assert.equal(byId.security.script_wired, false);
  assert.equal(byId.security.ci_enforced, true);
});

test("annotateDeliveryStatus computes blockers and warnings from current state", () => {
  const dos = buildDeliveryOperatingSystem({ measured: { tests: "FAIL" } });
  const status = annotateDeliveryStatus(dos, { scripts: {} });
  assert.ok(Array.isArray(status.failing_blockers));
  assert.ok(status.failing_blockers.includes("tests"));
  assert.equal(typeof status.release_ready, "boolean");
  assert.equal(status.release_ready, false);
});

test("every npm-script gate binds to a real script in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const dos = buildDeliveryOperatingSystem();
  for (const gate of dos.delivery_gates) {
    if (gate.npm_script == null) continue;
    assert.ok(
      Object.hasOwn(pkg.scripts, gate.npm_script),
      `gate ${gate.id} references a missing npm script: ${gate.npm_script}`,
    );
  }
});

test("the security gate command binds to the real gitleaks CI workflow", () => {
  const dos = buildDeliveryOperatingSystem();
  const security = dos.delivery_gates.find((g) => g.id === "security");
  assert.equal(security.npm_script, null);
  assert.equal(security.ci_enforced, true);
  const workflow = readFileSync(
    join(ROOT, ".github", "workflows", "gitleaks.yml"),
    "utf8",
  );
  assert.ok(
    workflow.includes(security.command),
    `security gate command not found in gitleaks.yml: ${security.command}`,
  );
});

test("annotateDeliveryStatus marks a non-CI npm gate not-wired when its script is absent", () => {
  const dos = buildDeliveryOperatingSystem();
  const status = annotateDeliveryStatus(dos, { scripts: {} });
  const byId = Object.fromEntries(status.gates.map((g) => [g.id, g]));
  // proof-seal is a non-CI npm gate; with empty scripts it must read not-wired
  // (this is the path the CLI renders as MISSING).
  assert.equal(byId["proof-seal"].ci_enforced, false);
  assert.equal(byId["proof-seal"].script_wired, false);
});

test("annotateDeliveryStatus output is frozen and reports no runtime effects", () => {
  const dos = buildDeliveryOperatingSystem();
  const status = annotateDeliveryStatus(dos, { scripts: {} });
  assert.ok(Object.isFrozen(status));
  assert.ok(isCanonicalBoundary(status.boundary));
});
