#!/usr/bin/env node
// DEMA-SELF-EVAL-BASELINE-PREVIEW-1A — review gate. Builds a baseline, proves an
// improvement compares as "improved", and proves a dropped-test candidate
// compares as "regressed" — so the self-eval can actually tell better from worse.

import { pathToFileURL } from "node:url";

import {
  runDemaSelfEvalBaselinePreview,
  buildDemaSelfEvalBaselinePreviewPayload,
  compareDemaSelfEvalBaselines,
  SELF_EVAL_BASELINE_FIXTURE,
  SELF_EVAL_CANDIDATE_FIXTURE,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL,
  DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-self-eval-baseline-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaSelfEvalBaselinePreviewCheck() {
  const blocked_by = [];

  const built = runDemaSelfEvalBaselinePreview({
    consent: DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE,
    input: SELF_EVAL_BASELINE_FIXTURE,
  });
  if (!built.ok) for (const c of built.blocked_by || []) blocked_by.push(`build:${c}`);

  const baseline = buildDemaSelfEvalBaselinePreviewPayload(SELF_EVAL_BASELINE_FIXTURE);
  const candidate = buildDemaSelfEvalBaselinePreviewPayload(SELF_EVAL_CANDIDATE_FIXTURE);

  const improved = compareDemaSelfEvalBaselines(baseline, candidate);
  if (improved.overall !== "improved") blocked_by.push(`improved_case_${improved.overall}`);

  const worseCandidate = buildDemaSelfEvalBaselinePreviewPayload({
    ...SELF_EVAL_CANDIDATE_FIXTURE,
    label: "main@regressed",
    tests_pass: 6600, // fewer passing tests than the baseline
    tests_total: 6600,
  });
  const regressed = compareDemaSelfEvalBaselines(baseline, worseCandidate);
  if (regressed.overall !== "regressed") blocked_by.push(`regressed_case_${regressed.overall}`);

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
    truth_label: DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL,
    content_hash: built.content_hash ?? null,
    improved_overall: improved.overall,
    regressed_overall: regressed.overall,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaSelfEvalBaselinePreviewCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-SELF-EVAL-BASELINE-PREVIEW-1A");
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const c of result.blocked_by || []) console.log(`    ${c}`);
  }
  if (!result.ok) process.exit(1);
}
