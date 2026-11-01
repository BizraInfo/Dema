// NODE0-ENDURANCE-1A — the pure endurance judgment.
//
// A node cannot be called "healthy for 72 hours" from unit tests. It has to
// actually run, and something has to judge the record it leaves behind.
//
// ── THE ONE PROPERTY THAT MAKES THIS HONEST ──
// A MISSING SAMPLE IS UNKNOWN, NEVER PASS.
//
// The tempting implementation counts samples, sees a lot of them, and declares
// health. But a run that sampled every 60s for 2h, died silently, and resumed
// 40h later would produce a large sample count spanning 42h — and a naive
// counter would call that a 42-hour healthy run. It was a 2-hour run, a
// 40-hour blackout, and an unknown.
//
// So coverage is judged by GAPS, not by totals. Any interval between
// consecutive samples longer than `maxGapMs` is unobserved time, and unobserved
// time is never counted as healthy. This is the same law the rest of this
// estate runs on: an empty result from a broken process reads exactly like a
// clean pass unless you check.
//
// PURE: no fs, clock, network or process. Samples and the target are injected.

export const NODE0_ENDURANCE_SCHEMA = "bizra.dema.node0_endurance.v0.1";

export const ENDURANCE_VERDICTS = Object.freeze([
  "INSUFFICIENT", // not enough observed time to claim anything
  "BROKEN",       // observation was interrupted; the claim cannot span the gap
  "DEGRADED",     // observed throughout, but samples reported failures
  "HEALTHY",      // observed continuously for the target, no failures
]);

// Canonical targets from the closure definition. Values are milliseconds.
export const ENDURANCE_TARGETS = Object.freeze({
  MINIMUM_OPERATIONAL: 24 * 60 * 60 * 1000,
  MULTI_DAY_CONFIDENCE: 72 * 60 * 60 * 1000,
  STABILITY_EVIDENCE: 7 * 24 * 60 * 60 * 1000,
});

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Validate one sample. A malformed sample is not silently dropped — dropping it
 * would shrink the evidence while leaving the span intact, which is exactly how
 * a blackout disguises itself as coverage. It is reported and counted as a
 * failure so it can never improve the verdict.
 */
export function validateSample(sample) {
  if (!sample || typeof sample !== "object" || Array.isArray(sample)) return "sample_not_object";
  if (!isFiniteNumber(sample.at_ms) || sample.at_ms < 0) return "sample_timestamp_invalid";
  if (typeof sample.ok !== "boolean") return "sample_ok_not_boolean";
  return null;
}

/**
 * Judge an endurance record.
 *
 * `samples` are the periodic health observations the runner wrote to disk.
 * `targetMs` is the duration being claimed. `maxGapMs` is the longest interval
 * between consecutive samples that still counts as continuous observation —
 * typically a small multiple of the sampling interval.
 */
export function evaluateEndurance({ samples, targetMs, maxGapMs } = {}) {
  const refuse = (reason, over = {}) => Object.freeze({
    schema: NODE0_ENDURANCE_SCHEMA,
    ok: false,
    verdict: "INSUFFICIENT",
    reason,
    target_ms: isFiniteNumber(targetMs) ? targetMs : null,
    max_gap_ms: isFiniteNumber(maxGapMs) ? maxGapMs : null,
    sample_count: Array.isArray(samples) ? samples.length : 0,
    malformed_count: 0,
    failure_count: 0,
    observed_span_ms: 0,
    longest_gap_ms: null,
    gap_count: 0,
    first_at_ms: null,
    last_at_ms: null,
    continuously_observed: false,
    authority_delta: 0,
    ...over,
  });

  if (!Array.isArray(samples)) return refuse("samples_not_array");
  if (!isFiniteNumber(targetMs) || targetMs <= 0) return refuse("target_invalid");
  if (!isFiniteNumber(maxGapMs) || maxGapMs <= 0) return refuse("max_gap_invalid");
  if (samples.length < 2) return refuse("insufficient_samples");

  // Malformed samples are counted, never dropped.
  let malformed = 0;
  const valid = [];
  for (const s of samples) {
    if (validateSample(s)) malformed += 1;
    else valid.push(s);
  }
  if (valid.length < 2) return refuse("insufficient_valid_samples", { malformed_count: malformed });

  // Order is not trusted from the caller; the record is sorted by its own stamps.
  const ordered = [...valid].sort((a, b) => a.at_ms - b.at_ms);
  const first = ordered[0].at_ms;
  const last = ordered[ordered.length - 1].at_ms;
  const span = last - first;

  let longestGap = 0;
  let gapCount = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const gap = ordered[i].at_ms - ordered[i - 1].at_ms;
    if (gap > longestGap) longestGap = gap;
    if (gap > maxGapMs) gapCount += 1;
  }
  const failures = ordered.filter((s) => s.ok !== true).length + malformed;
  const continuouslyObserved = gapCount === 0;

  const base = {
    schema: NODE0_ENDURANCE_SCHEMA,
    target_ms: targetMs,
    max_gap_ms: maxGapMs,
    sample_count: samples.length,
    malformed_count: malformed,
    failure_count: failures,
    observed_span_ms: span,
    longest_gap_ms: longestGap,
    gap_count: gapCount,
    first_at_ms: first,
    last_at_ms: last,
    continuously_observed: continuouslyObserved,
    authority_delta: 0,
  };

  // A blackout is judged BEFORE duration: a long span containing an unobserved
  // stretch is not a long run, and no amount of samples on either side fixes it.
  if (!continuouslyObserved) {
    return Object.freeze({
      ...base,
      ok: false,
      verdict: "BROKEN",
      reason: `observation_gap_exceeded:${gapCount}_gap(s)_longest_${longestGap}ms`,
    });
  }
  if (span < targetMs) {
    return Object.freeze({
      ...base,
      ok: false,
      verdict: "INSUFFICIENT",
      reason: `observed_span_below_target:${span}ms_of_${targetMs}ms`,
    });
  }
  if (failures > 0) {
    return Object.freeze({
      ...base,
      ok: false,
      verdict: "DEGRADED",
      reason: `failures_observed:${failures}`,
    });
  }
  return Object.freeze({
    ...base,
    ok: true,
    verdict: "HEALTHY",
    reason: "continuously_observed_for_target_with_no_failures",
  });
}
