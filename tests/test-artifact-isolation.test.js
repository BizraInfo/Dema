import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// TEST-ARTIFACT-ISOLATION-1A guard: repository verification must never
// mutate the worktree. A `git restore` preflight (448711b / restore-urp-artifacts.mjs)
// silently overwrote tracked operator edits under artifacts/proofs/node0-local-urp/
// before every test/coverage/check run. Red receipt: /data/bizra/logs/tai-1a-red-receipt.log
// (tracked edit dc2add3a… reverted to golden bad86337… with exit 0).
// These tests fail closed if any worktree-mutating setup returns.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("no npm script mutates the worktree via git restore/checkout/clean", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const forbidden = /git\s+(restore|checkout|clean|stash)\b|restore-urp-artifacts/;
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    assert.ok(
      !forbidden.test(cmd),
      `package.json script "${name}" contains a worktree-mutating command: ${cmd}`,
    );
  }
});

test("the restore-urp-artifacts preflight is retired and stays retired", () => {
  assert.equal(
    existsSync(join(repoRoot, "scripts/ci/restore-urp-artifacts.mjs")),
    false,
    "scripts/ci/restore-urp-artifacts.mjs must not exist — tests own their fixtures (mkdtemp); the worktree is not a fixture store",
  );
});
