// NODE0-ENDURANCE-INSTRUMENTATION-FREEZE-1A — one exact implementation, one
// exact runtime identity, one observation contract, zero hidden mutation.
//
// Measured 2026-08-16: run soak-72h-20260816-0757 began, and AFTER it started
// the status bridge and setup scripts changed on disk. Nothing in the record
// can say which bytes produced which sample. That run is a shakedown forever.
// This contract makes the next run refuse that fate: the manifest freezes the
// executing surface, every sample re-derives it, and any changed byte turns
// the sample INSTRUMENTATION_DRIFT — evidence preserved, clock not laundered.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INSTRUMENTATION_MANIFEST_SCHEMA,
  deriveInstrumentationBundleHash,
  validateInstrumentationManifest,
  compareInstrumentationObservation,
  scanForSecretMaterial,
} from "../packages/core/src/node0-instrumentation-freeze.js";
import {
  deriveInstrumentationObservation,
  readSamples,
  readRecords,
  judgeRun,
} from "../apps/cli/src/commands/node0-run.js";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNNER = join(REPO, "apps", "cli", "src", "commands", "node0-run.js");

const tmp = [];
async function newDir(prefix) {
  const d = await mkdtemp(join(tmpdir(), prefix));
  tmp.push(d);
  return d;
}
test.after(async () => {
  for (const d of tmp) await rm(d, { recursive: true, force: true }).catch(() => {});
});

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

// A minimal valid manifest over fixture files the test controls.
async function fixtureManifest() {
  const fix = await newDir("dema-freeze-fix-");
  const scriptA = join(fix, "bridge.sh");
  const scriptB = join(fix, "unit.service");
  await writeFile(scriptA, "#!/bin/sh\necho fixture-bridge\n");
  await writeFile(scriptB, "[Service]\nExecStart=fixture\n");
  const { createHash } = await import("node:crypto");
  const h = (s) => createHash("sha256").update(s).digest("hex");
  const files = {
    [scriptA]: h(await readFile(scriptA)),
    [scriptB]: h(await readFile(scriptB)),
  };
  const manifest = {
    schema: INSTRUMENTATION_MANIFEST_SCHEMA,
    captured_at_utc: "2026-08-16T00:00:00Z",
    runner: { commit_sha: "a".repeat(40), tree_sha: "b".repeat(40), dirty_state: "clean" },
    node: { executable_path: process.execPath, version: process.version },
    rederivable: {
      files,
      node_version: process.version,
      node_executable: { path: process.execPath },
    },
  };
  return { manifest, fix, scriptA, scriptB };
}

// ── kernel: canonical hash ──────────────────────────────────────────────────

test("F1 bundle hash is deterministic and key-order independent", async () => {
  const { manifest } = await fixtureManifest();
  const reordered = Object.fromEntries(Object.entries(manifest).reverse());
  const h1 = deriveInstrumentationBundleHash(manifest);
  const h2 = deriveInstrumentationBundleHash(manifest);
  const h3 = deriveInstrumentationBundleHash(reordered);
  assert.match(h1, /^[a-f0-9]{64}$/);
  assert.equal(h1, h2);
  assert.equal(h1, h3);
});

test("F2 one changed byte in the manifest changes the bundle hash", async () => {
  const { manifest } = await fixtureManifest();
  const h1 = deriveInstrumentationBundleHash(manifest);
  const mutated = JSON.parse(JSON.stringify(manifest));
  mutated.runner.commit_sha = "c".repeat(40);
  assert.notEqual(h1, deriveInstrumentationBundleHash(mutated));
});

// ── kernel: secret refusal ──────────────────────────────────────────────────

test("F3 manifest carrying JWT-like or private-key material is refused", async () => {
  const { manifest } = await fixtureManifest();
  assert.equal(scanForSecretMaterial(manifest).length, 0);
  const leakyJwt = JSON.parse(JSON.stringify(manifest));
  leakyJwt.auth = { token: `eyJhbGciOiJIUzI1NiJ9.${"x".repeat(40)}.${"y".repeat(40)}` };
  assert.ok(scanForSecretMaterial(leakyJwt).length > 0);
  const leakyPem = JSON.parse(JSON.stringify(manifest));
  leakyPem.note = "-----BEGIN PRIVATE KEY-----\nabc";
  assert.ok(scanForSecretMaterial(leakyPem).length > 0);
  // validate() fails closed on secret material — a leaky manifest never loads.
  assert.equal(validateInstrumentationManifest(leakyJwt).ok, false);
});

test("F4 validate refuses a manifest without a rederivable contract", async () => {
  const { manifest } = await fixtureManifest();
  assert.equal(validateInstrumentationManifest(manifest).ok, true);
  const bare = JSON.parse(JSON.stringify(manifest));
  delete bare.rederivable;
  assert.equal(validateInstrumentationManifest(bare).ok, false);
  const wrongSchema = JSON.parse(JSON.stringify(manifest));
  wrongSchema.schema = "something.else";
  assert.equal(validateInstrumentationManifest(wrongSchema).ok, false);
});

// ── kernel: drift comparison (pure) ─────────────────────────────────────────

test("F5 identical observation reports no drift", async () => {
  const { manifest } = await fixtureManifest();
  const observed = JSON.parse(JSON.stringify(manifest.rederivable));
  const r = compareInstrumentationObservation({ frozen: manifest.rederivable, observed });
  assert.equal(r.drifted, false);
  assert.deepEqual(r.drift, []);
});

test("F6 a changed file hash drifts and names the exact path", async () => {
  const { manifest, scriptA } = await fixtureManifest();
  const observed = JSON.parse(JSON.stringify(manifest.rederivable));
  observed.files[scriptA] = "0".repeat(64);
  const r = compareInstrumentationObservation({ frozen: manifest.rederivable, observed });
  assert.equal(r.drifted, true);
  assert.ok(r.drift.some((d) => d.includes(scriptA)));
});

test("F7 node version or executable drift is named; a MISSING file drifts too", async () => {
  const { manifest, scriptB } = await fixtureManifest();
  const vObs = JSON.parse(JSON.stringify(manifest.rederivable));
  vObs.node_version = "v0.0.0";
  assert.equal(compareInstrumentationObservation({ frozen: manifest.rederivable, observed: vObs }).drifted, true);

  const missing = JSON.parse(JSON.stringify(manifest.rederivable));
  delete missing.files[scriptB];
  const r = compareInstrumentationObservation({ frozen: manifest.rederivable, observed: missing });
  assert.equal(r.drifted, true);
  assert.ok(r.drift.some((d) => d.includes(scriptB)));
});

test("F14 frozen environment drift is named (the restart vector)", async () => {
  const { manifest } = await fixtureManifest();
  manifest.rederivable.env = { DEMA_NODE0_STATUS_COMMAND: "bash /x/bridge.sh" };
  const same = JSON.parse(JSON.stringify(manifest.rederivable));
  assert.equal(
    compareInstrumentationObservation({ frozen: manifest.rederivable, observed: same }).drifted,
    false,
  );
  const changed = JSON.parse(JSON.stringify(manifest.rederivable));
  changed.env.DEMA_NODE0_STATUS_COMMAND = "bash /evil/bridge.sh";
  const r1 = compareInstrumentationObservation({ frozen: manifest.rederivable, observed: changed });
  assert.equal(r1.drifted, true);
  assert.ok(r1.drift.some((d) => d.includes("DEMA_NODE0_STATUS_COMMAND")));
  const missing = JSON.parse(JSON.stringify(manifest.rederivable));
  delete missing.env;
  assert.equal(
    compareInstrumentationObservation({ frozen: manifest.rederivable, observed: missing }).drifted,
    true,
  );
});

test("F15 the runner observes its own frozen environment", async () => {
  const { manifest } = await fixtureManifest();
  manifest.rederivable.env = { FREEZE_TEST_ONLY_VAR: "expected-value" };
  process.env.FREEZE_TEST_ONLY_VAR = "expected-value";
  try {
    const obs = await deriveInstrumentationObservation(manifest);
    assert.equal(
      compareInstrumentationObservation({ frozen: manifest.rederivable, observed: obs }).drifted,
      false,
    );
    process.env.FREEZE_TEST_ONLY_VAR = "tampered";
    const obs2 = await deriveInstrumentationObservation(manifest);
    const r = compareInstrumentationObservation({ frozen: manifest.rederivable, observed: obs2 });
    assert.equal(r.drifted, true);
    assert.ok(r.drift.some((d) => d.includes("FREEZE_TEST_ONLY_VAR")));
  } finally {
    delete process.env.FREEZE_TEST_ONLY_VAR;
  }
});

// ── runner: fs-only re-derivation ───────────────────────────────────────────

test("F8 deriveInstrumentationObservation re-hashes exactly the frozen paths", async () => {
  const { manifest, scriptA } = await fixtureManifest();
  const obs1 = await deriveInstrumentationObservation(manifest);
  assert.equal(
    compareInstrumentationObservation({ frozen: manifest.rederivable, observed: obs1 }).drifted,
    false,
  );
  await writeFile(scriptA, "#!/bin/sh\necho MUTATED\n");
  const obs2 = await deriveInstrumentationObservation(manifest);
  const r = compareInstrumentationObservation({ frozen: manifest.rederivable, observed: obs2 });
  assert.equal(r.drifted, true);
  assert.ok(r.drift.some((d) => d.includes(scriptA)));
});

// ── runner integration: real child process, real bytes ──────────────────────

function spawnRun(home, runId, extra = []) {
  return spawn(process.execPath, [
    "--input-type=module",
    "-e",
    `import { cmdNode0Run } from ${JSON.stringify(RUNNER)};
     await cmdNode0Run({ argv: process.argv.slice(1) });`,
    "node0", "run",
    "--dema-home", home,
    "--run-id", runId,
    ...extra,
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

async function writeManifestFile(manifest) {
  const d = await newDir("dema-freeze-man-");
  const p = join(d, "instrumentation-manifest.json");
  await writeFile(p, `${JSON.stringify(manifest, null, 2)}\n`);
  return p;
}

test("F9 header binds the bundle hash and the manifest is copied into the run dir", async () => {
  const home = await newDir("dema-freeze-home-");
  const { manifest } = await fixtureManifest();
  const manifestPath = await writeManifestFile(manifest);
  const child = spawnRun(home, "f9", [
    "--interval-ms", "120", "--duration-ms", "500",
    "--instrumentation-manifest", manifestPath,
  ]);
  await new Promise((r) => child.on("exit", r));

  const records = await readRecords({ demaHome: home, runId: "f9" });
  const header = records[0];
  const expected = deriveInstrumentationBundleHash(manifest);
  assert.equal(header.instrumentation_bundle_hash, expected);

  const copied = JSON.parse(
    await readFile(join(home, "node0", "endurance", "f9", "instrumentation-manifest.json"), "utf8"),
  );
  assert.equal(deriveInstrumentationBundleHash(copied), expected);

  const receipt = JSON.parse(
    await readFile(join(home, "node0", "endurance", "f9", "endurance-receipt.json"), "utf8"),
  );
  assert.equal(receipt.instrumentation?.bundle_hash, expected);
});

test("F10 a byte mutated mid-run turns later samples INSTRUMENTATION_DRIFT, chain intact", async () => {
  const home = await newDir("dema-freeze-home-");
  const { manifest, scriptA } = await fixtureManifest();
  const manifestPath = await writeManifestFile(manifest);
  const child = spawnRun(home, "f10", [
    "--interval-ms", "150", "--duration-ms", "1400",
    "--instrumentation-manifest", manifestPath,
  ]);
  await settle(450);
  await writeFile(scriptA, "#!/bin/sh\necho DRIFTED\n"); // the hidden mutation
  await new Promise((r) => child.on("exit", r));

  const samples = await readSamples({ demaHome: home, runId: "f10" });
  const drifted = samples.filter((s) => s.mission_verdict === "INSTRUMENTATION_DRIFT");
  const clean = samples.filter((s) => s.mission_verdict !== "INSTRUMENTATION_DRIFT");
  assert.ok(drifted.length >= 1, "expected at least one drift sample");
  assert.ok(clean.length >= 1, "expected at least one pre-drift sample");
  for (const s of drifted) {
    assert.equal(s.ok, false);
    assert.ok(Array.isArray(s.instrumentation_drift) && s.instrumentation_drift.length > 0);
  }
  // Evidence preserved, clock not reset: the chain still verifies end to end,
  // and the judge reads the drift as failure — never as a fresh healthy run.
  const verdict = await judgeRun({ demaHome: home, runId: "f10", targetMs: 900, intervalMs: 150 });
  assert.equal(verdict.chain.ok, true);
  assert.equal(verdict.ok, false);
});

test("F11 a terminally sealed run refuses further appends", async () => {
  const home = await newDir("dema-freeze-home-");
  const first = spawnRun(home, "f11", ["--interval-ms", "100", "--duration-ms", "300"]);
  await new Promise((r) => first.on("exit", r));
  const before = (await readRecords({ demaHome: home, runId: "f11" })).length;

  let stderr = "";
  const second = spawnRun(home, "f11", ["--interval-ms", "100", "--duration-ms", "300"]);
  second.stderr.on("data", (c) => { stderr += c; });
  const code = await new Promise((r) => second.on("exit", r));
  assert.equal(code, 1);
  assert.match(stderr, /sealed/i);
  const after = (await readRecords({ demaHome: home, runId: "f11" })).length;
  assert.equal(after, before);
});

test("F12 resuming under a manifest that does not match the header is refused", async () => {
  const home = await newDir("dema-freeze-home-");
  const { manifest } = await fixtureManifest();
  const manifestPath = await writeManifestFile(manifest);
  // Kill the first run so it is NOT sealed (no receipt), leaving a resumable chain.
  const first = spawnRun(home, "f12", [
    "--interval-ms", "120", "--duration-ms", "60000",
    "--instrumentation-manifest", manifestPath,
  ]);
  await settle(500);
  first.kill("SIGKILL");
  await new Promise((r) => first.on("exit", r));

  const other = JSON.parse(JSON.stringify(manifest));
  other.runner.commit_sha = "d".repeat(40);
  const otherPath = await writeManifestFile(other);

  let stderr = "";
  const second = spawnRun(home, "f12", [
    "--interval-ms", "120", "--duration-ms", "300",
    "--instrumentation-manifest", otherPath,
  ]);
  second.stderr.on("data", (c) => { stderr += c; });
  const code = await new Promise((r) => second.on("exit", r));
  assert.equal(code, 1);
  assert.match(stderr, /instrumentation/i);
});

test("F13 an unreadable or invalid manifest refuses the run before writing anything", async () => {
  const home = await newDir("dema-freeze-home-");
  let stderr = "";
  const child = spawnRun(home, "f13", [
    "--interval-ms", "100", "--duration-ms", "300",
    "--instrumentation-manifest", "/nonexistent/manifest.json",
  ]);
  child.stderr.on("data", (c) => { stderr += c; });
  const code = await new Promise((r) => child.on("exit", r));
  assert.equal(code, 1);
  assert.match(stderr, /manifest/i);
  const records = await readRecords({ demaHome: home, runId: "f13" });
  assert.equal(records.length, 0);
});

test("F16 resume of a frozen header without --instrumentation-manifest is refused", async () => {
  const home = await newDir("dema-freeze-home-");
  const { manifest } = await fixtureManifest();
  const manifestPath = await writeManifestFile(manifest);
  const first = spawnRun(home, "f16", [
    "--interval-ms", "120", "--duration-ms", "60000",
    "--instrumentation-manifest", manifestPath,
  ]);
  await settle(500);
  first.kill("SIGKILL");
  await new Promise((r) => first.on("exit", r));
  const before = (await readRecords({ demaHome: home, runId: "f16" })).length;
  assert.ok(before >= 1, "expected a frozen header on disk before resume");

  let stderr = "";
  const second = spawnRun(home, "f16", [
    "--interval-ms", "120", "--duration-ms", "300",
    // deliberately omit --instrumentation-manifest (restart vector)
  ]);
  second.stderr.on("data", (c) => { stderr += c; });
  const code = await new Promise((r) => second.on("exit", r));
  assert.equal(code, 1);
  assert.match(stderr, /instrumentation_bundle_hash|instrumentation-manifest/i);
  const after = (await readRecords({ demaHome: home, runId: "f16" })).length;
  assert.equal(after, before);
});
