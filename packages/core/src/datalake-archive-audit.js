// DATALAKE-ARCHIVE-AUDIT-1A · local ZIP metadata inspection.
//
// Reads ZIP central-directory metadata only. It does not extract file bodies,
// inspect file content, write files, call a model, use network, sync repos, mint,
// sign, or classify runtime truth beyond archive-import safety signals.

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

export const DATALAKE_ARCHIVE_AUDIT_SCHEMA =
  "bizra.dema.datalake_archive_audit.v0.1";
export const DATALAKE_ARCHIVE_AUDIT_TRUTH_LABEL =
  "DATALAKE_ARCHIVE_AUDIT_LOCAL_METADATA_ONLY";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_EOCD_SEARCH = 0xffff + EOCD_MIN_SIZE;
const ZIP64_MARKERS = new Set([0xffff, 0xffffffff]);

const SUSPICIOUS_PATH_MARKERS = Object.freeze([
  ".env",
  "secret",
  "secrets",
  "credential",
  "credentials",
  "token",
  "tokens",
  "apikey",
  "api_key",
  "private_key",
  "settings.local",
  "id_rsa",
  ".pem",
  ".p12",
]);

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function normalizeEntryPath(name) {
  return String(name || "").replace(/\\/g, "/");
}

function isAbsoluteArchivePath(name) {
  return /^\//.test(name) || /^[A-Za-z]:\//.test(name);
}

function hasTraversal(name) {
  return normalizeEntryPath(name).split("/").some((part) => part === "..");
}

function suspiciousPathReason(name) {
  const lowered = normalizeEntryPath(name).toLowerCase();
  return SUSPICIOUS_PATH_MARKERS.find((marker) => lowered.includes(marker)) ?? null;
}

function extensionOf(name) {
  const clean = normalizeEntryPath(name).replace(/\/$/, "");
  const last = clean.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  if (dot <= 0 || dot === last.length - 1) return "[none]";
  return last.slice(dot).toLowerCase();
}

function topLevelRoot(name) {
  const clean = normalizeEntryPath(name).replace(/^\/+/, "");
  return clean.split("/").filter(Boolean)[0] ?? "[root]";
}

export function findEndOfCentralDirectory(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("buffer must be a Buffer");
  if (buffer.length < EOCD_MIN_SIZE) {
    throw new Error("ZIP audit failed: archive too small for EOCD");
  }
  const start = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      const commentLength = buffer.readUInt16LE(offset + 20);
      if (offset + EOCD_MIN_SIZE + commentLength === buffer.length) return offset;
    }
  }
  throw new Error("ZIP audit failed: EOCD signature not found");
}

export function parseZipCentralDirectory(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  const zip64Suspected =
    ZIP64_MARKERS.has(totalEntries) ||
    ZIP64_MARKERS.has(entriesOnDisk) ||
    ZIP64_MARKERS.has(centralDirectorySize) ||
    ZIP64_MARKERS.has(centralDirectoryOffset);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error("ZIP audit failed: multi-disk ZIP archives are not supported");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("ZIP audit failed: central directory points outside archive");
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  while (offset < end) {
    if (offset + 46 > buffer.length) {
      throw new Error("ZIP audit failed: truncated central directory header");
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("ZIP audit failed: invalid central directory signature");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const crc32 = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buffer.length) {
      throw new Error("ZIP audit failed: entry filename points outside archive");
    }
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
    const normalizedPath = normalizeEntryPath(name);
    entries.push(
      Object.freeze({
        path: normalizedPath,
        is_directory: normalizedPath.endsWith("/"),
        compressed_size_bytes: compressedSize,
        uncompressed_size_bytes: uncompressedSize,
        compression_method: compression,
        crc32_hex: crc32.toString(16).padStart(8, "0"),
        general_purpose_flags: flags,
        local_header_offset: localHeaderOffset,
        zip64_suspected:
          ZIP64_MARKERS.has(compressedSize) ||
          ZIP64_MARKERS.has(uncompressedSize) ||
          ZIP64_MARKERS.has(localHeaderOffset),
      }),
    );
    offset = nameEnd + extraLength + commentLength;
  }

  return freezeDeep({
    eocd_offset: eocdOffset,
    central_directory_offset: centralDirectoryOffset,
    central_directory_size_bytes: centralDirectorySize,
    entry_count_declared: totalEntries,
    entry_count_on_disk: entriesOnDisk,
    entry_count_parsed: entries.length,
    zip64_suspected: zip64Suspected || entries.some((entry) => entry.zip64_suspected),
    entries,
  });
}

function topPairs(map, limit = 12) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => Object.freeze({ key, count }));
}

export function buildDatalakeArchiveAudit({
  archivePath,
  bytes,
  renderedAtIso = new Date().toISOString(),
  maxLargestEntries = 7,
} = {}) {
  if (!archivePath) throw new Error("archivePath is required");
  if (!Buffer.isBuffer(bytes)) throw new TypeError("bytes must be a Buffer");

  const zip = parseZipCentralDirectory(bytes);
  const extensionCounts = {};
  const rootCounts = {};
  const findings = [];
  const entries = zip.entries.map((entry) => {
    const traversal = hasTraversal(entry.path);
    const absolute = isAbsoluteArchivePath(entry.path);
    const secretReason = suspiciousPathReason(entry.path);
    extensionCounts[extensionOf(entry.path)] = (extensionCounts[extensionOf(entry.path)] ?? 0) + 1;
    rootCounts[topLevelRoot(entry.path)] = (rootCounts[topLevelRoot(entry.path)] ?? 0) + 1;
    if (traversal) findings.push({ severity: "BLOCKER", path: entry.path, reason: "PATH_TRAVERSAL" });
    if (absolute) findings.push({ severity: "BLOCKER", path: entry.path, reason: "ABSOLUTE_PATH" });
    if (secretReason) findings.push({ severity: "REVIEW", path: entry.path, reason: `SUSPICIOUS_PATH_MARKER:${secretReason}` });
    return Object.freeze({
      ...entry,
      path_traversal: traversal,
      absolute_path: absolute,
      suspicious_path_marker: secretReason,
    });
  });

  const files = entries.filter((entry) => !entry.is_directory);
  const directories = entries.filter((entry) => entry.is_directory);
  const blockers = findings.filter((finding) => finding.severity === "BLOCKER");
  const reviewFindings = findings.filter((finding) => finding.severity === "REVIEW");
  const totalUncompressed = files.reduce((sum, entry) => sum + entry.uncompressed_size_bytes, 0);
  const totalCompressed = files.reduce((sum, entry) => sum + entry.compressed_size_bytes, 0);
  const largestEntries = [...files]
    .sort((a, b) => b.uncompressed_size_bytes - a.uncompressed_size_bytes || a.path.localeCompare(b.path))
    .slice(0, maxLargestEntries)
    .map((entry) =>
      Object.freeze({
        path: entry.path,
        uncompressed_size_bytes: entry.uncompressed_size_bytes,
        compressed_size_bytes: entry.compressed_size_bytes,
      }),
    );

  return freezeDeep({
    schema: DATALAKE_ARCHIVE_AUDIT_SCHEMA,
    truth_label: DATALAKE_ARCHIVE_AUDIT_TRUTH_LABEL,
    mode: "local_zip_metadata_only",
    rendered_at_iso: renderedAtIso,
    archive: {
      path: archivePath,
      name: basename(archivePath),
      size_bytes: bytes.length,
      sha256: sha256Buffer(bytes),
    },
    zip: {
      eocd_offset: zip.eocd_offset,
      central_directory_offset: zip.central_directory_offset,
      central_directory_size_bytes: zip.central_directory_size_bytes,
      entry_count_declared: zip.entry_count_declared,
      entry_count_on_disk: zip.entry_count_on_disk,
      entry_count_parsed: zip.entry_count_parsed,
      zip64_suspected: zip.zip64_suspected,
    },
    summary: {
      file_count: files.length,
      directory_count: directories.length,
      total_entries: entries.length,
      total_uncompressed_bytes: totalUncompressed,
      total_compressed_bytes: totalCompressed,
      top_level_roots: topPairs(rootCounts),
      extension_counts: topPairs(extensionCounts),
      largest_entries: largestEntries,
      blocker_count: blockers.length,
      review_finding_count: reviewFindings.length,
      safe_to_extract: blockers.length === 0,
      safe_to_publicly_import_without_review: blockers.length === 0 && reviewFindings.length === 0,
    },
    findings,
    entries,
    boundary: {
      file_content_extracted: false,
      archive_entries_written: false,
      datalake_repo_mutated: false,
      network_performed: false,
      model_invoked: false,
      signing_performed: false,
      mint_performed: false,
      federation_performed: false,
    },
    next_safe_action:
      blockers.length > 0
        ? "Do not extract. Quarantine the archive and remove path traversal or absolute-path entries."
        : reviewFindings.length > 0
          ? "Review suspicious paths before importing this archive into Dema evidence."
          : "Archive is metadata-clean; import only through a separate consent-gated receipt flow.",
  });
}

export function auditDatalakeArchiveFile(archivePath, options = {}) {
  const resolved = resolve(String(archivePath || ""));
  const stat = statSync(resolved);
  if (!stat.isFile()) throw new Error(`Archive path is not a file: ${resolved}`);
  const bytes = readFileSync(resolved);
  return buildDatalakeArchiveAudit({
    archivePath: resolved,
    bytes,
    renderedAtIso: options.renderedAtIso,
  });
}

export function renderDatalakeArchiveAudit(audit) {
  const lines = [
    "DEMA · DATA LAKE ARCHIVE AUDIT",
    `truth: ${audit.truth_label} · mode: ${audit.mode}`,
    `archive: ${audit.archive.name}`,
    `sha256: ${audit.archive.sha256}`,
    `entries: ${audit.summary.total_entries} · files: ${audit.summary.file_count} · dirs: ${audit.summary.directory_count}`,
    `compressed: ${audit.summary.total_compressed_bytes} B · uncompressed: ${audit.summary.total_uncompressed_bytes} B`,
    `findings: blockers=${audit.summary.blocker_count} · review=${audit.summary.review_finding_count}`,
    `safe_to_extract: ${audit.summary.safe_to_extract}`,
    `safe_to_publicly_import_without_review: ${audit.summary.safe_to_publicly_import_without_review}`,
    "",
    "Largest entries:",
    ...audit.summary.largest_entries.map(
      (entry) => `  · ${entry.path} (${entry.uncompressed_size_bytes} B)`,
    ),
    "",
    `Next: ${audit.next_safe_action}`,
    "Boundary: metadata-only · no extract · no write · no network · no model",
  ];
  return lines.join("\n");
}
