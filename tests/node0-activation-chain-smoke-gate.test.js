import test from "node:test";
import assert from "node:assert/strict";

import { gatherNode0LadderEvidence } from "../apps/cli/src/commands/node0-ladder-gatherer.js";
import { buildNode0ActivationLadder } from "../packages/core/src/node0-activation-ladder.js";
import { buildClosedDualLoopDryRun } from "../packages/core/src/closed-dual-loop-dry-run.js";
import { buildPatSatBlackboardDryRun } from "../packages/core/src/pat-sat-blackboard-dry-run.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";
import { buildNode0ActivationChainPreview } from "../packages/core/src/node0-activation-chain-preview.js";
import {
  buildNode0ActivationChainSmokeReport,
  verifyNode0ActivationChainSmokeReport,
  NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA,
  SMOKE_GOAL,
  SMOKE_PAIN,
} from "../packages/core/src/node0-activation-chain-smoke.js";

function composedChainWithSelfLoop() {
  const ladder = buildNode0ActivationLadder({
    evidence: gatherNode0LadderEvidence({}),
  });
  const mission = buildClosedDualLoopDryRun({
    pain: SMOKE_PAIN,
    goal: SMOKE_GOAL,
    routing_preview: null,
  });
  const blackboard = buildPatSatBlackboardDryRun({
    pain: SMOKE_PAIN,
    goal: SMOKE_GOAL,
  });
  const self_loop = buildPeakSelfLoopPreview({
    consent_phrase: "GO: act on peak-self-loop suggestion",
  });
  return buildNode0ActivationChainPreview({
    ladder,
    routing_preview: null,
    mission_plan: mission,
    blackboard,
    self_loop,
  });
}

test("smoke evaluator accepts composed chain with proactive self-loop harness", () => {
  const chain = composedChainWithSelfLoop();
  const report = buildNode0ActivationChainSmokeReport({
    report: chain,
    expectSelfLoop: true,
  });
  assert.equal(report.ok, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.schema, NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA);
  assert.equal(verifyNode0ActivationChainSmokeReport(report).ok, true);
});

test("smoke evaluator fails when chain is BLOCKED", () => {
  const chain = composedChainWithSelfLoop();
  const broken = { ...chain, chain_status: "BLOCKED" };
  const report = buildNode0ActivationChainSmokeReport({
    report: broken,
    expectSelfLoop: true,
  });
  assert.equal(report.ok, false);
  assert.ok(report.findings.some((f) => f.code === "chain_status_not_composed"));
});

test("smoke evaluator fails when proactive self harness is stripped", () => {
  const chain = composedChainWithSelfLoop();
  const sl = { ...chain.components.self_loop, proactive_self: null };
  const broken = {
    ...chain,
    components: { ...chain.components, self_loop: sl },
  };
  const report = buildNode0ActivationChainSmokeReport({
    report: broken,
    expectSelfLoop: true,
  });
  assert.equal(report.ok, false);
  assert.ok(
    report.findings.some((f) => f.code === "proactive_self_harness_incomplete"),
  );
});

test("review gate helper passes on live dema node0 chain --self-loop --json", async () => {
  const { runNode0ActivationChainSmoke } = await import(
    "../scripts/review/node0-activation-chain-smoke.mjs"
  );
  const result = runNode0ActivationChainSmoke();
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.chain.chain_status, "PREVIEW_COMPOSED");
  assert.equal(result.chain.autopoietic_posture?.not_autonomous_runtime, true);
});
