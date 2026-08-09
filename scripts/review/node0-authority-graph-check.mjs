#!/usr/bin/env node
// NODE0-AUTHORITY-GRAPH-1A — review gate.
//
// Read-only. Re-derives the separation of powers from the SHIPPED role
// contracts and refuses if the roster has drifted out of step with the graph,
// or if any edge the graph advertises as forbidden is in fact permitted.
//
// Exit 0 only when the roster is consistent AND every advertised edge behaves
// as advertised. Documentation and behaviour are compared, never assumed equal.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import {
  buildAuthorityGraph,
  evaluateAuthorityEdge,
} from "../../packages/core/src/node0-authority-graph.js";
import { AGENT_FLEET_ROLES } from "../../packages/core/src/node0-agent-fleet-roles.js";

export function runNode0AuthorityGraphCheck() {
  const graph = buildAuthorityGraph(AGENT_FLEET_ROLES);
  const violations = [];

  for (const edge of graph.forbidden_examples) {
    if (evaluateAuthorityEdge(edge).allowed) {
      violations.push({
        kind: "forbidden_edge_permitted",
        edge: `${edge.from}->${edge.to}:${edge.kind}`,
      });
    }
  }
  for (const edge of graph.edges) {
    if (!evaluateAuthorityEdge(edge).allowed) {
      violations.push({
        kind: "advertised_edge_refused",
        edge: `${edge.from}->${edge.to}:${edge.kind}`,
      });
    }
  }
  for (const finding of graph.roster.findings) {
    violations.push({ kind: "roster_drift", ...finding });
  }

  // A gate that checked nothing would also report zero violations. Bind the
  // pass to evidence that the graph was actually populated.
  const vacuous =
    graph.edges.length === 0 ||
    graph.forbidden_examples.length === 0 ||
    graph.roster.checked === 0;

  return Object.freeze({
    schema: graph.schema,
    ok: violations.length === 0 && !vacuous,
    vacuous,
    roles_checked: graph.roster.checked,
    edges_checked: graph.edges.length,
    forbidden_checked: graph.forbidden_examples.length,
    violations: Object.freeze(violations),
  });
}

function printHuman(report) {
  console.log("DEMA - NODE0-AUTHORITY-GRAPH-1A");
  console.log(`  roles:     ${report.roles_checked}`);
  console.log(`  edges:     ${report.edges_checked} advertised`);
  console.log(`  forbidden: ${report.forbidden_checked} refused-by-contract`);
  if (report.vacuous) console.log("  VACUOUS: the graph is empty; nothing was proven");
  for (const v of report.violations) {
    console.log(`  violation: ${v.kind} ${v.edge ?? v.role_id ?? ""}`);
  }
  console.log(`  result:    ${report.ok ? "PASS" : "FAIL"}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const report = runNode0AuthorityGraphCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  if (!report.ok) process.exitCode = 1;
}
