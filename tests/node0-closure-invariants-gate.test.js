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
  evaluateNode0ClosureInvariants,
} from "../packages/core/src/node0-closure-invariants.js";

test("NCG-01 the gate passes while the ledger is OPEN", () => {
  // THE POINT OF THIS GATE. Closure is genuinely OPEN, and a gate that failed
  // on OPEN would be a gate demanding a lie — someone would then satisfy it by
  // fabricating an observation. It asserts soundness, never closure.
  const r = runNode0ClosureInvariantsCheck();
  assert.equal(r.ok, true);
  assert.equal(r.verdict, "OPEN");
  assert.deepEqual(r.blocked_by, []);
  // Counts are asserted structurally, never pinned: satisfied/unknown must
  // equal the real row classification, and the ledger must account for every
  // invariant. A pinned number here would go stale the day an adapter lands.
  const satisfied = r.invariants.filter((row) => row.status === INVARIANT_STATUS.SATISFIED);
  const unknown = r.invariants.filter((row) => row.status === INVARIANT_STATUS.UNKNOWN);
  assert.equal(r.satisfied_count, satisfied.length);
  assert.equal(r.unknown_count, unknown.length);
  assert.equal(
    r.satisfied_count + r.violated_count + r.unknown_count,
    CLOSURE_INVARIANTS.length,
  );
  // Satisfaction must always be earned: at least the acceptance row — the
  // first adapter ever registered — is settled today.
  assert.ok(
    satisfied.some((row) => row.id === "acceptance_is_model_blind"),
    "acceptance_is_model_blind must remain settled",
  );
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
  // started guessing.
  assert.equal(r.adapters_registered, CLOSURE_EVIDENCE_ADAPTERS.length);
  const registeredInvariants = new Set(
    CLOSURE_EVIDENCE_ADAPTERS.map((adapter) => adapter.invariant_id),
  );
  for (const row of r.invariants) {
    if (row.status !== INVARIANT_STATUS.UNKNOWN) {
      assert.ok(row.source, `${row.id} is settled and must name its source`);
      assert.match(row.source, /sha256:[0-9a-f]{64}/, `${row.id} source must bind to an artifact`);
      if (row.status === INVARIANT_STATUS.SATISFIED) {
        assert.ok(
          registeredInvariants.has(row.id),
          `${row.id} is satisfied but no registered adapter observes it`,
        );
      }
    }
  }
  // The acceptance row is the historically first-settled one and must stay so;
  // the full settled roster grows only as adapters land.
  const settled = r.invariants.filter((row) => row.status === INVARIANT_STATUS.SATISFIED);
  assert.ok(
    settled.some((row) => row.id === "acceptance_is_model_blind"),
    "acceptance_is_model_blind must remain among the settled rows",
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

test("NCG-09 every registered adapter claims exactly the scope its invariant requires", () => {
  // Nothing structural binds an adapter's scope to the registry's: each adapter
  // retypes the string as its own literal rather than importing it.
  //
  // Drift is not currently invisible — but it is only caught by accident. NCG-01
  // pins `satisfied_count` at 1 and NCG-02 pins the settled row's identity, so a
  // typo trips them with "wrong settled count" rather than naming the cause. Both
  // must be edited whenever an adapter legitimately lands, which makes them a
  // moving tripwire rather than an invariant. The one real binding assertion
  // lives in node0-acceptance-model-blind-adapter.test.js and covers that
  // adapter alone.
  //
  // This states the binding as a property of the registry, so adapter #2 inherits
  // it without anyone remembering to write it again.
  assert.ok(CLOSURE_EVIDENCE_ADAPTERS.length > 0, "a registry with no adapters proves nothing");

  for (const adapter of CLOSURE_EVIDENCE_ADAPTERS) {
    const invariant = CLOSURE_INVARIANTS.find((i) => i.id === adapter.invariant_id);
    assert.ok(invariant, `adapter targets unknown invariant: ${adapter.invariant_id}`);
    const observation = adapter.observe();
    // Silence is legitimate — an adapter with nothing to report contributes
    // nothing. Only a produced observation carries a scope to bind.
    if (observation === null || observation === undefined) continue;
    assert.equal(
      observation.scope,
      invariant.required_scope,
      `${adapter.invariant_id}: adapter scope must equal the registry's required_scope`,
    );
  }

  // NEGATIVE CONTROL. The loop above passes trivially if a mismatch could never
  // be detected, so drift one scope deliberately and prove it IS caught — and
  // prove what the runtime does with it. The row does not become VIOLATED and
  // the verdict does not change: it degrades to UNKNOWN, the exact shape of
  // "no instrument exists". A settled invariant is silently unsettled, and the
  // ledger's own verdict cannot tell you it happened.
  const subject = CLOSURE_INVARIANTS.find(
    (i) => i.id === CLOSURE_EVIDENCE_ADAPTERS[0].invariant_id,
  );
  const honest = evaluateNode0ClosureInvariants(gatherClosureEvidence());
  assert.equal(
    honest.invariants.find((r) => r.id === subject.id).status,
    INVARIANT_STATUS.SATISFIED,
    "the control needs a satisfied subject to degrade",
  );

  const drifted = gatherClosureEvidence();
  drifted[subject.id] = { ...drifted[subject.id], scope: `${subject.required_scope}_typo` };
  const report = evaluateNode0ClosureInvariants(drifted);
  const row = report.invariants.find((r) => r.id === subject.id);

  assert.equal(row.status, INVARIANT_STATUS.UNKNOWN);
  assert.equal(row.reason, "observation_scope_mismatch");
  assert.equal(report.satisfied_count, honest.satisfied_count - 1);
  assert.equal(report.verdict, "OPEN", "the drift must not be visible as a verdict change");
});
