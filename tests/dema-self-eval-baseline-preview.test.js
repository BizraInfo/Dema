import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaSelfEvalBaselinePreview,
  buildDemaSelfEvalBaselinePreviewPayload,
  verifyDemaSelfEvalBaselinePreview,
  runDemaSelfEvalBaselinePreview,
  compareDemaSelfEvalBaselines,
  computeSelfEvalContentHash,
  SELF_EVAL_BASELINE_FIXTURE,
  SELF_EVAL_CANDIDATE_FIXTURE,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
} from "../packages/core/src/dema-self-eval-baseline-preview.js";
import { runDemaSelfEvalBaselinePreviewCheck } from "../scripts/review/dema-self-eval-baseline-preview-check.mjs";
import { REQUIRED_CAPABILITY_IDS } from "../packages/core/src/dema-capability-truth-registry.js";

const GO = DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE;
const clone = (v) => JSON.parse(JSON.stringify(v));
const build = (f) => buildDemaSelfEvalBaselinePreviewPayload(f);

test("captures a healthy content-addressed baseline", () => {
  const r = runDemaSelfEvalBaselinePreview({ consent: GO, input: SELF_EVAL_BASELINE_FIXTURE });
  assert.equal(r.ok, true, (r.blocked_by || []).join(", "));
  assert.equal(r.healthy, true);
  assert.equal(r.signals.tests_pass, 6647);
  assert.match(r.baseline_hash, /^sha256:[0-9a-f]{64}$/);
});

test("consent mismatch blocks", () => {
  const r = runDemaSelfEvalBaselinePreview({ consent: "x", input: SELF_EVAL_BASELINE_FIXTURE });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

test("invalid / out-of-range / non-boolean-gate signals block", () => {
  const bad = (m) => { const i = clone(SELF_EVAL_BASELINE_FIXTURE); m(i); return planDemaSelfEvalBaselinePreview({ consent: GO, input: i }).blocked_by; };
  assert.ok(bad((i) => { i.tests_pass = -1; }).some((b) => b.startsWith("signal_invalid:")));
  assert.ok(bad((i) => { i.coverage_branch_pct = 140; }).some((b) => b.startsWith("signal_out_of_range:")));
  assert.ok(bad((i) => { i.gates_all_green = "yes"; }).includes("gates_all_green_invalid"));
  assert.ok(bad((i) => { i.tests_pass = i.tests_total + 5; }).includes("tests_pass_exceeds_total"));
  assert.ok(bad((i) => { delete i.label; }).includes("label_missing"));
  assert.ok(bad((i) => { i.captured_at = "nope"; }).includes("captured_at_invalid"));
});

test("compare: an improvement reads as improved", () => {
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), build(SELF_EVAL_CANDIDATE_FIXTURE));
  assert.equal(c.overall, "improved");
  assert.ok(c.hard_improvements.includes("tests_pass"));
  assert.ok(c.hard_improvements.includes("coverage_branch_pct"));
  assert.equal(c.healthy_candidate, true);
});

test("compare: fewer passing tests reads as regressed", () => {
  const worse = build({ ...SELF_EVAL_CANDIDATE_FIXTURE, tests_pass: 6600, tests_total: 6600 });
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), worse);
  assert.equal(c.overall, "regressed");
  assert.ok(c.hard_regressions.includes("tests_pass"));
});

test("compare: dropped coverage reads as regressed", () => {
  const worse = build({ ...SELF_EVAL_CANDIDATE_FIXTURE, coverage_branch_pct: 80.0 });
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), worse);
  assert.equal(c.overall, "regressed");
  assert.ok(c.hard_regressions.includes("coverage_branch_pct"));
});

test("compare: new monitor critical reads as regressed", () => {
  const worse = build({ ...SELF_EVAL_CANDIDATE_FIXTURE, monitor_critical: 1 });
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), worse);
  assert.equal(c.overall, "regressed");
  assert.ok(c.hard_regressions.includes("monitor_critical"));
  assert.equal(c.healthy_candidate, false);
});

test("compare: gates falling green->red reads as regressed", () => {
  const worse = build({ ...SELF_EVAL_CANDIDATE_FIXTURE, gates_all_green: false });
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), worse);
  assert.equal(c.overall, "regressed");
  assert.ok(c.hard_regressions.includes("gates_all_green"));
});

test("compare: identical baselines read as unchanged", () => {
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), build(SELF_EVAL_BASELINE_FIXTURE));
  assert.equal(c.overall, "unchanged");
});

test("compare: registry growth alone is informational (not 'improved')", () => {
  const c = compareDemaSelfEvalBaselines(
    build(SELF_EVAL_BASELINE_FIXTURE),
    build({ ...SELF_EVAL_BASELINE_FIXTURE, registry_count: 40 }),
  );
  assert.equal(c.overall, "unchanged");
  const reg = c.dimensions.find((d) => d.name === "registry_count");
  assert.equal(reg.direction, "informational");
});

test("verify rejects tampered hash and forged healthy", () => {
  const p = build(SELF_EVAL_BASELINE_FIXTURE);
  assert.ok(verifyDemaSelfEvalBaselinePreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).blocked_by.includes("content_hash_mismatch"));
  const forgedCore = {};
  for (const k of ["schema","truth_label","mode","label","captured_at","tests_pass","tests_total","coverage_branch_pct","coverage_line_pct","coverage_function_pct","monitor_critical","monitor_warning","perf_boot_ms","perf_verify_ms","registry_count","gates_all_green","authority_delta","boundary"]) forgedCore[k] = p[k];
  forgedCore.monitor_critical = 5; // unhealthy state...
  const h = computeSelfEvalContentHash(forgedCore);
  const forged = { ...forgedCore, content_hash: h, baseline_hash: h, healthy: true }; // ...but lies "healthy: true"
  const v = verifyDemaSelfEvalBaselinePreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("healthy_not_rederivable"));
});

test("deterministic baseline hash", () => {
  assert.equal(build(SELF_EVAL_BASELINE_FIXTURE).baseline_hash, build(SELF_EVAL_BASELINE_FIXTURE).baseline_hash);
});

test("review gate: builds, tells improved from regressed", () => {
  const r = runDemaSelfEvalBaselinePreviewCheck();
  assert.equal(r.ok, true, (r.blocked_by || []).join(", "));
  assert.equal(r.improved_overall, "improved");
  assert.equal(r.regressed_overall, "regressed");
});

test("capability row registered and bound to a passing gate", () => {
  assert.ok(REQUIRED_CAPABILITY_IDS.includes("DEMA_SELF_EVAL_BASELINE_PREVIEW_1A"));
  assert.equal(runDemaSelfEvalBaselinePreviewCheck().ok, true);
});

// --- coverage completions ---
test("cov: non-object input + verify non-object + boundary/authority/hash-alias", () => {
  assert.ok(planDemaSelfEvalBaselinePreview({ consent: GO, input: 2 }).blocked_by.includes("input_not_object"));
  assert.equal(verifyDemaSelfEvalBaselinePreview(null).ok, false);
  const p = build(SELF_EVAL_BASELINE_FIXTURE);
  assert.ok(verifyDemaSelfEvalBaselinePreview({ ...p, content_hash: "x" }).blocked_by.includes("content_hash_malformed"));
  assert.ok(verifyDemaSelfEvalBaselinePreview({ ...p, boundary: { ...p.boundary, network_used: true } }).blocked_by.includes("boundary_not_all_false"));
  assert.ok(verifyDemaSelfEvalBaselinePreview({ ...p, authority_delta: 1 }).blocked_by.includes("authority_delta_nonzero"));
  assert.ok(verifyDemaSelfEvalBaselinePreview({ ...p, baseline_hash: `sha256:${"1".repeat(64)}` }).blocked_by.includes("baseline_hash_mismatch"));
});

test("cov: compare missing args + perf lower_better better path", () => {
  assert.equal(compareDemaSelfEvalBaselines(null, null).ok, false);
  const faster = build({ ...SELF_EVAL_CANDIDATE_FIXTURE, perf_boot_ms: 40 });
  const c = compareDemaSelfEvalBaselines(build(SELF_EVAL_BASELINE_FIXTURE), faster);
  const perf = c.dimensions.find((d) => d.name === "perf_boot_ms");
  assert.equal(perf.direction, "better");
});
