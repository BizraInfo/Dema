import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHarnessIntegration,
  buildHarnessIntegrationSummary,
  formatHarnessIntegration,
  HARNESS_HOOK_CHECKS,
} from "../packages/core/src/harness-integration.js";
import { isCanonicalBoundaryShape } from "../packages/core/src/preview-boundary.js";

const FIXED_NOW = new Date("2026-05-25T12:00:00Z");

describe("harness-integration", () => {
  describe("buildHarnessIntegration", () => {
    it("returns frozen object with correct schema", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result));
      assert.equal(result.schema, "bizra.dema.harness_integration.v0.1");
    });

    it("mode is always PREVIEW_ONLY", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.mode, "PREVIEW_ONLY");
    });

    it("verdict is CLEAN or REVIEW", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(["CLEAN", "REVIEW"].includes(result.verdict));
    });

    it("contains all four harness surfaces", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(result.self_proactive_harness);
      assert.ok(result.self_critique);
      assert.ok(result.micro_compliance);
      assert.ok(result.micro_consent);
    });

    it("contains hook inventory", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Array.isArray(result.hook_inventory));
      assert.ok(result.hook_inventory.length >= 6);
    });

    it("boundary has canonical shape", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(isCanonicalBoundaryShape(result.boundary));
    });

    it("boundary is all false (preview-only)", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      for (const [key, value] of Object.entries(result.boundary)) {
        assert.equal(value, false, `boundary.${key} should be false`);
      }
    });

    it("generated_at reflects provided timestamp", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.generated_at, "2026-05-25T12:00:00.000Z");
    });
  });

  describe("self_proactive_harness", () => {
    it("has mode and status", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const ph = result.self_proactive_harness;
      assert.ok(typeof ph.mode === "string");
      assert.ok(["all_gates_pass", "gates_failing"].includes(ph.status));
    });

    it("has gate_count matching gates array length", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const ph = result.self_proactive_harness;
      assert.equal(ph.gate_count, ph.gates.length);
    });

    it("gates_passing + gates_failing equals gate_count", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const ph = result.self_proactive_harness;
      assert.equal(ph.gates_passing + ph.gates_failing, ph.gate_count);
    });

    it("has recommended_micro_action", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(
        typeof result.self_proactive_harness.recommended_micro_action ===
          "string",
      );
    });

    it("gates are frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.self_proactive_harness.gates));
      for (const gate of result.self_proactive_harness.gates) {
        assert.ok(Object.isFrozen(gate));
      }
    });
  });

  describe("self_critique", () => {
    it("has source_count and sources", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const sc = result.self_critique;
      assert.equal(sc.source_count, 2);
      assert.deepEqual(sc.sources, ["safety_report", "diagnostics_plan"]);
    });

    it("confidence is bounded_preview", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.self_critique.confidence, "bounded_preview");
    });

    it("severity_counts sum to total_gap_count", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const sc = result.self_critique;
      const countSum = Object.values(sc.severity_counts).reduce(
        (a, b) => a + b,
        0,
      );
      assert.equal(countSum, sc.total_gap_count);
    });

    it("gaps are deduplicated", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const codes = result.self_critique.gaps.map((g) => g.code ?? g.note);
      const unique = new Set(codes);
      assert.equal(codes.length, unique.size);
    });

    it("gaps array is frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.self_critique.gaps));
    });
  });

  describe("micro_compliance", () => {
    it("preview_only is true", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_compliance.preview_only, true);
    });

    it("deterministic is true", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_compliance.deterministic, true);
    });

    it("process_mining does not act on data", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_compliance.process_mining_acts_on_data, false);
    });

    it("process_mining does not prescribe action", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(
        result.micro_compliance.process_mining_prescribes_action,
        false,
      );
    });

    it("is frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.micro_compliance));
    });
  });

  describe("micro_consent", () => {
    it("status is draft_only", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_consent.status, "draft_only");
    });

    it("approval not recorded in preview", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_consent.approval_recorded, false);
    });

    it("action not authorized in preview", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_consent.action_authorized, false);
    });

    it("broad consent not allowed", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_consent.broad_consent_allowed, false);
    });

    it("exact consent required", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.micro_consent.exact_consent_required, true);
    });

    it("is frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.micro_consent));
    });
  });

  describe("hook_inventory", () => {
    it("includes bash_blacklist", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const hook = result.hook_inventory.find((h) => h.id === "bash_blacklist");
      assert.ok(hook);
      assert.equal(hook.type, "security");
      assert.equal(hook.event, "PreToolUse");
    });

    it("includes consent_enforcer", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const hook = result.hook_inventory.find(
        (h) => h.id === "consent_enforcer",
      );
      assert.ok(hook);
      assert.equal(hook.type, "consent");
    });

    it("includes tool_call_envelope with narrowed matcher", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const hook = result.hook_inventory.find(
        (h) => h.id === "tool_call_envelope",
      );
      assert.ok(hook);
      assert.equal(hook.matcher, "Bash|Edit|Write|MultiEdit");
    });

    it("includes output_critique", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const hook = result.hook_inventory.find(
        (h) => h.id === "output_critique",
      );
      assert.ok(hook);
      assert.equal(hook.event, "Stop");
    });

    it("includes prettier_autoformat", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const hook = result.hook_inventory.find(
        (h) => h.id === "prettier_autoformat",
      );
      assert.ok(hook);
      assert.equal(hook.type, "formatting");
    });

    it("all hooks have wired=true", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      for (const hook of result.hook_inventory) {
        assert.equal(hook.wired, true);
      }
    });

    it("all hooks are frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      for (const hook of result.hook_inventory) {
        assert.ok(Object.isFrozen(hook));
      }
    });
  });

  describe("buildHarnessIntegrationSummary", () => {
    it("returns summary schema", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.equal(
        result.schema,
        "bizra.dema.harness_integration_summary.v0.1",
      );
    });

    it("has verdict", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.ok(["CLEAN", "REVIEW"].includes(result.verdict));
    });

    it("has hooks_wired count", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.ok(typeof result.hooks_wired === "number");
      assert.ok(result.hooks_wired >= 6);
    });

    it("has boundary with canonical shape", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.ok(isCanonicalBoundaryShape(result.boundary));
    });

    it("is frozen", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result));
    });
  });

  describe("formatHarnessIntegration", () => {
    it("returns a string", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(typeof formatted === "string");
    });

    it("includes verdict", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("Verdict:"));
    });

    it("includes all four sections", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("Self-Proactive Harness:"));
      assert.ok(formatted.includes("Self-Critique:"));
      assert.ok(formatted.includes("Micro-Compliance:"));
      assert.ok(formatted.includes("Micro-Consent:"));
    });

    it("includes hook inventory", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("Hook Inventory:"));
      assert.ok(formatted.includes("bash_blacklist"));
    });

    it("includes boundary statement", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("preview-only"));
    });
  });

  describe("HARNESS_HOOK_CHECKS", () => {
    it("is exported and non-empty", () => {
      assert.ok(Array.isArray(HARNESS_HOOK_CHECKS));
      assert.ok(HARNESS_HOOK_CHECKS.length >= 6);
    });

    it("each hook has id, event, and type", () => {
      for (const hook of HARNESS_HOOK_CHECKS) {
        assert.ok(typeof hook.id === "string");
        assert.ok(typeof hook.event === "string");
        assert.ok(typeof hook.type === "string");
      }
    });
  });

  describe("determinism", () => {
    it("same input produces same output", () => {
      const a = buildHarnessIntegration({ now: FIXED_NOW });
      const b = buildHarnessIntegration({ now: FIXED_NOW });
      assert.deepEqual(a, b);
    });

    it("summary is deterministic", () => {
      const a = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      const b = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.deepEqual(a, b);
    });
  });
});
