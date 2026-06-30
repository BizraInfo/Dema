import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  buildFounderWorkIndexReport,
  buildFounderWorkIndexReceiptEnvelope,
  expectedContentReadConsent,
} from "../packages/core/src/founder-work-indexer.js";
import {
  buildFounderWorkEvidenceCard,
  formatFounderWorkEvidenceCard,
  summarizeFactKinds,
} from "../packages/core/src/founder-work-evidence-card.js";

const FIXTURE = new URL(
  "./fixtures/founder-work-indexer-sample.md",
  import.meta.url,
);

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("FWI-08 truth_label_summary counts labeled_claim author assertions only", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const sourceSha256 = sha256Hex(sourceText);
  const consent = expectedContentReadConsent(sourceFile);
  const report = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
  });
  assert.equal(report.index_allowed, true);
  assert.ok(report.fact_kind_summary);
  const labeled = report.fact_kind_summary.by_kind.labeled_claim ?? 0;
  const summaryTotal = Object.values(report.truth_label_summary).reduce(
    (a, b) => a + b,
    0,
  );
  assert.equal(summaryTotal, labeled);
});

test("PWR-01 builds evidence card from sealed receipt envelope", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const sourceSha256 = sha256Hex(sourceText);
  const consent = expectedContentReadConsent(sourceFile);
  const report = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const envelope = buildFounderWorkIndexReceiptEnvelope(report, {
    generatedAt: report.generated_at,
  });
  const card = buildFounderWorkEvidenceCard(envelope);
  assert.equal(card.schema, "bizra.dema.founder_work_evidence_card.v0.1");
  assert.equal(card.index_hash, report.index_hash);
  assert.equal(card.fact_count, report.fact_count);
  assert.equal(card.no_mint, true);
  assert.match(card.card_hash, /^[a-f0-9]{64}$/);
  assert.ok(card.top_founder_claims.length >= 1);
  const text = formatFounderWorkEvidenceCard(card);
  assert.match(text, /FOUNDER WORK EVIDENCE CARD/);
});

test("PWR-02 summarizeFactKinds splits structural from author labels", () => {
  const facts = [
    {
      kind: "structural",
      structural_kind: "turn_marker",
      truth_label: "MEASURED",
    },
    {
      kind: "labeled_claim",
      label: "VERIFIED",
      truth_label: "VERIFIED",
    },
    {
      kind: "labeled_claim",
      label: "PLANNED",
      truth_label: "PLANNED",
    },
  ];
  const summary = summarizeFactKinds(facts);
  assert.equal(summary.by_kind.structural, 1);
  assert.equal(summary.by_kind.labeled_claim, 2);
  assert.equal(summary.author_assertion_truth_labels.VERIFIED, 1);
  assert.equal(summary.author_assertion_truth_labels.PLANNED, 1);
  assert.equal(summary.author_assertion_truth_labels.MEASURED, undefined);
});

test("PWR-03 rejects invalid receipt envelope", () => {
  assert.throws(
    () => buildFounderWorkEvidenceCard({ schema: "wrong", no_mint: true }),
    /invalid receipt envelope/,
  );
});
