import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAgentRoleContract,
  validateAgentFleet,
} from "../packages/core/src/agent-role-contract.js";

const good = Object.freeze({
  schema: "bizra.node0.agent_role_contract.v0.1",
  role_id: "sat-4-security-boundary",
  team: "SAT",
  serves: "system",
  base_class: { family: "deepseek", size_class: "3-4B" },
  adapter_ref: null,
  spawn_limit: 5,
  authority: {
    mint_allowed: false,
    egress_allowed: false,
    corpus_write_allowed: false,
    spawn_widens_authority: false,
  },
  truth_label: "DESIGNED_NOT_LIVE",
});

test("accepts a canonical SAT role contract", () => {
  const r = validateAgentRoleContract(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocked_by, []);
});

test("fail-closed: PAT serving system is blocked", () => {
  const r = validateAgentRoleContract({ ...good, role_id: "pat-x", team: "PAT", serves: "system", spawn_limit: 7 });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("serves_team_mismatch"));
});

test("fail-closed: any true authority flag is blocked", () => {
  const r = validateAgentRoleContract({
    ...good,
    authority: { ...good.authority, mint_allowed: true },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("authority_flag_true"));
});

test("fail-closed: spawn_limit above team ceiling is blocked", () => {
  const r = validateAgentRoleContract({ ...good, spawn_limit: 6 });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("spawn_limit_exceeds_team_ceiling"));
});

test("fleet: exactly 7 PAT + 5 SAT with disjoint base families", () => {
  const pat = (n) => ({ ...good, role_id: `pat-${n}`, team: "PAT", serves: "user", spawn_limit: 7, base_class: { family: "gemma", size_class: "3-4B" } });
  const sat = (n) => ({ ...good, role_id: `sat-${n}` });
  const fleet = [1, 2, 3, 4, 5, 6, 7].map(pat).concat([1, 2, 3, 4, 5].map(sat));
  const r = validateAgentFleet(fleet);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { pat: 7, sat: 5 });
});

test("fleet fail-closed: shared base family across PAT/SAT is blocked", () => {
  const pat = (n) => ({ ...good, role_id: `pat-${n}`, team: "PAT", serves: "user", spawn_limit: 7, base_class: { family: "deepseek", size_class: "3-4B" } });
  const sat = (n) => ({ ...good, role_id: `sat-${n}` });
  const fleet = [1, 2, 3, 4, 5, 6, 7].map(pat).concat([1, 2, 3, 4, 5].map(sat));
  const r = validateAgentFleet(fleet);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("base_family_shared_across_teams"));
});

test("fleet fail-closed: duplicate role_id and wrong counts are blocked", () => {
  const r = validateAgentFleet([good, good]);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("role_id_duplicate"));
  assert.ok(r.blocked_by.includes("team_count_invalid"));
});
