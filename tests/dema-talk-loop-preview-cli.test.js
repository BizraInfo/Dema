// DEMA-TALK-LOOP-1A — `dema talk` CLI smoke tests.
// Preview/consent ceremony only: every assertion confirms NO model is invoked.
// Deterministic — no Ollama dependency, because 1A makes no call. The live
// invocation ships as DEMA-TALK-LOOP-1B under its own GO.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function talk(args) {
  return execFileSync("node", [BIN, "talk", ...args], { encoding: "utf8" });
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

test("human ceremony does NOT over-promise the live phrase — flags it not-final / 1B", () => {
  // The previewed provider-qualified phrase is the proposed 1B contract; the
  // live gate is not built. The render must not assert it as the exact phrase.
  const out = talk(["help me"]);
  assert.match(out, /not built yet|not final|proposed/i);
  assert.match(out, /1B|DEMA-TALK-LOOP-1B/);
});

test("the previewed boundary reports no model / network / tool / runtime (canonical keys)", () => {
  const d = JSON.parse(talk(["x", "--json"]));
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.equal(d.boundary.network_used, false);
  assert.equal(d.boundary.tool_executed, false);
  assert.equal(d.boundary.runtime_execution_performed, false);
});
