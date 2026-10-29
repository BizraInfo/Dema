import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFrameworkConstellationPreview,
  verifyFrameworkConstellationPreview,
  FRAMEWORK_CONSTELLATION_SCHEMA,
  FRAMEWORK_CONSTELLATION_TRUTH_LABEL,
} from "../packages/core/src/framework-constellation-preview.js";
import { defaultDemaFdeDualDiagnosticFixture } from "../packages/core/src/dema-fde-dual-diagnostic.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

const NOISY =
  "This will probably maybe work, it seems obviously the best ever revolutionary fix.";
const MID = "This seems to address the gate failure in the coverage CLI.";
const CLEAN =
  "In-process CLI coverage attributes under native Node thresholds without spawn.";

function knowledgeEntries() {
  return [
    {
      id: "claim:g8-in-process",
      axis: "claim",
      key: "g8-in-process",
      title: "G8 in-process attribution",
      summary: "Spawned dema children do not attribute to experimental-test-coverage.",
      evidence: ["tests/cli-hardware-think-coverage.test.js"],
      tags: ["coverage", "g8"],
    },
    {
      id: "risk:overclaim-rsi",
      axis: "risk",
      key: "rsi-live",
      title: "RSI live overclaim",
      summary: "Autopoietic loop rhetoric is DESIGNED_NOT_LIVE.",
      evidence: ["docs/CURRENT_LIMITS.md"],
      tags: ["boundary"],
    },
  ];
}

test("builds frozen PREVIEW_ONLY constellation with authority_delta 0", () => {
  const report = buildFrameworkConstellationPreview({
    observations: ["code_anchor_present", "tests_passed"],
    knowledge_entries: knowledgeEntries(),
    knowledge_query: { axis: "claim", key: "g8-in-process" },
    drafts: [NOISY, MID, CLEAN],
    evidence: ["tests/cli-corpus-coverage.test.js"],
  });
  assert.equal(report.schema, FRAMEWORK_CONSTELLATION_SCHEMA);
  assert.equal(report.truth_label, FRAMEWORK_CONSTELLATION_TRUTH_LABEL);
  assert.equal(report.mode, "PREVIEW_ONLY");
  assert.equal(report.authority_delta, 0);
  assert.equal(report.claim_ceiling, "CONTROL_MAPPING_COMPLETE");
  assert.match(report.constellation_hash, SHA256_HEX);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(report.hhmm.final_state, "tested_preview");
  assert.equal(report.diffusion.convergence_status, "CONVERGED");
  assert.equal(report.knowledge.query.hits, 1);
  assert.equal(report.boundary.rsi_activated, false);
  assert.equal(report.boundary.singularity_claimed, false);
  assert.equal(verifyFrameworkConstellationPreview(report).valid, true);
});

test("diverged diffusion forces rewrite next_safe_action", () => {
  const report = buildFrameworkConstellationPreview({
    observations: ["code_anchor_present"],
    knowledge_entries: knowledgeEntries(),
    knowledge_query: { axis: "claim", key: "g8-in-process" },
    drafts: [CLEAN, MID, NOISY],
    evidence: ["a.js"],
  });
  assert.equal(report.diffusion.convergence_status, "DIVERGED");
  assert.equal(report.next_safe_action, "rewrite_drafts_to_monotone_denoise");
});

test("optional FDE outward class refuses autopatch signal", () => {
  const report = buildFrameworkConstellationPreview({
    observations: ["code_anchor_present", "gate_failed"],
    knowledge_entries: knowledgeEntries(),
    knowledge_query: { axis: "risk", key: "rsi-live" },
    drafts: [CLEAN],
    evidence: ["packages/core/src/framework-constellation-preview.js"],
    fde_input: {
      ...defaultDemaFdeDualDiagnosticFixture(),
      stderr_excerpt: "EACCES permission denied reading /etc/shadow",
      stdout_excerpt: "permission_gap environment",
    },
  });
  assert.ok(report.fde);
  assert.equal(typeof report.fde.failure_class, "string");
  assert.equal(report.fde.eligible_for_autopatch, false);
  assert.equal(report.hhmm.final_state, "gate_blocked");
});

test("verify fails closed on boundary or hash tamper", () => {
  const report = buildFrameworkConstellationPreview({
    observations: ["code_anchor_present"],
    drafts: [CLEAN],
    evidence: ["x.js"],
    knowledge_entries: knowledgeEntries(),
  });
  const forgedBoundary = {
    ...report,
    boundary: { ...report.boundary, rsi_activated: true },
  };
  assert.equal(verifyFrameworkConstellationPreview(forgedBoundary).valid, false);

  const forgedHash = { ...report, constellation_hash: "0".repeat(64) };
  assert.equal(
    verifyFrameworkConstellationPreview(forgedHash).reason_code,
    "constellation_hash_mismatch",
  );
});

test("does not claim singularity or live RSI in sealed fields", () => {
  const report = buildFrameworkConstellationPreview({
    observations: ["designed_only"],
    drafts: ["autopoietic loop ran live and evolves itself without review"],
    evidence: [],
    knowledge_entries: knowledgeEntries(),
  });
  assert.equal(report.hhmm.final_state, "designed_not_live");
  assert.notEqual(report.diffusion.convergence_status, "CONVERGED");
  assert.match(report.what_this_does_not_prove, /Not live RSI/);
  assert.equal(report.authority_delta, 0);
});
