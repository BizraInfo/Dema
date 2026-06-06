import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildTransitionAssuranceReport,
  validateTransitionEventContract,
} from "../scripts/review/transition-assurance-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/review/transition-assurance-check.mjs", import.meta.url),
);

test("transition assurance check proves every sampled transition contract", () => {
  const report = buildTransitionAssuranceReport();

  assert.equal(
    report.schema,
    "bizra.dema.review.transition_assurance_check.v0.1",
  );
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.ok, true);
  assert.ok(report.transitions_checked >= 18);
  assert.equal(report.transitions_failed, 0);
  assert.deepEqual(report.failures, []);
  assert.ok(report.coverage.normal_transitions >= 9);
  assert.ok(report.coverage.halt_transitions >= 7);
  assert.ok(report.coverage.rare_circuits >= 6);
});

test("transition assurance check covers signed mission lifecycle transitions", () => {
  const report = buildTransitionAssuranceReport();

  assert.ok(report.coverage.mission_lifecycle_transitions >= 1);
  assert.ok(
    report.coverage.required_ci_refs.includes(
      "tests/mission-lifecycle.test.js",
    ),
  );
  assert.ok(
    report.samples.some(
      (sample) =>
        sample.category === "mission_lifecycle" &&
        sample.label === "mission_lifecycle_intent_to_closeout" &&
        sample.ok === true,
    ),
  );
});

test("transition assurance check covers URP choose-decision transitions", () => {
  const report = buildTransitionAssuranceReport();

  assert.ok(report.coverage.urp_choose_transitions >= 1);
  assert.ok(
    report.coverage.required_ci_refs.includes(
      "tests/urp-choose-decision.test.js",
    ),
  );
  assert.ok(
    report.samples.some(
      (sample) =>
        sample.category === "urp_choose" &&
        sample.label === "urp_choose_mark_shareable" &&
        sample.ok === true,
    ),
  );
});

test("transition assurance check is read-only and authority-free", () => {
  const report = buildTransitionAssuranceReport();

  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.network_used, false);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.receipt_minted, false);
  assert.equal(report.boundary.chain_advanced, false);
});

test("transition assurance check CLI emits schema-tagged JSON", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);

  assert.equal(
    report.schema,
    "bizra.dema.review.transition_assurance_check.v0.1",
  );
  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
});

test("validateTransitionEventContract rejects a missing objective flag", () => {
  const failures = validateTransitionEventContract({
    label: "bad",
    event: {
      schema: "bizra.dema.agent_kernel_transition.v0.1",
      transition_id: "a->b:c",
      receipt_shape_ready: true,
      transition_contract: {
        explicit: true,
        bounded: true,
        receipt_backed: true,
        rare_circuit_tested: true,
        human_consent_aware: true,
        ihsan_aligned: false,
        ci_enforced: true,
        transition_id: "a->b:c",
        bounds: { max_iterations: 100, payload_key_limit: 20 },
        receipt_backing: {
          event_schema: "bizra.dema.agent_kernel_transition.v0.1",
          receipt_shape_ready: true,
          audit_trail_required: true,
          mint_performed: false,
          chain_advance_performed: false,
        },
        consent: { exact_string_required_for_effects: true },
        ihsan: { refusal_is_valid_proof_event: true },
        rare_circuit_test_refs: ["invalid_kernel_refusal"],
        ci_enforcement_refs: ["tests/agent-kernel.test.js", "npm run check"],
      },
    },
  });

  assert.ok(
    failures.some((failure) => failure.reason === "ihsan_aligned_not_true"),
  );
});
