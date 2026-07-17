// DEMA-PROGRAM-GRAPH-NICHE-CELL-0A — mirrored proof-contract test (red-first).
//
// Contract under test (addendum-corrected):
//   ProgramDefinition (immutable, caller-supplied, no derived fields)
//   → compile: hash envelope { canonicalization, body, body_hash } + projection
//   → derived readiness only; narration never advances state
//   → structural transition candidates: transition_applied/authority_granted
//     are ALWAYS false; missing evidence blocks; failure never adds authority
//   → tamper on body, projection, hash, or schema label fails closed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROGRAM_DEFINITION_SCHEMA,
  PROGRAM_GRAPH_TRUTH_LABEL,
  FOUNDER_RECOVERY_PROFILE_ID,
  NICHE_PROFILES,
  PROGRAM_TASK_STATES,
  PROGRAM_TASK_TRANSITIONS,
  PROGRAM_AUTHORITY_KEYS,
  TRANSITION_DOES_NOT_PROVE,
  validateProgramDefinition,
  compileProgramDefinition,
  verifyCompiledProgram,
  evaluateProgramTransitionCandidate,
  buildFounderRecoveryProgramDefinition,
  runProgramGraphFixture,
} from "../packages/mission/src/dema-program-graph.js";
import { runDemaProgramGraphCheck } from "../scripts/review/dema-program-graph-check.mjs";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../packages/core/src/boundary-schema.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function allFalseAuthority() {
  const o = {};
  for (const k of PROGRAM_AUTHORITY_KEYS) o[k] = false;
  return o;
}

// Minimal valid two-task definition (T2 depends on T1). Fresh object per call
// so tests can mutate without cross-contamination.
function tinyDef() {
  return {
    schema_version: PROGRAM_DEFINITION_SCHEMA,
    program_id: "DEMA-TINY-PROGRAM-001",
    program_version: "0.1",
    title: "Tiny program",
    purpose: "Prove the minimal graph compiles.",
    truth_label: "PREVIEW_ONLY",
    source_bindings: ["src:tiny-manifest"],
    niche_cell: {
      niche_cell_id: "cell-tiny-001",
      profile: FOUNDER_RECOVERY_PROFILE_ID,
      human: {
        human_ref: "human:founder",
        role: "operator",
        private_data_scope: "BOUNDED_REFERENCE_ONLY",
      },
      situation: {
        current_state: "archive unexplored",
        active_project: "dema-continuum",
        trigger: "recurring recovery need",
      },
      problem: {
        observed_pain: "assets unrecoverable on demand",
        root_constraint: "no bounded recovery loop",
        source_observation_refs: ["obs:a", "obs:b", "obs:c"],
      },
      desired_outcome: {
        target_state: "one asset recovered and reused",
        human_value_hypothesis: "less time lost re-deriving prior work",
        acceptance_test_refs: ["accept:reuse-in-current-mission"],
      },
      constraints: {
        privacy: ["references-only"],
        authority: ["all-false ceiling"],
        reversibility: ["no destructive action"],
        budget: ["one bounded session"],
      },
      execution_preview: {
        prompt_capsule_ref: null,
        context_capsule_ref: null,
        harness_manifest_ref: null,
        loop_manifest_ref: null,
      },
      proof_contract: {
        required_evidence: ["evidence:tiny-receipt"],
        independent_verifier_required: true,
        human_acceptance_required: true,
      },
    },
    task_definitions: [
      {
        task_id: "T1",
        objective: "Bind approved sources.",
        dependencies: [],
        owner_type: "DEMA",
        repository_boundary: "NONE",
        risk_class: "R0",
        permitted_actions: ["describe sources"],
        forbidden_actions: ["read private archive"],
        required_evidence: ["evidence:source-manifest"],
        verifier_independence: "NOT_REQUIRED",
        human_gate: "NONE",
        rollback_requirement: "NOT_APPLICABLE",
        proves: ["sources are representable"],
        does_not_prove: ["sources were read"],
      },
      {
        task_id: "T2",
        objective: "Request human acceptance.",
        dependencies: ["T1"],
        owner_type: "HUMAN",
        repository_boundary: "NONE",
        risk_class: "R0",
        permitted_actions: ["present result"],
        forbidden_actions: ["auto-accept"],
        required_evidence: ["evidence:human-acceptance"],
        verifier_independence: "REQUIRED",
        human_gate: "REQUIRED",
        rollback_requirement: "NOT_APPLICABLE",
        proves: ["acceptance is gated"],
        does_not_prove: ["value was created"],
      },
    ],
    authority_ceiling: allFalseAuthority(),
    boundary: buildPreviewBoundary(),
  };
}

function compiled(def = tinyDef()) {
  return compileProgramDefinition(def);
}

// A. valid minimal graph
test("A: minimal definition validates and compiles", () => {
  const v = validateProgramDefinition(tinyDef());
  assert.equal(v.ok, true, JSON.stringify(v.blocked_by));
  const c = compiled();
  assert.equal(c.canonicalization, "bizra.canonical-json.v1");
  assert.match(c.body_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(c), true);
  assert.equal(Object.isFrozen(c.body), true);
  assert.equal(Object.isFrozen(c.projection), true);
});

// B. deterministic compilation
test("B: compilation is deterministic (same input → same hash and projection)", () => {
  const c1 = compiled();
  const c2 = compiled();
  assert.equal(c1.body_hash, c2.body_hash);
  assert.deepEqual(c1.projection, c2.projection);
});

// C. array-order normalization
test("C: set-like array order and task order do not change the hash", () => {
  const a = tinyDef();
  const b = tinyDef();
  b.task_definitions.reverse();
  b.task_definitions[1].forbidden_actions = ["read private archive"];
  b.source_bindings = ["src:tiny-manifest", "src:tiny-manifest"]; // dup collapses
  b.niche_cell.problem.source_observation_refs = ["obs:c", "obs:a", "obs:b"];
  const ca = compileProgramDefinition(a);
  const cb = compileProgramDefinition(b);
  assert.equal(ca.body_hash, cb.body_hash);
});

// D. unknown keys fail closed
test("D: unknown keys are rejected at every level", () => {
  const d1 = { ...tinyDef(), surprise: 1 };
  assert.equal(validateProgramDefinition(d1).ok, false);
  const d2 = tinyDef();
  d2.niche_cell.surprise = 1;
  assert.equal(validateProgramDefinition(d2).ok, false);
  const d3 = tinyDef();
  d3.task_definitions[0].surprise = 1;
  const v3 = validateProgramDefinition(d3);
  assert.equal(v3.ok, false);
  assert.ok(v3.blocked_by.some((c) => c.startsWith("unknown_key:")));
});

// caller-supplied derived fields rejected (addendum §3/§9)
test("derived fields in caller input are rejected by name", () => {
  for (const [key, value] of [
    ["program_state", "ACCEPTED"],
    ["content_hash", "sha256:00"],
    ["projection", {}],
    ["body_hash", "sha256:00"],
  ]) {
    const d = { ...tinyDef(), [key]: value };
    const v = validateProgramDefinition(d);
    assert.equal(v.ok, false, key);
    assert.ok(
      v.blocked_by.some((c) => c === `derived_field_supplied:${key}`),
      `${key} → ${JSON.stringify(v.blocked_by)}`,
    );
  }
  const dt = tinyDef();
  dt.task_definitions[0].state = "ACCEPTED";
  const vt = validateProgramDefinition(dt);
  assert.equal(vt.ok, false);
  assert.ok(vt.blocked_by.some((c) => c === "derived_field_supplied:task.state"));
  const db = tinyDef();
  db.task_definitions[0].blocked_by = [];
  assert.equal(validateProgramDefinition(db).ok, false);
});

// E. malformed niche cell
test("E: malformed niche cell fails closed", () => {
  const d = tinyDef();
  delete d.niche_cell.problem;
  assert.equal(validateProgramDefinition(d).ok, false);
  const d2 = tinyDef();
  d2.niche_cell.human.private_data_scope = "FULL_ACCESS";
  const v2 = validateProgramDefinition(d2);
  assert.equal(v2.ok, false);
  assert.ok(v2.blocked_by.some((c) => c.includes("private_data_scope")));
});

// F/G. profile-owned three-source rule (addendum §7)
test("F: fewer than three source observations fails under founder-recovery profile", () => {
  const d = tinyDef();
  d.niche_cell.problem.source_observation_refs = ["obs:a", "obs:b"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("profile_source_observations_insufficient")));
});

test("G: duplicate source observations collapse and then fail the distinct minimum", () => {
  const d = tinyDef();
  d.niche_cell.problem.source_observation_refs = ["obs:a", "obs:a", "obs:b"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("profile_source_observations_insufficient")));
});

test("profile is a closed registry: unknown profile fails, rule lives in the profile", () => {
  const d = tinyDef();
  d.niche_cell.profile = "bizra.dema.niche-profile.unknown.v9.9";
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("profile_unknown")));
  assert.equal(
    NICHE_PROFILES[FOUNDER_RECOVERY_PROFILE_ID].min_distinct_source_observations,
    3,
  );
});

// H/I/J/K. topology
test("H: duplicate task ids fail closed", () => {
  const d = tinyDef();
  d.task_definitions.push({ ...tinyDef().task_definitions[0] });
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("duplicate_task_id")));
});

test("I: missing dependency fails closed", () => {
  const d = tinyDef();
  d.task_definitions[1].dependencies = ["T9"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c === "dependency_missing:T9"));
});

test("J: self-dependency fails closed", () => {
  const d = tinyDef();
  d.task_definitions[0].dependencies = ["T1"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c === "self_dependency:T1"));
});

test("K: dependency cycles fail closed", () => {
  const d = tinyDef();
  d.task_definitions[0].dependencies = ["T2"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("dependency_cycle")));
});

// projection derivation
test("projection: no-dep task PROPOSED; dependent task BLOCKED with named reason", () => {
  const p = compiled().projection;
  assert.equal(p.program_state, "PROPOSED");
  const t1 = p.tasks.find((t) => t.task_id === "T1");
  const t2 = p.tasks.find((t) => t.task_id === "T2");
  assert.deepEqual(t1, { task_id: "T1", derived_state: "PROPOSED", blocked_by: [] });
  assert.deepEqual(t2, {
    task_id: "T2",
    derived_state: "BLOCKED",
    blocked_by: ["dependency_not_accepted:T1"],
  });
});

// L/M. transition law
test("L: illegal transitions fail closed and the table is closed", () => {
  const c = compiled();
  const r = evaluateProgramTransitionCandidate({
    compiled: c,
    task_id: "T1",
    requested_state: "ACTIVE",
  });
  assert.equal(r.structurally_admissible, false);
  assert.ok(r.blocked_by.some((x) => x.startsWith("transition_illegal:")));
  assert.equal(Object.isFrozen(PROGRAM_TASK_TRANSITIONS), true);
  assert.deepEqual(
    [...PROGRAM_TASK_STATES].sort(),
    [
      "ACCEPTED",
      "ACTIVE",
      "BLOCKED",
      "HUMAN_DECISION_REQUIRED",
      "PROPOSED",
      "READY",
      "REJECTED",
      "SUPERSEDED",
      "VERIFYING",
    ],
  );
});

test("lawful candidate: no-dep PROPOSED → READY is structurally admissible, never applied", () => {
  const r = evaluateProgramTransitionCandidate({
    compiled: compiled(),
    task_id: "T1",
    requested_state: "READY",
  });
  assert.equal(r.structurally_admissible, true, JSON.stringify(r.blocked_by));
  assert.equal(r.transition_applied, false);
  assert.equal(r.authority_granted, false);
  assert.deepEqual([...r.does_not_prove], [...TRANSITION_DOES_NOT_PROVE]);
});

test("M: dependency not accepted blocks READY", () => {
  const r = evaluateProgramTransitionCandidate({
    compiled: compiled(),
    task_id: "T2",
    requested_state: "READY",
  });
  assert.equal(r.structurally_admissible, false);
  assert.ok(r.blocked_by.some((x) => x === "dependency_not_accepted:T1"));
});

// N/O/P. acceptance gates (structural only)
test("N/O/P: ACCEPTED without evidence, human decision, or distinct verifier blocks by name", () => {
  const r = evaluateProgramTransitionCandidate({
    compiled: compiled(),
    task_id: "T2",
    requested_state: "ACCEPTED",
    evidence_refs: [],
    verifier_ref: "agent:x",
    worker_ref: "agent:x",
  });
  assert.equal(r.structurally_admissible, false);
  assert.ok(r.blocked_by.some((x) => x === "evidence_missing:evidence:human-acceptance"));
  assert.ok(r.blocked_by.some((x) => x === "human_decision_missing"));
  assert.ok(r.blocked_by.some((x) => x === "verifier_not_distinct"));
  // structural evidence never claims truth
  assert.equal(r.transition_applied, false);
  assert.equal(r.authority_granted, false);
});

// Q/R. authority
test("Q: no failure path ever grants authority or applies a transition", () => {
  for (const req of ["READY", "ACCEPTED", "SUPERSEDED", "REJECTED"]) {
    const r = evaluateProgramTransitionCandidate({
      compiled: compiled(),
      task_id: "T2",
      requested_state: req,
    });
    assert.equal(r.authority_granted, false, req);
    assert.equal(r.transition_applied, false, req);
  }
});

test("R: authority ceiling is closed — any true, missing, extra or non-boolean key blocks", () => {
  const dTrue = tinyDef();
  dTrue.authority_ceiling.network_allowed = true;
  const v1 = validateProgramDefinition(dTrue);
  assert.equal(v1.ok, false);
  assert.ok(v1.blocked_by.some((c) => c === "authority_true:network_allowed"));

  const dMissing = tinyDef();
  delete dMissing.authority_ceiling.promotion_allowed;
  assert.equal(validateProgramDefinition(dMissing).ok, false);

  const dExtra = tinyDef();
  dExtra.authority_ceiling.sudo_allowed = false;
  assert.equal(validateProgramDefinition(dExtra).ok, false);

  const dType = tinyDef();
  dType.authority_ceiling.execution_allowed = "false";
  assert.equal(validateProgramDefinition(dType).ok, false);

  assert.deepEqual(
    [...PROGRAM_AUTHORITY_KEYS].sort(),
    [
      "economic_action_allowed",
      "execution_allowed",
      "external_effect_allowed",
      "model_invocation_allowed",
      "network_allowed",
      "private_content_read_allowed",
      "promotion_allowed",
      "repository_write_allowed",
    ],
  );
});

test("slice boundary is the canonical all-false preview boundary (deep-equal key set)", () => {
  const d = tinyDef();
  d.boundary = { ...buildPreviewBoundary(), network_used: true };
  assert.equal(validateProgramDefinition(d).ok, false);
  const c = compiled();
  assert.deepEqual(c.body.boundary, buildPreviewBoundary());
  assert.deepEqual(Object.keys(c.body.boundary).sort(), [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort());
});

// S. forge-and-rehash
test("S: tampered projection fails verify even though the body hash is intact", () => {
  const c = compiled();
  const forged = {
    canonicalization: c.canonicalization,
    body: c.body,
    body_hash: c.body_hash,
    projection: {
      program_state: c.projection.program_state,
      tasks: c.projection.tasks.map((t) =>
        t.task_id === "T2" ? { ...t, derived_state: "ACCEPTED", blocked_by: [] } : t,
      ),
    },
  };
  const v = verifyCompiledProgram(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((x) => x === "projection_mismatch"));
});

test("S: altered body with the OLD hash fails; with a RECOMPUTED hash it still fails on invariants", () => {
  const c = compiled();
  // schema-valid byte change + OLD hash → hash mismatch fires
  const staleBody = JSON.parse(JSON.stringify(c.body));
  staleBody.title = "tampered title";
  const v1 = verifyCompiledProgram({ ...c, body: staleBody });
  assert.equal(v1.ok, false);
  assert.ok(v1.blocked_by.some((x) => x === "body_hash_mismatch"));
  // invariant-violating change + RECOMPUTED hash → still fails closed
  const alteredBody = JSON.parse(JSON.stringify(c.body));
  alteredBody.authority_ceiling.execution_allowed = true;
  const rehashed = {
    canonicalization: c.canonicalization,
    body: alteredBody,
    body_hash: sha256CanonicalJsonV1(alteredBody),
    projection: c.projection,
  };
  const v2 = verifyCompiledProgram(rehashed);
  assert.equal(v2.ok, false);
  assert.ok(v2.blocked_by.some((x) => x === "authority_true:execution_allowed"));
});

test("S: reordered body arrays with a recomputed hash fail normalization", () => {
  const c = compiled();
  const altered = JSON.parse(JSON.stringify(c.body));
  altered.task_definitions.reverse();
  const rehashed = {
    canonicalization: c.canonicalization,
    body: altered,
    body_hash: sha256CanonicalJsonV1(altered),
    projection: c.projection,
  };
  const v = verifyCompiledProgram(rehashed);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((x) => x === "body_not_normalized"));
});

// T. schema relabel
test("T: schema relabeling fails closed", () => {
  const d = tinyDef();
  d.schema_version = "bizra.dema.program-definition.v9.9";
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c === "schema_version_unsupported"));
});

// blank strings
test("blank or whitespace-only strings fail closed", () => {
  const d = tinyDef();
  d.title = "   ";
  assert.equal(validateProgramDefinition(d).ok, false);
  const d2 = tinyDef();
  d2.task_definitions[0].objective = "";
  assert.equal(validateProgramDefinition(d2).ok, false);
});

test("program_id: format-only validation, no global-uniqueness claim", () => {
  const d = tinyDef();
  d.program_id = "lowercase bad id";
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c === "program_id_format"));
});

test("human-owned tasks must carry a REQUIRED human gate", () => {
  const d = tinyDef();
  d.task_definitions[1].human_gate = "NONE";
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.some((c) => c.startsWith("human_gate_combination")));
});

// U. canonical fixture
test("U: founder-recovery fixture compiles PREVIEW_ONLY, 8 tasks, nothing ACCEPTED", () => {
  const def = buildFounderRecoveryProgramDefinition();
  const c = compileProgramDefinition(def);
  assert.equal(c.body.program_id, "DEMA-CONTINUUM-FOUNDER-RECOVERY-001");
  assert.equal(c.body.truth_label, "PREVIEW_ONLY");
  assert.equal(c.body.task_definitions.length, 8);
  assert.equal(c.projection.tasks.length, 8);
  for (const t of c.projection.tasks) {
    assert.notEqual(t.derived_state, "ACCEPTED", t.task_id);
  }
  assert.equal(c.projection.program_state, "PROPOSED");
  const v = verifyCompiledProgram(c);
  assert.equal(v.ok, true, JSON.stringify(v.blocked_by));
  assert.equal(PROGRAM_GRAPH_TRUTH_LABEL, "PREVIEW_ONLY");
});

// review gate
test("review gate: fixture loop passes and reports the tamper battery", () => {
  const r = runDemaProgramGraphCheck();
  assert.equal(r.ok, true, JSON.stringify(r.blocked_by));
  assert.equal(r.truth_label, "PREVIEW_ONLY");
  assert.equal(r.task_count, 8);
  assert.equal(r.authority_delta, 0);
  assert.match(r.definition_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(r.tamper_rejections >= 5);
  assert.deepEqual(r.boundary, buildPreviewBoundary());
});

test("review gate fails closed on an injected broken fixture", () => {
  const r = runDemaProgramGraphCheck({
    fixture: { ok: false, blocked_by: ["fixture_broken"] },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.some((c) => c.includes("fixture_broken")));
});

// V. purity — the kernel module carries no effectful imports or clocks
test("V: kernel source has no fs/network/process/clock/random access", () => {
  const src = readFileSync(
    join(__dirname, "..", "packages", "mission", "src", "dema-program-graph.js"),
    "utf8",
  );
  for (const forbidden of [
    "node:fs",
    "node:child_process",
    "node:net",
    "node:http",
    "process.env",
    "Date.now",
    "new Date(",
    "Math.random",
  ]) {
    assert.equal(src.includes(forbidden), false, forbidden);
  }
});

// Defensive branches — every named fail-closed path fires.
test("defensive: malformed containers and scalars fail closed by name", () => {
  assert.deepEqual(validateProgramDefinition(null).blocked_by, ["input_not_object"]);
  const cases = [
    [(d) => (d.niche_cell = null), "not_object:niche_cell"],
    [(d) => (d.niche_cell.situation.trigger = "  "), "blank:niche_cell.situation.trigger"],
    [(d) => (d.niche_cell.constraints.privacy = "x"), "not_array:niche_cell.constraints.privacy"],
    [(d) => (d.niche_cell.desired_outcome.acceptance_test_refs = [" "]), "blank_entry:niche_cell.desired_outcome.acceptance_test_refs"],
    [(d) => (d.niche_cell.execution_preview.prompt_capsule_ref = " "), "blank:niche_cell.execution_preview.prompt_capsule_ref"],
    [(d) => (d.niche_cell.proof_contract.human_acceptance_required = "yes"), "not_boolean:niche_cell.proof_contract.human_acceptance_required"],
    [(d) => (d.source_bindings = 7), "not_array:source_bindings"],
    [(d) => (d.task_definitions = []), "task_definitions_empty"],
    [(d) => (d.task_definitions = [null]), "not_object:task_definitions[0]"],
    [(d) => (d.authority_ceiling = null), "not_object:authority_ceiling"],
    [(d) => (d.boundary = null), "not_object:boundary"],
    [(d) => (d.niche_cell.human.human_ref = ""), "blank:niche_cell.human.human_ref"],
    [(d) => (d.niche_cell.problem.observed_pain = ""), "blank:niche_cell.problem.observed_pain"],
    [(d) => (d.niche_cell.desired_outcome.target_state = " "), "blank:niche_cell.desired_outcome.target_state"],
  ];
  for (const [mutate, code] of cases) {
    const d = tinyDef();
    mutate(d);
    const v = validateProgramDefinition(d);
    assert.equal(v.ok, false, code);
    assert.ok(v.blocked_by.includes(code), `${code} in ${JSON.stringify(v.blocked_by)}`);
  }
  const empty = tinyDef();
  empty.task_definitions[0] = {};
  const ve = validateProgramDefinition(empty);
  assert.equal(ve.ok, false);
  assert.ok(ve.blocked_by.some((c) => c.startsWith("missing_key:task_definitions[0]")));
  const numId = tinyDef();
  numId.task_definitions[0].task_id = 7;
  numId.task_definitions[1].dependencies = [];
  assert.equal(validateProgramDefinition(numId).ok, false);
});

test("defensive: compile throws with blocked_by attached on invalid input", () => {
  assert.throws(
    () => compileProgramDefinition({ ...tinyDef(), schema_version: "nope" }),
    (err) => Array.isArray(err.blocked_by) && err.blocked_by.includes("schema_version_unsupported"),
  );
});

test("defensive: verify rejects malformed compiled envelopes by name", () => {
  assert.deepEqual(verifyCompiledProgram(null).blocked_by, ["compiled_not_object"]);
  const c = compiled();
  const missing = { canonicalization: c.canonicalization, body: c.body, body_hash: c.body_hash };
  assert.ok(verifyCompiledProgram(missing).blocked_by.includes("missing_key:compiled.projection"));
  const extra = { ...c, extra_key: 1 };
  assert.ok(verifyCompiledProgram(extra).blocked_by.includes("unknown_key:compiled.extra_key"));
  const wrongAlgo = { ...c, canonicalization: "json.stringify" };
  assert.ok(verifyCompiledProgram(wrongAlgo).blocked_by.includes("canonicalization_unsupported"));
});

test("defensive: evaluate fails closed on unverified program, unknown task/state, bad refs", () => {
  const r1 = evaluateProgramTransitionCandidate({ compiled: null, task_id: "T1", requested_state: "READY" });
  assert.ok(r1.blocked_by.some((c) => c.startsWith("program_not_verified:")));
  const c = compiled();
  const r2 = evaluateProgramTransitionCandidate({ compiled: c, task_id: "T9", requested_state: "READY" });
  assert.ok(r2.blocked_by.includes("task_unknown"));
  const r3 = evaluateProgramTransitionCandidate({ compiled: c, task_id: "T1", requested_state: "LAUNCHED" });
  assert.ok(r3.blocked_by.includes("state_unknown"));
  const r4 = evaluateProgramTransitionCandidate({
    compiled: c, task_id: "T1", requested_state: "READY", evidence_refs: "not-an-array",
  });
  assert.ok(r4.blocked_by.includes("not_array:evidence_refs"));
  const r5 = evaluateProgramTransitionCandidate({ compiled: c, task_id: "T1", requested_state: "BLOCKED" });
  assert.equal(r5.structurally_admissible, true);
  // full ACCEPTED gate satisfaction is still transition-illegal from BLOCKED,
  // but the human/verifier branches must evaluate their satisfied sides too
  const r6 = evaluateProgramTransitionCandidate({
    compiled: c,
    task_id: "T2",
    requested_state: "ACCEPTED",
    evidence_refs: ["evidence:human-acceptance"],
    human_decision_ref: "human:decision-1",
    verifier_ref: "agent:verifier",
    worker_ref: "agent:worker",
  });
  assert.equal(r6.structurally_admissible, false);
  assert.ok(r6.blocked_by.every((code) => !code.startsWith("evidence_missing")));
  assert.ok(!r6.blocked_by.includes("human_decision_missing"));
  assert.ok(!r6.blocked_by.includes("verifier_not_distinct"));
});

test("defensive: gate fallback code fires when injected fixture lacks blocked_by", () => {
  const r = runDemaProgramGraphCheck({ fixture: { ok: false } });
  assert.equal(r.ok, false);
  assert.deepEqual(r.blocked_by, ["fixture:fixture_not_ok"]);
});

// P1 repairs (Greptile on PR #398 head 18cba22)
test("P1: lone-surrogate strings are structured validation failures, not compile crashes", () => {
  const d = tinyDef();
  d.task_definitions[0].permitted_actions = ["\ud800"];
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(
    v.blocked_by.some((c) => c.startsWith("canonicalization_rejected:")),
    JSON.stringify(v.blocked_by),
  );
  assert.throws(
    () => compileProgramDefinition(d),
    (err) => Array.isArray(err.blocked_by),
  );
});

test("P1: accessor-backed input is rejected WITHOUT executing the getter", () => {
  let executed = false;
  const d = tinyDef();
  Object.defineProperty(d, "title", {
    get() { executed = true; return "evil"; },
    enumerable: true, configurable: true,
  });
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
  assert.ok(
    v.blocked_by.some((c) => c.startsWith("accessor_property:definition.title")),
    JSON.stringify(v.blocked_by),
  );
  assert.equal(executed, false, "getter must never run");

  const d2 = tinyDef();
  Object.defineProperty(d2.niche_cell.human, "role", {
    get() { executed = true; return "x"; },
    enumerable: true, configurable: true,
  });
  const v2 = validateProgramDefinition(d2);
  assert.equal(v2.ok, false);
  assert.ok(v2.blocked_by.some((c) => c.startsWith("accessor_property:")));
  assert.equal(executed, false);

  const c = compiled();
  const forged = { canonicalization: c.canonicalization, body: c.body, projection: c.projection };
  Object.defineProperty(forged, "body_hash", {
    get() { executed = true; return c.body_hash; },
    enumerable: true, configurable: true,
  });
  const vv = verifyCompiledProgram(forged);
  assert.equal(vv.ok, false);
  assert.equal(executed, false, "verify must never run envelope getters");
});

test("P1: cyclic input fails closed without hanging the accessor scan", () => {
  const d = tinyDef();
  d.niche_cell.situation.loop = d;
  const v = validateProgramDefinition(d);
  assert.equal(v.ok, false);
});

test("kernel fixture runner is deterministic and self-verifying", () => {
  const f1 = runProgramGraphFixture();
  const f2 = runProgramGraphFixture();
  assert.equal(f1.ok, true, JSON.stringify(f1.blocked_by));
  assert.equal(f1.definition_hash, f2.definition_hash);
  assert.deepEqual(f1, f2);
});
