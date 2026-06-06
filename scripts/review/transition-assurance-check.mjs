#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import {
  AGENT_KERNEL_MAX_ITERATIONS,
  AGENT_KERNEL_TRANSITION_SCHEMA_NAME,
  buildAgentKernel,
  tick,
} from "../../packages/core/src/agent-kernel.js";
import {
  MISSION_LIFECYCLE_SCHEMA,
  buildMissionTransitionContract,
  validateMissionTransitionContract,
} from "../../packages/mission/src/mission-lifecycle.js";
import { URP_LOCAL_INDEX_SCHEMA } from "../../packages/urp/src/local-index.js";
import {
  CONSENT_MARK_SHAREABLE,
  DECISION_MARK_SHAREABLE,
  buildChooseDecision,
  validateUrpChooseTransitionContract,
} from "../../packages/urp/src/choose-decision.js";

const SCHEMA = "bizra.dema.review.transition_assurance_check.v0.1";

const REQUIRED_OBJECTIVE_FLAGS = Object.freeze([
  "explicit",
  "bounded",
  "receipt_backed",
  "rare_circuit_tested",
  "human_consent_aware",
  "ihsan_aligned",
  "ci_enforced",
]);

const REQUIRED_RARE_CIRCUITS = Object.freeze([
  "invalid_kernel_refusal",
  "array_input_refusal",
  "terminal_state_refusal",
  "iteration_cap_halt",
  "missing_consent_decision_refusal",
  "missing_decision_refusal",
]);

const REQUIRED_KERNEL_CI_REFS = Object.freeze([
  "tests/agent-kernel.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
]);

const REQUIRED_MISSION_LIFECYCLE_CI_REFS = Object.freeze([
  "tests/mission-lifecycle.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
]);

const REQUIRED_URP_CHOOSE_CI_REFS = Object.freeze([
  "tests/urp-choose-decision.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
]);

const REQUIRED_CI_REFS = Object.freeze([
  ...new Set([
    ...REQUIRED_KERNEL_CI_REFS,
    ...REQUIRED_MISSION_LIFECYCLE_CI_REFS,
    ...REQUIRED_URP_CHOOSE_CI_REFS,
  ]),
]);

const SAMPLE_HASH_A = "a".repeat(64);
const SAMPLE_HASH_B = "b".repeat(64);
const SAMPLE_HASH_C = "c".repeat(64);

function kernel(overrides = {}) {
  return buildAgentKernel({
    agent_id: "transition-assurance-pat",
    mission_intent: "prove every transition contract",
    agent_role: "pat",
    ...overrides,
  });
}

function pushSample(samples, category, label, result) {
  samples.push(Object.freeze({ category, label, event: result.event }));
  return result.kernel;
}

function kernelAtConsentRequest() {
  let k = kernel();
  k = tick(k).kernel;
  k = tick(k).kernel;
  return tick(k, { proposal_summary: { schema: "sample.proposal.v0.1" } })
    .kernel;
}

function kernelAtActOrHold() {
  return tick(kernelAtConsentRequest(), { consent_decision: "granted" }).kernel;
}

function kernelAtObserve() {
  return tick(kernelAtActOrHold(), {
    act_result_summary: { schema: "sample.act.v0.1" },
  }).kernel;
}

function kernelAtDecideNext() {
  return tick(kernelAtObserve()).kernel;
}

function kernelAtComplete() {
  return tick(kernelAtDecideNext(), { decision: "complete" }).kernel;
}

function buildTransitionSamples() {
  const samples = [];

  let k = kernel();
  k = pushSample(samples, "normal", "init_to_perceive", tick(k));
  k = pushSample(samples, "normal", "perceive_to_propose", tick(k));
  k = pushSample(
    samples,
    "normal",
    "propose_to_consent_request",
    tick(k, {
      proposal_summary: { schema: "sample.proposal.v0.1", action: "draft" },
    }),
  );
  k = pushSample(
    samples,
    "normal",
    "consent_granted",
    tick(k, { consent_decision: "granted" }),
  );
  k = pushSample(
    samples,
    "normal",
    "act_or_hold_to_observe",
    tick(k, {
      act_result_summary: { schema: "sample.act.v0.1", status: "held" },
    }),
  );
  k = pushSample(samples, "normal", "observe_to_decide_next", tick(k));
  pushSample(
    samples,
    "normal",
    "decide_complete",
    tick(k, { decision: "complete" }),
  );

  pushSample(
    samples,
    "normal",
    "consent_denied",
    tick(kernelAtConsentRequest(), { consent_decision: "denied" }),
  );
  pushSample(
    samples,
    "normal",
    "decide_loop",
    tick(kernelAtDecideNext(), { decision: "loop" }),
  );

  const haltStates = Object.freeze([
    ["halt_from_init", kernel()],
    ["halt_from_perceive", tick(kernel()).kernel],
    ["halt_from_propose", tick(tick(kernel()).kernel).kernel],
    ["halt_from_consent_request", kernelAtConsentRequest()],
    ["halt_from_act_or_hold", kernelAtActOrHold()],
    ["halt_from_observe", kernelAtObserve()],
    ["halt_from_decide_next", kernelAtDecideNext()],
  ]);
  for (const [label, stateKernel] of haltStates) {
    pushSample(
      samples,
      "halt",
      label,
      tick(stateKernel, { halt: true, halt_reason: label }),
    );
  }

  pushSample(
    samples,
    "rare",
    "invalid_kernel_refusal",
    tick({ schema: "wrong.schema", current_state: "init" }),
  );
  pushSample(
    samples,
    "rare",
    "array_input_refusal",
    tick(kernelAtConsentRequest(), ["not", "an", "object"]),
  );
  pushSample(
    samples,
    "rare",
    "terminal_state_refusal",
    tick(kernelAtComplete()),
  );

  let capped = kernel({ max_iterations: 1 });
  capped = tick(capped).kernel;
  capped = tick(capped).kernel;
  capped = tick(capped, { proposal_summary: {} }).kernel;
  capped = tick(capped, { consent_decision: "granted" }).kernel;
  capped = tick(capped, { act_result_summary: {} }).kernel;
  capped = tick(capped).kernel;
  capped = tick(capped, { decision: "loop" }).kernel;
  pushSample(samples, "rare", "iteration_cap_halt", tick(capped));

  pushSample(
    samples,
    "rare",
    "missing_consent_decision_refusal",
    tick(kernelAtConsentRequest()),
  );
  pushSample(
    samples,
    "rare",
    "missing_decision_refusal",
    tick(kernelAtDecideNext()),
  );

  return samples;
}

function buildMissionLifecycleSamples() {
  const mission_id = SAMPLE_HASH_A;
  const lifecycle = Object.freeze({
    schema: MISSION_LIFECYCLE_SCHEMA,
    mission_id,
    transition_contract: buildMissionTransitionContract({
      mission_id,
      actionReceiptCount: 1,
      verificationReceiptCount: 1,
      consentProofHash: SAMPLE_HASH_C,
    }),
    action_receipt_hashes: Object.freeze([SAMPLE_HASH_B]),
    verification_receipt_hashes: Object.freeze([SAMPLE_HASH_C]),
    consent_proof_hash: SAMPLE_HASH_C,
  });

  return Object.freeze([
    Object.freeze({
      category: "mission_lifecycle",
      label: "mission_lifecycle_intent_to_closeout",
      lifecycle,
    }),
  ]);
}

function buildUrpChooseSamples() {
  const receipt = buildChooseDecision(
    {
      schema: URP_LOCAL_INDEX_SCHEMA,
      mode: "LOCAL_INDEX_ONLY",
      truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
      source_passport_hash: SAMPLE_HASH_A,
      verification_scope: "PASSPORT_ENVELOPE_AND_RECEIPTS",
      resource_class: "WORK_ARTIFACT",
      awareness_level: "A2_METADATA",
      share_status: "MARKED_LOCAL_ONLY",
      receipts_count: 1,
      artifact_hashes: Object.freeze([SAMPLE_HASH_B]),
      author_fingerprints: Object.freeze([SAMPLE_HASH_C]),
      entries: Object.freeze([
        Object.freeze({
          receipt_filename: "authorship-sample.json",
          artifact_sha256: SAMPLE_HASH_B,
          author_fingerprint: SAMPLE_HASH_C,
          truth_label: "LOCAL_AUTHORSHIP_ATTESTED",
        }),
      ]),
      indexed_at_iso: "2026-05-28T10:00:00.000Z",
      index_hash: SAMPLE_HASH_A,
    },
    {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: new Date("2026-05-28T12:00:00.000Z"),
    },
  );

  return Object.freeze([
    Object.freeze({
      category: "urp_choose",
      label: "urp_choose_mark_shareable",
      receipt,
    }),
  ]);
}

function pushFailure(failures, label, reason, detail = null) {
  failures.push({ label, reason, detail });
}

export function validateTransitionEventContract({ label, event }) {
  const failures = [];
  if (!event || typeof event !== "object") {
    pushFailure(failures, label, "event_missing");
    return failures;
  }

  const contract = event.transition_contract;
  if (!contract || typeof contract !== "object") {
    pushFailure(failures, label, "transition_contract_missing");
    return failures;
  }

  if (event.schema !== AGENT_KERNEL_TRANSITION_SCHEMA_NAME) {
    pushFailure(failures, label, "event_schema_mismatch", event.schema);
  }
  if (
    typeof event.transition_id !== "string" ||
    event.transition_id.length === 0
  ) {
    pushFailure(failures, label, "transition_id_missing");
  }
  if (contract.transition_id !== event.transition_id) {
    pushFailure(
      failures,
      label,
      "contract_transition_id_mismatch",
      contract.transition_id,
    );
  }
  if (event.audit_trail_required !== true) {
    pushFailure(failures, label, "audit_trail_required_not_true");
  }
  if (typeof event.receipt_shape_ready !== "boolean") {
    pushFailure(failures, label, "receipt_shape_ready_not_boolean");
  }

  for (const flag of REQUIRED_OBJECTIVE_FLAGS) {
    if (contract[flag] !== true) {
      pushFailure(failures, label, `${flag}_not_true`);
    }
  }

  if (contract.proof_scope !== "STRUCTURAL_PREVIEW_ONLY") {
    pushFailure(
      failures,
      label,
      "proof_scope_not_structural_preview_only",
      contract.proof_scope,
    );
  }
  if (
    typeof contract.bounds?.max_iterations !== "number" ||
    contract.bounds.max_iterations <= 0 ||
    contract.bounds.max_iterations > AGENT_KERNEL_MAX_ITERATIONS
  ) {
    pushFailure(
      failures,
      label,
      "max_iterations_out_of_bounds",
      contract.bounds?.max_iterations,
    );
  }
  if (contract.bounds?.payload_key_limit !== 20) {
    pushFailure(
      failures,
      label,
      "payload_key_limit_not_canonical",
      contract.bounds?.payload_key_limit,
    );
  }
  if (contract.receipt_backing?.event_schema !== event.schema) {
    pushFailure(
      failures,
      label,
      "receipt_backing_schema_mismatch",
      contract.receipt_backing?.event_schema,
    );
  }
  if (
    contract.receipt_backing?.receipt_shape_ready !== event.receipt_shape_ready
  ) {
    pushFailure(
      failures,
      label,
      "receipt_backing_shape_ready_mismatch",
      contract.receipt_backing?.receipt_shape_ready,
    );
  }
  if (contract.receipt_backing?.audit_trail_required !== true) {
    pushFailure(failures, label, "receipt_backing_audit_not_true");
  }
  if (contract.receipt_backing?.mint_performed !== false) {
    pushFailure(failures, label, "mint_performed_not_false");
  }
  if (contract.receipt_backing?.chain_advance_performed !== false) {
    pushFailure(failures, label, "chain_advance_performed_not_false");
  }
  if (contract.consent?.exact_string_required_for_effects !== true) {
    pushFailure(failures, label, "exact_string_consent_not_true");
  }
  if (contract.ihsan?.refusal_is_valid_proof_event !== true) {
    pushFailure(failures, label, "ihsan_refusal_proof_not_true");
  }

  for (const rareRef of REQUIRED_RARE_CIRCUITS) {
    if (!contract.rare_circuit_test_refs?.includes(rareRef)) {
      pushFailure(failures, label, "rare_circuit_ref_missing", rareRef);
    }
  }
  for (const ciRef of REQUIRED_KERNEL_CI_REFS) {
    if (!contract.ci_enforcement_refs?.includes(ciRef)) {
      pushFailure(failures, label, "ci_ref_missing", ciRef);
    }
  }

  return failures;
}

export function validateMissionLifecycleContractSample({ label, lifecycle }) {
  const failures = [];
  if (!lifecycle || typeof lifecycle !== "object" || Array.isArray(lifecycle)) {
    pushFailure(failures, label, "lifecycle_missing");
    return failures;
  }
  if (lifecycle.schema !== MISSION_LIFECYCLE_SCHEMA) {
    pushFailure(failures, label, "lifecycle_schema_mismatch", lifecycle.schema);
  }
  const contractError = validateMissionTransitionContract({ lifecycle });
  if (contractError) {
    pushFailure(failures, label, contractError);
  }
  for (const ciRef of REQUIRED_MISSION_LIFECYCLE_CI_REFS) {
    if (!lifecycle.transition_contract?.ci_enforcement_refs?.includes(ciRef)) {
      pushFailure(failures, label, "mission_lifecycle_ci_ref_missing", ciRef);
    }
  }
  return failures;
}

export function validateUrpChooseContractSample({ label, receipt }) {
  const failures = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    pushFailure(failures, label, "urp_choose_receipt_missing");
    return failures;
  }
  if (receipt.chosen !== true) {
    pushFailure(
      failures,
      label,
      "urp_choose_not_chosen",
      receipt.error ?? null,
    );
  }
  const contractError = validateUrpChooseTransitionContract({ receipt });
  if (contractError) {
    pushFailure(failures, label, contractError);
  }
  for (const ciRef of REQUIRED_URP_CHOOSE_CI_REFS) {
    if (!receipt.transition_contract?.ci_enforcement_refs?.includes(ciRef)) {
      pushFailure(failures, label, "urp_choose_ci_ref_missing", ciRef);
    }
  }
  return failures;
}

function validateTransitionSample(sample) {
  if (sample.category === "mission_lifecycle") {
    return validateMissionLifecycleContractSample(sample);
  }
  if (sample.category === "urp_choose") {
    return validateUrpChooseContractSample(sample);
  }
  return validateTransitionEventContract(sample);
}

export function buildTransitionAssuranceReport() {
  const samples = [
    ...buildTransitionSamples(),
    ...buildMissionLifecycleSamples(),
    ...buildUrpChooseSamples(),
  ];
  const sampleResults = samples.map((sample) => {
    const failures = validateTransitionSample(sample);
    return Object.freeze({
      category: sample.category,
      label: sample.label,
      transition_id:
        sample.event?.transition_id ??
        sample.lifecycle?.transition_contract?.transition_id ??
        sample.receipt?.transition_contract?.transition_id ??
        null,
      ok: failures.length === 0,
      failures: Object.freeze(failures),
    });
  });
  const failures = sampleResults.flatMap((result) => result.failures);

  return Object.freeze({
    schema: SCHEMA,
    mode: "READ_ONLY_AUDIT",
    ok: failures.length === 0,
    transitions_checked: samples.length,
    transitions_failed: sampleResults.filter((result) => !result.ok).length,
    failure_count: failures.length,
    failures: Object.freeze(failures),
    coverage: Object.freeze({
      normal_transitions: samples.filter(
        (sample) => sample.category === "normal",
      ).length,
      halt_transitions: samples.filter((sample) => sample.category === "halt")
        .length,
      rare_circuits: samples.filter((sample) => sample.category === "rare")
        .length,
      mission_lifecycle_transitions: samples.filter(
        (sample) => sample.category === "mission_lifecycle",
      ).length,
      urp_choose_transitions: samples.filter(
        (sample) => sample.category === "urp_choose",
      ).length,
      required_rare_circuit_refs: REQUIRED_RARE_CIRCUITS,
      required_ci_refs: REQUIRED_CI_REFS,
    }),
    samples: Object.freeze(sampleResults),
    boundary: Object.freeze({
      read_only_audit: true,
      runtime_execution: false,
      network_used: false,
      mutation_performed: false,
      receipt_minted: false,
      chain_advanced: false,
      ci_modified: false,
    }),
    note: "Purely samples the Dema agent-kernel, mission-lifecycle, and URP choose-decision transition surfaces and fails closed if any transition lacks the explicit/bounded/receipt-backed/rare-circuit-tested/human-consent-aware/Ihsan-aligned/CI-enforced contract.",
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = buildTransitionAssuranceReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
