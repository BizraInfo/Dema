// NODE0-CORRIDOR-SEASON-CONSENT-BRIDGE-1A — the trusted executing-repository seam.
//
// WHY THIS FILE EXISTS: a Season State cannot prove its own binding by repeating
// its claimed commit back to the verifier. Authority requires TWO independent
// facts — what the state CLAIMS, and what the executing world ACTUALLY is. This
// module supplies the second fact, and nothing else.
//
// PURITY: this module holds NO process capability. It follows the repository's
// established injected-runner idiom (the same one
// packages/core/src/pre-push-proof-seal.js uses): the caller supplies `runGit`,
// and the real `git` runner lives in the CLI layer where a process boundary is
// permitted. A missing runner REFUSES — it never silently falls back to
// state-supplied values, which is the exact defect this module exists to prevent.
//
// It answers exactly one question and returns no authority: no verdict, no
// consent, no execution. `authority_delta` is 0 by construction.

import { fileURLToPath } from "node:url";

export const EXECUTING_REPOSITORY_BINDING_SCHEMA =
  "bizra.dema.executing_repository_binding.v0.1";

// This file lives at packages/mission/src/, so the repository root is three up.
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const SHA1_HEX_RE = /^[0-9a-f]{40}$/;

const refuse = (reason) =>
  Object.freeze({
    schema: EXECUTING_REPOSITORY_BINDING_SCHEMA,
    ok: false,
    commit: null,
    tree: null,
    source: "git",
    reason,
    authority_delta: 0,
  });

/** The two commands that establish executing-repository truth. */
export const EXECUTING_BINDING_ARGS = Object.freeze({
  commit: Object.freeze(["rev-parse", "HEAD"]),
  tree: Object.freeze(["rev-parse", "HEAD^{tree}"]),
});

/**
 * Measure the EXECUTING repository's commit and tree.
 *
 * Fails closed on every path: a missing runner, an absent git, a detached or
 * unborn HEAD, a non-hex answer, or a runner that throws all produce ok:false
 * with a typed reason. A caller may never fall back to state-supplied values —
 * that is the exact defect this module exists to prevent.
 */
export async function readExecutingRepositoryBinding({
  runGit,
  cwd = REPO_ROOT,
} = {}) {
  if (typeof runGit !== "function") return refuse("git_runner_missing");

  let commit;
  try {
    commit = String(await runGit(["rev-parse", "HEAD"], { cwd })).trim();
  } catch {
    return refuse("executing_commit_unresolved");
  }
  if (!SHA1_HEX_RE.test(commit)) return refuse("executing_commit_malformed");

  let tree;
  try {
    tree = String(await runGit(["rev-parse", "HEAD^{tree}"], { cwd })).trim();
  } catch {
    return refuse("executing_tree_unresolved");
  }
  if (!SHA1_HEX_RE.test(tree)) return refuse("executing_tree_malformed");

  return Object.freeze({
    schema: EXECUTING_REPOSITORY_BINDING_SCHEMA,
    ok: true,
    commit,
    tree,
    source: "git",
    reason: null,
    authority_delta: 0,
  });
}

// ── Execution posture: are the LOADED bytes the COMMITTED bytes? ────────────
// COMMITTED_OBJECT_IDENTITY != LOADED_WORKTREE_BYTE_IDENTITY: rev-parse can
// be pristine while the working tree carries uncommitted load-bearing edits.
// This sibling observer answers only that second question, through the same
// injected sanitized runner, and only for the surfaces the ceremony actually
// loads — a dirty test or doc never blocks, a dirty kernel always does.

export const EXECUTING_POSTURE_SCHEMA =
  "bizra.dema.executing_worktree_posture.v0.1";

export const LOAD_BEARING_POSTURE_PREFIXES = Object.freeze([
  "apps/",
  "packages/",
  "bin/",
  "scripts/",
]);

const refusePosture = (reason) =>
  Object.freeze({
    schema: EXECUTING_POSTURE_SCHEMA,
    ok: false,
    working_tree_clean: null,
    dirty_load_bearing: null,
    source: "git",
    reason,
    authority_delta: 0,
  });

export async function readExecutingWorktreePosture({
  runGit,
  cwd = REPO_ROOT,
} = {}) {
  if (typeof runGit !== "function") return refusePosture("git_runner_missing");
  let out;
  try {
    out = String(await runGit(["status", "--porcelain"], { cwd }));
  } catch {
    return refusePosture("working_tree_unverifiable");
  }
  const dirty = out
    .split("\n")
    .filter((line) => line.trim().length > 0)
    // porcelain: XY<space>path — path begins at column 4; git quotes special
    // paths, so strip a leading quote or a quoted path under apps/ would
    // read as clean (an empty result must never come from a blind spot).
    .map((line) => line.slice(3).replace(/^"/, ""))
    .filter((path) =>
      LOAD_BEARING_POSTURE_PREFIXES.some(
        (prefix) => path.startsWith(prefix) || path.includes(`-> ${prefix}`),
      ),
    );
  return Object.freeze({
    schema: EXECUTING_POSTURE_SCHEMA,
    ok: true,
    working_tree_clean: dirty.length === 0,
    dirty_load_bearing: Object.freeze(dirty.slice(0, 20)),
    source: "git",
    reason: null,
    authority_delta: 0,
  });
}
