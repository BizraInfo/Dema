// CLOSED-DUAL-LOOP-DRY-RUN-1A — `dema mission plan` CLI smoke tests.
// Local only, no model, nothing executes. Confirms the subcommand routes, the
// dry-run loop produces a consent-ready plan, and the human output stays honest
// (DESIGNED_NOT_LIVE scaffold, separate execution consent, nothing ran).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

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
});
