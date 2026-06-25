import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function readiness(args = []) {
  return execFileSync("node", [BIN, "models", "readiness", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DEMA_BANNER_INTERACTIVE: "0",
      DEMA_OLLAMA_URL: "http://127.0.0.1:59999",
      DEMA_LM_STUDIO_URL: "http://127.0.0.1:59998",
      DEMA_LLAMACPP_URL: "http://127.0.0.1:59997",
    },
  });
}

test("dema models readiness --json returns schema and blocked providers when down", () => {
  const d = JSON.parse(readiness(["--json"]));
  assert.equal(d.schema, "bizra.dema.local_llm_fleet_readiness.v0.1");
  assert.equal(d.truth_label, "DEMA_LOCAL_LLM_FLEET_READINESS_READ_ONLY");
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.ok(Array.isArray(d.providers));
  assert.equal(d.providers.length, 3);
  assert.equal(d.preferred_canon_qa.route.live_talk_status, "blocked");
  assert.ok(d.preferred_canon_qa.route.consent_phrase?.startsWith("GO: invoke local LLM via "));
});

test("human render discloses read-only probe and consent phrase", () => {
  const out = readiness([]);
  assert.match(out, /readiness/i);
  assert.match(out, /no model invocation/i);
  assert.match(out, /consent:/i);
  assert.match(out, /Canon QA:/i);
  assert.match(out, /Fast reply:/i);
});
