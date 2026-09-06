import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const KERNEL = fileURLToPath(new URL("../runtime/mission_lifecycle/kernel.py", import.meta.url));

const HARNESS = String.raw`
import ast, contextlib, copy, datetime, io, json, sys, types

kernel_path = ${JSON.stringify(KERNEL)}
source = open(kernel_path, encoding="utf-8").read()
tree = ast.parse(source)
selected = {node.name: node for node in tree.body
            if isinstance(node, ast.FunctionDef)
            and node.name in {"_validate_postcondition_observation",
                              "_completion_verification", "cmd_consent", "cmd_run"}}
assert len(selected) == 4
compiled = compile(ast.Module(body=[selected[name] for name in (
    "_validate_postcondition_observation", "_completion_verification",
    "cmd_consent", "cmd_run")], type_ignores=[]), kernel_path, "exec")

capsule = {}
handler_passed = True
handler_calls = []
transitions = []
saved = []

def load_capsule(_):
    return capsule

def load_agent_contract(_):
    return {"capability": {"agent": {"name": "fixture"}}}

def save_capsule(value):
    saved.append(copy.deepcopy(value))

def now_iso():
    return "2026-09-06T00:00:00+00:00"

def transition_state(cap, _contract, state, trigger, _consent=None):
    transitions.append({"state": state, "trigger": trigger})
    cap["state"]["current"] = state
    return {}

def mint_act_handler_receipt(cap, _contract, planned_act, _result):
    cap["evidence"]["receipts_minted"].append(planned_act["act_id"])
    return {}

def fixture_handler(planned_act, _capsule, _contract):
    handler_calls.append(planned_act["act_id"])
    return {
        "passed": handler_passed,
        "effect_id": "EFFECT-1",
        "producer_id": "producer-1",
        "outputs": [],
        "evidence": [],
        "finding": None if handler_passed else "fixture_effect_failed",
    }

handlers = types.ModuleType("handlers")
handlers.get_handler = lambda name: fixture_handler if name == "fixture" else (_ for _ in ()).throw(KeyError(name))
sys.modules["handlers"] = handlers

namespace = {
    "STATE_PREVIEW": "preview", "STATE_READY": "ready",
    "STATE_EXECUTING": "executing", "STATE_VALIDATED": "validated",
    "STATE_RECEIPTED": "receipted", "STATE_ARCHIVED": "archived",
    "STATE_SUSPENDED": "suspended", "load_capsule": load_capsule,
    "load_agent_contract": load_agent_contract, "save_capsule": save_capsule,
    "now_iso": now_iso, "transition_state": transition_state,
    "mint_act_handler_receipt": mint_act_handler_receipt, "sys": sys,
    "datetime": datetime.datetime,
}
exec(compiled, namespace)

def valid_observation(**overrides):
    value = {
        "mission_id": "M-1",
        "effect_id": "EFFECT-1",
        "act_id": "ACT-1",
        "expected_postcondition": "predicate",
        "observed_state": True,
        "observer_id": "observer-1",
        "observer_class": "independent_postcondition_observer",
        "observed_at": "2026-09-06T00:00:00+00:00",
        "freshness": "FRESH",
        "target_binding": {"mission_id": "M-1", "effect_id": "EFFECT-1", "act_id": "ACT-1"},
        "evidence_ref": "evidence://M-1/predicate",
        "verdict": "PASS",
    }
    value.update(overrides)
    return value

def new_capsule(observation_marker="valid", required_predicates=None):
    observation = None if observation_marker is None else observation_marker
    observations = {} if observation is None else {"predicate": observation}
    required = ["predicate"] if required_predicates is None else required_predicates
    return {
        "mission_id": "M-1",
        "state": {"current": "preview"},
        "agent_binding": {"agent_name": "fixture"},
        "authority": {"acts_planned": [{
            "act_id": "ACT-1", "tier": "ALWAYS", "handler": "fixture",
            "effect_id": "EFFECT-1", "producer_id": "producer-1",
        }]},
        "dod": {"predicates_required": required, "predicates_passed": []},
        "observations": observations,
        "outcome": {},
        "evidence": {"outputs_written": [], "receipts_minted": [],
                     "blake3_chain_segment": {"count": 0}},
    }

def run_case(observation_marker="valid", passed=True, repeat=False, required_predicates=None):
    global capsule, handler_passed, handler_calls, transitions, saved
    capsule = new_capsule(observation_marker, required_predicates)
    handler_passed = passed
    handler_calls = []
    transitions = []
    saved = []
    namespace["capsule"] = capsule
    exits = []
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        try:
            namespace["cmd_run"]("M-1")
        except SystemExit as exc:
            exits.append(exc.code)
        if repeat:
            try:
                namespace["cmd_run"]("M-1")
            except SystemExit as exc:
                exits.append(exc.code)
    return {
        "state": capsule["state"]["current"],
        "passed": capsule["dod"]["predicates_passed"],
        "result": capsule["outcome"].get("result"),
        "verification": capsule["outcome"].get("completion_verification"),
        "handler_calls": len(handler_calls),
        "transitions": transitions,
        "saved": len(saved),
        "exits": exits,
    }

def consent_case():
    global capsule, saved
    saved = []
    capsule = {
        "mission_id": "M-2", "agent_binding": {"agent_name": "fixture"},
        "authority": {"acts_planned": [
            {"act_id": "ACT-A", "tier": "MUMO_GO_REQUIRED", "consent_phrase_template": "GO: authorize ACT-A"},
            {"act_id": "ACT-B", "tier": "MUMO_GO_REQUIRED", "consent_phrase_template": "GO: authorize ACT-B"},
        ]},
    }
    namespace["capsule"] = capsule
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        namespace["cmd_consent"]("M-2", "GO: authorize ACT-A")
    return {act["act_id"]: act.get("consent_received", False)
            for act in capsule["authority"]["acts_planned"]}

cases = {
    "no_observation": run_case(None),
    "false_observation": run_case(valid_observation(observed_state=False)),
    "stale_observation": run_case(valid_observation(freshness="STALE")),
    "wrong_mission": run_case(valid_observation(mission_id="M-2")),
    "wrong_effect": run_case(valid_observation(effect_id="EFFECT-2")),
    "wrong_act": run_case(valid_observation(act_id="ACT-2")),
    "malformed_observation": run_case({"mission_id": "M-1"}),
    "observer_is_producer": run_case(valid_observation(observer_id="producer-1")),
    "malformed_timestamp": run_case(valid_observation(observed_at="not-a-timestamp")),
    "missing_required_postcondition": run_case(valid_observation(), required_predicates=[]),
    "effect_failure": run_case(valid_observation(), passed=False),
    "valid_observation": run_case(valid_observation()),
    "repeated_completion": run_case(valid_observation(), repeat=True),
}
print(json.dumps({"cases": cases, "b2_exact_consent": consent_case()}, sort_keys=True))
`;

function observeKernel() {
  const run = spawnSync("python3", ["-B", "-c", HARNESS], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(run.status, 0, `kernel fixture harness failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

test("B3: missing, false, stale, wrong-bound, and malformed observations refuse completion", () => {
  const { cases } = observeKernel();
  for (const name of [
    "no_observation", "false_observation", "stale_observation",
    "wrong_mission", "wrong_effect", "wrong_act", "malformed_observation",
    "observer_is_producer", "malformed_timestamp",
    "missing_required_postcondition",
  ]) {
    assert.equal(cases[name].state, "suspended", name);
    assert.deepEqual(cases[name].passed, [], name);
    assert.equal(cases[name].result, null, name);
    assert.equal(cases[name].handler_calls, 1, name);
    assert.deepEqual(cases[name].exits, [1], name);
  }
});

test("B3: an effect failure cannot complete even with a passing observation", () => {
  const { cases } = observeKernel();
  assert.equal(cases.effect_failure.state, "suspended");
  assert.deepEqual(cases.effect_failure.passed, []);
  assert.equal(cases.effect_failure.result, null);
  assert.deepEqual(cases.effect_failure.exits, [1]);
});

test("B3: fresh target-bound observation plus verification permits one completion", () => {
  const { cases } = observeKernel();
  const result = cases.valid_observation;
  assert.equal(result.state, "archived");
  assert.deepEqual(result.passed, ["predicate"]);
  assert.equal(result.result, "success");
  assert.equal(result.verification.effect_executed, true);
  assert.equal(result.verification.required_postcondition_observed, true);
  assert.equal(result.verification.observation_fresh, true);
  assert.equal(result.verification.observation_target_bound, true);
  assert.equal(result.verification.verification_passed, true);
  assert.equal(result.verification.completion_receipt_eligible, true);
  assert.equal(result.verification.eligible, true);
  assert.equal(result.handler_calls, 1);
  assert.deepEqual(result.exits, []);
});

test("B3: repeated completion is refused without a second effect invocation", () => {
  const { cases } = observeKernel();
  const result = cases.repeated_completion;
  assert.equal(result.state, "archived");
  assert.equal(result.handler_calls, 1);
  assert.deepEqual(result.exits, [1]);
  assert.equal(result.transitions.filter((item) => item.state === "archived").length, 1);
});

test("B2 regression: exact consent remains bound to one named act", () => {
  assert.deepEqual(observeKernel().b2_exact_consent, { "ACT-A": true, "ACT-B": false });
});
