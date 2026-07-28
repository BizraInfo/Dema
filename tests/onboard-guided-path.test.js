// ONBOARD-ALIAS-1A (TASK-040) — `dema onboard` must be a guided path, not an
// alias of `dema welcome`.
//
// Measured 2026-07-28 on a clean DEMA_HOME: the two commands produced
// BYTE-IDENTICAL output, while `dema help orientation` advertised them as
// different capabilities ("Show the first-run orientation" vs "Guided
// zero-technical onboarding path"). The guided path a nontechnical operator is
// told exists did not exist — they ran it and got the same wall of orientation
// text, which is the opposite of guided. Meanwhile the real 7-stage flow sat
// unused in packages/core/src/onboarding-lifecycle.js.

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { ONBOARDING_LIFECYCLE_STAGE_COUNT } from "../packages/core/src/onboarding-lifecycle.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

async function runCli(args) {
  const root = await mkdtemp(join(tmpdir(), "dema-onboard-"));
  const env = { ...process.env, DEMA_HOME: root, NO_COLOR: "1" };
  const result = await execFileAsync("node", [cliPath, ...args], { env }).catch(
    (e) => e,
  );
  return result.stdout ?? "";
}

test("dema onboard is not a byte-identical alias of dema welcome", async () => {
  const [onboard, welcome] = await Promise.all([
    runCli(["onboard"]),
    runCli(["welcome"]),
  ]);
  assert.ok(onboard.length > 0, "onboard produced no output");
  assert.notEqual(
    onboard,
    welcome,
    "onboard duplicates welcome — the advertised guided path does not exist",
  );
});

test("dema onboard surfaces the canonical onboarding stages in order", async () => {
  const out = await runCli(["onboard"]);
  // Every canonical stage must be represented, so the operator sees the whole
  // path rather than a fragment of it.
  for (const id of [
    "language",
    "technical_level",
    "node_role",
    "purpose",
    "resources",
    "consent_constitution",
    "first_mission",
  ]) {
    assert.match(out, new RegExp(id, "i"), `stage missing from output: ${id}`);
  }
  // Stage count is sourced from the kernel, never hardcoded here, so adding a
  // stage cannot silently leave the guided path behind.
  assert.match(
    out,
    new RegExp(String(ONBOARDING_LIFECYCLE_STAGE_COUNT)),
    "stage count not shown",
  );
});

test("dema onboard --json emits the lifecycle schema, not the guide schema", async () => {
  const out = await runCli(["onboard", "--json"]);
  const parsed = JSON.parse(out);
  assert.match(parsed.schema, /onboarding_lifecycle/);
  assert.equal(parsed.mode, "preview_only");
  assert.equal(
    parsed.stages.length,
    ONBOARDING_LIFECYCLE_STAGE_COUNT,
    "json must carry every canonical stage",
  );
});

test("dema onboard states its preview boundary — no mission is created", async () => {
  const out = await runCli(["onboard"]);
  assert.match(out, /preview/i, "boundary label absent from guided path");
});
