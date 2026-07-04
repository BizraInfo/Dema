import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  buildProofOfSpendPayload,
  buildProofOfSpendReport,
  buildProofOfSpendReceiptEnvelope,
  computeProofOfSpendHash,
  expectedContentReadConsent,
  parseCsvRow,
  parseUsdCents,
  verifyProofOfSpendReport,
  PROOF_OF_SPEND_TRUTH_LABEL,
  PROOF_OF_SPEND_PLAN_MONTHS,
} from "../packages/core/src/proof-of-spend-1a.js";
import {
  buildProofOfSpendSavePath,
  saveProofOfSpend,
} from "../packages/receipts/src/proof-of-spend-save.js";

const FIXTURE = new URL("./fixtures/proof-of-spend-sample.csv", import.meta.url);

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("POS-01 parseUsdCents handles comma dollars and Free", () => {
  assert.equal(parseUsdCents("$4,000"), 400000);
  assert.equal(parseUsdCents("Free"), 0);
  assert.equal(parseUsdCents("$50.25"), 5025);
  assert.equal(parseUsdCents("not-money"), null);
});

test("POS-02 parseCsvRow respects quoted commas", () => {
  assert.deepEqual(parseCsvRow('a,"$1,000",b'), ["a", "$1,000", "b"]);
});

test("POS-03 extracts transaction facts with line spans", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const { payload } = buildProofOfSpendPayload({
    sourceFile,
    sourceSha256: sha256Hex(sourceText),
    sourceText,
  });
  assert.equal(payload.facts.length, 3);
  for (const fact of payload.facts) {
    assert.equal(fact.kind, "transaction_row");
    assert.ok(fact.file);
    assert.ok(fact.line_span.start >= 2);
  }
});

test("POS-04 verifiable monthly recurring burn claim", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const { payload } = buildProofOfSpendPayload({
    sourceFile,
    sourceSha256: sha256Hex(sourceText),
    sourceText,
  });
  const monthly = payload.claims.find(
    (c) => c.claim_id === "monthly_recurring_burn_usd_cents",
  );
  assert.ok(monthly);
  assert.equal(monthly.value, 3000);
  assert.equal(monthly.verifiable, true);
  assert.equal(PROOF_OF_SPEND_PLAN_MONTHS, 6);
});

test("POS-05 consent gate fail-closed", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const report = buildProofOfSpendReport({
    sourceFile,
    sourceSha256: sha256Hex(sourceText),
    sourceText,
    offeredConsent: null,
  });
  assert.equal(report.index_allowed, false);
  assert.equal(report.refused, true);
  assert.equal(report.truth_label, PROOF_OF_SPEND_TRUTH_LABEL);
});

test("POS-06 reproducibility: identical source yields identical hash", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const sourceSha256 = sha256Hex(sourceText);
  const consent = expectedContentReadConsent(sourceFile);
  const a = buildProofOfSpendReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const b = buildProofOfSpendReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  assert.equal(a.index_hash, b.index_hash);
});

test("POS-07 verifyProofOfSpendReport accepts valid report", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const report = buildProofOfSpendReport({
    sourceFile,
    sourceSha256: sha256Hex(sourceText),
    sourceText,
    offeredConsent: expectedContentReadConsent(sourceFile),
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const check = verifyProofOfSpendReport(report);
  assert.equal(check.valid, true);
});

test("POS-08 save seals under DEMA_HOME with no_mint", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const report = buildProofOfSpendReport({
    sourceFile,
    sourceSha256: sha256Hex(sourceText),
    sourceText,
    offeredConsent: expectedContentReadConsent(sourceFile),
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const envelope = buildProofOfSpendReceiptEnvelope(report, {
    generatedAt: report.generated_at,
  });
  const home = await mkdtemp(join(tmpdir(), "dema-pos-"));
  try {
    const saveResult = await saveProofOfSpend(envelope, { demaHome: home });
    assert.equal(saveResult.saved, true);
    assert.ok(saveResult.path);
    assert.equal(
      saveResult.path,
      buildProofOfSpendSavePath(envelope, { demaHome: home }).path,
    );
    const raw = await readFile(saveResult.path, "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.truth_label, PROOF_OF_SPEND_TRUTH_LABEL);
    assert.equal(parsed.no_mint, true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
