// Eval Layer 2 · Verdict Validator v0.1 — structural + semantic check tests.

import test from "node:test";
import assert from "node:assert/strict";

import {
  EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA,
  EVAL_LAYER2_VERDICT_VALIDATOR_BOUNDARY,
  SEMANTIC_ERROR_CODES,
  validatePastedJudgeVerdict,
  formatVerdictReport,
} from "../packages/core/src/eval-layer2-verdict-validator.js";

const VALID_VERDICT = Object.freeze({
  schema: "bizra.dema.eval_layer2_judge_verdict.v0.1",
  rubric_id: "truthfulness",
  judged_artifact_sha256: "a".repeat(64), // valid hex pattern
  score: 2,
  evidence_excerpt: "the output carries every truth label",
  judge_origin: "external_paste_back",
  judged_at: "2026-05-23T10:00:00.000Z",
});

test("EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA matches v0.1", () => {
  assert.equal(
    EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA,
    "bizra.dema.eval_layer2_verdict_validator.v0.1",
  );
});

test("validatePastedJudgeVerdict · happy path → ok=true, truth_label=MEASURED", () => {
  const result = validatePastedJudgeVerdict(VALID_VERDICT);
  assert.equal(result.recognized, true);
  assert.equal(
    result.ok,
    true,
    `expected ok=true; errors: ${JSON.stringify(result.errors)}`,
  );
  assert.equal(result.truth_label, "MEASURED");
  assert.deepEqual([...result.errors], []);
});

test("validatePastedJudgeVerdict · missing required field → VALIDATION_FAILED", () => {
  const broken = { ...VALID_VERDICT };
  delete broken.score;
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.recognized, true);
  assert.equal(result.ok, false);
  assert.equal(result.truth_label, "VALIDATION_FAILED");
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes("missing_required"));
});

test("validatePastedJudgeVerdict · unknown rubric_id → SEMANTIC_VIOLATION", () => {
  const broken = { ...VALID_VERDICT, rubric_id: "creativity_or_something" };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.recognized, true);
  assert.equal(result.ok, false);
  // The JSON Schema enum rejects this first as enum_mismatch → VALIDATION_FAILED.
  // The semantic layer would also catch it via SEMANTIC_ERROR_CODES.UNKNOWN_RUBRIC.
  // Either way, the verdict must not pass.
  assert.notEqual(result.truth_label, "MEASURED");
});

test("validatePastedJudgeVerdict · score=3 → enum mismatch", () => {
  const broken = { ...VALID_VERDICT, score: 3 };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.ok, false);
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes("enum_mismatch"));
});

test("validatePastedJudgeVerdict · empty evidence_excerpt → SEMANTIC_VIOLATION", () => {
  const broken = { ...VALID_VERDICT, evidence_excerpt: "   " };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.ok, false);
  assert.equal(result.truth_label, "SEMANTIC_VIOLATION");
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes(SEMANTIC_ERROR_CODES.EMPTY_EVIDENCE));
});

test("validatePastedJudgeVerdict · bad sha256 → PATTERN_MISMATCH", () => {
  const broken = { ...VALID_VERDICT, judged_artifact_sha256: "not-a-hash" };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.ok, false);
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes("pattern_mismatch"));
});

test("validatePastedJudgeVerdict · unknown envelope schema → SCHEMA_UNKNOWN", () => {
  const broken = { ...VALID_VERDICT, schema: "bizra.dema.not_a_real.v0.1" };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.recognized, false);
  assert.equal(result.ok, false);
  assert.equal(result.truth_label, "SCHEMA_UNKNOWN");
});

test("validatePastedJudgeVerdict · v0.2-style judge_origin rejected by structural enum_mismatch", () => {
  // v0.1 schema enum is restricted to ["external_paste_back"]. Any other
  // value is caught at the structural layer as enum_mismatch — no semantic
  // re-check is needed (cleaner separation of v0.1 vs v0.2 contracts).
  const broken = { ...VALID_VERDICT, judge_origin: "local_model_via_broker" };
  const result = validatePastedJudgeVerdict(broken);
  assert.equal(result.recognized, true);
  assert.equal(result.ok, false);
  assert.equal(result.truth_label, "VALIDATION_FAILED");
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes("enum_mismatch"));
});

test("validatePastedJudgeVerdict · hostile input (null/array/primitive) → VALIDATION_FAILED", () => {
  const a = validatePastedJudgeVerdict(null);
  assert.equal(a.ok, false);
  assert.equal(a.truth_label, "VALIDATION_FAILED");

  const b = validatePastedJudgeVerdict([VALID_VERDICT]);
  assert.equal(b.ok, false);
  assert.equal(b.truth_label, "VALIDATION_FAILED");

  const c = validatePastedJudgeVerdict("not a verdict");
  assert.equal(c.ok, false);
  assert.equal(c.truth_label, "VALIDATION_FAILED");

  const d = validatePastedJudgeVerdict(42);
  assert.equal(d.ok, false);
  assert.equal(d.truth_label, "VALIDATION_FAILED");
});

test("result envelope is deep-frozen", () => {
  const result = validatePastedJudgeVerdict(VALID_VERDICT);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.errors));
  assert.ok(Object.isFrozen(result.boundary));
});

test("BOUNDARY denies network/mint/external_send/urp_runtime/fs_write", () => {
  assert.deepEqual(EVAL_LAYER2_VERDICT_VALIDATOR_BOUNDARY, {
    read_only: true,
    network: false,
    mint: false,
    external_send: false,
    urp_runtime: false,
    filesystem_write_performed: false,
  });
});

test("formatVerdictReport renders MEASURED happy path", () => {
  const text = formatVerdictReport(validatePastedJudgeVerdict(VALID_VERDICT));
  assert.match(text, /Eval Layer 2 · Verdict Validator/);
  assert.match(text, /Truth label:\s+MEASURED/);
  assert.match(text, /Errors:\s+\(none\)/);
});

test("formatVerdictReport renders SEMANTIC_VIOLATION error list", () => {
  // Empty evidence_excerpt: structural passes (it's a string), semantic
  // layer rejects with EMPTY_EVIDENCE → truth_label SEMANTIC_VIOLATION.
  const broken = { ...VALID_VERDICT, evidence_excerpt: "   " };
  const text = formatVerdictReport(validatePastedJudgeVerdict(broken));
  assert.match(text, /Truth label:\s+SEMANTIC_VIOLATION/);
  assert.match(text, /semantic_empty_evidence/);
});

test("validator module is pure (no fs · http · net · child_process · fetch)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(
    fileURLToPath(
      new URL(
        "../packages/core/src/eval-layer2-verdict-validator.js",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  assert.equal(/from\s+["']node:fs["']/.test(src), false);
  assert.equal(/from\s+["']node:http["']/.test(src), false);
  assert.equal(/from\s+["']node:https["']/.test(src), false);
  assert.equal(/from\s+["']node:net["']/.test(src), false);
  assert.equal(/from\s+["']node:child_process["']/.test(src), false);
  assert.equal(/\bfetch\s*\(/.test(src), false);
});
