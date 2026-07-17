// DEMA-PROGRAM-GRAPH-NICHE-CELL-0A — deterministic program-definition compiler
// and projection deriver (PREVIEW_ONLY).
//
// "The graph owns topology; the journal owns history; FATE owns authority."
// A ProgramDefinition is immutable, caller-supplied task topology plus one
// Niche Mission Cell. Everything lifecycle-shaped — task states, blocked
// reasons, program state — is a PURE derivation (the ProgramProjection),
// never caller input. Transition evaluation returns structural candidates
// only: transition_applied and authority_granted are ALWAYS false here.
// Persistence, consent, evidence truth and human identity belong to the
// Mission Corridor journal and FATE, not to this kernel.
//
// Purity: no fs, no network, no process, no clock, no randomness. All values
// are caller-supplied; outputs are deep-frozen.
//
// Serialization: bizra.canonical-json.v1 — hash envelope only. The hash
// subject is `body` (the normalized definition); `body_hash` is never part
// of its own hash subject. Registered consumer under the M5.1B policy (see
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS in canonical-json-v1-check.mjs).

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../../core/src/boundary-schema.js";

export const PROGRAM_DEFINITION_SCHEMA = "bizra.dema.program-definition.v0.1";
export const PROGRAM_GRAPH_TRUTH_LABEL = "PREVIEW_ONLY";

// Profile-owned niche rules (addendum §7): product-research heuristics live
// here, not in generic lifecycle law. The generic kernel only checks that the
// declared profile exists and is internally satisfied.
export const FOUNDER_RECOVERY_PROFILE_ID =
  "bizra.dema.niche-profile.founder-recovery.v0.1";
export const NICHE_PROFILES = Object.freeze({
  [FOUNDER_RECOVERY_PROFILE_ID]: Object.freeze({
    min_distinct_source_observations: 3,
  }),
});

// Closed transition map — an unlisted transition fails closed. Unblocking
// (BLOCKED → anything) is deliberately absent in 0A: reopening a blocked task
// is journal law (Mission Corridor), not graph law.
export const PROGRAM_TASK_TRANSITIONS = Object.freeze({
  PROPOSED: Object.freeze(["READY", "BLOCKED"]),
  READY: Object.freeze(["ACTIVE", "BLOCKED"]),
  ACTIVE: Object.freeze(["VERIFYING", "BLOCKED"]),
  VERIFYING: Object.freeze(["HUMAN_DECISION_REQUIRED", "BLOCKED", "REJECTED"]),
  HUMAN_DECISION_REQUIRED: Object.freeze(["ACCEPTED", "REJECTED"]),
  ACCEPTED: Object.freeze(["SUPERSEDED"]),
  BLOCKED: Object.freeze([]),
  REJECTED: Object.freeze([]),
  SUPERSEDED: Object.freeze([]),
});
export const PROGRAM_TASK_STATES = Object.freeze(
  Object.keys(PROGRAM_TASK_TRANSITIONS),
);

// Program authority ceiling — closed all-false key set. Distinct from the
// slice's preview boundary: the ceiling is the PROGRAM's declared maximum
// authority (all false in 0A); the boundary is this kernel's own conduct.
export const PROGRAM_AUTHORITY_KEYS = Object.freeze([
  "execution_allowed",
  "network_allowed",
  "model_invocation_allowed",
  "private_content_read_allowed",
  "repository_write_allowed",
  "external_effect_allowed",
  "economic_action_allowed",
  "promotion_allowed",
]);

// Structural honesty (addendum §6): what a transition candidate can never
// establish. Identifier separation is not organizational independence.
export const TRANSITION_DOES_NOT_PROVE = Object.freeze([
  "evidence authenticity",
  "human consent authenticity",
  "verifier identity or organizational independence",
  "mission value",
]);

const OWNER_TYPES = Object.freeze(["HUMAN", "DEMA", "WORKER", "VERIFIER"]);
const REPOSITORY_BOUNDARIES = Object.freeze(["NONE", "DEMA", "EXTERNAL"]);
const RISK_CLASSES = Object.freeze(["R0", "R1", "R2", "R3", "R4"]);
const VERIFIER_INDEPENDENCE = Object.freeze(["NOT_REQUIRED", "REQUIRED", "UNKNOWN"]);
const HUMAN_GATES = Object.freeze(["NONE", "REQUIRED"]);
const ROLLBACKS = Object.freeze(["NOT_APPLICABLE", "REQUIRED"]);

const PROGRAM_ID_RE = /^[A-Z0-9][A-Z0-9-]{2,80}$/;
const TASK_ID_RE = /^[A-Z0-9][A-Z0-9_-]{0,63}$/;

// Derived/lifecycle fields a caller may never supply (addendum §3).
const FORBIDDEN_TOP_KEYS = Object.freeze([
  "program_state",
  "content_hash",
  "projection",
  "body_hash",
  "definition_hash",
  "readiness",
  "transition",
  "state",
  "blocked_by",
]);
const FORBIDDEN_TASK_KEYS = Object.freeze([
  "state",
  "blocked_by",
  "derived_state",
  "readiness",
]);

const TOP_KEYS = Object.freeze([
  "schema_version",
  "program_id",
  "program_version",
  "title",
  "purpose",
  "truth_label",
  "source_bindings",
  "niche_cell",
  "task_definitions",
  "authority_ceiling",
  "boundary",
]);
const CELL_KEYS = Object.freeze([
  "niche_cell_id",
  "profile",
  "human",
  "situation",
  "problem",
  "desired_outcome",
  "constraints",
  "execution_preview",
  "proof_contract",
]);
const TASK_KEYS = Object.freeze([
  "task_id",
  "objective",
  "dependencies",
  "owner_type",
  "repository_boundary",
  "risk_class",
  "permitted_actions",
  "forbidden_actions",
  "required_evidence",
  "verifier_independence",
  "human_gate",
  "rollback_requirement",
  "proves",
  "does_not_prove",
]);

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isBlank(v) {
  return typeof v !== "string" || /^\s*$/.test(v);
}
function deepFreeze(v) {
  if (typeof v !== "object" || v === null) return v;
  for (const k of Object.keys(v)) deepFreeze(v[k]);
  return Object.freeze(v);
}
function dedupSort(arr) {
  return [...new Set(arr)].sort();
}
function sameCanonical(a, b) {
  return sha256CanonicalJsonV1(a) === sha256CanonicalJsonV1(b);
}

function checkStringArray(blocked, value, label) {
  if (!Array.isArray(value)) {
    blocked.push(`not_array:${label}`);
    return false;
  }
  for (const entry of value) {
    if (isBlank(entry)) {
      blocked.push(`blank_entry:${label}`);
      return false;
    }
  }
  return true;
}

function checkClosedObject(blocked, value, keys, label, forbidden = []) {
  if (!isPlainObject(value)) {
    blocked.push(`not_object:${label}`);
    return false;
  }
  let ok = true;
  for (const k of Object.keys(value)) {
    if (forbidden.includes(k)) {
      blocked.push(`derived_field_supplied:${label === "definition" ? k : `${label}.${k}`}`);
      ok = false;
    } else if (!keys.includes(k)) {
      blocked.push(`unknown_key:${label}.${k}`);
      ok = false;
    }
  }
  for (const k of keys) {
    if (!(k in value)) {
      blocked.push(`missing_key:${label}.${k}`);
      ok = false;
    }
  }
  return ok;
}

function validateNicheCell(blocked, cell) {
  if (!checkClosedObject(blocked, cell, CELL_KEYS, "niche_cell")) return;
  if (isBlank(cell.niche_cell_id)) blocked.push("blank:niche_cell.niche_cell_id");

  const profile = NICHE_PROFILES[cell.profile];
  if (!profile) blocked.push(`profile_unknown:${String(cell.profile)}`);

  if (checkClosedObject(blocked, cell.human, ["human_ref", "role", "private_data_scope"], "niche_cell.human")) {
    if (isBlank(cell.human.human_ref)) blocked.push("blank:niche_cell.human.human_ref");
    if (isBlank(cell.human.role)) blocked.push("blank:niche_cell.human.role");
    if (cell.human.private_data_scope !== "BOUNDED_REFERENCE_ONLY") {
      blocked.push("niche_cell_private_data_scope_invalid");
    }
  }
  if (checkClosedObject(blocked, cell.situation, ["current_state", "active_project", "trigger"], "niche_cell.situation")) {
    for (const k of ["current_state", "active_project", "trigger"]) {
      if (isBlank(cell.situation[k])) blocked.push(`blank:niche_cell.situation.${k}`);
    }
  }
  if (checkClosedObject(blocked, cell.problem, ["observed_pain", "root_constraint", "source_observation_refs"], "niche_cell.problem")) {
    for (const k of ["observed_pain", "root_constraint"]) {
      if (isBlank(cell.problem[k])) blocked.push(`blank:niche_cell.problem.${k}`);
    }
    if (checkStringArray(blocked, cell.problem.source_observation_refs, "niche_cell.problem.source_observation_refs") && profile) {
      const distinct = new Set(cell.problem.source_observation_refs).size;
      if (distinct < profile.min_distinct_source_observations) {
        blocked.push(
          `profile_source_observations_insufficient:${distinct}<${profile.min_distinct_source_observations}`,
        );
      }
    }
  }
  if (checkClosedObject(blocked, cell.desired_outcome, ["target_state", "human_value_hypothesis", "acceptance_test_refs"], "niche_cell.desired_outcome")) {
    for (const k of ["target_state", "human_value_hypothesis"]) {
      if (isBlank(cell.desired_outcome[k])) blocked.push(`blank:niche_cell.desired_outcome.${k}`);
    }
    checkStringArray(blocked, cell.desired_outcome.acceptance_test_refs, "niche_cell.desired_outcome.acceptance_test_refs");
  }
  if (checkClosedObject(blocked, cell.constraints, ["privacy", "authority", "reversibility", "budget"], "niche_cell.constraints")) {
    for (const k of ["privacy", "authority", "reversibility", "budget"]) {
      checkStringArray(blocked, cell.constraints[k], `niche_cell.constraints.${k}`);
    }
  }
  if (checkClosedObject(blocked, cell.execution_preview, ["prompt_capsule_ref", "context_capsule_ref", "harness_manifest_ref", "loop_manifest_ref"], "niche_cell.execution_preview")) {
    for (const k of ["prompt_capsule_ref", "context_capsule_ref", "harness_manifest_ref", "loop_manifest_ref"]) {
      const v = cell.execution_preview[k];
      if (v !== null && isBlank(v)) blocked.push(`blank:niche_cell.execution_preview.${k}`);
    }
  }
  if (checkClosedObject(blocked, cell.proof_contract, ["required_evidence", "independent_verifier_required", "human_acceptance_required"], "niche_cell.proof_contract")) {
    checkStringArray(blocked, cell.proof_contract.required_evidence, "niche_cell.proof_contract.required_evidence");
    for (const k of ["independent_verifier_required", "human_acceptance_required"]) {
      if (typeof cell.proof_contract[k] !== "boolean") {
        blocked.push(`not_boolean:niche_cell.proof_contract.${k}`);
      }
    }
  }
}

function validateTask(blocked, task, index) {
  const label = `task_definitions[${index}]`;
  if (!isPlainObject(task)) {
    blocked.push(`not_object:${label}`);
    return;
  }
  for (const k of Object.keys(task)) {
    if (FORBIDDEN_TASK_KEYS.includes(k)) blocked.push(`derived_field_supplied:task.${k}`);
    else if (!TASK_KEYS.includes(k)) blocked.push(`unknown_key:${label}.${k}`);
  }
  for (const k of TASK_KEYS) {
    if (!(k in task)) blocked.push(`missing_key:${label}.${k}`);
  }
  if (typeof task.task_id === "string" && !TASK_ID_RE.test(task.task_id)) {
    blocked.push(`task_id_format:${task.task_id}`);
  }
  if (isBlank(task.task_id)) blocked.push(`blank:${label}.task_id`);
  if (isBlank(task.objective)) blocked.push(`blank:${label}.objective`);
  checkStringArray(blocked, task.dependencies, `${label}.dependencies`);
  if (!OWNER_TYPES.includes(task.owner_type)) blocked.push(`owner_type_invalid:${label}`);
  if (!REPOSITORY_BOUNDARIES.includes(task.repository_boundary)) blocked.push(`repository_boundary_invalid:${label}`);
  if (!RISK_CLASSES.includes(task.risk_class)) blocked.push(`risk_class_invalid:${label}`);
  if (!VERIFIER_INDEPENDENCE.includes(task.verifier_independence)) blocked.push(`verifier_independence_invalid:${label}`);
  if (!HUMAN_GATES.includes(task.human_gate)) blocked.push(`human_gate_invalid:${label}`);
  if (!ROLLBACKS.includes(task.rollback_requirement)) blocked.push(`rollback_requirement_invalid:${label}`);
  if (task.owner_type === "HUMAN" && task.human_gate !== "REQUIRED") {
    blocked.push(`human_gate_combination:${String(task.task_id)}`);
  }
  for (const k of ["permitted_actions", "forbidden_actions", "required_evidence", "proves", "does_not_prove"]) {
    checkStringArray(blocked, task[k], `${label}.${k}`);
  }
}

function validateTopology(blocked, tasks) {
  const ids = tasks.map((t) => t.task_id).filter((id) => typeof id === "string");
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) blocked.push(`duplicate_task_id:${id}`);
    seen.add(id);
  }
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  for (const t of tasks) {
    if (!Array.isArray(t.dependencies)) continue;
    for (const dep of t.dependencies) {
      if (dep === t.task_id) blocked.push(`self_dependency:${t.task_id}`);
      else if (!byId.has(dep)) blocked.push(`dependency_missing:${dep}`);
    }
  }
  // Cycle detection: iterative DFS, three colors.
  const color = new Map(ids.map((id) => [id, 0])); // 0 white, 1 gray, 2 black
  for (const start of ids) {
    if (color.get(start) !== 0) continue;
    const stack = [[start, 0]];
    while (stack.length > 0) {
      const [id, i] = stack[stack.length - 1];
      if (i === 0) color.set(id, 1);
      const deps = (byId.get(id)?.dependencies ?? []).filter((d) => byId.has(d) && d !== id);
      if (i < deps.length) {
        stack[stack.length - 1][1] = i + 1;
        const dep = deps[i];
        if (color.get(dep) === 1) {
          blocked.push(`dependency_cycle:${dep}`);
          return;
        }
        if (color.get(dep) === 0) stack.push([dep, 0]);
      } else {
        color.set(id, 2);
        stack.pop();
      }
    }
  }
}

function validateAuthorityCeiling(blocked, ceiling) {
  if (!isPlainObject(ceiling)) {
    blocked.push("not_object:authority_ceiling");
    return;
  }
  const keys = Object.keys(ceiling).sort();
  if (keys.join(",") !== [...PROGRAM_AUTHORITY_KEYS].sort().join(",")) {
    blocked.push("authority_keys_mismatch");
    return;
  }
  for (const k of PROGRAM_AUTHORITY_KEYS) {
    if (typeof ceiling[k] !== "boolean") blocked.push(`authority_not_boolean:${k}`);
    else if (ceiling[k] === true) blocked.push(`authority_true:${k}`);
  }
}

function validateBoundary(blocked, boundary) {
  if (!isPlainObject(boundary)) {
    blocked.push("not_object:boundary");
    return;
  }
  if (!sameCanonical(boundary, buildPreviewBoundary())) {
    blocked.push("boundary_not_canonical_all_false");
  }
}

export function validateProgramDefinition(input) {
  const blocked = [];
  if (!isPlainObject(input)) {
    return deepFreeze({ ok: false, blocked_by: ["input_not_object"] });
  }
  for (const k of Object.keys(input)) {
    if (FORBIDDEN_TOP_KEYS.includes(k)) blocked.push(`derived_field_supplied:${k}`);
    else if (!TOP_KEYS.includes(k)) blocked.push(`unknown_key:${k}`);
  }
  for (const k of TOP_KEYS) {
    if (!(k in input)) blocked.push(`missing_key:${k}`);
  }
  if (blocked.length === 0) {
    if (input.schema_version !== PROGRAM_DEFINITION_SCHEMA) blocked.push("schema_version_unsupported");
    if (typeof input.program_id !== "string" || !PROGRAM_ID_RE.test(input.program_id)) {
      blocked.push("program_id_format");
    }
    for (const k of ["program_version", "title", "purpose"]) {
      if (isBlank(input[k])) blocked.push(`blank:${k}`);
    }
    if (input.truth_label !== "PREVIEW_ONLY") blocked.push("truth_label_not_preview_only");
    checkStringArray(blocked, input.source_bindings, "source_bindings");
    validateNicheCell(blocked, input.niche_cell);
    if (!Array.isArray(input.task_definitions) || input.task_definitions.length === 0) {
      blocked.push("task_definitions_empty");
    } else {
      input.task_definitions.forEach((t, i) => validateTask(blocked, t, i));
      if (blocked.length === 0) validateTopology(blocked, input.task_definitions);
    }
    validateAuthorityCeiling(blocked, input.authority_ceiling);
    validateBoundary(blocked, input.boundary);
  }
  return deepFreeze({ ok: blocked.length === 0, blocked_by: dedupSort(blocked) });
}

// Semantic normalization (addendum §5): set-like arrays dedup+sort; tasks
// ordered by task_id; key order rebuilt canonically. Sequence-meaningful
// arrays do not exist in this schema.
function normalizeDefinition(def) {
  const cell = def.niche_cell;
  return {
    schema_version: def.schema_version,
    program_id: def.program_id,
    program_version: def.program_version,
    title: def.title,
    purpose: def.purpose,
    truth_label: def.truth_label,
    source_bindings: dedupSort(def.source_bindings),
    niche_cell: {
      niche_cell_id: cell.niche_cell_id,
      profile: cell.profile,
      human: {
        human_ref: cell.human.human_ref,
        role: cell.human.role,
        private_data_scope: cell.human.private_data_scope,
      },
      situation: {
        current_state: cell.situation.current_state,
        active_project: cell.situation.active_project,
        trigger: cell.situation.trigger,
      },
      problem: {
        observed_pain: cell.problem.observed_pain,
        root_constraint: cell.problem.root_constraint,
        source_observation_refs: dedupSort(cell.problem.source_observation_refs),
      },
      desired_outcome: {
        target_state: cell.desired_outcome.target_state,
        human_value_hypothesis: cell.desired_outcome.human_value_hypothesis,
        acceptance_test_refs: dedupSort(cell.desired_outcome.acceptance_test_refs),
      },
      constraints: {
        privacy: dedupSort(cell.constraints.privacy),
        authority: dedupSort(cell.constraints.authority),
        reversibility: dedupSort(cell.constraints.reversibility),
        budget: dedupSort(cell.constraints.budget),
      },
      execution_preview: {
        prompt_capsule_ref: cell.execution_preview.prompt_capsule_ref,
        context_capsule_ref: cell.execution_preview.context_capsule_ref,
        harness_manifest_ref: cell.execution_preview.harness_manifest_ref,
        loop_manifest_ref: cell.execution_preview.loop_manifest_ref,
      },
      proof_contract: {
        required_evidence: dedupSort(cell.proof_contract.required_evidence),
        independent_verifier_required: cell.proof_contract.independent_verifier_required,
        human_acceptance_required: cell.proof_contract.human_acceptance_required,
      },
    },
    task_definitions: [...def.task_definitions]
      .sort((a, b) => (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0))
      .map((t) => ({
        task_id: t.task_id,
        objective: t.objective,
        dependencies: dedupSort(t.dependencies),
        owner_type: t.owner_type,
        repository_boundary: t.repository_boundary,
        risk_class: t.risk_class,
        permitted_actions: dedupSort(t.permitted_actions),
        forbidden_actions: dedupSort(t.forbidden_actions),
        required_evidence: dedupSort(t.required_evidence),
        verifier_independence: t.verifier_independence,
        human_gate: t.human_gate,
        rollback_requirement: t.rollback_requirement,
        proves: dedupSort(t.proves),
        does_not_prove: dedupSort(t.does_not_prove),
      })),
    authority_ceiling: Object.fromEntries(
      PROGRAM_AUTHORITY_KEYS.map((k) => [k, def.authority_ceiling[k]]),
    ),
    boundary: buildPreviewBoundary(),
  };
}

// ProgramProjection — derived, never asserted. With no journal, a task's only
// possible state is its initial one: PROPOSED without dependencies, BLOCKED
// behind unaccepted dependencies. program_state is PROPOSED by construction.
export function deriveProgramProjection(normalizedDefinition) {
  const tasks = normalizedDefinition.task_definitions.map((t) => {
    const blocked_by = t.dependencies.map((d) => `dependency_not_accepted:${d}`);
    return {
      task_id: t.task_id,
      derived_state: blocked_by.length === 0 ? "PROPOSED" : "BLOCKED",
      blocked_by,
    };
  });
  return deepFreeze({ program_state: "PROPOSED", tasks });
}

export function compileProgramDefinition(input) {
  const v = validateProgramDefinition(input);
  if (!v.ok) {
    const err = new Error(`program_definition_invalid:${v.blocked_by.join(",")}`);
    err.blocked_by = v.blocked_by;
    throw err;
  }
  const body = normalizeDefinition(input);
  const body_hash = sha256CanonicalJsonV1(body);
  const projection = deriveProgramProjection(body);
  return deepFreeze({
    canonicalization: CANONICAL_JSON_V1_ALGORITHM,
    body,
    body_hash,
    projection,
  });
}

const COMPILED_KEYS = Object.freeze(["canonicalization", "body", "body_hash", "projection"]);

export function verifyCompiledProgram(compiled) {
  const blocked = [];
  if (!isPlainObject(compiled)) {
    return deepFreeze({ ok: false, blocked_by: ["compiled_not_object"] });
  }
  for (const k of Object.keys(compiled)) {
    if (!COMPILED_KEYS.includes(k)) blocked.push(`unknown_key:compiled.${k}`);
  }
  for (const k of COMPILED_KEYS) {
    if (!(k in compiled)) blocked.push(`missing_key:compiled.${k}`);
  }
  if (blocked.length > 0) return deepFreeze({ ok: false, blocked_by: dedupSort(blocked) });

  if (compiled.canonicalization !== CANONICAL_JSON_V1_ALGORITHM) {
    blocked.push("canonicalization_unsupported");
  }
  const v = validateProgramDefinition(compiled.body);
  if (!v.ok) blocked.push(...v.blocked_by);
  else {
    // Normalization idempotence: a reordered-then-rehashed body is a forge.
    if (!sameCanonical(normalizeDefinition(compiled.body), compiled.body)) {
      blocked.push("body_not_normalized");
    }
    if (sha256CanonicalJsonV1(compiled.body) !== compiled.body_hash) {
      blocked.push("body_hash_mismatch");
    }
    if (!sameCanonical(deriveProgramProjection(normalizeDefinition(compiled.body)), compiled.projection)) {
      blocked.push("projection_mismatch");
    }
  }
  return deepFreeze({ ok: blocked.length === 0, blocked_by: dedupSort(blocked) });
}

// Structural transition candidate (addendum §6). Never persists, never
// applies, never grants. Evidence/human/verifier refs are identifiers only —
// presence, not truth.
export function evaluateProgramTransitionCandidate({
  compiled,
  task_id,
  requested_state,
  evidence_refs = [],
  human_decision_ref = null,
  verifier_ref = null,
  worker_ref = null,
} = {}) {
  const blocked = [];
  const verdict = verifyCompiledProgram(compiled);
  if (!verdict.ok) {
    blocked.push(...verdict.blocked_by.map((c) => `program_not_verified:${c}`));
  }
  let current_state = null;
  if (verdict.ok) {
    const projected = compiled.projection.tasks.find((t) => t.task_id === task_id);
    const definition = compiled.body.task_definitions.find((t) => t.task_id === task_id);
    if (!projected || !definition) {
      blocked.push("task_unknown");
    } else {
      current_state = projected.derived_state;
      if (!PROGRAM_TASK_STATES.includes(requested_state)) {
        blocked.push("state_unknown");
      } else {
        if (!PROGRAM_TASK_TRANSITIONS[current_state].includes(requested_state)) {
          blocked.push(`transition_illegal:${current_state}->${requested_state}`);
        }
        if (!checkStringArray(blocked, evidence_refs, "evidence_refs")) {
          // named block already pushed
        }
        if (requested_state === "READY") {
          const byId = new Map(compiled.projection.tasks.map((t) => [t.task_id, t]));
          for (const dep of definition.dependencies) {
            if (byId.get(dep)?.derived_state !== "ACCEPTED") {
              blocked.push(`dependency_not_accepted:${dep}`);
            }
          }
        }
        if (requested_state === "ACCEPTED") {
          const supplied = new Set(Array.isArray(evidence_refs) ? evidence_refs : []);
          for (const ev of definition.required_evidence) {
            if (!supplied.has(ev)) blocked.push(`evidence_missing:${ev}`);
          }
          if (definition.human_gate === "REQUIRED" && isBlank(human_decision_ref)) {
            blocked.push("human_decision_missing");
          }
          if (definition.verifier_independence === "REQUIRED") {
            if (isBlank(verifier_ref)) blocked.push("verifier_missing");
            else if (!isBlank(worker_ref) && verifier_ref === worker_ref) {
              blocked.push("verifier_not_distinct");
            }
          }
        }
      }
    }
  }
  return deepFreeze({
    structurally_admissible: blocked.length === 0,
    current_state,
    requested_state,
    blocked_by: dedupSort(blocked),
    authority_granted: false,
    transition_applied: false,
    does_not_prove: TRANSITION_DOES_NOT_PROVE,
  });
}

// ── Canonical fixture ────────────────────────────────────────────────────
// DEMA-CONTINUUM-FOUNDER-RECOVERY-001: a program REPRESENTATION only. It
// reads nothing, retrieves nothing, invokes nothing, proves no value.
function fixtureTask(overrides) {
  return {
    dependencies: [],
    owner_type: "WORKER",
    repository_boundary: "NONE",
    risk_class: "R0",
    forbidden_actions: [
      "invoke a model",
      "perform an external effect",
      "read private archive content",
    ],
    verifier_independence: "NOT_REQUIRED",
    human_gate: "NONE",
    rollback_requirement: "NOT_APPLICABLE",
    ...overrides,
  };
}

export function buildFounderRecoveryProgramDefinition() {
  return {
    schema_version: PROGRAM_DEFINITION_SCHEMA,
    program_id: "DEMA-CONTINUUM-FOUNDER-RECOVERY-001",
    program_version: "0.1",
    title: "Founder Recovery Mission — program representation",
    purpose:
      "Recover one source-bound BIZRA architecture asset and prepare it for use in a current Dema Continuum Recovery Mission specification.",
    truth_label: "PREVIEW_ONLY",
    source_bindings: ["src:founder-archive-manifest-ref"],
    niche_cell: {
      niche_cell_id: "cell-founder-recovery-001",
      profile: FOUNDER_RECOVERY_PROFILE_ID,
      human: {
        human_ref: "human:founder-node0",
        role: "founder-operator",
        private_data_scope: "BOUNDED_REFERENCE_ONLY",
      },
      situation: {
        current_state: "three-year archive indexed but unexploited",
        active_project: "dema-continuum-recovery-mission",
        trigger: "recurring need to re-derive prior architecture work",
      },
      problem: {
        observed_pain: "prior verified work is re-created instead of recovered",
        root_constraint: "no bounded, consented recovery loop over the archive",
        source_observation_refs: [
          "obs:genesis-inventory-0a-receipt",
          "obs:founder-corpus-manifest-row",
          "obs:mission-corridor-journal-gap-note",
        ],
      },
      desired_outcome: {
        target_state: "one recovered asset reused inside a current mission",
        human_value_hypothesis:
          "recovery is safer and faster than re-derivation from memory",
        acceptance_test_refs: ["accept:asset-reused-in-current-mission"],
      },
      constraints: {
        privacy: ["identifiers and hashes only; no private content in artifacts"],
        authority: ["authority ceiling all false; FATE owns any future grant"],
        reversibility: ["no destructive action; preservation is additive"],
        budget: ["one bounded operator session per task"],
      },
      execution_preview: {
        prompt_capsule_ref: null,
        context_capsule_ref: null,
        harness_manifest_ref: null,
        loop_manifest_ref: null,
      },
      proof_contract: {
        required_evidence: [
          "evidence:independent-verification-report",
          "evidence:human-acceptance-record",
        ],
        independent_verifier_required: true,
        human_acceptance_required: true,
      },
    },
    task_definitions: [
      fixtureTask({
        task_id: "T1",
        objective: "Bind approved source references for the recovery scope.",
        owner_type: "DEMA",
        permitted_actions: ["list approved source reference identifiers"],
        required_evidence: ["evidence:approved-source-manifest"],
        proves: ["the recovery scope is explicit and bounded"],
        does_not_prove: ["any source content was read"],
      }),
      fixtureTask({
        task_id: "T2",
        objective: "Reconstruct candidate lineage from bound references.",
        dependencies: ["T1"],
        permitted_actions: ["describe lineage between referenced artifacts"],
        required_evidence: ["evidence:lineage-reconstruction-note"],
        proves: ["candidate lineage is representable"],
        does_not_prove: ["lineage is historically complete"],
      }),
      fixtureTask({
        task_id: "T3",
        objective: "Identify three candidate recovered assets.",
        dependencies: ["T2"],
        permitted_actions: ["shortlist candidate asset identifiers"],
        required_evidence: ["evidence:candidate-asset-shortlist"],
        proves: ["a bounded candidate set exists"],
        does_not_prove: ["any candidate was recovered"],
      }),
      fixtureTask({
        task_id: "T4",
        objective: "Human selects one candidate asset.",
        dependencies: ["T3"],
        owner_type: "HUMAN",
        human_gate: "REQUIRED",
        permitted_actions: ["record the human selection identifier"],
        required_evidence: ["evidence:human-selection-record"],
        proves: ["selection authority stays human"],
        does_not_prove: ["the selection is optimal"],
      }),
      fixtureTask({
        task_id: "T5",
        objective: "Prepare a current-mission reuse proposal for the selection.",
        dependencies: ["T4"],
        risk_class: "R1",
        permitted_actions: ["draft a reuse proposal referencing the selection"],
        required_evidence: ["evidence:reuse-proposal-draft"],
        proves: ["reuse intent is explicit"],
        does_not_prove: ["reuse occurred"],
      }),
      fixtureTask({
        task_id: "T6",
        objective: "Independently verify source binding and relevance.",
        dependencies: ["T5"],
        owner_type: "VERIFIER",
        verifier_independence: "REQUIRED",
        permitted_actions: ["judge the proposal against its source references"],
        required_evidence: ["evidence:independent-verification-report"],
        proves: ["verification is a distinct role"],
        does_not_prove: ["organizational verifier independence"],
      }),
      fixtureTask({
        task_id: "T7",
        objective: "Request human acceptance of the verified result.",
        dependencies: ["T6"],
        owner_type: "HUMAN",
        human_gate: "REQUIRED",
        permitted_actions: ["present the verified result for acceptance"],
        required_evidence: ["evidence:human-acceptance-record"],
        proves: ["acceptance is gated on the human"],
        does_not_prove: ["value was measured"],
      }),
      fixtureTask({
        task_id: "T8",
        objective: "Preserve the accepted result as a capability candidate.",
        dependencies: ["T7"],
        owner_type: "DEMA",
        risk_class: "R1",
        rollback_requirement: "REQUIRED",
        permitted_actions: ["record a capability-candidate reference"],
        required_evidence: ["evidence:capability-candidate-receipt"],
        proves: ["preservation is representable with rollback"],
        does_not_prove: ["a capability was promoted"],
      }),
    ],
    authority_ceiling: Object.fromEntries(PROGRAM_AUTHORITY_KEYS.map((k) => [k, false])),
    boundary: buildPreviewBoundary(),
  };
}

// Deterministic fixture loop for the review gate: compile → verify → tamper
// battery → transition checks. Pure; identical output on every call.
export function runProgramGraphFixture() {
  const blocked = [];
  const def = buildFounderRecoveryProgramDefinition();
  let compiledProgram = null;
  try {
    compiledProgram = compileProgramDefinition(def);
  } catch (err) {
    return deepFreeze({ ok: false, blocked_by: [`compile_failed:${err.message}`] });
  }
  const verified = verifyCompiledProgram(compiledProgram);
  if (!verified.ok) blocked.push(...verified.blocked_by.map((c) => `verify:${c}`));

  // Tamper battery — every entry MUST be rejected.
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const rehash = (body) => ({
    canonicalization: compiledProgram.canonicalization,
    body,
    body_hash: sha256CanonicalJsonV1(body),
    projection: clone(compiledProgram.projection),
  });
  const tampers = [];
  {
    const t = clone(compiledProgram);
    t.projection.tasks[0].derived_state = "ACCEPTED";
    tampers.push(["projection_forge", t]);
  }
  {
    const t = clone(compiledProgram);
    t.body.title = "tampered";
    tampers.push(["stale_hash", t]);
  }
  {
    const b = clone(compiledProgram.body);
    b.authority_ceiling.execution_allowed = true;
    tampers.push(["authority_rehash", rehash(b)]);
  }
  {
    const b = clone(compiledProgram.body);
    b.task_definitions.reverse();
    tampers.push(["reorder_rehash", rehash(b)]);
  }
  {
    const b = clone(compiledProgram.body);
    b.schema_version = "bizra.dema.program-definition.v9.9";
    tampers.push(["schema_relabel_rehash", rehash(b)]);
  }
  {
    const b = clone(compiledProgram.body);
    b.niche_cell.problem.source_observation_refs = ["obs:a"];
    tampers.push(["source_refs_rehash", rehash(b)]);
  }
  {
    const b = clone(compiledProgram.body);
    b.task_definitions.find((t) => t.task_id === "T7").human_gate = "NONE";
    tampers.push(["human_gate_rehash", rehash(b)]);
  }
  let tamper_rejections = 0;
  for (const [name, forged] of tampers) {
    if (verifyCompiledProgram(forged).ok) blocked.push(`tamper_accepted:${name}`);
    else tamper_rejections += 1;
  }

  // Transition checks — lawful admissible, unlawful blocked, nothing applied.
  const t1Ready = evaluateProgramTransitionCandidate({
    compiled: compiledProgram,
    task_id: "T1",
    requested_state: "READY",
  });
  const t2Ready = evaluateProgramTransitionCandidate({
    compiled: compiledProgram,
    task_id: "T2",
    requested_state: "READY",
  });
  const t7Accept = evaluateProgramTransitionCandidate({
    compiled: compiledProgram,
    task_id: "T7",
    requested_state: "ACCEPTED",
    verifier_ref: "agent:same",
    worker_ref: "agent:same",
  });
  if (!t1Ready.structurally_admissible) blocked.push("t1_ready_not_admissible");
  if (t2Ready.structurally_admissible) blocked.push("t2_ready_wrongly_admissible");
  if (t7Accept.structurally_admissible) blocked.push("t7_accept_wrongly_admissible");
  for (const r of [t1Ready, t2Ready, t7Accept]) {
    if (r.transition_applied !== false || r.authority_granted !== false) {
      blocked.push("candidate_claimed_application_or_authority");
    }
  }

  return deepFreeze({
    ok: blocked.length === 0,
    blocked_by: dedupSort(blocked),
    schema: PROGRAM_DEFINITION_SCHEMA,
    truth_label: PROGRAM_GRAPH_TRUTH_LABEL,
    program_id: compiledProgram.body.program_id,
    task_count: compiledProgram.body.task_definitions.length,
    graph_valid: verified.ok,
    definition_hash: compiledProgram.body_hash,
    tamper_rejections,
    transition_checks: {
      t1_ready_admissible: t1Ready.structurally_admissible,
      t2_ready_blocked: !t2Ready.structurally_admissible,
      t7_accept_blocked: !t7Accept.structurally_admissible,
    },
  });
}
