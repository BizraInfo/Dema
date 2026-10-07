// NODE0-AUTHORITY-GRAPH-1A — the separation of powers, enforced.
//
// Before this slice the roster carried team/serves/spawn_limit/
// spawn_widens_authority and THREE files referenced it, only one of which
// distinguished PAT from SAT — to count them. These tests make the graph a
// gate instead of a comment.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAuthorityEdge,
  responsibleFor,
  verifyAuthorityGraph,
  buildAuthorityGraph,
  COMMAND_LADDER,
  SPAWN_LIMITS,
  EDGE_KINDS,
  ACTOR_RESIDENCY,
  SAT_CONTRIBUTION_PER_HUMAN,
} from "../packages/core/src/node0-authority-graph.js";
import { AGENT_FLEET_ROLES } from "../packages/core/src/node0-agent-fleet-roles.js";

const cmd = (from, to) =>
  evaluateAuthorityEdge({ from, to, kind: EDGE_KINDS.COMMAND });

test("NAG-01 authority flows down exactly one rung", () => {
  assert.equal(cmd("human", "dema").allowed, true);
  assert.equal(cmd("dema", "pat").allowed, true);
  assert.equal(cmd("pat", "subagent").allowed, true);
});

test("NAG-02 Dema has NO authority over SAT, in either direction", () => {
  const down = cmd("dema", "sat");
  const up = cmd("sat", "dema");
  assert.equal(down.allowed, false);
  assert.equal(up.allowed, false);
  assert.equal(down.reason, "system_rail_is_not_commandable");
  assert.equal(up.reason, "system_rail_is_not_commandable");
  // Nor may the personal team reach the system rail.
  assert.equal(cmd("pat", "sat").allowed, false);
});

test("NAG-03 SAT may VERIFY the personal team but never command it", () => {
  const verify = evaluateAuthorityEdge({
    from: "sat",
    to: "pat",
    kind: EDGE_KINDS.VERIFY,
  });
  assert.equal(verify.allowed, true, "a judge must be able to judge");
  assert.equal(cmd("sat", "pat").allowed, false, "a judge must not command");
  // And the judged may not judge back — PAT does not certify itself, nor SAT.
  assert.equal(
    evaluateAuthorityEdge({ from: "pat", to: "sat", kind: EDGE_KINDS.VERIFY })
      .allowed,
    false,
  );
});

test("NAG-04 no layer skipping, no upward command, no peer command", () => {
  assert.equal(cmd("dema", "subagent").reason, "layer_skip_refused");
  assert.equal(cmd("human", "pat").reason, "layer_skip_refused");
  assert.equal(cmd("pat", "dema").reason, "upward_command_refused");
  assert.equal(cmd("dema", "human").reason, "upward_command_refused");
  assert.equal(cmd("pat", "pat").reason, "peer_command_refused");
});

test("NAG-05 FAIL-CLOSED — unknown actors and edge kinds are refused", () => {
  assert.equal(cmd("ghost", "pat").reason, "unknown_actor");
  assert.equal(cmd("dema", "ghost").reason, "unknown_actor");
  assert.equal(
    evaluateAuthorityEdge({ from: "dema", to: "pat", kind: "persuade" }).reason,
    "unknown_edge_kind",
  );
  assert.equal(evaluateAuthorityEdge({}).reason, "actor_missing");
  // Absence must never read as permission.
  assert.equal(evaluateAuthorityEdge().allowed, false);
});

test("NAG-06 spawning stays inside your own team and cannot reach sideways", () => {
  assert.equal(
    evaluateAuthorityEdge({ from: "pat", to: "pat", kind: EDGE_KINDS.SPAWN })
      .allowed,
    true,
  );
  assert.equal(
    evaluateAuthorityEdge({ from: "dema", to: "sat", kind: EDGE_KINDS.SPAWN })
      .reason,
    "spawn_must_be_own_subagent",
  );
  // A subagent is a leaf.
  assert.equal(
    evaluateAuthorityEdge({
      from: "subagent",
      to: "subagent",
      kind: EDGE_KINDS.SPAWN,
    }).reason,
    "actor_may_not_spawn",
  );
  assert.equal(SPAWN_LIMITS.subagent, 0);
});

test("NAG-07 responsibility is derived from command, so they cannot drift", () => {
  assert.equal(responsibleFor("human"), "dema");
  assert.equal(responsibleFor("dema"), "pat");
  assert.equal(responsibleFor("pat"), "subagent");
  assert.equal(responsibleFor("subagent"), null, "a leaf answers for no one");
  assert.equal(responsibleFor("sat"), null, "the system rail is off the ladder");
  // Every rung that may command something is responsible for exactly it.
  for (const actor of COMMAND_LADDER) {
    const child = responsibleFor(actor);
    if (child) assert.equal(cmd(actor, child).allowed, true);
  }
});

test("NAG-08 the SHIPPED roster satisfies the graph", () => {
  const result = verifyAuthorityGraph(AGENT_FLEET_ROLES);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.checked, 12);
});

test("NAG-09 NEGATIVE CONTROL — a widened child voids the graph", () => {
  // Without this, NAG-08 would pass against a verifier that approves anything.
  const tampered = AGENT_FLEET_ROLES.map((r, i) =>
    i === 0
      ? { ...r, authority: { ...r.authority, spawn_widens_authority: true } }
      : r,
  );
  const result = verifyAuthorityGraph(tampered);
  assert.equal(result.ok, false);
  assert.equal(
    result.findings[0].reason,
    "spawn_widens_authority_must_be_false",
  );

  const wrongLimit = AGENT_FLEET_ROLES.map((r, i) =>
    i === 0 ? { ...r, spawn_limit: 99 } : r,
  );
  assert.equal(verifyAuthorityGraph(wrongLimit).ok, false);
});

test("NAG-11 SAT is off-node — the missing edge follows from residency", () => {
  // PAT never leaves the node; SAT never enters it. Dema cannot command SAT
  // because SAT is not this human's agent and not on this human's machine.
  assert.equal(ACTOR_RESIDENCY.pat, "node");
  assert.equal(ACTOR_RESIDENCY.dema, "node");
  assert.equal(ACTOR_RESIDENCY.sat, "urp");
  for (const actor of COMMAND_LADDER) {
    assert.equal(
      ACTOR_RESIDENCY[actor],
      "node",
      `${actor} sits on the personal ladder and must be node-resident`,
    );
    // Nothing node-resident may command the off-node rail.
    assert.equal(cmd(actor, "sat").allowed, false);
  }
  // The system tier scales with humanity, not with one operator's hardware.
  assert.equal(SAT_CONTRIBUTION_PER_HUMAN, 5);
});

test("NAG-10 the published graph names its forbidden edges and refuses them", () => {
  const graph = buildAuthorityGraph(AGENT_FLEET_ROLES);
  assert.equal(graph.roster.ok, true);
  assert.ok(graph.edges.length >= 4);
  // Everything the graph advertises as forbidden must actually be refused —
  // documentation and behaviour proven equal, not asserted equal.
  for (const edge of graph.forbidden_examples) {
    assert.equal(
      evaluateAuthorityEdge(edge).allowed,
      false,
      `${edge.from}->${edge.to} is advertised forbidden but was allowed`,
    );
  }
  // And everything it advertises as an edge must actually be allowed.
  for (const edge of graph.edges) {
    assert.equal(
      evaluateAuthorityEdge(edge).allowed,
      true,
      `${edge.from}->${edge.to} (${edge.kind}) is advertised but refused`,
    );
  }
});
