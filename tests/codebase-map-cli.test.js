import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runCli(args, { env = {}, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "node",
      [cliPath, ...args],
      {
        env: {
          ...process.env,
          DEMA_BANNER_INTERACTIVE: "0",
          NODE_ENV: "test",
          ...env,
        },
        timeout,
        maxBuffer: 16 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(
            new Error(
              `Process timed out. stdout=${stdout.slice(0, 500)} stderr=${stderr.slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve({ stdout, stderr, exitCode: err?.code ?? 0 });
      },
    );
  });
}

async function makeRepo(initial = {}) {
  const root = await mkdtemp(join(tmpdir(), "codebase-map-cli-"));
  for (const [relPath, content] of Object.entries(initial)) {
    const abs = join(root, relPath);
    const dir = abs.slice(0, abs.lastIndexOf("/"));
    if (dir && dir !== root) await mkdir(dir, { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

// 1. Relative path → non-zero exit + "must be absolute"
test("relative path exits non-zero with 'must be absolute' stderr", async () => {
  const { stderr, exitCode } = await runCli([
    "codebase",
    "map",
    "relative/path",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /must be absolute/);
});

// 2. Missing subcommand
test("missing 'map' subcommand prints Usage and exits non-zero", async () => {
  const { stderr, exitCode } = await runCli(["codebase"]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /Usage: dema codebase map/);
});

// 3. Missing <abs-path>
test("missing <abs-path> after 'map' exits non-zero", async () => {
  const { stderr, exitCode } = await runCli(["codebase", "map"]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /<abs-path> is required/);
});

// 4. Nonexistent absolute path
test("nonexistent absolute path exits non-zero with 'path_not_found' stderr", async () => {
  const { stderr, exitCode } = await runCli([
    "codebase",
    "map",
    "/tmp/dema-codebase-cli-nonexistent-zzz-12345",
  ]);
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /path_not_found/);
});

// 5. Valid absolute path emits parseable JSON with correct schema.
test("valid absolute path emits parseable JSON envelope with canonical schema", async () => {
  const repo = await makeRepo({
    "a.js": "export const x = 1;\n",
    "README.md": "# t\n",
  });
  const { stdout, exitCode } = await runCli(["codebase", "map", repo]);
  assert.equal(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.schema, "bizra.dema.codebase_architecture_map.v0.1");
  assert.equal(env.partial, false);
  assert.ok(env.totals.file_count >= 2);
  assert.ok(env.boundary.runtime === true);
  assert.ok(env.boundary.network_used === false);
});

// 6. --summary emits human-readable text (not JSON).
test("--summary emits compact human summary instead of JSON", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const { stdout, exitCode } = await runCli([
    "codebase",
    "map",
    repo,
    "--summary",
  ]);
  assert.equal(exitCode, 0);
  assert.match(stdout, /^Codebase map ·/m);
  assert.match(stdout, /Files: 1/);
  // Not JSON
  assert.throws(() => JSON.parse(stdout));
});

// 7. --max-files 1 on multi-file repo → partial=true + exit non-zero.
test("--max-files 1 on multi-file repo emits partial=true + exit non-zero", async () => {
  const repo = await makeRepo({ "a.js": "", "b.js": "", "c.js": "" });
  const { stdout, exitCode } = await runCli([
    "codebase",
    "map",
    repo,
    "--max-files",
    "1",
  ]);
  assert.notEqual(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.partial, true);
  assert.equal(env.error_reason, "file_limit_exceeded");
});

// 8. --include-tests includes test files in files[].
test("--include-tests includes *.test.* files in the files[] array", async () => {
  const repo = await makeRepo({
    "src/a.js": "",
    "src/a.test.js": "test('x', () => {});\n",
  });
  const without = await runCli(["codebase", "map", repo]);
  const wEnv = JSON.parse(without.stdout);
  assert.ok(!wEnv.files.some((f) => f.path === "src/a.test.js"));
  const withTests = await runCli(["codebase", "map", repo, "--include-tests"]);
  const wtEnv = JSON.parse(withTests.stdout);
  assert.ok(wtEnv.files.some((f) => f.path === "src/a.test.js"));
});

// 9. --hotspots on a 600-LOC fixture emits hotspot record.
test("--hotspots emits hotspots[] for a >500 LOC fixture", async () => {
  let big = "";
  for (let i = 0; i < 600; i++) big += `// line ${i}\n`;
  const repo = await makeRepo({ "big.js": big });
  const off = await runCli(["codebase", "map", repo]);
  const offEnv = JSON.parse(off.stdout);
  assert.equal(offEnv.hotspots.length, 0);
  const on = await runCli(["codebase", "map", repo, "--hotspots"]);
  const onEnv = JSON.parse(on.stdout);
  assert.ok(onEnv.hotspots.length >= 1);
  const bigHotspot = onEnv.hotspots.find((h) => h.path === "big.js");
  assert.ok(bigHotspot, "expected hotspot for big.js");
  assert.ok(bigHotspot.reasons.includes("file_exceeds_500_LOC"));
});

// 10. --exclude PAT respects custom directory exclusion.
test("--exclude PAT skips a directory not in the default exclusion set", async () => {
  const repo = await makeRepo({
    "src/a.js": "",
    "experiments/draft.js": "",
  });
  const without = await runCli(["codebase", "map", repo]);
  const wEnv = JSON.parse(without.stdout);
  assert.ok(wEnv.files.some((f) => f.path === "experiments/draft.js"));
  const withExcl = await runCli([
    "codebase",
    "map",
    repo,
    "--exclude",
    "experiments",
  ]);
  const eEnv = JSON.parse(withExcl.stdout);
  assert.ok(!eEnv.files.some((f) => f.path === "experiments/draft.js"));
});

// 11. Self-scan against the Dema repo root: exits 0 + non-empty files[] + parseable.
test("self-scan against the Dema repo root exits 0 with non-empty files[]", async () => {
  const { stdout, exitCode } = await runCli(["codebase", "map", repoRoot]);
  assert.equal(exitCode, 0);
  const env = JSON.parse(stdout);
  assert.equal(env.schema, "bizra.dema.codebase_architecture_map.v0.1");
  assert.ok(
    env.totals.file_count > 100,
    `expected >100 files in self-scan; got ${env.totals.file_count}`,
  );
  assert.ok(
    env.packages.some(
      (p) => p.path === "." || p.manifests.some((m) => m === "package.json"),
    ),
  );
  // Domain boundary intact
  assert.equal(env.boundary.network_used, false);
  assert.equal(env.boundary.mutation, false);
  assert.equal(env.boundary.secret_files_skipped, true);
});
