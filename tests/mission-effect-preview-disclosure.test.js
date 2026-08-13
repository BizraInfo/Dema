// MISSION-EFFECT-PREVIEW-DISCLOSURE-1A — CD-01…CD-06.
//
// CR-01, measured on Mission-001 Run-1 Attempt-1: the consent packet promised
// "directory otherwise untouched", and execution then created `.node0-backups/`
// and `.node0-receipts.ndjson`. The executor's own state model excludes `.node0-*`
// from "user-visible", but an internal definition cannot enlarge what a human
// consented to, and the judgment that this was "inside consent" was made AFTER
// consent — the move §5.5 forbids.
//
// The repair is not to relocate the control plane. It is to make the preview
// TRUTHFUL, so those artifacts enter the preview hash and therefore the consent
// context, and the human sees them before agreeing.
//
// NO DOWNGRADE, enforced structurally rather than by a flag: the authority
// binding re-derives with the DISCLOSING builder, so a mission previewed with the
// undisclosed builder simply cannot produce a matching hash. There is no code
// path that executes an undisclosed preview.
//
// ADDITIVE BY OMISSION: the generic builder is untouched, so every existing
// preview hash in the estate stays byte-identical (CD-05).
import test from "node:test";
import assert from "node:assert/strict";

import { buildDemaReversibleFileStewardPayload } from "../packages/core/src/dema-reversible-file-steward.js";
import { NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE } from "../packages/core/src/node0-reversible-execute-gate.js";
import { buildDisclosedStewardPreview } from "../packages/mission/src/mission-effect-authority-binding.js";

const EFFECT = Object.freeze({
  sandbox_root: "/tmp/genesis-mission-root",
  atoms: [{ from: "a.json", to: "a-2026-08-12.json" }],
});
const TWO = Object.freeze({
  sandbox_root: "/tmp/genesis-mission-root",
  atoms: [
    { from: "a.json", to: "a-2026-08-12.json" },
    { from: "b.md", to: "b-2026-08-12.md" },
  ],
});

// ── CD-01 · the preview says what will actually happen ──────────────────────
test("CD-01: the disclosed preview enumerates the backup dir, receipt log and one backup per atom", () => {
  const p = buildDisclosedStewardPreview(EFFECT);
  const cp = p.control_plane_effects;
  assert.equal(cp.disclosed, true);
  assert.equal(cp.backup_dir, ".node0-backups");
  assert.equal(cp.receipt_log, ".node0-receipts.ndjson");
  assert.equal(cp.backup_files.length, 1);
  assert.match(cp.backup_files[0], /^\.node0-backups\/a\.json\./);
  assert.equal(cp.receipt_log_appends, 1);

  const two = buildDisclosedStewardPreview(TWO);
  assert.equal(two.control_plane_effects.backup_files.length, 2);
  assert.equal(two.control_plane_effects.receipt_log_appends, 2);
});

// ── CD-02 · disclosure is inside the hash, not beside it ────────────────────
test("CD-02: disclosure changes the preview hash — consent therefore covers it", () => {
  const plain = buildDemaReversibleFileStewardPayload(EFFECT).content_hash;
  const disclosed = buildDisclosedStewardPreview(EFFECT).content_hash;
  assert.notEqual(
    plain,
    disclosed,
    "if disclosure did not move the hash it would not be bound by consent",
  );
});

// ── CD-03 · the disclosure tracks the effect ────────────────────────────────
test("CD-03: changing the atoms changes both the disclosed artifacts and the hash", () => {
  const a = buildDisclosedStewardPreview(EFFECT);
  const b = buildDisclosedStewardPreview(TWO);
  assert.notEqual(a.content_hash, b.content_hash);
  assert.notDeepEqual(a.control_plane_effects.backup_files, b.control_plane_effects.backup_files);
});

// ── CD-04 · determinism ─────────────────────────────────────────────────────
test("CD-04: the disclosed preview is deterministic and content-addressed", () => {
  assert.equal(
    buildDisclosedStewardPreview(EFFECT).content_hash,
    buildDisclosedStewardPreview({ ...EFFECT }).content_hash,
  );
});

// ── CD-05 · ADDITIVE BY OMISSION — no existing preview hash moved ───────────
test("CD-05: the generic builder is untouched, so legacy preview hashes are byte-identical", () => {
  // Pinned literal: if the generic body ever changes, this fails loudly rather
  // than silently re-baselining every consent hash already recorded in the estate.
  const p = buildDemaReversibleFileStewardPayload(EFFECT);
  assert.equal(
    p.content_hash,
    "sha256:5e8d373d0032063d48d987aac18fcf8598feee09d80ffc3e5480a629388c420b",
  );
  assert.equal(p.control_plane_effects, undefined, "the generic body must stay unchanged");
});

// ── CD-06 · the names come from the gate, not a hardcoded copy ──────────────
test("CD-06: disclosed artifact names are the gate's own constants", () => {
  const cp = buildDisclosedStewardPreview(EFFECT).control_plane_effects;
  assert.equal(cp.backup_dir, NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE.backup_dir);
  assert.equal(cp.receipt_log, NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE.receipt_log);
  assert.ok(
    cp.backup_files[0].endsWith(NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE.backup_suffix),
    "a drifted suffix in the gate must show up here rather than in production",
  );
});
