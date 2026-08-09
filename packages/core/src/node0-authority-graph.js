// NODE0-AUTHORITY-GRAPH-1A — who may command whom, and who may only judge.
//
// NOT ML. NOT runtime. NOT a scheduler. This decides ADMISSIBILITY of an
// authority edge; it dispatches nothing, spawns nothing, and grants nothing.
//
// WHY THIS EXISTS. The twelve role contracts in node0-agent-fleet-roles.js
// already carry `team`, `serves`, `spawn_limit` and `spawn_widens_authority`.
// Measured 2026-08-09: three files in the whole tree reference that roster, and
// exactly one distinguishes PAT from SAT — to count them. So the separation of
// powers existed as a data structure that nothing enforced, and
// `spawn_widens_authority: false` was a field no code path ever read.
//
// THE LADDER. Authority flows downward, one rung at a time. Each layer may
// command the layer directly beneath it and is answerable for it.
//
//     human ──command──▶ dema ──command──▶ pat ──command──▶ subagent
//
// THE SYSTEM RAIL IS NOT IN THIS NODE. SAT does not merely sit off the ladder;
// it lives in the Universal Resource Plane. Each human contributes five SATs
// when they join, so the system tier grows with the population — N humans, 5N
// SATs — and those agents police URP rules, manage assets and serve everyone,
// not the operator who happens to host them.
//
// That residency is the REASON for the missing edge, not a side effect of it.
// Dema cannot command SAT because SAT was never Dema's to command: it is not
// this human's agent and not on this human's machine. And SAT issues no orders
// back to the personal side either — it may only VERIFY, certifying or
// refusing PAT's work. That is what "PAT does not certify itself" requires. A
// judge that can be commanded is not a judge, and a judge that can command is
// not a judge either.
//
// PAT never leaves the node. SAT never enters it. What crosses between them is
// a receipt, not an instruction.
//
// THE SHAPE, IN ONE ANALOGY. SAT are the engine's own agents, the way an MMO
// has troops that serve the world rather than any player: the guards that keep
// a boss from being killed out of order, the NPC that speaks to you at the
// gate. They run on the server, not on your machine. Every player meets them;
// no player owns one. You cannot order an NPC — it can refuse you, and it can
// speak to you, and that asymmetry is the whole point. PAT are your own party:
// they are yours, they answer to you, and they never leave your node.
//
//     sat ──verify──▶ pat        (refuse / certify · never command)
//     dema ──✗──▶ sat            (no edge, in either direction)
//
// FAIL-CLOSED. Any edge not named here is refused. Absence of a rule is a
// refusal, never a permission — an unknown actor cannot acquire authority by
// being unrecognised.

export const NODE0_AUTHORITY_GRAPH_SCHEMA =
  "bizra.dema.node0_authority_graph.v0.1";
export const NODE0_AUTHORITY_GRAPH_TRUTH_LABEL = "IMPLEMENTED_LOCAL";

/// Rungs of the personal ladder, in order. Index is the rung.
export const COMMAND_LADDER = Object.freeze([
  "human",
  "dema",
  "pat",
  "subagent",
]);

/// Off-ladder AND off-node: resident in the Universal Resource Plane, answerable
/// to the constitution rather than to the operator whose node contributed it.
export const SYSTEM_RAIL = Object.freeze(["sat"]);

/// Residency, stated so a future reader cannot mistake SAT for a local agent.
/// PAT never leaves the node; SAT never enters it.
export const ACTOR_RESIDENCY = Object.freeze({
  human: "node",
  dema: "node",
  pat: "node",
  subagent: "node",
  sat: "urp",
});

/// Each human who joins contributes this many SATs to the shared plane, so the
/// system tier scales with the population it serves rather than with any one
/// operator's hardware.
export const SAT_CONTRIBUTION_PER_HUMAN = 5;

export const EDGE_KINDS = Object.freeze({
  COMMAND: "command",
  VERIFY: "verify",
  SPAWN: "spawn",
});

const KNOWN_ACTORS = Object.freeze([...COMMAND_LADDER, ...SYSTEM_RAIL]);

/// Only SAT judges, and it judges only PAT's work. Encoded as data so the
/// single exception to the ladder is visible rather than buried in a branch.
const VERIFY_EDGES = Object.freeze([Object.freeze({ from: "sat", to: "pat" })]);

/// Who may spawn, and how many. Mirrors the role contracts rather than
/// restating them: a subagent is a leaf and spawns nothing.
export const SPAWN_LIMITS = Object.freeze({
  human: 0,
  dema: 7,
  pat: 7,
  sat: 5,
  subagent: 0,
});

function refuse(reason, detail) {
  return Object.freeze({ allowed: false, reason, detail: detail ?? null });
}
function allow(reason) {
  return Object.freeze({ allowed: true, reason, detail: null });
}

/**
 * Pure. Decides whether one actor may exercise an edge over another.
 * Unknown actors and unknown edge kinds are refused, never defaulted.
 */
export function evaluateAuthorityEdge({ from, to, kind } = {}) {
  if (typeof from !== "string" || typeof to !== "string") {
    return refuse("actor_missing");
  }
  if (!KNOWN_ACTORS.includes(from)) return refuse("unknown_actor", from);
  if (!KNOWN_ACTORS.includes(to)) return refuse("unknown_actor", to);
  if (!Object.values(EDGE_KINDS).includes(kind)) {
    return refuse("unknown_edge_kind", kind ?? null);
  }

  if (kind === EDGE_KINDS.VERIFY) {
    const permitted = VERIFY_EDGES.some((e) => e.from === from && e.to === to);
    return permitted
      ? allow("verification_edge")
      : refuse("verification_not_permitted", `${from}->${to}`);
  }

  if (kind === EDGE_KINDS.SPAWN) {
    // An actor spawns only its OWN children. Spawning is not a way to reach
    // sideways into another team or downward past a rung.
    if (from !== to) return refuse("spawn_must_be_own_subagent", `${from}->${to}`);
    return SPAWN_LIMITS[from] > 0
      ? allow("spawn_within_own_team")
      : refuse("actor_may_not_spawn", from);
  }

  // COMMAND. Strictly one rung down the personal ladder.
  const fromRung = COMMAND_LADDER.indexOf(from);
  const toRung = COMMAND_LADDER.indexOf(to);
  if (fromRung === -1 || toRung === -1) {
    // Either side is on the system rail. The rails do not command each other
    // in either direction — this is the edge the whole separation rests on.
    return refuse("system_rail_is_not_commandable", `${from}->${to}`);
  }
  if (toRung === fromRung) return refuse("peer_command_refused", from);
  if (toRung < fromRung) return refuse("upward_command_refused", `${from}->${to}`);
  if (toRung - fromRung > 1) {
    return refuse("layer_skip_refused", `${from}->${to}`);
  }
  return allow("adjacent_downward_command");
}

/// Responsibility is the mirror of command: an actor answers for exactly the
/// rung it may command. Derived, never declared separately, so the two cannot
/// drift apart.
export function responsibleFor(actor) {
  const rung = COMMAND_LADDER.indexOf(actor);
  if (rung === -1 || rung === COMMAND_LADDER.length - 1) return null;
  return COMMAND_LADDER[rung + 1];
}

/**
 * Re-derives the graph's invariants from the role contracts, so a roster edited
 * out of step with this kernel is caught rather than silently obeyed.
 */
export function verifyAuthorityGraph(roleContracts = []) {
  const findings = [];
  for (const contract of roleContracts) {
    const team = String(contract?.team ?? "").toLowerCase();
    if (!KNOWN_ACTORS.includes(team)) {
      findings.push({ role_id: contract?.role_id ?? null, reason: "unknown_team" });
      continue;
    }
    if (contract?.spawn_limit !== SPAWN_LIMITS[team]) {
      findings.push({
        role_id: contract?.role_id ?? null,
        reason: "spawn_limit_mismatch",
        expected: SPAWN_LIMITS[team],
        observed: contract?.spawn_limit ?? null,
      });
    }
    // The one law that makes the ladder safe: a child can never hold more than
    // its parent. If any contract ever says otherwise, the graph is void.
    if (contract?.authority?.spawn_widens_authority !== false) {
      findings.push({
        role_id: contract?.role_id ?? null,
        reason: "spawn_widens_authority_must_be_false",
      });
    }
  }
  return Object.freeze({
    ok: findings.length === 0,
    checked: roleContracts.length,
    findings: Object.freeze(findings),
  });
}

/// The full graph, for display and for receipts.
export function buildAuthorityGraph(roleContracts = []) {
  const edges = [];
  for (let i = 0; i < COMMAND_LADDER.length - 1; i += 1) {
    edges.push({
      from: COMMAND_LADDER[i],
      to: COMMAND_LADDER[i + 1],
      kind: EDGE_KINDS.COMMAND,
    });
  }
  for (const e of VERIFY_EDGES) {
    edges.push({ from: e.from, to: e.to, kind: EDGE_KINDS.VERIFY });
  }
  return Object.freeze({
    schema: NODE0_AUTHORITY_GRAPH_SCHEMA,
    truth_label: NODE0_AUTHORITY_GRAPH_TRUTH_LABEL,
    ladder: COMMAND_LADDER,
    system_rail: SYSTEM_RAIL,
    residency: ACTOR_RESIDENCY,
    sat_contribution_per_human: SAT_CONTRIBUTION_PER_HUMAN,
    edges: Object.freeze(edges.map(Object.freeze)),
    forbidden_examples: Object.freeze([
      Object.freeze({ from: "dema", to: "sat", kind: "command" }),
      Object.freeze({ from: "sat", to: "dema", kind: "command" }),
      Object.freeze({ from: "dema", to: "subagent", kind: "command" }),
      Object.freeze({ from: "pat", to: "dema", kind: "command" }),
    ]),
    roster: verifyAuthorityGraph(roleContracts),
    what_this_proves:
      "Which authority edges are admissible between the human, Dema, the personal agent team, their subagents, and the system agent team.",
    what_this_does_not_prove:
      "Does not dispatch, spawn, schedule or execute anything, and does not prove any agent obeys the graph at runtime.",
  });
}
