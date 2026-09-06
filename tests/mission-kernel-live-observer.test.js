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
