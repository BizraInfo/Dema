import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const SAVE_MAP_CONSENT = "GO: save local codebase architecture map";

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
  const root = await mkdtemp(join(tmpdir(), "codebase-map-save-cli-"));
  for (const [relPath, content] of Object.entries(initial)) {
    const abs = join(root, relPath);
    const dir = abs.slice(0, abs.lastIndexOf("/"));
    if (dir && dir !== root) await mkdir(dir, { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

async function makeDemaHome() {
  return mkdtemp(join(tmpdir(), "dema-codebase-save-home-"));
}

// 1. --save-map with valid consent writes
//    $DEMA_HOME/receipts/codebase-map-<64hex>.json
test("'--save-map' with valid consent writes file under $DEMA_HOME/receipts/codebase-map-<hash>.json", async () => {
  const repo = await makeRepo({ "a.js": "export const x = 1;\n" });
  const home = await makeDemaHome();
  const { exitCode } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const files = await readdir(join(home, "receipts"));
  const mapFiles = files.filter(
    (f) => f.startsWith("codebase-map-") && f.endsWith(".json"),
  );
  assert.equal(
    mapFiles.length,
    1,
    `expected 1 codebase-map file; got ${mapFiles.length}: ${files.join(",")}`,
  );
  assert.match(mapFiles[0], /^codebase-map-[a-f0-9]{64}\.json$/);
});

// 2. Missing --save-map-consent exits non-zero and names required phrase.
test("'--save-map' without --save-map-consent exits non-zero and names required phrase", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    ["codebase", "map", repo, "--save-map"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /requires --save-map-consent/);
  assert.match(stderr, /GO: save local codebase architecture map/);
});

// 3. Wrong --save-map-consent exits non-zero with consent mismatch.
test("'--save-map' with wrong consent exits non-zero with consent mismatch", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      "wrong phrase",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /consent phrase mismatch/);
});

// 4. Valid consent: stdout still emits parseable codebase architecture map JSON.
test("with valid consent, stdout still emits parseable codebase architecture map JSON (unchanged behavior)", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stdout } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.schema, "bizra.dema.codebase_architecture_map.v0.1");
  assert.equal(envelope.partial, false);
});

// 5. Valid consent: saved file content matches stdout byte-for-byte, including
//    sha256 filename verification.
test("with valid consent, saved file matches stdout byte-for-byte", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stdout } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const files = await readdir(join(home, "receipts"));
  const mapFile = files.find(
    (f) => f.startsWith("codebase-map-") && f.endsWith(".json"),
  );
  assert.ok(mapFile, "expected codebase-map file");
  const onDisk = await readFile(join(home, "receipts", mapFile), "utf8");
  assert.equal(onDisk, stdout, "on-disk file must match stdout byte-for-byte");
  // Verify content-addressed filename: sha256 of bytes = the hash in the filename.
  const expectedSha = createHash("sha256").update(onDisk).digest("hex");
  assert.equal(mapFile, `codebase-map-${expectedSha}.json`);
});

// 6. Valid consent: stderr contains 'saved codebase map to:' info line.
test("with valid consent, stderr contains 'saved codebase map to:' info line", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stderr } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.match(stderr, /saved codebase map to:/);
  assert.match(stderr, new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// 7. Partial envelope still saved (--max-files 1 on multi-file repo forces partial).
test("partial envelope is STILL saved (auditability for incomplete scans)", async () => {
  const repo = await makeRepo({ "a.js": "", "b.js": "", "c.js": "" });
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--max-files",
      "1",
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  // Partial → non-zero exit per existing codebase-map contract.
  assert.notEqual(exitCode, 0);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.partial, true);
  assert.equal(envelope.error_reason, "file_limit_exceeded");
  // Save still happened.
  const files = await readdir(join(home, "receipts"));
  const mapFile = files.find(
    (f) => f.startsWith("codebase-map-") && f.endsWith(".json"),
  );
  assert.ok(mapFile, "partial envelope must still be saved");
  const onDisk = JSON.parse(
    await readFile(join(home, "receipts", mapFile), "utf8"),
  );
  assert.equal(onDisk.partial, true);
  assert.equal(onDisk.error_reason, "file_limit_exceeded");
});

// 8. No --save-map flag → no codebase-map-*.json file is written.
test("no --save-map flag means no codebase-map-*.json file is written", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { exitCode } = await runCli(["codebase", "map", repo], {
    env: { DEMA_HOME: home },
  });
  assert.equal(exitCode, 0);
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const mapFiles = files.filter((f) => f.startsWith("codebase-map-"));
    assert.equal(
      mapFiles.length,
      0,
      "no codebase-map-* file should exist without --save-map",
    );
  }
});

// 9. --save-map --summary without --json exits non-zero with helpful stderr.
test("'--save-map --summary' without --json exits non-zero", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--summary",
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /--save-map requires JSON output/);
  assert.match(stderr, /cannot combine with --summary/);
});

// 10. --save-map --summary --json saves successfully and stdout is JSON.
test("'--save-map --summary --json' saves successfully with JSON stdout (json wins over summary)", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "codebase",
      "map",
      repo,
      "--summary",
      "--json",
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.equal(exitCode, 0);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.schema, "bizra.dema.codebase_architecture_map.v0.1");
  const files = await readdir(join(home, "receipts"));
  assert.ok(files.some((f) => f.startsWith("codebase-map-")));
});

// 11. Re-running same scan creates distinct files because scanned_at differs.
test("re-running same scan creates distinct files (scanned_at differs)", async () => {
  const repo = await makeRepo({ "a.js": "" });
  const home = await makeDemaHome();
  await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  await new Promise((res) => setTimeout(res, 20));
  await runCli(
    [
      "codebase",
      "map",
      repo,
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  const files = await readdir(join(home, "receipts"));
  const mapFiles = files
    .filter((f) => f.startsWith("codebase-map-") && f.endsWith(".json"))
    .sort();
  assert.equal(
    mapFiles.length,
    2,
    `expected 2 distinct files; got ${mapFiles.length}`,
  );
  assert.notEqual(mapFiles[0], mapFiles[1]);
  for (const f of mapFiles) {
    const onDisk = await readFile(join(home, "receipts", f), "utf8");
    const sha = createHash("sha256").update(onDisk).digest("hex");
    assert.equal(f, `codebase-map-${sha}.json`);
  }
});

// 12. Bonus: input-validation failure before envelope build does NOT save
//     (relative path rejected at CLI layer before buildCodebaseArchitectureMap
//     is called → save attempt never reached → no file).
test("input-validation failure before build does NOT save (relative path)", async () => {
  const home = await makeDemaHome();
  const { stderr, exitCode } = await runCli(
    [
      "codebase",
      "map",
      "relative/path",
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /must be absolute/);
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const mapFiles = files.filter((f) => f.startsWith("codebase-map-"));
    assert.equal(
      mapFiles.length,
      0,
      "no save should happen if envelope was never built",
    );
  }
});

// 13. error_reason envelope from buildCodebaseArchitectureMap is saved (e.g.
//     path_not_found returns a shaped failure envelope — that envelope SHOULD
//     be saved when --save-map is set).
test("error_reason envelope (path_not_found) IS saved when --save-map is set", async () => {
  const home = await makeDemaHome();
  const { stdout, exitCode } = await runCli(
    [
      "codebase",
      "map",
      "/tmp/dema-codebase-save-nonexistent-zzz-12345",
      "--save-map",
      "--save-map-consent",
      SAVE_MAP_CONSENT,
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.error_reason, "path_not_found");
  const files = await readdir(join(home, "receipts"));
  const mapFile = files.find(
    (f) => f.startsWith("codebase-map-") && f.endsWith(".json"),
  );
  assert.ok(mapFile, "error_reason envelope must still be saved for audit");
});
