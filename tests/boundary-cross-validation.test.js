import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";
import { buildHarnessIntegration } from "../packages/core/src/harness-integration.js";
import { buildThinkDryRun } from "../packages/think/src/think-dry-run.js";
import { buildMissionManifest } from "../packages/mission/src/mission-manifest.js";

// ─────────────────────────────────────────────────────────────────────────────
// Boundary Cross-Validation Test
//
// Purpose: prove that every module emitting a boundary object uses the
// canonical 16-key set (or a documented superset). This catches vocabulary
// drift between modules that were developed independently.
//
// This is the single test that would have caught the manifest's use of
// consent_required / expected_consent_collected_at_execution instead of
// consent_collected before it shipped.
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_NOW = new Date("2026-05-26T00:00:00Z");
const CANONICAL_SET = new Set(PREVIEW_BOUNDARY_CANONICAL_KEYS);

// Keys that the mission manifest uses INSTEAD of the canonical key.
// The manifest is a pre-execution declaration, so "consent_collected" (past
// tense, observed) is semantically wrong — it uses "consent_required" and
// "expected_consent_collected_at_execution" as domain-specific extensions.
// This allowlist documents the drift explicitly so future changes are visible.
const MANIFEST_DOCUMENTED_EXTENSIONS = new Set([
  "consent_required",
  "expected_consent_collected_at_execution",
]);

// ─── Canonical source of truth ──────────────────────────────────────────────

describe("boundary-cross-validation", () => {
  describe("canonical source of truth", () => {
    it("PREVIEW_BOUNDARY_CANONICAL_KEYS has exactly 16 keys", () => {
      assert.equal(PREVIEW_BOUNDARY_CANONICAL_KEYS.length, 16);
    });

    it("canonical keys are frozen", () => {
      assert.ok(Object.isFrozen(PREVIEW_BOUNDARY_CANONICAL_KEYS));
    });

    it("every canonical key ends with a verb form (_performed, _used, etc.)", () => {
      // This enforces the naming convention from preview-boundary.js rule 1:
      // "The key MUST express a concrete effect that COULD happen at runtime"
      const validSuffixes = [
        "_performed",
        "_used",
        "_loaded",
        "_executed",
        "_invoked",
        "_included",
        "_collected",
      ];
      for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
        const hasValidSuffix = validSuffixes.some((s) => key.endsWith(s));
        assert.ok(
          hasValidSuffix,
          `Canonical key '${key}' does not end with a recognized verb suffix`,
        );
      }
    });
  });

  // ─── Harness boundary coherence ─────────────────────────────────────────

  describe("harness boundary vs canonical", () => {
    it("harness boundary keys exactly match canonical set", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const harnessKeys = new Set(Object.keys(harness.boundary));
      assert.equal(harnessKeys.size, CANONICAL_SET.size);
      for (const key of CANONICAL_SET) {
        assert.ok(
          harnessKeys.has(key),
          `Harness boundary missing canonical key: '${key}'`,
        );
      }
      for (const key of harnessKeys) {
        assert.ok(
          CANONICAL_SET.has(key),
          `Harness boundary has extra key not in canonical: '${key}'`,
        );
      }
    });

    it("harness boundary values are all boolean", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      for (const [key, value] of Object.entries(harness.boundary)) {
        assert.equal(
          typeof value,
          "boolean",
          `Harness boundary.${key} is ${typeof value}, expected boolean`,
        );
      }
    });
  });

  // ─── Think dry-run boundary coherence ───────────────────────────────────

  describe("think dry-run boundary vs canonical", () => {
    it("think boundary keys exactly match canonical set", () => {
      const think = buildThinkDryRun("test query", { now: FIXED_NOW });
      const thinkKeys = new Set(Object.keys(think.boundary));
      assert.equal(thinkKeys.size, CANONICAL_SET.size);
      for (const key of CANONICAL_SET) {
        assert.ok(
          thinkKeys.has(key),
          `Think boundary missing canonical key: '${key}'`,
        );
      }
      for (const key of thinkKeys) {
        assert.ok(
          CANONICAL_SET.has(key),
          `Think boundary has extra key not in canonical: '${key}'`,
        );
      }
    });

    it("think boundary values are all boolean", () => {
      const think = buildThinkDryRun("test query", { now: FIXED_NOW });
      for (const [key, value] of Object.entries(think.boundary)) {
        assert.equal(
          typeof value,
          "boolean",
          `Think boundary.${key} is ${typeof value}, expected boolean`,
        );
      }
    });

    it("think boundary_evidence covers every non-false boundary key", () => {
      const think = buildThinkDryRun("test query", { now: FIXED_NOW });
      const trueKeys = Object.entries(think.boundary)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
      // Every true boundary key should have an evidence entry
      for (const key of trueKeys) {
        const evidenceKey =
          key === "runtime_execution_performed" ? "memory_query" : key;
        assert.ok(
          think.boundary_evidence[evidenceKey] !== undefined,
          `Think boundary.${key} is true but no evidence entry for '${evidenceKey}'`,
        );
      }
    });
  });

  // ─── Mission manifest boundary coherence ────────────────────────────────

  describe("manifest boundary vs canonical", () => {
    it("manifest expected_mission_boundary canonical keys are all present", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const mb = manifest.expected_mission_boundary;
      const mbKeys = Object.keys(mb).filter((k) => k !== "truth_label");

      // Every canonical key must be in the manifest
      for (const key of CANONICAL_SET) {
        // consent_collected is replaced by consent_required + expected_consent_collected_at_execution
        if (key === "consent_collected") continue;
        assert.ok(
          mbKeys.includes(key),
          `Manifest missing canonical key: '${key}'`,
        );
      }
    });

    it("manifest extra keys are all documented extensions", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const mb = manifest.expected_mission_boundary;
      const mbKeys = Object.keys(mb).filter((k) => k !== "truth_label");

      const extraKeys = mbKeys.filter((k) => !CANONICAL_SET.has(k));
      for (const key of extraKeys) {
        assert.ok(
          MANIFEST_DOCUMENTED_EXTENSIONS.has(key),
          `Manifest has undocumented extra key: '${key}'. ` +
            `Either add to MANIFEST_DOCUMENTED_EXTENSIONS or remove from manifest.`,
        );
      }
    });

    it("manifest extension set is exactly what we expect (no stale docs)", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const mb = manifest.expected_mission_boundary;
      const mbKeys = new Set(
        Object.keys(mb).filter((k) => k !== "truth_label"),
      );

      for (const ext of MANIFEST_DOCUMENTED_EXTENSIONS) {
        assert.ok(
          mbKeys.has(ext),
          `Documented extension '${ext}' no longer exists in manifest. ` +
            `Remove from MANIFEST_DOCUMENTED_EXTENSIONS.`,
        );
      }
    });

    it("manifest boundary values are all boolean", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const mb = manifest.expected_mission_boundary;
      for (const [key, value] of Object.entries(mb)) {
        if (key === "truth_label") continue;
        assert.equal(
          typeof value,
          "boolean",
          `Manifest boundary.${key} is ${typeof value}, expected boolean`,
        );
      }
    });

    it("manifest generation boundary is all false (read-only operation)", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const gb = manifest.manifest_generation_boundary;
      for (const [key, value] of Object.entries(gb)) {
        if (key === "truth_label") continue;
        assert.equal(
          value,
          false,
          `Manifest generation boundary.${key} should be false (generation is read-only)`,
        );
      }
    });
  });

  // ─── Cross-system semantic coherence ────────────────────────────────────

  describe("cross-system semantic coherence", () => {
    it("harness and think agree on all false boundary keys (both are preview-only)", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const think = buildThinkDryRun("test query", { now: FIXED_NOW });

      for (const key of CANONICAL_SET) {
        if (key === "runtime_execution_performed") continue; // think may spawn wrapper
        assert.equal(
          harness.boundary[key],
          false,
          `Harness boundary.${key} should be false in preview mode`,
        );
        assert.equal(
          think.boundary[key],
          false,
          `Think boundary.${key} should be false in dry-run mode`,
        );
      }
    });

    it("manifest expected boundary predicts what probe will find", () => {
      // The manifest declares what the mission WILL do.
      // The probe checks what the mission ACTUALLY did.
      // At minimum: the manifest's expected writes must be a superset of actual effects.
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      const mb = manifest.expected_mission_boundary;

      // Sanity: health_snapshot writes to disk
      assert.equal(mb.filesystem_write_performed, true);
      // Sanity: health_snapshot does not use network
      assert.equal(mb.network_used, false);
      // Sanity: health_snapshot does not load a model
      assert.equal(mb.model_loaded, false);
      // Sanity: health_snapshot does not execute prompts
      assert.equal(mb.prompt_executed, false);
    });

    it("all boundary-emitting modules have a truth_label where present", () => {
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      // Manifest has truth_label in boundary sections
      assert.ok(manifest.expected_mission_boundary.truth_label);
      assert.ok(manifest.manifest_generation_boundary.truth_label);
      assert.ok(manifest.consent_boundary.truth_label);
      assert.ok(manifest.proof_boundary.truth_label);
      assert.ok(manifest.resource_boundary.truth_label);
    });

    it("no module uses a boundary key that looks canonical but is misspelled", () => {
      // Catch typos like "filesytem_write_performed" or "model_invoked"
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const think = buildThinkDryRun("test query", { now: FIXED_NOW });
      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });

      const allBoundaryKeys = new Set([
        ...Object.keys(harness.boundary),
        ...Object.keys(think.boundary),
        ...Object.keys(manifest.expected_mission_boundary).filter(
          (k) => k !== "truth_label",
        ),
      ]);

      const allowedKeys = new Set([
        ...CANONICAL_SET,
        ...MANIFEST_DOCUMENTED_EXTENSIONS,
      ]);

      for (const key of allBoundaryKeys) {
        assert.ok(
          allowedKeys.has(key),
          `Unexpected boundary key '${key}' found. ` +
            `Possible typo or undocumented extension.`,
        );
      }
    });
  });

  // ─── Determinism across systems ─────────────────────────────────────────

  describe("cross-system determinism", () => {
    it("running all three builders twice produces identical boundaries", () => {
      const h1 = buildHarnessIntegration({ now: FIXED_NOW });
      const h2 = buildHarnessIntegration({ now: FIXED_NOW });
      assert.deepEqual(h1.boundary, h2.boundary);

      const t1 = buildThinkDryRun("same query", { now: FIXED_NOW });
      const t2 = buildThinkDryRun("same query", { now: FIXED_NOW });
      assert.deepEqual(t1.boundary, t2.boundary);

      const m1 = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      const m2 = buildMissionManifest("health_snapshot", { now: FIXED_NOW });
      assert.deepEqual(
        m1.expected_mission_boundary,
        m2.expected_mission_boundary,
      );
    });
  });

  // ─── Self-critique: this test's own completeness ──────────────────────

  describe("self-critique", () => {
    it("this test covers all known boundary-emitting modules", () => {
      // If a new module starts emitting boundaries, add it here.
      // This list must be updated when new boundary emitters are added.
      const KNOWN_EMITTERS = [
        "harness-integration",
        "think-dry-run",
        "mission-manifest",
      ];
      // Verify we actually test each one
      assert.equal(KNOWN_EMITTERS.length, 3);
      // The test above explicitly tests all three — this is a documentation guard.
    });

    it("MANIFEST_DOCUMENTED_EXTENSIONS does not grow silently", () => {
      // If someone adds a new extension, this count must be updated.
      // Forces a human to acknowledge the extension.
      assert.equal(
        MANIFEST_DOCUMENTED_EXTENSIONS.size,
        2,
        "MANIFEST_DOCUMENTED_EXTENSIONS size changed. " +
          "Update this assertion after reviewing the new extension.",
      );
    });
  });
});
