import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyCovenantError } from "../apps/cli/src/index.js";

// COVENANT-CLI-FAILOPEN-FIX-1A regression suite.
// The covenant CLI used `require("node:fs")` inside an ESM ("type":"module")
// package, so EVERY invocation threw `ReferenceError: require is not defined`,
// which the catch masked as a generic "covenant screen/consent error" + exit 1 —
// a fail-OPEN masquerade: a programming bug looked like a user-input rejection.
// These tests exercise the real CLI path (no test did before) and prove the bug
// is gone and that genuine input failures fail closed with a precise reason.

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const env = { ...process.env, NODE_ENV: "test" };

async function runCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [cliPath, ...args], {
      env,
    });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

function withTempFile(name, contents, fn) {
  const dir = mkdtempSync(join(tmpdir(), "covenant-cli-"));
  const file = join(dir, name);
  writeFileSync(file, contents);
  return Promise.resolve(fn(file)).finally(() =>
    rmSync(dir, { recursive: true, force: true }),
  );
}

test("covenant screen <valid proposal> → exit 0, decision JSON, and NO masked require() error", async () => {
  await withTempFile(
    "proposal.json",
    JSON.stringify({
      project_id: "test-proj",
      team_disclosure: true,
      sector: "agriculture",
      debt_ratio: 0.1,
      impact_evidence: ["receipt-1"],
    }),
    async (file) => {
      const r = await runCli(["covenant", "screen", file, "--json"]);
      // the bug surfaced as exactly this masked error on every invocation
      assert.doesNotMatch(r.stderr, /require is not defined/);
      assert.equal(r.code, 0, `stderr: ${r.stderr}`);
      const decision = JSON.parse(r.stdout);
      assert.equal(decision.schema, "bizra.dema.graduation_decision.v0.1");
      assert.equal(decision.project_id, "test-proj");
    },
  );
});

test("covenant screen <missing file> → fails closed (exit 1) with a precise read reason, not a masked code bug", async () => {
  const r = await runCli([
    "covenant",
    "screen",
    "/no/such/dir/proposal.json",
    "--json",
  ]);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.stderr, /require is not defined/);
  assert.match(r.stderr, /ENOENT|cannot read/i);
});

test("covenant screen <malformed JSON> → fails closed (exit 1) citing invalid JSON", async () => {
  await withTempFile("bad.json", "{ not valid json ", async (file) => {
    const r = await runCli(["covenant", "screen", file, "--json"]);
    assert.equal(r.code, 1);
    assert.doesNotMatch(r.stderr, /require is not defined/);
    assert.match(r.stderr, /invalid_json|invalid JSON/i);
  });
});

test("classifyCovenantError RETHROWS true programming errors (anti-masquerade) and classifies the rest", () => {
  // The load-bearing anti-masquerade mechanism: a code defect (the prior require()
  // ReferenceError class) returns null → caller rethrows → surfaces as top-level
  // "Dema error", never as a covenant input/decision outcome.
  assert.equal(classifyCovenantError(new ReferenceError("require is not defined")), null);
  assert.equal(classifyCovenantError(new TypeError("x is not a function")), null);

  // genuine input failures get a precise, machine-readable reason
  assert.equal(classifyCovenantError({ code: "ENOENT" }).code, "ENOENT");
  assert.equal(classifyCovenantError(new SyntaxError("Unexpected token")).code, "invalid_json");

  // legitimate covenant rejection (plain Error from signReceipt) is preserved, not rethrown
  const rejected = classifyCovenantError(new Error("Cannot sign blocked Covenant decision."));
  assert.equal(rejected.code, "rejected");
  assert.match(rejected.message, /blocked/);
});

test("covenant consent <missing file> → fails closed (exit 1) without the masked require() error", async () => {
  const r = await runCli([
    "covenant",
    "consent",
    "/no/such/dir/decision.json",
    "--typed-go",
    "GO: SIGN COVENANT RECEIPT abc",
    "--json",
  ]);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.stderr, /require is not defined/);
  assert.match(r.stderr, /ENOENT|cannot read/i);
});
