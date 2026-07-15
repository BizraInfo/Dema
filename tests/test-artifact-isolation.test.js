import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// TEST-ARTIFACT-ISOLATION-1A guards the exact regression surface: the test,
// coverage, and check entrypoints must not directly invoke the retired restore
// preflight or a literal `git restore|checkout|clean|stash` command. The former
// preflight silently overwrote tracked operator edits under the committed URP
// goldens. This static guard is deliberately narrower than a claim that every
// transitive helper is hermetic; merge-readiness proof also compares worktree
// state before and after the real verification commands.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const verificationEntrypoints = ["test", "coverage", "check"];

test("verification entrypoints contain no direct restore preflight or mutating git command", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const forbidden = /git\s+(restore|checkout|clean|stash)\b|restore-urp-artifacts/;
  for (const name of verificationEntrypoints) {
    const cmd = pkg.scripts?.[name];
    assert.equal(typeof cmd, "string", `package.json script "${name}" is required`);
    assert.ok(
      !forbidden.test(cmd),
      `verification script "${name}" contains a forbidden direct command: ${cmd}`,
    );
  }
});

test("the restore-urp-artifacts preflight is retired and stays retired", () => {
  assert.equal(
    existsSync(join(repoRoot, "scripts/ci/restore-urp-artifacts.mjs")),
    false,
    "scripts/ci/restore-urp-artifacts.mjs must not exist; affected test write-mode callers use temporary roots and committed goldens remain read-only inputs",
  );
});
