import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0KillerDemoValueLoopProofConvergence,
  verifyNode0KillerDemoValueLoopProofConvergence,
  runNode0KillerDemoValueLoopProofConvergence,
  formatNode0KillerDemoValueLoopProofConvergence,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL,
  NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND,
  KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS,
} from "../packages/core/src/node0-killer-demo-value-loop-proof-convergence.js";
import { PROOF_CONVERGENCE_PREVIEW_SCHEMA } from "../packages/core/src/proof-convergence-preview.js";
import {
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
} from "../packages/core/src/node0-killer-demo-value-loop-cli.js";
import {
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "../packages/core/src/node0-proof-of-truth-control-plane.js";

test("PC-01: emits canonical schema and truth label", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence();
  assert.equal(out.schema, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA);
  assert.equal(out.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL);
  assert.equal(out.command, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_COMMAND);
});

test("PC-02: composes killer-demo CLI, proof convergence, and control plane reference", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence();
  assert.equal(out.killer_demo_cli.schema, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA);
  assert.equal(out.killer_demo_cli.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL);
  assert.equal(out.killer_demo_cli.verified_ok, true);
  assert.equal(out.proof_convergence.schema, PROOF_CONVERGENCE_PREVIEW_SCHEMA);
  assert.equal(out.proof_convergence.summary.total, KILLER_DEMO_PROOF_CONVERGENCE_CLAIMS.length);
  assert.equal(out.control_plane_reference.schema, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA);
  assert.equal(out.control_plane_reference.truth_label, NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL);
  assert.equal(out.control_plane_reference.release_verdict, "READY_LOCAL");
});

test("PC-03: boundaries are all false and autonomy flags are explicit", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence();
  assert.ok(Object.values(out.boundary).every((v) => v === false));
  assert.ok(Object.values(out.boundaries).every((v) => v === false));
  assert.equal(out.autonomous_rsi.not_autonomous_runtime, true);
  assert.equal(out.autonomous_rsi.not_agent_rl, true);
  assert.equal(out.autonomous_rsi.reward_verified, false);
});

test("PC-04: SNR and process RSI use preview math (not undefined aliases)", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence();
  assert.equal(typeof out.snr_framework.score, "number");
  assert.ok(["signal", "noise"].includes(out.snr_framework.dominant));
  assert.equal(typeof out.process_rsi.score, "number");
  assert.equal(typeof out.autonomous_rsi.process_rsi, "number");
  assert.ok(
    ["CONTINUE_MICRO_SLICE", "HOLD_AND_REDUCE_NOISE"].includes(
      out.autonomous_rsi.merged_verdict,
    ),
  );
});

test("PC-05: proactive ultra-micro self-loop declares consent and compliance", () => {
  const out = buildNode0KillerDemoValueLoopProofConvergence();
  assert.ok(out.proactive_self.consent.required_phrase.length > 0);
  assert.equal(out.proactive_self.consent.exact_string, true);
  assert.equal(out.proactive_self.compliance.no_autonomous_runtime, true);
  assert.equal(out.proactive_self.compliance.no_token_mint, true);
  assert.ok(out.proactive_self.harness.active_gates.length >= 3);
});

test("PC-06: verify passes on canonical compose envelope", () => {
  const result = runNode0KillerDemoValueLoopProofConvergence();
  assert.equal(result.ok, true);
  assert.equal(result.verified.ok, true);
  assert.notEqual(result.compose_status, "BLOCKED");
});

test("PC-07: verify fails when killer demo CLI is not verified", () => {
  const composed = buildNode0KillerDemoValueLoopProofConvergence();
  const tampered = {
    ...composed,
    killer_demo_cli: { ...composed.killer_demo_cli, verified_ok: false },
  };
  const verified = verifyNode0KillerDemoValueLoopProofConvergence(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("killer_demo_cli_not_verified"));
});

test("PC-08: format renders human summary", () => {
  const composed = buildNode0KillerDemoValueLoopProofConvergence();
  const text = formatNode0KillerDemoValueLoopProofConvergence(composed);
  assert.match(text, /proof convergence/i);
  assert.match(text, /preview-only/i);
});

test("PC-09: review gate script passes hermetic check", async () => {
  const { runNode0KillerDemoValueLoopProofConvergenceCheck } = await import(
    "../scripts/review/node0-killer-demo-value-loop-proof-convergence-check.mjs"
  );
  const result = runNode0KillerDemoValueLoopProofConvergenceCheck();
  assert.equal(result.ok, true);
});

test("PC-10: CLI smoke via apps/cli index", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const out = execFileSync(
    "node",
    ["apps/cli/src/index.js", "demo", "node0-value-loop", "convergence", "--json"],
    { encoding: "utf8", cwd: repoRoot },
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.schema, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_SCHEMA);
  assert.equal(parsed.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_PROOF_CONVERGENCE_TRUTH_LABEL);
});
