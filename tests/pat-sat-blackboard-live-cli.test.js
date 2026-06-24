import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

// The live path WITHOUT consent must refuse at the consent gate — before any
// network call — so this exercises the real binary with no model and no network.
test("dema agent-loop blackboard --live without consent refuses, no model invocation", () => {
  const out = execFileSync(
    "node",
    [BIN, "agent-loop", "blackboard", "--live", "--pain", "x", "--goal", "y", "--json"],
    { env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" }, timeout: 20000 },
  ).toString();
  const env = JSON.parse(out);

  assert.equal(env.schema, "bizra.dema.pat_sat_blackboard_live.v0.1");
  assert.equal(env.truth_label, "PAT_SAT_BLACKBOARD_LIVE_REFUSED");
  assert.equal(env.boundary.model_invocation_performed, false);
  assert.equal(env.boundary.network_used, false);
  assert.equal(env.live_propose.verdict_role, "suggestion");
  assert.ok(
    env.live_propose.required_consent &&
      env.live_propose.required_consent.includes("invoke local LLM via ollama"),
    "should surface the exact consent phrase to run it live",
  );
  // Autonomy attestation false; the 10 forbidden keys false.
  assert.ok(Object.values(env.autonomy).every((v) => v === false));
});
