import test from "node:test";
import assert from "node:assert/strict";

import {
  PRE_PUSH_PROOF_SEAL_SCHEMA,
  PRE_PUSH_VERDICT,
  PRE_PUSH_PUBLISH_GATES,
  parseUpstreamCounts,
  inspectGitPublishPosture,
  buildPrePushProofSealReport,
} from "../packages/core/src/pre-push-proof-seal.js";

/**
 * PPN — pre-push posture nullity.
 *
 * `porcelain` was seeded with the empty string, so a throwing `git status`
 * left it "" and `porcelain.length === 0` published working_tree_clean:true
 * from a measurement that never ran. The composite verdict still failed
 * closed via the git_status_failed blocker, so this was never a PUSH_READY
 * bypass — but a fail-closed verdict does not license a false field, and the
 * operator CLI printed the word "clean" straight off it.
 *
 *   NEGATIVE_FACT = SUCCESSFUL_MEASUREMENT + NEGATIVE_RESULT
 *   FAILED_MEASUREMENT -> UNMEASURED, never CLEAN, and never DIRTY either.
 */
function stubGit({ status }) {
  return async (cmd, args) => {
    if (cmd === "git" && args[0] === "status") {
      if (status instanceof Error) throw status;
      return { stdout: status, stderr: "" };
    }
    if (cmd === "git" && args[0] === "rev-parse") {
      return { stdout: "abc123\n", stderr: "" };
    }
    if (cmd === "git" && args[0] === "rev-list") {
      return { stdout: "0\t1\n", stderr: "" };
    }
    throw new Error(`unexpected git: ${cmd} ${args.join(" ")}`);
  };
}

test("PPN-01: a throwing git status is UNMEASURED and can never read CLEAN", async () => {
  const git = await inspectGitPublishPosture({
    fetch: false,
    execGit: stubGit({
      status: new Error("fatal: Unable to create '.git/index.lock': File exists."),
    }),
  });

  assert.notEqual(git.working_tree_clean, true);
  assert.equal(git.working_tree_status, "UNMEASURED");
  assert.ok(git.blockers.some((b) => b.code === "git_status_failed"));
  // An unmeasured tree is not a dirty tree: claiming uncommitted changes we
  // never observed would be its own invented fact.
  assert.ok(!git.blockers.some((b) => b.code === "working_tree_dirty"));
  assert.equal(git.ok, false);
});

test("PPN-02: the composite verdict stays GAP_DETECTED when the tree is UNMEASURED", async () => {
  const report = await buildPrePushProofSealReport({
    skip_gates: true,
    git: await inspectGitPublishPosture({
      fetch: false,
      execGit: stubGit({ status: new Error("fatal: unable to read index") }),
    }),
  });

  assert.equal(report.verdict, PRE_PUSH_VERDICT.GAP_DETECTED);
  assert.equal(report.ok, false);
  assert.equal(report.git.working_tree_status, "UNMEASURED");
});

// Non-vacuity control. Without this, hard-coding working_tree_clean to false
// would satisfy PPN-01 and prove nothing at all.
test("PPN-03: a genuinely empty porcelain still reads CLEAN", async () => {
  const git = await inspectGitPublishPosture({
    fetch: false,
    execGit: stubGit({ status: "" }),
  });

  assert.equal(git.working_tree_status, "CLEAN");
  assert.equal(git.working_tree_clean, true);
  assert.ok(!git.blockers.some((b) => b.code === "git_status_failed"));
  assert.equal(git.ok, true);
});

// Discrimination control: UNMEASURED and DIRTY must not collapse together.
test("PPN-04: a measured non-empty porcelain reads DIRTY, not UNMEASURED", async () => {
  const git = await inspectGitPublishPosture({
    fetch: false,
    execGit: stubGit({
      status: "D  packages/core/src/mission-supervisor.js\n",
    }),
  });

  assert.equal(git.working_tree_status, "DIRTY");
  assert.equal(git.working_tree_clean, false);
  assert.ok(git.blockers.some((b) => b.code === "working_tree_dirty"));
});

test("PPN-05: the emitted artifact carries the v0.2 schema", async () => {
  assert.equal(
    PRE_PUSH_PROOF_SEAL_SCHEMA,
    "bizra.dema.pre_push_proof_seal.v0.2",
  );
  const report = await buildPrePushProofSealReport({
    skip_gates: true,
    git: await inspectGitPublishPosture({
      fetch: false,
      execGit: stubGit({ status: "" }),
    }),
  });
  assert.equal(report.schema, "bizra.dema.pre_push_proof_seal.v0.2");
});

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
