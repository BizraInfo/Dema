import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const KERNEL = fileURLToPath(new URL("../runtime/mission_lifecycle/kernel.py", import.meta.url));

const HARNESS = String.raw`
import ast, contextlib, io, json, pathlib, sys

kernel_path = pathlib.Path(${JSON.stringify(KERNEL)})
functions = {node.name: node for node in ast.parse(kernel_path.read_text()).body if isinstance(node, ast.FunctionDef)}
saved = []
capsule = {}
namespace = {
    "load_capsule": lambda _: capsule,
    "load_agent_contract": lambda _: {"model_adapter": "fixture"},
    "now_iso": lambda: "2026-09-06T00:00:00Z",
    "save_capsule": lambda capsule: saved.append(json.loads(json.dumps(capsule, sort_keys=True))),
    "sys": sys,
}
exec(compile(ast.Module(body=[functions["cmd_consent"]], type_ignores=[]), str(kernel_path), "exec"), namespace)

def act(act_id, phrase, **extra):
    return {"act_id": act_id, "tier": "MUMO_GO_REQUIRED", "consent_phrase_template": phrase, **extra}

def attempt(phrase, acts, requested_mission="MISSION-A", capsule_mission="MISSION-A"):
    global capsule, saved
    saved = []
    capsule = {
        "mission_id": capsule_mission,
        "agent_binding": {"agent_name": "fixture"},
        "authority": {"acts_planned": acts},
    }
    namespace["capsule"] = capsule
    before = json.loads(json.dumps(capsule, sort_keys=True))
    error = None
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        try:
            namespace["cmd_consent"](requested_mission, phrase)
        except Exception as exc:
            error = type(exc).__name__ + ": " + str(exc)
    return {
        "approved": {item["act_id"]: item.get("consent_received", False) for item in capsule["authority"]["acts_planned"]},
        "unchanged": capsule == before,
        "save_count": len(saved),
        "error": error,
    }

exact_a = "GO: authorize ACT-A"
exact_b = "GO: authorize ACT-B"
print(json.dumps({
    "exact": attempt(exact_a, [act("ACT-A", exact_a), act("ACT-B", exact_b)]),
    "generic": attempt("GO: unrelated inventory", [act("ACT-A", exact_a), act("ACT-B", exact_b)]),
    "wrong_act": attempt("GO: authorize ACT-C", [act("ACT-A", exact_a), act("ACT-B", exact_b)]),
    "prefix_added": attempt("x" + exact_a, [act("ACT-A", exact_a)]),
    "suffix_added": attempt(exact_a + " now", [act("ACT-A", exact_a)]),
    "empty": attempt("", [act("ACT-A", exact_a)]),
    "malformed": attempt(None, [act("ACT-A", exact_a)]),
    "replayed": attempt(exact_a, [act("ACT-A", exact_a, consent_received=True, consent_received_phrase=exact_a, consent_received_at="earlier")]),
    "ambiguous": attempt(exact_a, [act("ACT-A", exact_a), act("ACT-B", exact_a)]),
    "wrong_mission": attempt(exact_a, [act("ACT-A", exact_a)], requested_mission="MISSION-A", capsule_mission="MISSION-B"),
}, sort_keys=True))
`;

function observeConsent() {
  const run = spawnSync("python3", ["-B", "-c", HARNESS], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(run.status, 0, `kernel fixture harness failed: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

const refused = { approved: { "ACT-A": false, "ACT-B": false }, unchanged: true, save_count: 0, error: null };

test("B2 repaired control: exact consent approves only its named pending act", () => {
  assert.deepEqual(observeConsent().exact, {
    approved: { "ACT-A": true, "ACT-B": false },
    unchanged: false,
    save_count: 1,
    error: null,
  });
});

test("B2 repaired matrix: generic, mismatched, malformed, replayed, and ambiguous consent all refuse", () => {
  const observed = observeConsent();
  assert.deepEqual({
    generic: observed.generic,
    wrong_act: observed.wrong_act,
    prefix_added: observed.prefix_added,
    suffix_added: observed.suffix_added,
    empty: observed.empty,
    malformed: observed.malformed,
    ambiguous: observed.ambiguous,
    wrong_mission: observed.wrong_mission,
  }, {
    generic: refused,
    wrong_act: refused,
    prefix_added: { ...refused, approved: { "ACT-A": false } },
    suffix_added: { ...refused, approved: { "ACT-A": false } },
    empty: { ...refused, approved: { "ACT-A": false } },
    malformed: { ...refused, approved: { "ACT-A": false } },
    ambiguous: refused,
    wrong_mission: { ...refused, approved: { "ACT-A": false } },
  }, "B2: only one exact, current act consent may be accepted");
  assert.deepEqual(observed.replayed, {
    approved: { "ACT-A": true },
    unchanged: true,
    save_count: 0,
    error: null,
  }, "B2: already-consumed consent cannot be consumed again");
});
