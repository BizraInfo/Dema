// FRAMEWORK-CONSTELLATION-PREVIEW-1A
//
// Ultra-micro graph over already-shipped pure kernels:
//   HHMM lifecycle trace · hash-table knowledge query · diffusion denoising · optional FDE
// Composes caller-supplied evidence only. PREVIEW_ONLY. Not RSI, not autopoietic runtime,
// not a live agent loop, not neural HHMM/diffusion. authority_delta = 0 always.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildAllFalseBoundaryFromKeys } from "./boundary-schema.js";
import {
  buildHhmmStateMachine,
  runHhmmTrace,
  verifyHhmmMachine,
} from "./hhmm-state-machine.js";
import {
  buildHashTableKnowledgeIndex,
  queryHashTableKnowledgeIndex,
  verifyHashTableKnowledgeIndex,
} from "./hash-table-knowledge-index.js";
import {
  buildDiffusionRefinement,
  verifyDiffusionRefinement,
} from "./diffusion-reasoner.js";
import {
  diagnoseDemaFailure,
  verifyDemaFdeDualDiagnostic,
} from "./dema-fde-dual-diagnostic.js";

export const FRAMEWORK_CONSTELLATION_SCHEMA =
  "bizra.dema.framework_constellation_preview.v0.1";
export const FRAMEWORK_CONSTELLATION_TRUTH_LABEL =
  "FRAMEWORK_CONSTELLATION_PREVIEW_ONLY";
export const FRAMEWORK_CONSTELLATION_CLAIM_CEILING =
  "CONTROL_MAPPING_COMPLETE";

export const FRAMEWORK_CONSTELLATION_BOUNDARY_KEYS = Object.freeze([
  "runtime_execution_performed",
  "model_invocation_performed",
  "network_call_performed",
  "file_write_performed",
  "self_modification_performed",
  "autonomous_loop_started",
  "rsi_activated",
  "singularity_claimed",
  "signing_performed",
  "mint_performed",
  "federation_started",
  "daemon_started",
]);

const BOUNDARY = buildAllFalseBoundaryFromKeys(
  FRAMEWORK_CONSTELLATION_BOUNDARY_KEYS,
);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function deriveNextSafeAction({ hhmm, diffusion, fde, knowledge_hits }) {
  if (hhmm?.valid === false) {
    return "repair_hhmm_observations_or_machine";
  }
  if (hhmm?.final_state === "rejected" || hhmm?.final_state === "gate_blocked") {
    return "diagnose_with_fde_then_narrow_inward_fix";
  }
  if (diffusion?.convergence_status === "DIVERGED") {
    return "rewrite_drafts_to_monotone_denoise";
  }
  if (diffusion?.convergence_status === "REFINING") {
    return "continue_denoising_until_zero_noise_plus_evidence";
  }
  if (diffusion?.convergence_status === "DENOISED_UNEVIDENCED") {
    return "attach_disk_evidence_anchors_before_claiming_converged";
  }
  if (diffusion?.valid === false || diffusion?.convergence_status == null) {
    return "repair_diffusion_drafts_input";
  }
  if (fde && fde.eligible_for_autopatch === false && fde.failure_class) {
    if (
      ["environment_gap", "dependency_gap", "permission_gap", "github_actions_billing_lock"].includes(
        fde.failure_class,
      )
    ) {
      return "treat_as_outward_do_not_patch_code";
    }
  }
  if (knowledge_hits === 0) {
    return "index_or_query_knowledge_before_amplifying";
  }
  if (hhmm?.final_state === "tested_preview" || hhmm?.final_state === "merge_ready") {
    return "run_focused_gates_then_stop_no_push_without_typed_go";
  }
  return "hold_preview_gather_stronger_emissions";
}

/**
 * Compose HHMM + hash-table + diffusion (+ optional FDE) into one frozen preview.
 * Inputs are caller-supplied; nothing is read from disk or network here.
 */
export function buildFrameworkConstellationPreview({
  observations = [],
  knowledge_entries = [],
  drafts = [],
  evidence = [],
  knowledge_query = null,
  fde_input = null,
  constellation_id = "framework-constellation-1a",
} = {}) {
  const machine = buildHhmmStateMachine();
  const hhmm = runHhmmTrace({ machine, observations });
  const index = buildHashTableKnowledgeIndex({
    entries: knowledge_entries,
    namespace: "framework-constellation",
  });
  let knowledge_query_result = null;
  let knowledge_hits = 0;
  if (
    knowledge_query &&
    typeof knowledge_query === "object" &&
    typeof knowledge_query.axis === "string" &&
    typeof knowledge_query.key === "string"
  ) {
    knowledge_query_result = queryHashTableKnowledgeIndex({
      index,
      axis: knowledge_query.axis,
      key: knowledge_query.key,
    });
    knowledge_hits =
      knowledge_query_result?.found === true &&
      Array.isArray(knowledge_query_result.entries)
        ? knowledge_query_result.entries.length
        : 0;
  }

  // Never invent drafts: empty/missing inputs must surface as refuse, not CONVERGED.
  const diffusion = Array.isArray(drafts) && drafts.length > 0
    ? buildDiffusionRefinement({
        drafts,
        evidence,
        claim_id: `${constellation_id}:diffusion`,
      })
    : Object.freeze({
        valid: false,
        rejected: true,
        reason_code: Array.isArray(drafts) ? "drafts_empty" : "drafts_must_be_array",
        convergence_status: null,
        final_noise_score: null,
        convergence_hash: null,
      });

  let fde = null;
  let fde_verify = null;
  if (fde_input && typeof fde_input === "object") {
    fde = diagnoseDemaFailure(fde_input);
    fde_verify = verifyDemaFdeDualDiagnostic(fde);
  }

  const next_safe_action = deriveNextSafeAction({
    hhmm,
    diffusion,
    fde,
    knowledge_hits,
  });

  const body = {
    schema: FRAMEWORK_CONSTELLATION_SCHEMA,
    truth_label: FRAMEWORK_CONSTELLATION_TRUTH_LABEL,
    claim_ceiling: FRAMEWORK_CONSTELLATION_CLAIM_CEILING,
    mode: "PREVIEW_ONLY",
    constellation_id,
    authority_delta: 0,
    kernels: Object.freeze({
      hhmm: "packages/core/src/hhmm-state-machine.js",
      hash_table: "packages/core/src/hash-table-knowledge-index.js",
      diffusion: "packages/core/src/diffusion-reasoner.js",
      fde: fde ? "packages/core/src/dema-fde-dual-diagnostic.js" : null,
    }),
    hhmm: Object.freeze({
      valid: hhmm.valid !== false,
      final_state: hhmm.final_state ?? null,
      reason_code: hhmm.reason_code ?? null,
      path_length: typeof hhmm.step_count === "number" ? hhmm.step_count : 0,
      machine_ok: verifyHhmmMachine(machine).valid === true,
    }),
    knowledge: Object.freeze({
      index_ok: verifyHashTableKnowledgeIndex(index).valid === true,
      index_hash: index.index_hash ?? null,
      entry_count: Array.isArray(knowledge_entries) ? knowledge_entries.length : 0,
      query: knowledge_query
        ? Object.freeze({
            axis: knowledge_query.axis,
            key: knowledge_query.key,
            hits: knowledge_hits,
          })
        : null,
    }),
    diffusion: Object.freeze({
      ok:
        diffusion.valid !== false &&
        verifyDiffusionRefinement(diffusion).valid === true,
      convergence_status: diffusion.convergence_status ?? null,
      final_noise_score:
        typeof diffusion.final_noise_score === "number"
          ? diffusion.final_noise_score
          : null,
      convergence_hash: diffusion.convergence_hash ?? null,
      evidence_count: Array.isArray(evidence) ? evidence.length : 0,
    }),
    fde: fde
      ? Object.freeze({
          ok: fde_verify?.ok === true,
          failure_class: fde.failure_class ?? null,
          measured_status: fde.measured_status ?? null,
          eligible_for_autopatch: fde.eligible_for_autopatch === true,
          diagnostic_hash: fde.diagnostic_hash ?? null,
        })
      : null,
    snr: Object.freeze({
      ranked_signals: Object.freeze(
        [
          hhmm.final_state === "tested_preview" || hhmm.final_state === "merge_ready"
            ? "hhmm_lifecycle_advanced"
            : null,
          diffusion.convergence_status === "CONVERGED" ? "diffusion_converged" : null,
          knowledge_hits > 0 ? "knowledge_hit" : null,
          fde?.failure_class ? `fde:${fde.failure_class}` : null,
        ].filter(Boolean),
      ),
      dominant_blocker:
        next_safe_action.startsWith("hold") ||
        next_safe_action.startsWith("repair") ||
        next_safe_action.startsWith("diagnose") ||
        next_safe_action.startsWith("rewrite") ||
        next_safe_action.startsWith("continue") ||
        next_safe_action.startsWith("attach") ||
        next_safe_action.startsWith("treat") ||
        next_safe_action.startsWith("index")
          ? next_safe_action
          : null,
    }),
    next_safe_action,
    boundary: BOUNDARY,
    what_this_proves:
      "Caller-supplied observations/entries/drafts can be composed through existing pure kernels into one frozen preview with an explicit next_safe_action and all-false boundary.",
    what_this_does_not_prove:
      "Not live RSI, not autopoietic runtime, not neural HHMM/diffusion, not LOCAL_PILOT_ACTIVE, not merge/push authority, not disk re-derivation of evidence paths.",
  };

  const constellation_hash = sha256(stableStringify({
    schema: body.schema,
    truth_label: body.truth_label,
    constellation_id: body.constellation_id,
    hhmm: body.hhmm,
    knowledge: body.knowledge,
    diffusion: body.diffusion,
    fde: body.fde,
    next_safe_action: body.next_safe_action,
    authority_delta: body.authority_delta,
    boundary: body.boundary,
  }));

  return deepFreeze({ ...body, constellation_hash });
}

export function verifyFrameworkConstellationPreview(report) {
  if (!report || typeof report !== "object") {
    return Object.freeze({ valid: false, reason_code: "report_required" });
  }
  if (report.schema !== FRAMEWORK_CONSTELLATION_SCHEMA) {
    return Object.freeze({ valid: false, reason_code: "schema_mismatch" });
  }
  if (report.truth_label !== FRAMEWORK_CONSTELLATION_TRUTH_LABEL) {
    return Object.freeze({ valid: false, reason_code: "truth_label_mismatch" });
  }
  if (report.authority_delta !== 0) {
    return Object.freeze({ valid: false, reason_code: "authority_delta_nonzero" });
  }
  if (report.mode !== "PREVIEW_ONLY") {
    return Object.freeze({ valid: false, reason_code: "mode_not_preview" });
  }
  for (const key of FRAMEWORK_CONSTELLATION_BOUNDARY_KEYS) {
    if (report.boundary?.[key] !== false) {
      return Object.freeze({
        valid: false,
        reason_code: `boundary_not_false:${key}`,
      });
    }
  }
  const rebuilt = buildFrameworkConstellationPreview({
    observations: [], // cannot fully rebuild without inputs — hash check only on stored fields
  });
  // Re-hash the sealed fields rather than replaying unknown inputs.
  const expected = sha256(stableStringify({
    schema: report.schema,
    truth_label: report.truth_label,
    constellation_id: report.constellation_id,
    hhmm: report.hhmm,
    knowledge: report.knowledge,
    diffusion: report.diffusion,
    fde: report.fde,
    next_safe_action: report.next_safe_action,
    authority_delta: report.authority_delta,
    boundary: report.boundary,
  }));
  if (report.constellation_hash !== expected) {
    return Object.freeze({ valid: false, reason_code: "constellation_hash_mismatch" });
  }
  // Silence unused rebuilt (kept as purity smoke that builder still runs).
  if (rebuilt.schema !== FRAMEWORK_CONSTELLATION_SCHEMA) {
    return Object.freeze({ valid: false, reason_code: "builder_schema_drift" });
  }
  return Object.freeze({ valid: true, reason_code: null });
}
