// NODE0-CLOSURE-INVARIANTS-1A — review gate. The gate is what makes the ledger
// visible in `npm run check`, so the gate itself needs controls: a gate that
// could only ever say PASS would publish nothing trustworthy.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runNode0ClosureInvariantsCheck,
  gatherClosureEvidence,
  CLOSURE_EVIDENCE_ADAPTERS,
} from "../scripts/review/node0-closure-invariants-check.mjs";
import {
  CLOSURE_INVARIANTS,
  INVARIANT_STATUS,
} from "../packages/core/src/node0-closure-invariants.js";

test("NCG-01 the gate passes while the ledger is OPEN", () => {
  // THE POINT OF THIS GATE. Closure is genuinely OPEN, and a gate that failed
  // on OPEN would be a gate demanding a lie — someone would then satisfy it by
  // fabricating an observation. It asserts soundness, never closure.
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "OPEN");
  assert.deepEqual(r.blocked_by, []);
});

test("NCG-02 the gate publishes the true settled count, not a hopeful one", () => {
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.total, CLOSURE_INVARIANTS.length);
  assert.equal(
    r.satisfied_count + r.violated_count + r.unknown_count,
    CLOSURE_INVARIANTS.length,
  );
  // Measured on this tree: no adapter exists for any invariant, so every row is
  // UNKNOWN and every row is sourceless. If this ever changes, it must change
  // because an adapter landed — not because the gate started guessing.
  assert.equal(r.adapters_registered, CLOSURE_EVIDENCE_ADAPTERS.length);
  for (const row of r.invariants) {
    if (row.status !== INVARIANT_STATUS.UNKNOWN) {
      assert.ok(row.source, `${row.id} is settled and must name its source`);
    }
  }
});

test("NCG-03 an adapter returning null contributes nothing, and never satisfaction", () => {
  // Silence is the normal output of an adapter that could not observe. It must
  // land as absent evidence — which the kernel scores UNKNOWN — and must never
  // become a key holding null, which is a different and weaker refusal.
  const evidence = gatherClosureEvidence([
    { invariant_id: "acceptance_is_model_blind", observe: () => null },
    { invariant_id: "remote_write", observe: () => undefined },
  ]);
  assert.deepEqual(evidence, {});
});

test("NCG-04 a real observation from an adapter does reach the ledger", () => {
  // The paired positive control for NCG-03. Without it, NCG-03 would pass
  // against a gatherer that discards everything.
  const inv = CLOSURE_INVARIANTS[0];
  const observation = {
    observed: inv.required,
    source: "ncg-04-fixture",
    scope: inv.required_scope,
  };
  const evidence = gatherClosureEvidence([
    { invariant_id: inv.id, observe: () => observation },
  ]);
  assert.deepEqual(evidence, { [inv.id]: observation });
});

test("NCG-05 the gate opens no boundary", () => {
  const r = runNode0ClosureInvariantsCheck();
  for (const [key, value] of Object.entries(r.boundary)) {
    assert.equal(value, false, `${key} must stay false`);
  }
  assert.match(r.what_this_does_not_prove, /does not prove Node0 is closed/i);
});
