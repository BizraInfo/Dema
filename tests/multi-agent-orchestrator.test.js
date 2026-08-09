import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMultiAgentOrchestrator,
  buildMultiAgentOrchestratorSummary,
  runVerificationPipeline,
  MULTI_AGENT_PAT_IDS,
  MULTI_AGENT_SAT_IDS,
} from "../packages/core/src/multi-agent-orchestrator.js";
import { LINEAGE_ROLES } from "../packages/core/src/fde-isnad-replay-capsule-preview.js";
import {
  isCanonicalBoundary,
  buildPreviewBoundary,
} from "../packages/core/src/preview-boundary.js";
import { buildNode0StatePreview } from "../packages/core/src/state.js";

test("Orchestrator emits canonical schema", () => {
  const o = buildMultiAgentOrchestrator();
  assert.equal(o.schema, "bizra.dema.multi_agent_orchestrator.v0.1");
  assert.equal(o.truth_label, "NODE0_LOCAL_SEED");
});

test("Orchestrator registers all 7 PATs + 5 SATs", () => {
  const o = buildMultiAgentOrchestrator();
  assert.equal(o.pat_count, 7);
  assert.equal(o.sat_count, 5);
  assert.equal(o.pat_ids.length, 7);
  assert.equal(o.sat_ids.length, 5);
});

test("Orchestrator PAT registry contains all 7 PAT previews + caps", () => {
  const o = buildMultiAgentOrchestrator();
  for (const id of MULTI_AGENT_PAT_IDS) {
    assert.ok(o.pat_registry[id], `missing PAT in registry: ${id}`);
    assert.ok(o.pat_registry[id].preview);
    assert.ok(o.pat_registry[id].effect_cap);
    assert.equal(o.pat_registry[id].effect_cap.valid, true);
  }
});

test("Orchestrator SAT registry contains all 5 SAT previews", () => {
  const o = buildMultiAgentOrchestrator();
  for (const id of MULTI_AGENT_SAT_IDS) {
    assert.ok(o.sat_registry[id], `missing SAT in registry: ${id}`);
    assert.ok(o.sat_registry[id].preview);
  }
});

test("Orchestrator boundary canonical · routing_law declared", () => {
  const o = buildMultiAgentOrchestrator();
  assert.ok(isCanonicalBoundary(o.boundary));
  assert.ok(o.routing_law.length >= 5);
  assert.ok(Object.isFrozen(o));
});

test("Orchestrator blocked_effects include critical refusals", () => {
  const o = buildMultiAgentOrchestrator();
  assert.ok(o.blocked_effects.includes("skip_sat_verification"));
  assert.ok(
    o.blocked_effects.includes("approve_pat_proposal_without_operator_consent"),
  );
  assert.ok(
    o.blocked_effects.includes("chain_advance_without_full_verification"),
  );
});

test("Pipeline · canonical artifact alone → SAT-1 runs and passes", () => {
  const p = runVerificationPipeline({ artifact: buildNode0StatePreview() });
  assert.equal(p.schema, "bizra.dema.orchestrator_verification_pipeline.v0.1");
  assert.ok(p.sats_run.includes("sat-1-boundary-verifier"));
  assert.ok(p.sats_passed.includes("sat-1-boundary-verifier"));
  assert.equal(p.passed, true);
  assert.equal(p.overall_verdict, "pipeline_verified");
});

test("Pipeline · non-canonical artifact → SAT-1 fails · pipeline_violated", () => {
  const broken = {
    schema: "x.v0.1",
    boundary: { ...buildPreviewBoundary(), runtime_execution_performed: true },
  };
  const p = runVerificationPipeline({ artifact: broken });
  assert.equal(p.passed, false);
  assert.equal(p.overall_verdict, "pipeline_violated");
  assert.ok(p.sats_failed.includes("sat-1-boundary-verifier"));
});

test("Pipeline · with doctrine_inputs → SAT-3 also runs", () => {
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    doctrine_inputs: { claims_door: "test", boundary_marker: "n/a" },
  });
  assert.ok(p.sats_run.includes("sat-1-boundary-verifier"));
  assert.ok(p.sats_run.includes("sat-3-doctrine-compliance"));
  assert.equal(p.passed, true);
});

test("Pipeline · with action L3 + consent → SAT-2 runs and passes", () => {
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    action: {
      action_name: "test_action",
      risk_tier: "L3",
      consent_phrase_required: "GO: test",
      consent_phrase_provided: "GO: test",
      audit_trail: { event: "x" },
    },
  });
  assert.ok(p.sats_run.includes("sat-2-consent-auditor"));
  assert.equal(p.passed, true);
});

test("Pipeline · with action L3 + WRONG consent → SAT-2 fails", () => {
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    action: {
      action_name: "test",
      risk_tier: "L3",
      consent_phrase_required: "GO: test",
      consent_phrase_provided: "wrong",
      audit_trail: { event: "x" },
    },
  });
  assert.equal(p.passed, false);
  assert.ok(p.sats_failed.includes("sat-2-consent-auditor"));
});

test("Pipeline · with valid receipts → SAT-4 runs and passes", () => {
  const hash = "a".repeat(64);
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    receipts: [{ receipt_id: hash, prev_hash: null }],
  });
  assert.ok(p.sats_run.includes("sat-4-receipt-chain-verifier"));
  assert.equal(p.passed, true);
});

test("Pipeline · with profile + matching snapshot → SAT-5 runs and passes", () => {
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    profile: { name: "Mumu", node: "Node0" },
    previous_snapshot: { name: "Mumu", node: "Node0" },
  });
  assert.ok(p.sats_run.includes("sat-5-identity-verifier"));
  assert.equal(p.passed, true);
});

test("Pipeline · no inputs at all → no_inputs_no_verdict", () => {
  const p = runVerificationPipeline({});
  assert.equal(p.overall_verdict, "no_inputs_no_verdict");
  assert.equal(p.sats_run.length, 0);
});

test("Pipeline · all 5 SATs run when all inputs present", () => {
  const hash = "a".repeat(64);
  const p = runVerificationPipeline({
    artifact: buildNode0StatePreview(),
    doctrine_inputs: { claims_door: "test" },
    action: {
      action_name: "test",
      risk_tier: "L0",
    },
    receipts: [{ receipt_id: hash, prev_hash: null }],
    profile: { name: "Mumu", node: "Node0" },
  });
  assert.equal(p.sats_run.length, 5);
  assert.equal(p.passed, true);
});

test("Pipeline result deep-frozen + canonical boundary", () => {
  const p = runVerificationPipeline({ artifact: buildNode0StatePreview() });
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.sats_run));
  assert.ok(Object.isFrozen(p.sats_passed));
  assert.ok(Object.isFrozen(p.sats_failed));
  assert.ok(isCanonicalBoundary(p.boundary));
});

test("Summary + exports", () => {
  const s = buildMultiAgentOrchestratorSummary();
  assert.equal(s.total_agent_count, 12); // 7 + 5
  assert.equal(s.pat_count, 7);
  assert.equal(s.sat_count, 5);
  assert.ok(isCanonicalBoundary(s.boundary));
});

// ── ORCHESTRATOR-ISNAD-SEAL-1A ───────────────────────────────────────────
//
// The pipeline already declares `audit_trail_required: true` and supplies no
// trail. A delegation without isnād is an instruction with no provenance: the
// verdict says SATs verified a PAT draft, but nothing binds WHO transmitted
// WHAT to WHOM. `sealCapsuleBody` already content-addresses exactly that
// lineage and refuses to grant authority — it was wired to nothing.

test("Pipeline · verdict carries a sealed isnād lineage", () => {
  const p = runVerificationPipeline({ artifact: buildNode0StatePreview() });

  assert.ok(p.delegation_isnad, "verdict must carry a sealed lineage");
  const seal = p.delegation_isnad;

  assert.match(seal.source_lineage_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(seal.capsule_hash, /^sha256:[0-9a-f]{64}$/);

  // Every step uses the isnād vocabulary — roles are not invented here.
  assert.ok(seal.source_lineage.length > 0);
  for (const step of seal.source_lineage) {
    assert.ok(
      LINEAGE_ROLES.includes(step.role),
      `role ${step.role} is not an isnād role`,
    );
    assert.equal(typeof step.ref_hash, "string");
    assert.ok(Number.isInteger(step.step));
  }

  // Every SAT that ran must appear as a verifier in the chain of transmission.
  const verifiers = seal.source_lineage
    .filter((s) => s.role === "verifier")
    .map((s) => s.ref_hash);
  for (const sat of p.sats_run) {
    assert.ok(verifiers.includes(sat), `SAT ${sat} missing from the isnād`);
  }
});

test("Pipeline · isnād seal grants no authority", () => {
  const p = runVerificationPipeline({ artifact: buildNode0StatePreview() });

  assert.equal(p.delegation_isnad.authority_delta, 0);
  assert.equal(p.delegation_isnad.execution_allowed, false);
  assert.equal(p.delegation_isnad.mint_allowed, false);
  // Sealing provenance must not change what the pipeline decided.
  assert.equal(p.passed, true);
  assert.equal(p.overall_verdict, "pipeline_verified");
  assert.ok(isCanonicalBoundary(p.boundary));
});

test("Pipeline · isnād binds to the verdict, it does not decorate it", () => {
  // A seal that does not move when the delegation moves is ornamentation.
  const ok = runVerificationPipeline({ artifact: buildNode0StatePreview() });
  const broken = runVerificationPipeline({
    artifact: { schema: "not.canonical", boundary: {} },
  });

  assert.notEqual(
    ok.delegation_isnad.capsule_hash,
    broken.delegation_isnad.capsule_hash,
    "a different delegation outcome must produce a different seal",
  );
  assert.notEqual(
    ok.delegation_isnad.source_lineage_hash,
    broken.delegation_isnad.source_lineage_hash,
  );
  // The failing run still records its transmission chain honestly.
  assert.equal(broken.delegation_isnad.execution_allowed, false);
  assert.ok(
    broken.delegation_isnad.source_lineage.some((s) => s.role === "status"),
    "the outcome must be a sealed step, not an unrecorded side effect",
  );
});
