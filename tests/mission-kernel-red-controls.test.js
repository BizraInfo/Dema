import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const KERNEL = "/home/bizra-operating-system/.dema/kernel/mission_lifecycle/kernel.py";
const KERNEL_SHA256 = "84bfcea7f252924d3be41b94756b88adf5cbdd40c50f265b009cf52f81dd6fdb";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const HARNESS = String.raw`
import ast, contextlib, hashlib, io, json, pathlib

kernel_path = pathlib.Path(${JSON.stringify(KERNEL)})
source = kernel_path.read_text()
assert hashlib.sha256(source.encode()).hexdigest() == ${JSON.stringify(KERNEL_SHA256)}, "IDENTITY_MISMATCH: kernel.py drifted"
tree = ast.parse(source)
functions = {node.name: node for node in tree.body if isinstance(node, ast.FunctionDef)}

namespace = {
    "STATE_PREVIEW": "preview", "STATE_READY": "ready", "STATE_EXECUTING": "executing",
    "STATE_VALIDATED": "validated", "STATE_RECEIPTED": "receipted", "STATE_ARCHIVED": "archived",
    "load_capsule": lambda mission_id: capsule,
    "load_agent_contract": lambda _: {"model_adapter": "fixture"}, "save_capsule": lambda _: None,
    "now_iso": lambda: "2026-09-06T00:00:00Z",
    "transition_state": lambda cap, contract, state, reason: cap["state"].__setitem__("current", state),
}
for name in ("cmd_consent", "cmd_run"):
    module = ast.Module(body=[functions[name]], type_ignores=[])
    exec(compile(module, str(kernel_path), "exec"), namespace)

def consent(phrase, acts):
    global capsule
    capsule = {
        "mission_id": "gate6-b2", "state": {"current": "preview"},
        "agent_binding": {"agent_name": "fixture"}, "authority": {"acts_planned": acts},
    }
    with contextlib.redirect_stdout(io.StringIO()):
        namespace["cmd_consent"]("gate6-b2", phrase)
    return {act["act_id"]: act.get("consent_received", False) for act in capsule["authority"]["acts_planned"]}

def run_with(observation):
    global capsule
    capsule = {
        "mission_id": "gate6-b3", "state": {"current": "preview"},
        "agent_binding": {"agent_name": "fixture"}, "authority": {"acts_planned": []},
        "dod": {"predicates_required": ["predicate"], "predicates_passed": []},
        "outcome": {}, "observations": {"predicate": observation},
        "evidence": {"outputs_written": [], "receipts_minted": [], "blake3_chain_segment": {"count": 0}},
    }
    with contextlib.redirect_stdout(io.StringIO()):
        namespace["cmd_run"]("gate6-b3")
    return {"state": capsule["state"]["current"], "passed": capsule["dod"]["predicates_passed"]}

act_a = {"act_id": "ACT-A", "tier": "MUMO_GO_REQUIRED", "consent_phrase_template": "GO: authorize ACT-A"}
act_b = {"act_id": "ACT-B", "tier": "MUMO_GO_REQUIRED", "consent_phrase_template": "GO: authorize ACT-B"}
print(json.dumps({
    "b2": {
        "single_exact": consent("GO: authorize ACT-A", [dict(act_a)]),
        "exact_a_two": consent("GO: authorize ACT-A", [dict(act_a), dict(act_b)]),
        "unrelated": consent("GO: unrelated inventory", [dict(act_a), dict(act_b)]),
        "wrong_act": consent("GO: authorize ACT-C", [dict(act_a), dict(act_b)]),
    },
    "b3": {
        "observed_true": run_with(True),
        "observed_false": run_with(False),
        "unobserved": run_with(None),
    },
}, sort_keys=True))
`;

function observeVulnerableKernel() {
  assert.equal(sha256(readFileSync(KERNEL)), KERNEL_SHA256, "IDENTITY_MISMATCH: kernel.py drifted");
  const run = spawnSync("python3", ["-B", "-c", HARNESS], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(run.status, 0, `kernel fixture harness failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

test("B2 control: exact consent approves its sole named act", () => {
  const { b2 } = observeVulnerableKernel();
  assert.deepEqual(b2.single_exact, { "ACT-A": true });
});

test("B2: unrelated or differently-scoped GO cannot approve another pending act", () => {
  const { b2 } = observeVulnerableKernel();
  assert.deepEqual({
    exact_a_two: b2.exact_a_two,
    unrelated: b2.unrelated,
    wrong_act: b2.wrong_act,
  }, {
    exact_a_two: { "ACT-A": true, "ACT-B": false },
    unrelated: { "ACT-A": false, "ACT-B": false },
    wrong_act: { "ACT-A": false, "ACT-B": false },
  }, "B2: generic GO consumed authority for acts it did not name");
});

test("B3 control: an observed true predicate completes", () => {
  const { b3 } = observeVulnerableKernel();
  assert.deepEqual(b3.observed_true, { state: "archived", passed: ["predicate"] });
});

test("B3: an unobserved or false required predicate cannot complete", () => {
  const { b3 } = observeVulnerableKernel();
  assert.deepEqual({
    observed_false: b3.observed_false,
    unobserved: b3.unobserved,
  }, {
    observed_false: { state: "preview", passed: [] },
    unobserved: { state: "preview", passed: [] },
  }, "B3: cmd_run promoted unobserved or false predicates to passed completion");
});
