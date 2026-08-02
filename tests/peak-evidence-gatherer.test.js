import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  gatherEvidenceSignals,
  verifyEvidenceSignals,
} from "../packages/core/src/peak-evidence-gatherer.js";
import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";

// Injected reader — the gatherer never touches the filesystem itself.
function readerFor(world) {
  return (ref) => (Object.hasOwn(world, ref) ? world[ref] : null);
}
const sha = (s) => createHash("sha256").update(s).digest("hex");

const WORLD = {
  "receipts/gate-a.json": '{"gate":"claims:register","exit":0}',
  "receipts/gate-b.json": '{"gate":"integration-check","exit":0}',
  "receipts/gate-c.json": '{"gate":"kernel-purity","exit":0}',
};
const CANDIDATES = [
  { id: "claims-register", type: "gate_passed", source_ref: "receipts/gate-a.json" },
  { id: "integration-check", type: "gate_passed", source_ref: "receipts/gate-b.json" },
  { id: "kernel-purity", type: "gate_passed", source_ref: "receipts/gate-c.json" },
];

test("PEG-01: an existing source yields an event bound to its real content hash", () => {
  const out = gatherEvidenceSignals({
    candidates: [CANDIDATES[0]],
    readSource: readerFor(WORLD),
  });
  assert.equal(out.events.length, 1);
  const e = out.events[0];
  assert.equal(e.truth_label, "MEASURED");
  assert.equal(e.source_sha256, sha(WORLD["receipts/gate-a.json"]));
  assert.equal(e.weight, 1);
});

test("PEG-02: a missing source is excluded, never emitted — fail closed", () => {
  const out = gatherEvidenceSignals({
    candidates: [{ id: "ghost", type: "gate_passed", source_ref: "receipts/nope.json" }],
    readSource: readerFor(WORLD),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded.length, 1);
  assert.equal(out.excluded[0].gap, "source_unreadable");
});

test("PEG-03: verify re-derives from content and passes on an untampered world", () => {
  const { events } = gatherEvidenceSignals({
    candidates: CANDIDATES,
    readSource: readerFor(WORLD),
  });
  const v = verifyEvidenceSignals({ events, readSource: readerFor(WORLD) });
  assert.equal(v.ok, true);
  assert.equal(v.verified_count, 3);
  assert.equal(v.mismatches.length, 0);
});

test("PEG-04: verify catches content that changed after gathering", () => {
  const { events } = gatherEvidenceSignals({
    candidates: CANDIDATES,
    readSource: readerFor(WORLD),
  });
  const tampered = { ...WORLD, "receipts/gate-b.json": '{"gate":"integration-check","exit":1}' };
  const v = verifyEvidenceSignals({ events, readSource: readerFor(tampered) });
  assert.equal(v.ok, false);
  assert.equal(v.mismatches.length, 1);
  assert.equal(v.mismatches[0].id, "integration-check");
});

test("PEG-05: a hand-forged sha256 fails verify against real content", () => {
  const forged = [
    {
      id: "claims-register",
      type: "gate_passed",
      weight: 1,
      truth_label: "MEASURED",
      source_ref: "receipts/gate-a.json",
      source_sha256: "f".repeat(64),
    },
  ];
  const v = verifyEvidenceSignals({ events: forged, readSource: readerFor(WORLD) });
  assert.equal(v.ok, false);
  assert.equal(v.mismatches[0].gap, "sha256_mismatch");
});

test("PEG-06: gathered evidence flips peak-self-loop from HOLD to CONTINUE", () => {
  const held = buildPeakSelfLoopPreview();
  assert.equal(held.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
  assert.equal(held.snr_framework.verified_signal_count, 0);

  const { events } = gatherEvidenceSignals({
    candidates: CANDIDATES,
    readSource: readerFor(WORLD),
  });
  const live = buildPeakSelfLoopPreview({ signal_events: events, noise_events: [] });
  assert.equal(live.snr_framework.verified_signal_count, 3);
  assert.equal(live.autonomous_rsi.merged_verdict, "CONTINUE_MICRO_SLICE");
});

test("PEG-07: the gatherer imports no I/O module", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(
    new URL("../packages/core/src/peak-evidence-gatherer.js", import.meta.url),
    "utf8",
  );
  // Scan IMPORT STATEMENTS only. A bare substring scan matches the boundary
  // comment, which names the very modules it promises not to import.
  const imported = [...src.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)].map(
    (m) => m[1],
  );
  assert.deepEqual(imported, ["node:crypto"]);
});
