import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  return stdout;
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
  test(`${surface} Stop hook report-only output is stdout-silent`, { skip: surfaceSkip(surface) }, async () => {
    const stdout = await runStopHook(surface, {
      session_id: `test-${surface}`,
      last_assistant_message: "short closeout",
    });

    assert.equal(stdout, "");
  });

  test(`${surface} Stop hook block mode uses Stop decision schema`, { skip: surfaceSkip(surface) }, async () => {
    const stdout = await runStopHook(
      surface,
      {
        session_id: `test-${surface}`,
        last_assistant_message: "short closeout",
      },
      { DEMA_HOOK_CLOSEOUT_MODE: "block" },
    );
    const output = JSON.parse(stdout);

    assert.equal(output.decision, "block");
    assert.match(output.reason, /Closeout incomplete/);
    assert.equal(output.hookSpecificOutput, undefined);
  });
}

const lexiconGuardPath = fileURLToPath(
  new URL("../.claude/hooks/stop-operator-lexicon-guard.mjs", import.meta.url),
);

async function runLexiconGuard(input, env = {}) {
  const child = execFileAsync("node", [lexiconGuardPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    maxBuffer: 1024 * 1024,
  });
  child.child.stdin.end(`${JSON.stringify(input)}\n`);
  const { stdout, stderr } = await child;
  assert.equal(stderr, "");
  return stdout;
}

test("operator lexicon guard allowed output is stdout-silent", {
  skip: existsSync(lexiconGuardPath) ? false : ".claude overlay absent in this checkout",
}, async () => {
  const stdout = await runLexiconGuard({
    session_id: "test-lexicon-allowed",
    last_assistant_message: "State is valid.",
  });

  assert.equal(stdout, "");
});

test("operator lexicon guard block mode uses Stop decision schema", {
  skip: existsSync(lexiconGuardPath) ? false : ".claude overlay absent in this checkout",
}, async () => {
  const stdout = await runLexiconGuard({
    session_id: "test-lexicon-block",
    last_assistant_message: "Goodnight.",
  });
  const output = JSON.parse(stdout);

  assert.equal(output.decision, "block");
  assert.match(output.reason, /forbidden operator-time\/rest\/closure language/);
});

const ralphStopHookPath = process.env.RALPH_STOP_HOOK_PATH;

async function runRalphTerminalStop({ state, transcript, hookPath = ralphStopHookPath }) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ralph-stop-hook-"));
  const stateDir = join(fixtureRoot, ".claude");
  const transcriptPath = join(fixtureRoot, "transcript.jsonl");

  try {
    mkdirSync(stateDir);
    writeFileSync(join(stateDir, "ralph-loop.local.md"), state);
    writeFileSync(transcriptPath, transcript);

    const child = execFileAsync("bash", [hookPath], {
      cwd: fixtureRoot,
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
    child.child.stdin.end(
      `${JSON.stringify({
        session_id: "ralph-stop-hook-contract",
        transcript_path: transcriptPath,
      })}\n`,
    );

    return await child;
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function ralphTerminalState({ iteration, maxIterations, completionPromise }) {
  return `---\nactive: true\niteration: ${iteration}\nsession_id: ralph-stop-hook-contract\nmax_iterations: ${maxIterations}\ncompletion_promise: ${completionPromise}\nstarted_at: "2026-08-23T00:00:00Z"\n---\n\nFinish the bounded fixture.\n`;
}

test("Ralph max-iteration terminal Stop path is stdout-silent", {
  skip: ralphStopHookPath ? false : "RALPH_STOP_HOOK_PATH is not set",
}, async () => {
  const { stdout } = await runRalphTerminalStop({
    state: ralphTerminalState({ iteration: 1, maxIterations: 1, completionPromise: "null" }),
    transcript: "{}\n",
  });

  assert.equal(stdout, "");
});

test("Ralph completion-promise terminal Stop path is stdout-silent", {
  skip: ralphStopHookPath ? false : "RALPH_STOP_HOOK_PATH is not set",
}, async () => {
  const { stdout } = await runRalphTerminalStop({
    state: ralphTerminalState({ iteration: 1, maxIterations: 0, completionPromise: '"DONE"' }),
    transcript:
      '{"role":"assistant","message":{"content":[{"type":"text","text":"<promise>DONE</promise>"}]}}\n',
  });

  assert.equal(stdout, "");
});

test("Ralph continuing Stop path emits one valid decision object", {
  skip: ralphStopHookPath ? false : "RALPH_STOP_HOOK_PATH is not set",
}, async () => {
  const { stdout, stderr } = await runRalphTerminalStop({
    state: ralphTerminalState({ iteration: 1, maxIterations: 0, completionPromise: "null" }),
    transcript:
      '{"role":"assistant","message":{"content":[{"type":"text","text":"Continue working."}]}}\n',
  });
  const output = JSON.parse(stdout);

  assert.deepEqual(Object.keys(output).sort(), ["decision", "reason", "systemMessage"]);
  assert.equal(output.decision, "block");
  assert.equal(output.reason, "\nFinish the bounded fixture.");
  assert.match(output.systemMessage, /Ralph iteration 2/);
  assert.equal(stderr, "");
});

test("Ralph Stop contract rejects one injected stdout byte", {
  skip: ralphStopHookPath ? false : "RALPH_STOP_HOOK_PATH is not set",
}, async () => {
  const wrapperRoot = mkdtempSync(join(tmpdir(), "ralph-stop-hook-wrapper-"));
  const wrapperPath = join(wrapperRoot, "append-byte.sh");

  try {
    writeFileSync(
      wrapperPath,
      `#!/bin/bash\nbash ${JSON.stringify(ralphStopHookPath)} \"$@\"\nprintf X\n`,
    );
    const { stdout } = await runRalphTerminalStop({
      hookPath: wrapperPath,
      state: ralphTerminalState({ iteration: 1, maxIterations: 1, completionPromise: "null" }),
      transcript: "{}\n",
    });

    assert.equal(stdout, "X");
    assert.throws(() => assert.equal(stdout, ""), assert.AssertionError);
  } finally {
    rmSync(wrapperRoot, { force: true, recursive: true });
  }
});
