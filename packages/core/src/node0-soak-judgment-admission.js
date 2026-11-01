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
/** Sealed runner envelope from `dema node0 run` — judgment lives at `.verdict`. */
export const NODE0_RUN_RECEIPT_SCHEMA = "bizra.dema.node0_run_receipt.v0.1";
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
 * Normalize a sealed `node0 run` receipt into a bare endurance judgment.
 * Bare judgments pass through. Does not invent fields — only unwraps + carries
 * `run_id` from the envelope when the nested verdict omits it.
 */
export function unwrapEnduranceJudgment(input) {
  if (!isPlainObject(input)) return input;
  if (input.schema !== NODE0_RUN_RECEIPT_SCHEMA) return input;
  const nested = input.verdict;
  if (!isPlainObject(nested)) {
    return Object.freeze({
      schema: null,
      _unwrap_refuse: "run_receipt_verdict_missing",
      run_id: typeof input.run_id === "string" ? input.run_id : null,
    });
  }
  const runId =
    typeof nested.run_id === "string" && nested.run_id.trim()
      ? nested.run_id
      : typeof input.run_id === "string"
        ? input.run_id
        : undefined;
  return Object.freeze({
    ...nested,
    ...(runId !== undefined ? { run_id: runId } : {}),
  });
}

/**
 * Map an endurance judgment into a soak observation for measurement admission.
 * Also accepts a sealed `bizra.dema.node0_run_receipt.v0.1` and unwraps
 * `.verdict` (the runner's on-disk endurance-receipt.json shape).
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

  const unwrapped = unwrapEnduranceJudgment(judgment);
  if (
    isPlainObject(unwrapped) &&
    unwrapped._unwrap_refuse === "run_receipt_verdict_missing"
  ) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason: "run_receipt_verdict_missing",
      projection: Object.freeze({
        observed_duration_seconds: null,
        healthy: false,
        run_id: unwrapped.run_id ?? null,
      }),
      boundary,
      authority_delta: 0,
      what_this_proves: WHAT_THIS_PROVES,
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    });
  }
  judgment = unwrapped;

  // Schema is mandatory provenance. Missing schema must not project as soak
  // evidence (Codex P1: omit-schema payloads with positive flags).
  if (judgment.schema !== NODE0_ENDURANCE_JUDGMENT_SCHEMA) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason:
        judgment.schema === undefined || judgment.schema === null
          ? "schema_missing"
          : "schema_mismatch",
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

  // Reject null / non-numeric before Number() — Number(null)===0 would launder
  // missing fields into a zero-failure / zero-span reading (CodeRabbit major).
  const spanRaw = judgment.observed_span_ms;
  if (typeof spanRaw !== "number" || !Number.isFinite(spanRaw) || spanRaw < 0) {
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
  const spanMs = spanRaw;

  const failRaw = judgment.failure_count;
  if (
    typeof failRaw !== "number" ||
    !Number.isFinite(failRaw) ||
    failRaw < 0 ||
    !Number.isInteger(failRaw)
  ) {
    return Object.freeze({
      schema: NODE0_SOAK_JUDGMENT_ADMISSION_SCHEMA,
      truth_label: NODE0_SOAK_JUDGMENT_ADMISSION_TRUTH_LABEL,
      ok: false,
      soak: null,
      refuse_reason: "invalid_failure_count",
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
  const failure_count = failRaw;

  const observed_duration_seconds = Math.floor(spanMs / 1000);
  const failuresOk = failure_count === 0;
  const continuous = judgment.continuously_observed === true;
  const targetMet = judgment.target_met_by_elapsed_run === true;
  // Accepted verdicts only — never OR with target_met to override an explicit
  // failing verdict such as INSUFFICIENT (Codex P1).
  // HEALTHY is the live endurance kernel vocabulary (node0-endurance.js);
  // SUFFICIENT/PASS remain for earlier fixture/ledger spellings.
  const verdictOk =
    judgment.verdict === "HEALTHY" ||
    judgment.verdict === "SUFFICIENT" ||
    judgment.verdict === "PASS";
  // Healthy only when the judge itself says the run met its bar with zero
  // failures and continuous observation. Short or failing runs still project
  // a soak object (so admission can cite duration), but observed stays false.
  // target_met_by_elapsed_run is corroboration, not a substitute for verdict.
  const healthy =
    judgment.ok === true &&
    continuous &&
    failuresOk &&
    verdictOk &&
    targetMet === true;

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
