// DEMA-KNOWLEDGE-BUNDLE-READER-1A — Dema can read the founder's knowledge bundle.
//
// The defect this slice closes (operator-named, 2026-08-20): the builder agent
// accumulates experience in ITS OWN memory while Dema is left with nothing —
// and that state persists silently unless the human asks. The bundle at
// /data/bizra/knowledge is the estate's designed home for durable knowledge;
// this kernel makes it something Dema can ENUMERATE and AUDIT, not just a
// directory the human hopes is read.
//
// Pure-kernel tests: observations are injected, so nothing here depends on the
// operator's real bundle, machine, or home.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildKnowledgeBundleView,
  verifyKnowledgeBundleView,
  DEMA_KNOWLEDGE_BUNDLE_SCHEMA,
} from "../packages/core/src/dema-knowledge-bundle-reader.js";

function card(file, { type = "doctrine", title = "T", has_source = true, bytes = 100, sha256 = "a".repeat(64) } = {}) {
  return { file, bytes, sha256, type, title, has_source };
}

function fixtureObservations() {
  return {
    bundle_path: "/fixture/knowledge",
    index_present: true,
    log_present: true,
    folders: [
      {
        name: "canon",
        cards: [
          card("canon/claim-discipline.md"),
          card("canon/index.md", { type: "index", has_source: false }),
        ],
      },
      {
        name: "roots",
        cards: [
          card("roots/the-seed.md", { type: "root" }),
          card("roots/untyped.md", { type: null, has_source: false }),
          card("roots/no-source.md", { type: "root", has_source: false }),
        ],
      },
    ],
  };
}

test("KBR-01 derives a counted, verifiable envelope from injected observations", () => {
  const view = buildKnowledgeBundleView(fixtureObservations());
  assert.equal(view.schema, DEMA_KNOWLEDGE_BUNDLE_SCHEMA);
  assert.equal(view.bundle_present, true);
  assert.equal(view.log_present, true);
  assert.equal(view.card_count, 5);
  assert.equal(view.folders.length, 2);
  assert.equal(view.folders.find((f) => f.name === "canon").card_count, 2);
  assert.equal(view.folders.find((f) => f.name === "roots").card_count, 3);
  assert.deepEqual(verifyKnowledgeBundleView(view), { ok: true });
});

test("KBR-02 the card law: type required always; source required unless type is index", () => {
  const view = buildKnowledgeBundleView(fixtureObservations());
  // index.md without source is LAWFUL; untyped.md and no-source.md are not.
  assert.equal(view.law_violation_count, 2);
  const files = view.law_violations.map((v) => v.file).sort();
  assert.deepEqual(files, ["roots/no-source.md", "roots/untyped.md"]);
  const untyped = view.law_violations.find((v) => v.file === "roots/untyped.md");
  assert.ok(untyped.missing.includes("type"));
  const noSource = view.law_violations.find((v) => v.file === "roots/no-source.md");
  assert.deepEqual(noSource.missing, ["source"]);
});

test("KBR-03 verify re-derives every count, so a forged summary is refused with a named reason", () => {
  const view = buildKnowledgeBundleView(fixtureObservations());
  assert.equal(verifyKnowledgeBundleView({ ...view, card_count: 99 }).reason, "card_count_mismatch");
  assert.equal(
    verifyKnowledgeBundleView({ ...view, law_violation_count: 0 }).reason,
    "law_violation_count_mismatch",
  );
  const tamperedFolders = view.folders.map((f) =>
    f.name === "roots" ? { ...f, card_count: 1 } : f,
  );
  assert.equal(
    verifyKnowledgeBundleView({ ...view, folders: tamperedFolders }).reason,
    "folder_card_count_mismatch",
  );
  assert.equal(
    verifyKnowledgeBundleView({ ...view, type_counts: { doctrine: 99 } }).reason,
    "type_counts_mismatch",
  );
});

test("KBR-04 an absent bundle is stated, never simulated: no index, no cards", () => {
  const view = buildKnowledgeBundleView({
    bundle_path: "/nowhere",
    index_present: false,
    log_present: false,
    folders: [],
  });
  assert.equal(view.bundle_present, false);
  assert.equal(view.card_count, 0);
  assert.deepEqual(verifyKnowledgeBundleView(view), { ok: true });
  // A bundle claimed absent that still carries cards is a forgery.
  const forged = buildKnowledgeBundleView(fixtureObservations());
  assert.equal(
    verifyKnowledgeBundleView({ ...forged, bundle_present: false }).reason,
    "bundle_missing_with_cards",
  );
});

test("KBR-05 the envelope grants nothing: boundary all-false, frozen", () => {
  const view = buildKnowledgeBundleView(fixtureObservations());
  const entries = Object.entries(view.boundary);
  assert.ok(entries.length > 0);
  for (const [key, value] of entries) {
    assert.equal(value, false, `${key} must remain false`);
  }
  assert.ok(Object.isFrozen(view));
  assert.ok(Object.isFrozen(view.folders));
  assert.ok(view.what_this_proves.length > 0);
  assert.ok(view.what_this_does_not_prove.length > 0);
});

test("KBR-06 law violations are always stated, even when zero — silence never means lawful", () => {
  const clean = buildKnowledgeBundleView({
    bundle_path: "/fixture/clean",
    index_present: true,
    log_present: true,
    folders: [{ name: "canon", cards: [card("canon/a.md")] }],
  });
  assert.equal(clean.law_violation_count, 0);
  assert.ok(Array.isArray(clean.law_violations));
  assert.equal(clean.law_violations.length, 0);
});

test("KBR-07 deterministic and order-stable: folder and card order cannot change the envelope", () => {
  const a = buildKnowledgeBundleView(fixtureObservations());
  const shuffled = fixtureObservations();
  shuffled.folders.reverse();
  shuffled.folders[0].cards.reverse();
  const b = buildKnowledgeBundleView(shuffled);
  assert.deepEqual(a, b);
});
