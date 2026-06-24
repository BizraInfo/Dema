import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildNode0ActivationLadder } from "../packages/core/src/node0-activation-ladder.js";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";
import { buildModelRoutingPreview } from "../packages/core/src/model-routing-preview.js";
import { buildClosedDualLoopDryRun } from "../packages/core/src/closed-dual-loop-dry-run.js";
import { buildPatSatBlackboardDryRun } from "../packages/core/src/pat-sat-blackboard-dry-run.js";
import {
  buildNode0ActivationChainPreview,
  verifyNode0ActivationChainPreview,
  NODE0_ACTIVATION_CHAIN_SCHEMA,
} from "../packages/core/src/node0-activation-chain-preview.js";

const AT = "2026-06-24T00:00:00.000Z";

function shippedLadder() {
  const evidence = {};
  for (const id of [
    "observe",
    "benchmark",
    "route",
    "hardware",
    "talk_hint",
    "mission_routing",
    "blackboard",
  ]) {
    evidence[id] = { kernel_present: true, marker_present: true };
  }
  evidence.activate = { kernel_present: false, marker_present: false };
  return buildNode0ActivationLadder({ evidence });
}

function miniBaseline() {
  return buildModelEvalBaseline({
    generated_at_iso: AT,
    suite_id: "bizra-local-small",
    provider_discovery: {},
    models_tested: ["ollama:fast"],
    results_by_model: {
      "ollama:fast": {
        tasks: {
          endpoint_reachable: { reachable: true, latency_ms: 80, output: "" },
          latency_ms: { reachable: true, latency_ms: 80, output: "ok" },
          json_obedience: { reachable: true, latency_ms: 80, output: '{"ok":true}' },
          code_microtask: { reachable: true, latency_ms: 80, output: "def f(): return 42" },
          no_overclaim: { reachable: true, latency_ms: 80, output: "small" },
          truth_boundary: { reachable: true, latency_ms: 80, output: "cannot predict" },
        },
      },
    },
  });
}

test("compose chain → PREVIEW_COMPOSED, verify ok, boundary all-false", () => {
  const ladder = shippedLadder();
  const routing = buildModelRoutingPreview({ baseline: miniBaseline(), generated_at_iso: AT });
  const mission = buildClosedDualLoopDryRun({
    pain: "x",
    goal: "y",
    routing_preview: routing,
  });
  const board = buildPatSatBlackboardDryRun({ pain: "x", goal: "y" });
  const chain = buildNode0ActivationChainPreview({
    ladder,
    routing_preview: routing,
    mission_plan: mission,
    blackboard: board,
  });
  assert.equal(chain.schema, NODE0_ACTIVATION_CHAIN_SCHEMA);
  assert.equal(chain.chain_status, "PREVIEW_COMPOSED");
  assert.equal(chain.talk_env_hint?.provider, "ollama");
  assert.ok(Object.values(chain.boundary).every((v) => v === false));
  assert.equal(verifyNode0ActivationChainPreview(chain).ok, true);
});

test("missing ladder → rejected", () => {
  const chain = buildNode0ActivationChainPreview({});
  assert.equal(chain.rejected, true);
  assert.equal(chain.reason_code, "ladder_missing");
});

test("module imports no node fs/net", () => {
  const src = readFileSync(
    new URL("../packages/core/src/node0-activation-chain-preview.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /from\s+["']node:(fs|net|http)/);
});
