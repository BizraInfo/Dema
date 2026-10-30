import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHabitatActorPartyOntology,
  verifyHabitatActorPartyOntology,
  runHabitatActorPartyOntologyGate,
  refuseNamingDrift,
  previewSeedScale,
  HABITAT_ACTOR_PARTY_SCHEMA,
  HABITAT_ACTOR_PARTY_TRUTH_LABEL,
  ROLE_IDS,
  PAT_PARTY_SIZE,
  SAT_GUARD_SIZE,
  FORBIDDEN_OVERCLAIMS,
} from "../packages/core/src/habitat-actor-party-ontology.js";

const SHA256_HEX = /^sha256:[a-f0-9]{64}$/;

test("builds PREVIEW_ONLY ontology with authority_delta 0", () => {
  const ontology = buildHabitatActorPartyOntology();
  assert.equal(ontology.schema, HABITAT_ACTOR_PARTY_SCHEMA);
  assert.equal(ontology.truth_label, HABITAT_ACTOR_PARTY_TRUTH_LABEL);
  assert.equal(ontology.mode, "PREVIEW_ONLY");
  assert.equal(ontology.authority_delta, 0);
  assert.match(ontology.ontology_id, SHA256_HEX);
  assert.equal(Object.isFrozen(ontology), true);
  assert.equal(ontology.roles.length, ROLE_IDS.length);
  assert.equal(ontology.party_sizes.pat, PAT_PARTY_SIZE);
  assert.equal(ontology.party_sizes.sat, SAT_GUARD_SIZE);
  assert.equal(ontology.axiom.habitat_is_bizra, true);
  assert.equal(ontology.axiom.actor_is_dema, true);
  assert.equal(ontology.axiom.player_is_human, true);
  assert.equal(ontology.boundary.pat_agents_spawned, false);
  assert.equal(ontology.boundary.sat_agents_spawned, false);
  assert.equal(ontology.boundary.rsi_activated, false);
  assert.equal(ontology.boundary.singularity_claimed, false);
});

test("every relationship carries a boundary", () => {
  const ontology = buildHabitatActorPartyOntology();
  for (const rel of ontology.relationships) {
    assert.ok(rel.boundary, `${rel.from}->${rel.to}`);
  }
});

test("refuses PAT↔SAT naming drift and Dema-as-habitat collapse", () => {
  assert.equal(
    refuseNamingDrift({ role_id: "pat_party", applied_label: "SAT" }).ok,
    false,
  );
  assert.equal(
    refuseNamingDrift({ role_id: "sat_world_guard", applied_label: "PAT" }).ok,
    false,
  );
  assert.equal(
    refuseNamingDrift({
      role_id: "avatar_dema",
      applied_label: "BIZRA_HABITAT",
    }).ok,
    false,
  );
  assert.equal(
    refuseNamingDrift({ role_id: "pat_party", applied_label: "SAT-1" }).ok,
    false,
  );
  assert.equal(
    refuseNamingDrift({ role_id: "pat_party", applied_label: "PAT" }).ok,
    true,
  );
});

test("seed scale preview is design math only", () => {
  const scale = previewSeedScale(1_000_000);
  assert.equal(scale.mode, "PREVIEW_ONLY");
  assert.equal(scale.private_dema, 1_000_000);
  assert.equal(scale.private_pat_slots, 7_000_000);
  assert.equal(scale.urp_sat_slots, 5_000_000);
  assert.equal(scale.claim_ceiling, "DESIGN_EMULATION_NOT_RUNTIME_RECEIPT");
});

test("forbidden overclaims stay out of allowed claim text", () => {
  const ontology = buildHabitatActorPartyOntology();
  const blob = JSON.stringify(ontology.allowed_claims).toLowerCase();
  for (const phrase of FORBIDDEN_OVERCLAIMS) {
    assert.equal(blob.includes(phrase.toLowerCase()), false, phrase);
  }
});

test("verify and gate pass; drift refusals fire", () => {
  const ontology = buildHabitatActorPartyOntology();
  const verified = verifyHabitatActorPartyOntology(ontology);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runHabitatActorPartyOntologyGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.drift_refusal_ok, true);
  assert.equal(gate.authority_delta, 0);
});

test("what_this_does_not_prove is non-empty", () => {
  const ontology = buildHabitatActorPartyOntology();
  assert.ok(ontology.what_this_does_not_prove.length >= 3);
  assert.ok(ontology.self_critique.length >= 3);
});
