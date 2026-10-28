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
  "receipts/gate-a.json": '{"gate":"claims-register","exit":0}',
  "receipts/gate-b.json": '{"gate":"integration-check","exit":0}',
  "receipts/gate-c.json": '{"gate":"kernel-purity","exit":0}',
};
const CANDIDATES = [
  { id: "claims-register", type: "gate_passed", source_ref: "receipts/gate-a.json" },
  { id: "integration-check", type: "gate_passed", source_ref: "receipts/gate-b.json" },
  { id: "kernel-purity", type: "gate_passed", source_ref: "receipts/gate-c.json" },
];

test("PEG-01: matching caller-authored gate JSON is not execution evidence", () => {
  const out = gatherEvidenceSignals({
    candidates: [CANDIDATES[0]],
    readSource: readerFor(WORLD),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded_count, 1);
  assert.equal(out.excluded[0].gap, "gate_execution_provenance_unverified");
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

test("PEG-03: rehashing a matching gate declaration does not prove command execution", () => {
  const content = WORLD["receipts/gate-a.json"];
  const v = verifyEvidenceSignals({
    events: [{
      ...CANDIDATES[0],
      weight: 1,
      truth_label: "MEASURED",
      source_sha256: sha(content),
      semantic_verifier: "gate_receipt_exit_0_v1",
    }],
    readSource: readerFor(WORLD),
  });
  assert.equal(v.ok, false);
  assert.equal(v.verified_count, 0);
  assert.equal(v.mismatches[0].gap, "gate_execution_provenance_unverified");
});

test("PEG-04: verify catches content that changed after gathering", () => {
  const content = WORLD["receipts/gate-b.json"];
  const events = [{
    ...CANDIDATES[1],
    weight: 1,
    truth_label: "MEASURED",
    source_sha256: sha(content),
    semantic_verifier: "gate_receipt_exit_0_v1",
  }];
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
      semantic_verifier: "gate_receipt_exit_0_v1",
    },
  ];
  const v = verifyEvidenceSignals({ events: forged, readSource: readerFor(WORLD) });
  assert.equal(v.ok, false);
  assert.equal(v.mismatches[0].gap, "sha256_mismatch");
});

test("PEG-06: caller-authored gate JSON cannot flip peak-self-loop from HOLD to CONTINUE", () => {
  const held = buildPeakSelfLoopPreview();
  assert.equal(held.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
  assert.equal(held.snr_framework.verified_signal_count, 0);

  const gathered = gatherEvidenceSignals({
    candidates: CANDIDATES,
    readSource: readerFor(WORLD),
  });
  assert.equal(gathered.events.length, 0);
  assert.equal(gathered.excluded_count, 3);
  assert.ok(gathered.excluded.every((event) =>
    event.gap === "gate_execution_provenance_unverified"));
  const guardedPreview = buildPeakSelfLoopPreview({ signal_events: gathered.events, noise_events: [] });
  assert.equal(guardedPreview.snr_framework.verified_signal_count, 0);
  assert.equal(guardedPreview.autonomous_rsi.merged_verdict, "HOLD_AND_REDUCE_NOISE");
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

test("PEG-08: readable source code relabelled gate_passed is excluded, not promoted to MEASURED", () => {
  const world = {
    "packages/core/src/fake-gate.js": "export function runGate() { return true; }",
  };
  const out = gatherEvidenceSignals({
    candidates: [
      {
        id: "fake-gate",
        type: "gate_passed",
        source_ref: "packages/core/src/fake-gate.js",
      },
    ],
    readSource: readerFor(world),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded[0].gap, "gate_receipt_json_required");
});

test("PEG-09: a real receipt whose gate failed cannot become a positive signal", () => {
  const world = {
    "receipts/failed.json": '{"gate":"integration-check","exit":1}',
  };
  const out = gatherEvidenceSignals({
    candidates: [
      {
        id: "integration-check",
        type: "gate_passed",
        source_ref: "receipts/failed.json",
      },
    ],
    readSource: readerFor(world),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded[0].gap, "gate_receipt_exit_not_zero");
});

test("PEG-10: a passing receipt for another gate cannot be relabelled as this gate", () => {
  const world = {
    "receipts/wrong-gate.json": '{"gate":"some-other-gate","exit":0}',
  };
  const out = gatherEvidenceSignals({
    candidates: [
      {
        id: "claims-register",
        type: "gate_passed",
        source_ref: "receipts/wrong-gate.json",
      },
    ],
    readSource: readerFor(world),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded[0].gap, "gate_receipt_id_mismatch");
});

test("PEG-11: unsupported positive event classes fail closed until they have a semantic verifier", () => {
  const world = {
    "source/commit.js": "export const shipped = true;",
  };
  const out = gatherEvidenceSignals({
    candidates: [
      {
        id: "some-clean-commit",
        type: "clean_commit",
        source_ref: "source/commit.js",
      },
    ],
    readSource: readerFor(world),
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.excluded[0].gap, "semantic_evidence_unsupported:clean_commit");
});

test("PEG-12: verify rejects a hash-correct forged event whose receipt semantically says failure", () => {
  const content = '{"gate":"claims-register","exit":1}';
  const world = { "receipts/forged.json": content };
  const forged = [
    {
      id: "claims-register",
      type: "gate_passed",
      weight: 1,
      truth_label: "MEASURED",
      source_ref: "receipts/forged.json",
      source_sha256: sha(content),
      semantic_verifier: "gate_receipt_exit_0_v1",
    },
  ];
  const v = verifyEvidenceSignals({ events: forged, readSource: readerFor(world) });
  assert.equal(v.ok, false);
  assert.equal(v.mismatches[0].gap, "gate_receipt_exit_not_zero");
});
