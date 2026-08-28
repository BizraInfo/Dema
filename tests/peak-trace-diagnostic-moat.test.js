import test from "node:test";
import assert from "node:assert/strict";

import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";
import { DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA } from "../packages/core/src/dema-trace-diagnostic-contract.js";

const BOUND = (i) => ({
  id: `moat-${i}`,
  type: "gate_passed",
  weight: 1,
  truth_label: "MEASURED",
  source_ref: `receipts/moat-${i}.json`,
  source_sha256: String(i).repeat(64).slice(0, 64),
});

// PTM-01: moat exists and is frozen preview-only composition
test("PTM-01: peak self-loop composes trace diagnostic moat as self-consistency gate", () => {
  const out = buildPeakSelfLoopPreview();
  assert.ok(out.trace_diagnostic_moat, "trace_diagnostic_moat must exist at top level");
  assert.ok(out.proactive_self.trace_diagnostic_moat, "must also be inside proactive_self");
  assert.equal(Object.isFrozen(out.trace_diagnostic_moat), true);
  assert.equal(out.trace_diagnostic_moat.report.schema, DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA);
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(Object.keys(out.boundary).length, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
});

// PTM-02: default fixtures (unbound) yield BLOCKED moat and HOLD critique (via SNR + moat gaps)
test("PTM-02: default unverified signals yield BLOCKED moat and HOLD with gap", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.trace_diagnostic_moat.promotion_status, "BLOCKED");
  assert.equal(out.trace_diagnostic_moat.verified.ok, true); // BLOCKED report is still well-formed
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.trace_diagnostic_moat.synthesis.self_consistent, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
  assert.ok(out.proactive_self.critique.gaps.some((g) => g.includes("TRACE moat BLOCKED")));
  // default HOLD is driven by SNR=0; trace moat is the second HOLD reason now surfaced as gap
  assert.ok(out.proactive_self.critique.verdict.startsWith("HOLD"));
});

// PTM-03: one verified signal with a vacuous alternative hypothesis is NOT a
// valid disambiguation graph. The second hypothesis must answer to admissible
// evidence; enumerating an empty alternative never authorizes an insight.
test("PTM-03: one verified signal plus vacuous alternative yields REMAIN_TRACE", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(1)], noise_events: [] });
  assert.equal(out.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.trace_diagnostic_moat.synthesis.self_consistent, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
  assert.ok(out.trace_diagnostic_moat.blocked_by.some((b) => b.includes("v2_disambiguation_hypothesis_without_evidence")));
});

// PTM-04: 9 bound signals yield INSIGHT_AUTHORIZED, trace_moat clears gap, critique may still HOLD on other gaps but moat gap absent
test("PTM-04: 9 bound signals yield INSIGHT_AUTHORIZED and moat gap cleared", () => {
  const nine = Array.from({ length: 9 }, (_, i) => BOUND(i));
  const out = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  assert.equal(out.trace_diagnostic_moat.promotion_status, "INSIGHT_AUTHORIZED");
  assert.equal(out.trace_diagnostic_moat.trace_set.length, 9);
  assert.equal(out.trace_diagnostic_moat.hypothesis_graph.length, 2);
  assert.equal(out.trace_diagnostic_moat.synthesis.verified_trace_count, 9);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, true);
  // moat gap should be absent even though other gaps may remain (declared, companion, verify)
  assert.equal(
    out.proactive_self.critique.gaps.some((g) => g.includes("TRACE moat")),
    false,
  );
  // ultra micro compose includes moat subsystems
  assert.ok(out.ultra_micro_compose.subsystems.includes("proactive_self.trace_diagnostic_moat"));
  assert.ok(out.ultra_micro_compose.subsystems.includes("trace_diagnostic_moat"));
});

// PTM-05: boundary remains all-false and frozen, doxology bound
test("PTM-05: trace moat preserves all-false boundary and doxology", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  for (const [k, v] of Object.entries(out.boundary)) assert.equal(v, false, k);
  assert.equal(out.trace_diagnostic_moat.synthesis.doxology_bound, true);
  assert.equal(out.trace_diagnostic_moat.insight_candidate.doxology.includes("Ihs"), true);
  // report hash re-derivable (semantic rederivation)
  assert.match(out.trace_diagnostic_moat.diagnostic_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(out.trace_diagnostic_moat.report.diagnostic_hash, out.trace_diagnostic_moat.diagnostic_hash);
});

// PTM-06: HHMM diffusion and moat are independent but both preview-only
test("PTM-06: HHMM diffusion intact alongside moat, both preview-only", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  assert.equal(out.hhmm.mode, "preview_diffusion_not_runtime_engine");
  assert.equal(out.hhmm.phases.length, 5);
  assert.equal(out.trace_diagnostic_moat.report.stage, "TRACE_DIAGNOSTIC_PROMOTION_GATE");
  // self-consistency requires both moat and no neural claim
  assert.equal(out.what_this_does_not_prove.includes("moat classifies admissibility only"), true);
});

// PTM-07: render includes trace_moat line
test("PTM-07: render includes trace diagnostic moat line", async () => {
  const { renderPeakSelfLoopPreview } = await import("../packages/core/src/peak-self-loop-preview.js");
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  const text = renderPeakSelfLoopPreview(out);
  assert.ok(text.includes("trace_moat:"));
  assert.ok(text.includes("trace_moat"));
});
