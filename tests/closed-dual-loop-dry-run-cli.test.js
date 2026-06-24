// CLOSED-DUAL-LOOP-DRY-RUN-1A — `dema mission plan` CLI smoke tests.
// Local only, no model, nothing executes. Confirms the subcommand routes, the
// dry-run loop produces a consent-ready plan, and the human output stays honest
// (DESIGNED_NOT_LIVE scaffold, separate execution consent, nothing ran).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildModelEvalBaseline } from "../packages/core/src/model-eval-baseline.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function makeBaseline() {
  return buildModelEvalBaseline({
    generated_at_iso: "2026-06-24T00:00:00.000Z",
    suite_id: "bizra-local-small",
    provider_discovery: {},
    models_tested: ["ollama:fast", "ollama:wise"],
    results_by_model: {
      "ollama:fast": {
        tasks: {
          endpoint_reachable: { reachable: true, latency_ms: 80, output: "" },
          latency_ms: { reachable: true, latency_ms: 80, output: "ok" },
          json_obedience: { reachable: true, latency_ms: 80, output: '{"ok":true}' },
          code_microtask: { reachable: true, latency_ms: 80, output: "" },
          no_overclaim: { reachable: true, latency_ms: 80, output: "small local model" },
          truth_boundary: { reachable: true, latency_ms: 80, output: "price will be 100000" },
        },
      },
      "ollama:wise": {
        tasks: {
          endpoint_reachable: { reachable: true, latency_ms: 250, output: "" },
          latency_ms: { reachable: true, latency_ms: 250, output: "ok" },
          json_obedience: { reachable: true, latency_ms: 250, output: '{"ok":true}' },
          code_microtask: { reachable: true, latency_ms: 250, output: "def f():\n return 42" },
          no_overclaim: { reachable: true, latency_ms: 250, output: "careful local model" },
          truth_boundary: { reachable: true, latency_ms: 250, output: "I cannot predict that" },
        },
      },
    },
  });
}

function plan(args) {
  return execFileSync("node", [BIN, "mission", "plan", ...args], {
    encoding: "utf8",
  });
}

test("no answers → not_ready, points back to the interview", () => {
  const d = JSON.parse(plan(["--json"]));
  assert.equal(d.dry_run_status, "not_ready");
  assert.equal(d.consent_ready_plan, null);
});

test("pain + goal → consent_ready with PAT proposal + SAT verdict", () => {
  const d = JSON.parse(
    plan(["--pain", "releases break", "--goal", "ship a reliable release weekly", "--json"]),
  );
  assert.equal(d.dry_run_status, "consent_ready");
  assert.equal(d.pat_proposal.status, "DESIGNED_NOT_LIVE");
  assert.equal(d.sat_verdict.gate_verdict, "PERMIT_PLAN_PREVIEW");
  assert.equal(d.consent_ready_plan.executed, false);
});

test("human output is honest — scaffold, no model, nothing executed", () => {
  const out = plan(["--pain", "x", "--goal", "build a dashboard"]);
  assert.match(out, /no model/i);
  assert.match(out, /NOT model reasoning|scaffold/i);
  assert.match(out, /DESIGNED_NOT_LIVE/);
  assert.match(out, /NOTHING has run|nothing executed/i);
  // The separate execution consent must be surfaced, not crossed.
  assert.match(out, /GO: execute this plan/);
});

test("not-ready human output routes to the interview", () => {
  const out = plan([]);
  assert.match(out, /interview/i);
});

test("boundary is canonical — no model / network / runtime / task", () => {
  const d = JSON.parse(plan(["--pain", "x", "--goal", "y", "--json"]));
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.equal(d.boundary.network_used, false);
  assert.equal(d.boundary.runtime_execution_performed, false);
  assert.equal(d.boundary.tool_executed, false);
  assert.equal(d.boundary.filesystem_write_performed, false);
  assert.equal(d.measured_routing_context, null);
});

test("--baseline attaches measured_routing_context in JSON and human output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mission-plan-"));
  const file = join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeBaseline()));
  const d = JSON.parse(
    plan(["--pain", "x", "--goal", "build a dashboard", "--baseline", file, "--json"]),
  );
  assert.equal(d.dry_run_status, "consent_ready");
  assert.equal(d.measured_routing_context.truth_label, "MEASURED_ROUTING_CONTEXT_PREVIEW_ONLY");
  assert.equal(d.measured_routing_context.talk_env_hint.provider, "ollama");
  const out = plan(["--pain", "x", "--goal", "build a dashboard", "--baseline", file]);
  assert.match(out, /Measured routing context/);
  assert.match(out, /DEMA_TALK_PROVIDER=ollama/);
});
