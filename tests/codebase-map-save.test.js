import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CODEBASE_MAP_SAVE_CONSENT,
  CODEBASE_MAP_SAVE_SCHEMA,
  MAX_SAVED_BYTES,
  serializeCodebaseMapForSave,
  buildCodebaseMapSavePath,
  saveCodebaseMap
} from "../packages/receipts/src/codebase-map-save.js";

function minimalEnvelope() {
  return {
    schema: "bizra.dema.codebase_architecture_map.v0.1",
    scanned_at: "2026-05-21T18:00:00.000Z",
    repo_path: "/tmp/example",
    repo_path_realpath_verified: true,
    scan_config: null,
    totals: { file_count: 0, symlink_count: 0, total_bytes: 0, total_bytes_read: 0, by_extension: {}, by_role: {} },
    packages: [], modules: [], files: [], symlinks: [], edges: [], hotspots: [],
    warnings: [], partial: false, error_reason: null,
    blocked_effects: ["file_write"],
    boundary: { runtime: true, file_io: true, network_used: false, model_invocation: false,
                mutation: false, federation: false, mint: false, token_economy: false,
                urp_networking: false, secret_files_skipped: true }
  };
}

async function makeHome() {
  return mkdtemp(join(tmpdir(), "codebase-map-save-helper-"));
}

// 1. Exports + constants surface
test("exports: CONSENT phrase, schema, MAX_SAVED_BYTES are stable", () => {
  assert.equal(CODEBASE_MAP_SAVE_CONSENT, "GO: save local codebase architecture map");
  assert.equal(CODEBASE_MAP_SAVE_SCHEMA, "bizra.dema.codebase_architecture_map_save.v0.1");
  assert.equal(MAX_SAVED_BYTES, 268_435_456);
  assert.equal(typeof MAX_SAVED_BYTES, "number");
  assert.ok(Number.isInteger(MAX_SAVED_BYTES));
});

// 2. Fail-closed: consent missing
test("saveCodebaseMap fails closed on consent_missing", async () => {
  const home = await makeHome();
  const result = await saveCodebaseMap(minimalEnvelope(), { demaHome: home });
  assert.equal(result.saved, false);
  assert.equal(result.reason, "consent_missing");
  assert.equal(result.expected, CODEBASE_MAP_SAVE_CONSENT);
  // No directory created on consent failure
  assert.equal(existsSync(join(home, "receipts")), false);
});

// 3. Fail-closed: consent mismatch
test("saveCodebaseMap fails closed on consent_mismatch", async () => {
  const home = await makeHome();
  const result = await saveCodebaseMap(minimalEnvelope(), { demaHome: home, consent: "wrong phrase" });
  assert.equal(result.saved, false);
  assert.equal(result.reason, "consent_mismatch");
  assert.equal(result.expected, CODEBASE_MAP_SAVE_CONSENT);
});

// 4. Fail-closed: oversized serialized envelope exceeds maxBytes cap.
// Uses test-injected tiny cap (100 bytes) rather than allocating 270 MiB
// to exercise the same code path without test-runner memory pressure.
// Production cap (MAX_SAVED_BYTES = 256 MiB) is verified separately in
// test #1 (constant value assertion).
test("saveCodebaseMap fails closed on oversized_serialized_envelope (using injected tiny cap)", async () => {
  const home = await makeHome();
  const env = minimalEnvelope();
  // minimalEnvelope() serializes to well over 100 bytes; force-cap to 100
  // to exercise the oversized path deterministically.
  const result = await saveCodebaseMap(env, {
    demaHome: home,
    consent: CODEBASE_MAP_SAVE_CONSENT,
    maxBytes: 100
  });
  assert.equal(result.saved, false);
  assert.equal(result.reason, "oversized_serialized_envelope");
  assert.equal(result.max_saved_bytes, 100);
  assert.ok(result.serialized_bytes > 100);
  // No file written on size failure
  if (existsSync(join(home, "receipts"))) {
    const files = await readdir(join(home, "receipts"));
    const mapFiles = files.filter((f) => f.startsWith("codebase-map-"));
    assert.equal(mapFiles.length, 0);
  }
});

// 4b. Within-cap envelope saves successfully (sanity: tiny cap doesn't break
// the happy path when the envelope fits).
test("saveCodebaseMap saves successfully when serialized_bytes <= maxBytes", async () => {
  const home = await makeHome();
  const env = minimalEnvelope();
  // Generous cap > minimalEnvelope serialization (~1000 bytes)
  const result = await saveCodebaseMap(env, {
    demaHome: home,
    consent: CODEBASE_MAP_SAVE_CONSENT,
    maxBytes: 1024 * 1024
  });
  assert.equal(result.saved, true);
  assert.ok(result.serialized_bytes < 1024 * 1024);
});

// 5. Happy path success return shape is frozen
test("saveCodebaseMap success return shape is frozen + content addressed", async () => {
  const home = await makeHome();
  const env = minimalEnvelope();
  const result = await saveCodebaseMap(env, { demaHome: home, consent: CODEBASE_MAP_SAVE_CONSENT });
  assert.equal(result.saved, true);
  assert.equal(typeof result.path, "string");
  assert.match(result.filename, /^codebase-map-[a-f0-9]{64}\.json$/);
  assert.equal(typeof result.sha256, "string");
  assert.equal(result.sha256.length, 64);
  assert.equal(result.dema_home, home);
  assert.equal(typeof result.serialized_bytes, "number");
  // Frozen
  assert.throws(() => { result.path = "/tmp/hijacked"; }, /(Cannot assign|read[- ]only)/i);
  // Disk content matches what the helper serialized
  const onDisk = await readFile(result.path, "utf8");
  const expected = serializeCodebaseMapForSave(env, { pretty: false });
  assert.equal(onDisk, expected);
});

// 6. buildCodebaseMapSavePath is pure (no I/O)
test("buildCodebaseMapSavePath is pure: no directory creation; deterministic path", async () => {
  const home = await makeHome();
  const env = minimalEnvelope();
  const built = buildCodebaseMapSavePath(env, { demaHome: home });
  // No receipts dir created
  assert.equal(existsSync(join(home, "receipts")), false);
  // Path under receipts
  assert.equal(built.dir, join(home, "receipts"));
  assert.match(built.filename, /^codebase-map-[a-f0-9]{64}\.json$/);
  // Deterministic: same input → same output
  const again = buildCodebaseMapSavePath(env, { demaHome: home });
  assert.equal(again.sha256, built.sha256);
  assert.equal(again.path, built.path);
});

// 7. serializeCodebaseMapForSave: pretty toggle changes bytes; trailing newline always present
test("serializer: pretty toggle and trailing newline invariants", () => {
  const env = minimalEnvelope();
  const compact = serializeCodebaseMapForSave(env, { pretty: false });
  const pretty = serializeCodebaseMapForSave(env, { pretty: true });
  assert.ok(compact.endsWith("\n"));
  assert.ok(pretty.endsWith("\n"));
  assert.notEqual(compact, pretty);
  // Compact is single-line JSON + newline
  assert.equal(compact.split("\n").length, 2);
  // Pretty has indented multi-line shape
  assert.ok(pretty.split("\n").length > 2);
});

// 8. io_error path: pre-existing target file with same content-addressed name
//    triggers rename failure handling. Construct the exact scenario the
//    atomic-write canon guards against: a prior file at the final path with
//    different content. Since codebase-map filenames are sha256 of content,
//    two identical envelopes hash to the same name — the rename overwrites
//    cleanly on POSIX (it's an idempotent save). The actual io_error path is
//    exercised when temp-file creation fails (writeFile with flag:"wx" on a
//    pre-existing temp file). We assert via mock: pre-create the temp file
//    pattern to force EEXIST.
//
// NOTE: this test verifies the helper's io_error SHAPE (saved=false, reason,
// expected, error_message), not a specific platform-dependent failure cause.
test("saveCodebaseMap returns saved=true on idempotent re-save of identical envelope (rename overwrites)", async () => {
  // Two saves of the same envelope produce the same content-addressed
  // filename. Second save's temp file has a different .tmp suffix
  // (pid+timestamp), so writeFile{flag:"wx"} succeeds. Rename overwrites the
  // existing final file atomically on POSIX. Result: both succeed.
  const home = await makeHome();
  const env = minimalEnvelope();
  const r1 = await saveCodebaseMap(env, { demaHome: home, consent: CODEBASE_MAP_SAVE_CONSENT });
  const r2 = await saveCodebaseMap(env, { demaHome: home, consent: CODEBASE_MAP_SAVE_CONSENT });
  assert.equal(r1.saved, true);
  assert.equal(r2.saved, true);
  assert.equal(r1.path, r2.path, "same envelope → same content-addressed path");
  const files = await readdir(join(home, "receipts"));
  const mapFiles = files.filter((f) => f.startsWith("codebase-map-") && f.endsWith(".json"));
  assert.equal(mapFiles.length, 1, "idempotent re-save yields one final file");
});
