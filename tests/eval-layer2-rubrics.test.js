// Eval Layer 2 · Rubric Pack v0.1 — data + envelope contract tests.
//
// Locks: schema id constant, the 3 rubric IDs in canonical order, the
// rubric pack envelope shape, prompt strings are non-empty, the pack
// self-validates against its own schema via the envelope-schema-validator
// registry auto-load, the pack is deep-frozen, the boundary stamp is the
// canonical 16-key preview boundary, and the pack passes the Layer 1
// artifact-safety scanner with verdict PUBLIC_SAFE (no path leakage, no
// secret-like strings, no forbidden live claims, structural validation
// against its own schema).

import test from "node:test";
import assert from "node:assert/strict";

import {
  EVAL_LAYER2_RUBRIC_PACK_SCHEMA,
  EVAL_LAYER2_RUBRIC_PACK_VERSION,
  RUBRIC_IDS,
  RUBRICS,
  getRubricPack,
  getPromptFor,
  formatRubricPackReport
} from "../packages/core/src/eval-layer2-rubrics.js";

import {
  validateAgainstRegistry
} from "../packages/core/src/envelope-schema-validator.js";

import {
  evaluateArtifactSafety
} from "../packages/core/src/artifact-safety-eval.js";

test("EVAL_LAYER2_RUBRIC_PACK_SCHEMA matches v0.1", () => {
  assert.equal(
    EVAL_LAYER2_RUBRIC_PACK_SCHEMA,
    "bizra.dema.eval_layer2_rubric_pack.v0.1"
  );
  assert.equal(EVAL_LAYER2_RUBRIC_PACK_VERSION, "v0.1");
});

test("RUBRIC_IDS lists the 3 v0.1 rubrics in canonical order", () => {
  assert.deepEqual([...RUBRIC_IDS], [
    "truthfulness",
    "actionability",
    "boundary_compliance"
  ]);
  assert.ok(Object.isFrozen(RUBRIC_IDS));
});

test("RUBRICS provides per-rubric definitions with required keys", () => {
  for (const id of RUBRIC_IDS) {
    const r = RUBRICS[id];
    assert.ok(r, `missing rubric def for ${id}`);
    assert.equal(r.id, id);
    assert.ok(r.title.length > 0);
    assert.deepEqual(r.score_scale, { min: 0, max: 2 });
    assert.ok(r.prompt.system.length > 0);
    assert.ok(r.prompt.user_template.length > 0);
    // user_template must include the {output} placeholder
    assert.match(r.prompt.user_template, /\{output\}/);
    assert.equal(r.score_meanings.length, 3);
    assert.ok(Object.isFrozen(r));
  }
});

test("getRubricPack returns a frozen envelope tagged with the v0.1 schema", () => {
  const pack = getRubricPack();
  assert.equal(pack.schema, EVAL_LAYER2_RUBRIC_PACK_SCHEMA);
  assert.equal(pack.version, "v0.1");
  assert.equal(pack.rubrics.length, 3);
  assert.ok(Object.isFrozen(pack));
  assert.ok(Object.isFrozen(pack.rubrics));
  assert.ok(Object.isFrozen(pack.boundary));
  assert.ok(Object.isFrozen(pack.non_goals));
  // pack is read-only: a mutation attempt throws
  assert.throws(() => {
    pack.rubrics.push({ id: "injected" });
  });
});

test("getRubricPack boundary is the canonical 16-key all-false preview boundary", () => {
  const pack = getRubricPack();
  const keys = Object.keys(pack.boundary).sort();
  assert.equal(keys.length, 16);
  assert.deepEqual(keys, [
    "chain_advance_performed",
    "consent_collected",
    "external_call_performed",
    "federation_invoked",
    "filesystem_write_performed",
    "model_invocation_performed",
    "model_loaded",
    "network_used",
    "node_connection_performed",
    "prompt_executed",
    "public_network_used",
    "raw_corpus_scan_performed",
    "raw_data_included",
    "receipt_mint_performed",
    "runtime_execution_performed",
    "tool_executed"
  ]);
  for (const k of keys) {
    assert.equal(pack.boundary[k], false, `${k} must be false`);
  }
});

test("getRubricPack self-validates against its own schema via registry", () => {
  const pack = getRubricPack();
  const validation = validateAgainstRegistry(pack);
  assert.equal(validation.recognized, true);
  assert.equal(
    validation.ok,
    true,
    `expected pack to self-validate; errors: ${JSON.stringify(validation.errors)}`
  );
  assert.equal(validation.truth_label, "MEASURED");
});

test("getPromptFor returns the prompt for known rubric, null otherwise", () => {
  const p = getPromptFor("truthfulness");
  assert.ok(p);
  assert.equal(typeof p.system, "string");
  assert.equal(typeof p.user_template, "string");
  assert.equal(getPromptFor("not_a_rubric"), null);
  assert.equal(getPromptFor(null), null);
  assert.equal(getPromptFor(undefined), null);
  assert.equal(getPromptFor(42), null);
});

test("rubric pack JSON passes Layer 1 eval as PUBLIC_SAFE", () => {
  const pack = getRubricPack();
  const result = evaluateArtifactSafety(pack);
  assert.equal(
    result.verdict,
    "PUBLIC_SAFE",
    `expected PUBLIC_SAFE; got ${result.verdict} with findings ${JSON.stringify(result.findings)}`
  );
  assert.equal(result.score, 1);
  assert.equal(result.findings.length, 0);
});

test("formatRubricPackReport renders schema + each rubric + non-goals", () => {
  const text = formatRubricPackReport(getRubricPack());
  assert.match(text, /Eval Layer 2 · Rubric Pack v0\.1/);
  assert.match(text, /bizra\.dema\.eval_layer2_rubric_pack\.v0\.1/);
  for (const id of RUBRIC_IDS) {
    assert.match(text, new RegExp(`\\[${id}\\]`));
  }
  assert.match(text, /Non-goals for v0\.1:/);
  assert.match(text, /no remote LLM call from runtime/);
});

test("rubric module is pure (no fs · http · net · child_process imports)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(
    fileURLToPath(
      new URL("../packages/core/src/eval-layer2-rubrics.js", import.meta.url)
    ),
    "utf8"
  );
  assert.equal(/from\s+["']node:fs["']/.test(src), false);
  assert.equal(/from\s+["']node:http["']/.test(src), false);
  assert.equal(/from\s+["']node:https["']/.test(src), false);
  assert.equal(/from\s+["']node:net["']/.test(src), false);
  assert.equal(/from\s+["']node:child_process["']/.test(src), false);
  // No raw fetch either.
  assert.equal(/\bfetch\s*\(/.test(src), false);
});
