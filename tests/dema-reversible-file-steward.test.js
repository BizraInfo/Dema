import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaReversibleFileSteward,
  buildDemaReversibleFileStewardPayload,
  verifyDemaReversibleFileSteward,
  runDemaReversibleFileSteward,
  demaReversibleFileStewardBoundary,
  DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
  DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
  DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE,
} from "../packages/core/src/dema-reversible-file-steward.js";
import { runDemaReversibleFileStewardCheck } from "../scripts/review/dema-reversible-file-steward-check.mjs";
import { exampleAttackText } from "../packages/core/src/untrusted-corpus-sanitizer-preview.js";

// DEMA-REVERSIBLE-FILE-STEWARD-1A proof contract. The steward kernel is a PURE
// orchestrator over shipped primitives (planReversibleRename + scanUntrustedText);
// it plans/attests a bounded, consented, content-addressed job and stays all-false.

const GO = DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE;
const VALID = Object.freeze({
  sandbox_root: "sandbox",
  max_atoms: 8,
  atoms: [
    { from: "note.txt", to: "note.SEALED.txt", content_sample: "clean local note - genesis seed" },
    { from: "draft.md", to: "draft.final.md" },
  ],
});

// ── generated skeleton contract (fixtures filled) ──

test("T2a plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaReversibleFileSteward({ consent: "wrong", input: VALID });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("T2b plan is eligible with exact consent and a well-formed job", () => {
  const plan = planDemaReversibleFileSteward({ consent: GO, input: VALID });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
  assert.equal(plan.atom_count, 2);
  assert.equal(plan.bounded, true);
});

test("T6/T12 payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaReversibleFileStewardPayload(VALID);
  assert.equal(payload.schema, DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA);
  assert.equal(payload.truth_label, DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  for (const v of Object.values(payload.boundary)) assert.equal(v, false);
});

test("T12a verify accepts a freshly built payload", () => {
  const payload = buildDemaReversibleFileStewardPayload(VALID);
  assert.equal(verifyDemaReversibleFileSteward(payload).ok, true);
});

test("T12b verify rejects a tampered content_hash", () => {
  const payload = buildDemaReversibleFileStewardPayload(VALID);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaReversibleFileSteward(tampered).ok, false);
});

test("T12c verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaReversibleFileStewardPayload(VALID);
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaReversibleFileSteward(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaReversibleFileStewardCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA);
  assert.equal(result.truth_label, DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL);
});

test("T1/T11 orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaReversibleFileSteward({ consent: GO, input: VALID });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  for (const v of Object.values(result.boundary)) assert.equal(v, false);
});

// ── steward-specific proof contract ──

test("T1 boundary is exactly the frozen all-false 8-key set", () => {
  const b = demaReversibleFileStewardBoundary();
  assert.equal(Object.isFrozen(b), true);
  assert.deepEqual(
    Object.keys(b).sort(),
    ["daemon_started", "execution_allowed", "file_mutation_performed", "live_execution_performed", "model_invocation_performed", "network_used", "token_minted", "wallet_accessed"],
  );
  assert.ok(Object.values(b).every((v) => v === false));
});

test("T3 bounded: exceeding max_atoms fails closed", () => {
  const atoms = Array.from({ length: 5 }, (_, i) => ({ from: `f${i}.txt`, to: `g${i}.txt` }));
  const plan = planDemaReversibleFileSteward({ consent: GO, input: { sandbox_root: "sandbox", max_atoms: 3, atoms } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("max_atoms_exceeded"));
});

test("T4 reversible-only: a no-op rename (from === to) is not reversible", () => {
  const plan = planDemaReversibleFileSteward({ consent: GO, input: { sandbox_root: "sandbox", atoms: [{ from: "a.txt", to: "a.txt" }] } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("atom_not_reversible"));
});

test("T10 fail-closed: a path-escaping atom name is refused", () => {
  const plan = planDemaReversibleFileSteward({ consent: GO, input: { sandbox_root: "sandbox", atoms: [{ from: "../evil.txt", to: "ok.txt" }] } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("atom_not_reversible"));
});

test("T5 sanitizer gate: active-attack content blocks the job", () => {
  const plan = planDemaReversibleFileSteward({
    consent: GO,
    input: { sandbox_root: "sandbox", atoms: [{ from: "a.txt", to: "b.txt", content_sample: exampleAttackText() }] },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("atom_content_blocked"));
  const payload = buildDemaReversibleFileStewardPayload({ sandbox_root: "sandbox", atoms: [{ from: "a.txt", to: "b.txt", content_sample: exampleAttackText() }] });
  assert.equal(payload.atoms[0].sanitizer_verdict, "BLOCKED");
  assert.equal(payload.atoms[0].executable, false);
});

test("T6b content-addressing is deterministic and input-sensitive", () => {
  const a = buildDemaReversibleFileStewardPayload(VALID).content_hash;
  const b = buildDemaReversibleFileStewardPayload(VALID).content_hash;
  assert.equal(a, b, "deterministic");
  const c = buildDemaReversibleFileStewardPayload({ ...VALID, atoms: [{ from: "x.txt", to: "y.txt" }] }).content_hash;
  assert.notEqual(a, c, "different job → different hash");
});

test("empty job is vacuously valid and content-addressed (robustness)", () => {
  const payload = buildDemaReversibleFileStewardPayload({});
  assert.equal(payload.atom_count, 0);
  assert.equal(payload.all_reversible, true);
  assert.equal(payload.all_clean, true);
  assert.equal(verifyDemaReversibleFileSteward(payload).ok, true);
});
