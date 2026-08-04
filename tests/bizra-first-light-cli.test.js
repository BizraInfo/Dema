import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runBizraCli } from "../apps/cli/src/bizra.js";
import { buildRuntimeEmissionBoundary } from "../packages/core/src/preview-boundary.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(REPO_ROOT, "bin", "bizra");
const QUESTION = "What are PAT and SAT, and how do they work together?";
const CONSENT = "GO: invoke local LLM via ollama at qwen3:4b";
const NOW = "2026-07-30T08:00:00.000Z";
const EXPIRES = "2026-07-30T08:15:00.000Z";

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "bizra-first-light-cli-"));
  const root = join(base, "corpus");
  const demaHome = join(base, "dema-home");
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "pat.md"),
    "# PAT\nPAT proposes bounded work and attaches evidence.\n",
  );
  await writeFile(
    join(root, "sat.md"),
    "# SAT\nSAT independently verifies the evidence and gates acceptance.\n",
  );
  return {
    base,
    root,
    demaHome,
    cleanup: () => rm(base, { recursive: true, force: true }),
  };
}

function fakeModelInvoker() {
  return Promise.resolve({
    schema: "bizra.dema.talk_loop_live_result.v0.1",
    truth_label: "MEASURED",
    invocation_status: "completed",
    provider: "ollama",
    model: "qwen3:4b",
    target_endpoint: "http://localhost:11434",
    required_consent: CONSENT,
    consent_phrase_verified: true,
    prompt_safety_verdict: "LOCAL_TALK_OK",
    response_safety_verdict: "LOCAL_TALK_OK",
    verdict_role: "suggestion",
    boundary: buildRuntimeEmissionBoundary({
      network_used: true,
      runtime_execution_performed: true,
      model_loaded: true,
      model_invocation_performed: true,
      prompt_executed: true,
      consent_collected: true,
    }),
    response_text:
      "PAT proposes bounded work [S1]. SAT independently verifies and gates it [S2].",
  });
}

async function invoke(argv, options = {}) {
  let stdout = "";
  let stderr = "";
  const code = await runBizraCli({
    argv,
    write_stdout: (value) => {
      stdout += value;
    },
    write_stderr: (value) => {
      stderr += value;
    },
    ...options,
  });
  return { code, stdout, stderr };
}

function startArgs(root) {
  return [
    "start",
    "--root",
    root,
    "--question",
    QUESTION,
    "--provider",
    "ollama",
    "--model",
    "qwen3:4b",
    "--nonce",
    "cli-nonce-001",
    "--now",
    NOW,
    "--expires",
    EXPIRES,
    "--json",
  ];
}

test("bizra start previews a root-bound consent card without content read or writes", async () => {
  const f = await fixture();
  try {
    const preview = await invoke(startArgs(f.root), {
      env: { ...process.env, DEMA_HOME: f.demaHome },
    });
    assert.equal(preview.code, 0, preview.stderr);
    const card = JSON.parse(preview.stdout);
    assert.equal(card.schema, "bizra.node0.first_light_consent_card.v0.1");
    assert.equal(card.status, "CONSENT_REQUIRED");
    assert.equal(card.root.path, f.root);
    assert.equal(card.root.file_count, 2);
    assert.equal(card.root.content_read, false);
    assert.equal(card.state.path, f.demaHome);
    assert.equal(card.required_phrase, CONSENT);
    assert.match(card.consent_context_hash, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(card.boundary, {
      content_read: false,
      model_invocation_performed: false,
      filesystem_write_performed: false,
    });
    await assert.rejects(
      readFile(join(f.demaHome, "first-light", "latest.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await f.cleanup();
  }
});

test("bizra start binds execution to the disclosed context, persists, and resumes", async () => {
  const f = await fixture();
  try {
    const env = { ...process.env, DEMA_HOME: f.demaHome };
    const preview = await invoke(startArgs(f.root), { env });
    const card = JSON.parse(preview.stdout);

    const mismatch = await invoke(
      [
        ...startArgs(f.root),
        "--consent",
        CONSENT,
        "--consent-context",
        `sha256:${"0".repeat(64)}`,
      ],
      { env, model_invoker: fakeModelInvoker },
    );
    assert.equal(mismatch.code, 1);
    assert.ok(JSON.parse(mismatch.stdout).blocked_by.includes("consent_context_mismatch"));

    const completed = await invoke(
      [
        ...startArgs(f.root),
        "--consent",
        CONSENT,
        "--consent-context",
        card.consent_context_hash,
      ],
      {
        env,
        model_invoker: fakeModelInvoker,
        clock: () => "2026-07-30T08:01:00.000Z",
      },
    );
    assert.equal(completed.code, 0, completed.stderr);
    const mission = JSON.parse(completed.stdout);
    assert.equal(mission.status, "COMPLETE");
    assert.equal(mission.verification_state, "VERIFIED_LOCAL");
    assert.match(mission.answer_text, /pat\.md#L/);
    assert.match(mission.receipt_id, /^sha256:[0-9a-f]{64}$/);
    assert.match(mission.proof_card_hash, /^sha256:[0-9a-f]{64}$/);

    const resumed = await invoke(
      [
        "start",
        "--resume",
        mission.mission_id,
        "--dema-home",
        f.demaHome,
        "--json",
      ],
      { env },
    );
    assert.equal(resumed.code, 0, resumed.stderr);
    const verified = JSON.parse(resumed.stdout);
    assert.equal(verified.status, "RESUMED_VERIFIED");
    assert.equal(verified.receipt_id, mission.receipt_id);
    assert.equal(verified.proof_card_hash, mission.proof_card_hash);
    assert.equal(verified.answer_text, mission.answer_text);
    assert.ok(verified.source_verification.every((source) => source.verified));
  } finally {
    await f.cleanup();
  }
});

test("a forged --now cannot revive an expired consent context", async () => {
  const f = await fixture();
  try {
    const env = { ...process.env, DEMA_HOME: f.demaHome };
    const preview = await invoke(startArgs(f.root), { env });
    const card = JSON.parse(preview.stdout);
    let modelCalls = 0;
    const expired = await invoke(
      [
        ...startArgs(f.root),
        "--consent",
        CONSENT,
        "--consent-context",
        card.consent_context_hash,
      ],
      {
        env,
        clock: () => "2026-07-30T08:16:00.000Z",
        model_invoker: async () => {
          modelCalls += 1;
          return fakeModelInvoker();
        },
      },
    );
    assert.equal(expired.code, 1);
    assert.ok(JSON.parse(expired.stdout).blocked_by.includes("consent_expired"));
    assert.equal(modelCalls, 0);
  } finally {
    await f.cleanup();
  }
});

test("bare bizra start completes the interactive one-shot corridor", async () => {
  const f = await fixture();
  try {
    const times = [NOW, "2026-07-30T08:01:00.000Z"];
    let consentPrompt = null;
    const result = await invoke(["start"], {
      env: { ...process.env, DEMA_HOME: f.demaHome },
      cwd: f.root,
      clock: () => times.shift(),
      nonce_factory: () => "interactive-cli-nonce-001",
      model_invoker: fakeModelInvoker,
      questions: {
        values: async () => ({ root: f.root, question: QUESTION }),
        consent: async (requiredPhrase) => {
          consentPrompt = requiredPhrase;
          return CONSENT;
        },
        close() {},
      },
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(consentPrompt, CONSENT);
    assert.match(result.stdout, /CONSENT REQUIRED/);
    assert.match(result.stdout, /COMPLETE/);
    assert.match(result.stdout, /VERIFIED_LOCAL/);
    const latest = JSON.parse(
      await readFile(join(f.demaHome, "first-light", "latest.json"), "utf8"),
    );
    assert.match(latest.mission_id, /^first-light-[0-9a-f]{20}$/);
  } finally {
    await f.cleanup();
  }
});

test("bin/bizra is the package entrypoint and exposes First Light help", async () => {
  const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.bin.bizra, "bin/bizra");
  const result = spawnSync(process.execPath, [BIN, "--help"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bizra start/);
  assert.match(result.stdout, /folder.*grounded answer.*receipt.*Proof Card/is);
});
