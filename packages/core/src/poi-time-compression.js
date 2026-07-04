// POI-TIME-COMPRESSION-1A — Local-only PoI time-compression candidate receipt: declared baseline estimate vs declared actual duration under required quality gates; fail-closed, observation-aware, no mint.
//
// Two clocks, never conflated:
//   proof-time      — how long the gated build loop actually took (declared).
//   observation-time — how long reality must be observed before impact can be
//                      claimed; NOT compressible by build speed.
// A baseline estimate is a reference-class assumption (model/human/industry),
// never a measured fact — the receipt records it as DECLARED. Compression is a
// CANDIDATE claim only: no gates green means no receipt at all, and no receipt
// ever mints, rewards, or asserts verified impact.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const POI_TIME_COMPRESSION_SCHEMA = "bizra.dema.poi_time_compression.v0.1";
export const POI_TIME_COMPRESSION_TRUTH_LABEL = "POI_TIME_COMPRESSION_CANDIDATE_LOCAL_ONLY";
export const POI_TIME_COMPRESSION_GO_PHRASE = "GO: poi time compression preview";

export const POI_TIME_COMPRESSION_BASELINE_SOURCES = Object.freeze([
  "model_estimate",
  "human_estimate",
  "industry_baseline",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPositiveFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item));
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function poiTimeCompressionBoundary() {
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

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function planPoiTimeCompression({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== POI_TIME_COMPRESSION_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    if (!isNonEmptyString(input.task_id)) {
      blocked_by.push("task_id_missing");
    }

    const baseline = input.baseline;
    if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
      blocked_by.push("baseline_not_object");
    } else {
      if (!isPositiveFiniteNumber(baseline.duration_hours)) {
        blocked_by.push("baseline_hours_not_positive");
      }
      if (!POI_TIME_COMPRESSION_BASELINE_SOURCES.includes(baseline.source)) {
        blocked_by.push("baseline_source_invalid");
      }
      if (!isNonEmptyString(baseline.reference_class)) {
        blocked_by.push("baseline_reference_class_missing");
      }
    }

    const actual = input.actual;
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      blocked_by.push("actual_not_object");
    } else {
      if (!isPositiveFiniteNumber(actual.duration_hours)) {
        blocked_by.push("actual_hours_not_positive");
      }
      if (!isNonEmptyString(actual.operating_mode)) {
        blocked_by.push("actual_operating_mode_missing");
      }
    }

    const gates = input.quality_gates;
    if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
      blocked_by.push("quality_gates_not_object");
    } else {
      if (!isStringArray(gates.required) || gates.required.length === 0) {
        blocked_by.push("quality_gates_required_empty");
      } else if (!isStringArray(gates.passed)) {
        blocked_by.push("quality_gates_passed_not_list");
      } else {
        // No compression claim survives a failed gate: every required gate
        // must appear in passed, or the plan refuses to produce a receipt.
        for (const gate of gates.required) {
          if (!gates.passed.includes(gate)) {
            blocked_by.push(`quality_gate_failed:${gate}`);
          }
        }
      }
    }

    if (typeof input.observation_required !== "boolean") {
      blocked_by.push("observation_required_not_boolean");
    }
  }
  return Object.freeze({
    schema: POI_TIME_COMPRESSION_SCHEMA,
    truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function computeCompressionRatio(baselineHours, actualHours) {
  return Math.round((baselineHours / actualHours) * 100) / 100;
}

// Canonical, content-addressed payload. The body carries the two-clock split
// (proof-time vs observation-time) and hard-codes the economic refusals:
// no_mint is always true and independently_reviewed is always false — a v0.1
// receipt cannot attest its own review.
export function buildPoiTimeCompressionPayload(input) {
  const source = input && typeof input === "object" ? input : {};
  const baseline = source.baseline && typeof source.baseline === "object" ? source.baseline : {};
  const actual = source.actual && typeof source.actual === "object" ? source.actual : {};
  const gates = source.quality_gates && typeof source.quality_gates === "object" ? source.quality_gates : {};
  const required = isStringArray(gates.required) ? [...gates.required] : [];
  const passed = isStringArray(gates.passed) ? [...gates.passed] : [];
  const observationRequired = source.observation_required === true;
  const ratio =
    isPositiveFiniteNumber(baseline.duration_hours) && isPositiveFiniteNumber(actual.duration_hours)
      ? computeCompressionRatio(baseline.duration_hours, actual.duration_hours)
      : null;

  const body = {
    schema: POI_TIME_COMPRESSION_SCHEMA,
    truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL,
    task: {
      id: isNonEmptyString(source.task_id) ? source.task_id : null,
      name: isNonEmptyString(source.task_name) ? source.task_name : null,
    },
    baseline: {
      duration_hours: isPositiveFiniteNumber(baseline.duration_hours) ? baseline.duration_hours : null,
      source: POI_TIME_COMPRESSION_BASELINE_SOURCES.includes(baseline.source) ? baseline.source : null,
      reference_class: isNonEmptyString(baseline.reference_class) ? baseline.reference_class : null,
      status: "DECLARED_REFERENCE_CLASS_ASSUMPTION_NOT_MEASURED",
    },
    actual: {
      duration_hours: isPositiveFiniteNumber(actual.duration_hours) ? actual.duration_hours : null,
      operating_mode: isNonEmptyString(actual.operating_mode) ? actual.operating_mode : null,
      status: "DECLARED_BY_OPERATOR",
    },
    quality_gates: {
      required,
      passed,
      all_required_passed: required.length > 0 && required.every((gate) => passed.includes(gate)),
    },
    compression: {
      ratio,
      formula: "baseline_estimate_hours / actual_duration_hours",
      claim_status: "CANDIDATE_NOT_INDEPENDENTLY_REVIEWED",
    },
    clocks: {
      proof_time_hours: isPositiveFiniteNumber(actual.duration_hours) ? actual.duration_hours : null,
      observation_required: observationRequired,
      life_proof_status: observationRequired
        ? "PENDING_REAL_OBSERVATION"
        : "NOT_REQUIRED_FOR_THIS_TASK",
    },
    independently_reviewed: false,
    no_mint: true,
    boundary: poiTimeCompressionBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then re-derive every derived field so a forge-and-recompute launder on ratio,
// gate survival, clocks, no_mint, or the review flag still fails. Free-form
// declared hours have no independent anchor in v0.1 — that limit is documented,
// not hidden.
export function verifyPoiTimeCompression(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }

  const { content_hash, ...body } = payload;
  const recomputed = `sha256:${sha256(stableStringify(body))}`;
  if (content_hash !== recomputed) {
    blocked_by.push("content_hash_mismatch");
  }

  if (payload.schema !== POI_TIME_COMPRESSION_SCHEMA) {
    blocked_by.push("schema_mismatch");
  }
  if (payload.truth_label !== POI_TIME_COMPRESSION_TRUTH_LABEL) {
    blocked_by.push("truth_label_mismatch");
  }
  if (payload.no_mint !== true) {
    blocked_by.push("no_mint_not_true");
  }
  if (payload.independently_reviewed !== false) {
    blocked_by.push("independently_reviewed_must_be_false");
  }

  const boundary = payload.boundary;
  const expectedBoundary = poiTimeCompressionBoundary();
  if (!boundary || typeof boundary !== "object") {
    blocked_by.push("boundary_missing");
  } else {
    for (const key of Object.keys(expectedBoundary)) {
      if (boundary[key] !== false) {
        blocked_by.push(`boundary_not_false:${key}`);
      }
    }
  }

  const baselineHours = payload.baseline?.duration_hours;
  const actualHours = payload.actual?.duration_hours;
  if (!isPositiveFiniteNumber(baselineHours)) {
    blocked_by.push("baseline_hours_not_positive");
  }
  if (!isPositiveFiniteNumber(actualHours)) {
    blocked_by.push("actual_hours_not_positive");
  }
  if (!POI_TIME_COMPRESSION_BASELINE_SOURCES.includes(payload.baseline?.source)) {
    blocked_by.push("baseline_source_invalid");
  }
  if (!isNonEmptyString(payload.baseline?.reference_class)) {
    blocked_by.push("baseline_reference_class_missing");
  }

  if (isPositiveFiniteNumber(baselineHours) && isPositiveFiniteNumber(actualHours)) {
    const expectedRatio = computeCompressionRatio(baselineHours, actualHours);
    if (payload.compression?.ratio !== expectedRatio) {
      blocked_by.push("compression_ratio_mismatch");
    }
  }

  const gates = payload.quality_gates;
  if (!gates || !isStringArray(gates.required) || gates.required.length === 0 || !isStringArray(gates.passed)) {
    blocked_by.push("quality_gates_malformed");
  } else {
    const derivedSurvival = gates.required.every((gate) => gates.passed.includes(gate));
    if (gates.all_required_passed !== derivedSurvival) {
      blocked_by.push("quality_gate_survival_forged");
    }
    if (derivedSurvival !== true) {
      blocked_by.push("quality_gate_failed_receipt_invalid");
    }
  }

  const clocks = payload.clocks;
  if (!clocks || typeof clocks !== "object") {
    blocked_by.push("clocks_missing");
  } else {
    if (typeof clocks.observation_required !== "boolean") {
      blocked_by.push("observation_required_not_boolean");
    } else {
      const expectedLifeProof = clocks.observation_required
        ? "PENDING_REAL_OBSERVATION"
        : "NOT_REQUIRED_FOR_THIS_TASK";
      if (clocks.life_proof_status !== expectedLifeProof) {
        blocked_by.push("life_proof_status_inconsistent");
      }
    }
    if (isPositiveFiniteNumber(actualHours) && clocks.proof_time_hours !== actualHours) {
      blocked_by.push("proof_time_hours_mismatch");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// (including a forge-and-recompute launder probe) and return the proof envelope.
// Push a named block on any failure so the gate fails closed.
export function runPoiTimeCompression({ consent, input } = {}) {
  const boundary = poiTimeCompressionBoundary();
  const plan = planPoiTimeCompression({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: POI_TIME_COMPRESSION_SCHEMA,
      truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL,
      blocked_by: plan.blocked_by,
      boundary,
    });
  }

  const blocked_by = [];
  const payload = buildPoiTimeCompressionPayload(input);

  const verdict = verifyPoiTimeCompression(payload);
  if (!verdict.ok) {
    blocked_by.push(...verdict.blocked_by);
  }

  // Tamper probe: a changed field with a stale hash must fail.
  const tampered = { ...payload, truth_label: "FORGED" };
  if (verifyPoiTimeCompression(tampered).ok) {
    blocked_by.push("tamper_check_failed");
  }

  // Launder probe: a forged ratio with a RECOMPUTED self-consistent hash must
  // still fail, because verify re-derives the ratio from the declared hours.
  const { content_hash: _stale, ...launderBody } = {
    ...payload,
    compression: { ...payload.compression, ratio: (payload.compression.ratio ?? 0) * 10 + 1 },
  };
  const laundered = Object.freeze({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  if (verifyPoiTimeCompression(laundered).ok) {
    blocked_by.push("launder_check_failed");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: POI_TIME_COMPRESSION_SCHEMA,
    truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL,
    content_hash: payload.content_hash,
    compression_ratio: payload.compression.ratio,
    payload,
    blocked_by: Object.freeze(blocked_by),
    boundary,
  });
}
