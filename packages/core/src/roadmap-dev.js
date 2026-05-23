// Dev Roadmap v0.1 — `dema roadmap dev` live-state anchor.
//
// What this gives a developer: one command that answers "where am I,
// what just landed, what feature branches do I have lying around, what
// should I do next" — pulled live from git + filesystem so it cannot
// drift the way a hand-maintained file does.
//
// The hand-maintained narrative (Next 5 moves, Parking lot, anchor docs
// index) lives in docs/ROADMAP.md. This module is the live-overlay
// companion. Both are read together.
//
// Pure I/O wrappers below take a `runGit` injectable so the module is
// unit-testable with fixture state. The default `runGit` shells out to
// git via execFile; tests pass a mock that returns canned strings.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export const ROADMAP_DEV_SCHEMA = "bizra.dema.roadmap_dev.v0.1";

const ROADMAP_DOC_PATH = "docs/ROADMAP.md";
const CURRENT_LIMITS_DOC_PATH = "docs/CURRENT_LIMITS.md";

const BOUNDARY = Object.freeze({
  read_only: true,
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false,
  filesystem_write_performed: false
});

const DEFAULT_RUN_GIT = async (args, { cwd } = {}) => {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: cwd ?? process.cwd(),
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5000
    });
    return stdout;
  } catch (err) {
    return `__GIT_ERROR__: ${err.message ?? err}`;
  }
};

function parseLines(stdout) {
  if (typeof stdout !== "string") return [];
  if (stdout.startsWith("__GIT_ERROR__")) return [];
  return stdout.split("\n").map((l) => l.trim()).filter(Boolean);
}

function isGitError(stdout) {
  return typeof stdout === "string" && stdout.startsWith("__GIT_ERROR__");
}

export async function gatherDevRoadmapState({
  cwd = process.cwd(),
  runGit = DEFAULT_RUN_GIT,
  recent_window = 12,
  branch_window = 20
} = {}) {
  // 1. anchor: branch · HEAD short SHA + subject · dirty/clean
  const branchOut = await runGit(["branch", "--show-current"], { cwd });
  const headShaOut = await runGit(["rev-parse", "--short", "HEAD"], { cwd });
  const headSubjectOut = await runGit(["log", "-1", "--pretty=%s"], { cwd });
  const statusOut = await runGit(["status", "--short"], { cwd });

  // 2. recent merged work on main
  const recentMainOut = await runGit(
    ["log", "main", `-${recent_window}`, "--pretty=%h %s"],
    { cwd }
  );

  // 3. active feat/* branches (local)
  const localBranchesOut = await runGit(
    ["for-each-ref", `--count=${branch_window}`, "--sort=-committerdate", "refs/heads/feat/", "--format=%(refname:short)|%(committerdate:relative)|%(objectname:short)"],
    { cwd }
  );

  // 4. upstream alignment (main vs origin/main)
  const aheadBehindOut = await runGit(
    ["rev-list", "--left-right", "--count", "main...origin/main"],
    { cwd }
  );

  // 5. anchor docs presence (no I/O if cwd is fake — guarded)
  const anchorDocs = [
    ROADMAP_DOC_PATH,
    CURRENT_LIMITS_DOC_PATH,
    "docs/PRODUCT.md",
    "docs/INDEX.md",
    "CHANGELOG.md",
    "README.md"
  ];
  const anchorDocsStatus = anchorDocs.map((relPath) => ({
    path: relPath,
    exists: existsSync(join(cwd, relPath))
  }));

  // Compose
  const branch = parseLines(branchOut)[0] ?? null;
  const headSha = parseLines(headShaOut)[0] ?? null;
  const headSubject = parseLines(headSubjectOut)[0] ?? null;
  const dirty = parseLines(statusOut);
  const recentCommits = parseLines(recentMainOut).map((line) => {
    const space = line.indexOf(" ");
    return space === -1
      ? { sha: line, subject: "" }
      : { sha: line.slice(0, space), subject: line.slice(space + 1) };
  });
  const featBranches = parseLines(localBranchesOut).map((line) => {
    const [name, when, sha] = line.split("|");
    return { name: name ?? line, last_touched: when ?? null, sha: sha ?? null };
  });
  const aheadBehind = parseLines(aheadBehindOut)[0] ?? null; // "0\t0"
  const [aheadStr, behindStr] = (aheadBehind ?? "0\t0").split(/\s+/);
  const ahead = Number(aheadStr) || 0;
  const behind = Number(behindStr) || 0;

  const gitError =
    isGitError(branchOut) ||
    isGitError(headShaOut) ||
    isGitError(headSubjectOut) ||
    isGitError(statusOut);

  return Object.freeze({
    schema: ROADMAP_DEV_SCHEMA,
    generated_at: new Date().toISOString(),
    git_available: !gitError,
    anchor: Object.freeze({
      branch,
      head_sha: headSha,
      head_subject: headSubject,
      dirty_count: dirty.length,
      dirty: Object.freeze(dirty.slice(0, 20))
    }),
    main_vs_origin: Object.freeze({
      ahead_of_origin: ahead,
      behind_origin: behind,
      synced: ahead === 0 && behind === 0
    }),
    recent_on_main: Object.freeze(recentCommits.map((c) => Object.freeze(c))),
    feat_branches: Object.freeze(featBranches.map((b) => Object.freeze(b))),
    anchor_docs: Object.freeze(anchorDocsStatus.map((d) => Object.freeze(d))),
    next_moves_pointer: {
      doc: ROADMAP_DOC_PATH,
      section: "Next 5 moves (curated, prioritized)"
    },
    parking_lot_pointer: {
      doc: ROADMAP_DOC_PATH,
      section: "Parking lot — deferred with unblock-GO lines"
    },
    boundary: BOUNDARY
  });
}

export function formatDevRoadmapReport(state) {
  const lines = [
    "DEMA · Dev Roadmap (live anchor)",
    "",
    `Schema: ${state.schema}`,
    `Generated: ${state.generated_at}`,
    "",
    "Anchor:"
  ];
  lines.push(`  Branch:      ${state.anchor.branch ?? "(detached)"}`);
  lines.push(`  HEAD:        ${state.anchor.head_sha ?? "?"} ${state.anchor.head_subject ?? ""}`);
  lines.push(
    `  Tree:        ${state.anchor.dirty_count === 0 ? "clean" : `dirty (${state.anchor.dirty_count} file${state.anchor.dirty_count > 1 ? "s" : ""})`}`
  );
  if (state.main_vs_origin.synced) {
    lines.push(`  main/origin: synced`);
  } else {
    lines.push(
      `  main/origin: ${state.main_vs_origin.ahead_of_origin} ahead · ${state.main_vs_origin.behind_origin} behind`
    );
  }

  lines.push("", `Recent on main (${state.recent_on_main.length} commits):`);
  if (state.recent_on_main.length === 0) {
    lines.push("  (none — git unavailable or empty repo)");
  } else {
    for (const c of state.recent_on_main) {
      lines.push(`  ${c.sha}  ${c.subject}`);
    }
  }

  lines.push("", `Active feat/* branches (${state.feat_branches.length}):`);
  if (state.feat_branches.length === 0) {
    lines.push("  (none)");
  } else {
    for (const b of state.feat_branches) {
      lines.push(`  ${b.name}  ·  ${b.last_touched ?? ""}  ·  ${b.sha ?? ""}`);
    }
  }

  lines.push("", "Anchor docs (presence check):");
  for (const d of state.anchor_docs) {
    lines.push(`  ${d.exists ? "✓" : "✗"} ${d.path}`);
  }

  lines.push(
    "",
    "Next moves & parking lot:",
    `  See ${state.next_moves_pointer.doc} § "${state.next_moves_pointer.section}"`,
    `  See ${state.parking_lot_pointer.doc} § "${state.parking_lot_pointer.section}"`,
    "",
    `Boundary: read-only · network=${state.boundary.network} · mint=${state.boundary.mint} · external_send=${state.boundary.external_send}`
  );

  return lines.join("\n");
}
