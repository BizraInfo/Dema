import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProcessMiningPreview,
  buildProcessMiningSummary,
  PROCESS_MINING_REQUIRED_BLOCKED_EFFECTS,
} from "../packages/core/src/process-mining-preview.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";

test("ProcessMiningPreview emits canonical schema + truth label + preview_only mode", () => {
  const p = buildProcessMiningPreview();
  assert.equal(p.schema, "bizra.dema.process_mining_preview.v0.1");
  assert.equal(p.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(p.mode, "preview_only");
});

test("ProcessMiningPreview boundary is the canonical 16-key frozen object", () => {
  const p = buildProcessMiningPreview();
  assert.ok(isCanonicalBoundary(p.boundary), "boundary must be canonical");
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(p.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("ProcessMiningPreview is deep-frozen at all sub-views", () => {
  const p = buildProcessMiningPreview({
    decisionMetrics: { commits_total: 16 },
    doctrineMetrics: { catches: 18 },
    operatorPatternMetrics: { ringArtifactsPresent: true },
  });
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.decision_metrics));
  assert.ok(Object.isFrozen(p.doctrine_metrics));
  assert.ok(Object.isFrozen(p.operator_pattern_metrics));
  assert.ok(Object.isFrozen(p.boundary));
  assert.ok(Object.isFrozen(p.blocked_effects));
  assert.ok(Object.isFrozen(p.self_critique));
});

test("ProcessMiningPreview self_critique pins the mirror invariants false-except-mirror", () => {
  const p = buildProcessMiningPreview();
  assert.equal(p.self_critique.this_preview_acts_on_data, false);
  assert.equal(p.self_critique.this_preview_judges_operator, false);
  assert.equal(p.self_critique.this_preview_offers_a_mirror, true);
  assert.equal(p.self_critique.this_preview_prescribes_action, false);
});

test("ProcessMiningPreview ring_advancement_status surfaces honestly given inputs", () => {
  const noArtifacts = buildProcessMiningPreview({});
  assert.match(
    noArtifacts.operator_pattern_metrics.ring_advancement_status,
    /Ring 0/,
  );

  const sealedPack = buildProcessMiningPreview({
    operatorPatternMetrics: { ringArtifactsPresent: true },
  });
  assert.match(
    sealedPack.operator_pattern_metrics.ring_advancement_status,
    /pack sealed; Ring 1 not yet earned/,
  );

  const ringEarned = buildProcessMiningPreview({
    operatorPatternMetrics: {
      ringArtifactsPresent: true,
      externalReviewerForms: 1,
    },
  });
  assert.match(
    ringEarned.operator_pattern_metrics.ring_advancement_status,
    /Ring 1 earned/,
  );
});

test("ProcessMiningPreview next_step_observable is observational not prescriptive", () => {
  const p = buildProcessMiningPreview({
    operatorPatternMetrics: {
      ringArtifactsPresent: true,
      commitsHeldFromOrigin: 16,
    },
  });
  // Observable hint ends in _observable; never imperative
  assert.ok(
    p.operator_pattern_metrics.next_step_observable.endsWith("_observable"),
  );
  assert.ok(!p.operator_pattern_metrics.next_step_observable.includes("send"));
  assert.ok(!p.operator_pattern_metrics.next_step_observable.includes("must"));
});

test("ProcessMiningPreview blocked_effects names operator_judgment among forbidden effects", () => {
  const p = buildProcessMiningPreview();
  assert.ok(
    p.blocked_effects.includes("operator_judgment"),
    "the miner must explicitly NOT judge — listed in blocked_effects",
  );
  assert.ok(p.blocked_effects.includes("runtime_execution"));
  assert.ok(p.blocked_effects.includes("chain_advance"));
});

test("ProcessMiningPreview filters adversarial non-primitive metric values", () => {
  const p = buildProcessMiningPreview({
    decisionMetrics: {
      commits_total: 10,
      malicious_fn: () => true, // function · MUST be dropped
      malicious_obj: { nested: "danger" }, // object · MUST be dropped
      malicious_symbol: Symbol("x"), // symbol · MUST be dropped
      safe_string: "ok",
    },
  });
  assert.equal(p.decision_metrics.commits_total, 10);
  assert.equal(p.decision_metrics.safe_string, "ok");
  assert.equal(p.decision_metrics.malicious_fn, undefined);
  assert.equal(p.decision_metrics.malicious_obj, undefined);
  assert.equal(p.decision_metrics.malicious_symbol, undefined);
});

test("ProcessMiningPreview handles null metrics with status field, not crash", () => {
  const p = buildProcessMiningPreview({
    decisionMetrics: null,
    doctrineMetrics: null,
  });
  assert.equal(p.decision_metrics.status, "metrics_unavailable");
  assert.equal(p.doctrine_metrics.status, "metrics_unavailable");
});

test("ProcessMiningPreview is deterministic given identical input", () => {
  const a = buildProcessMiningPreview({
    decisionMetrics: { commits_total: 16 },
    doctrineMetrics: { catches: 18 },
    operatorPatternMetrics: {
      ringArtifactsPresent: true,
      externalReviewerForms: 0,
    },
  });
  const b = buildProcessMiningPreview({
    decisionMetrics: { commits_total: 16 },
    doctrineMetrics: { catches: 18 },
    operatorPatternMetrics: {
      ringArtifactsPresent: true,
      externalReviewerForms: 0,
    },
  });
  assert.deepEqual(a, b);
});

test("ProcessMiningPreview rejects adversarial mining_scope override silently", () => {
  const p = buildProcessMiningPreview({ miningScope: { malicious: "object" } });
  assert.equal(typeof p.mining_scope, "string");
  assert.ok(p.mining_scope.includes("READ_ONLY"));
});

test("ProcessMiningPreview mining_scope mentions READ_ONLY by default", () => {
  const p = buildProcessMiningPreview();
  assert.ok(
    p.mining_scope.includes("READ_ONLY"),
    "mining_scope must declare READ_ONLY discipline",
  );
});

test("ProcessMiningSummary emits suffix-tagged schema and preserves load-bearing fields", () => {
  const s = buildProcessMiningSummary({
    operatorPatternMetrics: { ringArtifactsPresent: true },
  });
  assert.equal(s.schema, "bizra.dema.process_mining_summary.v0.1");
  assert.equal(s.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(s.mode, "summary");
  assert.equal(s.source_schema, "bizra.dema.process_mining_preview.v0.1");
  assert.match(s.ring_advancement_status, /Ring 0/);
});

test("ProcessMiningSummary boundary is the canonical frozen object", () => {
  const s = buildProcessMiningSummary();
  assert.ok(isCanonicalBoundary(s.boundary));
});

test("ProcessMiningSummary fits within line budget pretty-printed", () => {
  const s = buildProcessMiningSummary();
  const lines = JSON.stringify(s, null, 2).split("\n").length;
  assert.ok(lines <= 41, `summary must be <= 41 lines, got ${lines}`);
});

test("PROCESS_MINING_REQUIRED_BLOCKED_EFFECTS includes the discipline-critical entries", () => {
  const required = ["runtime_execution", "operator_judgment", "chain_advance"];
  for (const eff of required) {
    assert.ok(
      PROCESS_MINING_REQUIRED_BLOCKED_EFFECTS.includes(eff),
      `blocked_effects must include ${eff}`,
    );
  }
});
