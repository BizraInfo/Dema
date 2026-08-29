import test from "node:test";
import assert from "node:assert/strict";

import { postGenesisExecution } from "../packages/core/src/node0-genesis-client.js";

const REQUEST = Object.freeze({ schema: "bizra.node0.genesis_execution.v0.1", missionId: "m1" });

test("client posts exact bytes only to the local governed execution route", async () => {
  let captured;
  const result = await postGenesisExecution({
    baseUrl: "http://127.0.0.1:7421",
    request: REQUEST,
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "COMMITTED", authorityDelta: 0 }),
      };
    },
  });
  assert.equal(captured.url, "http://127.0.0.1:7421/genesis/execute");
  assert.equal(captured.init.method, "POST");
  assert.deepEqual(JSON.parse(captured.init.body), REQUEST);
  assert.equal(result.ok, true);
  assert.equal(result.body.status, "COMMITTED");
  assert.deepEqual(result.boundary, {
    localhost_network_used: true,
    public_network: false,
    runtime_started: false,
    model_invoked: false,
    authority_delta: 0,
  });
});

test("client refuses non-loopback endpoints before fetch", async () => {
  let called = false;
  const result = await postGenesisExecution({
    baseUrl: "https://example.com",
    request: REQUEST,
    fetchImpl: async () => {
      called = true;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.refusal, "endpoint_not_loopback");
  assert.equal(called, false);
});

test("client preserves governed refusal and bounds timeout", async () => {
  const refused = await postGenesisExecution({
    baseUrl: "http://localhost:7421/",
    request: REQUEST,
    fetchImpl: async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: "SAT_REJECT" } }),
    }),
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 422);
  assert.equal(refused.body.error.code, "SAT_REJECT");

  const hanging = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
  const timeout = await postGenesisExecution({
    baseUrl: "http://[::1]:7421",
    request: REQUEST,
    fetchImpl: hanging,
    timeoutMs: 1,
  });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.refusal, "timeout");
});
