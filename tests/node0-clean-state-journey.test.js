// CSJ-01…08 — NODE0-CLEAN-STATE-JOURNEY-1A.
//
// docs/NODE0_DEMA_URP_FLAGSHIP_DOD.md §14 names the gap this closes: "Node0
// closed-loop clean-state demo not yet complete. Genesis needs replayable
// proof, not only green CI." Every other suite proves a code path in isolation;
// this one proves ONE operator journey from nothing, through the real CLI, in
// the order the DoD's own §16 next-micro specifies.
//
// The load-bearing test is CSJ-02 + CSJ-03 as a PAIR. CSJ-02 proves the
// published `journey_invariant_hash` is identical across two independent clean
// homes — that is what makes a stranger's reproduction meaningful. CSJ-03
// proves the environment-bound values genuinely DIFFER between those same two
// runs. Without CSJ-03, CSJ-02 could be satisfied by freezing everything into a
// constant and would prove nothing at all.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runNode0CleanStateJourney,
  NODE0_JOURNEY_SCHEMA,
  NODE0_JOURNEY_TRUTH_LABEL,
} from "../scripts/proof/node0-clean-state-journey.mjs";

const EXPECTED_STEPS = [
  "welcome",
  "setup",
  "setup-check",
  "status",
  "urp-launch-5sat",
  "receipt-read",
  "covenant-screen",
  "covenant-consent-refused",
  "urp-list",
];

describe("NODE0 clean-state journey", () => {
  test("CSJ-01: the full DoD sequence runs from nothing, in order, every step ok", () => {
    const report = runNode0CleanStateJourney();
    assert.equal(report.schema, NODE0_JOURNEY_SCHEMA);
    assert.equal(report.truth_label, NODE0_JOURNEY_TRUTH_LABEL);
    assert.deepEqual(report.steps.map((s) => s.id), EXPECTED_STEPS);
    const failed = report.steps.filter((s) => !s.ok).map((s) => s.id);
    assert.deepEqual(failed, [], `failing steps: ${failed.join(", ")}`);
  });

  test("CSJ-02: the invariant hash reproduces across two independent clean homes", () => {
    const a = runNode0CleanStateJourney();
    const b = runNode0CleanStateJourney();
    assert.equal(
      a.journey_invariant_hash,
      b.journey_invariant_hash,
      "two honest clean-state runs must publish the same witness value",
    );
    assert.match(a.journey_invariant_hash, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(a.cross_machine_invariants, b.cross_machine_invariants);
  });

  test("CSJ-03: the environment-bound values genuinely differ between those runs", () => {
    const a = runNode0CleanStateJourney();
    const b = runNode0CleanStateJourney();
    // If any of these ever stops differing, the split has silently collapsed and
    // CSJ-02 stops being evidence of anything.
    assert.notEqual(a.environment_bound.dema_home, b.environment_bound.dema_home);
    assert.notEqual(
      a.environment_bound.urp_launch_hash,
      b.environment_bound.urp_launch_hash,
      "launch_hash is environment-bound — publishing it as a constant would fail honest reproductions",
    );
    assert.notEqual(
      a.environment_bound.covenant_decision_id,
      b.environment_bound.covenant_decision_id,
      "decision_id embeds a live clock read",
    );
    assert.notEqual(
      a.environment_bound.profile_sha256,
      b.environment_bound.profile_sha256,
    );
    // …while the content-bound covenant hash is the same object every time.
    assert.equal(
      a.cross_machine_invariants.covenant.proposal_hash,
      b.cross_machine_invariants.covenant.proposal_hash,
    );
  });

  test("CSJ-04: the consent gate is proven to REFUSE without a signing key", () => {
    const report = runNode0CleanStateJourney();
    const step = report.steps.find((s) => s.id === "covenant-consent-refused");
    assert.equal(step.expect_refusal, true);
    assert.notEqual(step.exit_code, 0, "a clean-state journey must not be able to sign");
    assert.equal(step.ok, true, "the refusal IS the evidence, so the step passes");
    assert.equal(
      report.cross_machine_invariants.covenant_consent_refusal.error,
      "covenant_consent_failed",
    );
    // The screened decision stops at consent — it never claims a signed receipt.
    assert.equal(report.cross_machine_invariants.covenant.status, "needs_human_consent");
  });

  test("CSJ-05: it refuses to run against an already-initialised DEMA_HOME", () => {
    const home = mkdtempSync(join(tmpdir(), "csj-occupied-"));
    try {
      writeFileSync(join(home, "profile.json"), "{}\n");
      assert.throws(
        () => runNode0CleanStateJourney({ home }),
        /refusing to run against an initialised DEMA_HOME/,
      );
      // An operator home is never a fixture: nothing was added to it.
      assert.equal(existsSync(join(home, "receipts")), false);
      assert.equal(existsSync(join(home, "urp")), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("CSJ-06: an owned run leaves no home behind", () => {
    const report = runNode0CleanStateJourney();
    assert.equal(
      existsSync(report.environment_bound.dema_home),
      false,
      "the harness removes the home it created",
    );
  });

  test("CSJ-07: the boundary is all-false and the non-claims are explicit", () => {
    const report = runNode0CleanStateJourney();
    for (const [key, value] of Object.entries(report.cross_machine_invariants.boundary)) {
      assert.equal(value, false, `boundary.${key} must be false`);
    }
    const nonClaims = report.does_not_prove.join(" | ");
    assert.match(nonClaims, /NODE0_CLOSED remains false/);
    assert.match(nonClaims, /TASK-029/);
    assert.match(nonClaims, /federation|Node1/);
  });

  test("CSJ-08: the published hash actually binds the invariant set", async () => {
    const report = runNode0CleanStateJourney();
    const { sha256CanonicalJsonV1 } = await import(
      "../packages/canon/src/sha256-canonical-json-v1.js"
    );
    // Re-derivation from the carried body must reproduce the published value…
    assert.equal(
      sha256CanonicalJsonV1(report.cross_machine_invariants),
      report.journey_invariant_hash,
    );
    // …and any tampering with what the journey claims must change it.
    const forged = {
      ...report.cross_machine_invariants,
      covenant_consent_refusal: { error: null, reason: "signed" },
    };
    assert.notEqual(sha256CanonicalJsonV1(forged), report.journey_invariant_hash);
  });
});
