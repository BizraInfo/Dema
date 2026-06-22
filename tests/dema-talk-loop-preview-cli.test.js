// DEMA-TALK-LOOP-1A — `dema talk` CLI smoke tests.
// Preview/consent ceremony only: every assertion confirms NO model is invoked.
// Deterministic — no Ollama dependency, because 1A makes no call. The live
// invocation ships as DEMA-TALK-LOOP-1B under its own GO.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

// Strip the env defaults so the ambient shell can't pollute the default-path
// assertions; tests that want env defaults set them explicitly.
const {
  DEMA_TALK_MODEL: _m,
  DEMA_TALK_PROVIDER: _p,
  ...CLEAN_ENV
} = process.env;

function talk(args) {
  return execFileSync("node", [BIN, "talk", ...args], { encoding: "utf8", env: CLEAN_ENV });
}

function talkEnv(args, env) {
  return execFileSync("node", [BIN, "talk", ...args], {
    encoding: "utf8",
    env: { ...CLEAN_ENV, ...env },
  });
}

test("default → LM Studio provider + allowed + provider+model consent phrase, NO invocation", () => {
  const d = JSON.parse(talk(["summarize my notes", "--json"]));
  assert.equal(d.model_invoked, false);
  assert.equal(d.provider, "lmstudio");
  assert.equal(d.provider_is_default, true);
  assert.equal(d.model_allowed_in_whitelist, true);
  assert.equal(d.consent_required, "GO: invoke local LLM via lmstudio at qwen2.5");
  assert.equal(d.target_is_localhost, true);
});

test("non-whitelisted model → not allowed, still no invocation", () => {
  const d = JSON.parse(talk(["hi", "--model", "gpt-4", "--json"]));
  assert.equal(d.model_allowed_in_whitelist, false);
  assert.equal(d.model_invoked, false);
});

test("--model selects the route and its exact provider+model consent phrase", () => {
  const d = JSON.parse(talk(["hi", "--model", "gemma3", "--json"]));
  assert.equal(d.model, "gemma3");
  assert.equal(d.consent_required, "GO: invoke local LLM via lmstudio at gemma3");
});

test("--provider llamacpp routes to localhost:8080 with the llamacpp phrase", () => {
  const d = JSON.parse(talk(["hi", "--provider", "llamacpp", "--model", "qwen2.5", "--json"]));
  assert.equal(d.provider, "llamacpp");
  assert.equal(d.target_endpoint, "http://localhost:8080/v1");
  assert.equal(d.consent_required, "GO: invoke local LLM via llamacpp at qwen2.5");
});

test("--provider ollama allowed as legacy only (never default)", () => {
  const d = JSON.parse(talk(["hi", "--provider", "ollama", "--model", "qwen2.5", "--json"]));
  assert.equal(d.provider, "ollama");
  assert.equal(d.provider_is_legacy, true);
  assert.equal(d.provider_is_default, false);
});

test("--provider unknown → fail closed, NO silent fallback, NO invocation", () => {
  const d = JSON.parse(talk(["hi", "--provider", "openai", "--json"]));
  assert.equal(d.provider, null);
  assert.equal(d.consent_required, null);
  assert.equal(d.model_invoked, false);
  const out = talk(["hi", "--provider", "openai"]);
  assert.match(out, /unknown provider|not recognize|silently/i);
});

test("human ceremony discloses localhost-only / no-internet / suggestion-only / no call", () => {
  const out = talk(["help me"]);
  assert.match(out, /no model called/i);
  assert.match(out, /localhost/i);
  assert.match(out, /internet/i);
  assert.match(out, /suggestion/i);
});

test("preview points to the exact --consent phrase to run it live (1B shipped)", () => {
  const out = talk(["help me"]);
  assert.match(out, /--consent/);
  assert.match(out, /GO: invoke local LLM via lmstudio at qwen2\.5/);
});

test("env defaults: DEMA_TALK_PROVIDER/MODEL set the default fleet (no flags)", () => {
  const d = JSON.parse(
    talkEnv(["hi", "--json"], {
      DEMA_TALK_PROVIDER: "ollama",
      DEMA_TALK_MODEL: "gemma4:26b",
    }),
  );
  assert.equal(d.provider, "ollama");
  assert.equal(d.model, "gemma4:26b");
  assert.equal(d.model_allowed_in_whitelist, true);
  assert.equal(d.consent_required, "GO: invoke local LLM via ollama at gemma4:26b");
});

test("flags WIN over env defaults", () => {
  const d = JSON.parse(
    talkEnv(["hi", "--provider", "llamacpp", "--json"], {
      DEMA_TALK_PROVIDER: "ollama",
      DEMA_TALK_MODEL: "gemma4:26b",
    }),
  );
  assert.equal(d.provider, "llamacpp"); // flag beats env
  assert.equal(d.model, "gemma4:26b"); // env model still applies (no --model flag)
});

test("no env, no flags → kernel default (lmstudio / qwen2.5) preserved", () => {
  const d = JSON.parse(talk(["hi", "--json"]));
  assert.equal(d.provider, "lmstudio");
  assert.equal(d.model, "qwen2.5");
});

// --- DEMA-TALK-LOOP-1B live path · CI-safe (refusing paths only, NO real fetch) ---

function talkAllowFail(args) {
  try {
    return { out: execFileSync("node", [BIN, "talk", ...args], { encoding: "utf8" }), code: 0 };
  } catch (e) {
    return { out: (e.stdout || "") + (e.stderr || ""), code: e.status ?? 1 };
  }
}

test("--consent with the WRONG phrase → refused, no invocation, exit 1 (no fetch fired)", () => {
  const { out, code } = talkAllowFail([
    "hi", "--consent", "not the right phrase", "--json",
  ]);
  const d = JSON.parse(out);
  assert.equal(d.invocation_status, "refused");
  assert.match(d.error_reason, /consent/i);
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.equal(d.boundary.network_used, false);
  assert.equal(code, 1);
});

test("--consent on an unknown provider → refused, no silent fallback, no fetch", () => {
  const { out } = talkAllowFail([
    "hi", "--provider", "openai", "--consent",
    "GO: invoke local LLM via openai at qwen2.5", "--json",
  ]);
  const d = JSON.parse(out);
  assert.equal(d.invocation_status, "refused");
  assert.match(d.error_reason, /unknown_provider/);
  assert.equal(d.boundary.network_used, false);
});

test("--consent on a non-whitelisted model → refused before any fetch", () => {
  const { out } = talkAllowFail([
    "hi", "--model", "gpt-4", "--consent",
    "GO: invoke local LLM via lmstudio at gpt-4", "--json",
  ]);
  const d = JSON.parse(out);
  assert.equal(d.invocation_status, "refused");
  assert.match(d.error_reason, /whitelist|not.*allow/i);
  assert.equal(d.boundary.network_used, false);
});

test("the previewed boundary reports no model / network / tool / runtime (canonical keys)", () => {
  const d = JSON.parse(talk(["x", "--json"]));
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.equal(d.boundary.network_used, false);
  assert.equal(d.boundary.tool_executed, false);
  assert.equal(d.boundary.runtime_execution_performed, false);
});
