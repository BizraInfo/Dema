import test from "node:test";
import assert from "node:assert/strict";
import { diffBriefing, formatBriefingDiff, BRIEFING_DIFF_SCHEMA } from "../packages/core/src/dema-briefing-diff.js";

// ── BD-01 first briefing (no previous) -> everything is new ────────────────────
test("BD-01: with no previous state, all observed ops are new findings", () => {
  const d = diffBriefing({ current: { results: [{ op: "git.status", observation_sha256: "a" }, { op: "purity.check", observation_sha256: "b" }] } });
  assert.equal(d.schema, BRIEFING_DIFF_SCHEMA);
  assert.deepEqual([...d.new_findings].sort(), ["git.status", "purity.check"]);
  assert.equal(d.has_new_value, true);
});

// ── BD-02 identical current vs previous -> NOTHING new (polling suppressed) ─────
test("BD-02: identical observations report no new value", () => {
  const results = [{ op: "git.status", observation_sha256: "a" }, { op: "corpus.gate", observation_sha256: "c" }];
  const d = diffBriefing({ current: { results }, previous: { results } });
  assert.equal(d.has_new_value, false);
  assert.equal(d.unchanged_count, 2);
  assert.equal(d.new_findings.length, 0);
  assert.match(formatBriefingDiff(d), /nothing new \(2 checks re-ran/);
});

// ── BD-03 a changed observation hash IS reported ──────────────────────────────
test("BD-03: an op whose observation hash moved is a changed result", () => {
  const d = diffBriefing({
    current: { results: [{ op: "git.diff_check", observation_sha256: "NEW" }] },
    previous: { results: [{ op: "git.diff_check", observation_sha256: "OLD" }] },
  });
  assert.deepEqual(d.changed_results, ["git.diff_check"]);
  assert.equal(d.new_findings.length, 0);
  assert.equal(d.has_new_value, true);
});

// ── BD-04 new + resolved candidate repairs ────────────────────────────────────
test("BD-04: candidates that appear are new; candidates that vanish are resolved", () => {
  const d = diffBriefing({
    current: { candidates: ["repair:whitespace:b.js"] },
    previous: { candidates: ["repair:whitespace:a.js"] },
  });
  assert.deepEqual(d.new_candidates, ["repair:whitespace:b.js"]);
  assert.deepEqual(d.resolved_candidates, ["repair:whitespace:a.js"]);
});

// ── BD-05 newly-retired work is reported once ─────────────────────────────────
test("BD-05: a task retired this shift is newly_retired; already-retired is not", () => {
  const d = diffBriefing({
    current: { retired: ["repair:x", "repair:y"] },
    previous: { retired: ["repair:x"] },
  });
  assert.deepEqual(d.newly_retired, ["repair:y"]);
});

// ── BD-06 the formatter shows only the delta ──────────────────────────────────
test("BD-06: formatBriefingDiff renders only what changed", () => {
  const d = diffBriefing({
    current: { results: [{ op: "a", observation_sha256: "1" }, { op: "b", observation_sha256: "2" }], candidates: ["c1"] },
    previous: { results: [{ op: "b", observation_sha256: "2" }] },
  });
  const text = formatBriefingDiff(d);
  assert.match(text, /new findings: a/);
  assert.match(text, /new candidate repairs: c1/);
  assert.doesNotMatch(text, /\bb\b:/); // 'b' unchanged, not listed as a finding
  assert.match(text, /1 unchanged checks not shown/);
});
