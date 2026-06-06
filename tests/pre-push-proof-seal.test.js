import test from "node:test";
import assert from "node:assert/strict";

import {
  PRE_PUSH_VERDICT,
  PRE_PUSH_PUBLISH_GATES,
  parseUpstreamCounts,
  inspectGitPublishPosture,
  buildPrePushProofSealReport,
} from "../packages/core/src/pre-push-proof-seal.js";

test("parseUpstreamCounts reads rev-list left-right output", () => {
  assert.deepEqual(parseUpstreamCounts("0\t4\n"), { behind: 0, ahead: 4 });
  assert.deepEqual(parseUpstreamCounts("2\t0"), { behind: 2, ahead: 0 });
  assert.equal(parseUpstreamCounts("invalid"), null);
});

test("inspectGitPublishPosture fails closed on dirty tree and behind upstream", async () => {
  const git = await inspectGitPublishPosture({
    fetch: false,
    execGit: async (cmd, args) => {
      if (cmd === "git" && args[0] === "status" && args[1] === "--porcelain") {
        return { stdout: " M package.json\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "rev-parse") {
        return { stdout: "abc123\n", stderr: "" };
      }
      if (cmd === "git" && args[0] === "rev-list") {
        return { stdout: "1\t3\n", stderr: "" };
      }
      throw new Error(`unexpected git: ${cmd} ${args.join(" ")}`);
    },
  });

  assert.equal(git.working_tree_clean, false);
  assert.equal(git.ok, false);
  assert.ok(git.blockers.some((b) => b.code === "working_tree_dirty"));
  assert.ok(git.blockers.some((b) => b.code === "behind_upstream"));
});

test("buildPrePushProofSealReport emits PUSH_READY when git and gates pass", async () => {
  const report = await buildPrePushProofSealReport({
    skip_gates: true,
    git: {
      working_tree_clean: true,
      head: "deadbeef",
      upstream: "origin/main",
      upstream_counts: { behind: 0, ahead: 2 },
      fetch_attempted: false,
      blockers: [],
      ok: true,
    },
  });

  assert.equal(report.verdict, PRE_PUSH_VERDICT.PUSH_READY);
  assert.equal(report.ok, true);
  assert.equal(report.boundary.git_push_performed, false);
  assert.equal(report.boundary.governed_node0_invoked, false);
});

test("buildPrePushProofSealReport fails when a gate fails", async () => {
  const report = await buildPrePushProofSealReport({
    skip_gates: false,
    gates: [
      {
        id: "stub_fail",
        argv: ["node", "-e", "process.exit(1)"],
        exit_only: true,
        timeout_ms: 5000,
      },
    ],
    git: {
      working_tree_clean: true,
      head: "deadbeef",
      upstream: "origin/main",
      upstream_counts: { behind: 0, ahead: 1 },
      fetch_attempted: false,
      blockers: [],
      ok: true,
    },
  });

  assert.equal(report.verdict, PRE_PUSH_VERDICT.GAP_DETECTED);
  assert.equal(report.ok, false);
  assert.ok(report.blockers.some((b) => b.code === "gate_stub_fail_failed"));
});

test("PRE_PUSH_PUBLISH_GATES includes artifact-011 preflight gate before npm check", () => {
  const ids = PRE_PUSH_PUBLISH_GATES.map((g) => g.id);
  const artifactIndex = ids.indexOf("artifact_011_preflight_gate");
  const checkIndex = ids.indexOf("npm_check");
  assert.notEqual(artifactIndex, -1);
  assert.notEqual(checkIndex, -1);
  assert.ok(artifactIndex < checkIndex);
});
