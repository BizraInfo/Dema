import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  loadClauseRegistry,
  buildRootTrace,
  verifyRootTrace,
  runRootClauseTracePreview,
  rootClauseTraceBoundary,
  ROOT_CLAUSE_TRACE_SCHEMA,
  ROOT_CLAUSE_TRACE_EVAL_SCHEMA,
  ROOT_CLAUSE_TRACE_TRUTH_LABEL,
  REQUIRED_ROOTS,
} from "../packages/consent/src/root-clause-trace-preview.js";
import { runRootClauseTracePreviewCheck } from "../scripts/review/root-clause-trace-preview-check.mjs";
import {
  buildPreviewBoundary,
  isCanonicalBoundary,
} from "../packages/core/src/boundary-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY = loadClauseRegistry(
  JSON.parse(
    readFileSync(
      join(__dirname, "..", "docs", "canon", "BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json"),
      "utf8",
    ),
  ),
);

// One clause id per root — a complete, valid three-root selection.
const VALID_IDS = ["MSG-DIGNITY-01", "SEED-CONSENT-01", "TF-PROOF-CONSENT-01"];
// MESSAGE + SEED only — missing THIRD_FACT.
const INCOMPLETE_IDS = ["MSG-DIGNITY-01", "SEED-CONSENT-01"];

function traceOf(clause_ids) {
  return buildRootTrace({ clause_ids, registry: REGISTRY });
}
function verify(trace) {
  return verifyRootTrace({ trace, registry: REGISTRY });
}

// --- invariants ---

test("boundary is the canonical all-false object (deep-equal, not vacuous)", () => {
  const boundary = rootClauseTraceBoundary();
  assert.deepEqual(boundary, buildPreviewBoundary());
  assert.ok(isCanonicalBoundary(boundary));
  for (const value of Object.values(boundary)) assert.equal(value, false);
});

test("required roots are exactly MESSAGE, SEED, THIRD_FACT", () => {
  assert.deepEqual([...REQUIRED_ROOTS].sort(), ["MESSAGE", "SEED", "THIRD_FACT"]);
});

test("every trace and verdict carries authority_delta 0 and the canonical boundary", () => {
  const trace = traceOf(VALID_IDS);
  const permit = verify(trace);
  const block = verify(traceOf(INCOMPLETE_IDS));
  assert.equal(trace.authority_delta, 0);
  assert.deepEqual(trace.boundary, buildPreviewBoundary());
  assert.equal(trace.schema, ROOT_CLAUSE_TRACE_SCHEMA);
  for (const verdict of [permit, block]) {
    assert.equal(verdict.authority_delta, 0);
    assert.deepEqual(verdict.boundary, buildPreviewBoundary());
    assert.equal(verdict.schema, ROOT_CLAUSE_TRACE_EVAL_SCHEMA);
    assert.equal(verdict.truth_label, ROOT_CLAUSE_TRACE_TRUTH_LABEL);
  }
});

// --- positive ---

test("a valid three-root selection PERMITs with a stable root_set_hash", () => {
  const trace = traceOf(VALID_IDS);
  assert.equal(trace.schema, ROOT_CLAUSE_TRACE_SCHEMA);
  assert.equal(trace.truth_label, ROOT_CLAUSE_TRACE_TRUTH_LABEL);
  assert.match(trace.root_set_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(trace.clauses.length, 3);

  const verdict = verify(trace);
  assert.equal(verdict.accepted, true, verdict.reason);
  assert.equal(verdict.verdict, "PERMIT_PREVIEW");
  assert.deepEqual(verdict.blocked_by, []);
});

// --- fail-closed contract (one per case) ---

test("1: a clause_id not present in the registry BLOCKS (unknown_clause)", () => {
  const trace = traceOf(["MSG-DIGNITY-01", "SEED-CONSENT-01", "TF-PROOF-CONSENT-01", "NOPE-99"]);
  const verdict = verify(trace);
  assert.equal(verdict.accepted, false);
  assert.equal(verdict.verdict, "BLOCK");
  assert.ok(verdict.blocked_by.includes("unknown_clause"));
});

test("2: a selection missing one of the three roots BLOCKS (three_root_set_incomplete)", () => {
  const verdict = verify(traceOf(INCOMPLETE_IDS));
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("three_root_set_incomplete"));
});

test("2b: even an all-MESSAGE selection BLOCKS (roots must all be represented)", () => {
  const verdict = verify(traceOf(["MSG-DIGNITY-01", "MSG-EQUALITY-01", "MSG-IHSAN-01"]));
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("three_root_set_incomplete"));
});

test("3: a clause whose clause_hash != the registry's clause_hash BLOCKS (clause_hash_mismatch)", () => {
  const trace = traceOf(VALID_IDS);
  const tampered = {
    ...trace,
    clauses: trace.clauses.map((c, i) =>
      i === 0 ? { ...c, clause_hash: `sha256:${"0".repeat(64)}` } : c,
    ),
  };
  const verdict = verify(tampered);
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("clause_hash_mismatch"));
});

test("4: an empty clause set BLOCKS (empty_clause_set)", () => {
  const verdict = verify(traceOf([]));
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("empty_clause_set"));
});

test("5: a recomputed root_set_hash != the trace's root_set_hash BLOCKS (root_set_hash_mismatch)", () => {
  const trace = traceOf(VALID_IDS);
  const tampered = { ...trace, root_set_hash: `sha256:${"a".repeat(64)}` };
  const verdict = verify(tampered);
  assert.equal(verdict.accepted, false);
  assert.ok(verdict.blocked_by.includes("root_set_hash_mismatch"));
  // isolated: the clauses were untouched, so no clause_hash_mismatch fires
  assert.ok(!verdict.blocked_by.includes("clause_hash_mismatch"));
});

// --- determinism ---

test("identical {clause_ids, registry} yields an identical trace + root_set_hash", () => {
  const a = traceOf(VALID_IDS);
  const b = traceOf([...VALID_IDS]);
  assert.deepEqual(a, b);
  assert.equal(a.root_set_hash, b.root_set_hash);
});

test("clause order does not change the root_set_hash (canonical, sorted)", () => {
  const a = traceOf(VALID_IDS);
  const b = traceOf([...VALID_IDS].reverse());
  assert.equal(a.root_set_hash, b.root_set_hash);
  assert.deepEqual(a.clauses, b.clauses);
});

// --- exclusion: no raw root-document text, no secret ---

test("the trace carries only clause_ids + roots + hashes — no raw summary text or secret", () => {
  const trace = traceOf(VALID_IDS);
  const blob = JSON.stringify(trace);
  // no raw summary text leaks into the trace
  for (const clause of REGISTRY.clauses) {
    assert.ok(!blob.includes(clause.summary), `summary must not leak: ${clause.clause_id}`);
  }
  const forbidden = [
    "private_key",
    "BEGIN PRIVATE KEY",
    "BEGIN RSA PRIVATE KEY",
    "secret_key",
    "PRIVATE KEY-----",
  ];
  for (const needle of forbidden) {
    assert.ok(!blob.includes(needle), `must not leak ${needle}`);
  }
  // each carried clause is only {clause_id, root, clause_hash}
  for (const c of trace.clauses) {
    assert.deepEqual(Object.keys(c).sort(), ["clause_hash", "clause_id", "root"]);
    assert.ok(!("summary" in c));
  }
});

// --- orchestrator + review gate ---

test("orchestrator permits a valid three-root trace and blocks an incomplete one; boundary all-false", () => {
  const result = runRootClauseTracePreview({ registry: REGISTRY });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, ROOT_CLAUSE_TRACE_EVAL_SCHEMA);
  assert.equal(result.authority_delta, 0);
  assert.deepEqual(result.boundary, buildPreviewBoundary());
  assert.match(result.root_set_hash, /^sha256:[0-9a-f]{64}$/);
});

test("review gate closes the loop: load registry → permit valid → block incomplete", () => {
  const result = runRootClauseTracePreviewCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, ROOT_CLAUSE_TRACE_EVAL_SCHEMA);
  assert.equal(result.truth_label, ROOT_CLAUSE_TRACE_TRUTH_LABEL);
});
