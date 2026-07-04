import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveMissionReceipt,
  buildCloseoutReport,
  renderCloseoutText,
} from "../packages/mission/src/mission-closeout.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

function makeReceipt(overrides = {}) {
  const baseAttests = {
    mission_type: "health_snapshot",
    executed_at: "2026-05-25T22:00:00.000Z",
    mission_verdict: "CLEAN",
    results: {
      setup: { verdict: "INTACT", checks: 7, missing: 0 },
      harness: { verdict: "CLEAN", gaps: 0, gates: "5/5 passing", hooks: 6 },
      doctor: { predicates: 5, ok: 5, fail: 0, warn: 0 },
      witness: { exists: true, verdict: "VERIFIED" },
      memory: { entries: 3 },
    },
    boundary: {
      filesystem_write_performed: true,
      network_used: false,
      runtime_execution_performed: false,
      model_loaded: false,
      model_invocation_performed: false,
      prompt_executed: false,
      external_call_performed: false,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: true,
      content_read: false,
    },
    consent_verified: true,
  };
  const attests = overrides.attests
    ? { ...baseAttests, ...overrides.attests }
    : baseAttests;
  const content_hash = sha256(stableStringify(attests));
  return {
    schema: "bizra.dema.mission_receipt.health_snapshot.v0.1",
    truth_label: "LOCAL_OPERATOR_MISSION",
    mission_id: `health_snapshot_${content_hash.slice(0, 12)}`,
    attests,
    content_hash,
    ...(overrides.top || {}),
  };
}

describe("mission-closeout", () => {
  describe("resolveMissionReceipt", () => {
    it("returns error when receipts dir missing", async () => {
      const emptyHome = await mkdtemp(join(tmpdir(), "dema-closeout-empty-"));
      const result = await resolveMissionReceipt(undefined, emptyHome);
      assert.ok(result.error);
      assert.match(result.error, /No mission receipts found/);
    });

    it("returns error when no mission files exist", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-closeout-nofiles-"));
      await mkdir(join(home, "receipts"), { recursive: true });
      await writeFile(join(home, "receipts", "other.json"), "{}");
      const result = await resolveMissionReceipt(undefined, home);
      assert.ok(result.error);
      assert.match(result.error, /No mission receipts found/);
    });

    it("resolves latest mission receipt by mtime", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-closeout-mtime-"));
      const dir = join(home, "receipts");
      await mkdir(dir, { recursive: true });
      const r1 = makeReceipt();
      const r2 = makeReceipt({
        attests: { executed_at: "2026-05-26T01:00:00.000Z" },
      });
      await writeFile(join(dir, "mission-health-aaa.json"), JSON.stringify(r1));
      await new Promise((r) => setTimeout(r, 50));
      await writeFile(join(dir, "mission-health-bbb.json"), JSON.stringify(r2));
      const result = await resolveMissionReceipt(undefined, home);
      assert.ok(!result.error);
      assert.equal(result.filename, "mission-health-bbb.json");
    });

    it("resolves by substring ID match", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-closeout-id-"));
      const dir = join(home, "receipts");
      await mkdir(dir, { recursive: true });
      const r = makeReceipt();
      await writeFile(
        join(dir, "mission-health-abc123def.json"),
        JSON.stringify(r),
      );
      const result = await resolveMissionReceipt("abc123", home);
      assert.ok(!result.error);
      assert.equal(result.filename, "mission-health-abc123def.json");
    });

    it("returns error for corrupted JSON receipt", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-closeout-corrupt-"));
      const dir = join(home, "receipts");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "mission-health-corrupt.json"), "NOT JSON{{{");
      const result = await resolveMissionReceipt("corrupt", home);
      assert.ok(result.error);
      assert.match(result.error, /not valid JSON/);
    });

    it("returns error for corrupted latest receipt", async () => {
      const home = await mkdtemp(
        join(tmpdir(), "dema-closeout-corruptlatest-"),
      );
      const dir = join(home, "receipts");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "mission-health-bad.json"), "{broken");
      const result = await resolveMissionReceipt(undefined, home);
      assert.ok(result.error);
      assert.match(result.error, /not valid JSON/);
    });

    it("returns error for unmatched ID", async () => {
      const home = await mkdtemp(join(tmpdir(), "dema-closeout-nomatch-"));
      const dir = join(home, "receipts");
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "mission-health-abc.json"),
        JSON.stringify(makeReceipt()),
      );
      const result = await resolveMissionReceipt("zzz999", home);
      assert.ok(result.error);
      assert.match(result.error, /No receipt matching 'zzz999' found/);
    });
  });

  describe("buildCloseoutReport", () => {
    it("builds report with verified hash", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      assert.equal(report.schema, "bizra.dema.mission_closeout.v0.1");
      assert.equal(report.verification.content_hash_match, true);
      assert.equal(report.summary.verdict, "CLEAN");
      assert.equal(report.summary.boundary.true_count, 2);
      assert.equal(
        report.summary.boundary.false_count,
        PREVIEW_BOUNDARY_CANONICAL_KEYS.length - 2,
      );
      assert.equal(
        report.summary.boundary.total_keys,
        PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
      );
    });

    it("detects tampered hash", () => {
      const receipt = makeReceipt();
      receipt.content_hash =
        "0000000000000000000000000000000000000000000000000000000000000000";
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      assert.equal(report.verification.content_hash_match, false);
    });

    it("returns error for malformed receipt", () => {
      const report = buildCloseoutReport({}, "/tmp/r.json", "r.json");
      assert.ok(report.error);
      assert.match(report.error, /malformed/);
    });

    it("preserves mission_id from receipt", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      assert.equal(report.mission_id, receipt.mission_id);
    });

    it("includes source receipt metadata", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(
        receipt,
        "/home/test/.dema/receipts/r.json",
        "r.json",
      );
      assert.equal(report.source_receipt, "r.json");
      assert.equal(report.source_path, "/home/test/.dema/receipts/r.json");
    });
  });

  describe("renderCloseoutText", () => {
    it("renders human-readable report", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /Mission Closeout Evidence Report/);
      assert.match(text, /CLEAN/);
      assert.match(text, /PASS/);
      assert.match(text, /Integrity.*matches/);
    });

    it("renders mismatch warning", () => {
      const receipt = makeReceipt();
      receipt.content_hash = "bad";
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /MISMATCH/);
    });

    it("renders error string when report has error", () => {
      const text = renderCloseoutText({ error: "broken" });
      assert.equal(text, "broken");
    });

    it("renders setup, harness, doctor, witness, memory rows", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /Setup:.*INTACT/);
      assert.match(text, /Harness:.*CLEAN/);
      assert.match(text, /Doctor:.*5 ok/);
      assert.match(text, /Witness:.*VERIFIED/);
      assert.match(text, /Memory:.*3 entries/);
    });

    it("renders witness not present", () => {
      const receipt = makeReceipt({
        attests: {
          results: {
            setup: { verdict: "INTACT", checks: 7, missing: 0 },
            harness: {
              verdict: "CLEAN",
              gaps: 0,
              gates: "5/5 passing",
              hooks: 6,
            },
            doctor: { predicates: 5, ok: 5, fail: 0, warn: 0 },
            witness: { exists: false, verdict: null },
            memory: { entries: 3 },
          },
        },
      });
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(text, /Witness:.*not present/);
    });

    it("renders boundary true keys", () => {
      const receipt = makeReceipt();
      const report = buildCloseoutReport(receipt, "/tmp/r.json", "r.json");
      const text = renderCloseoutText(report);
      assert.match(
        text,
        new RegExp(`Boundary.*${PREVIEW_BOUNDARY_CANONICAL_KEYS.length} keys`),
      );
      assert.match(text, /YES/);
      assert.match(text, /All others: NO/);
    });
  });
});
