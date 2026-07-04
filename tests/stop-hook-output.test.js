import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function hookPath(surface) {
  return fileURLToPath(
    new URL(`../.${surface}/hooks/stop-closeout-check.mjs`, import.meta.url),
  );
}

async function runStopHook(surface, input, env = {}) {
  const child = execFileAsync("node", [hookPath(surface)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    maxBuffer: 1024 * 1024,
  });
  child.child.stdin.end(`${JSON.stringify(input)}\n`);
  const { stdout, stderr } = await child;
  assert.equal(stderr, "");
  return stdout.trim() ? JSON.parse(stdout) : {};
}

// .codex/ is tracked; .claude/ is a gitignored local overlay and is absent in
// clean checkouts (CI) — skip that surface instead of failing hermetically.
function surfaceSkip(surface) {
  return existsSync(hookPath(surface))
    ? false
    : `.${surface}/ overlay absent in this checkout`;
}

test("codex and claude stop-hook mirrors are byte-identical", {
  skip: surfaceSkip("codex") || surfaceSkip("claude"),
}, () => {
  assert.equal(
    readFileSync(hookPath("claude"), "utf8"),
    readFileSync(hookPath("codex"), "utf8"),
  );
});

for (const surface of ["codex", "claude"]) {
  test(`${surface} Stop hook report-only output is valid Stop JSON`, { skip: surfaceSkip(surface) }, async () => {
    const output = await runStopHook(surface, {
      session_id: `test-${surface}`,
      last_assistant_message: "short closeout",
    });

    assert.deepEqual(output, {});
    assert.equal(output.hookSpecificOutput, undefined);
  });

  test(`${surface} Stop hook block mode uses Stop decision schema`, { skip: surfaceSkip(surface) }, async () => {
    const output = await runStopHook(
      surface,
      {
        session_id: `test-${surface}`,
        last_assistant_message: "short closeout",
      },
      { DEMA_HOOK_CLOSEOUT_MODE: "block" },
    );

    assert.equal(output.decision, "block");
    assert.match(output.reason, /Closeout incomplete/);
    assert.equal(output.hookSpecificOutput, undefined);
  });
}
