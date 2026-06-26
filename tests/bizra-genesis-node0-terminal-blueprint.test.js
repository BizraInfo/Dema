import test from "node:test";
import assert from "node:assert/strict";

import {
  renderBizraGenesisNode0TerminalBlueprint,
  verifyBizraGenesisNode0TerminalBlueprint,
  REQUIRED_LAYERS,
  REQUIRED_TREE_PATHS,
  CLOSED_LOOP,
  FORBIDDEN_OVERCLAIM_PHRASES,
  hasPositiveOverclaim,
} from "../packages/core/src/bizra-genesis-node0-terminal-blueprint.js";

function assertContainsAll(haystack, values) {
  for (const value of values) {
    assert.ok(haystack.includes(value), `Expected blueprint to include: ${value}`);
  }
}

test("renders BIZRA Node0 / Dema terminal blueprint", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();

  assert.ok(output.includes("BIZRA GENESIS BLOCK - NODE0 DEMA"));
  assert.ok(output.includes("Single-Node Closed-Loop Ecosystem"));
  assert.ok(output.includes("Dema Orchestrator"));
  assert.ok(output.includes("PAT Personal Agent Team"));
  assert.ok(output.includes("SAT System Agent Team"));
  assert.ok(output.includes("FATE / Consent Boundary"));
  assert.ok(output.includes("Proof of Impact"));
  assert.ok(output.includes("BIZRA URP / NETWORK LAYER"));
});

test("covers all required architecture layers", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();
  assertContainsAll(output, REQUIRED_LAYERS);
});

test("includes deterministic OSTree / code-space map", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();
  assertContainsAll(output, REQUIRED_TREE_PATHS);
});

test("includes closed-loop flow from user back to user", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();
  assertContainsAll(output, CLOSED_LOOP);
});

test("stays monochrome terminal-safe", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();

  const ansiEscapePattern = /\u001b\[[0-9;]*m/u;
  assert.equal(ansiEscapePattern.test(output), false);

  assert.equal(output.includes("```mermaid"), false);
  assert.equal(output.includes("<svg"), false);
  assert.equal(output.includes("<img"), false);
});

test("does not overclaim live autonomy or live token behavior", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint().toLowerCase();

  for (const claim of FORBIDDEN_OVERCLAIM_PHRASES) {
    assert.equal(
      hasPositiveOverclaim(output, claim),
      false,
      `Blueprint must not overclaim: ${claim}`,
    );
  }

  assert.ok(output.includes("no token mint"));
  assert.ok(output.includes("no wallet action"));
  assert.ok(output.includes("no hidden daemon"));
});

test("verify helper passes on rendered blueprint", () => {
  const output = renderBizraGenesisNode0TerminalBlueprint();
  const verified = verifyBizraGenesisNode0TerminalBlueprint(output);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
});

test("review gate helper passes on live blueprint", async () => {
  const { runBizraGenesisBlueprintCheck } = await import(
    "../scripts/review/bizra-genesis-blueprint-check.mjs"
  );
  const result = runBizraGenesisBlueprintCheck();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
});

test("prints blueprint when explicitly requested", () => {
  if (process.env.BIZRA_PRINT_BLUEPRINT === "1") {
    console.log(`\n${renderBizraGenesisNode0TerminalBlueprint()}\n`);
  }
});
