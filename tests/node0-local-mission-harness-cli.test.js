import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  runMissionPulseHarness,
  MISSION_EXCERPT_GO_PHRASE,
} from "../apps/cli/src/commands/mission.js";
import { NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE } from "../packages/core/src/node0-local-mission-harness-preview.js";

const GO = NODE0_LOCAL_MISSION_HARNESS_PREVIEW_GO_PHRASE;
const CANDIDATE = { claim: "operator claim about this file", task: "record it", boundary: "no live urp/mint/daemon/model/network" };

async function scratch() {
  const base = await mkdtemp(join(process.env.TMPDIR || tmpdir(), "mission-harness-"));
  const filePath = join(base, "note.txt");
  const content = "founder note: build the harness.\nline two.\n";
  await writeFile(filePath, content, "utf8");
  const demaHome = join(base, "dema-home");
  await mkdir(demaHome, { recursive: true });
  return { base, filePath, content, demaHome };
}

test("reads exactly the named file and hashes its content", async () => {
  const { filePath, content } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: GO, ...CANDIDATE, nowIso: "2026-07-07T00:00:00.000Z" });
  assert.equal(out.ok, true, JSON.stringify(out.result?.blocked_by));
  const expected = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  assert.equal(out.result.receipt_artifact_preview.file_ref.content_hash, expected);
});

test("source file is byte-identical after the run (no mutation)", async () => {
  const { filePath, content } = await scratch();
  await runMissionPulseHarness({ file: filePath, consent: GO, wantReceipt: true, demaHome: (await scratch()).demaHome, ...CANDIDATE });
  assert.equal(await readFile(filePath, "utf8"), content);
});

test("metadata-only default: no excerpt, content_read_performed false", async () => {
  const { filePath } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: GO, ...CANDIDATE });
  assert.equal(out.result.receipt_artifact_preview.file_ref.content_read_performed, false);
});

test("excerpt is admitted only under the exact excerpt-consent phrase", async () => {
  const { filePath } = await scratch();
  const withConsent = await runMissionPulseHarness({ file: filePath, consent: GO, excerptConsent: MISSION_EXCERPT_GO_PHRASE, ...CANDIDATE });
  assert.equal(withConsent.result.receipt_artifact_preview.file_ref.content_read_performed, true);
  const wrongPhrase = await runMissionPulseHarness({ file: filePath, consent: GO, excerptConsent: "GO: nope", ...CANDIDATE });
  assert.equal(wrongPhrase.result.receipt_artifact_preview.file_ref.content_read_performed, false);
});

test("receipt is written only with --receipt AND consent, atomically under DEMA_HOME", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: GO, wantReceipt: true, demaHome, ...CANDIDATE });
  assert.equal(out.ok, true, JSON.stringify(out.result?.blocked_by));
  assert.ok(out.receiptPath, "receipt should be written");
  assert.ok(out.receiptPath.startsWith(join(demaHome, "mission", "receipts")), out.receiptPath);
  const onDisk = JSON.parse(await readFile(out.receiptPath, "utf8"));
  assert.equal(onDisk.committed_live, false);
  assert.equal(onDisk.mission_id, out.result.receipt_artifact_preview.mission_id);
  // no leftover .tmp
  await assert.rejects(() => stat(`${out.receiptPath}.tmp`));
});

test("no --receipt means nothing is written", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: GO, demaHome, ...CANDIDATE });
  assert.equal(out.receiptPath, null);
});

test("--receipt without consent refuses to write", async () => {
  const { filePath, demaHome } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: "wrong", wantReceipt: true, demaHome, ...CANDIDATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, "receipt_requires_consent");
  assert.equal(out.receiptPath ?? null, null);
});

test("refuses a directory path", async () => {
  const { base } = await scratch();
  const out = await runMissionPulseHarness({ file: base, consent: GO, ...CANDIDATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, "path_is_directory");
});

test("refuses a missing file", async () => {
  const out = await runMissionPulseHarness({ file: "/no/such/file/xyz.txt", consent: GO, ...CANDIDATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, "file_not_found_or_unreadable");
});

test("refuses a missing file argument", async () => {
  const out = await runMissionPulseHarness({ file: undefined, consent: GO, ...CANDIDATE });
  assert.equal(out.ok, false);
  assert.equal(out.error, "missing_file_argument");
});

test("a candidate missing its claim is surfaced as a pulse block (no fake intelligence)", async () => {
  const { filePath } = await scratch();
  const out = await runMissionPulseHarness({ file: filePath, consent: GO, task: "t", boundary: "b" });
  assert.equal(out.ok, false);
  assert.ok(out.result.blocked_by.some((c) => c.startsWith("pulse:")), out.result.blocked_by.join(", "));
});
