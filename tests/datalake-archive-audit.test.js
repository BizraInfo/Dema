import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DATALAKE_ARCHIVE_AUDIT_SCHEMA,
  DATALAKE_ARCHIVE_AUDIT_TRUTH_LABEL,
  auditDatalakeArchiveFile,
  buildDatalakeArchiveAudit,
  parseZipCentralDirectory,
  renderDatalakeArchiveAudit,
} from "../packages/core/src/datalake-archive-audit.js";

function centralDirectoryEntry({ path, compressed = 0, uncompressed = 0, localOffset = 0 }) {
  const name = Buffer.from(path, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(compressed, 20);
  header.writeUInt32LE(uncompressed, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localOffset, 42);
  return Buffer.concat([header, name]);
}

function tinyZip(entries) {
  const central = Buffer.concat(entries.map(centralDirectoryEntry));
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(0, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([central, eocd]);
}

test("parseZipCentralDirectory reads entries without extracting content", () => {
  const bytes = tinyZip([
    { path: "bizra-data-lake-1.0.0-genesis/", compressed: 0, uncompressed: 0 },
    { path: "bizra-data-lake-1.0.0-genesis/README.md", compressed: 12, uncompressed: 40 },
  ]);

  const zip = parseZipCentralDirectory(bytes);

  assert.equal(zip.entry_count_declared, 2);
  assert.equal(zip.entry_count_parsed, 2);
  assert.equal(zip.entries[1].path, "bizra-data-lake-1.0.0-genesis/README.md");
  assert.equal(zip.entries[1].uncompressed_size_bytes, 40);
});

test("buildDatalakeArchiveAudit emits local-only archive proof envelope", () => {
  const bytes = tinyZip([
    { path: "root/docs/report.md", compressed: 9, uncompressed: 30 },
    { path: "root/core/main.py", compressed: 7, uncompressed: 20 },
  ]);

  const audit = buildDatalakeArchiveAudit({
    archivePath: "/tmp/bizra-data-lake-1.0.0-genesis.zip",
    bytes,
    renderedAtIso: "2026-06-24T08:00:00.000Z",
  });

  assert.equal(audit.schema, DATALAKE_ARCHIVE_AUDIT_SCHEMA);
  assert.equal(audit.truth_label, DATALAKE_ARCHIVE_AUDIT_TRUTH_LABEL);
  assert.equal(audit.boundary.file_content_extracted, false);
  assert.equal(audit.boundary.network_performed, false);
  assert.equal(audit.summary.file_count, 2);
  assert.equal(audit.summary.safe_to_extract, true);
  assert.equal(audit.summary.safe_to_publicly_import_without_review, true);
  assert.ok(audit.summary.extension_counts.some((item) => item.key === ".md"));
  assert.ok(audit.archive.sha256.match(/^[a-f0-9]{64}$/));
});

test("buildDatalakeArchiveAudit marks suspicious paths for review without reading content", () => {
  const bytes = tinyZip([
    { path: "root/.claude/settings.local.json", compressed: 10, uncompressed: 100 },
    { path: "root/deploy/secrets.env.template", compressed: 10, uncompressed: 100 },
  ]);

  const audit = buildDatalakeArchiveAudit({ archivePath: "/tmp/review.zip", bytes });

  assert.equal(audit.summary.safe_to_extract, true);
  assert.equal(audit.summary.safe_to_publicly_import_without_review, false);
  assert.equal(audit.summary.review_finding_count, 2);
  assert.ok(audit.findings.every((finding) => finding.severity === "REVIEW"));
});

test("auditDatalakeArchiveFile reads one local archive file and render output stays bounded", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-datalake-audit-"));
  try {
    const archivePath = join(dir, "sample.zip");
    writeFileSync(archivePath, tinyZip([{ path: "root/README.md", compressed: 2, uncompressed: 5 }]));

    const audit = auditDatalakeArchiveFile(archivePath, {
      renderedAtIso: "2026-06-24T08:00:00.000Z",
    });
    const rendered = renderDatalakeArchiveAudit(audit);

    assert.equal(audit.summary.total_entries, 1);
    assert.match(rendered, /DATA LAKE ARCHIVE AUDIT/);
    assert.match(rendered, /metadata-only/);
    assert.match(rendered, /no extract/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
