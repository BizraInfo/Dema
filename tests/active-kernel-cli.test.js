import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

async function makeFixtureDownloads() {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-fixture-downloads-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-fixture-home-"));
  await writeFile(join(downloadsRoot, "alpha.txt"), "hello\n");
  await writeFile(join(downloadsRoot, "bravo.pdf"), "fake-pdf\n");
  await writeFile(join(downloadsRoot, "charlie.pdf"), "another-fake\n");
  await mkdir(join(downloadsRoot, "subdir"), { recursive: true });
  return { downloadsRoot, demaRoot };
}

test("dema task (no arg) lists registered tasks as schema-tagged JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "task"]);
  const output = JSON.parse(stdout);
  assert.equal(output.schema, "bizra.dema.task_list.v0.1");
  assert.ok(output.tasks.find((t) => t.id === "downloads.audit.preview"));
});

test("dema task downloads.audit.preview runs end-to-end with DEMA_DOWNLOADS_ROOT override", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const { stdout } = await execFileAsync("node", [cliPath, "task", "downloads.audit.preview"], {
    env: {
      ...process.env,
      DEMA_DOWNLOADS_ROOT: downloadsRoot,
      DEMA_HOME: demaRoot
    }
  });
  assert.match(stdout, /Task:\s+downloads\.audit\.preview/);
  assert.match(stdout, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
  assert.match(stdout, /✓ scope_declared_read_only/);
  const receiptsDir = join(demaRoot, "receipts");
  const files = await readdir(receiptsDir);
  assert.ok(files.find((f) => f.includes("downloads.audit.preview")));
});

test("dema bare invocation (no args) prints the active-kernel banner", async () => {
  const { demaRoot } = await makeFixtureDownloads();
  const { stdout } = await execFileAsync("node", [cliPath], {
    env: {
      ...process.env,
      DEMA_HOME: demaRoot,
      DEMA_NODE0_ADAPTER: ""
    }
  });
  assert.match(stdout, /Dema — Sovereign AI Node Companion/);
  assert.match(stdout, /Operator:\s+operator/);
  assert.match(stdout, /Next safe task/);
  assert.match(stdout, /Boundary: no action without explicit consent/);
});

test("dema help still works after the active-kernel refactor", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help"]);
  assert.match(stdout, /Dema CLI/);
  assert.match(stdout, /dema task/);
  assert.match(stdout, /dema sovereign/);
  assert.match(stdout, /v0\.3\.0/);
});

test("dema sovereign respects DEMA_HOME and fails clearly when scaffold is absent", async () => {
  const fakeHome = await mkdtemp(join(tmpdir(), "dema-sovereign-home-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-sovereign-root-"));
  const result = await execFileAsync("node", [cliPath, "sovereign"], {
    env: { ...process.env, HOME: fakeHome, DEMA_HOME: demaRoot }
  }).catch((e) => e);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /dema sovereign: scaffold not found/);
  assert.ok(result.stderr.includes(demaRoot), "error should point at DEMA_HOME, not HOME");
  assert.doesNotMatch(result.stderr, /can't open file/);
});

test("bin/dema script exists and is executable", async () => {
  const binPath = fileURLToPath(new URL("../bin/dema", import.meta.url));
  const s = await stat(binPath);
  assert.ok(s.isFile(), "bin/dema should be a regular file");
  assert.ok((s.mode & 0o100) !== 0, "bin/dema should be executable by owner");
});
