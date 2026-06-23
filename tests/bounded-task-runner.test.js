import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runBoundedTask,
  validateBoundedTask,
  BOUNDED_TASK_RUN_SCHEMA,
} from "../packages/tasks/src/bounded-task-runner.js";

// A bounded, read-only fake task + injected approver/verify so the kernel is
// tested in isolation (no stdin, no real verifier).
function fakeTask(overrides = {}) {
  return {
    id: "test.read.preview",
    autonomy_level: "L0",
    description: "a read-only test task",
    scope: "read-only",
    run: async () => ({
      schema: "bizra.dema.task_receipt.v0.1",
      task_id: "test.read.preview",
      scope: "read-only",
      truth_label: "MEASURED",
    }),
    format: () => "formatted",
    ...overrides,
  };
}

const passVerify = () => ({ verdict: "PARTIAL_PLACEHOLDER", accepted: true });

test("validateBoundedTask rejects malformed tasks and accepts a well-formed one", () => {
  assert.equal(validateBoundedTask(null).valid, false);
  assert.equal(validateBoundedTask({}).valid, false);
  assert.equal(validateBoundedTask({ id: "x", autonomy_level: "L0" }).valid, false); // no run
  assert.equal(validateBoundedTask(fakeTask()).valid, true);
});

test("a low-autonomy (L0) task runs without approval and returns a verified result", async () => {
  let approverCalled = false;
  const r = await runBoundedTask(fakeTask(), {
    approver: async () => {
      approverCalled = true;
      return { approved: true };
    },
    verify: passVerify,
  });
  assert.equal(r.schema, BOUNDED_TASK_RUN_SCHEMA);
  assert.equal(r.ran, true);
  assert.equal(r.refused, false);
  assert.equal(r.task_id, "test.read.preview");
  assert.equal(r.autonomy_level, "L0");
  assert.equal(r.receipt.scope, "read-only");
  assert.ok(r.verdict);
  assert.equal(approverCalled, false, "L0 must NOT prompt for approval");
});

test("a malformed autonomy_level is REFUSED, not silently downgraded (fail-closed)", async () => {
  const r = await runBoundedTask(fakeTask({ autonomy_level: "banana" }), {
    verify: passVerify,
  });
  assert.equal(r.ran, false);
  assert.equal(r.refused, true);
  assert.equal(r.reason, "malformed_autonomy_level");
});

test("a high-autonomy (L3) task runs only when the approver approves", async () => {
  const approved = await runBoundedTask(fakeTask({ autonomy_level: "L3" }), {
    approver: async ({ autonomyLevel }) => {
      assert.equal(autonomyLevel, "L3");
      return { approved: true };
    },
    verify: passVerify,
  });
  assert.equal(approved.ran, true);
  assert.equal(approved.autonomy_level, "L3");
});

test("a high-autonomy task is REFUSED when the approver denies", async () => {
  let ran = false;
  const r = await runBoundedTask(
    fakeTask({
      autonomy_level: "L3",
      run: async () => {
        ran = true;
        return {};
      },
    }),
    {
      approver: async () => ({ approved: false, refused_reason: "operator_declined" }),
      verify: passVerify,
    },
  );
  assert.equal(r.refused, true);
  assert.equal(r.reason, "approval_denied");
  assert.equal(r.detail, "operator_declined");
  assert.equal(ran, false, "task.run MUST NOT execute when approval is denied");
});

test("an L5 task routes to the approver as L5 (the runner never auto-runs it)", async () => {
  let sawLevel = null;
  const r = await runBoundedTask(fakeTask({ autonomy_level: "L5" }), {
    approver: async ({ autonomyLevel }) => {
      sawLevel = autonomyLevel;
      return { approved: false, refused_reason: "L5 refused from shell" };
    },
    verify: passVerify,
  });
  assert.equal(sawLevel, "L5");
  assert.equal(r.refused, true);
});

test("the run result is frozen", async () => {
  const r = await runBoundedTask(fakeTask(), { verify: passVerify });
  assert.ok(Object.isFrozen(r));
});
