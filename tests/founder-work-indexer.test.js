import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
} from "../packages/core/src/preview-boundary.js";
import {
  buildFounderWorkIndexPayload,
  buildFounderWorkIndexReport,
  computeFounderWorkIndexHash,
  expectedContentReadConsent,
  finalizeFactCandidates,
  verifyFounderWorkIndexReport,
  buildFounderWorkIndexReceiptEnvelope,
} from "../packages/core/src/founder-work-indexer.js";
import {
  buildFounderWorkIndexSavePath,
  saveFounderWorkIndex,
} from "../packages/receipts/src/founder-work-index-save.js";

const FIXTURE = new URL(
  "./fixtures/founder-work-indexer-sample.md",
  import.meta.url,
);

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("FWI-01 extracts facts with line spans from fixture", async () => {
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
  assert.ok(report.fact_count >= 1);
  for (const fact of report.payload.facts) {
    assert.ok(fact.file);
    assert.ok(fact.line_span);
    assert.ok(fact.line_span.start >= 1);
    assert.ok(fact.line_span.end >= fact.line_span.start);
  }
});

test("FWI-02 fail-closed drops provenance-less candidates and counts them", () => {
  const result = finalizeFactCandidates(
    [
      {
        kind: "structural",
        value: "ok",
        file: "/tmp/x.md",
        line_span: { start: 1, end: 1 },
      },
      { kind: "structural", value: "bad", file: "/tmp/x.md" },
      { kind: "structural", value: "also-bad", file: "", line_span: { start: 1, end: 1 } },
    ],
    "/tmp/x.md",
  );
  assert.equal(result.facts.length, 1);
  assert.equal(result.rejected_unprovenanced, 2);
});

test("FWI-03 reproducibility: identical source yields identical index hash", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const sourceSha256 = sha256Hex(sourceText);
  const consent = expectedContentReadConsent(sourceFile);
  const a = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const b = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256,
    sourceText,
    offeredConsent: consent,
    generatedAt: "2026-06-30T12:00:00.000Z",
  });
  assert.equal(a.index_hash, b.index_hash);
  assert.equal(verifyFounderWorkIndexReport(a).valid, true);
  assert.equal(verifyFounderWorkIndexReport(b).valid, true);
});

test("FWI-04 receipt seals with sha256 and no_mint true", async () => {
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
  assert.equal(envelope.no_mint, true);
  const built = buildFounderWorkIndexSavePath(envelope, { demaHome: "/tmp/dema-test" });
  assert.match(built.sha256, /^[a-f0-9]{64}$/);
  const demaHome = await mkdtemp(join(tmpdir(), "dema-fwi-"));
  try {
    const saved = await saveFounderWorkIndex(envelope, { demaHome });
    assert.equal(saved.saved, true);
    assert.equal(saved.no_mint, true);
    assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("FWI-05 content_read is canonical and consent is required", () => {
  assert.ok(PREVIEW_BOUNDARY_CANONICAL_KEYS.includes("content_read"));
  const boundary = buildPreviewBoundary();
  assert.equal(boundary.content_read, false);
  const sourceFile = "/tmp/example.md";
  const missing = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256: "abc",
    sourceText: "# hi\n",
    offeredConsent: null,
  });
  assert.equal(missing.index_allowed, false);
  assert.equal(missing.reason_code, "consent_missing");
  const wrong = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256: "abc",
    sourceText: "# hi\n",
    offeredConsent: "GO: content_read /wrong/path.md",
  });
  assert.equal(wrong.index_allowed, false);
  assert.equal(wrong.reason_code, "consent_mismatch");
});

test("FWI-06 refuses directory input and missing GO phrase", () => {
  const sourceFile = "/tmp/folder";
  const dirReport = buildFounderWorkIndexReport({
    sourceFile,
    sourceSha256: "",
    sourceText: "",
    offeredConsent: expectedContentReadConsent(sourceFile),
    inputKind: "directory",
  });
  assert.equal(dirReport.index_allowed, false);
  assert.equal(dirReport.reason_code, "invalid_input_kind");

  const noGo = buildFounderWorkIndexReport({
    sourceFile: "/tmp/a.md",
    sourceSha256: "x",
    sourceText: "hello",
    offeredConsent: "content_read /tmp/a.md",
  });
  assert.equal(noGo.index_allowed, false);
  assert.equal(noGo.reason_code, "consent_mismatch");
});

test("FWI-07 payload hash is stable across direct payload builds", async () => {
  const sourceFile = fileURLToPath(FIXTURE);
  const sourceText = await readFile(FIXTURE, "utf8");
  const sourceSha256 = sha256Hex(sourceText);
  const one = buildFounderWorkIndexPayload({ sourceFile, sourceSha256, sourceText });
  const two = buildFounderWorkIndexPayload({ sourceFile, sourceSha256, sourceText });
  assert.equal(
    computeFounderWorkIndexHash(one.payload),
    computeFounderWorkIndexHash(two.payload),
  );
});
