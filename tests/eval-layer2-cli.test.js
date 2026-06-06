// Eval Layer 2 · CLI subprocess tests v0.1
//
// Locks: `dema eval layer2 prompts` exits 0 + emits the rubric pack envelope;
// `dema eval layer2 verify <good>` exits 0; `dema eval layer2 verify <bad>`
// exits 1; missing path / non-absolute path → exit 1 with helpful message;
// the prompts stdout JSON passes the Layer 1 artifact-safety scanner with
// verdict PUBLIC_SAFE (no leakage, no overclaim).

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateArtifactSafety } from "../packages/core/src/artifact-safety-eval.js";

const execFileAsync = promisify(execFile);
const indexPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

const CLI_ENV = { DEMA_NO_TUI: "1", NODE_ENV: "test", NO_COLOR: "1" };

const VALID_VERDICT = {
  schema: "bizra.dema.eval_layer2_judge_verdict.v0.1",
  rubric_id: "actionability",
  judged_artifact_sha256: "b".repeat(64),
  score: 1,
  evidence_excerpt: "the output proposed a next move with the typed GO",
  judge_origin: "external_paste_back",
  judged_at: "2026-05-23T12:34:56.000Z",
};

test("`dema eval layer2 prompts --json` exits 0 + emits rubric pack envelope", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "eval", "layer2", "prompts", "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, ...CLI_ENV },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.eval_layer2_rubric_pack.v0.1");
  assert.equal(parsed.version, "v0.1");
  assert.equal(parsed.rubrics.length, 3);
  const ids = parsed.rubrics.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "actionability",
    "boundary_compliance",
    "truthfulness",
  ]);
});

test("`dema eval layer2 prompts` (plain) renders the human report", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "eval", "layer2", "prompts"],
    {
      encoding: "utf8",
      env: { ...process.env, ...CLI_ENV },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.match(stdout, /Eval Layer 2 · Rubric Pack v0\.1/);
  assert.match(stdout, /\[truthfulness\]/);
  assert.match(stdout, /\[actionability\]/);
  assert.match(stdout, /\[boundary_compliance\]/);
  assert.match(stdout, /Non-goals for v0\.1:/);
});

test("`dema eval layer2 verify <good>` exits 0 and reports MEASURED", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-l2-good-"));
  const path = join(dir, "verdict.json");
  await writeFile(path, JSON.stringify(VALID_VERDICT), "utf8");
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "eval", "layer2", "verify", path, "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, ...CLI_ENV },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.schema, "bizra.dema.eval_layer2_verdict_validator.v0.1");
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.equal(parsed.truth_label, "MEASURED");
});

test("`dema eval layer2 verify <bad>` exits 1 on validation failure", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-l2-bad-"));
  const path = join(dir, "verdict.json");
  const broken = { ...VALID_VERDICT, score: 9, evidence_excerpt: " " };
  await writeFile(path, JSON.stringify(broken), "utf8");
  await assert.rejects(
    () =>
      execFileAsync(
        "node",
        [indexPath, "eval", "layer2", "verify", path, "--json"],
        {
          encoding: "utf8",
          env: { ...process.env, ...CLI_ENV },
          maxBuffer: 8 * 1024 * 1024,
        },
      ),
    (err) => {
      assert.equal(err.code, 1);
      const parsed = JSON.parse(err.stdout);
      assert.equal(parsed.ok, false);
      assert.notEqual(parsed.truth_label, "MEASURED");
      return true;
    },
  );
});

test("`dema eval layer2 verify` without path → exit 1 with helpful message", async () => {
  await assert.rejects(
    () =>
      execFileAsync("node", [indexPath, "eval", "layer2", "verify"], {
        encoding: "utf8",
        env: { ...process.env, ...CLI_ENV },
        maxBuffer: 4 * 1024 * 1024,
      }),
    (err) => {
      assert.equal(err.code, 1);
      const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      assert.match(combined, /Missing <abs-path>/);
      return true;
    },
  );
});

test("`dema eval layer2 verify` with relative path → exit 1 with absolute-path message", async () => {
  await assert.rejects(
    () =>
      execFileAsync(
        "node",
        [indexPath, "eval", "layer2", "verify", "relative/verdict.json"],
        {
          encoding: "utf8",
          env: { ...process.env, ...CLI_ENV },
          maxBuffer: 4 * 1024 * 1024,
        },
      ),
    (err) => {
      assert.equal(err.code, 1);
      const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      assert.match(combined, /absolute path/);
      return true;
    },
  );
});

test("`dema eval layer2 verify` on missing file → exit 1 with read-error message", async () => {
  await assert.rejects(
    () =>
      execFileAsync(
        "node",
        [
          indexPath,
          "eval",
          "layer2",
          "verify",
          "/nonexistent/path/to/verdict.json",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, ...CLI_ENV },
          maxBuffer: 4 * 1024 * 1024,
        },
      ),
    (err) => {
      assert.equal(err.code, 1);
      const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      assert.match(combined, /Failed to read or parse verdict file/);
      return true;
    },
  );
});

test("`dema eval` (no subcommand) → exit 1 with usage hint", async () => {
  await assert.rejects(
    () =>
      execFileAsync("node", [indexPath, "eval"], {
        encoding: "utf8",
        env: { ...process.env, ...CLI_ENV },
        maxBuffer: 4 * 1024 * 1024,
      }),
    (err) => {
      assert.equal(err.code, 1);
      const combined = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      assert.match(combined, /Unknown eval command/);
      return true;
    },
  );
});

test("`dema eval layer2 prompts --json` stdout passes Layer 1 PUBLIC_SAFE", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [indexPath, "eval", "layer2", "prompts", "--json"],
    {
      encoding: "utf8",
      env: { ...process.env, ...CLI_ENV },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(stdout);
  const verdict = evaluateArtifactSafety(parsed);
  assert.equal(
    verdict.verdict,
    "PUBLIC_SAFE",
    `expected PUBLIC_SAFE; got ${verdict.verdict} with findings ${JSON.stringify(verdict.findings)}`,
  );
  assert.equal(verdict.score, 1);
});
