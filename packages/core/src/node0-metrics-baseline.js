// NODE0-METRICS-BASELINE-1A — Derive event-bound baseline metrics from realm event history; UNKNOWN is never zero; every metric carries its derivation evidence.
//
// Pure kernel over the NODE0-REALM-STATE-KERNEL-1A event vocabulary: events are
// injected arrays, replayed through the realm reducer, and every metric binds to
// the exact event seqs it derives from. Two laws rule this slice:
//   1. UNKNOWN is never zero — a metric with no evidence carries value null,
//      truth label UNKNOWN and a named reason; it is never silently 0.
//   2. No metrics from corrupt history — a failed replay blocks the run with the
//      reducer's own named block; partial metrics are never emitted.

// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { reduceNode0RealmEvents } from "./node0-realm-state-kernel.js";

export const NODE0_METRICS_BASELINE_SCHEMA = "bizra.dema.node0_metrics_baseline.v0.1";
export const NODE0_METRICS_BASELINE_TRUTH_LABEL = "NODE0_METRICS_BASELINE_MEASURED_REPO";
export const NODE0_METRICS_BASELINE_GO_PHRASE = "GO: node0 metrics baseline preview";

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function node0MetricsBaselineBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

function measured(value, derived_from) {
  return Object.freeze({ value, truth_label: "MEASURED", derived_from: Object.freeze(derived_from) });
}

function unknown(reason) {
  return Object.freeze({ value: null, truth_label: "UNKNOWN", derived_from: Object.freeze([]), reason });
}

// Pure derivation: valid replayed events + derived state -> metric objects.
// Every MEASURED metric binds the exact event seqs it derives from; absent
// evidence yields UNKNOWN with a named reason — never zero.
export function deriveNode0BaselineMetrics(events, state) {
  const seqsOf = (pred) => events.filter(pred).map((e) => e.seq);

  const declaredSeqs = seqsOf((e) => e.kind === "MISSION_DECLARED");
  const passSeqs = seqsOf((e) => e.kind === "MISSION_VERDICT" && e.payload.verdict === "PASS");
  const failSeqs = seqsOf((e) => e.kind === "MISSION_VERDICT" && e.payload.verdict === "FAIL");
  const promotedSeqs = seqsOf((e) => e.kind === "ASSET_PROMOTED");

  const missionsWithPromotedAsset = new Set(
    events.filter((e) => e.kind === "ASSET_PROMOTED").map((e) => e.payload.mission_id),
  ).size;

  return Object.freeze({
    missions_declared: measured(declaredSeqs.length, declaredSeqs),
    missions_verdict_pass: measured(passSeqs.length, passSeqs),
    missions_verdict_fail: measured(failSeqs.length, failSeqs),
    assets_promoted: measured(promotedSeqs.length, promotedSeqs),
    // Spec phase_07 rate over the v0.1 event vocabulary: missions with at least
    // one promoted (verdict-gated) asset / missions declared. The denominator
    // counts ATTEMPTS — a declared mission that never promotes an asset lowers
    // the rate. Zero attempts is UNKNOWN, not 0/0 -> 0.
    recovered_value_utilization_rate:
      declaredSeqs.length === 0
        ? unknown("no_missions_declared")
        : measured(missionsWithPromotedAsset / declaredSeqs.length, [...declaredSeqs, ...promotedSeqs]),
    // v0.1 events are deliberately clock-free (replay determinism), so duration
    // metrics have no evidence source yet. Encoded honestly as UNKNOWN.
    time_to_first_useful_asset: unknown("no_temporal_evidence_in_v0_1_events"),
    authority_scopes_count:
      state.authority_scopes === null
        ? unknown("authority_never_declared")
        : measured(state.authority_scopes.length, seqsOf((e) => e.kind === "AUTHORITY_NARROWED")),
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planNode0MetricsBaseline({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_METRICS_BASELINE_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!Array.isArray(input.events)) {
    blocked_by.push("input_events_not_array");
  }
  return Object.freeze({
    schema: NODE0_METRICS_BASELINE_SCHEMA,
    truth_label: NODE0_METRICS_BASELINE_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload: replay receipt + derived metrics, bound
// by one hash over the whole body. A failed replay carries the reducer's named
// blocks and metrics stays null — corrupt history never yields partial metrics.
export function buildNode0MetricsBaselinePayload(input) {
  const events = input && typeof input === "object" && Array.isArray(input.events) ? input.events : null;
  const replayResult =
    events === null
      ? Object.freeze({ ok: false, blocked_by: Object.freeze(["input_events_not_array"]), halted_at_seq: null, events_applied: 0 })
      : reduceNode0RealmEvents(events);
  const body = {
    schema: NODE0_METRICS_BASELINE_SCHEMA,
    truth_label: NODE0_METRICS_BASELINE_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    replay: Object.freeze({
      ok: replayResult.ok,
      blocked_by: replayResult.blocked_by,
      halted_at_seq: replayResult.halted_at_seq,
      events_applied: replayResult.events_applied,
    }),
    metrics: replayResult.ok ? deriveNode0BaselineMetrics(events, replayResult.state) : null,
    boundary: node0MetricsBaselineBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the WHOLE body minus
// its hash field and reject any mismatch, then check the slice invariants —
// including the UNKNOWN-is-never-zero law on every metric object.
export function verifyNode0MetricsBaseline(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (payload.schema !== NODE0_METRICS_BASELINE_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== NODE0_METRICS_BASELINE_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) {
    blocked_by.push("canonicalization_algorithm_mismatch");
  }
  if (payload.hash_algorithm !== "sha256") blocked_by.push("hash_algorithm_mismatch");
  if (payload.text_encoding !== "utf-8") blocked_by.push("text_encoding_mismatch");
  const expectedBoundary = node0MetricsBaselineBoundary();
  const boundary = payload.boundary;
  const boundaryValid =
    boundary &&
    typeof boundary === "object" &&
    Object.keys(expectedBoundary).length === Object.keys(boundary).length &&
    Object.entries(expectedBoundary).every(([key, value]) => boundary[key] === value);
  if (!boundaryValid) blocked_by.push("boundary_shape_invalid");
  if (payload.replay && payload.replay.ok === true) {
    if (payload.metrics === null || typeof payload.metrics !== "object") {
      blocked_by.push("metrics_missing_for_ok_replay");
    } else {
      for (const [name, metric] of Object.entries(payload.metrics)) {
        const isMeasured =
          metric && metric.truth_label === "MEASURED" && metric.value !== null && Array.isArray(metric.derived_from);
        const isUnknown =
          metric &&
          metric.truth_label === "UNKNOWN" &&
          metric.value === null &&
          typeof metric.reason === "string" &&
          Array.isArray(metric.derived_from) &&
          metric.derived_from.length === 0;
        if (!isMeasured && !isUnknown) blocked_by.push(`metric_shape_invalid:${name}`);
      }
    }
  }
  if (payload.replay && payload.replay.ok === false && payload.metrics !== null) {
    blocked_by.push("metrics_present_for_failed_replay");
  }
  let rederived = null;
  try {
    rederived = sha256CanonicalJsonV1(body);
  } catch {
    blocked_by.push("body_not_canonicalizable");
  }
  if (rederived !== null && rederived !== content_hash) blocked_by.push("content_hash_mismatch");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Orchestrator the review gate consumes. plan -> replay/derive -> verify ->
// tamper-reject, returning the proof envelope. Any failure returns a named
// block so the gate fails closed.
export function runNode0MetricsBaseline({ consent, input } = {}) {
  const fail = (blocked_by) =>
    Object.freeze({
      ok: false,
      schema: NODE0_METRICS_BASELINE_SCHEMA,
      truth_label: NODE0_METRICS_BASELINE_TRUTH_LABEL,
      blocked_by: Object.freeze(blocked_by),
      boundary: node0MetricsBaselineBoundary(),
    });

  const plan = planNode0MetricsBaseline({ consent, input });
  if (!plan.eligible) return fail([...plan.blocked_by]);

  const payload = buildNode0MetricsBaselinePayload(input);
  if (!payload.replay.ok) return fail([...payload.replay.blocked_by]);

  const verdict = verifyNode0MetricsBaseline(payload);
  if (!verdict.ok) return fail([...verdict.blocked_by]);

  const tampered = verifyNode0MetricsBaseline({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) return fail(["tamper_check_failed"]);

  return Object.freeze({
    ok: true,
    schema: NODE0_METRICS_BASELINE_SCHEMA,
    truth_label: NODE0_METRICS_BASELINE_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: node0MetricsBaselineBoundary(),
    blocked_by: Object.freeze([]),
    metrics: payload.metrics,
    replay: payload.replay,
  });
}
