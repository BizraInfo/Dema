// Shared next-action humanizer — extracted from homebase-preview.js so that
// `dema state` and every other renderer can humanize snake_case codes
// uniformly. Producers continue to emit snake_case (schema-stable);
// the humanizer is called at display time only.

import test from "node:test";
import assert from "node:assert/strict";
import {
  humanizeNextAction,
  OBSERVATION_HUMANIZER,
} from "../packages/core/src/next-action-humanizer.js";

test("HUM-01: known process-mining code humanizes to mapped sentence", () => {
  const out = humanizeNextAction("no_ring_1_artifact_observable");
  assert.ok(out.includes("seal a Lighthouse pack"));
  assert.equal(out.includes("_"), false);
});

test("HUM-02: known state code 'continue_preview_only_readiness' humanizes", () => {
  const out = humanizeNextAction("continue_preview_only_readiness");
  assert.ok(out.includes("preview-only readiness"));
  assert.equal(out.includes("_"), false);
  assert.ok(out.length > 20);
});

test("HUM-03: all 6 process-value-preview allowlist codes have explicit humanizations", () => {
  const allowlist = [
    "fix_malformed_process_inputs",
    "restore_clean_baseline",
    "hold_step7_ceremony",
    "continue_preview_only_readiness",
    "reduce_noise_before_next_slice",
    "continue_verified_micro_slice",
  ];
  for (const code of allowlist) {
    assert.ok(
      OBSERVATION_HUMANIZER[code],
      `expected explicit humanization for allowlisted code '${code}', missing from OBSERVATION_HUMANIZER`,
    );
    const human = humanizeNextAction(code);
    assert.equal(
      human.includes("_"),
      false,
      `humanized '${code}' must not contain underscores`,
    );
    assert.ok(
      human.length > 20,
      `humanized '${code}' must be a real sentence: ${human}`,
    );
  }
});

test("HUM-04: unknown snake_case receives heuristic humanization (no underscore leak)", () => {
  const out = humanizeNextAction("some_brand_new_unknown_code");
  assert.equal(out.includes("_"), false);
  assert.ok(out.endsWith("."));
  assert.ok(out.startsWith("Some"));
});

test("HUM-05: pre-humanized input (has spaces or capitals) passes through unchanged", () => {
  const inputs = [
    "Already a sentence.",
    "Ring 1 candidate response in inbox",
    "MIXED_CASE_NOT_SNAKE",
  ];
  for (const s of inputs) {
    assert.equal(humanizeNextAction(s), s);
  }
});

test("HUM-06: non-string input returned as-is (no crash, no transformation)", () => {
  assert.equal(humanizeNextAction(null), null);
  assert.equal(humanizeNextAction(undefined), undefined);
  assert.equal(humanizeNextAction(""), "");
  assert.equal(humanizeNextAction(42), 42);
});

test("HUM-07: OBSERVATION_HUMANIZER is frozen and cannot be mutated", () => {
  assert.equal(Object.isFrozen(OBSERVATION_HUMANIZER), true);
  assert.throws(() => {
    OBSERVATION_HUMANIZER.injected = "evil";
  }, TypeError);
});

test("HUM-08: every mapped value is non-empty + does not contain underscores", () => {
  for (const [code, human] of Object.entries(OBSERVATION_HUMANIZER)) {
    assert.ok(
      typeof human === "string" && human.length > 0,
      `${code}: value missing`,
    );
    assert.equal(
      human.includes("_"),
      false,
      `${code}: humanized form has underscore: ${human}`,
    );
  }
});
