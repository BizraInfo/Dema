// DEMA-SELF-EVAL-BASELINE-PREVIEW-1A — measure, don't guess.
//
// PREVIEW_ONLY. NOT ML. The answer to "are we working blindly?": it captures the
// measured system-quality signals (tests, coverage, registry, monitor, gates,
// perf) as a deterministic, content-addressed BASELINE, and compares a candidate
// baseline against it per dimension to say improved / regressed / unchanged — so
// a change to Dema is measured, not asserted.
//
// Pure kernel: the signals are INJECTED. It does not run tests, coverage, git,
// the monitor, or perf here — an effect adapter collects those and feeds them in.
// No content read, no mutation, no network, no mint. It never learns; it measures.

import { createHash } from "node:crypto";

export const DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA =
  "bizra.dema.self_eval_baseline_preview.v0.1";
export const DEMA_SELF_EVAL_BASELINE_COMPARE_SCHEMA =
  "bizra.dema.self_eval_baseline_compare.v0.1";
export const DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL =
  "DEMA_SELF_EVAL_BASELINE_PREVIEW_MEASURED_REPO";
export const DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE =
  "GO: dema self eval baseline preview";
export const DEMA_SELF_EVAL_BASELINE_PREVIEW_MODE = "preview_only";

// Each signal declares which direction is "better". `hard` signals drive the
// overall verdict; informational signals are reported but never flip it.
export const SELF_EVAL_SIGNAL_SPECS = Object.freeze([
  { key: "tests_pass", orient: "higher_better", hard: true, pct: false },
  { key: "tests_total", orient: "informational", hard: false, pct: false },
  { key: "coverage_branch_pct", orient: "higher_better", hard: true, pct: true },
  { key: "coverage_line_pct", orient: "higher_better", hard: true, pct: true },
  { key: "coverage_function_pct", orient: "higher_better", hard: true, pct: true },
  { key: "monitor_critical", orient: "lower_better", hard: true, pct: false },
  { key: "monitor_warning", orient: "lower_better", hard: true, pct: false },
  { key: "perf_boot_ms", orient: "lower_better", hard: false, pct: false },
  { key: "perf_verify_ms", orient: "lower_better", hard: false, pct: false },
  { key: "registry_count", orient: "informational", hard: false, pct: false },
]);
const SIGNAL_KEYS = Object.freeze(SELF_EVAL_SIGNAL_SPECS.map((s) => s.key));

const CORE_BODY_KEYS = Object.freeze([
  "schema", "truth_label", "mode", "label", "captured_at",
  ...SIGNAL_KEYS, "gates_all_green", "authority_delta", "boundary",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "A deterministic, content-addressed baseline of Dema's measured system-quality signals (tests, coverage, monitor, gates, perf, registry) can be captured and re-verified.",
  "Two baselines can be compared per dimension to yield improved / regressed / unchanged with named reasons, so a change to Dema is measured, not asserted — no more working blindly.",
  "A regression on any hard dimension (fewer passing tests, dropped coverage, more monitor criticals, gates no longer green) forces a 'regressed' verdict; improvement must be earned across hard dimensions.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "It does not run tests, coverage, the monitor, git, or perf — those signals are injected by an effect adapter; a forged signal in yields a forged score out.",
  "It does not make Dema 'better' and it does not learn — it measures. Ingesting a corpus does not change these kernels; only real code + tests move these numbers.",
  "A higher composite is not production certification; boundary is all-false and authority_delta is 0.",
]);

function sha256(v) { return createHash("sha256").update(v, "utf8").digest("hex"); }
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function freezeDeep(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const c of Object.values(v)) freezeDeep(c);
  return v;
}

export function demaSelfEvalBaselinePreviewBoundary() {
  return Object.freeze({
    test_execution_performed: false,
    coverage_run_performed: false,
    monitor_run_performed: false,
    content_read_performed: false,
    file_mutation_performed: false,
    network_used: false,
    model_invocation_performed: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    daemon_started: false,
  });
}
function boundaryAllFalse(b) {
  if (!b || typeof b !== "object") return false;
  const c = demaSelfEvalBaselinePreviewBoundary();
  const exp = Object.keys(c).sort();
  const act = Object.keys(b).sort();
  if (exp.length !== act.length) return false;
  for (let i = 0; i < exp.length; i++) if (exp[i] !== act[i] || b[exp[i]] !== false) return false;
  return true;
}

export function selfEvalBaselineValidationBlocks(input) {
  const blocked = [];
  if (!input || typeof input !== "object") { blocked.push("input_not_object"); return blocked; }
  if (typeof input.label !== "string" || input.label.length === 0) blocked.push("label_missing");
  if (typeof input.captured_at !== "string" || Number.isNaN(Date.parse(input.captured_at))) blocked.push("captured_at_invalid");
  for (const spec of SELF_EVAL_SIGNAL_SPECS) {
    const v = input[spec.key];
    if (!Number.isFinite(v) || v < 0) { blocked.push(`signal_invalid:${spec.key}`); continue; }
    if (spec.pct && v > 100) blocked.push(`signal_out_of_range:${spec.key}`);
  }
  if (typeof input.gates_all_green !== "boolean") blocked.push("gates_all_green_invalid");
  if (Number.isFinite(input.tests_pass) && Number.isFinite(input.tests_total) && input.tests_pass > input.tests_total) {
    blocked.push("tests_pass_exceeds_total");
  }
  return blocked;
}

export function planDemaSelfEvalBaselinePreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_SELF_EVAL_BASELINE_PREVIEW_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  blocked_by.push(...selfEvalBaselineValidationBlocks(input));
  return Object.freeze({
    schema: DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
    truth_label: DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function pickCoreBody(source) {
  const core = {};
  for (const k of CORE_BODY_KEYS) core[k] = source[k];
  return core;
}
export function computeSelfEvalContentHash(coreBodyLike) {
  return `sha256:${sha256(stableStringify(pickCoreBody(coreBodyLike)))}`;
}

export function buildDemaSelfEvalBaselinePreviewPayload(input) {
  const coreBody = {
    schema: DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
    truth_label: DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL,
    mode: DEMA_SELF_EVAL_BASELINE_PREVIEW_MODE,
    label: input.label,
    captured_at: input.captured_at,
    ...Object.fromEntries(SIGNAL_KEYS.map((k) => [k, input[k]])),
    gates_all_green: input.gates_all_green,
    authority_delta: 0,
    boundary: demaSelfEvalBaselinePreviewBoundary(),
  };
  const content_hash = computeSelfEvalContentHash(coreBody);
  return freezeDeep({
    ...coreBody,
    content_hash,
    baseline_hash: content_hash,
    healthy: input.tests_pass === input.tests_total && input.monitor_critical === 0 && input.gates_all_green === true,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

export function verifyDemaSelfEvalBaselinePreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const content_hash = payload.content_hash;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_malformed");
  } else if (computeSelfEvalContentHash(payload) !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  const derivedHealthy =
    payload.tests_pass === payload.tests_total && payload.monitor_critical === 0 && payload.gates_all_green === true;
  if (derivedHealthy !== payload.healthy) blocked_by.push("healthy_not_rederivable");
  if (payload.baseline_hash !== content_hash) blocked_by.push("baseline_hash_mismatch");
  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
    content_hash: typeof content_hash === "string" ? content_hash : null,
    blocked_by: Object.freeze(blocked_by),
  });
}

function directionFor(spec, base, cand) {
  if (spec.orient === "informational") return "informational";
  if (spec.orient === "higher_better") return cand > base ? "better" : cand < base ? "worse" : "same";
  return cand < base ? "better" : cand > base ? "worse" : "same"; // lower_better
}

// Compare a candidate baseline against a prior baseline — the self-eval verdict.
export function compareDemaSelfEvalBaselines(baseline, candidate) {
  const blocked_by = [];
  if (!baseline || !candidate) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["missing_baseline_or_candidate"]) });
  }
  const bv = verifyDemaSelfEvalBaselinePreview(baseline);
  const cv = verifyDemaSelfEvalBaselinePreview(candidate);
  if (!bv.ok) blocked_by.push("baseline_unverifiable");
  if (!cv.ok) blocked_by.push("candidate_unverifiable");

  const dimensions = SELF_EVAL_SIGNAL_SPECS.map((spec) => {
    const base = baseline[spec.key];
    const cand = candidate[spec.key];
    return Object.freeze({
      name: spec.key,
      baseline: base,
      candidate: cand,
      delta: cand - base,
      orientation: spec.orient,
      hard: spec.hard,
      direction: directionFor(spec, base, cand),
    });
  });

  const hardRegressions = dimensions.filter((d) => d.hard && d.direction === "worse").map((d) => d.name);
  const hardImprovements = dimensions.filter((d) => d.hard && d.direction === "better").map((d) => d.name);
  const gatesRegressed = baseline.gates_all_green === true && candidate.gates_all_green !== true;
  if (gatesRegressed) hardRegressions.push("gates_all_green");
  const gatesImproved = baseline.gates_all_green !== true && candidate.gates_all_green === true;
  if (gatesImproved) hardImprovements.push("gates_all_green");

  let overall;
  if (hardRegressions.length > 0) overall = "regressed";
  else if (hardImprovements.length > 0) overall = "improved";
  else overall = "unchanged";

  const healthy_candidate =
    candidate.tests_pass === candidate.tests_total &&
    candidate.monitor_critical === 0 &&
    candidate.gates_all_green === true;

  const body = {
    schema: DEMA_SELF_EVAL_BASELINE_COMPARE_SCHEMA,
    baseline_hash: baseline.content_hash ?? null,
    candidate_hash: candidate.content_hash ?? null,
    baseline_label: baseline.label ?? null,
    candidate_label: candidate.label ?? null,
    dimensions,
    hard_regressions: hardRegressions.sort(),
    hard_improvements: hardImprovements.sort(),
    overall,
    healthy_candidate,
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return freezeDeep({ ok: blocked_by.length === 0, ...body, content_hash, blocked_by });
}

export function runDemaSelfEvalBaselinePreview({ consent, input } = {}) {
  const boundary = demaSelfEvalBaselinePreviewBoundary();
  const base = {
    schema: DEMA_SELF_EVAL_BASELINE_PREVIEW_SCHEMA,
    truth_label: DEMA_SELF_EVAL_BASELINE_PREVIEW_TRUTH_LABEL,
    mode: DEMA_SELF_EVAL_BASELINE_PREVIEW_MODE,
    boundary,
  };
  const plan = planDemaSelfEvalBaselinePreview({ consent, input });
  if (!plan.eligible) return Object.freeze({ ...base, ok: false, blocked_by: plan.blocked_by });
  const payload = buildDemaSelfEvalBaselinePreviewPayload(input);
  const verified = verifyDemaSelfEvalBaselinePreview(payload);
  if (!verified.ok) return Object.freeze({ ...base, ok: false, blocked_by: verified.blocked_by });
  return Object.freeze({
    ...base,
    ok: true,
    label: payload.label,
    captured_at: payload.captured_at,
    baseline_hash: payload.baseline_hash,
    content_hash: payload.content_hash,
    healthy: payload.healthy,
    signals: Object.fromEntries(SIGNAL_KEYS.map((k) => [k, payload[k]])),
    gates_all_green: payload.gates_all_green,
    authority_delta: 0,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([]),
  });
}

// Fixtures — a "before" baseline and an "after" candidate that improved.
export const SELF_EVAL_BASELINE_FIXTURE = freezeDeep({
  label: "main@before",
  captured_at: "2026-07-06T10:00:00.000Z",
  tests_pass: 6647, tests_total: 6647,
  coverage_branch_pct: 84.22, coverage_line_pct: 95.55, coverage_function_pct: 97.78,
  monitor_critical: 0, monitor_warning: 0,
  perf_boot_ms: 88.2, perf_verify_ms: 0.008,
  registry_count: 32,
  gates_all_green: true,
});
export const SELF_EVAL_CANDIDATE_FIXTURE = freezeDeep({
  ...SELF_EVAL_BASELINE_FIXTURE,
  label: "main@after",
  captured_at: "2026-07-06T14:00:00.000Z",
  tests_pass: 6664, tests_total: 6664,
  coverage_branch_pct: 84.26,
  registry_count: 33,
});
