// ARTICULATION-LOSSLESS-CORE-1A — preserve meaning before optimising wording.
//
// The fixture is real dense founder input, not a synthetic sentence, because
// the failure this kernel exists to catch only appears at that density.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSourceCapsule,
  segmentAtomicUnits,
  classifyUnits,
  unitText,
  verifyLosslessSegmentation,
  buildArticulationDelta,
  INSTRUCTION_TYPES,
} from "../packages/core/src/articulation-compiler.js";

const SOURCE = `Apply your recommendations to implement and integrate a peak ultra-micro architectural framework.
Execute this through a proactive, self-correcting loop involving self-critique, micro-compliance, micro-consent, and self-directed process mining.
Utilize a multi-modal cognitive approach, combining analogical thinking, sequential reasoning, ultra-creative thinking, and critical thinking.
Your objective is to identify the absolute minimum solvable special case.
Filter all outputs through the SNR Framework.
Do not fabricate evidence.
Never claim inspection of unavailable sources.
Produce proof and receipts.
Stop only at a genuine sovereignty boundary.
Is the loop closed?`;

test("ACL-01 THE INVARIANT — the source reconstructs byte-for-byte", () => {
  const units = segmentAtomicUnits(SOURCE);
  const report = verifyLosslessSegmentation(SOURCE, units);
  assert.equal(report.ok, true, JSON.stringify(report.findings));
  assert.equal(report.reconstructed, true);
  assert.equal(
    report.chars_in_units + report.chars_in_gaps,
    SOURCE.length,
    "every character is either inside a unit or an accounted-for separator",
  );
  assert.ok(report.unit_count >= 10, "dense input must not collapse to one unit");
});

test("ACL-02 the prototype's defect is impossible here — text is derived, not stored", () => {
  // MEASURED in the emulation bundle: 150 of 467 units had
  // len(text) !== end - start, so source[start:end] did not reproduce the
  // stored text, while the receipt still claimed traceability_coverage 1.0.
  const units = segmentAtomicUnits(SOURCE);
  for (const unit of units) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(unit, "text"),
      false,
      "a stored text field is exactly how text and span drift apart",
    );
    const derived = unitText(SOURCE, unit);
    assert.equal(derived.length, unit.end - unit.start);
    // And the span slices to real content, never to whitespace.
    assert.equal(derived, derived.trim());
    assert.ok(derived.length > 0);
  }
});

test("ACL-03 spans are ordered, non-overlapping and uniquely identified", () => {
  const units = segmentAtomicUnits(SOURCE);
  for (let i = 1; i < units.length; i += 1) {
    assert.ok(
      units[i].start >= units[i - 1].end,
      `unit ${units[i].unit_id} overlaps its predecessor`,
    );
  }
  const ids = units.map((u) => u.unit_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("ACL-04 NEGATIVE CONTROL — a broken segmentation is caught", () => {
  // Without this, ACL-01 would pass against a verifier that always says ok.
  const units = segmentAtomicUnits(SOURCE);
  const overlapping = units.map((u, i) =>
    i === 2 ? { ...u, start: units[1].end - 5 } : u,
  );
  assert.equal(verifyLosslessSegmentation(SOURCE, overlapping).ok, false);

  const outOfBounds = [{ unit_id: "U0001", start: 0, end: SOURCE.length + 50 }];
  assert.equal(verifyLosslessSegmentation(SOURCE, outOfBounds).ok, false);

  // Dropping a unit must break reconstruction, not be silently tolerated.
  const dropped = units.slice(0, -1);
  const report = verifyLosslessSegmentation(SOURCE, dropped);
  assert.equal(
    report.chars_in_units < SOURCE.length,
    true,
    "a dropped unit must show as uncovered characters",
  );
});

test("ACL-05 the taxonomy is closed and no clause is left untyped", () => {
  const typed = classifyUnits(SOURCE, segmentAtomicUnits(SOURCE));
  for (const unit of typed) {
    assert.ok(unit.types.length > 0, `${unit.unit_id} has no type`);
    for (const t of unit.types) {
      assert.ok(
        INSTRUCTION_TYPES.includes(t),
        `${t} is outside the closed taxonomy`,
      );
    }
  }
  const all = typed.flatMap((u) => u.types);
  // The binding roles must be recognised, not flattened into prose.
  assert.ok(all.includes("AUTHORITY_DENIAL"), "'Do not fabricate' is a denial");
  assert.ok(all.includes("STOP_CONDITION"), "'Stop only at' is a stop condition");
  assert.ok(all.includes("VERIFICATION_REQUIREMENT"), "'Produce proof' is a gate");
  assert.ok(all.includes("QUESTION"), "a trailing question is a question");
});

test("ACL-06 an honest articulation that keeps everything reports no loss", () => {
  const units = segmentAtomicUnits(SOURCE);
  const delta = buildArticulationDelta(SOURCE, units, SOURCE);
  assert.equal(delta.dropped_count, 0);
  assert.equal(delta.silent_loss, false);
  assert.equal(delta.unit_count, units.length);
});

test("ACL-07 THE POINT — a polished rewrite that drops a denial is caught", () => {
  const units = segmentAtomicUnits(SOURCE);
  // A plausible "improved prompt": fluent, shorter, and quietly missing the
  // constraints. This is the exact failure mode of one-shot LLM rewriting.
  const polished =
    "Implement a peak ultra-micro architectural framework using a multi-modal " +
    "cognitive approach. Identify the absolute minimum solvable special case " +
    "and filter outputs through the SNR Framework. Produce proof and receipts.";
  const delta = buildArticulationDelta(SOURCE, units, polished);
  assert.ok(delta.dropped_count > 0, "the rewrite dropped source units");
  assert.equal(
    delta.silent_loss,
    true,
    "dropping 'Do not fabricate evidence' must be flagged, not averaged away",
  );
  assert.ok(
    delta.dropped_binding_count >= 1,
    "binding loss is counted separately from context loss",
  );
  assert.match(delta.what_this_does_not_prove, /does not prove/i);
});

test("ACL-08 the capsule hashes the source and forbids mutation", () => {
  const capsule = buildSourceCapsule(SOURCE);
  assert.match(capsule.source_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(capsule.size_chars, SOURCE.length);
  assert.equal(capsule.semantic_mutation_allowed, false);
  // A different source must hash differently; the same source must not.
  assert.equal(buildSourceCapsule(SOURCE).source_sha256, capsule.source_sha256);
  assert.notEqual(
    buildSourceCapsule(`${SOURCE} `).source_sha256,
    capsule.source_sha256,
  );
  assert.throws(() => buildSourceCapsule(null), TypeError);
  assert.throws(() => segmentAtomicUnits(undefined), TypeError);
});

test("ACL-09 empty and whitespace-only input produce no phantom units", () => {
  for (const empty of ["", "   \n\n  \t "]) {
    const units = segmentAtomicUnits(empty);
    assert.equal(units.length, 0);
    assert.equal(verifyLosslessSegmentation(empty, units).reconstructed, true);
  }
});
