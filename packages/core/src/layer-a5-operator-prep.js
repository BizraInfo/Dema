// Layer A5 operator prep — real-home ARTIFACT-011 ceremony readiness witness.
// Dema-side only: does NOT invoke governed Node0 or claim MEASURED.

import { BOUNDED_DIAGNOSTIC_CONSENT_PHRASE } from "./diagnostic-consent.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const LAYER_A5_OPERATOR_PREP_SCHEMA =
  "bizra.dema.layer_a5_operator_prep.v0.1";

export const LAYER_A5_ROADMAP_STEP = "A5";

const BOUNDARY = buildPreviewBoundary();

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * @param {import("../../mission/src/artifact-011-ceremony-preflight.js").ReturnType<typeof import("../../mission/src/artifact-011-ceremony-preflight.js").assessArtifact011CeremonyPreflight>} preflight
 */
export function buildLayerA5Checklist(preflight) {
  const status = preflight?.steps?.status?.parsed ?? {};
  const doctor = preflight?.steps?.doctor ?? {};

  return Object.freeze([
    Object.freeze({
      id: "setup",
      label: "dema setup --json",
      ok: preflight?.steps?.setup?.ok === true,
    }),
    Object.freeze({
      id: "setup_check",
      label: "dema setup-check --json",
      ok: preflight?.steps?.setup_check?.ok === true,
    }),
    Object.freeze({
      id: "status_ready",
      label: "status.ready === true",
      ok: status.ready === true,
    }),
    Object.freeze({
      id: "console_ready",
      label: "status.consoleReady === true",
      ok: status.consoleReady === true,
    }),
    Object.freeze({
      id: "activation_gate",
      label: 'status.activationGate === "EXPLICIT_GO_REQUIRED"',
      ok: status.activationGate === "EXPLICIT_GO_REQUIRED",
    }),
    Object.freeze({
      id: "daemon_not_running",
      label: "daemonStatus !== running (one-shot ceremony path)",
      ok: (status.daemonStatus ?? "") !== "running",
    }),
    Object.freeze({
      id: "doctor_exit_zero",
      label: "dema doctor --json exit 0",
      ok: doctor.exitCode === 0,
    }),
    Object.freeze({
      id: "preview_ceremony",
      label: "Dema-side preview ceremony cleared (steps a–d)",
      ok: preflight?.cleared_for_preview_ceremony === true,
    }),
    Object.freeze({
      id: "mission_propose_executes_false",
      label: "mission propose keeps executes=false",
      ok: preflight?.boundary?.dema_mission_executes === false,
    }),
  ]);
}

/**
 * @param {object} preflight — artifact-011 ceremony preflight report
 */
export function buildLayerA5OperatorPrepReport(preflight) {
  const checklist = buildLayerA5Checklist(preflight);
  const checklistOk = checklist.every((item) => item.ok);
  const operatorRuntimeReady = preflight?.operator_runtime_ready === true;
  const previewCleared = preflight?.cleared_for_preview_ceremony === true;

  /** @type {string} */
  let recommended_next;
  if (!previewCleared) {
    recommended_next =
      "Fix Dema-side preflight blockers, then re-run `npm run layer-a5:prep`.";
  } else if (!operatorRuntimeReady) {
    recommended_next =
      "Complete operator gateway/LM Studio/adapter setup and `dema doctor` until operator_runtime_ready=true on real ~/.dema.";
  } else {
    recommended_next = `Operator may proceed to governed Node0 runtime ceremony (Step ${LAYER_A5_ROADMAP_STEP}) outside this repo with exact consent: "${BOUNDED_DIAGNOSTIC_CONSENT_PHRASE}".`;
  }

  return deepFreeze({
    schema: LAYER_A5_OPERATOR_PREP_SCHEMA,
    road_map_step: LAYER_A5_ROADMAP_STEP,
    truth_label: previewCleared
      ? operatorRuntimeReady
        ? "PREPARED"
        : "PREPARED"
      : "GAP_DETECTED",
    artifact_id: preflight?.artifact_id ?? "ARTIFACT-011",
    dema_home: preflight?.dema_home ?? null,
    consent_phrase: BOUNDED_DIAGNOSTIC_CONSENT_PHRASE,
    operator_runtime_ready: operatorRuntimeReady,
    cleared_for_preview_ceremony: previewCleared,
    cleared_for_governed_runtime: false,
    checklist_ok: checklistOk,
    checklist,
    preflight_summary: Object.freeze({
      schema: preflight?.schema ?? null,
      truth_label: preflight?.truth_label ?? null,
      blockers: Object.freeze(
        (preflight?.blockers ?? []).map((b) => Object.freeze({ ...b })),
      ),
      recommended_next: preflight?.recommended_next ?? null,
    }),
    boundary: Object.freeze({
      ...BOUNDARY,
      runtime_executed: false,
      receipt_minted: false,
      artifact_011_measured: false,
      governed_node0_invoked: false,
      dema_mission_executes: false,
    }),
    recommended_next,
  });
}
