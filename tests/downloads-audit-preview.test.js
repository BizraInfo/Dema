import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  TASK_REGISTRY,
  formatTaskReceipt,
  runDownloadsAuditPreview
} from "../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyReceiptPlaceholder
} from "../packages/verifier/src/sat-placeholder.js";

async function makeFixtureDownloads() {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-fixture-downloads-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-fixture-home-"));
  await writeFile(join(downloadsRoot, "alpha.txt"), "hello\n");
  await writeFile(join(downloadsRoot, "bravo.pdf"), "fake-pdf\n");
  await writeFile(join(downloadsRoot, "charlie.pdf"), "another-fake\n");
  await mkdir(join(downloadsRoot, "subdir"), { recursive: true });
  return { downloadsRoot, demaRoot };
}

test("runDownloadsAuditPreview produces a schema-tagged read-only receipt with payload digest", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const before = await readdir(downloadsRoot);
  before.sort();

  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });

  assert.equal(receipt.schema, "bizra.dema.task_receipt.v0.1");
  assert.equal(receipt.task_id, "downloads.audit.preview");
  assert.equal(receipt.scope, "read-only");
  assert.equal(receipt.rollback_required, false);
  assert.equal(receipt.truth_label, "MEASURED");
  assert.equal(receipt.sat_verdict, "PARTIAL_PLACEHOLDER");
  assert.match(receipt.payload_digest, /^[0-9a-f]{64}$/);
  assert.equal(receipt.target, downloadsRoot);
  assert.equal(receipt.result.file_count, 3);
  assert.equal(receipt.result.dir_count, 1);
  assert.equal(receipt.result.by_extension[".pdf"], 2);
  assert.equal(receipt.result.by_extension[".txt"], 1);

  const after = await readdir(downloadsRoot);
  after.sort();
  assert.deepEqual(after, before, "downloads dir must not be mutated by a read-only preview");
});

test("runDownloadsAuditPreview writes the receipt under ~/.dema/receipts/", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  assert.ok(receipt.written_to);
  const written = JSON.parse(await readFile(receipt.written_to, "utf8"));
  assert.equal(written.receipt_id, receipt.receipt_id);
  assert.equal(written.payload_digest, receipt.payload_digest);
});

test("runDownloadsAuditPreview reports error gracefully when target missing", async () => {
  const { demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({
    downloadsRoot: "/nonexistent-dema-test-target-xyz",
    demaRoot
  });
  assert.match(receipt.error, /not_found/);
  assert.equal(receipt.scope, "read-only");
});

test("formatTaskReceipt renders the key fields without throwing", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const text = formatTaskReceipt(receipt);
  assert.match(text, /Task:\s+downloads\.audit\.preview/);
  assert.match(text, /Scope:\s+read-only/);
  assert.match(text, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
});

test("TASK_REGISTRY exposes downloads.audit.preview with autonomy_level", () => {
  const t = TASK_REGISTRY["downloads.audit.preview"];
  assert.ok(t);
  assert.equal(t.id, "downloads.audit.preview");
  assert.match(t.autonomy_level, /L0\/L1/);
});

test("verifyReceiptPlaceholder returns PARTIAL_PLACEHOLDER on a valid task receipt", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const verdict = verifyReceiptPlaceholder(receipt);
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.ok(verdict.checks.every((c) => c.pass), `all shallow checks should pass; got ${JSON.stringify(verdict.checks)}`);
});

test("verifyReceiptPlaceholder REJECTs a tampered receipt that claims a stronger verdict", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const tampered = { ...receipt, sat_verdict: "PERMIT" };
  const verdict = verifyReceiptPlaceholder(tampered);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "verdict_honestly_declared_as_placeholder" && !c.pass));
});

test("verifyReceiptPlaceholder REJECTs receipt missing payload_digest", () => {
  const verdict = verifyReceiptPlaceholder({
    scope: "read-only",
    rollback_required: false,
    sat_verdict: "PARTIAL_PLACEHOLDER"
  });
  assert.equal(verdict.verdict, "REJECT");
});

test("formatVerdict renders all checks with pass/fail marks", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const verdict = verifyReceiptPlaceholder(receipt);
  const text = formatVerdict(verdict);
  assert.match(text, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
  assert.match(text, /✓ scope_declared_read_only/);
});
