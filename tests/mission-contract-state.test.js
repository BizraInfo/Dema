// MISSION-CONTRACT-STATE-0A — red-first tests for TASK-026 spec phase 01.
//
// Anchors T-01..T-06 from
// /data/bizra/research/MISSION_RUNTIME_0A_SPEC_v0_1/phase_01_mission_contract_and_state.md
//
// This phase proves mission IDENTITY and STATE survive workers. It does NOT prove
// any mission runs — conduction is phase 02, workers are phase 03.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MISSION_CONTRACT_SCHEMA,
  MISSION_CONTRACT_SCHEMA_V0_1,
  MISSION_CONTRACT_INSPECTION_SCHEMA,
  MISSION_CONTRACT_CREATED_KIND,
  MISSION_CONTRACT_INSPECTION_KIND,
  MISSION_STATE_SCHEMA,
  MISSION_CONTRACT_GO_PHRASE,
  ACCEPTANCE_PRECEDENCE,
  createMissionContract,
  inspectMissionContractFields,
  isCreatedMissionContract,
  isMissionContractInspection,
  proposeContractAmendment,
  buildMissionState,
  checkpointMissionState,
  resumeMissionState,
  missionContractStateBoundary,
} from "../packages/core/src/mission-contract-state.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const GO = MISSION_CONTRACT_GO_PHRASE;

const FIELDS = Object.freeze({
  mission_id: "MISSION-REPAIR-001",
  purpose: "Repair one bounded local defect",
  scope: "packages/core/src only",
  // NORMATIVE: the only surface that decides a verdict.
  acceptance_contract: Object.freeze({
    required_output_keys: Object.freeze(["patch", "test_result"]),
    forbidden_substrings: Object.freeze(["TODO"]),
  }),
  // ADVISORY: hash-bound human intent, consulted by no judge.
  acceptance_criteria: Object.freeze(["focused test green", "full gates green"]),
  prohibited_outcomes: Object.freeze(["push", "merge", "network"]),
  authority_ceiling: "local_reversible",
  iteration_budget: 4,
  completion_conditions: Object.freeze(["all acceptance criteria met"]),
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
});

const contractOf = (over = {}) => createMissionContract({ fields: { ...FIELDS, ...over }, consent: GO });

// ── T-01 · creation validation throws NAMED errors ────────────────────────────
test("T-01: empty acceptance_criteria is invalid at creation (EC-4)", () => {
  assert.throws(
    () => contractOf({ acceptance_criteria: [] }),
    (e) => e.code === "acceptance_criteria_empty",
  );
});

test("T-01: iteration_budget <= 0 or non-integer is invalid at creation (EC-5)", () => {
  assert.throws(() => contractOf({ iteration_budget: 0 }), (e) => e.code === "iteration_budget_invalid");
  assert.throws(() => contractOf({ iteration_budget: 2.5 }), (e) => e.code === "iteration_budget_invalid");
});

test("T-01: creation without the exact consent phrase is refused", () => {
  assert.throws(
    () => createMissionContract({ fields: FIELDS, consent: "go: mission contract" }),
    (e) => e.code === "consent_phrase_mismatch",
  );
});

// ── T-02 · canonical determinism ──────────────────────────────────────────────
test("T-02: identical fields hash identically across runs", () => {
  assert.equal(contractOf().contract_hash, contractOf().contract_hash);
});

test("T-02: key order cannot change the contract hash", () => {
  const reordered = {};
  for (const k of Object.keys(FIELDS).reverse()) reordered[k] = FIELDS[k];
  assert.equal(
    createMissionContract({ fields: reordered, consent: GO }).contract_hash,
    contractOf().contract_hash,
  );
});

test("T-02: a changed field changes the hash", () => {
  assert.notEqual(contractOf({ iteration_budget: 5 }).contract_hash, contractOf().contract_hash);
});

// ── T-03 · immutability (FR-2) ────────────────────────────────────────────────
test("T-03: a worker-channel amendment is rejected fail-closed", () => {
  const base = contractOf();
  const r = proposeContractAmendment({
    contract: base.contract,
    changes: { authority_ceiling: "unbounded" },
    channel: "worker",
    consent: GO,
  });
  assert.equal(r.accepted, false);
  assert.equal(r.refusal, "contract_mutation_rejected");
  assert.equal(r.contract_hash, base.contract_hash, "the authoritative hash must be unchanged");
});

test("T-03: an operator-consented amendment yields a NEW hash and preserves the old", () => {
  const base = contractOf();
  const r = proposeContractAmendment({
    contract: base.contract,
    changes: { iteration_budget: 8 },
    channel: "operator_consented",
    consent: GO,
  });
  assert.equal(r.accepted, true);
  assert.notEqual(r.contract_hash, base.contract_hash);
  assert.equal(r.previous_contract_hash, base.contract_hash, "old contract stays resolvable");
  assert.equal(base.contract.iteration_budget, 4, "no in-place edit");
});

test("T-03: there is no in-place edit path — the returned contract is deeply frozen", () => {
  const base = contractOf();
  assert.throws(() => {
    base.contract.authority_ceiling = "unbounded";
  }, TypeError);
  assert.throws(() => {
    base.contract.acceptance_criteria.push("smuggled");
  }, TypeError);
});

// ── T-04 · checkpoint / resume round trip (FR-4) ──────────────────────────────
const stateOf = (c) =>
  buildMissionState({
    contract_hash: c.contract_hash,
    current_stage: "PLAN",
    iteration_used: 1,
    worker_history: ["worker-a"],
    accepted_evidence: [],
    failed_attempts: [],
    open_blockers: [],
    receipt_head: null,
    state_seq: 0,
  });

test("T-04: checkpoint -> resume round trip yields deep-equal state", () => {
  const c = contractOf();
  const cp = checkpointMissionState(stateOf(c));
  const resumed = resumeMissionState({ checkpoint: cp, liveContractHash: c.contract_hash });
  assert.deepEqual(resumed, cp.snapshot);
  assert.equal(cp.snapshot.state_seq, 1, "checkpoint advances state_seq");
});

test("T-04: a tampered snapshot byte makes resume refuse, naming BOTH hashes", () => {
  const c = contractOf();
  const cp = checkpointMissionState(stateOf(c));
  const tampered = { ...cp, snapshot: { ...cp.snapshot, current_stage: "EXECUTE" } };
  assert.throws(
    () => resumeMissionState({ checkpoint: tampered, liveContractHash: c.contract_hash }),
    (e) =>
      e.code === "state_hash_mismatch" &&
      typeof e.expected_hash === "string" &&
      typeof e.observed_hash === "string" &&
      e.expected_hash !== e.observed_hash,
  );
});

// ── T-05 · EC-1 / EC-2 / EC-3 each get a dedicated failing fixture ────────────
test("T-05/EC-1: resume against a different live contract refuses, never adopts", () => {
  const a = contractOf();
  const b = contractOf({ purpose: "A different mission entirely" });
  const cp = checkpointMissionState(stateOf(a));
  assert.throws(
    () => resumeMissionState({ checkpoint: cp, liveContractHash: b.contract_hash }),
    (e) => e.code === "contract_binding_mismatch",
  );
});

test("T-05/EC-2: a receipt-chain gap (seq n -> n+2) refuses", () => {
  const c = contractOf();
  const first = checkpointMissionState(stateOf(c));
  const skipped = checkpointMissionState({ ...first.snapshot, state_seq: first.snapshot.state_seq + 1 });
  assert.throws(
    () => resumeMissionState({ checkpoint: skipped, liveContractHash: c.contract_hash, previous: first }),
    (e) => e.code === "receipt_chain_gap",
  );
});

test("T-05/EC-3: two checkpoints at the same state_seq fail closed and surface BOTH hashes", () => {
  const c = contractOf();
  const one = checkpointMissionState(stateOf(c));
  const two = checkpointMissionState({ ...stateOf(c), worker_history: ["worker-b"] });
  assert.equal(one.snapshot.state_seq, two.snapshot.state_seq);
  assert.throws(
    () => resumeMissionState({ checkpoint: one, liveContractHash: c.contract_hash, concurrent: [one, two] }),
    (e) =>
      e.code === "concurrent_head_conflict" &&
      Array.isArray(e.heads) &&
      e.heads.length === 2 &&
      e.heads[0] !== e.heads[1],
  );
});

// ── T-06 · boundary ───────────────────────────────────────────────────────────
test("T-06: boundary is canonical and all-false", () => {
  const b = missionContractStateBoundary();
  assert.ok(isCanonicalBoundary(b));
  for (const [k, v] of Object.entries(b)) assert.equal(v, false, `${k} must be false`);
});

test("T-06: schemas are declared and stable", () => {
  assert.equal(MISSION_CONTRACT_SCHEMA, "bizra.dema.mission_contract.v0.2");
  assert.equal(MISSION_STATE_SCHEMA, "bizra.dema.mission_state.v0.1");
});

// ── ACCEPTANCE LAW · one normative surface, bound inside the hash ─────────────
test("the schema identifier moved rather than being reused for a new shape", () => {
  assert.notEqual(MISSION_CONTRACT_SCHEMA, MISSION_CONTRACT_SCHEMA_V0_1);
  // v0.1's exact-field rule means a v0.1 contract genuinely cannot validate here.
  const { acceptance_contract, ...v01 } = FIELDS;
  assert.throws(
    () => createMissionContract({ fields: v01, consent: GO }),
    (e) => e.code === "contract_shape_invalid",
  );
});

test("precedence is declared: exactly one surface decides the machine verdict", () => {
  assert.equal(ACCEPTANCE_PRECEDENCE.normative, "acceptance_contract");
  assert.equal(ACCEPTANCE_PRECEDENCE.advisory, "acceptance_criteria");
});

test("an inadmissible or vacuous acceptance law is refused at creation", () => {
  // Vacuous: shape is fine, but it constrains nothing — every output would pass.
  assert.throws(
    () => contractOf({ acceptance_contract: {} }),
    (e) => e.code === "acceptance_contract_invalid" && e.blocked_by.includes("contract_vacuous:no_effective_predicate"),
  );
  // Delegated, not reimplemented: the judge's own code surfaces verbatim.
  assert.throws(
    () => contractOf({ acceptance_contract: { required_output_keys: "patch" } }),
    (e) => e.blocked_by.includes("contract_malformed:required_output_keys"),
  );
});

// ── NC-A1 · predicates cannot be changed under a stable identity ──────────────
test("NC-A1: changing acceptance predicates changes contract identity; the old stays intact", () => {
  const base = contractOf();
  const widened = contractOf({ acceptance_contract: { required_output_keys: ["patch"] } });
  assert.notEqual(widened.contract_hash, base.contract_hash, "the law is inside the hash");
  // Positive control: an unrelated re-creation of the SAME law reproduces the hash,
  // so the inequality above is caused by the change and not by nondeterminism.
  assert.equal(contractOf().contract_hash, base.contract_hash);
  assert.deepEqual([...base.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
});

// ── NC-A7 · worker-channel scope widening ─────────────────────────────────────
test("NC-A7: a worker cannot widen scope or the acceptance law; the authoritative hash is unchanged", () => {
  const base = contractOf();
  for (const changes of [{ scope: "the entire repository" }, { acceptance_contract: { required_output_keys: ["patch"] } }]) {
    const r = proposeContractAmendment({ contract: base.contract, changes, channel: "worker", consent: GO });
    assert.equal(r.accepted, false);
    assert.equal(r.refusal, "contract_mutation_rejected");
    assert.equal(r.contract_hash, base.contract_hash);
  }
  assert.equal(base.contract.scope, "packages/core/src only");
});

// ── Negative control · the state hash must actually cover the state ───────────
test("NC: every state field is load-bearing in state_hash", () => {
  const c = contractOf();
  const base = checkpointMissionState(stateOf(c));
  for (const key of ["current_stage", "iteration_used", "state_seq"]) {
    const mutated = { ...base.snapshot, [key]: key === "current_stage" ? "VERIFY" : 99 };
    const rehashed = checkpointMissionState({ ...mutated, state_seq: mutated.state_seq - 1 });
    assert.notEqual(rehashed.state_hash, base.state_hash, `${key} must change state_hash`);
  }
});

// ── AGENT-LAUNCHPAD-NO-SYNTHETIC-CONSENT-1A · pure inspection vs creation ─────
test("1A: valid draft is inspectable without consent", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  assert.equal(inspected.schema, MISSION_CONTRACT_INSPECTION_SCHEMA);
  assert.equal(inspected.kind, MISSION_CONTRACT_INSPECTION_KIND);
  assert.equal(inspected.validation_only, true);
  assert.equal(inspected.human_consent_established, false);
  assert.equal(inspected.creation_authorized, false);
  assert.match(inspected.contract_hash, /^(?:sha256:)?[0-9a-f]{64}$/);
});

test("1A: inspection hash matches consent-gated creation hash", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  const created = createMissionContract({ fields: { ...FIELDS }, consent: GO });
  assert.equal(inspected.contract_hash, created.contract_hash);
  assert.equal(created.schema, MISSION_CONTRACT_SCHEMA);
  assert.equal(created.kind, MISSION_CONTRACT_CREATED_KIND);
});

test("1A: creation without exact GO still refuses", () => {
  assert.throws(
    () => createMissionContract({ fields: { ...FIELDS } }),
    (e) => e.code === "consent_phrase_mismatch",
  );
  assert.throws(
    () => createMissionContract({ fields: { ...FIELDS }, consent: "GO: inspect only" }),
    (e) => e.code === "consent_phrase_mismatch",
  );
});

test("1A: invalid semantics refuse identically on inspect and create", () => {
  assert.throws(
    () => inspectMissionContractFields({ fields: { ...FIELDS, acceptance_criteria: [] } }),
    (e) => e.code === "acceptance_criteria_empty",
  );
  assert.throws(
    () => createMissionContract({ fields: { ...FIELDS, acceptance_criteria: [] }, consent: GO }),
    (e) => e.code === "acceptance_criteria_empty",
  );
  assert.throws(
    () => inspectMissionContractFields({ fields: { ...FIELDS, acceptance_contract: {} } }),
    (e) => e.code === "acceptance_contract_invalid",
  );
});

test("1A: inspection never grants authority flags", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  assert.equal(inspected.validation_only, true);
  assert.equal(inspected.human_consent_established, false);
  assert.equal(inspected.creation_authorized, false);
  assert.equal(Object.hasOwn(inspected, "consent"), false);
});

// ── DEMA-PR490-F3-INSPECTION-CONTRACT-CLOSURE-1C · ownership + type ───────────
test("1C: inspection does not freeze or mutate caller-owned nests", () => {
  const required_output_keys = ["patch", "test_result"];
  const forbidden_substrings = ["TODO"];
  const acceptance_contract = { required_output_keys, forbidden_substrings };
  const acceptance_criteria = ["focused test green", "full gates green"];
  const prohibited_outcomes = ["push", "merge", "network"];
  const completion_conditions = ["all acceptance criteria met"];
  const fields = {
    ...FIELDS,
    acceptance_contract,
    acceptance_criteria,
    prohibited_outcomes,
    completion_conditions,
  };
  const before = JSON.stringify({
    acceptance_contract,
    acceptance_criteria,
    prohibited_outcomes,
    completion_conditions,
  });

  const inspected = inspectMissionContractFields({ fields });
  assert.equal(Object.isFrozen(acceptance_contract), false);
  assert.equal(Object.isFrozen(required_output_keys), false);
  assert.equal(Object.isFrozen(forbidden_substrings), false);
  assert.equal(Object.isFrozen(acceptance_criteria), false);
  assert.equal(Object.isFrozen(prohibited_outcomes), false);
  assert.equal(Object.isFrozen(completion_conditions), false);
  assert.equal(
    JSON.stringify({
      acceptance_contract,
      acceptance_criteria,
      prohibited_outcomes,
      completion_conditions,
    }),
    before,
  );

  acceptance_criteria.push("caller-still-owns-this");
  prohibited_outcomes.push("caller-mutation");
  required_output_keys.push("extra");
  assert.equal(acceptance_criteria.includes("caller-still-owns-this"), true);
  assert.equal(inspected.contract.acceptance_criteria.includes("caller-still-owns-this"), false);
  assert.equal(inspected.contract.prohibited_outcomes.includes("caller-mutation"), false);
  assert.equal(Object.isFrozen(inspected.contract), true);
  assert.equal(Object.isFrozen(inspected.contract.acceptance_contract), true);
  assert.throws(() => {
    inspected.contract.acceptance_criteria.push("x");
  }, TypeError);

  const again = inspectMissionContractFields({
    fields: {
      ...FIELDS,
      acceptance_contract: { required_output_keys: ["patch", "test_result"], forbidden_substrings: ["TODO"] },
      acceptance_criteria: ["focused test green", "full gates green"],
      prohibited_outcomes: ["push", "merge", "network"],
      completion_conditions: ["all acceptance criteria met"],
    },
  });
  assert.equal(again.contract_hash, inspected.contract_hash);
});

test("1C: create also detaches caller nests while preserving consent-first gate", () => {
  const acceptance_criteria = ["focused test green", "full gates green"];
  const fields = { ...FIELDS, acceptance_criteria };
  const created = createMissionContract({ fields, consent: GO });
  assert.equal(Object.isFrozen(acceptance_criteria), false);
  acceptance_criteria.push("after-create");
  assert.equal(created.contract.acceptance_criteria.includes("after-create"), false);
  assert.throws(
    () => createMissionContract({ fields, consent: "wrong" }),
    (e) => e.code === "consent_phrase_mismatch",
  );
});

test("1C: inspection envelope is not a created mission contract", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  const created = createMissionContract({ fields: { ...FIELDS }, consent: GO });
  assert.equal(isMissionContractInspection(inspected), true);
  assert.equal(isCreatedMissionContract(inspected), false);
  assert.equal(isCreatedMissionContract(created), true);
  assert.equal(isMissionContractInspection(created), false);
  assert.notEqual(inspected.schema, created.schema);
  assert.equal(inspected.contract_hash, created.contract_hash);
  // Schema+hash alone must not imply creation: strip kind/flags and require helpers.
  const confused = {
    schema: MISSION_CONTRACT_SCHEMA,
    contract: inspected.contract,
    contract_hash: inspected.contract_hash,
    validation_only: true,
    creation_authorized: false,
  };
  assert.equal(isCreatedMissionContract(confused), false);
});

// ── DEMA-PR490-F3-VALIDATED-SNAPSHOT-SEAL-1E · validate ≡ seal ───────────────
function statefulGetter(first, later) {
  let n = 0;
  const obj = {};
  Object.defineProperty(obj, "required_output_keys", {
    enumerable: true,
    configurable: true,
    get() {
      n += 1;
      return n === 1 ? first : later;
    },
  });
  Object.defineProperty(obj, "forbidden_substrings", {
    enumerable: true,
    configurable: true,
    get() {
      return ["TODO"];
    },
  });
  return obj;
}

function alternatingProxy(first, later) {
  let hits = 0;
  return new Proxy(
    { forbidden_substrings: ["TODO"] },
    {
      ownKeys() {
        return ["required_output_keys", "forbidden_substrings"];
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
      has(_, prop) {
        return prop === "required_output_keys" || prop === "forbidden_substrings";
      },
      get(t, prop) {
        if (prop === "forbidden_substrings") return t.forbidden_substrings;
        if (prop === "required_output_keys") {
          hits += 1;
          return hits === 1 ? first : later;
        }
        return undefined;
      },
    },
  );
}

function onceThen(first, later) {
  let n = 0;
  return {
    get() {
      n += 1;
      return n === 1 ? first : later;
    },
    enumerable: true,
    configurable: true,
  };
}

test("1E T1: acceptance getter valid→vacuous refuses or seals only admitted snapshot", () => {
  const ac = statefulGetter(["patch", "test_result"], []);
  const fields = { ...FIELDS, acceptance_contract: ac };
  // Validator admits first read; seal must use that snapshot — never empty later.
  const inspected = inspectMissionContractFields({ fields });
  assert.deepEqual([...inspected.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
  assert.notEqual(inspected.contract.acceptance_contract.required_output_keys.length, 0);
  const created = createMissionContract({ fields: { ...FIELDS, acceptance_contract: statefulGetter(["patch", "test_result"], []) }, consent: GO });
  assert.deepEqual([...created.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
});

test("1E T2: acceptance getter valid→weaker valid seals the validated stronger law", () => {
  const fields = { ...FIELDS, acceptance_contract: statefulGetter(["patch", "test_result"], ["patch"]) };
  const inspected = inspectMissionContractFields({ fields });
  assert.deepEqual([...inspected.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
  const created = createMissionContract({
    fields: { ...FIELDS, acceptance_contract: statefulGetter(["patch", "test_result"], ["patch"]) },
    consent: GO,
  });
  assert.deepEqual([...created.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
  assert.equal(inspected.contract_hash, createMissionContract({
    fields: {
      ...FIELDS,
      acceptance_contract: { required_output_keys: ["patch", "test_result"], forbidden_substrings: ["TODO"] },
    },
    consent: GO,
  }).contract_hash);
});

test("1E T3: alternating Proxy acceptance predicates seal first admitted law", () => {
  const inspected = inspectMissionContractFields({
    fields: { ...FIELDS, acceptance_contract: alternatingProxy(["patch", "test_result"], []) },
  });
  assert.deepEqual([...inspected.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
  const created = createMissionContract({
    fields: { ...FIELDS, acceptance_contract: alternatingProxy(["patch", "test_result"], []) },
    consent: GO,
  });
  assert.deepEqual([...created.contract.acceptance_contract.required_output_keys], ["patch", "test_result"]);
});

test("1E T4: changing acceptance_criteria across reads uses the first admitted list", () => {
  const fields = { ...FIELDS };
  Object.defineProperty(fields, "acceptance_criteria", onceThen(["focused test green", "full gates green"], ["tampered"]));
  const inspected = inspectMissionContractFields({ fields });
  assert.deepEqual([...inspected.contract.acceptance_criteria], ["focused test green", "full gates green"]);
});

test("1E T5: changing prohibited_outcomes across reads uses the first admitted list", () => {
  const fields = { ...FIELDS };
  Object.defineProperty(fields, "prohibited_outcomes", onceThen(["push", "merge", "network"], ["tampered"]));
  const inspected = inspectMissionContractFields({ fields });
  assert.deepEqual([...inspected.contract.prohibited_outcomes], ["push", "merge", "network"]);
});

test("1E T6: changing completion_conditions across reads uses the first admitted list", () => {
  const fields = { ...FIELDS };
  Object.defineProperty(fields, "completion_conditions", onceThen(["all acceptance criteria met"], ["tampered"]));
  const inspected = inspectMissionContractFields({ fields });
  assert.deepEqual([...inspected.contract.completion_conditions], ["all acceptance criteria met"]);
});

test("1E T7: unknown own __proto__ acceptance key is refused", () => {
  const ac = {
    required_output_keys: ["patch"],
    forbidden_substrings: ["TODO"],
  };
  Object.defineProperty(ac, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  assert.throws(
    () => inspectMissionContractFields({ fields: { ...FIELDS, acceptance_contract: ac } }),
    (e) => e.code === "acceptance_contract_invalid" && e.blocked_by.includes("contract_unknown_field:__proto__"),
  );
  assert.throws(
    () => createMissionContract({ fields: { ...FIELDS, acceptance_contract: ac }, consent: GO }),
    (e) => e.code === "acceptance_contract_invalid",
  );
});

test("1E T8: throwing getter / uninspectable field refuses", () => {
  const fields = { ...FIELDS };
  Object.defineProperty(fields, "purpose", {
    enumerable: true,
    get() {
      throw new Error("boom");
    },
  });
  assert.throws(
    () => inspectMissionContractFields({ fields }),
    (e) => e.code === "mission_fields_uninspectable",
  );
  assert.throws(
    () => createMissionContract({ fields, consent: GO }),
    (e) => e.code === "mission_fields_uninspectable",
  );
});

test("1E T9: honest canonical contract hash parity inspect≡create", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  const created = createMissionContract({ fields: { ...FIELDS }, consent: GO });
  assert.equal(inspected.contract_hash, created.contract_hash);
  assert.deepEqual(
    [...inspected.contract.acceptance_contract.required_output_keys],
    [...created.contract.acceptance_contract.required_output_keys],
  );
});

test("1E T10/T11: inspection leaves caller mutable; later mutation does not change sealed hash", () => {
  const required_output_keys = ["patch", "test_result"];
  const forbidden_substrings = ["TODO"];
  const acceptance_contract = { required_output_keys, forbidden_substrings };
  const acceptance_criteria = ["focused test green", "full gates green"];
  const fields = { ...FIELDS, acceptance_contract, acceptance_criteria };
  const inspected = inspectMissionContractFields({ fields });
  const sealedHash = inspected.contract_hash;
  assert.equal(Object.isFrozen(acceptance_contract), false);
  assert.equal(Object.isFrozen(acceptance_criteria), false);
  acceptance_criteria.push("after");
  required_output_keys.push("extra");
  assert.equal(inspected.contract_hash, sealedHash);
  assert.equal(inspected.contract.acceptance_criteria.includes("after"), false);
  assert.equal(inspected.contract.acceptance_contract.required_output_keys.includes("extra"), false);
});

test("1E T12: creation without exact GO refuses before field examination", () => {
  const fields = { ...FIELDS };
  Object.defineProperty(fields, "mission_id", {
    enumerable: true,
    get() {
      throw new Error("should-not-read-fields-before-consent");
    },
  });
  assert.throws(
    () => createMissionContract({ fields, consent: "wrong" }),
    (e) => e.code === "consent_phrase_mismatch",
  );
});

test("1E T14: inspection remains non-authoritative", () => {
  const inspected = inspectMissionContractFields({ fields: { ...FIELDS } });
  assert.equal(inspected.validation_only, true);
  assert.equal(inspected.human_consent_established, false);
  assert.equal(inspected.creation_authorized, false);
  assert.equal(isCreatedMissionContract(inspected), false);
  // Structural kind forge is not consent evidence.
  assert.equal(
    isCreatedMissionContract({
      schema: MISSION_CONTRACT_SCHEMA,
      kind: MISSION_CONTRACT_CREATED_KIND,
      contract: inspected.contract,
      contract_hash: inspected.contract_hash,
    }),
    true,
    "type guard alone is not human consent — documented limitation",
  );
});
