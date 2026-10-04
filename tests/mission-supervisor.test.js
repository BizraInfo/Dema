// MISSION-SUPERVISOR-0A — red-first tests for TASK-026 spec phase 02.
//
// Anchors T-01..T-07 from
// /data/bizra/research/MISSION_RUNTIME_0A_SPEC_v0_1/phase_02_supervisor_stage_machine.md
// plus the mission order's NC-A2..NC-A6. NC-A1 and NC-A7 live with the contract
// kernel, because they are properties of the contract, not the conductor.
//
// The reducer PROPOSES. It never performs: `EXECUTE` in-kernel means "an execution
// result event was injected", never running anything.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MISSION_SUPERVISOR_SCHEMA,
  STAGES,
  TERMINAL_STAGES,
  TRANSITIONS,
  EVENT_KINDS,
  genesisSupervisorState,
  step,
  replay,
  decisionStateHash,
  missionSupervisorBoundary,
} from "../packages/core/src/mission-supervisor.js";
import {
  MISSION_CONTRACT_GO_PHRASE,
  createMissionContract,
} from "../packages/core/src/mission-contract-state.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const GO = MISSION_CONTRACT_GO_PHRASE;

const FIELDS = {
  mission_id: "MISSION-SUP-001",
  purpose: "Conduct one bounded repair",
  scope: "packages/core/src only",
  acceptance_contract: { required_output_keys: ["patch"], forbidden_substrings: ["TODO"] },
  acceptance_criteria: ["patch applied", "tests green"],
  prohibited_outcomes: ["push"],
  authority_ceiling: "local_reversible",
  iteration_budget: 2,
  completion_conditions: ["acceptance met"],
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-10T00:00:00.000Z",
};

const contractOf = (over = {}) => createMissionContract({ fields: { ...FIELDS, ...over }, consent: GO });
const genesisOf = (c) => genesisSupervisorState({ contract: c.contract, contract_hash: c.contract_hash });

let seq = 0;
const ev = (kind, stage, extra = {}) => ({ kind, stage, hash: `sha256:e${++seq}`, ...extra });

const GOOD_OUTPUT = { patch: "diff --git a b", test_result: "pass" };
const BAD_OUTPUT = { patch: "TODO later" };

/// One accepted walk: DISCOVER → … → DONE. Returns every step result.
function walk(c, events) {
  let state = genesisOf(c);
  const out = [];
  for (const e of events) {
    const r = step(state, e, { contract: c.contract });
    out.push(r);
    state = r.state;
  }
  return { state, results: out };
}

const toExecute = () => [
  ev(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER"),
  ev(EVENT_KINDS.CONTRACT_FROZEN, "CONTRACT"),
  ev(EVENT_KINDS.PLAN_PROPOSED, "PLAN"),
  ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible", consent_ref: "sha256:consent-1" }),
];

const happyPath = (output = GOOD_OUTPUT, worker = "worker-a") => [
  ...toExecute(),
  ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output, worker_id: worker }),
  ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output, worker_id: worker }),
  ev(EVENT_KINDS.REVIEW_ACCEPTED, "REVIEW"),
  ev(EVENT_KINDS.RECEIPT_SEALED, "RECEIPT"),
  ev(EVENT_KINDS.DECIDE_DONE, "DECIDE"),
];

// ── T-01 · transition-table exhaustion, generated not hand-listed ─────────────
test("T-01: every (stage, event_kind) pair absent from the table is rejected", () => {
  const c = contractOf();
  const allKinds = Object.values(EVENT_KINDS);
  let legal = 0;
  let rejected = 0;
  for (const stage of STAGES) {
    for (const kind of allKinds) {
      const inTable = Boolean(TRANSITIONS[stage]?.[kind]);
      const state = { ...genesisOf(c), stage };
      const r = step(state, ev(kind, stage, { effect_class: "reversible", consent_ref: "sha256:c", output: GOOD_OUTPUT }), {
        contract: c.contract,
      });
      if (inTable) {
        legal += 1;
        assert.equal(r.rejected, null, `${stage}/${kind} is in the table and must be accepted`);
      } else {
        rejected += 1;
        assert.equal(r.rejected, "illegal_transition", `${stage}/${kind} is absent and must fail closed`);
        assert.equal(r.state.stage, stage, "a rejected event must not advance the stage");
      }
    }
  }
  // Positive control: the sweep must contain BOTH outcomes, or it proves nothing.
  assert.ok(legal > 0, "the sweep found no legal pairs — the table or the sweep is broken");
  assert.ok(rejected > 0, "the sweep found no illegal pairs");
});

// ── T-02 / NC-A6 · budget is bounded, terminal, and receipted ────────────────
test("T-02/NC-A6: REVIEW→PLAN retries can never exceed iteration_budget", () => {
  const c = contractOf({ iteration_budget: 2 });
  let state = genesisOf(c);
  const seen = [];
  // Deterministic loop: drive retry after retry and watch the budget bite.
  for (let i = 0; i < 12 && !TERMINAL_STAGES.includes(state.stage); i++) {
    const events =
      state.stage === "PLAN"
        ? [ev(EVENT_KINDS.PLAN_PROPOSED, "PLAN")]
        : state.stage === "FATE"
          ? [ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible", consent_ref: "sha256:c" })]
          : state.stage === "EXECUTE"
            ? [ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: BAD_OUTPUT, worker_id: "w" })]
            : state.stage === "VERIFY"
              ? [ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output: BAD_OUTPUT, worker_id: "w" })]
              : state.stage === "REVIEW"
                ? [ev(EVENT_KINDS.REVIEW_RETRY, "REVIEW")]
                : [ev(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER"), ev(EVENT_KINDS.CONTRACT_FROZEN, "CONTRACT")];
    for (const e of events) {
      const r = step(state, e, { contract: c.contract });
      state = r.state;
      seen.push(...r.receipts);
      if (TERMINAL_STAGES.includes(state.stage)) break;
    }
  }
  assert.equal(state.stage, "BUDGET_EXHAUSTED");
  assert.ok(state.iteration_used <= c.contract.iteration_budget, "budget overrun");
  assert.ok(
    seen.some((r) => r.to_stage === "BUDGET_EXHAUSTED"),
    "exhaustion must be receipted, never a silent stop",
  );
});

test("T-02 positive control: a budget of 5 does NOT exhaust on the first retry", () => {
  const c = contractOf({ iteration_budget: 5 });
  let state = genesisOf(c);
  for (const e of toExecute()) state = step(state, e, { contract: c.contract }).state;
  state = step(state, ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: BAD_OUTPUT, worker_id: "w" }), { contract: c.contract }).state;
  state = step(state, ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output: BAD_OUTPUT, worker_id: "w" }), { contract: c.contract }).state;
  const r = step(state, ev(EVENT_KINDS.REVIEW_RETRY, "REVIEW"), { contract: c.contract });
  assert.equal(r.state.stage, "PLAN");
  assert.equal(r.state.iteration_used, 1);
});

// ── T-03 / NC-A3 · worker identity cannot reach the verdict ──────────────────
test("T-03/NC-A3: two walks differing only in worker_id produce identical verdicts and decision state", () => {
  const c = contractOf();
  seq = 0;
  const a = walk(c, happyPath(GOOD_OUTPUT, "worker-a"));
  seq = 0;
  const b = walk(c, happyPath(GOOD_OUTPUT, "worker-zzz-different"));
  assert.equal(a.state.stage, "DONE");
  assert.deepEqual(a.state.verdicts, b.state.verdicts);
  assert.equal(decisionStateHash(a.state), decisionStateHash(b.state), "worker identity must not change decision state");
  // Positive control: a genuinely different OUTPUT must change the verdict, or the
  // equality above would be satisfied by a judge that ignores everything.
  seq = 0;
  const bad = walk(c, happyPath(BAD_OUTPUT, "worker-a"));
  assert.notDeepEqual(bad.state.verdicts, a.state.verdicts);
});

test("T-03: worker_id is recorded as provenance but is not part of decision identity", () => {
  const c = contractOf();
  seq = 0;
  const a = walk(c, happyPath(GOOD_OUTPUT, "worker-a"));
  seq = 0;
  const b = walk(c, happyPath(GOOD_OUTPUT, "worker-b"));
  assert.notDeepEqual(a.state.worker_history, b.state.worker_history, "provenance should differ");
  assert.equal(decisionStateHash(a.state), decisionStateHash(b.state));
});

// ── NC-A2 · out-of-band acceptance predicates ────────────────────────────────
test("NC-A2: an event carrying its own acceptance predicates is REFUSED, never silently used", () => {
  const c = contractOf();
  let state = genesisOf(c);
  for (const e of toExecute()) state = step(state, e, { contract: c.contract }).state;
  state = step(state, ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: BAD_OUTPUT, worker_id: "w" }), { contract: c.contract }).state;
  const r = step(
    state,
    ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", {
      output: BAD_OUTPUT,
      worker_id: "w",
      acceptance_contract: { required_output_keys: [] },
    }),
    { contract: c.contract },
  );
  assert.equal(r.rejected, "out_of_band_acceptance_law");
  assert.equal(r.state.stage, "VERIFY", "a refused event must not advance the stage");
  // Positive control: the identical event WITHOUT the smuggled law is accepted.
  const ok = step(state, ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output: BAD_OUTPUT, worker_id: "w" }), {
    contract: c.contract,
  });
  assert.equal(ok.rejected, null);
});

// ── NC-A4 / NC-A5 · skipping and going backwards ─────────────────────────────
test("NC-A4: skipping a mandatory stage fails closed", () => {
  const c = contractOf();
  const state = genesisOf(c); // stage DISCOVER
  const r = step(state, ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: GOOD_OUTPUT }), { contract: c.contract });
  assert.equal(r.rejected, "out_of_stage_event");
  assert.equal(r.state.stage, "DISCOVER");
});

test("NC-A5: an unordered/backwards transition fails closed", () => {
  const c = contractOf();
  let state = genesisOf(c);
  for (const e of toExecute()) state = step(state, e, { contract: c.contract }).state;
  assert.equal(state.stage, "EXECUTE");
  const r = step(state, ev(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER"), { contract: c.contract });
  assert.equal(r.rejected, "out_of_stage_event");
  assert.equal(r.state.stage, "EXECUTE");
});

// ── FR-3 · FATE holds instead of skipping ────────────────────────────────────
test("FR-3: an effect without a bound consent reference HALTS with consent_hold", () => {
  const c = contractOf();
  let state = genesisOf(c);
  for (const e of toExecute().slice(0, 3)) state = step(state, e, { contract: c.contract }).state;
  assert.equal(state.stage, "FATE");
  const r = step(state, ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible" }), { contract: c.contract });
  assert.equal(r.state.stage, "HALTED");
  assert.equal(r.state.hold_reason, "consent_hold");
  assert.equal(r.state.held_stage, "FATE");
});

test("FR-3: an unknown effect class also holds, and a known one proceeds", () => {
  const c = contractOf();
  let state = genesisOf(c);
  for (const e of toExecute().slice(0, 3)) state = step(state, e, { contract: c.contract }).state;
  const bad = step(state, ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "whatever", consent_ref: "sha256:c" }), {
    contract: c.contract,
  });
  assert.equal(bad.state.stage, "HALTED");
  const good = step(state, ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "irreversible", consent_ref: "sha256:c" }), {
    contract: c.contract,
  });
  assert.equal(good.state.stage, "EXECUTE");
});

// ── EC-4 · HALTED accepts exactly one input ──────────────────────────────────
test("EC-4: HALTED accepts only operator resume-with-consent, and returns to the held stage", () => {
  const c = contractOf();
  let state = genesisOf(c);
  for (const e of toExecute().slice(0, 3)) state = step(state, e, { contract: c.contract }).state;
  state = step(state, ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible" }), { contract: c.contract }).state;
  assert.equal(state.stage, "HALTED");
  const wrong = step(state, ev(EVENT_KINDS.PLAN_PROPOSED, "HALTED"), { contract: c.contract });
  assert.equal(wrong.rejected, "illegal_transition");
  const resumed = step(state, ev(EVENT_KINDS.OPERATOR_RESUME, "HALTED", { consent_ref: "sha256:operator" }), {
    contract: c.contract,
  });
  assert.equal(resumed.state.stage, "FATE");
  // Resume without consent is not a resume.
  const noConsent = step(state, ev(EVENT_KINDS.OPERATOR_RESUME, "HALTED"), { contract: c.contract });
  assert.equal(noConsent.rejected, "consent_absent");
});

// ── EC-1 / EC-2 / EC-5 ───────────────────────────────────────────────────────
test("EC-2: a duplicate event_hash is idempotently rejected and receipted once", () => {
  const c = contractOf();
  const state = genesisOf(c);
  const e = ev(EVENT_KINDS.DISCOVERY_RECORDED, "DISCOVER");
  const first = step(state, e, { contract: c.contract });
  const dup = step(first.state, e, { contract: c.contract });
  assert.equal(dup.rejected, "duplicate_event");
  assert.equal(dup.receipts.length, 1, "the duplicate rejection is receipted");
  const dup2 = step(dup.state, e, { contract: c.contract });
  assert.equal(dup2.receipts.length, 0, "a repeat of the same duplicate is not receipted again");
});

test("EC-5: a terminal state accepts no events", () => {
  const c = contractOf();
  seq = 0;
  const { state } = walk(c, happyPath());
  assert.equal(state.stage, "DONE");
  assert.throws(
    () => step(state, ev(EVENT_KINDS.PLAN_PROPOSED, "DONE"), { contract: c.contract }),
    (e) => e.code === "terminal_state_event",
  );
});

// ── T-04 · receipt per transition, chained ───────────────────────────────────
test("T-04: every accepted transition emits a chained receipt with an all-false boundary", () => {
  const c = contractOf();
  seq = 0;
  const { state, results } = walk(c, happyPath());
  const receipts = results.flatMap((r) => r.receipts);
  // The invariant, not a pinned count: exactly one receipt per accepted step.
  // A hard number here would go stale the moment a stage is added.
  assert.ok(results.every((r) => r.receipts.length === 1), "every accepted step emits exactly one receipt");
  assert.equal(receipts.length, results.length);
  let prev = null;
  for (const r of receipts) {
    assert.equal(r.mission_id, c.contract.mission_id);
    assert.equal(r.prev_receipt, prev, "chain must be intact");
    assert.ok(isCanonicalBoundary(r.boundary));
    prev = r.receipt_hash;
  }
  assert.equal(state.receipt_head, prev, "state head is the last receipt");
});

// ── T-05 · replay ────────────────────────────────────────────────────────────
test("T-05: replay deep-equals the incrementally stepped state for DONE, HALTED and BUDGET_EXHAUSTED", () => {
  const c = contractOf({ iteration_budget: 1 });
  const fixtures = [
    happyPath(),
    [...toExecute().slice(0, 3), ev(EVENT_KINDS.CONSENT_BOUND, "FATE", { effect_class: "reversible" })],
    [
      ...toExecute(),
      ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: BAD_OUTPUT, worker_id: "w" }),
      ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output: BAD_OUTPUT, worker_id: "w" }),
      ev(EVENT_KINDS.REVIEW_RETRY, "REVIEW"),
    ],
  ];
  const expected = ["DONE", "HALTED", "BUDGET_EXHAUSTED"];
  fixtures.forEach((events, i) => {
    const live = walk(c, events).state;
    const replayed = replay({ contract: c.contract, contract_hash: c.contract_hash, events });
    assert.deepEqual(replayed, live, `fixture ${i} replay diverged`);
    assert.equal(live.stage, expected[i], `fixture ${i} expected ${expected[i]}`);
  });
});

test("T-05 negative control: dropping one event changes the replayed state", () => {
  const c = contractOf();
  seq = 0;
  const events = happyPath();
  const full = replay({ contract: c.contract, contract_hash: c.contract_hash, events });
  const short = replay({ contract: c.contract, contract_hash: c.contract_hash, events: events.slice(0, -1) });
  assert.notEqual(decisionStateHash(full), decisionStateHash(short));
});

// ── T-06 / EC-6 · failure never widens authority ─────────────────────────────
test("T-06/EC-6: failure verdicts never change authority_ceiling or scope", () => {
  const c = contractOf({ iteration_budget: 3 });
  let state = genesisOf(c);
  const seenAuthority = new Set();
  for (const e of [
    ...toExecute(),
    ev(EVENT_KINDS.EXECUTION_RESULT, "EXECUTE", { output: BAD_OUTPUT, worker_id: "w" }),
    ev(EVENT_KINDS.VERDICT_REQUESTED, "VERIFY", { output: BAD_OUTPUT, worker_id: "w" }),
    ev(EVENT_KINDS.REVIEW_RETRY, "REVIEW"),
  ]) {
    state = step(state, e, { contract: c.contract }).state;
    seenAuthority.add(`${state.authority_ceiling}|${state.scope}`);
  }
  assert.deepEqual([...seenAuthority], ["local_reversible|packages/core/src only"]);
  assert.equal(state.authority_delta, 0);
});

// ── §H · decision-bearing state is load-bearing ──────────────────────────────
test("H: changing any decision-bearing field changes the derived state identity", () => {
  const c = contractOf();
  seq = 0;
  const { state } = walk(c, happyPath());
  const base = decisionStateHash(state);
  for (const key of ["stage", "iteration_used", "contract_hash", "receipt_head", "state_seq"]) {
    const mutated = { ...state, [key]: typeof state[key] === "number" ? state[key] + 1 : `${state[key]}-x` };
    assert.notEqual(decisionStateHash(mutated), base, `${key} must be load-bearing`);
  }
});

// ── T-07 · boundary ──────────────────────────────────────────────────────────
test("T-07: the supervisor boundary is canonical and all-false", () => {
  const b = missionSupervisorBoundary();
  assert.ok(isCanonicalBoundary(b));
  assert.equal(b.runtime_execution_performed, false);
  assert.equal(b.model_invocation_performed, false);
  assert.equal(MISSION_SUPERVISOR_SCHEMA, "bizra.dema.mission_supervisor.v0.1");
});
