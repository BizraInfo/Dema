import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  assessArtifact011CeremonyPreflight,
  ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA,
  runArtifact011CeremonyPreflight,
} from "../packages/mission/src/artifact-011-ceremony-preflight.js";
import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "../packages/core/src/diagnostic-consent.js";
import { runArtifact011PreflightScript } from "../scripts/artifact-011-ceremony-preflight.mjs";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const SCRIPT = fileURLToPath(
  new URL("../scripts/artifact-011-ceremony-preflight.mjs", import.meta.url),
);

function okStep(parsed) {
  return { ok: true, exitCode: 0, parsed, reason: null };
}

test("assess blocks when mission propose would execute", () => {
  const home = "/tmp/example";
  const report = assessArtifact011CeremonyPreflight({
    demaHome: home,
    setup: okStep({ schema: "bizra.dema.setup.v0.1", created: true }),
    setupCheck: okStep({
      schema: "bizra.dema.setup_check.v0.1",
      verdict: "INTACT",
    }),
    status: okStep({ activationGate: "EXPLICIT_GO_REQUIRED" }),
    doctor: okStep({
      schema: "bizra.dema.doctor_dashboard.v0.1",
      predicates: [{ key: "daemonStatus", value: "stopped" }],
    }),
    proposeNoConsent: okStep({
      schema: "bizra.dema.mission_preview.v0.1",
      executes: false,
      consent: { accepted: false },
    }),
    proposeWithConsent: okStep({
      schema: "bizra.dema.mission_preview.v0.1",
      executes: true,
      consent: { accepted: true },
      proposal: { expectedArtifact: "ARTIFACT-011" },
    }),
  });

  assert.equal(report.truth_label, "GAP_DETECTED");
  assert.equal(report.cleared_for_preview_ceremony, false);
  assert.equal(report.cleared_for_runtime_ceremony, false);
  assert.equal(report.boundary.artifact_011_measured, false);
  assert.ok(
    report.blockers.some(
      (b) => b.code === "propose_with_consent_executes_true",
    ),
  );
});

test("isolated preflight CLI clears preview ceremony on fresh home", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [SCRIPT, "--isolated", "--json"],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      timeout: 60000,
    },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.schema, ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA);
  assert.equal(report.consent_phrase, BOUNDED_DIAGNOSTIC_CONSENT_PHRASE);
  assert.equal(report.cleared_for_runtime_ceremony, false);
  assert.equal(report.boundary.dema_mission_executes, false);
  assert.equal(report.steps.propose_no_consent.ok, true);
  assert.equal(report.steps.propose_with_consent.ok, true);
  assert.equal(report.truth_label, "PREPARED");
  assert.equal(report.cleared_for_preview_ceremony, true);
});

test("runArtifact011CeremonyPreflight on persistent temp home", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-art011-preflight-"));
  try {
    const report = await runArtifact011CeremonyPreflight({
      demaHome: home,
      cliPath: CLI,
      execFileFn: execFileAsync,
      gitCommit: "test-commit",
    });
    assert.equal(report.schema, ARTIFACT_011_CEREMONY_PREFLIGHT_SCHEMA);
    assert.equal(report.dema_home, home);
    assert.equal(report.cleared_for_preview_ceremony, true);
    assert.equal(report.steps.setup.ok, true);
    assert.equal(report.steps.setup_check.ok, true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("runArtifact011PreflightScript accepts injected home", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-art011-script-"));
  try {
    const report = await runArtifact011PreflightScript({
      home,
      gitCommit: null,
    });
    assert.equal(report.cleared_for_preview_ceremony, true);
    assert.equal(report.recommended_next.includes("steps e–h"), true);
    assert.equal(report.operator_runtime_ready, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
