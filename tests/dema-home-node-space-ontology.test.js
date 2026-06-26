import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDemaHomeNodeSpaceOntology,
  verifyDemaHomeNodeSpaceOntology,
  runDemaHomeNodeSpaceOntologyGate,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
  ONTOLOGY_NODE_IDS,
  FORBIDDEN_OVERCLAIMS,
  ALLOWED_CLAIMS,
} from "../packages/core/src/dema-home-node-space-ontology.js";

test("ontology emits schema, axiom, and all required nodes", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  assert.equal(ontology.schema, DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA);
  assert.equal(ontology.truth_label, DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL);
  assert.equal(ontology.ontology_nodes.length, ONTOLOGY_NODE_IDS.length);
  assert.equal(ontology.axiom.dema_home_is_node_space, true);
  assert.equal(ontology.axiom.every_node_is_a_seed, true);
});

test("every relationship carries a boundary", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  for (const rel of ontology.relationships) {
    assert.ok(rel.boundary, `${rel.from}->${rel.to}`);
  }
});

test("every ontology node has consent mode", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  for (const node of ontology.ontology_nodes) {
    assert.ok(node.consent_mode, node.node_id);
  }
});

test("core invariants include home, metadata default, no scan-share, no philosophy-runtime", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  const ids = new Set(ontology.invariants.map((i) => i.id));
  assert.ok(ids.has("home_is_node_space"));
  assert.ok(ids.has("metadata_default"));
  assert.ok(ids.has("no_scan_share"));
  assert.ok(ids.has("no_philosophy_runtime"));
});

test("allowed claims are proof-safe; marketing text avoids forbidden overclaims", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  assert.ok(ALLOWED_CLAIMS.length >= 5);
  const scanText = JSON.stringify({
    allowed_claims: ontology.allowed_claims,
    invariants: ontology.invariants,
  });
  for (const phrase of FORBIDDEN_OVERCLAIMS) {
    const lower = scanText.toLowerCase();
    const p = phrase.toLowerCase();
    let idx = 0;
    let found = false;
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      const before = lower.slice(Math.max(0, idx - 4), idx);
      if (!before.endsWith("no ")) found = true;
      idx += p.length;
    }
    assert.equal(found, false, phrase);
  }
});

test("contribution path requires receipt planning", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  assert.ok(
    ontology.proof_requirements.contribution_path_requires.includes("receipt_plan"),
  );
});

test("runtime and economic boundaries remain false", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  assert.equal(ontology.boundary.runtime_execution_performed, false);
  assert.equal(ontology.boundary.token_minted, false);
  assert.equal(ontology.boundary.urp_submission_performed, false);
  assert.equal(ontology.boundary.node0_activation_performed, false);
});

test("verify and gate pass on canonical ontology", () => {
  const ontology = buildDemaHomeNodeSpaceOntology();
  const verified = verifyDemaHomeNodeSpaceOntology(ontology);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runDemaHomeNodeSpaceOntologyGate();
  assert.equal(gate.ok, true);
});
