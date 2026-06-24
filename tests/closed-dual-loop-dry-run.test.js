// CLOSED-DUAL-LOOP-DRY-RUN-1A — pure dry-run loop kernel tests.
// Takes the captured pain/goal (via the interview kernel), runs a DRY-RUN
// PAT-propose -> SAT-verify loop, and presents a consent-ready plan. Nothing
// executes. No model, no task, no runtime. The honesty crux: the PAT "proposal"
// is a DETERMINISTIC scaffold labelled DESIGNED_NOT_LIVE — it must NOT pose as
// model reasoning, and the plan must require a SEPARATE consent to ever run.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildClosedDualLoopDryRun,
  buildSatVerdict,
  CLOSED_DUAL_LOOP_DRY_RUN_SCHEMA,
} from "../packages/core/src/closed-dual-loop-dry-run.js";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";
import { buildModelRoutingPreview } from "../packages/core/src/model-routing-preview.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/closed-dual-loop-dry-run.js", import.meta.url),
);

const CANONICAL_EFFECT_KEYS = [
  "model_invocation_performed",
  "model_loaded",
  "prompt_executed",
  "network_used",
  "runtime_execution_performed",
  "tool_executed",
  "filesystem_write_performed",
  "federation_invoked",
  "receipt_mint_performed",
];

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [k, c] of Object.entries(value)) {
    if (c && typeof c === "object") assertDeepFrozen(c, `${label}.${k}`);
  }
}

test("no pain/goal → not_ready, no plan, points back to the interview", () => {
  const r = buildClosedDualLoopDryRun({});
  assert.equal(r.dry_run_status, "not_ready");
  assert.ok(r.missing_fields.includes("pain_point"));
  assert.equal(r.consent_ready_plan, null);
});

test("pain + goal → consent_ready, with PAT proposal + SAT verdict + a plan", () => {
  const r = buildClosedDualLoopDryRun({
    pain: "releases keep breaking",
    goal: "ship a reliable release weekly",
  });
  assert.equal(r.dry_run_status, "consent_ready");
  assert.ok(r.pat_proposal);
  assert.ok(r.sat_verdict);
  assert.ok(r.consent_ready_plan);
  assert.match(r.consent_ready_plan.mission, /reliable release/i);
});

test("both loops are DESIGNED_NOT_LIVE — no live agents ran", () => {
  const r = buildClosedDualLoopDryRun({ pain: "x", goal: "y" });
  assert.equal(r.pat_proposal.status, "DESIGNED_NOT_LIVE");
  assert.equal(r.sat_verdict.status, "DESIGNED_NOT_LIVE");
  assert.equal(r.sat_verdict.gate_verdict, "PERMIT_PLAN_PREVIEW");
});

test("SAT gate is DERIVED not asserted — it REFUSES when state is poisoned", () => {
  // The verdict must read real boundary/plan state, not a hardcoded `true`. Feed
  // it a boundary that claims a model WAS invoked and an executed plan: a real
  // gate must flip the matching checks false and refuse the preview.
  const poisoned = buildSatVerdict({
    boundary: {
      model_invocation_performed: true,
      runtime_execution_performed: true,
    },
    plan: { executed: true, execution_consent_required: "" },
  });
  assert.equal(poisoned.gate_verdict, "REFUSE_PLAN_PREVIEW");
  for (const c of poisoned.checks) assert.equal(c.passed, false, c.check);

  // And it PERMITS only when every signal reads clean.
  const clean = buildSatVerdict({
    boundary: {
      model_invocation_performed: false,
      runtime_execution_performed: false,
    },
    plan: { executed: false, execution_consent_required: "GO: execute this plan" },
  });
  assert.equal(clean.gate_verdict, "PERMIT_PLAN_PREVIEW");
});

test("PAT proposal is an HONEST scaffold — labelled not-model-reasoned", () => {
  const r = buildClosedDualLoopDryRun({ pain: "x", goal: "build a dashboard" });
  assert.ok(Array.isArray(r.pat_proposal.proposed_steps));
  assert.ok(r.pat_proposal.proposed_steps.length >= 1);
  // It must disclaim model authorship — a deterministic scaffold, not reasoning.
  assert.match(r.pat_proposal.note, /scaffold|deterministic|not.*model|no model/i);
});

test("the plan requires a SEPARATE execution consent and is NOT executed", () => {
  const r = buildClosedDualLoopDryRun({ pain: "x", goal: "y" });
  assert.equal(r.consent_ready_plan.executed, false);
  assert.ok(
    typeof r.consent_ready_plan.execution_consent_required === "string" &&
      r.consent_ready_plan.execution_consent_required.length > 0,
    "an exact phrase is required to ever execute (a later slice)",
  );
});

test("HONESTY — does not claim a model reasoned, runtime is live, or anything ran", () => {
  const text = buildClosedDualLoopDryRun({ pain: "x", goal: "y" })
    .what_this_does_not_prove.join(" ");
  assert.match(text, /model/i);
  assert.match(text, /executed|ran|execution/i);
  assert.match(text, /DESIGNED_NOT_LIVE|not live|runtime/i);
});

test("boundary is canonical and all-false — no model/task/runtime/etc.", () => {
  for (const input of [{}, { pain: "x", goal: "y" }]) {
    const r = buildClosedDualLoopDryRun(input);
    for (const key of CANONICAL_EFFECT_KEYS) {
      assert.equal(r.boundary[key], false, `boundary.${key} must be false`);
    }
  }
});

test("schema + truth_label exact; deep-frozen", () => {
  const r = buildClosedDualLoopDryRun({ pain: "x", goal: "y" });
  assert.equal(r.schema, "bizra.dema.closed_dual_loop_dry_run.v0.1");
  assert.equal(r.schema, CLOSED_DUAL_LOOP_DRY_RUN_SCHEMA);
  assert.equal(r.truth_label, "CLOSED_DUAL_LOOP_DRY_RUN_LOCAL_ONLY");
  assert.equal(r.mode, "preview_only");
  assertDeepFrozen(r, "dryrun");
});

test("optional routing_preview attaches measured_routing_context without invoking talk", () => {
  const baseline = buildModelEvalBaseline({
    generated_at_iso: "2026-06-24T00:00:00.000Z",
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
          no_overclaim: { reachable: true, latency_ms: 80, output: "a small local model" },
          truth_boundary: { reachable: true, latency_ms: 80, output: "I cannot predict that" },
        },
      },
    },
  });
  const routing_preview = buildModelRoutingPreview({ baseline, generated_at_iso: "2026-06-24T00:00:00.000Z" });
  const r = buildClosedDualLoopDryRun({
    pain: "slow routing",
    goal: "wire measured hints",
    routing_preview,
  });
  assert.equal(r.dry_run_status, "consent_ready");
  assert.ok(r.measured_routing_context);
  assert.equal(r.measured_routing_context.truth_label, "MEASURED_ROUTING_CONTEXT_PREVIEW_ONLY");
  assert.equal(r.measured_routing_context.talk_env_hint.provider, "ollama");
  assert.equal(r.measured_routing_context.talk_env_hint.model, "fast");
  assert.equal(r.boundary.model_invocation_performed, false);
  assert.ok(r.next_safe_actions.includes("optional_talk_smoke_with_exported_env"));
});

test("rejected routing_preview → measured_routing_context null", () => {
  const r = buildClosedDualLoopDryRun({
    pain: "x",
    goal: "y",
    routing_preview: { rejected: true, reason_code: "input_baseline_invalid" },
  });
  assert.equal(r.measured_routing_context, null);
});

test("module imports no node fs/net/http/child_process/os directly", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
