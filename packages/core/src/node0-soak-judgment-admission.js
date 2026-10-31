// NODE0-SOAK-JUDGMENT-ADMISSION-1A
//
// Pure adapter: endurance soak *judgment* (bizra.dema.node0_endurance.v0.1)
// → soak observation shape consumed by node0-close-measurement-receipt.
//
// Lost-in-noise estate soak tools already produce sealed judgments; the
// measurement overlay had no bridge, so admission stayed UNKNOWN forever even
// when a real (but insufficient) soak existed. This module makes that link
// observable and fail-closed — it never invents 72h of health.
//
// Pure · deterministic · no fs/network/daemon. authority_delta = 0.

import { buildPreviewBoundary } from "./preview-boundary.js";
import { SOAK_OBSERVATION_SCOPE } from "./node0-close-measurement-receipt.js";

export const NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA =
  "bizra.dema.node0_soak_judgment_admission.v0.1";
export const NODE0_ENDURANCE_JUDGMENT_SCHEMA = "bizra.dema.node0_endurance.v0.1";
export const NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL =
  "NODE0_SOAK_JUDGMENT_ADMISSION_LOCAL";

const WHAT_THIS_PROVES =
  "Whether a measured endurance judgment can be projected into the soak observation shape used by Node0-close measurement admission — including honest shortfalls.";
const WHAT_THIS_DOES_NOT_PROVE =
  "Does not prove a live 72h soak, start a soak unit, mint closure, or that samples were honestly collected; it only maps a supplied judgment object.";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Map an endurance judgment into a soak observation for measurement admission.
 *
 * @param {object|null|undefined} judgment
 * @returns {{
 *   schema: string,
 *   truth_label: string,
 *   ok: boolean,
 *   soak: object|null,
 *   refuse_reason: string|null,
 *   projection: object,
 *   boundary: object,
 *   authority_delta: 0,
 *   what_this_proves: string,
 *   what_this_does_not_prove: string,
 * }}
 */
export function projectSoakJudgmentToAdmission(judgment) {
  const boundary = buildPreviewBoundary();

  if (judgment === undefined || judgment === null) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: true,
      soak: null,
      refuse_reason: "no_judgment",
      projection: Object.freeze({
        observed_duration_seconds: null,
        healthy: false,
        run_id: null,
      }),
      boundary,
      authority_delta: 0,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  if (!isPlainObject(judgment)) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason: "judgment_not_object",
      projection: Object.freeze({
        observed_duration_seconds: null,
        healthy: false,
        run_id: null,
      }),
      boundary,
      authority_delta: 0,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  if (
    judgment.schema !== undefined &&
    judgment.schema !== NODE0_ENDURANCE_JUDGMENT_SCHEMA
  ) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason: "schema_mismatch",
      projection: Object.freeze({
        observed_duration_seconds: null,
        healthy: false,
        run_id: typeof judgment.run_id === "string" ? judgment.run_id : null,
      }),
      boundary,
      authority_delta: 0,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  const spanMs = Number(judgment.observed_span_ms);
  if (!Number.isFinite(spanMs) || spanMs < 0) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason: "missing_observed_span_ms",
      projection: Object.freeze({
        observed_duration_seconds: null,
        healthy: false,
        run_id: typeof judgment.run_id === "string" ? judgment.run_id : null,
      }),
      boundary,
      authority_delta: 0,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }

  const observed_duration_seconds = Math.floor(spanMs / 1000);
  const failure_count = Number(judgment.failure_count);
  const failuresOk = Number.isFinite(failure_count) && failure_count === 0;
  const continuous = judgment.continuously_observed === true;
  const targetMet = judgment.target_met_by_elapsed_run === true;
  const verdictOk =
    judgment.verdict === "SUFFICIENT" ||
    judgment.verdict === "PASS" ||
    targetMet === true;
  // Healthy only when the judge itself says the run met its bar with zero
  // failures and continuous observation. Short or failing runs still project
  // a soak object (so admission can cite duration), but observed stays false.
  const healthy =
    judgment.ok === true && continuous && failuresOk && verdictOk;

  const runId =
    typeof judgment.run_id === "string" && judgment.run_id.trim()
      ? judgment.run_id.trim()
      : "unknown-run";
  const headHash =
    typeof judgment.chain?.head_hash === "string" && judgment.chain.head_hash
      ? judgment.chain.head_hash
      : "no_chain_head";
  const source = `node0_endurance_judge:${runId}:${headHash}`;

  const soak = Object.freeze({
    observed: healthy,
    source,
    scope: SOAK_OBSERVATION_SCOPE,
    observed_duration_seconds,
  });

  return Object.freeze({
    schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
    truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
    ok: true,
    soak,
    refuse_reason: null,
    projection: Object.freeze({
      observed_duration_seconds,
      healthy,
      run_id: runId,
      failure_count: Number.isFinite(failure_count) ? failure_count : null,
      continuously_observed: continuous,
      verdict: typeof judgment.verdict === "string" ? judgment.verdict : null,
      observed_span_ms: spanMs,
    }),
    boundary,
    authority_delta: 0,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
