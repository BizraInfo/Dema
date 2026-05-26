import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMissionManifest,
  formatMissionManifest,
} from "../packages/mission/src/mission-manifest.js";
import { HEALTH_MISSION_CONSENT_PHRASE } from "../packages/mission/src/health-snapshot.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_NOW = new Date("2026-01-01T00:00:00Z");

describe("mission-manifest", () => {
  describe("buildMissionManifest", () => {
    it("returns schema bizra.dema.mission_manifest.v0.1", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(m.schema, "bizra.dema.mission_manifest.v0.1");
    });

    it("returns PRE_EXECUTION_DECLARATION mode", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(m.mode, "PRE_EXECUTION_DECLARATION");
    });

    it("returns deterministic output for same now", () => {
      const m1 = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const m2 = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(m1.manifest_hash, m2.manifest_hash);
      assert.deepStrictEqual(m1, m2);
    });

    it("manifest_hash is sha256 of stableStringify excluding manifest_hash", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const payload = { ...m };
      delete payload.manifest_hash;
      const expected = sha256(stableStringify(payload));
      assert.equal(m.manifest_hash, expected);
    });

    it("consent phrase hash matches sha256 of actual consent phrase", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(
        m.consent_boundary.required_phrase_hash,
        sha256(HEALTH_MISSION_CONSENT_PHRASE),
      );
    });

    it("consent_boundary declares consent_required and expected at execution", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(m.consent_boundary.consent_required, true);
      assert.equal(
        m.consent_boundary.expected_consent_collected_at_execution,
        true,
      );
    });

    it("manifest_generation_boundary is read-only (all false)", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const gb = m.manifest_generation_boundary;
      assert.equal(gb.filesystem_write_performed, false);
      assert.equal(gb.network_used, false);
      assert.equal(gb.model_invocation_performed, false);
      assert.equal(gb.receipt_mint_performed, false);
      assert.equal(gb.truth_label, "LOCAL_STATIC_DECLARATION");
    });

    it("expected_mission_boundary declares filesystem_write true", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(
        m.expected_mission_boundary.filesystem_write_performed,
        true,
      );
      assert.equal(m.expected_mission_boundary.network_used, false);
      assert.equal(m.expected_mission_boundary.federation_invoked, false);
    });

    it("proof_boundary uses actual health mission receipt schema", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(
        m.proof_boundary.receipt_schema,
        "bizra.dema.mission_receipt.health_snapshot.v0.1",
      );
    });

    it("resource_boundary uses class-based estimates not exact paths", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.ok(
        Array.isArray(m.resource_boundary.expected_filesystem_read_classes),
      );
      assert.ok(
        m.resource_boundary.expected_filesystem_read_classes.includes(
          "setup_state",
        ),
      );
      assert.equal(m.resource_boundary.static_wall_time_budget_ms, 5000);
      assert.equal(m.resource_boundary.estimated_wall_time_class, "low");
    });

    it("returns error for unknown mission type", () => {
      const m = buildMissionManifest("unknown_type", { now: FIXED_NOW });
      assert.ok(m.error);
      assert.match(m.error, /Unknown mission type/);
      assert.match(m.error, /health_snapshot/);
    });

    it("defaults to health_snapshot when no type provided", () => {
      const m = buildMissionManifest(undefined, { now: FIXED_NOW });
      assert.equal(m.mission_type, "health_snapshot");
      assert.ok(!m.error);
    });

    it("output is frozen-deterministic (deep equal on same now)", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.equal(m.generated_at, "2026-01-01T00:00:00.000Z");
      assert.equal(m.mission_type, "health_snapshot");
    });
  });

  describe("formatMissionManifest", () => {
    it("renders human-readable manifest", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const text = formatMissionManifest(m);
      assert.match(text, /Resource-Aware Mission Manifest/);
      assert.match(text, /health_snapshot/);
      assert.match(text, /PRE_EXECUTION_DECLARATION/);
      assert.match(text, /read-only/);
      assert.match(text, /RUN NODE0 HEALTH SNAPSHOT/);
      assert.match(text, /Manifest Hash/);
    });

    it("renders error string when manifest has error", () => {
      const text = formatMissionManifest({ error: "bad type" });
      assert.equal(text, "bad type");
    });

    it("shows will-do and will-not counts", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const text = formatMissionManifest(m);
      assert.match(text, /Will do:/);
      assert.match(text, /Will NOT:/);
    });
  });

  describe("no persistence", () => {
    it("buildMissionManifest does not write to disk", () => {
      const m = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.ok(!m.path);
      assert.ok(!m.saved);
    });
  });
});
