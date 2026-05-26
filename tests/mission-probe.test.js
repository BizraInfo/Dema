import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runMissionProbe,
  renderProbeText,
} from "../packages/mission/src/mission-probe.js";
import {
  saveHealthSnapshotReceipt,
  HEALTH_MISSION_CONSENT_PHRASE,
} from "../packages/mission/src/health-snapshot.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";
import { runSetup } from "../packages/installer/src/setup.js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("mission-probe", () => {
  describe("runMissionProbe", () => {
    it("returns CLEAN verdict with 5/5 PASS", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      assert.equal(report.schema, "bizra.dema.mission_probe.v0.1");
      assert.equal(report.target, "health_snapshot");
      assert.equal(report.verdict, "CLEAN");
      assert.equal(report.probes_total, 5);
      assert.equal(report.probes_passing, 5);
      assert.equal(report.probes_failing, 0);
      assert.equal(report.boundary.network_used, false);
      assert.equal(report.boundary.operator_home_touched, false);
    });

    it("probe 1: boundary_observed_v0_1 passes with correct evidence levels", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const probe = report.probes.find(
        (p) => p.name === "boundary_observed_v0_1",
      );
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.fs_write.level, "OBSERVED");
      assert.ok(probe.evidence.fs_write.new_files >= 1);
      assert.equal(probe.evidence.network_used.level, "STATIC_CHECKED");
      assert.equal(probe.evidence.network_used.forbidden_imports, 0);
      assert.equal(probe.evidence.consent_collected.level, "OBSERVED");
      assert.ok(probe.evidence.not_observable_count >= 1);
    });

    it("probe 2: determinism passes", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "determinism");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.runs, 2);
      assert.equal(probe.evidence.hashes_match, true);
    });

    it("probe 3: consent_gate passes", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "consent_gate");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.no_consent_file_written, false);
      assert.equal(probe.evidence.with_consent_file_written, true);
    });

    it("probe 4: receipt_integrity passes", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "receipt_integrity");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.hash_match, true);
    });

    it("probe 5: tamper_detection passes", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const probe = report.probes.find((p) => p.name === "tamper_detection");
      assert.ok(probe);
      assert.equal(probe.pass, true);
      assert.equal(probe.evidence.tampered_hash_differs, true);
    });
  });

  describe("renderProbeText", () => {
    it("renders human-readable report", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const text = renderProbeText(report);
      assert.match(text, /Behavioral Mission Probe v0\.1/);
      assert.match(text, /health_snapshot/);
      assert.match(text, /CLEAN/);
      assert.match(text, /5\/5 PASS/);
      assert.match(text, /boundary_observed_v0_1/);
      assert.match(text, /determinism/);
      assert.match(text, /consent_gate/);
      assert.match(text, /receipt_integrity/);
      assert.match(text, /tamper_detection/);
    });

    it("renders OBSERVED and STATIC_CHECKED labels", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const text = renderProbeText(report);
      assert.match(text, /OBSERVED/);
      assert.match(text, /STATIC_CHECKED/);
      assert.match(text, /DECLARED_NOT_OBSERVABLE_V0_1/);
    });

    it("returns error string when report has error", () => {
      const text = renderProbeText({ error: "probe crashed" });
      assert.equal(text, "probe crashed");
    });
  });

  describe("evidence levels", () => {
    it("static check finds zero forbidden imports in health-snapshot chain", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const boundary = report.probes.find(
        (p) => p.name === "boundary_observed_v0_1",
      );
      assert.equal(boundary.evidence.network_used.forbidden_imports, 0);
    });

    it("boundary keys are partitioned into OBSERVED + STATIC_CHECKED + NOT_OBSERVABLE", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      const ev = report.probes.find(
        (p) => p.name === "boundary_observed_v0_1",
      ).evidence;
      assert.equal(ev.fs_write.level, "OBSERVED");
      assert.equal(ev.consent_collected.level, "OBSERVED");
      assert.equal(ev.network_used.level, "STATIC_CHECKED");
      assert.equal(ev.runtime_execution_performed.level, "STATIC_CHECKED");
      assert.ok(ev.not_observable_count > 0);
    });
  });

  describe("verdict derivation", () => {
    it("CLEAN when all probes pass", async () => {
      const report = await runMissionProbe(REPO_ROOT);
      assert.equal(report.verdict, "CLEAN");
    });
  });
});
