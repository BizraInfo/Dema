import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AGENT_DUAL_LOOP_PREVIEW_SCHEMA,
  buildAgentDualLoopPreview,
  formatAgentDualLoopPreview,
} from "../packages/core/src/agent-dual-loop-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(REPO_ROOT, "apps/cli/src/index.js");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-adlp-test-"));
}

function runCLI(args, home = freshHome()) {
  return execFileSync("node", [CLI, ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NO_COLOR: "1",
      NODE_ENV: "test",
      DEMA_NO_TUI: "1",
      DEMA_HOME: home,
    },
    timeout: 15000,
  }).toString();
}

function assertAllFalseBoundary(boundary) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
  assert.equal(boundary.model_invoked, false);
  assert.equal(boundary.receipt_minted, false);
  assert.equal(boundary.token_minted, false);
  assert.equal(boundary.federation_performed, false);
  assert.equal(boundary.reward_emitted, false);
  assert.equal(boundary.policy_updated, false);
  assert.equal(boundary.private_key_read, false);
  assert.equal(boundary.block0_sealed, false);
  assert.equal(boundary.identity_binding_performed, false);
  assert.equal(boundary.poi_reward_emitted, false);
}

test("agent dual-loop preview emits exact schema, truth label, and frozen output", () => {
  const preview = buildAgentDualLoopPreview();

  assert.equal(preview.schema, AGENT_DUAL_LOOP_PREVIEW_SCHEMA);
  assert.equal(preview.schema, "bizra.dema.agent_dual_loop_preview.v0.1");
  assert.equal(preview.truth_label, "PAT_SAT_DUAL_LOOP_PREVIEW_ONLY");
  assert.equal(preview.mode, "preview_only");
  assert.ok(Object.isFrozen(preview));
});

test("PAT-7 and SAT-5 loop surfaces are present with bounded roles", () => {
  const preview = buildAgentDualLoopPreview();

  assert.equal(preview.pat7_loop.status, "DESIGNED_NOT_LIVE");
  assert.deepEqual(preview.pat7_loop.loop, [
    "discover",
    "draft",
    "propose",
    "self_critique",
  ]);
  assert.equal(preview.pat7_loop.runtime_agent_executed, false);
  assert.equal(preview.sat5_loop.status, "DESIGNED_NOT_LIVE");
  assert.deepEqual(preview.sat5_loop.loop, [
    "verify",
    "gate",
    "refuse_or_permit_preview",
    "critique",
  ]);
  assert.equal(preview.sat5_loop.runtime_agent_executed, false);
});

test("parallel merge and SNR choose the deterministic highest-signal micro-slice", () => {
  const preview = buildAgentDualLoopPreview({
    micro_slices: [
      {
        id: "noisy-runtime-leap",
        actionability: 1,
        proof_strength: 1,
        noise: 4,
      },
      {
        id: "pat-sat-dual-loop-preview-1a",
        actionability: 5,
        proof_strength: 4,
        noise: 1,
      },
      {
        id: "medium-doc-only",
        actionability: 3,
        proof_strength: 3,
        noise: 1,
      },
    ],
  });

  assert.equal(preview.parallel_merge.status, "MERGED_PREVIEW_ONLY");
  assert.equal(
    preview.snr_engine.selected_micro_slice.id,
    "pat-sat-dual-loop-preview-1a",
  );
  assert.equal(preview.snr_engine.ranking[0].id, "pat-sat-dual-loop-preview-1a");
  assert.equal(preview.snr_engine.ranking[0].score, 9);
});

test("RSI, HHMM, and proof rails are explicit and preview-only", () => {
  const preview = buildAgentDualLoopPreview();

  assert.equal(preview.rsi_lens.mode, "PREVIEW_ONLY");
  assert.equal(preview.rsi_lens.policy_updated, false);
  assert.equal(preview.hhmm_state.mode, "preview_diffusion_not_runtime_engine");
  assert.ok(
    ["UNDERSTAND", "PLAN", "ACT", "VERIFY", "SETTLE"].includes(
      preview.hhmm_state.phase,
    ),
  );
  for (const rail of ["formal", "cryptographic", "empirical", "economic"]) {
    assert.ok(preview.proof_of_truth_convergence[rail]);
    assert.equal(typeof preview.proof_of_truth_convergence[rail].level, "number");
  }
});

test("reward, PoI, dual-token, and URP surfaces stay designed-not-live", () => {
  const preview = buildAgentDualLoopPreview();

  assert.equal(preview.reward_candidate_lens.status, "DESIGNED_NOT_LIVE");
  assert.equal(preview.reward_candidate_lens.reward_emitted, false);
  assert.equal(preview.reward_candidate_lens.policy_updated, false);
  assert.equal(preview.reward_candidate_lens.token_minted, false);
  assert.equal(preview.flywheel_candidate.proof_of_impact, "DESIGNED_NOT_LIVE");
  assert.equal(preview.flywheel_candidate.dual_token, "DESIGNED_NOT_LIVE");
  assert.equal(preview.flywheel_candidate.urp, "DESIGNED_NOT_LIVE");
});

test("missing and unsafe reward references fail closed as inert signals", () => {
  const missing = buildAgentDualLoopPreview({ reward_refs: [] });
  const unsafe = buildAgentDualLoopPreview({
    reward_refs: [
      { id: "mint-now", status: "emit_reward", proof_tier: "unverified" },
    ],
  });

  assert.equal(missing.reward_candidate_lens.signal_status, "NO_REWARD_REFS");
  assert.equal(missing.reward_candidate_lens.future_training_signal_allowed, false);
  assert.equal(unsafe.reward_candidate_lens.status, "RESEARCH_QUARANTINE");
  assert.equal(unsafe.reward_candidate_lens.signal_status, "BLOCKED_BY_BOUNDARY");
  assert.equal(unsafe.reward_candidate_lens.reward_emitted, false);
  assert.equal(unsafe.reward_candidate_lens.policy_updated, false);
  assert.equal(unsafe.reward_candidate_lens.token_minted, false);
});

test("boundary flags remain false including domain-specific economic and runtime effects", () => {
  const preview = buildAgentDualLoopPreview();
  assertAllFalseBoundary(preview.boundary);
});

test("human formatter names preview-only posture and forbidden runtime effects", () => {
  const formatted = formatAgentDualLoopPreview(buildAgentDualLoopPreview());

  assert.match(formatted, /PAT\/SAT Dual Loop Preview/);
  assert.match(formatted, /preview-only/i);
  assert.match(formatted, /no runtime agent execution/i);
  assert.match(formatted, /no reward emission/i);
  assert.match(formatted, /no token or PoI runtime/i);
});

test("agent-loop dual-preview CLI emits JSON and writes nothing to DEMA_HOME", () => {
  const home = freshHome();
  const before = readdirSync(home).sort();
  const parsed = JSON.parse(
    runCLI(["agent-loop", "dual-preview", "--json"], home),
  );
  const after = readdirSync(home).sort();

  assert.equal(parsed.schema, AGENT_DUAL_LOOP_PREVIEW_SCHEMA);
  assert.equal(parsed.truth_label, "PAT_SAT_DUAL_LOOP_PREVIEW_ONLY");
  assert.deepEqual(after, before);
  assert.deepEqual(after, []);
});

test("agent-loop dual-preview human path says preview-only", () => {
  const out = runCLI(["agent-loop", "dual-preview"]);

  assert.match(out, /PAT\/SAT Dual Loop Preview/);
  assert.match(out, /preview-only/i);
});
