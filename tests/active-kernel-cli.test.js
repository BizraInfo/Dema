import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));

async function packageVersion() {
  return JSON.parse(await readFile(packagePath, "utf8")).version;
}

async function makeFixtureDownloads() {
  const downloadsRoot = await mkdtemp(
    join(tmpdir(), "dema-fixture-downloads-"),
  );
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
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "task", "downloads.audit.preview"],
    {
      env: {
        ...process.env,
        DEMA_DOWNLOADS_ROOT: downloadsRoot,
        DEMA_HOME: demaRoot,
      },
    },
  );
  assert.match(stdout, /Task:\s+downloads\.audit\.preview/);
  assert.match(stdout, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
  assert.match(stdout, /✓ scope_declared_read_only/);
  const receiptsDir = join(demaRoot, "receipts");
  const files = await readdir(receiptsDir);
  assert.ok(files.find((f) => f.includes("downloads.audit.preview")));
});

test("dema bare invocation (no args · non-TTY) emits first-look companion JSON", async () => {
  const { demaRoot } = await makeFixtureDownloads();
  const { stdout } = await execFileAsync("node", [cliPath], {
    env: {
      ...process.env,
      DEMA_HOME: demaRoot,
      DEMA_NODE0_ADAPTER: "",
    },
  });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.first_look_home.v1");
  assert.equal(parsed.mode, "preview_only");
  assert.equal(parsed.boundary.runtime_execution_performed, false);
});

// `dema help` (no args) now emits the topic-based root per the hierarchical
// help system (Task #6). Full flat list is preserved at `dema help --all`.
test("dema help (no args) emits hierarchical topic root after active-kernel refactor", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help"]);
  assert.match(stdout, /Available topics:/);
  assert.match(stdout, /orientation/);
  assert.match(stdout, /readiness/);
  assert.match(stdout, /dema help <topic>/);
  assert.match(stdout, /dema help --all/);
});

test("dema help --all still emits the full flat HELP list", async () => {
  const expectedVersion = await packageVersion();
  const { stdout } = await execFileAsync("node", [cliPath, "help", "--all"]);
  assert.match(stdout, /Dema CLI/);
  assert.match(stdout, /Orientation:/);
  assert.match(stdout, /dema onboard/);
  assert.match(stdout, /dema task/);
  assert.match(stdout, /dema sovereign/);
  assert.match(
    stdout,
    new RegExp(`Dema v${expectedVersion.replaceAll(".", "\\.")}`),
  );
  assert.doesNotMatch(stdout, /Dema v0\.3\.0/);
});

test("dema sovereign respects DEMA_HOME and fails clearly when scaffold is absent", async () => {
  const fakeHome = await mkdtemp(join(tmpdir(), "dema-sovereign-home-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-sovereign-root-"));
  const result = await execFileAsync("node", [cliPath, "sovereign"], {
    env: { ...process.env, HOME: fakeHome, DEMA_HOME: demaRoot },
  }).catch((e) => e);

  // SOVEREIGN-CMD-SCAFFOLD-GAP (TASK-037) reworded this refusal from the bare
  // "scaffold not found: <path>" to one that names the prerequisite and a next
  // step. Every original assertion here is preserved in intent — nonzero exit,
  // points at DEMA_HOME rather than HOME, no raw Python traceback — only the
  // matched wording changed. Full refusal contract lives in
  // tests/sovereign-scaffold-refusal.test.js.
  assert.equal(result.code, 1);
  assert.match(result.stderr, /dema sovereign: unavailable/);
  assert.ok(
    result.stderr.includes(demaRoot),
    "error should point at DEMA_HOME, not HOME",
  );
  assert.doesNotMatch(result.stderr, /can't open file/);
});

test("bin/dema script exists and is executable", async () => {
  const binPath = fileURLToPath(new URL("../bin/dema", import.meta.url));
  const s = await stat(binPath);
  assert.ok(s.isFile(), "bin/dema should be a regular file");
  assert.ok((s.mode & 0o100) !== 0, "bin/dema should be executable by owner");
});
