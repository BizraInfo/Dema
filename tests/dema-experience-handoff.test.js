import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  EXPERIENCE_HANDOFF_SCHEMA,
  buildExperienceHandoffCard,
  formatExperienceHandoffCard,
  demaExperienceHandoffBoundary,
} from "../packages/core/src/dema-experience-handoff.js";

describe("DEMA-EXPERIENCE-HANDOFF-1A", () => {
  test("EH-01 projects observed handoff and flags feature-only pass", () => {
    const card = buildExperienceHandoffCard({
      session_id: "goal-session-20261101",
      base_sha: "f9726b6b82e3048f0091601128754b10f3bfbe03",
      head_sha: "aa517a8bb2c94cf6bfb0ce582bb168ae8df3ae68",
      new_behavior: { label: "focused_ax_tests", passed: 6, failed: 0, total: 6 },
      regression: { label: "prior_suite_proxy", passed: 0, failed: 3, total: 3 },
      structural_changes: ["added dema-ax-liftoff.js"],
      observed_facts: ["focused ax tests 6/6 green"],
      inferences: ["full suite may still carry unrelated reds"],
      untested_advice: ["always rerun prior regression before promote"],
      open_questions: ["which season continues?"],
      cost_usd: null,
    });
    assert.equal(card.ok, true);
    assert.equal(card.schema, EXPERIENCE_HANDOFF_SCHEMA);
    assert.equal(card.feature_only_pass_detected, true);
    assert.equal(card.evidence_level, "OBSERVED");
    assert.equal(card.authority_delta, 0);
    assert.match(formatExperienceHandoffCard(card), /feature_only_pass_detected: true/);
  });

  test("EH-02 missing session_id ⇒ UNKNOWN fail-closed", () => {
    const card = buildExperienceHandoffCard({});
    assert.equal(card.ok, false);
    assert.equal(card.evidence_level, "UNKNOWN");
  });

  test("EH-03 advice-only with no observed facts ⇒ not OBSERVED", () => {
    const card = buildExperienceHandoffCard({
      session_id: "s1",
      untested_advice: ["review the plan"],
    });
    assert.equal(card.evidence_level, "UNTESTED_ADVICE");
  });

  test("EH-03b session-only card stays UNKNOWN until evidence arrives", () => {
    const card = buildExperienceHandoffCard({ session_id: "s-empty" });
    assert.equal(card.ok, true);
    assert.equal(card.evidence_level, "UNKNOWN");
    const text = formatExperienceHandoffCard(card);
    assert.match(text, /truth_label:/);
    assert.match(text, /preview:/);
  });

  test("EH-04 boundary all-false; never invents NODE0_CLOSED", () => {
    const b = demaExperienceHandoffBoundary();
    for (const v of Object.values(b)) assert.equal(v, false);
    const card = buildExperienceHandoffCard({ session_id: "s1", observed_facts: ["x"] });
    assert.equal("node0_closed" in card, false);
    assert.match(card.what_this_does_not_prove, /NODE0_CLOSED/);
  });
});
