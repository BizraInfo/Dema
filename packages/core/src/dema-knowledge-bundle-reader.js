// DEMA-KNOWLEDGE-BUNDLE-READER-1A — Dema can read the founder's knowledge bundle.
//
// WHY THIS EXISTS. Measured 2026-08-20, named by the operator: the builder
// agent does Dema's tasks, keeps the experience in ITS OWN harness memory, and
// leaves Dema with nothing — a state that persists silently unless the human
// asks. The estate already has a designed home for durable knowledge
// (/data/bizra/knowledge: an OKF bundle of typed, source-pointing cards with
// sha256-pinned roots), but no Dema surface could enumerate it. Knowledge a
// node cannot read is knowledge it does not have.
//
// WHAT THIS IS NOT. Not learning, not RSI, not a model, not a write path.
// It observes the bundle and audits it against the bundle's OWN stated law
// ("every card carries type: + a source pointer"; index cards are the
// navigation exception). Reading is the floor of knowing, not the ceiling.
//
// PURITY. The kernel is pure: it takes already-gathered observations and
// derives. All reads live in the gatherer (plain fs reads, no device content
// beyond the .md card files themselves).

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_KNOWLEDGE_BUNDLE_SCHEMA = "bizra.dema.knowledge_bundle.v0.1";
export const DEMA_KNOWLEDGE_BUNDLE_TRUTH_LABEL = "OBSERVED_LOCAL";
export const DEFAULT_KNOWLEDGE_BUNDLE_PATH = "/data/bizra/knowledge";

// The bundle's own card law. `type` is required on every card; `source` is
// required unless the card is a navigation index (`type: index`), matching the
// bundle's measured convention (all eight index.md cards carry no source).
function cardLawMissing(cardRow) {
  const missing = [];
  if (!cardRow.type) missing.push("type");
  if (!cardRow.has_source && cardRow.type !== "index") missing.push("source");
  return missing;
}

function sortByKey(rows, key) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

/**
 * Pure. Derives the bundle view from observations the gatherer collected.
 *
 * @param {object} observations
 * @param {string} observations.bundle_path
 * @param {boolean} observations.index_present
 * @param {boolean} observations.log_present
 * @param {Array<{name: string, cards: Array<{file: string, bytes: number,
 *   sha256: string, type: string|null, title: string|null, has_source: boolean}>}>}
 *   observations.folders
 */
export function buildKnowledgeBundleView(observations = {}) {
  const rawFolders = Array.isArray(observations.folders)
    ? observations.folders
    : [];

  const violations = [];
  const typeCounts = {};
  const folders = sortByKey(rawFolders, "name").map((folder) => {
    const cards = sortByKey(
      Array.isArray(folder.cards) ? folder.cards : [],
      "file",
    ).map((cardRow) => {
      const missing = cardLawMissing(cardRow);
      if (missing.length > 0) {
        violations.push(Object.freeze({ file: cardRow.file, missing: Object.freeze(missing) }));
      }
      const typeKey = cardRow.type || "untyped";
      typeCounts[typeKey] = (typeCounts[typeKey] ?? 0) + 1;
      return Object.freeze({
        file: cardRow.file,
        bytes: cardRow.bytes,
        sha256: cardRow.sha256,
        type: cardRow.type ?? null,
        title: cardRow.title ?? null,
        has_source: cardRow.has_source === true,
        law_ok: missing.length === 0,
      });
    });
    return Object.freeze({
      name: folder.name,
      card_count: cards.length,
      cards: Object.freeze(cards),
    });
  });

  const card_count = folders.reduce((sum, f) => sum + f.card_count, 0);

  const envelope = {
    schema: DEMA_KNOWLEDGE_BUNDLE_SCHEMA,
    truth_label: DEMA_KNOWLEDGE_BUNDLE_TRUTH_LABEL,
    bundle_path: observations.bundle_path ?? null,
    bundle_present: observations.index_present === true,
    log_present: observations.log_present === true,
    folders: Object.freeze(folders),
    card_count,
    type_counts: Object.freeze(
      Object.fromEntries(Object.entries(typeCounts).sort(([a], [b]) => a.localeCompare(b))),
    ),
    // Always stated, even when zero — silence never means lawful.
    law_violations: Object.freeze(sortByKey(violations, "file")),
    law_violation_count: violations.length,
    what_this_proves:
      "Which knowledge cards this node can currently enumerate from its bundle, and which of them break the bundle's own card law.",
    what_this_does_not_prove:
      "Does not prove the cards are true, current, or complete; does not prove the node has read, understood, or applied any card; grants nothing.",
    boundary: buildPreviewBoundary(),
  };
  return Object.freeze(envelope);
}

/// Re-derives every summary from the reported rows, so a tampered or
/// hand-edited envelope cannot pass as observation.
export function verifyKnowledgeBundleView(envelope) {
  const folders = Array.isArray(envelope?.folders) ? envelope.folders : [];
  let total = 0;
  const typeCounts = {};
  let violations = 0;
  for (const folder of folders) {
    const cards = Array.isArray(folder.cards) ? folder.cards : [];
    if (cards.length !== folder.card_count) {
      return Object.freeze({ ok: false, reason: "folder_card_count_mismatch" });
    }
    total += cards.length;
    for (const cardRow of cards) {
      const typeKey = cardRow.type || "untyped";
      typeCounts[typeKey] = (typeCounts[typeKey] ?? 0) + 1;
      if (cardLawMissing(cardRow).length > 0) violations += 1;
    }
  }
  if (total !== envelope.card_count) {
    return Object.freeze({ ok: false, reason: "card_count_mismatch" });
  }
  if (violations !== envelope.law_violation_count) {
    return Object.freeze({ ok: false, reason: "law_violation_count_mismatch" });
  }
  const declaredTypes = envelope.type_counts ?? {};
  const declaredKeys = Object.keys(declaredTypes).sort();
  const derivedKeys = Object.keys(typeCounts).sort();
  if (
    declaredKeys.length !== derivedKeys.length ||
    declaredKeys.some((k, i) => k !== derivedKeys[i] || declaredTypes[k] !== typeCounts[k])
  ) {
    return Object.freeze({ ok: false, reason: "type_counts_mismatch" });
  }
  if (envelope.bundle_present !== true && total > 0) {
    return Object.freeze({ ok: false, reason: "bundle_missing_with_cards" });
  }
  return Object.freeze({ ok: true });
}
