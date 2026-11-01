// NODE0-ENDURANCE-1A — the pure endurance judgment.
//
// The load-bearing test is E1: a run that sampled for 2h, went dark for 40h,
// then resumed must NOT read as a 42-hour healthy run. A missing sample is
// UNKNOWN, never PASS. Without E1 every other assertion here could pass against
// a counter that simply likes large numbers.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  evaluateEndurance,
  validateSample,
  ENDURANCE_TARGETS,
  ENDURANCE_VERDICTS,
  NODE0_ENDURANCE_SCHEMA,
} from "../packages/core/src/node0-endurance.js";

const KERNEL = fileURLToPath(new URL("../packages/core/src/node0-endurance.js", import.meta.url));
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// A continuous record: one sample per interval across `spanMs`.
function record({ spanMs, intervalMs = 5 * MIN, ok = true, startAt = 1_000_000 }) {
  const out = [];
  for (let t = 0; t <= spanMs; t += intervalMs) out.push({ at_ms: startAt + t, ok });
  return out;
}

// ── E1 · THE BLACKOUT ──────────────────────────────────────────────────────

test("E1 a 2h run, a 40h blackout and a resume is BROKEN, not a 42h healthy run", () => {
  const before = record({ spanMs: 2 * HOUR });
  const afterStart = before[before.length - 1].at_ms + 40 * HOUR;
  const after = record({ spanMs: 2 * HOUR, startAt: afterStart });
  const samples = [...before, ...after];

  // The naive read: lots of samples spanning 44 hours.
  assert.ok(samples.length > 40, "control: the record really does hold many samples");
  const span = samples[samples.length - 1].at_ms - samples[0].at_ms;
  assert.ok(span > 40 * HOUR, "control: the raw span really does exceed 40h");

  const r = evaluateEndurance({ samples, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  assert.equal(r.verdict, "BROKEN", "a blackout was counted as healthy time");
  assert.equal(r.ok, false);
  assert.equal(r.continuously_observed, false);
  assert.equal(r.gap_count, 1);
  assert.equal(r.longest_gap_ms, 40 * HOUR);
});

test("E2 a blackout outranks duration: even a 7-day span with one gap is BROKEN", () => {
  const a = record({ spanMs: 3 * HOUR });
  const b = record({ spanMs: 3 * HOUR, startAt: a[a.length - 1].at_ms + 7 * 24 * HOUR });
  const r = evaluateEndurance({
    samples: [...a, ...b],
    targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL,
    maxGapMs: 15 * MIN,
  });
  assert.equal(r.verdict, "BROKEN");
});

// ── E3–E6 · the ordinary verdicts ──────────────────────────────────────────

test("E3 continuous observation for the full target with no failures is HEALTHY", () => {
  const r = evaluateEndurance({
    samples: record({ spanMs: 25 * HOUR }),
    targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL,
    maxGapMs: 15 * MIN,
  });
  assert.equal(r.verdict, "HEALTHY");
  assert.equal(r.ok, true);
  assert.equal(r.continuously_observed, true);
  assert.equal(r.failure_count, 0);
  assert.ok(r.observed_span_ms >= ENDURANCE_TARGETS.MINIMUM_OPERATIONAL);
});

test("E4 continuous observation short of the target is INSUFFICIENT", () => {
  const r = evaluateEndurance({
    samples: record({ spanMs: 6 * HOUR }),
    targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL,
    maxGapMs: 15 * MIN,
  });
  assert.equal(r.verdict, "INSUFFICIENT");
  assert.equal(r.continuously_observed, true, "it was observed — just not for long enough");
});

test("E5 observed failures downgrade to DEGRADED, never HEALTHY", () => {
  const samples = record({ spanMs: 25 * HOUR });
  samples[10] = { ...samples[10], ok: false };
  const r = evaluateEndurance({ samples, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  assert.equal(r.verdict, "DEGRADED");
  assert.equal(r.failure_count, 1);
});

test("E6 the 72h target is not satisfied by a 24h run", () => {
  const samples = record({ spanMs: 25 * HOUR });
  assert.equal(evaluateEndurance({ samples, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN }).verdict, "HEALTHY");
  assert.equal(evaluateEndurance({ samples, targetMs: ENDURANCE_TARGETS.MULTI_DAY_CONFIDENCE, maxGapMs: 15 * MIN }).verdict, "INSUFFICIENT");
});

// ── E7–E10 · fail-closed hygiene ───────────────────────────────────────────

test("E7 malformed samples are counted as failures, never silently dropped", () => {
  const samples = record({ spanMs: 25 * HOUR });
  samples[5] = { at_ms: "not-a-number", ok: true };
  const r = evaluateEndurance({ samples, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  assert.equal(r.malformed_count, 1);
  assert.ok(r.failure_count >= 1);
  assert.notEqual(r.verdict, "HEALTHY", "a malformed sample improved the verdict");
});

test("E8 bad inputs fail closed to INSUFFICIENT", () => {
  for (const args of [
    {},
    { samples: null, targetMs: HOUR, maxGapMs: MIN },
    { samples: [], targetMs: HOUR, maxGapMs: MIN },
    { samples: record({ spanMs: HOUR }), targetMs: 0, maxGapMs: MIN },
    { samples: record({ spanMs: HOUR }), targetMs: HOUR, maxGapMs: -1 },
    { samples: [{ at_ms: 1, ok: true }], targetMs: HOUR, maxGapMs: MIN },
  ]) {
    const r = evaluateEndurance(args);
    assert.equal(r.ok, false);
    assert.equal(r.verdict, "INSUFFICIENT");
    assert.equal(r.authority_delta, 0);
  }
});

test("E9 sample order is not trusted from the caller", () => {
  const ordered = record({ spanMs: 25 * HOUR });
  const shuffled = [...ordered].reverse();
  const a = evaluateEndurance({ samples: ordered, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  const b = evaluateEndurance({ samples: shuffled, targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.observed_span_ms, b.observed_span_ms);
  assert.equal(a.longest_gap_ms, b.longest_gap_ms);
});

test("E10 the kernel is pure and grants nothing", () => {
  const src = readFileSync(KERNEL, "utf8");
  assert.ok(src.length > 1000, "control: kernel source unexpectedly small");
  for (const cap of ["node:fs", "node:fs/promises", "node:child_process", "node:net", "node:http", "node:https"]) {
    assert.equal(src.includes(`from "${cap}"`), false, `kernel imports ${cap}`);
  }
  assert.equal(/Date\.now\(|Math\.random\(/.test(src), false, "kernel reads a clock or randomness");
  const r = evaluateEndurance({ samples: record({ spanMs: 25 * HOUR }), targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL, maxGapMs: 15 * MIN });
  assert.equal(r.authority_delta, 0);
  assert.equal(r.schema, NODE0_ENDURANCE_SCHEMA);
  assert.ok(ENDURANCE_VERDICTS.includes(r.verdict));
  assert.equal(validateSample({ at_ms: 1, ok: true }), null);
});
