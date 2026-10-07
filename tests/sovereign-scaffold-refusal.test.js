// SOVEREIGN-CMD-SCAFFOLD-GAP (TASK-037) — a listed command must never
// dead-end a fresh operator.
//
// Measured 2026-07-28: `dema help tasks` advertises `dema sovereign` as
// "Render local Sovereign Mission Interface (view-only)", but on a clean
// DEMA_HOME created by `dema setup` it exited 1 with only:
//
//   dema sovereign: scaffold not found: $DEMA_HOME/kernel/sovereign_tui/sovereign.py
//
// `dema setup` never creates that path and no help text says where the Python
// scaffold comes from, so a command in the primary help surface could not
// succeed for anyone who followed the documented first run. The refusal itself
// was honest — clear message, nonzero exit, no false claim — so this closes the
// discoverability gap, not the exit code: refusing well means naming the
// prerequisite and the next action, the way `dema node0 activation observe`
// already does for the sovereign runtime.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function runSovereign(extraArgs = []) {
  const root = await mkdtemp(join(tmpdir(), "dema-sovereign-"));
  const env = { ...process.env, DEMA_HOME: root, NO_COLOR: "1" };
  const result = await execFileAsync("node", [
    cliPath,
    "sovereign",
    ...extraArgs,
  ], { env }).catch((e) => e);
  return {
    code: result.code ?? 0,
    text: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

test("dema sovereign still refuses (nonzero) when the scaffold is absent", async () => {
  const { code } = await runSovereign();
  assert.notEqual(code, 0, "an unavailable surface must not report success");
});

test("dema sovereign refusal names the prerequisite, not just a missing path", async () => {
  const { text } = await runSovereign();
  // The operator must learn WHAT is missing and that it is not part of this
  // repo — a bare absolute path teaches neither.
  assert.match(text, /sovereign_tui/, "expected path still shown");
  assert.match(
    text,
    /python/i,
    "refusal must say the scaffold is a Python component",
  );
  assert.match(
    text,
    /not part of this repo|outside this repo|separate repo|not shipped/i,
    "refusal must state the scaffold lives outside this repository",
  );
});

test("dema sovereign refusal gives an actionable next step", async () => {
  const { text } = await runSovereign();
  assert.match(
    text,
    /dema (node0 activation observe|status|help sovereign)/,
    "refusal must route the operator to a command that does work",
  );
});

test("dema sovereign --json emits a schema-tagged refusal", async () => {
  const { text } = await runSovereign(["--json"]);
  const start = text.indexOf("{");
  assert.ok(start >= 0, `no JSON object in output: ${text.slice(0, 120)}`);
  const parsed = JSON.parse(text.slice(start));
  assert.match(parsed.schema, /sovereign/);
  assert.equal(parsed.available, false);
  assert.ok(
    typeof parsed.reason === "string" && parsed.reason.length > 0,
    "machine-readable reason code required",
  );
  assert.equal(parsed.boundary.runtime_execution_performed, false);
});
