// NODE0-CLOSURE-INVARIANTS-1A — review gate. The gate is what makes the ledger
// visible in `npm run check`, so the gate itself needs controls: a gate that
// could only ever say PASS would publish nothing trustworthy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runNode0ClosureInvariantsCheck,
  gatherClosureEvidence,
  CLOSURE_EVIDENCE_ADAPTERS,
  findClosureAuthorityProducers,
  CLOSURE_AUTHORITY_OWNER,
  SUBORDINATE_CLOSURE_SCHEMAS,
} from "../scripts/review/node0-closure-invariants-check.mjs";
import {
  CLOSURE_INVARIANTS,
  INVARIANT_STATUS,
  NODE0_CLOSURE_INVARIANTS_SCHEMA,
} from "../packages/core/src/node0-closure-invariants.js";

test("NCG-01 the gate passes while the ledger is OPEN", () => {
  // THE POINT OF THIS GATE. Closure is genuinely OPEN, and a gate that failed
  // on OPEN would be a gate demanding a lie — someone would then satisfy it by
  // fabricating an observation. It asserts soundness, never closure.
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "OPEN");
  assert.deepEqual(r.blocked_by, []);
  // One adapter exists, so exactly one row is settled. Nine is not a rounding
  // error away from ten: six of the nine describe a running loop.
  assert.equal(r.satisfied_count, 1);
  assert.equal(r.unknown_count, 9);
});

test("NCG-02 the gate publishes the true settled count, not a hopeful one", () => {
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.total, CLOSURE_INVARIANTS.length);
  assert.equal(
    r.satisfied_count + r.violated_count + r.unknown_count,
    CLOSURE_INVARIANTS.length,
  );
  // Every settled row must name the adapter that settled it. If the count ever
  // rises, it must rise because an adapter landed — never because the gate
  // started guessing. The one settled row today binds to an attestation hash.
  assert.equal(r.adapters_registered, CLOSURE_EVIDENCE_ADAPTERS.length);
  for (const row of r.invariants) {
    if (row.status !== INVARIANT_STATUS.UNKNOWN) {
      assert.ok(row.source, `${row.id} is settled and must name its source`);
      assert.match(row.source, /sha256:[0-9a-f]{64}/, `${row.id} source must bind to an artifact`);
    }
  }
  // The settled row is the acceptance one, and it is the only one.
  const settled = r.invariants.filter((row) => row.status === INVARIANT_STATUS.SATISFIED);
  assert.deepEqual(
    settled.map((row) => row.id),
    ["acceptance_is_model_blind"],
  );
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

test("NCG-06 SEMANTIC closure ownership — exactly one surface may emit the flag", () => {
  // The correction that made this necessary: a token grep for `NODE0_CLOSED`
  // proves only that no second producer of that exact string was FOUND. It
  // cannot establish that no second surface can proclaim closure. Measured on
  // this tree: four closure-SHAPED verdict producers exist — mission corridor
  // closure, local closure readiness, omega0 mechanical closure and the
  // invariant ledger — each with its own schema and scope, and only the ledger
  // emits a node-scope flag.
  const found = findClosureAuthorityProducers();
  assert.deepEqual(found.unreadable, [], "an unreadable file makes the scan a partial look");
  assert.deepEqual(
    found.producers,
    [CLOSURE_AUTHORITY_OWNER],
    "a second node-scope closure producer means two paths can proclaim the node closed",
  );
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.semantic_closure_owner, "SINGLE");
  assert.equal(r.ok, true);
});

test("NCG-07 NEGATIVE CONTROL — the scan can actually find a foreign producer", () => {
  // Without this, NCG-06 would pass against a scanner that finds nothing at all,
  // and "SINGLE" would be an artifact of a broken regex rather than a fact.
  const dir = mkdtempSync(join(tmpdir(), "ncg07-"));
  try {
    writeFileSync(join(dir, "impostor.js"), "export const v = { node0_closed: true };\n");
    const found = findClosureAuthorityProducers([dir]);
    assert.equal(found.producers.length, 1, "an emitting file must be detected");

    // And the paired discrimination: READING the owner's verdict is exactly what
    // subordinate surfaces are supposed to do, so it must NOT be flagged.
    writeFileSync(join(dir, "impostor.js"), "if (report.node0_closed) log('open');\n");
    assert.deepEqual(
      findClosureAuthorityProducers([dir]).producers,
      [],
      "reading the ledger is not producing a closure verdict",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("NCG-08 the subordinate closure schemas are distinct from the ledger's", () => {
  // Each is a real closure-shaped verdict at a DIFFERENT scope. If any of them
  // ever shared the ledger's schema, a consumer could read a corridor or corpus
  // verdict as the node's closure decision.
  assert.ok(SUBORDINATE_CLOSURE_SCHEMAS.length >= 3);
  for (const schema of SUBORDINATE_CLOSURE_SCHEMAS) {
    assert.notEqual(schema, NODE0_CLOSURE_INVARIANTS_SCHEMA);
  }
  assert.equal(new Set(SUBORDINATE_CLOSURE_SCHEMAS).size, SUBORDINATE_CLOSURE_SCHEMAS.length);
});
