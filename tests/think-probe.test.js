import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runThinkProbe,
  renderThinkProbeText,
} from "../packages/think/src/think-probe.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("think-probe", () => {
  describe("runThinkProbe", () => {
    it("returns CLEAN verdict with 5/5 PASS", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      assert.equal(report.schema, "bizra.dema.think_probe.v0.1");
      assert.equal(report.target, "think_receipt");
      assert.equal(report.verdict, "CLEAN");
      assert.equal(report.probes_total, 5);
      assert.equal(report.probes_passing, 5);
      assert.equal(report.probes_failing, 0);
      assert.equal(report.boundary.network_used, "STATIC_CHECKED");
      assert.equal(report.boundary.model_invocation, "SYNTHETIC_ONLY");
    });

    it("probe 1: boundary_observed passes with correct evidence", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "boundary_observed");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.fs_write.level, "OBSERVED");
      assert.equal(probe.evidence.fs_write.new_files, 1);
      assert.equal(probe.evidence.network_used.level, "STATIC_CHECKED");
      assert.equal(probe.evidence.network_used.forbidden_imports, 0);
      assert.equal(probe.evidence.data_leakage.clean, true);
      assert.equal(probe.evidence.data_leakage.no_context_manifest, true);
      assert.equal(probe.evidence.data_leakage.no_hit_summaries, true);
    });

    it("probe 2: determinism passes", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "determinism");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.runs, 2);
      assert.equal(probe.evidence.hashes_match, true);
    });

    it("probe 3: consent_gate passes", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "consent_gate");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.no_consent_file_written, false);
      assert.equal(probe.evidence.with_consent_file_written, true);
    });

    it("probe 4: receipt_integrity passes", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "receipt_integrity");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.hash_match, true);
    });

    it("probe 5: tamper_detection passes", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "tamper_detection");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.tampered_hash_differs, true);
    });
  });

  describe("renderThinkProbeText", () => {
    it("renders human-readable report", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const text = renderThinkProbeText(report);
      assert.match(text, /Behavioral Think Probe v0\.1/);
      assert.match(text, /think_receipt/);
      assert.match(text, /CLEAN/);
      assert.match(text, /5\/5 PASS/);
      assert.match(text, /boundary_observed/);
      assert.match(text, /determinism/);
      assert.match(text, /consent_gate/);
      assert.match(text, /receipt_integrity/);
      assert.match(text, /tamper_detection/);
    });

    it("renders OBSERVED and STATIC_CHECKED labels", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      const text = renderThinkProbeText(report);
      assert.match(text, /OBSERVED/);
      assert.match(text, /STATIC_CHECKED/);
    });

    it("returns error string when report has error", () => {
      const text = renderThinkProbeText({ error: "probe crashed" });
      assert.equal(text, "probe crashed");
    });
  });

  describe("verdict derivation", () => {
    it("CLEAN when all probes pass", async () => {
      const report = await runThinkProbe(REPO_ROOT);
      assert.equal(report.verdict, "CLEAN");
    });
  });
});
