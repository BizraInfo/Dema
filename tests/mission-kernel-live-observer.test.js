import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

const KERNEL = fileURLToPath(new URL("../runtime/mission_lifecycle/kernel.py", import.meta.url));
const AGENT = "dema.node0_mission_agent";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function fixtureHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-live-observer-"));
  const agentDir = join(home, "agents", AGENT);
  await mkdir(join(agentDir, "receipts"), { recursive: true });
  const yaml = {
    "capability.yaml": { contract_id: "fixture-contract", agent: { name: AGENT } },
    "knowledge_pack.yaml": { doctrine: { law_of_assumption: "fixture", node0_space: "fixture" } },
    "knowhow_playbook.yaml": {},
    "kpi_contract.yaml": { kpis: [] },
    "definition_of_done.yaml": {},
    "authority_policy.yaml": {},
  };
  for (const [name, value] of Object.entries(yaml)) {
    await writeFile(join(agentDir, name), JSON.stringify(value), "utf8");
  }
  await writeFile(join(agentDir, "receipts", "contract-act.json"), JSON.stringify({
    schema: "bizra.dema.agent_capability_contract_act.v0.1",
    timestamp: "2026-01-01T00:00:00Z",
    state_after: "active",
  }), "utf8");
  await writeFile(join(agentDir, "receipts", "chain-head.txt"), "GENESIS", "utf8");
  return home;
}

function runKernel(home, args) {
  const result = spawnSync("python3", ["-B", KERNEL, ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: home, PYTHONDONTWRITEBYTECODE: "1" },
  });
  return result;
}

async function readCapsule(home, missionId) {
  const path = join(home, "kernel", "mission_lifecycle", "missions", missionId, "capsule.yaml");
  const text = await readFile(path, "utf8");
  const result = spawnSync("python3", ["-B", "-c",
    "import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))",
  ], { input: text, encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function missionIdFrom(result) {
  assert.equal(result.status, 0, result.stderr);
  const match = result.stdout.match(/^mission_id:\s+(\S+)/m);
  assert.ok(match, result.stdout);
  return match[1];
}

async function writeActs(home, content, expectedSha256 = sha256(content), overrides = {}) {
  const act = {
    act_id: "ACT-GENESIS-001",
    tier: "MUMO_GO_REQUIRED",
    handler: "write_under_mission_directory",
    effect_id: "EFFECT-GENESIS-001",
    producer_id: "dema.mission_executor",
    consent_phrase_template: "GO: authorize EFFECT-GENESIS-001",
    args: {
      relative_path: "outputs/founder-brief.md",
      content,
      max_bytes: 1048576,
    },
    postcondition: {
      type: "file_sha256",
      relative_path: "outputs/founder-brief.md",
      expected_sha256: expectedSha256,
    },
    ...overrides,
  };
  const path = join(home, "acts.json");
  await writeFile(path, JSON.stringify([act]), "utf8");
  return path;
}

test("GATE_7F2: preview binds a real file postcondition and run persists a checkpoint", async () => {
  const home = await fixtureHome();
  try {
    const content = "Node0 Founder Brief\ntruth=measured\n";
    const acts = await writeActs(home, content);
    const missionId = missionIdFrom(runKernel(home, [
      "preview", AGENT, "Prepare the current Node0 Founder Brief", "--acts-file", acts,
    ]));
    const preview = await readCapsule(home, missionId);
    assert.equal(preview.state.current, "preview");
    assert.equal(preview.dod.predicates_required.length, 1);
    assert.equal(preview.observations && Object.keys(preview.observations).length, 0);
    assert.match(preview.dod.predicates_required[0], /^file_sha256:/);

    const consent = runKernel(home, ["consent", missionId, "GO: authorize EFFECT-GENESIS-001"]);
    assert.equal(consent.status, 0, consent.stderr);

    const run = runKernel(home, ["run", missionId]);
    assert.equal(run.status, 1, run.stderr);
    const suspended = await readCapsule(home, missionId);
    assert.equal(suspended.state.current, "suspended", run.stderr);
    assert.equal(suspended.evidence.effect_records.length, 1);
    assert.equal(suspended.observations && Object.keys(suspended.observations).length, 0);
    const target = join(home, "kernel", "mission_lifecycle", "missions", missionId, "outputs", "founder-brief.md");
    assert.equal(await readFile(target, "utf8"), content);

    const secondRun = runKernel(home, ["run", missionId]);
    assert.equal(secondRun.status, 1);
    assert.equal(await readFile(target, "utf8"), content);

    const observe = runKernel(home, ["observe", missionId]);
    assert.equal(observe.status, 0, observe.stderr);
    const archived = await readCapsule(home, missionId);
    assert.equal(archived.state.current, "archived");
    assert.equal(archived.outcome.result, "success");
    assert.equal(archived.outcome.observer_checkpoint.observer_class,
      "independent_postcondition_observer");
    const predicate = archived.dod.predicates_required[0];
    assert.equal(archived.observations[predicate].observed_sha256, sha256(content));
    assert.equal(archived.evidence.effect_records.length, 1);
    assert.equal(archived.dod.predicates_passed.length, 1);

    const replay = runKernel(home, ["observe", missionId]);
    assert.equal(replay.status, 1);
    assert.equal(await readFile(target, "utf8"), content);
    assert.match(runKernel(home, ["status", missionId]).stdout, /state:\s+archived/);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("GATE_7F2: false world readback stays suspended and malformed bindings refuse at preview", async () => {
  const home = await fixtureHome();
  try {
    const content = "expected\n";
    const acts = await writeActs(home, content);
    const missionId = missionIdFrom(runKernel(home, [
      "preview", AGENT, "Observe a bounded file", "--acts-file", acts,
    ]));
    assert.equal(runKernel(home, ["consent", missionId, "GO: authorize EFFECT-GENESIS-001"]).status, 0);
    const failedRun = runKernel(home, ["run", missionId]);
    assert.equal(failedRun.status, 1, failedRun.stderr);
    const target = join(home, "kernel", "mission_lifecycle", "missions", missionId, "outputs", "founder-brief.md");
    await writeFile(target, "tampered\n", "utf8");
    const observe = runKernel(home, ["observe", missionId]);
    assert.equal(observe.status, 1);
    const suspended = await readCapsule(home, missionId);
    assert.equal(suspended.state.current, "suspended");
    assert.equal(suspended.outcome.result, null);
    const observation = suspended.observations[suspended.dod.predicates_required[0]];
    assert.equal(observation.verdict, "FAIL");
    assert.equal(suspended.evidence.effect_records.length, 1);

    const invalidHome = await fixtureHome();
    try {
      const invalidActs = await writeActs(invalidHome, content, sha256(content), {
        postcondition: { type: "file_sha256", relative_path: "../escape", expected_sha256: sha256(content) },
      });
    const invalid = runKernel(invalidHome, [
        "preview", AGENT, "Reject an escaping postcondition", "--acts-file", invalidActs,
    ]);
      assert.equal(invalid.status, 1);
      assert.match(invalid.stderr, /postcondition_path_outside_mission/);
      const missions = await readdir(join(invalidHome, "kernel", "mission_lifecycle", "missions"));
      assert.deepEqual(missions, []);
      const malformedObserver = runKernel(invalidHome, ["observe", "../outside"]);
      assert.equal(malformedObserver.status, 1);
      assert.match(malformedObserver.stderr, /malformed mission id/);
    } finally {
      await rm(invalidHome, { recursive: true, force: true });
    }
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});


test("NEGATIVE CONTROL: dangling output link must not create a file outside the mission", async () => {
  const home = await fixtureHome();
  try {
    const content = "Synthetic scope check\\n";
    const acts = await writeActs(home, content);
    const missionId = missionIdFrom(runKernel(home, ["preview", AGENT, "Bounded scope check", "--acts-file", acts]));
    const missionDir = join(home, "kernel", "mission_lifecycle", "missions", missionId);
    await mkdir(join(missionDir, "outputs"), { recursive: true });
    const outside = join(home, "outside-mission.txt");
    const { symlink } = await import("node:fs/promises");
    await symlink(outside, join(missionDir, "outputs", "founder-brief.md"));
    assert.equal(runKernel(home, ["consent", missionId, "GO: authorize EFFECT-GENESIS-001"]).status, 0);
    const execution = runKernel(home, ["run", missionId]);
    let escaped = false;
    try { escaped = await readFile(outside, "utf8") === content; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const observed = runKernel(home, ["observe", missionId]);
    console.log(JSON.stringify({case: "full_kernel_dangling_symlink", external_to_mission_write: escaped, run_exit: execution.status, observe_exit: observed.status, all_paths_within_disposable_fixture: true}));
    assert.equal(escaped, false, "Authorized run wrote through a dangling link outside the mission before observation");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

for (const attack of ["existing", "dangling-leaf", "existing-leaf-link", "parent-link"]) {
  test(`WRITER_SCOPE: ${attack} refuses without outside effects or success`, async () => {
    const home = await fixtureHome();
    try {
      const content = "authorized content\n";
      const acts = await writeActs(home, content);
      const missionId = missionIdFrom(runKernel(home, [
        "preview", AGENT, "Writer boundary control", "--acts-file", acts,
      ]));
      const missionDir = join(home, "kernel", "mission_lifecycle", "missions", missionId);
      const outputs = join(missionDir, "outputs");
      const target = join(outputs, "founder-brief.md");
      const outsideDir = join(home, "outside");
      const outside = join(outsideDir, "founder-brief.md");
      const { symlink } = await import("node:fs/promises");
      await mkdir(outsideDir);
      if (attack === "parent-link") await symlink(outsideDir, outputs);
      else await mkdir(outputs);
      // Matching content must not let the observer turn a refused write into success.
      if (attack === "existing") await writeFile(target, content);
      if (attack === "existing-leaf-link") await writeFile(outside, "untouched\n");
      if (attack.includes("leaf")) await symlink(outside, target);
      assert.equal(runKernel(home, ["consent", missionId, "GO: authorize EFFECT-GENESIS-001"]).status, 0);
      assert.equal(runKernel(home, ["run", missionId]).status, 1);
      const capsule = await readCapsule(home, missionId);
      assert.equal(capsule.state.current, "suspended");
      assert.equal(capsule.outcome.result, null);
      assert.equal(capsule.evidence.effect_records.length, 1);
      const result = capsule.evidence.effect_records[0].result;
      assert.equal(result.passed, false);
      assert.deepEqual(result.outputs, []);
      assert.ok(result.finding);
      assert.equal(runKernel(home, ["observe", missionId]).status, 1);
      const observed = await readCapsule(home, missionId);
      assert.equal(observed.state.current, "suspended");
      assert.equal(observed.outcome.result, null);
      if (attack === "existing") assert.equal(await readFile(target, "utf8"), content);
      if (attack === "existing-leaf-link") assert.equal(await readFile(outside, "utf8"), "untouched\n");
      else assert.deepEqual(await readdir(outsideDir), []);
      console.log(JSON.stringify({ case: attack, requested_output_created: false,
        outside_write: false, fixture_metadata: "capsule, transition and handler receipts updated" }));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
}

for (const scenario of ["fresh", "existing", "leaf-race", "parent-before-open",
  "parent-after-open", "parent-reparent-outside", "mkdir-race", "unsupported", "partial-write", "io-error", "utf8-limit"]) {
  test(`WRITER_SCOPE descriptor control: ${scenario}`, () => {
    const script = String.raw`
import importlib.util, json, os, pathlib, sys, tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("writer", pathlib.Path(sys.argv[1]).parent / "handlers/write_file.py")
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)
case = sys.argv[2]
with tempfile.TemporaryDirectory(prefix="writer-scope-") as tmp:
    root = pathlib.Path(tmp)
    writer.MISSIONS_ROOT = root / "missions"
    mission = writer.MISSIONS_ROOT / "M-1"
    mission.mkdir(parents=True)
    outputs = mission / "outputs"
    outside = root / "outside"
    outside.mkdir()
    target = outputs / "result.txt"
    act = {"args": {"relative_path": "outputs/result.txt", "content": "hello"}}
    capsule = {"mission_id": "M-1"}
    real_open, real_write = os.open, os.write
    fired = []
    write_paths = []
    if case not in ("fresh", "mkdir-race", "unsupported", "utf8-limit"):
        outputs.mkdir()
    if case == "existing": target.write_text("original")
    if case == "utf8-limit": act["args"].update(content="é", max_bytes=1)

    def intercept_open(path, flags, *args, **kwargs):
        if case == "leaf-race" and path == "result.txt":
            target.symlink_to(outside / "escape.txt")
            fired.append(case)
        if case in ("parent-before-open", "mkdir-race") and path == "outputs":
            outputs.rename(mission / "held")
            outputs.symlink_to(outside, target_is_directory=True)
            fired.append(case)
        fd = real_open(path, flags, *args, **kwargs)
        if case in ("parent-after-open", "parent-reparent-outside") and path == "outputs":
            outputs.rename(outside / "moved" if case == "parent-reparent-outside" else mission / "held")
            outputs.symlink_to(outside, target_is_directory=True)
            fired.append(case)
        return fd

    def intercept_write(fd, data):
        if case != "parent-reparent-outside": fired.append(case)
        if case == "parent-reparent-outside":
            write_paths.append(os.readlink(f"/proc/self/fd/{fd}"))
        if case == "io-error": raise OSError("deterministic disk error")
        return real_write(fd, data[:1])

    if case == "unsupported":
        with patch.object(os, "supports_dir_fd", set()):
            result = writer.handle(act, capsule, {})
    else:
        with patch.object(os, "open", intercept_open), \
             patch.object(os, "supports_dir_fd", os.supports_dir_fd | {intercept_open}), \
             patch.object(os, "write", intercept_write if case in ("partial-write", "io-error", "parent-reparent-outside") else real_write):
            result = writer.handle(act, capsule, {})
    if case == "parent-reparent-outside":
        escaped = (outside / "moved/result.txt").exists()
        print(json.dumps({"case": case, "outside_write": escaped, "write_paths": write_paths, "handler_result": result}))
        assert write_paths == [], "moved-parent output must be refused before content write"
        assert not escaped, "moved-parent output must not remain outside the mission"
        assert result["passed"] is False and result["outputs"] == [], result
        assert result["finding"] == "path_moved_before_write", result
        assert any("pre-write containment failed" in e for e in result["evidence"]), result
        assert fired == [case], "directory-move seam must execute exactly once"
    else:
        assert list(outside.iterdir()) == [], (case, result)
    success = case in ("fresh", "parent-after-open", "partial-write")
    assert result["passed"] is success, (case, result)
    if success:
        actual = mission / "held/result.txt" if case == "parent-after-open" else target
        assert actual.read_text() == "hello"
        assert len(result["outputs"]) == 1
    else:
        assert result["outputs"] == [] and result["finding"], result
        assert result["content_excerpt"] is None
    if case == "existing": assert target.read_text() == "original"
    if case == "unsupported":
        assert result["finding"] == "safe_creation_unavailable"
        assert list(mission.iterdir()) == []
    if case == "utf8-limit": assert list(mission.iterdir()) == []
    if case == "io-error":
        assert target.read_bytes() == b""
        assert any("may be partial" in e for e in result["evidence"])
    if case in ("leaf-race", "parent-before-open", "parent-after-open", "mkdir-race", "partial-write", "io-error"):
        assert fired, "substitution seam was not reached"
    if case in ("fresh", "mkdir-race"):
        assert any("directory created" in e for e in result["evidence"])
    print(json.dumps({"case": case, "passed": result["passed"], "outside_write": False,
                      "substitution_count": len(fired), "evidence": result["evidence"]}))
`;
    const result = spawnSync("python3", ["-B", "-c", script, KERNEL, scenario], {
      encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    assert.equal(result.status, 0, `${result.stderr}
${result.stdout}`);
    console.log(result.stdout.trim());
    if (scenario === "parent-reparent-outside") return (async () => {
      const home = await fixtureHome();
      try {
        const content = "move-race lifecycle proof";
        const acts = await writeActs(home, content);
        const id = missionIdFrom(runKernel(home, ["preview", AGENT, "Move-race control", "--acts-file", acts]));
        const mission = join(home, "kernel", "mission_lifecycle", "missions", id);
        await mkdir(join(mission, "outputs"));
        const outside = join(home, "moved-output");
        assert.equal(runKernel(home, ["consent", id, "GO: authorize EFFECT-GENESIS-001"]).status, 0);
        const execution = spawnSync("python3", ["-B", "-c", String.raw`
import os, pathlib, runpy, sys
from unittest.mock import patch
kernel, mission_id, mission, outside = sys.argv[1:]
real_open = os.open
fired = []
def moved_open(path, flags, *args, **kwargs):
    fd = real_open(path, flags, *args, **kwargs)
    if path == "outputs" and not fired:
        pathlib.Path(mission, "outputs").rename(outside)
        pathlib.Path(mission, "outputs").symlink_to(outside, target_is_directory=True)
        fired.append(True)
    return fd
sys.argv = [kernel, "run", mission_id]
with patch.object(os, "open", moved_open), patch.object(os, "supports_dir_fd", os.supports_dir_fd | {moved_open}):
    try:
        runpy.run_path(kernel, run_name="__main__")
    finally:
        assert fired == [True], "directory-move seam not reached"
`, KERNEL, id, mission, outside], {
          encoding: "utf8", env: { ...process.env, DEMA_HOME: home, PYTHONDONTWRITEBYTECODE: "1" },
        });
        assert.equal(execution.status, 1, execution.stderr);
        assert.deepEqual(await readdir(outside), []);
        const capsule = await readCapsule(home, id);
        assert.equal(capsule.state.current, "suspended");
        assert.equal(capsule.outcome.result, null);
        const effect = capsule.evidence.effect_records[0].result;
        assert.equal(effect.passed, false);
        assert.equal(effect.finding, "path_moved_before_write");
        assert.ok(effect.evidence.some(e => e.includes("pre-write containment failed")));
        assert.ok(capsule.evidence.receipts_minted.length > 0);
        assert.equal(runKernel(home, ["observe", id]).status, 1);
        assert.equal((await readCapsule(home, id)).outcome.result, null);
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    })();
  });
}
