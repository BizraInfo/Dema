import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function run(args) {
  return spawnSync("node", [CLI, ...args], { encoding: "utf8" });
}

test("dema delivery policy --json emits the policy manifest", () => {
  const res = run(["delivery", "policy", "--json"]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.schema, "bizra.dema.delivery_operating_system.v0.1");
  assert.equal(out.truth_label, "DEMA_DELIVERY_OPERATING_SYSTEM_LOCAL_ONLY");
  assert.equal(out.mode, "policy_only");
  assert.ok(Array.isArray(out.delivery_gates) && out.delivery_gates.length >= 12);
});

test("dema delivery status --json annotates real package.json scripts", () => {
  const res = run(["delivery", "status", "--json"]);
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.schema, "bizra.dema.delivery_operating_system_status.v0.1");
  const byId = Object.fromEntries(out.gates.map((g) => [g.id, g]));
  // The real package.json has `test` and `check` scripts.
  assert.equal(byId.tests.script_wired, true);
  assert.equal(byId["static-check"].script_wired, true);
  // Security is CI-enforced, not an npm script.
  assert.equal(byId.security.ci_enforced, true);
  assert.equal(byId.security.script_wired, false);
});

test("dema delivery policy (human) renders without error", () => {
  const res = run(["delivery", "policy"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Delivery Operating System/i);
});

test("dema delivery status (human) names blockers vs warning-only", () => {
  const res = run(["delivery", "status"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Release blockers/i);
  assert.match(res.stdout, /Warning-only/i);
});

test("dema delivery with no/unknown subcommand prints usage and exits 1", () => {
  const res = run(["delivery", "bogus"]);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage: dema delivery/i);
});
