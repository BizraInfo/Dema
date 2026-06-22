// PAIN-GOAL-INTERVIEW-1A — `dema mission interview` CLI smoke tests.
// Local only, no model. Confirms the subcommand routes, the proposal is
// proposal-only, and the human output keeps Dema's claim modest (captured what
// the user STATED — not "understands you").
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function interview(args) {
  return execFileSync("node", [BIN, "mission", "interview", ...args], {
    encoding: "utf8",
  });
}

test("no answers → status empty with the interview questions", () => {
  const d = JSON.parse(interview(["--json"]));
  assert.equal(d.interview_status, "empty");
  assert.ok(d.interview_questions.length >= 5);
  assert.deepEqual([...d.missing_fields].sort(), ["desired_goal", "pain_point"]);
});

test("pain only → partial, missing the goal", () => {
  const d = JSON.parse(interview(["--pain", "my releases keep breaking", "--json"]));
  assert.equal(d.interview_status, "partial");
  assert.ok(d.missing_fields.includes("desired_goal"));
});

test("pain + goal → ready, with a proposal-only first mission + normalized fields", () => {
  const d = JSON.parse(
    interview([
      "--pain", "releases break",
      "--goal", "ship a reliable release weekly",
      "--urgency", "NOW",
      "--style", "Plan",
      "--json",
    ]),
  );
  assert.equal(d.interview_status, "ready_for_first_mission_preview");
  assert.equal(d.urgency_level, "now");
  assert.equal(d.preferred_help_style, "plan");
  assert.equal(d.first_mission_candidate.status, "PROPOSAL_ONLY");
  assert.equal(d.first_mission_candidate.executed, false);
});

test("human output is honest — STATED not understood, no model, no save", () => {
  const out = interview(["--pain", "x", "--goal", "build a dashboard"]);
  assert.match(out, /no model called/i);
  assert.match(out, /PROPOSAL ONLY/);
  assert.match(out, /STATED/);
  assert.match(out, /not understood you fully|have not understood/i);
});

test("PARTIAL render also carries the disclaimer — echoing pain is NOT understanding", () => {
  // The partial branch echoes the user's stated pain back; the honesty guard
  // must fire here too, this is the surface most exposed to emotional overreach.
  const out = interview(["--pain", "my releases keep breaking"]);
  assert.match(out, /So far/);
  assert.match(out, /not understood you fully|have not understood/i);
});

test("boundary is canonical — no model / network / runtime / task", () => {
  const d = JSON.parse(interview(["--json"]));
  assert.equal(d.boundary.model_invocation_performed, false);
  assert.equal(d.boundary.network_used, false);
  assert.equal(d.boundary.runtime_execution_performed, false);
  assert.equal(d.boundary.tool_executed, false);
  assert.equal(d.boundary.filesystem_write_performed, false);
});
