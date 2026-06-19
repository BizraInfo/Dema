// AGENT-DNA-ROOT-COHERENCE-1A · fixtures-only kernel tests.
//
// Read-only coherence gate: proves the Law of Assumption + the immutable Root
// Canon are rooted across the agent DNA — every one of the 12 agents (PAT-7 +
// SAT-5), the constitution document, the sealed root canon, and a live LoA
// validator are mutually consistent. Pure: injected inputs, no disk/clock/net.
// It mutates nothing, signs nothing, changes no profile hash, touches no root.

import test from "node:test";
import assert from "node:assert/strict";

import {
  assessAgentDnaRootCoherence,
  AGENT_DNA_ROOT_COHERENCE_SCHEMA,
} from "../packages/agents/src/agent-dna-root-coherence.js";

const ROOT_SEALED = Object.freeze({
  verified: true,
  result: "BIZRA_ROOT_CANON_SEALED",
  roots_verified: 3,
});

function agents12() {
  const pat = ["dema", "guardian", "reasoner", "builder", "critic", "archivist", "teacher"]
    .map((id) => ({ agent_id: `pat.${id}`, agent_class: "PAT" }));
  const sat = ["verifier", "compliance", "resource", "economist", "evolution"]
    .map((id) => ({ agent_id: `sat.${id}`, agent_class: "SAT" }));
  return [...pat, ...sat];
}

// A constitution text that covers every required marker (verbatim from the
// constitution's §13/§14 wording).
const COHERENT_CONSTITUTION = [
  "## PAT-7 DNA", "## SAT-5 DNA", "## FATE DNA",
  "## 13. Law of Assumption — Inviolate Agent Rule",
  "No agent may present assumption as fact.",
  "state the evidence boundary,",
  "It forbids hiding uncertainty.",
  "preserve Ihsan in tone, judgment, and action.",
  "## 14. Immutable Root Canon Binding — BIZRA_ROOT_CANON",
  "docs/root-canon/root-canon.manifest.json",
].join("\n");

function coherent(overrides = {}) {
  return {
    rootCanon: ROOT_SEALED,
    agents: agents12(),
    constitutionText: COHERENT_CONSTITUTION,
    loaValidatorLive: true,
    ...overrides,
  };
}

test("all rooted → AGENT_DNA_ROOT_COHERENCE_SEALED", () => {
  const r = assessAgentDnaRootCoherence(coherent());
  assert.equal(r.schema, AGENT_DNA_ROOT_COHERENCE_SCHEMA);
  assert.equal(r.truth_label, "AGENT_DNA_ROOT_COHERENCE_SEALED");
  assert.equal(r.coherent, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.checks.root_canon_sealed, true);
  assert.equal(r.checks.agents_complete, true);
  assert.equal(r.checks.constitution_covers_agents, true);
  assert.equal(r.checks.constitution_has_law_of_assumption, true);
  assert.equal(r.checks.constitution_binds_root_canon, true);
  assert.equal(r.checks.loa_validator_live, true);
});

test("missing Law of Assumption section heading → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(
    coherent({ constitutionText: COHERENT_CONSTITUTION.replace("Law of Assumption", "Misc") }),
  );
  assert.equal(r.coherent, false);
  assert.equal(r.truth_label, "AGENT_DNA_ROOT_COHERENCE_INCOHERENT");
  assert.ok(r.missing.includes("constitution_has_law_of_assumption"));
});

test("missing core LoA rule (no 'assumption as fact') → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(
    coherent({ constitutionText: COHERENT_CONSTITUTION.replace("No agent may present assumption as fact.", "") }),
  );
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("constitution_has_law_of_assumption"));
});

test("missing Root Canon manifest binding → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(
    coherent({ constitutionText: COHERENT_CONSTITUTION.replace("docs/root-canon/root-canon.manifest.json", "") }),
  );
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("constitution_binds_root_canon"));
});

test("root canon not sealed → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(coherent({ rootCanon: { verified: false, result: "TAMPERED" } }));
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("root_canon_sealed"));
});

test("agents not exactly 7 PAT + 5 SAT → INCOHERENT", () => {
  const short = agents12().slice(0, 11);
  const r = assessAgentDnaRootCoherence(coherent({ agents: short }));
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("agents_complete"));
});

test("constitution missing an agent tier (no SAT-5 DNA) → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(
    coherent({ constitutionText: COHERENT_CONSTITUTION.replace("## SAT-5 DNA", "## Nope") }),
  );
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("constitution_covers_agents"));
});

test("LoA validator not live → INCOHERENT", () => {
  const r = assessAgentDnaRootCoherence(coherent({ loaValidatorLive: false }));
  assert.equal(r.coherent, false);
  assert.ok(r.missing.includes("loa_validator_live"));
});

test("boundary keys all false; output deeply frozen; never mutates/signs/roots", () => {
  const r = assessAgentDnaRootCoherence(coherent());
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.ok("root_modified" in r.boundary && "profile_hash_changed" in r.boundary && "signing_performed" in r.boundary);
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.checks));
  assert.ok(Object.isFrozen(r.boundary));
});

test("malformed input fails closed (never throws, never SEALED)", () => {
  const r = assessAgentDnaRootCoherence({});
  assert.notEqual(r.truth_label, "AGENT_DNA_ROOT_COHERENCE_SEALED");
  assert.equal(r.coherent, false);
});
