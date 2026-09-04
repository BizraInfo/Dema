// Pre-push proof seal — publish-pipeline orchestrator (PMBOK / CI/CD alignment).
// Read-only: validates local gates + git posture; does NOT push or invoke runtime.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  commandLine,
  evaluateGateOk,
  evaluateProofRoomWrite,
  runProofRoomGate,
} from "./proof-room-bundle.js";

export const PRE_PUSH_PROOF_SEAL_SCHEMA = "bizra.dema.pre_push_proof_seal.v0.1";

export const PRE_PUSH_VERDICT = Object.freeze({
  PUSH_READY: "PUSH_READY",
  GAP_DETECTED: "GAP_DETECTED",
});

/** Gates required before `git push origin main` (check subsumes test/coverage/perf). */
export const PRE_PUSH_PUBLISH_GATES = Object.freeze([
  {
    id: "git_diff_check",
    argv: ["git", "diff", "--check"],
    exit_only: true,
    timeout_ms: 30_000,
  },
  // Runs early and fails closed: a leaked credential should stop the push before
  // the slow gates spend minutes on it. `npm run check` has no gitleaks — its only
  // secret gate applies the repo's narrow secret-pattern.js to `.claude/` config —
  // so without this the CI `scan` job was the first thing to see a leak, after the
  // push. The script parses gitleaks' pinned version, checksum and flags out of the
  // workflow, so this gate cannot drift from CI. First run needs network; the
  // verified binary is then cached, so later runs work offline. `--skip-gates`
  // remains the explicit, visible override.
  {
    id: "scan_secrets",
    argv: ["npm", "run", "scan:secrets"],
    exit_only: true,
    timeout_ms: 180_000,
  },
  {
    id: "artifact_011_preflight_gate",
    argv: ["node", "scripts/review/artifact-011-preflight-gate.mjs"],
    exit_only: true,
    timeout_ms: 180_000,
  },
  {
    id: "npm_check",
    argv: ["npm", "run", "check"],
    exit_only: true,
    timeout_ms: 900_000,
  },
  {
    id: "release_readiness",
    argv: [
      "node",
      "scripts/release-readiness.mjs",
      "--json",
      "--ci-workflow-changes-authorized",
    ],
    readiness_min_score: 100,
    timeout_ms: 120_000,
  },
]);

const BOUNDARY = buildPreviewBoundary();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * @param {string} stdout
 * @returns {{ behind: number, ahead: number } | null}
 */
export function parseUpstreamCounts(stdout) {
  const line = (stdout ?? "").trim().split("\n").pop() ?? "";
  const match = line.match(/^(\d+)\s+(\d+)/);
  if (!match) return null;
  return { behind: Number(match[1]), ahead: Number(match[2]) };
}

/**
 * @param {object} opts
 * @param {string} [opts.root]
 * @param {boolean} [opts.fetch]
 * @param {string} [opts.upstream="origin/main"]
 * @param {(cmd: string, args: string[]) => Promise<{stdout:string,stderr:string}>} [opts.execGit]
 */
export async function inspectGitPublishPosture({
  root = process.cwd(),
  fetch = false,
  upstream = "origin/main",
  execGit = null,
} = {}) {
  const runGit =
    execGit ??
    (async (cmd, args) => {
      const { promisify } = await import("node:util");
      const { execFile } = await import("node:child_process");
      const execFileAsync = promisify(execFile);
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
      });
      return { stdout: stdout ?? "", stderr: stderr ?? "" };
    });

  /** @type {Array<{code:string,message:string}>} */
  const blockers = [];

  if (fetch) {
    try {
      await runGit("git", ["fetch", "origin", "main"]);
    } catch (err) {
      blockers.push({
        code: "git_fetch_failed",
        message: err.message?.split("\n")[0] ?? "git fetch origin main failed.",
      });
    }
  }

  let porcelain = "";
  try {
    const { stdout } = await runGit("git", ["status", "--porcelain"]);
    porcelain = stdout.trim();
  } catch (err) {
    blockers.push({
      code: "git_status_failed",
      message: err.message?.split("\n")[0] ?? "git status failed.",
    });
  }

  let head = null;
  try {
    const { stdout } = await runGit("git", ["rev-parse", "HEAD"]);
    head = stdout.trim() || null;
  } catch {
    blockers.push({
      code: "git_head_unresolved",
      message: "Could not resolve HEAD commit.",
    });
  }

  let upstreamCounts = null;
  try {
    const { stdout } = await runGit("git", [
      "rev-list",
      "--left-right",
      "--count",
      `${upstream}...HEAD`,
    ]);
    upstreamCounts = parseUpstreamCounts(stdout);
    if (!upstreamCounts) {
      blockers.push({
        code: "upstream_unresolved",
        message: `Could not compare ${upstream}...HEAD.`,
      });
    } else if (upstreamCounts.behind > 0) {
      blockers.push({
        code: "behind_upstream",
        message: `Local branch is ${upstreamCounts.behind} commit(s) behind ${upstream}.`,
      });
    }
  } catch (err) {
    blockers.push({
      code: "upstream_compare_failed",
      message:
        err.message?.split("\n")[0] ??
        `Could not compare against ${upstream} (fetch may be required).`,
    });
  }

  const working_tree_clean = porcelain.length === 0;

  if (!working_tree_clean) {
    blockers.push({
      code: "working_tree_dirty",
      message: "Working tree has uncommitted changes.",
    });
  }

  return deepFreeze({
    working_tree_clean,
    head,
    upstream,
    upstream_counts: upstreamCounts,
    fetch_attempted: fetch,
    blockers: Object.freeze(blockers.map((b) => Object.freeze({ ...b }))),
    ok: blockers.length === 0,
  });
}

/**
 * @param {object} opts
 * @param {string} [opts.root]
 * @param {boolean} [opts.fetch]
 * @param {boolean} [opts.skip_gates]
 * @param {typeof PRE_PUSH_PUBLISH_GATES} [opts.gates]
 * @param {typeof runProofRoomGate} [opts.runGate]
 * @param {ReturnType<typeof inspectGitPublishPosture>} [opts.git]
 */
export async function buildPrePushProofSealReport({
  root = process.cwd(),
  fetch = false,
  skip_gates = false,
  gates = PRE_PUSH_PUBLISH_GATES,
  runGate = runProofRoomGate,
  git = null,
} = {}) {
  const gitPosture = git ?? (await inspectGitPublishPosture({ root, fetch }));

  /** @type {Array<Awaited<ReturnType<typeof runProofRoomGate>>>} */
  const gateResults = [];

  if (!skip_gates) {
    for (const gate of gates) {
      gateResults.push(await runGate({ root, gate }));
    }
  }

  const gateBlockers = gateResults
    .filter((g) => !g.ok)
    .map((g) => ({
      code: `gate_${g.id}_failed`,
      message: `${g.command} failed (exit ${g.exit_code ?? "?"}).`,
    }));

  const blockers = Object.freeze(
    [...gitPosture.blockers, ...gateBlockers].map((b) =>
      Object.freeze({ ...b }),
    ),
  );

  const gates_ok = skip_gates || gateResults.every((g) => g.ok);
  const ok = gitPosture.ok && gates_ok;

  return deepFreeze({
    schema: PRE_PUSH_PROOF_SEAL_SCHEMA,
    verdict: ok ? PRE_PUSH_VERDICT.PUSH_READY : PRE_PUSH_VERDICT.GAP_DETECTED,
    truth_label: ok ? "PREPARED" : "GAP_DETECTED",
    ok,
    git: gitPosture,
    gates: Object.freeze(
      gateResults.map((g) =>
        Object.freeze({
          id: g.id,
          command: g.command,
          ok: g.ok,
          exit_code: g.exit_code,
          duration_ms: g.duration_ms,
          summary: g.summary ?? null,
        }),
      ),
    ),
    blockers,
    boundary: Object.freeze({
      ...BOUNDARY,
      git_push_performed: false,
      governed_node0_invoked: false,
      artifact_011_measured: false,
    }),
    recommended_next: ok
      ? "Run `gh auth login` if needed, then `git push origin main`. After push sync, run `npm run layer-a5:prep` on real ~/.dema before governed Node0 ceremony."
      : "Resolve blockers above, then re-run `npm run pre-push:seal`.",
    pmbok_alignment: Object.freeze({
      integration_management:
        "publish gate composes git posture + npm check + release readiness",
      quality_management:
        "artifact-011 preflight gate enforced before proof-room composition path",
      risk_management:
        "fail-closed on dirty tree, behind upstream, or gate failure",
    }),
  });
}

export { evaluateGateOk, evaluateProofRoomWrite, commandLine };
