import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  runMissionEmit,
  buildEphemeralCompositionRef,
  NODE0_LOCAL_MISSION_EMIT_GO_PHRASE,
} from "../apps/cli/src/commands/mission.js";
import {
  ARTIFACT_NAMES,
  node0LocalMissionArtifactEmissionPreviewBoundary,
} from "../packages/core/src/node0-local-mission-artifact-emission-preview.js";

const GO = NODE0_LOCAL_MISSION_EMIT_GO_PHRASE;

async function scratch() {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-emit-"));
  const filePath = join(base, "note.txt");
  const content = "founder note: emit the three artifacts.\nline two.\n";
  await writeFile(filePath, content, "utf8");
  const demaHome = join(base, "dema-home");
  await mkdir(demaHome, { recursive: true });
  return { base, filePath, content, demaHome };
}

function runDir(demaHome, runId) {
  return join(demaHome, "artifacts", "proofs", "node0-local-mission", runId);
}

test("fail-closed: no write without the exact consent phrase", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: "wrong", demaHome });
  assert.equal(out.ok, true, JSON.stringify(out.emission?.blocked_by));
  assert.equal(out.wrote, false);
  assert.equal(out.write_refused_reason, "write_consent_required");
  assert.equal(out.artifact_paths_written.length, 0);
  // Nothing was written anywhere under the mission artifacts root.
  await assert.rejects(() => stat(runDir(demaHome, out.run_id)));
});

test("fail-closed: omitted consent also writes nothing", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, demaHome });
  assert.equal(out.wrote, false);
  await assert.rejects(() => readdir(join(demaHome, "artifacts")));
});

test("with exact consent: writes exactly the three artifacts under <DEMA_HOME>/…/<run_id>/", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome, nowIso: "2026-07-07T00:00:00.000Z" });
  assert.equal(out.ok, true, JSON.stringify(out.emission?.blocked_by));
  assert.equal(out.wrote, true);
  const dir = runDir(demaHome, out.run_id);
  const names = (await readdir(dir)).sort();
  assert.deepEqual(names, ["dema_report.json", "receipt.json", "world_state_delta_preview.json"]);
  assert.equal(names.length, 3);
  // exactly the run_id dir, and each written path is inside it
  for (const p of out.artifact_paths_written) assert.ok(p.startsWith(dir), p);
});

test("written artifacts are valid JSON and content_hash matches the kernel's", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const onDisk = JSON.parse(await readFile(join(dir, `${name}.json`), "utf8"));
    assert.match(onDisk.content_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(onDisk.content_hash, out.emission.artifacts[name].content_hash);
    assert.equal(onDisk.committed_live, false);
  }
});

test("written artifacts are mode 0600", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const st = await stat(join(dir, `${name}.json`));
    assert.equal(st.mode & 0o777, 0o600, `${name} mode`);
  }
  // no leftover .tmp files
  const names = await readdir(dir);
  assert.ok(!names.some((n) => n.endsWith(".tmp")), names.join(","));
});

test("source file is byte-identical after the run (read-only, no mutation)", async () => {
  const { filePath, content, demaHome } = await scratch();
  const before = createHash("sha256").update(await readFile(filePath)).digest("hex");
  await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const afterBuf = await readFile(filePath);
  assert.equal(await readFile(filePath, "utf8"), content);
  assert.equal(createHash("sha256").update(afterBuf).digest("hex"), before);
});

test("boundary all-false, committed_live/mint/authority invariants hold on every artifact", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const expectedBoundary = node0LocalMissionArtifactEmissionPreviewBoundary();
  assert.deepEqual(out.emission.boundary, expectedBoundary);
  assert.equal(out.emission.mint_allowed, false);
  assert.equal(out.emission.authority_delta, 0);
  const dir = runDir(demaHome, out.run_id);
  for (const name of ARTIFACT_NAMES) {
    const onDisk = JSON.parse(await readFile(join(dir, `${name}.json`), "utf8"));
    assert.deepEqual(onDisk.boundary, expectedBoundary);
    assert.equal(onDisk.committed_live, false);
  }
});

test("rejects a relative path", async () => {
  const out = await runMissionEmit({ file: "relative/note.txt", consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "path_must_be_absolute");
});

test("rejects a missing file", async () => {
  const out = await runMissionEmit({ file: "/no/such/file/xyz.txt", consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "file_not_found_or_unreadable");
});

test("rejects a directory path", async () => {
  const { base } = await scratch();
  const out = await runMissionEmit({ file: base, consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "path_is_directory");
});

test("rejects a missing file argument", async () => {
  const out = await runMissionEmit({ file: undefined, consent: GO });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_file_argument");
});

test("deterministic run_id and artifact hashes for the same input (fixed composition ref)", async () => {
  const { filePath, demaHome } = await scratch();
  const compositionRef = buildEphemeralCompositionRef();
  const a = await runMissionEmit({ file: filePath, consent: GO, demaHome, compositionRef, nowIso: null });
  const b = await runMissionEmit({ file: filePath, consent: GO, demaHome, compositionRef, nowIso: null });
  assert.equal(a.run_id, b.run_id);
  for (const name of ARTIFACT_NAMES) {
    assert.equal(a.emission.artifacts[name].content_hash, b.emission.artifacts[name].content_hash);
  }
});

test("writes nothing outside the run_id dir", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionEmit({ file: filePath, consent: GO, demaHome });
  const missionRoot = join(demaHome, "artifacts", "proofs", "node0-local-mission");
  const entries = await readdir(missionRoot);
  // exactly one run_id directory, nothing else
  assert.deepEqual(entries, [out.run_id]);
});
