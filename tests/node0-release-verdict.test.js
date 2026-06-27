import test from "node:test";
import assert from "node:assert/strict";

import {
  computeReleaseVerdict,
  computeNextAction,
  verifyReleaseVerdict,
  RELEASE_VERDICT_OVERCLAIM,
  RELEASE_VERDICT_ALLOWED,
  NODE0_RELEASE_VERDICT_SCHEMA,
  NODE0_RELEASE_VERDICT_TRUTH_LABEL,
} from "../packages/core/src/node0-release-verdict.js";
import { HERMETIC_CONTROL_PLANE_FIXTURE } from "../packages/core/src/node0-proof-of-truth-control-plane.js";

const passInput = {
  checks: HERMETIC_CONTROL_PLANE_FIXTURE.checks,
  workflows: HERMETIC_CONTROL_PLANE_FIXTURE.workflows,
  coverage: HERMETIC_CONTROL_PLANE_FIXTURE.coverage,
  perf: HERMETIC_CONTROL_PLANE_FIXTURE.perf,
  claims: [],
  boundaries: HERMETIC_CONTROL_PLANE_FIXTURE.boundaries,
  release_mode: false,
};

test("RV-01: hermetic fixture yields READY_LOCAL", () => {
  assert.equal(computeReleaseVerdict(passInput), "READY_LOCAL");
});

test("RV-02: verifyReleaseVerdict accepts READY_LOCAL and BLOCKED only", () => {
  assert.equal(verifyReleaseVerdict("READY_LOCAL").ok, true);
  assert.equal(verifyReleaseVerdict("BLOCKED").ok, true);
  for (const overclaim of RELEASE_VERDICT_OVERCLAIM) {
    const verified = verifyReleaseVerdict(overclaim);
    assert.equal(verified.ok, false);
    assert.ok(verified.blocked_by.includes("overclaim_verdict"));
  }
  assert.equal(verifyReleaseVerdict("MYSTERY").ok, false);
  assert.ok(verifyReleaseVerdict("MYSTERY").blocked_by.includes("verdict_not_allowed"));
});

test("RV-03: overclaim verdict in checks forces BLOCKED", () => {
  const verdict = computeReleaseVerdict({
    ...passInput,
    checks: { ...passInput.checks, release_verdict: "READY_REMOTE" },
  });
  assert.equal(verdict, "BLOCKED");
});

test("RV-04: release_mode blocks on unknown CodeQL", () => {
  const verdict = computeReleaseVerdict({
    ...passInput,
    workflows: { ...passInput.workflows, codeql: "UNKNOWN" },
    release_mode: true,
  });
  assert.equal(verdict, "BLOCKED");
});

test("RV-05: missing coverage or perf rails block verdict", () => {
  assert.equal(
    computeReleaseVerdict({ ...passInput, coverage: { present: false } }),
    "BLOCKED",
  );
  assert.equal(computeReleaseVerdict({ ...passInput, perf: { present: false } }), "BLOCKED");
});

test("RV-06: computeNextAction guides operator on READY_LOCAL with pending CI seal", () => {
  const action = computeNextAction("READY_LOCAL", {
    workflows: { ci_remote_seal: "PENDING" },
  });
  assert.match(action, /remote CI seal/i);
});

test("RV-07: schema and truth label are stable", () => {
  assert.equal(NODE0_RELEASE_VERDICT_SCHEMA, "bizra.dema.node0_release_verdict.v0.1");
  assert.equal(NODE0_RELEASE_VERDICT_TRUTH_LABEL, "NODE0_RELEASE_VERDICT_LOCAL_ONLY");
  assert.deepEqual(RELEASE_VERDICT_ALLOWED, ["BLOCKED", "READY_LOCAL"]);
});

test("RV-08: review gate script passes hermetic check", async () => {
  const { runNode0ReleaseVerdictCheck } = await import(
    "../scripts/review/node0-release-verdict-check.mjs"
  );
  const result = runNode0ReleaseVerdictCheck();
  assert.equal(result.ok, true);
  assert.equal(result.verdict, "READY_LOCAL");
});
