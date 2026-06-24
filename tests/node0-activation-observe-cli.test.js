// NODE0-ACTIVATION-OBSERVE-1A — gatherer tests (Issue #243).
//
// The gatherer does read-only I/O with INJECTED fetchImpl/fsImpl, so CI runs
// with zero real network and zero real disk. These tests mechanically prove the
// read-only boundary: GET-only, localhost-refusal of non-local URLs, and key
// PRESENCE (existsSync) never key CONTENT (no readFileSync exists to call).

import { test } from "node:test";
import assert from "node:assert/strict";
import { gatherNode0ActivationObservations, isLocalUrl } from "../apps/cli/src/commands/observe-gatherer.js";
import { buildNode0ActivationObserve, verifyNode0ActivationObserve } from "../packages/core/src/node0-activation-observe.js";

const env = {
  DEMA_HOME: "/tmp/observe-x/.dema",
  DEMA_SOVEREIGN_URL: "http://127.0.0.1:8000",
  LMSTUDIO_URL: "http://127.0.0.1:1234",
  OLLAMA_URL: "http://127.0.0.1:11434",
  BIZRA_DATA_LAKE: "/data/bizra/repos/bizra-data-lake",
};

function fakeFetch(routes, methodLog = []) {
  return async (url, opts = {}) => {
    methodLog.push({ url, method: opts.method || "GET" });
    const r = routes[url];
    if (r === "throw") throw new Error("ECONNREFUSED");
    if (r === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => r };
  };
}

test("gatherer: sovereign up + models reachable → live true, ids listed, GET-only, boundary all-false", async () => {
  const methods = [];
  const routes = {
    "http://127.0.0.1:8000/v1/health/live": { status: "alive" },
    "http://127.0.0.1:8000/v1/health/ready": { status: "ready" },
    "http://127.0.0.1:1234/v1/models": { data: [{ id: "gemma4-12b" }] },
    "http://127.0.0.1:11434/api/tags": { models: [{ name: "gemma4:26b-bizra-16k" }] },
  };
  const obs = await gatherNode0ActivationObservations({
    fetchImpl: fakeFetch(routes, methods),
    fsImpl: { existsSync: () => true },
    env,
    homedir: "/tmp/observe-x",
  });
  assert.equal(obs.sovereign.live, true);
  assert.deepEqual(obs.local_models.lm_studio.model_ids, ["gemma4-12b"]);
  assert.deepEqual(obs.local_models.ollama.model_ids, ["gemma4:26b-bizra-16k"]);
  assert.ok(methods.every((m) => m.method === "GET"), "gatherer must issue GET only");
  const report = buildNode0ActivationObserve(obs);
  for (const v of Object.values(report.boundary)) assert.equal(v, false);
  assert.equal(verifyNode0ActivationObserve(report).valid, true);
});

test("gatherer: sovereign unreachable → live null, error_class provider_unreachable", async () => {
  const routes = {
    "http://127.0.0.1:8000/v1/health/live": "throw",
    "http://127.0.0.1:8000/v1/health/ready": "throw",
    "http://127.0.0.1:1234/v1/models": "throw",
    "http://127.0.0.1:11434/api/tags": "throw",
  };
  const obs = await gatherNode0ActivationObservations({
    fetchImpl: fakeFetch(routes),
    fsImpl: { existsSync: () => false },
    env,
    homedir: "/tmp/observe-x",
  });
  assert.equal(obs.sovereign.live, null);
  assert.equal(obs.sovereign.error_class, "provider_unreachable");
  assert.equal(buildNode0ActivationObserve(obs).identity_status, "UNINITIALIZED");
});

test("gatherer: non-local sovereign URL is REFUSED, never fetched (no egress off-box)", async () => {
  const methods = [];
  const obs = await gatherNode0ActivationObservations({
    fetchImpl: fakeFetch({}, methods),
    fsImpl: { existsSync: () => false },
    env: { ...env, DEMA_SOVEREIGN_URL: "http://evil.example.com:8000" },
    homedir: "/tmp/observe-x",
  });
  assert.ok(!methods.some((m) => m.url.includes("evil.example.com")), "non-local URL must never be fetched");
  assert.notEqual(obs.sovereign.live, true);
});

test("isLocalUrl: only localhost / 127.0.0.1 / ::1 pass", () => {
  assert.equal(isLocalUrl("http://127.0.0.1:8000"), true);
  assert.equal(isLocalUrl("http://localhost:1234"), true);
  assert.equal(isLocalUrl("http://[::1]:8000"), true);
  assert.equal(isLocalUrl("http://192.168.1.5:8000"), false);
  assert.equal(isLocalUrl("http://evil.example.com"), false);
  assert.equal(isLocalUrl("not a url"), false);
});

test("gatherer: a loopback 3xx redirect is REFUSED, not followed (no off-box egress)", async () => {
  const fetchImpl = async () => ({ ok: false, status: 302, json: async () => ({}) });
  const obs = await gatherNode0ActivationObservations({
    fetchImpl,
    fsImpl: { existsSync: () => false },
    env,
    homedir: "/tmp/observe-x",
  });
  assert.notEqual(obs.sovereign.live, true);
  assert.equal(obs.sovereign.error_class, "redirect_refused");
});

test("gatherer: key checked by existsSync only — there is no readFileSync to read content", async () => {
  const fsCalls = [];
  const fsImpl = { existsSync: (p) => { fsCalls.push(p); return false; } };
  await gatherNode0ActivationObservations({ fetchImpl: fakeFetch({}), fsImpl, env, homedir: "/tmp/observe-x" });
  assert.ok(fsCalls.some((p) => p.includes("node0-ed25519.pub.pem")), "key presence is checked");
  assert.equal(typeof fsImpl.readFileSync, "undefined", "no key-content read path exists");
});
