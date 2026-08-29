// MISSION-RUNTIME-0B — one live worker turn, no authority or effect ownership.
// Existing owners remain authoritative: worker input/shape, broker routing,
// localhost invocation, and the 0A supervisor reducer.

import { canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { routeForTask } from "../../models/src/model-broker-preview.js";
import { resumeMissionState } from "./mission-contract-state.js";
import { buildWorkerInput, validateProposal } from "./mission-worker-adapter.js";
import { invokeRoutedLocalModel } from "./routed-llm-invocation.js";
import { step } from "./mission-supervisor.js";

export const MISSION_RUNTIME_0B_SCHEMA = "bizra.dema.mission_runtime_0b.v0.1";

function result(fields) {
  return Object.freeze({
    schema: MISSION_RUNTIME_0B_SCHEMA,
    authority_delta: 0,
    effect_performed: false,
    ...fields,
  });
}
function refusal(code, fields = {}) {
  return result({
    status: "REFUSED",
    refusal: code,
    worker_input: null,
    route: null,
    invocation: null,
    validation: null,
    event: null,
    supervisor: null,
    ...fields,
  });
}

function invocationRefusal(invocation) {
  const reason = invocation?.invocation_result?.error_reason ?? "";
  if (reason.startsWith("consent_phrase_mismatch")) return "consent_phrase_mismatch";
  if (reason.startsWith("consent_phrase_replayed_in_session")) return "consent_replayed";
  if (reason.startsWith("timeout_after_")) return "model_invocation_timeout";
  return "model_invocation_failed";
}

function buildPrompt(workerInput) {
  const action = workerInput?.eligible_actions?.[0];
  const stage = workerInput?.checkpoint?.snapshot?.current_stage;
  const evidence = workerInput?.checkpoint?.snapshot?.accepted_evidence?.[0];
  return [
    "Return exactly one compact JSON object and no prose.",
    `Set kind exactly to ${JSON.stringify(action)}.`,
    `Set stage exactly to ${JSON.stringify(stage)}.`,
    "Required keys: kind, stage, hash, output.",
    `Set output to an object matching this template: ${canonicalizeJsonV1(evidence?.required_output ?? {})}`,
    "Replace only descriptive placeholder strings. Do not copy checkpoint, snapshot, or accepted_evidence into output.",
    "If the evidence lists candidates, replace every candidate-path placeholder with an exact value from that candidates list; never return a literal placeholder.",
    "Keep the entire JSON response under 500 characters.",
    "Do not include contract, contract_hash, scope, authority, authority_ceiling, verdict, or receipt fields.",
    canonicalizeJsonV1(workerInput),
  ].join("\n");
}

export async function conductOneShotWorkerTurn({
  state,
  contract,
  checkpoint,
  eligibleActions,
  broker,
  taskKind,
  requiredRole = "pat_worker",
  expectedModelId,
  invokeConsent,
  timeoutMs,
  fetchImpl,
} = {}) {
  let resumed;
  try {
    resumed = resumeMissionState({ checkpoint, liveContractHash: state?.contract_hash });
  } catch {
    return refusal("stale_checkpoint");
  }
  if (
    resumed.current_stage !== state?.stage ||
    resumed.contract_hash !== state?.contract_hash ||
    resumed.receipt_head !== state?.receipt_head
  ) {
    return refusal("stale_checkpoint");
  }

  const worker_input = buildWorkerInput({
    checkpoint,
    eligible_actions: eligibleActions,
  });
  const route = routeForTask(broker, {
    task_kind: taskKind,
    required_role: requiredRole,
    local_only: true,
  });
  if (
    typeof expectedModelId !== "string" ||
    route.selected_model_id !== expectedModelId ||
    route.selected_model_locality !== "local"
  ) {
    return refusal("wrong_model_selected", { worker_input, route });
  }

  const invocation = await invokeRoutedLocalModel({
    routeReceipt: route,
    prompt: buildPrompt(worker_input),
    invokeConsent,
    timeoutMs,
    fetchImpl,
  });
  if (invocation.invocation_result?.invocation_status !== "completed") {
    return refusal(invocationRefusal(invocation), { worker_input, route, invocation });
  }
  if (invocation.invocation_result.response_safety_verdict !== "PUBLIC_SAFE") {
    return refusal("model_output_unsafe", { worker_input, route, invocation });
  }
  if (invocation.invocation_result.response_length_chars > 500) {
    return refusal("model_output_truncated", { worker_input, route, invocation });
  }

  let proposal;
  const text = invocation.invocation_result.response_text_preview;
  if (typeof text !== "string" || text.length === 0) {
    return refusal("model_output_empty", { worker_input, route, invocation });
  }
  try {
    proposal = JSON.parse(text);
  } catch {
    return refusal("model_output_not_json", { worker_input, route, invocation });
  }

  const validation = validateProposal(proposal);
  if (!validation.ok) {
    return refusal(validation.refusal, { worker_input, route, invocation, validation });
  }
  if (proposal.stage !== state.stage || !eligibleActions?.includes(proposal.kind)) {
    return refusal("proposal_not_eligible", { worker_input, route, invocation, validation });
  }
  if (proposal.worker_id !== undefined && proposal.worker_id !== route.selected_model_id) {
    return refusal("wrong_model_output_identity", { worker_input, route, invocation, validation });
  }

  const event = Object.freeze({
    ...proposal,
    hash: validation.proposal_hash,
    worker_id: route.selected_model_id,
  });
  const supervisor = step(state, event, { contract });
  if (supervisor.rejected !== null) {
    return refusal(`supervisor_refused:${supervisor.rejected}`, {
      worker_input,
      route,
      invocation,
      validation,
      event,
      supervisor,
    });
  }
  return result({
    status: "PROPOSAL_ACCEPTED",
    refusal: null,
    worker_input,
    route,
    invocation,
    validation,
    event,
    supervisor,
  });
}
