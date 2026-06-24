// MODEL-EVAL-BASELINE-1A — pure-kernel tests.
//
// The kernel does ZERO I/O: it takes gatherer-supplied per-task signals (each a
// bounded, secret-elided sample + reachable/latency) and emits a frozen,
// content-addressed, LOCAL-ONLY baseline report. It SCORES the six bizra-local-
// small dimensions purely + deterministically, so verify can re-score and catch
// laundering. generated_at_iso is INJECTED (the kernel never calls Date.now).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import {
  buildModelEvalBaseline,
  verifyModelEvalBaseline,
  compareModelEvalBaselines,
  BIZRA_LOCAL_SMALL_SUITE,
  MODEL_EVAL_BASELINE_SCHEMA,
  MODEL_EVAL_BASELINE_TRUTH_LABEL,
} from "../packages/core/src/model-eval-baseline.js";

const AT = "2026-06-24T00:00:00.000Z";

function tasksFor(o) {
  // helper: same gathered signals shape across the 6 suite tasks
  return {
    endpoint_reachable: { reachable: o.reachable, latency_ms: o.latency, output: "" },
    latency_ms: { reachable: o.reachable, latency_ms: o.latency, output: "ok" },
    json_obedience: { reachable: o.reachable, latency_ms: o.latency, output: o.json ?? "" },
    code_microtask: { reachable: o.reachable, latency_ms: o.latency, output: o.code ?? "" },
    no_overclaim: { reachable: o.reachable, latency_ms: o.latency, output: o.claim ?? "" },
    truth_boundary: { reachable: o.reachable, latency_ms: o.latency, output: o.truth ?? "" },
  };
}

const RESULTS = {
  "ollama:gemma4:e4b": {
    tasks: tasksFor({
      reachable: true, latency: 120,
      json: '{"ok":true}',
      code: "def f():\n    return 42",
      claim: "A local model that answers questions on your machine.",
      truth: "I cannot reliably predict a future price.",
    }),
  },
  "lm_studio:dead-model": { tasks: tasksFor({ reachable: false, latency: null }) },
};

const INPUT = {
  generated_at_iso: AT,
  suite_id: "bizra-local-small",
  provider_discovery: { ollama: { reachable: true, model_count: 7 }, lm_studio: { reachable: false, model_count: 0 } },
  models_tested: ["ollama:gemma4:e4b", "lm_studio:dead-model"],
  results_by_model: RESULTS,
};

function relaunder(report, mutate) {
  const { baseline_hash, ...body } = report;
  const forged = mutate(structuredClone(body));
  return { ...forged, baseline_hash: sha256(stableStringify(forged)) };
}

test("1 · build → schema/label, boundary all-false, deterministic, verify valid", () => {
  const r = buildModelEvalBaseline(INPUT);
  assert.equal(r.schema, MODEL_EVAL_BASELINE_SCHEMA);
  assert.equal(r.truth_label, MODEL_EVAL_BASELINE_TRUTH_LABEL);
  assert.equal(r.suite_id, "bizra-local-small");
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.ok(r.baseline_hash);
  assert.ok(Object.isFrozen(r));
  assert.deepEqual(buildModelEvalBaseline(INPUT), r); // deterministic given injected time
  assert.equal(verifyModelEvalBaseline(r).valid, true);
});

test("2 · scoring is real — reachable model passes json/code/no_overclaim/truth; dead model fails all", () => {
  const r = buildModelEvalBaseline(INPUT);
  const good = r.results_by_model["ollama:gemma4:e4b"].scores;
  assert.equal(good.json_obedience, 1);
  assert.equal(good.code_microtask, 1);
  assert.equal(good.no_overclaim, 1);
  assert.equal(good.truth_boundary, 1);
  assert.equal(good.endpoint_reachable, 1);
  const dead = r.results_by_model["lm_studio:dead-model"].scores;
  assert.equal(dead.endpoint_reachable, 0);
  assert.equal(dead.json_obedience, 0);
});

test("3 · tasks re-derived from the frozen suite (forged task list caught)", () => {
  const r = buildModelEvalBaseline(INPUT);
  assert.equal(r.tasks.length, BIZRA_LOCAL_SMALL_SUITE.length);
  const forged = relaunder(r, (b) => { b.tasks = [{ id: "fake", dimension: "x", prompt: "y" }]; return b; });
  assert.equal(verifyModelEvalBaseline(forged).valid, false);
});

test("4 · score laundering caught — flip a stored score + recompute hash", () => {
  const r = buildModelEvalBaseline(INPUT);
  const forged = relaunder(r, (b) => { b.results_by_model["lm_studio:dead-model"].scores.json_obedience = 1; return b; });
  const v = verifyModelEvalBaseline(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("scores_relaundered")));
});

test("5 · raw-output leak caught — a forbidden raw field is rejected", () => {
  const r = buildModelEvalBaseline(INPUT);
  const forged = relaunder(r, (b) => { b.results_by_model["ollama:gemma4:e4b"].tasks.json_obedience.raw_output = "secret"; return b; });
  const v = verifyModelEvalBaseline(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((x) => x.startsWith("raw_output_present")));
});

test("6 · boundary-true + tampered attestation + forged hash all rejected", () => {
  const r = buildModelEvalBaseline(INPUT);
  assert.equal(verifyModelEvalBaseline(relaunder(r, (b) => { b.boundary.external_provider_called = true; return b; })).valid, false);
  assert.equal(verifyModelEvalBaseline(relaunder(r, (b) => { b.what_this_does_not_prove = ["it proves the model is correct"]; return b; })).valid, false);
  const r2 = buildModelEvalBaseline(INPUT);
  assert.equal(verifyModelEvalBaseline({ ...r2, baseline_hash: "deadbeef" }).valid, false);
});

test("7 · compare two baselines → per-model + suite delta; refuses an invalid input", () => {
  const base = buildModelEvalBaseline(INPUT);
  const slower = buildModelEvalBaseline({
    ...INPUT,
    results_by_model: { ...RESULTS, "ollama:gemma4:e4b": { tasks: tasksFor({ reachable: true, latency: 300, json: "not json", code: "def f(): return 42", claim: "x", truth: "I cannot say." }) } },
  });
  const cmp = compareModelEvalBaselines(base, slower);
  assert.equal(cmp.suite_match, true);
  assert.ok(cmp.per_model_delta["ollama:gemma4:e4b"]);
  for (const v of Object.values(cmp.boundary)) assert.equal(v, false);
  // refuses a tampered input
  const bad = relaunder(base, (b) => { b.boundary.mutation_performed = true; return b; });
  assert.equal(compareModelEvalBaselines(bad, slower).rejected, true);
});

test("8 · purity — kernel imports no I/O and no clock/random", () => {
  const src = readFileSync(new URL("../packages/core/src/model-eval-baseline.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process)\b/);
  assert.doesNotMatch(src, /[^A-Za-z]fetch\s*\(/);
  assert.doesNotMatch(src, /Date\.now|Math\.random|new Date\(/);
});
