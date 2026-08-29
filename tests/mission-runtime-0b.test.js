import test from "node:test";
import assert from "node:assert/strict";

import { buildModelBrokerPreview } from "../packages/models/src/model-broker-preview.js";
import {
  __resetInvocationFreshness,
  llmAdapterConsentPhraseFor,
} from "../packages/core/src/llm-adapter.js";
import {
  MISSION_CONTRACT_GO_PHRASE,
  buildMissionState,
  checkpointMissionState,
  createMissionContract,
} from "../packages/core/src/mission-contract-state.js";
import {
  EVENT_KINDS,
  genesisSupervisorState,
  step,
} from "../packages/core/src/mission-supervisor.js";
import { conductOneShotWorkerTurn } from "../packages/core/src/mission-runtime-0b.js";

const MODEL = "qwen2.5:7b";
const CONTRACT_FIELDS = Object.freeze({
  mission_id: "MISSION-0B-TEST",
  purpose: "Propose one bounded plan",
  scope: "sandbox only",
  acceptance_contract: { required_output_keys: ["artifact"] },
  acceptance_criteria: ["artifact named"],
  prohibited_outcomes: ["external write"],
  authority_ceiling: "local_reversible",
  iteration_budget: 2,
  completion_conditions: ["plan proposed"],
  escalation_rule: "halt_and_report",
  created_at_iso: "2026-08-29T00:00:00.000Z",
});
function broker(model = MODEL) {
  return buildModelBrokerPreview({
    registry: [{
      id: model,
      provider: "ollama",
      model_name: model,
      role: "pat_worker",
      size_class: "7B",
      locality: "local",
      allowed_tasks: ["planning"],
      max_concurrency: 1,
      context_limit: 8192,
      status: "active",
    }],
  });
}

function planFixture() {
  const created = createMissionContract({
    fields: CONTRACT_FIELDS,
    consent: MISSION_CONTRACT_GO_PHRASE,
  });
  let state = genesisSupervisorState(created);
  state = step(state, {
    kind: EVENT_KINDS.DISCOVERY_RECORDED,
    stage: "DISCOVER",
    hash: "sha256:discover",
  }, { contract: created.contract }).state;
  const advanced = step(state, {
    kind: EVENT_KINDS.CONTRACT_FROZEN,
    stage: "CONTRACT",
    hash: "sha256:contract",
  }, { contract: created.contract });
  state = advanced.state;
  const missionState = buildMissionState({
    accepted_evidence: [{ required_output: { artifact: "one short name" } }],
    contract_hash: created.contract_hash,
    current_stage: state.stage,
    failed_attempts: [],
    iteration_used: state.iteration_used,
    open_blockers: [],
    receipt_head: state.receipt_head,
    state_seq: state.state_seq,
    worker_history: [],
  });
  return {
    contract: created.contract,
    state,
    checkpoint: checkpointMissionState(missionState),
    eligibleActions: advanced.eligible_actions,
  };
}

function response(body, { status = 200 } = {}) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Unavailable",
    headers: { get: () => "application/json" },
    json: async () => ({ response: typeof body === "string" ? body : JSON.stringify(body), done: true }),
  });
}

function proposal(extra = {}) {
  return {
    kind: EVENT_KINDS.PLAN_PROPOSED,
    stage: "PLAN",
    hash: "sha256:model-proposal",
    ...extra,
  };
}

async function conduct(overrides = {}) {
  __resetInvocationFreshness();
  const fixture = planFixture();
  return conductOneShotWorkerTurn({
    ...fixture,
    broker: broker(),
    taskKind: "planning",
    requiredRole: "pat_worker",
    expectedModelId: MODEL,
    invokeConsent: llmAdapterConsentPhraseFor(MODEL),
    fetchImpl: response(proposal()),
    timeoutMs: 20,
    ...overrides,
  });
}

test("0B composes the existing worker, broker, invocation, validator, and supervisor without crossing FATE", async () => {
  const result = await conduct();
  assert.equal(result.status, "PROPOSAL_ACCEPTED");
  assert.equal(result.supervisor.state.stage, "FATE");
  assert.equal(result.supervisor.state.authority_delta, 0);
  assert.equal(result.event.worker_id, MODEL);
  assert.equal(result.event.hash, result.validation.proposal_hash);
  assert.deepEqual(Object.keys(result.worker_input).sort(), ["checkpoint", "eligible_actions"]);
  assert.equal(result.route.local_only, true);
  assert.equal(result.invocation.boundary.remote_provider, false);
  assert.equal(result.invocation.boundary.federation, false);
  assert.equal(result.invocation.boundary.mint, false);
});

test("0B tells the worker the exact eligible action, stage, and evidence-bound output", async () => {
  let prompt = "";
  const fetchImpl = async (_url, options) => {
    prompt = JSON.parse(options.body).prompt;
    return response(proposal())();
  };
  const result = await conduct({ fetchImpl });
  assert.equal(result.status, "PROPOSAL_ACCEPTED");
  assert.match(prompt, /Set kind exactly to "plan_proposed"\./);
  assert.match(prompt, /Set stage exactly to "PLAN"\./);
  assert.match(prompt, /Required keys: kind, stage, hash, output\./);
  assert.match(prompt, /Set output to an object matching this template: \{"artifact":"one short name"\}/);
  assert.match(prompt, /Do not copy checkpoint, snapshot, or accepted_evidence into output\./);
  assert.match(prompt, /replace every candidate-path placeholder with an exact value from that candidates list/);
});

for (const field of ["contract_hash", "scope", "verdict", "authority"]) {
  test(`0B refuses model-carried ${field} before proposal hashing`, async () => {
    const result = await conduct({ fetchImpl: response(proposal({ [field]: "smuggled" })) });
    assert.equal(result.status, "REFUSED");
    assert.equal(result.refusal, `forbidden_proposal_field:${field}`);
    assert.equal(result.validation.hash_computed, false);
  });
}

test("0B refuses malformed and truncated model output", async () => {
  const malformed = await conduct({ fetchImpl: response("not-json") });
  assert.equal(malformed.refusal, "model_output_not_json");
  const long = JSON.stringify(proposal({ note: "x".repeat(600) }));
  const truncated = await conduct({ fetchImpl: response(long) });
  assert.equal(truncated.refusal, "model_output_truncated");
});

test("0B refuses wrong model and wrong exact consent before accepting a proposal", async () => {
  const wrongModel = await conduct({ expectedModelId: "llama3.1:8b" });
  assert.equal(wrongModel.refusal, "wrong_model_selected");
  assert.equal(wrongModel.invocation, null);
  const wrongConsent = await conduct({ invokeConsent: "GO: almost" });
  assert.equal(wrongConsent.refusal, "consent_phrase_mismatch");
});

test("0B reports provider failure and timeout as bounded refusals", async () => {
  const unavailable = await conduct({ fetchImpl: response("", { status: 503 }) });
  assert.equal(unavailable.refusal, "model_invocation_failed");
  const timeoutFetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
  const timeout = await conduct({ fetchImpl: timeoutFetch, timeoutMs: 1 });
  assert.equal(timeout.refusal, "model_invocation_timeout");
});

test("0B refuses consent replay and a stale checkpoint", async () => {
  __resetInvocationFreshness();
  const fixture = planFixture();
  const args = {
    ...fixture,
    broker: broker(),
    taskKind: "planning",
    requiredRole: "pat_worker",
    expectedModelId: MODEL,
    invokeConsent: llmAdapterConsentPhraseFor(MODEL),
    fetchImpl: response(proposal()),
  };
  assert.equal((await conductOneShotWorkerTurn(args)).status, "PROPOSAL_ACCEPTED");
  assert.equal((await conductOneShotWorkerTurn(args)).refusal, "consent_replayed");

  const stale = await conduct({
    checkpoint: {
      ...fixture.checkpoint,
      snapshot: { ...fixture.checkpoint.snapshot, current_stage: "EXECUTE" },
    },
  });
  assert.equal(stale.refusal, "stale_checkpoint");
  assert.equal(stale.invocation, null);
});
