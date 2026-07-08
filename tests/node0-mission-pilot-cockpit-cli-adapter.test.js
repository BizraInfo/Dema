import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runMissionEmit,
  runMissionCockpit,
  buildEphemeralCompositionRef,
  NODE0_LOCAL_MISSION_EMIT_GO_PHRASE,
} from "../apps/cli/src/commands/mission.js";
import {
  node0MissionPilotCockpitPreviewBoundary,
} from "../packages/core/src/node0-mission-pilot-cockpit-preview.js";

const GO = NODE0_LOCAL_MISSION_EMIT_GO_PHRASE;
const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

// One shared composition ref keeps the run_id deterministic across emit calls in a test.
function scratchCompositionRef() {
  return buildEphemeralCompositionRef();
}

async function scratch() {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-cockpit-"));
  const filePath = join(base, "note.txt");
  await writeFile(filePath, "founder note: cockpit reads the emitted run.\nline two.\n", "utf8");
  const demaHome = join(base, "dema-home");
  await mkdir(demaHome, { recursive: true });
  return { base, filePath, demaHome };
}

function runDir(demaHome, runId) {
  return join(demaHome, "artifacts", "proofs", "node0-local-mission", runId);
}

// Emit one real run dir (three artifacts + emission.json envelope) under a throwaway DEMA_HOME.
async function emitOne() {
  const s = await scratch();
  const emit = await runMissionEmit({
    file: s.filePath,
    consent: GO,
    demaHome: s.demaHome,
    compositionRef: scratchCompositionRef(),
    nowIso: null,
  });
  assert.equal(emit.ok, true, JSON.stringify(emit.emission?.blocked_by));
  assert.equal(emit.wrote, true);
  return { ...s, emit, dir: runDir(s.demaHome, emit.run_id) };
}

test("emit → cockpit end-to-end: renders a cockpit_view with a non-empty gates ladder", async () => {
  const { demaHome, emit } = await emitOne();
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, true, JSON.stringify(out.blocked_by));
  assert.equal(out.error, null);
  assert.equal(out.run_id, emit.run_id);
  assert.ok(out.cockpit_view, "cockpit_view rendered");
  assert.ok(out.cockpit_view.gates, "gates panel present");
  assert.ok(
    Array.isArray(out.cockpit_view.gates.ladder) && out.cockpit_view.gates.ladder.length > 0,
    "gates ladder non-empty",
  );
  assert.equal(out.cockpit_view.run_id, emit.run_id);
  assert.equal(out.cockpit.status, "verified_preview_cockpit");
});

test("boundary all-false, committed_live/mint/authority invariants + applied:false delta", async () => {
  const { demaHome, emit } = await emitOne();
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.deepEqual(out.cockpit.boundary, node0MissionPilotCockpitPreviewBoundary());
  assert.equal(out.cockpit.mint_allowed, false);
  assert.equal(out.cockpit.authority_delta, 0);
  assert.equal(out.committed_live, false);
  assert.equal(out.cockpit_view.world_state_delta_preview.applied, false);
  assert.equal(out.cockpit_view.world_state_delta_preview.committed_live, false);
});

test("every independent artifact-file re-check passes on an untampered run", async () => {
  const { demaHome, emit } = await emitOne();
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.artifact_file_checks.length, 3);
  for (const c of out.artifact_file_checks) {
    assert.equal(c.ok, true, `${c.name} check`);
    assert.equal(c.embedded_hash, c.rederived_hash);
    assert.equal(c.recorded_hash, c.rederived_hash);
  }
});

test("cockpit writes ZERO files — run dir file set unchanged after the read", async () => {
  const { demaHome, emit, dir } = await emitOne();
  const before = (await readdir(dir)).sort();
  await runMissionCockpit({ runId: emit.run_id, demaHome });
  const after = (await readdir(dir)).sort();
  assert.deepEqual(after, before);
  assert.equal(after.length, 4); // three artifacts + emission.json
  // nothing new appeared under the mission root either
  const missionRoot = join(demaHome, "artifacts", "proofs", "node0-local-mission");
  assert.deepEqual((await readdir(missionRoot)).sort(), [emit.run_id]);
});

test("missing run-id argument → refused (maps to non-zero exit)", async () => {
  const out = await runMissionCockpit({ runId: undefined });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_run_id");
  assert.equal(out.run_dir, null);
});

test("path-traversal run-ids are rejected BEFORE any fs op (no path built)", async () => {
  for (const bad of ["..", "../x", "../../etc/passwd", "abc", "ZZZZ", "0123456789abcdeg", "0123456789abcde", "0123456789abcdef0"]) {
    const out = await runMissionCockpit({ runId: bad, demaHome: "/nonexistent-dema-home" });
    assert.equal(out.ok, false, `expected reject for ${JSON.stringify(bad)}`);
    assert.equal(out.error, "invalid_run_id", `expected invalid_run_id for ${JSON.stringify(bad)}`);
    assert.equal(out.run_dir, null, `no path should be built for ${JSON.stringify(bad)}`);
  }
});

test("a run-id that looks like a flag (starts with --) → missing_run_id, no path built", async () => {
  const out = await runMissionCockpit({ runId: "--json", demaHome: "/nonexistent-dema-home" });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_run_id");
  assert.equal(out.run_dir, null);
});

test("a corrupt (non-JSON) emission.json → emission_envelope_not_valid_json", async () => {
  const { demaHome, emit, dir } = await emitOne();
  await writeFile(join(dir, "emission.json"), "{ not json", "utf8");
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.equal(out.error, "emission_envelope_not_valid_json");
});

test("a corrupt (non-JSON) artifact file → artifact_not_valid_json (independent re-check)", async () => {
  const { demaHome, emit, dir } = await emitOne();
  await writeFile(join(dir, "dema_report.json"), "not json at all", "utf8");
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("artifact_not_valid_json:dema_report"), out.blocked_by.join(","));
});

test("a valid-shaped run-id with no emission.json on disk → emission_envelope_not_found", async () => {
  const { demaHome } = await scratch();
  const out = await runMissionCockpit({ runId: "0123456789abcdef", demaHome });
  assert.equal(out.ok, false);
  assert.equal(out.error, "emission_envelope_not_found");
});

test("a missing artifact file → refused (missing_artifact_file), even though the envelope is intact", async () => {
  const { demaHome, emit, dir } = await emitOne();
  // Remove one artifact file (rename by writing an empty marker dir is not possible; delete via fs).
  const { rm } = await import("node:fs/promises");
  await rm(join(dir, "receipt.json"));
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("missing_artifact_file:receipt"), out.blocked_by.join(","));
});

test("a tampered artifact FILE (bytes changed) → artifact_hash_mismatch (kernel alone misses it)", async () => {
  const { demaHome, emit, dir } = await emitOne();
  const p = join(dir, "receipt.json");
  const artifact = JSON.parse(await readFile(p, "utf8"));
  artifact.pulse_content_hash = `sha256:${"0".repeat(64)}`; // change the body, keep content_hash stale
  await writeFile(p, JSON.stringify(artifact, null, 2), "utf8");
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("artifact_hash_mismatch:receipt"), out.blocked_by.join(","));
  // The kernel over the (untouched) embedded emission still verifies — proving the file re-check is what
  // caught the on-disk tamper.
  assert.equal(out.cockpit.ok, true);
});

test("a tampered emission.json (nested emission mutated) → refused by the kernel anchor", async () => {
  const { demaHome, emit, dir } = await emitOne();
  const p = join(dir, "emission.json");
  const env = JSON.parse(await readFile(p, "utf8"));
  env.emission.run_id = "ffffffffffffffff"; // mutate the content-addressed emission body
  await writeFile(p, JSON.stringify(env, null, 2), "utf8");
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.some((c) => /content_hash_mismatch/.test(c)), out.blocked_by.join(","));
});

test("emission.json present but with no nested emission → emission_envelope_missing_nested_emission", async () => {
  const { demaHome, emit, dir } = await emitOne();
  const p = join(dir, "emission.json");
  const env = JSON.parse(await readFile(p, "utf8"));
  delete env.emission;
  await writeFile(p, JSON.stringify(env, null, 2), "utf8");
  const out = await runMissionCockpit({ runId: emit.run_id, demaHome });
  assert.equal(out.ok, false);
  assert.equal(out.error, "emission_envelope_missing_nested_emission");
});

// ---- real CLI binary: render, exit codes, zero-write ----

function runCli(demaHome, args, { expectFail = false } = {}) {
  try {
    const stdout = execFileSync("node", [BIN, "mission", "cockpit", ...args], {
      env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1", DEMA_HOME: demaHome },
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
    return { code: 0, stdout };
  } catch (err) {
    if (!expectFail) throw err;
    return { code: err.status ?? 1, stdout: (err.stdout || "").toString(), stderr: (err.stderr || "").toString() };
  }
}

test("CLI binary renders a cockpit view (--json) and exits 0 on a valid run", async () => {
  const { demaHome, emit, dir } = await emitOne();
  const before = (await readdir(dir)).sort();
  const { code, stdout } = runCli(demaHome, [emit.run_id, "--json"]);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.preview_only, true);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.blocked_by));
  assert.equal(parsed.run_id, emit.run_id);
  assert.ok(Array.isArray(parsed.gates.ladder) && parsed.gates.ladder.length > 0);
  assert.equal(parsed.committed_live, false);
  assert.equal(parsed.mint_allowed, false);
  assert.equal(parsed.authority_delta, 0);
  assert.ok(Object.values(parsed.boundary).every((v) => v === false));
  // read-only: nothing changed on disk
  assert.deepEqual((await readdir(dir)).sort(), before);
});

test("CLI binary exits non-zero on a missing run-id argument", async () => {
  const { demaHome } = await scratch();
  const { code } = runCli(demaHome, ["--json"], { expectFail: true });
  assert.notEqual(code, 0);
});

test("CLI binary exits non-zero on a path-traversal run-id", async () => {
  const { demaHome } = await scratch();
  const { code } = runCli(demaHome, ["../x", "--json"], { expectFail: true });
  assert.notEqual(code, 0);
});
