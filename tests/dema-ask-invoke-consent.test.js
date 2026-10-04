// ASK-INVOKE-CONSENT-FAIL-CLOSED-1A — `dema ask --invoke` must refuse when the
// human did not name the model and type the model-invocation consent phrase.
//
// MEASURED DEFECT (observed 2026-08-08 on the shipped bytes). Running
//   dema ask "q" --scope DIR --consent "<ask phrase>" --invoke
// with NEITHER --model NOR --llm-consent produced:
//   sanitizer.allowed_count = 1            → the corpus WAS read
//   blocked_by = llm_invoke_failed:network_error · TypeError: fetch failed
// That second line is the proof: it reached the network. The adapter's consent
// gate ACCEPTED the run. apps/cli/src/commands/ask.js defaulted --model to
// "llama3.2" and then called llmAdapterConsentPhraseFor(model) to produce the
// exact phrase itself. packages/core/src/llm-adapter.js:117 states the contract
// plainly — "Caller MUST type this verbatim. No fuzzy match." The CLI defeated
// that gate by becoming the caller: the party performing the invocation issued
// the artifact certifying it was authorized. On a machine with Ollama running,
// this invokes a model the human never named under consent no human typed, and
// writes a receipt recording that consent. Only an unreachable provider stopped
// it here.
//
// The adapter itself is sound and must stay the adjudicator: supplying a WRONG
// phrase already yields consent_phrase_mismatch with no HTTP (AIC-05 pins that).
// So the CLI checks PRESENCE; the adapter checks CORRECTNESS. This slice does
// not move that boundary.
//
// The estate already ships this shape one command over: `dema model-broker
// route --invoke` refuses with "--invoke requires --invoke-consent"
// (tests/model-broker-invoke-cli.test.js). This applies that pattern to `ask`.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const ASK_CONSENT = "GO: dema ask H3/H4 sanitizer-gated";
const CANARY = "CANARY_CORPUS_CONTENT_MUST_NOT_BE_READ";

function runCli(args, { env = {}, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "node",
      [cliPath, ...args],
      { env: { ...process.env, DEMA_BANNER_INTERACTIVE: "0", NODE_ENV: "test", ...env }, timeout },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          reject(new Error(`Process timed out. stdout=${stdout} stderr=${stderr}`));
          return;
        }
        resolve({ stdout, stderr, exitCode: err?.code ?? 0 });
      },
    );
    child.stdin.end();
  });
}

async function makeScope() {
  const dir = await mkdtemp(join(tmpdir(), "dema-ask-invoke-"));
  await writeFile(join(dir, "note.md"), `${CANARY}\n`, "utf8");
  return dir;
}

const makeHome = () => mkdtemp(join(tmpdir(), "dema-ask-invoke-home-"));

// `allowed_count` appears only once the sanitizer has actually ingested the
// scope, and `llm_invoke_failed` only once the adapter has been entered. Their
// ABSENCE is what proves the refusal happened upstream of both — asserting a
// non-zero exit alone would pass on the pre-fix bytes too.
function assertRefusedBeforeCorpusAndAdapter(stdout, stderr) {
  const all = stdout + stderr;
  assert.doesNotMatch(all, /allowed_count/, "refusal must precede any corpus read");
  assert.doesNotMatch(all, /llm_invoke_failed/, "refusal must precede the adapter/network");
  assert.doesNotMatch(all, new RegExp(CANARY), "corpus content must never be reached");
}

test("AIC-01: '--invoke' without --llm-consent REFUSES — the CLI never types the human's phrase", async () => {
  const [scope, home] = [await makeScope(), await makeHome()];
  const { stdout, stderr, exitCode } = await runCli(
    ["ask", "what is this", "--scope", scope, "--consent", ASK_CONSENT, "--invoke", "--model", "gemma4:e4b"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0, "missing model consent must fail closed");
  assert.match(stderr, /--invoke requires --llm-consent/);
  // The human must be shown WHAT to type — the CLI must not supply it for them.
  assert.match(stderr, /GO: invoke local LLM at gemma4:e4b/);
  assertRefusedBeforeCorpusAndAdapter(stdout, stderr);
});

test("AIC-02: '--invoke' without --model REFUSES — no silently-defaulted model identity", async () => {
  const [scope, home] = [await makeScope(), await makeHome()];
  const { stdout, stderr, exitCode } = await runCli(
    ["ask", "what is this", "--scope", scope, "--consent", ASK_CONSENT, "--invoke"],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0, "an unnamed model must fail closed");
  assert.match(stderr, /--invoke requires --model/);
  assertRefusedBeforeCorpusAndAdapter(stdout, stderr);
});

test("AIC-03: the pre-fix signature is gone — a bare '--invoke' can no longer reach the network", async () => {
  const [scope, home] = [await makeScope(), await makeHome()];
  const { stdout, stderr } = await runCli(
    ["ask", "what is this", "--scope", scope, "--consent", ASK_CONSENT, "--invoke"],
    { env: { DEMA_HOME: home } },
  );
  // This is the exact string the defective bytes produced. Its absence is the
  // regression pin: a self-issued phrase can no longer clear the adapter gate.
  assert.doesNotMatch(stdout + stderr, /network_error/, "a self-issued consent phrase must never reach HTTP");
  assert.doesNotMatch(stdout, /llama3\.2/, "CLI must not select a model the human never named");
});

test("AIC-04: NEGATIVE CONTROL — the extractive path is untouched and still reads the corpus", async () => {
  const [scope, home] = [await makeScope(), await makeHome()];
  const { stdout, exitCode } = await runCli(
    ["ask", "what is this", "--scope", scope, "--consent", ASK_CONSENT],
    { env: { DEMA_HOME: home } },
  );
  // Proves the refusals above are specific to --invoke, not a blanket break.
  assert.equal(exitCode, 0, "extractive ask must still succeed");
  assert.match(stdout, new RegExp(CANARY), "extractive path must still reach the corpus");
  assert.match(stdout, /"answer_hash"\s*:\s*"sha256:/, "extractive path must still seal an answer");
});

test("AIC-05: BOUNDARY CONTROL — a supplied-but-wrong phrase still reaches the ADAPTER to be judged", async () => {
  const [scope, home] = [await makeScope(), await makeHome()];
  const { stdout, stderr, exitCode } = await runCli(
    [
      "ask", "what is this", "--scope", scope, "--consent", ASK_CONSENT,
      "--invoke", "--model", "gemma4:e4b", "--llm-consent", "GO: invoke local LLM at wrong-model",
    ],
    { env: { DEMA_HOME: home } },
  );
  assert.notEqual(exitCode, 0, "a mismatched phrase must not authorize invocation");
  // The CLI checks PRESENCE only. Correctness is the adapter's call, and it
  // must still be the one that speaks — otherwise the CLI has over-refused and
  // swallowed the exact-match gate this slice exists to protect.
  assert.match(stdout + stderr, /consent_phrase_mismatch/);
  assert.doesNotMatch(stderr, /--invoke requires --llm-consent/, "the flag WAS supplied — wrong refusal reason");
});
