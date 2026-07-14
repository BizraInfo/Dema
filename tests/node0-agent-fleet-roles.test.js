import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_FLEET_ROLES, DEMA_ALPHA } from "../packages/core/src/node0-agent-fleet-roles.js";
import { validateAgentFleet } from "../packages/core/src/agent-role-contract.js";

test("fleet ships exactly 12 valid contracts (7 PAT + 5 SAT)", () => {
  const r = validateAgentFleet(AGENT_FLEET_ROLES);
  assert.equal(r.ok, true, r.blocked_by.join(","));
  assert.deepEqual(r.counts, { pat: 7, sat: 5 });
});

test("sat-4-security-boundary is present (first-light role)", () => {
  assert.ok(AGENT_FLEET_ROLES.some((c) => c.role_id === "sat-4-security-boundary"));
});

test("dema alpha is outside the fleet and 7-8B class", () => {
  assert.equal(DEMA_ALPHA.role_id, "dema-alpha");
  assert.equal(DEMA_ALPHA.base_class.size_class, "7-8B");
  assert.equal(DEMA_ALPHA.base_class.family, "whiterabbitneo");
  assert.ok(!AGENT_FLEET_ROLES.some((c) => c.role_id === "dema-alpha"));
});

test("every contract is deeply frozen", () => {
  for (const c of AGENT_FLEET_ROLES) {
    assert.ok(Object.isFrozen(c));
    assert.ok(Object.isFrozen(c.authority));
    assert.ok(Object.isFrozen(c.base_class));
  }
});
