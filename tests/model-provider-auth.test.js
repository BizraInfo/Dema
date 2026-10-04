// MODEL-PROVIDER-AUTH-1A · optional loopback bearer key for OpenAI-compatible
// provider lanes (llamacpp / lm_studio) in the eval-baseline gatherer.
//
// Why this exists (measured 2026-08-15): the operator's Hermes Gemma4 backend
// on :8080 requires `Authorization: Bearer <key>` for inference while its
// discovery GET is keyless. Dema's gatherer sent no auth header at all, so the
// model was DISCOVERED but 401-mute on every suite task — it scored 0/6 in the
// full-fleet baseline while appearing "tested". This slice lets the operator
// supply LLAMACPP_KEY / LMSTUDIO_KEY via env; the key rides the request only.
//
// Contract proven here, with injected fetch (zero real network):
//   1. key set   -> llamacpp list + generate calls carry the bearer header
//   2. no key    -> no Authorization header on any call (byte-identical old behavior)
//   3. ollama    -> NEVER carries a key, even when provider keys are set
//   4. the key never appears in the returned report object

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { gatherModelEvalBaseline } from "../apps/cli/src/commands/eval-baseline-gatherer.js";

function recordingFetch(calls) {
  return async (url, opts = {}) => {
    calls.push({ url: String(url), headers: opts.headers || {} });
    const body = (payload) => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    if (/api\/tags/.test(url)) return body({ models: [{ name: "m-ollama", digest: "d1" }] });
    if (/v1\/models/.test(url)) return body({ data: [{ id: "m-lcpp", digest: "d2" }] });
    if (/api\/generate/.test(url)) return body({ response: "ok" });
    if (/chat\/completions/.test(url)) return body({ choices: [{ message: { content: "ok" } }] });
    return body({});
  };
}

const auth = (c) => c.headers.Authorization || c.headers.authorization || null;

describe("MODEL-PROVIDER-AUTH-1A · optional bearer key per provider lane", () => {
  it("attaches the bearer to llamacpp list + generate when LLAMACPP_KEY is set", async () => {
    const calls = [];
    await gatherModelEvalBaseline({
      fetchImpl: recordingFetch(calls),
      env: { LLAMACPP_KEY: "k-test" },
      maxModels: 6,
    });
    const lcpp = calls.filter((c) => /:8080/.test(c.url));
    assert.ok(lcpp.length >= 2, "llamacpp list + at least one generate call expected");
    for (const c of lcpp) assert.equal(auth(c), "Bearer k-test");
  });

  it("sends NO Authorization header anywhere when no key is set", async () => {
    const calls = [];
    await gatherModelEvalBaseline({ fetchImpl: recordingFetch(calls), env: {}, maxModels: 6 });
    for (const c of calls) assert.equal(auth(c), null, `unexpected auth on ${c.url}`);
  });

  it("ollama lane never carries a key, even when provider keys are set", async () => {
    const calls = [];
    await gatherModelEvalBaseline({
      fetchImpl: recordingFetch(calls),
      env: { LLAMACPP_KEY: "k-test", LMSTUDIO_KEY: "k2" },
      maxModels: 6,
    });
    const ollama = calls.filter((c) => /:11434/.test(c.url));
    assert.ok(ollama.length >= 1, "ollama calls expected");
    for (const c of ollama) assert.equal(auth(c), null, "ollama must stay keyless");
  });

  it("the key never leaks into the returned report", async () => {
    const calls = [];
    const report = await gatherModelEvalBaseline({
      fetchImpl: recordingFetch(calls),
      env: { LLAMACPP_KEY: "k-secret-xyz" },
      maxModels: 6,
    });
    assert.ok(!JSON.stringify(report).includes("k-secret-xyz"), "key must not appear in report");
  });
});
