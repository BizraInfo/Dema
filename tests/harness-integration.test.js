import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHarnessIntegration,
  buildHarnessIntegrationSummary,
  formatHarnessIntegration,
  HARNESS_HOOK_CHECKS,
  HARNESS_BEHAVIORAL_PROBES,
} from "../packages/core/src/harness-integration.js";
import { isCanonicalBoundaryShape } from "../packages/core/src/preview-boundary.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const FIXED_NOW = new Date("2026-05-25T12:00:00Z");

function makeFakeRepoRoot({ exclude = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), "dema-harness-test-"));
  for (const probe of HARNESS_BEHAVIORAL_PROBES) {
    if (probe.source && !exclude.includes(probe.id)) {
      const srcPath = join(root, probe.source);
      mkdirSync(join(srcPath, ".."), { recursive: true });
      writeFileSync(srcPath, "// stub");
    }
    if (!exclude.includes(probe.id)) {
      const testPath = join(root, probe.test);
      mkdirSync(join(testPath, ".."), { recursive: true });
      writeFileSync(testPath, "// stub");
    }
  }
  return root;
}

describe("harness-integration", () => {
  describe("buildHarnessIntegration", () => {
    it("returns frozen object with correct schema", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result));
      assert.equal(result.schema, "bizra.dema.harness_integration.v0.3");
    });

    it("mode is always PREVIEW_ONLY", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.mode, "PREVIEW_ONLY");
    });

    it("verdict is CLEAN or REVIEW", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(["CLEAN", "REVIEW"].includes(result.verdict));
    });

    it("contains all five harness surfaces", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(result.self_proactive_harness);
      assert.ok(result.self_critique);
      assert.ok(result.micro_compliance);
      assert.ok(result.micro_consent);
      assert.ok(result.behavioral_probes);
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
      assert.equal(sc.source_count, 3);
      assert.deepEqual(sc.sources, [
        "safety_report",
        "diagnostics_plan",
        "behavioral_probes",
      ]);
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
        "bizra.dema.harness_integration_summary.v0.3",
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

    it("has probes_present and probe_count", () => {
      const result = buildHarnessIntegrationSummary({ now: FIXED_NOW });
      assert.equal(typeof result.probes_present, "boolean");
      assert.equal(typeof result.probe_count, "number");
      assert.equal(result.probe_count, 3);
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

    it("includes all six sections", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("Verdict Inputs:"));
      assert.ok(formatted.includes("Self-Proactive Harness:"));
      assert.ok(formatted.includes("Self-Critique:"));
      assert.ok(formatted.includes("Micro-Compliance:"));
      assert.ok(formatted.includes("Micro-Consent:"));
      assert.ok(formatted.includes("Behavioral Probes:"));
    });

    it("verdict inputs section shows all 4 booleans", () => {
      const harness = buildHarnessIntegration({ now: FIXED_NOW });
      const formatted = formatHarnessIntegration(harness);
      assert.ok(formatted.includes("all_gates_pass:"));
      assert.ok(formatted.includes("compliance_clean:"));
      assert.ok(formatted.includes("no_blocker_gaps:"));
      assert.ok(formatted.includes("behavioral_probes_all_present:"));
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

  describe("behavioral_probes", () => {
    it("has probe_count matching probes array length", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const bp = result.behavioral_probes;
      assert.equal(bp.probe_count, bp.probes.length);
    });

    it("lists all three proof surfaces", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      const ids = result.behavioral_probes.probes.map((p) => p.id);
      assert.ok(ids.includes("mission_probe"));
      assert.ok(ids.includes("think_probe"));
      assert.ok(ids.includes("proof_loop_convergence"));
    });

    it("all probes present in this repo", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.behavioral_probes.all_present, true);
      assert.equal(result.behavioral_probes.status, "all_probes_present");
    });

    it("each probe has source_exists and test_exists", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      for (const probe of result.behavioral_probes.probes) {
        assert.ok(typeof probe.test_exists === "boolean");
        assert.ok(
          typeof probe.source_exists === "boolean" ||
            probe.source_exists === null,
        );
      }
    });

    it("includes note about sync-only check", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(result.behavioral_probes.note.includes("sync"));
      assert.ok(result.behavioral_probes.note.includes("not executed"));
    });

    it("probes are frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.behavioral_probes));
      assert.ok(Object.isFrozen(result.behavioral_probes.probes));
      for (const probe of result.behavioral_probes.probes) {
        assert.ok(Object.isFrozen(probe));
      }
    });
  });

  describe("HARNESS_BEHAVIORAL_PROBES", () => {
    it("is exported and non-empty", () => {
      assert.ok(Array.isArray(HARNESS_BEHAVIORAL_PROBES));
      assert.equal(HARNESS_BEHAVIORAL_PROBES.length, 3);
    });

    it("each probe has id and test", () => {
      for (const probe of HARNESS_BEHAVIORAL_PROBES) {
        assert.ok(typeof probe.id === "string");
        assert.ok(typeof probe.test === "string");
      }
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

  describe("verdict_inputs", () => {
    it("exists with all 4 boolean fields", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(result.verdict_inputs);
      assert.equal(typeof result.verdict_inputs.all_gates_pass, "boolean");
      assert.equal(typeof result.verdict_inputs.compliance_clean, "boolean");
      assert.equal(typeof result.verdict_inputs.no_blocker_gaps, "boolean");
      assert.equal(
        typeof result.verdict_inputs.behavioral_probes_all_present,
        "boolean",
      );
    });

    it("is frozen", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.ok(Object.isFrozen(result.verdict_inputs));
    });

    it("behavioral_probes_all_present is true on real repo", () => {
      const result = buildHarnessIntegration({ now: FIXED_NOW });
      assert.equal(result.verdict_inputs.behavioral_probes_all_present, true);
    });
  });

  describe("verdict policy — missing probes", () => {
    it("all probes present with fake root → CLEAN includes probes", () => {
      const root = makeFakeRepoRoot();
      const result = buildHarnessIntegration({
        now: FIXED_NOW,
        repoRoot: root,
      });
      assert.equal(result.behavioral_probes.all_present, true);
      assert.equal(result.verdict_inputs.behavioral_probes_all_present, true);
    });

    it("missing mission_probe → REVIEW + behavioral_probes_missing gap", () => {
      const root = makeFakeRepoRoot({ exclude: ["mission_probe"] });
      const result = buildHarnessIntegration({
        now: FIXED_NOW,
        repoRoot: root,
      });
      assert.equal(result.verdict, "REVIEW");
      assert.equal(result.verdict_inputs.behavioral_probes_all_present, false);
      const gap = result.self_critique.gaps.find(
        (g) => g.code === "behavioral_probes_missing",
      );
      assert.ok(gap, "expected behavioral_probes_missing gap");
      assert.ok(gap.missing.includes("mission_probe"));
    });

    it("missing think_probe → REVIEW + behavioral_probes_missing gap", () => {
      const root = makeFakeRepoRoot({ exclude: ["think_probe"] });
      const result = buildHarnessIntegration({
        now: FIXED_NOW,
        repoRoot: root,
      });
      assert.equal(result.verdict, "REVIEW");
      const gap = result.self_critique.gaps.find(
        (g) => g.code === "behavioral_probes_missing",
      );
      assert.ok(gap);
      assert.ok(gap.missing.includes("think_probe"));
    });

    it("missing proof_loop_convergence → REVIEW + behavioral_probes_missing gap", () => {
      const root = makeFakeRepoRoot({ exclude: ["proof_loop_convergence"] });
      const result = buildHarnessIntegration({
        now: FIXED_NOW,
        repoRoot: root,
      });
      assert.equal(result.verdict, "REVIEW");
      const gap = result.self_critique.gaps.find(
        (g) => g.code === "behavioral_probes_missing",
      );
      assert.ok(gap);
      assert.ok(gap.missing.includes("proof_loop_convergence"));
    });

    it("harness note confirms probes are not executed", () => {
      const root = makeFakeRepoRoot({ exclude: ["mission_probe"] });
      const result = buildHarnessIntegration({
        now: FIXED_NOW,
        repoRoot: root,
      });
      assert.ok(result.behavioral_probes.note.includes("sync"));
      assert.ok(result.behavioral_probes.note.includes("not executed"));
    });
  });
});

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("npm script integration", () => {
  function runScript(name) {
    return JSON.parse(
      execFileSync(
        "node",
        [join(REPO_ROOT, "apps/cli/src/index.js"), ...name.split(" ")],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, NO_COLOR: "1", NODE_ENV: "test" },
          timeout: 10000,
        },
      ).toString(),
    );
  }

  it("harness --json returns schema-tagged CLEAN envelope", () => {
    const result = runScript("harness --json");
    assert.equal(result.schema, "bizra.dema.harness_integration.v0.3");
    assert.equal(typeof result.verdict, "string");
    assert.ok(result.boundary);
  });

  it("harness --summary --json returns compact verdict", () => {
    const result = runScript("harness --summary --json");
    assert.equal(result.schema, "bizra.dema.harness_integration_summary.v0.3");
    assert.equal(typeof result.verdict, "string");
    assert.equal(typeof result.gates, "string");
  });

  it("status --full --json returns system snapshot", () => {
    const result = runScript("status --full --json");
    assert.equal(result.schema, "bizra.dema.system_snapshot.v0.1");
    assert.ok(result.harness);
    assert.ok(result.proof_loops);
    assert.ok(result.boundary);
  });
});
