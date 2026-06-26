// NODE0-ACTIVATION-CHAIN-SMOKE-1A — pure evaluator for activation-chain CLI smoke.

import {
  NODE0_ACTIVATION_CHAIN_SCHEMA,
  verifyNode0ActivationChainPreview,
} from "./node0-activation-chain-preview.js";
import { PEAK_SELF_LOOP_PREVIEW_SCHEMA } from "./peak-self-loop-preview.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA =
  "bizra.dema.node0_activation_chain_smoke.v0.1";
export const NODE0_ACTIVATION_CHAIN_SMOKE_TRUTH_LABEL =
  "NODE0_ACTIVATION_CHAIN_SMOKE_READ_ONLY";

export const SMOKE_PAIN = "VRAM blocks fair model routing";
export const SMOKE_GOAL = "compose preview-only activation chain";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function boundaryAllFalse(boundary) {
  const canonical = buildPreviewBoundary();
  if (!boundary || typeof boundary !== "object") return false;
  return Object.keys(canonical).every((key) => boundary[key] === false);
}

function proactiveSelfHarnessOk(selfLoop) {
  const ps = selfLoop?.proactive_self;
  if (!ps || typeof ps !== "object") return false;
  if (!ps.critique?.verdict) return false;
  if (!Array.isArray(ps.harness?.active_gates) || ps.harness.active_gates.length === 0) {
    return false;
  }
  if (typeof ps.consent?.required_phrase !== "string" || !ps.consent.required_phrase) {
    return false;
  }
  if (!ps.compliance || typeof ps.compliance !== "object") return false;
  if (!ps.awareness?.what_this_proves) return false;
  if (!ps.loop_engineering?.next_safe_transition) return false;
  return true;
}

/**
 * @param {object} params
 * @param {object} params.report Parsed `dema node0 chain --json` envelope
 * @param {boolean} [params.expectSelfLoop]
 */
export function buildNode0ActivationChainSmokeReport({
  report,
  expectSelfLoop = true,
} = {}) {
  const findings = [];

  if (!report || typeof report !== "object") {
    findings.push({ code: "report_not_object", message: "CLI did not return an object" });
  } else {
    if (report.schema !== NODE0_ACTIVATION_CHAIN_SCHEMA) {
      findings.push({
        code: "schema_mismatch",
        message: `expected ${NODE0_ACTIVATION_CHAIN_SCHEMA}`,
      });
    }
    if (report.chain_status !== "PREVIEW_COMPOSED") {
      findings.push({
        code: "chain_status_not_composed",
        message: `chain_status=${report.chain_status}`,
      });
    }
    if (!boundaryAllFalse(report.boundary)) {
      findings.push({
        code: "boundary_not_all_false",
        message: "preview boundary must be all false",
      });
    }

    const verified = verifyNode0ActivationChainPreview(report);
    if (!verified.ok) {
      findings.push({
        code: "chain_verify_failed",
        message: verified.blocked_by.join(", "),
      });
    }

    if (expectSelfLoop) {
      const sl = report.components?.self_loop;
      if (!sl) {
        findings.push({ code: "self_loop_missing", message: "--self-loop expected" });
      } else {
        if (sl.schema !== PEAK_SELF_LOOP_PREVIEW_SCHEMA) {
          findings.push({ code: "self_loop_schema", message: sl.schema });
        }
        if (sl.autonomous_rsi?.not_autonomous_runtime !== true) {
          findings.push({
            code: "self_loop_autonomy_overclaim",
            message: "not_autonomous_runtime must be true",
          });
        }
        if (!proactiveSelfHarnessOk(sl)) {
          findings.push({
            code: "proactive_self_harness_incomplete",
            message: "critique/harness/consent/compliance/awareness/loop required",
          });
        }
        if (!sl.snr_framework?.verdict) {
          findings.push({ code: "snr_missing", message: "SNR verdict required" });
        }
        if (!sl.proof_of_truth_convergence?.summary) {
          findings.push({
            code: "proof_convergence_missing",
            message: "proof-of-truth convergence summary required",
          });
        }
      }
      if (report.autopoietic_posture?.not_autonomous_runtime !== true) {
        findings.push({
          code: "autopoietic_posture_overclaim",
          message: "autopoietic_posture must deny autonomous runtime",
        });
      }
    }
  }

  return deepFreeze({
    schema: NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA,
    truth_label: NODE0_ACTIVATION_CHAIN_SMOKE_TRUTH_LABEL,
    ok: findings.length === 0,
    expect_self_loop: expectSelfLoop,
    smoke_pain: SMOKE_PAIN,
    smoke_goal: SMOKE_GOAL,
    findings: Object.freeze(findings),
  });
}

export function verifyNode0ActivationChainSmokeReport(report) {
  const ok =
    report?.schema === NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA && report?.ok === true;
  return Object.freeze({ ok, schema: NODE0_ACTIVATION_CHAIN_SMOKE_SCHEMA });
}
