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
