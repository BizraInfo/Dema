// BIZRA-ADK-TEST-HARNESS-1A · adversarial negative tests (read-only, no execution).

import { buildAgentContract } from "./agent-contract.js";
import { validateAgentContract } from "./agent-validator.js";
import { buildAdkReceiptPreview } from "./receipt-preview.js";
import { buildPatAgentTemplate } from "./pat-template.js";
import { buildSatAgentTemplate } from "./sat-template.js";
import { AGENT_SCOPES, PRIVACY_CLASSES } from "./agent-scope.js";

export const ADK_TEST_HARNESS_SCHEMA = "bizra.dema.adk_test_harness.v0.1";

const HARNESS_BOUNDARY = Object.freeze({
  read_only: true,
  agent_execution_performed: false,
  network_used: false,
  key_generated: false,
  signing_performed: false,
  federation_started: false,
  token_minted: false,
});

function basePat(overrides = {}) {
  return buildAgentContract({
    agent_id: "harness-pat",
    serves: "mumu",
    scope: AGENT_SCOPES.PRIVATE_PAT,
    privacy_class: PRIVACY_CLASSES.PAT_RAW_LOCAL,
    truth_label: "HARNESS_FIXTURE",
    allowed_effects: ["READ_LOCAL_METADATA", "DRAFT_PATCH"],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
      "SEND_RAW_MEMORY_TO_SAT",
      "NETWORK",
      "KEY_GENERATION",
      "WRITE_FILE",
    ],
    consent_policy: "Exact GO only.",
    proof_policy: "Proof required.",
    receipt_policy: "Receipt preview required.",
    what_this_proves: "May draft locally.",
    what_this_does_not_prove: "Does not prove execution.",
    stop_by_default: true,
    ...overrides,
  });
}

function baseSat(overrides = {}) {
  return buildAgentContract({
    agent_id: "harness-sat",
    serves: "bizra_system",
    scope: AGENT_SCOPES.SYSTEM_SAT_SUMMARY,
    privacy_class: PRIVACY_CLASSES.SAT_SUMMARY_ONLY,
    truth_label: "HARNESS_FIXTURE",
    allowed_effects: ["VERIFY_RECEIPT", "REGISTER_PROOF"],
    forbidden_effects: [
      "SIGN",
      "FEDERATE",
      "MINT_TOKEN",
      "EXPORT_PRIVATE_MEMORY",
      "RECEIVE_PAT_RAW_MEMORY",
      "READ_PAT_RAW_MEMORY",
      "SEND_RAW_MEMORY_TO_SAT",
      "NETWORK",
      "KEY_GENERATION",
      "WRITE_FILE",
    ],
    consent_policy: "Proof summaries only; never raw PAT memory.",
    proof_policy: "Summary verification only.",
    receipt_policy: "Register summaries with non-claims.",
    what_this_proves: "May verify summaries.",
    what_this_does_not_prove: "Does not prove raw PAT access.",
    stop_by_default: true,
    ...overrides,
  });
}

export const ADK_ADVERSARIAL_NEGATIVE_CASES = Object.freeze([
  {
    id: "missing_scope",
    kind: "negative",
    build: () => basePat({ scope: "" }),
    expect_valid: false,
    expect_codes: ["missing_guardrail_field", "invalid_scope"],
  },
  {
    id: "stop_by_default_false",
    kind: "negative",
    build: () => basePat({ stop_by_default: false }),
    expect_valid: false,
    expect_codes: ["stop_by_default_required"],
  },
  {
    id: "sign_in_allowed",
    kind: "negative",
    build: () =>
      basePat({
        allowed_effects: ["READ_LOCAL_METADATA", "SIGN"],
      }),
    expect_valid: false,
    expect_codes: ["forbidden_effect_allowed"],
  },
  {
    id: "pat_send_raw_memory_to_sat",
    kind: "negative",
    build: () =>
      basePat({
        allowed_effects: ["READ_LOCAL_METADATA", "SEND_RAW_MEMORY_TO_SAT"],
      }),
    expect_valid: false,
    expect_codes: ["pat_sat_firewall"],
  },
  {
    id: "sat_receive_pat_raw_memory",
    kind: "negative",
    build: () =>
      baseSat({
        allowed_effects: ["VERIFY_RECEIPT", "RECEIVE_PAT_RAW_MEMORY"],
      }),
    expect_valid: false,
    expect_codes: ["pat_sat_firewall"],
  },
  {
    id: "sat_consent_authorizes_raw_pat",
    kind: "negative",
    build: () =>
      baseSat({
        consent_policy: "Operator may share raw PAT memory with this SAT agent.",
      }),
    expect_valid: false,
    expect_codes: ["pat_sat_firewall"],
  },
  {
    id: "missing_what_this_does_not_prove",
    kind: "negative",
    build: () => basePat({ what_this_does_not_prove: "" }),
    expect_valid: false,
    expect_codes: ["what_this_does_not_prove_required"],
  },
]);

export const ADK_ADVERSARIAL_POSITIVE_CASES = Object.freeze([
  {
    id: "pat_engineer_template",
    kind: "positive",
    build: () => buildPatAgentTemplate({ agent_id: "pat-engineer" }),
    expect_valid: true,
    expect_receipt_preview: true,
  },
  {
    id: "sat_verifier_template",
    kind: "positive",
    build: () => buildSatAgentTemplate({ agent_id: "sat-verifier" }),
    expect_valid: true,
    expect_receipt_preview: true,
  },
]);

function codesInclude(errors, expected) {
  const codes = new Set(errors.map((e) => e.code));
  return expected.some((code) => codes.has(code));
}

function runCase(def) {
  const contract = def.build();
  const validation = validateAgentContract(contract);
  const receipt =
    def.expect_receipt_preview === true
      ? buildAdkReceiptPreview(contract)
      : null;

  const checks = [];
  const validOk = validation.valid === def.expect_valid;
  checks.push(
    Object.freeze({
      name: "validation_verdict",
      ok: validOk,
      expected: def.expect_valid,
      actual: validation.valid,
    }),
  );

  if (def.expect_codes?.length) {
    const codesOk = !validation.valid && codesInclude(validation.errors, def.expect_codes);
    checks.push(
      Object.freeze({
        name: "expected_error_codes",
        ok: codesOk,
        expected: def.expect_codes,
        actual: validation.errors.map((e) => e.code),
      }),
    );
  }

  if (def.expect_receipt_preview === true) {
    checks.push(
      Object.freeze({
        name: "receipt_preview_built",
        ok: receipt?.built === true,
        expected: true,
        actual: receipt?.built ?? false,
      }),
    );
  }

  if (validation.valid) {
    checks.push(
      Object.freeze({
        name: "mode_define_only",
        ok: contract.mode === "define_only",
        expected: "define_only",
        actual: contract.mode,
      }),
    );
    checks.push(
      Object.freeze({
        name: "lifecycle_ends_with_stop",
        ok:
          Array.isArray(contract.lifecycle) &&
          contract.lifecycle[contract.lifecycle.length - 1] === "STOP",
        expected: "STOP",
        actual: contract.lifecycle?.[contract.lifecycle.length - 1] ?? null,
      }),
    );
  }

  const ok = checks.every((c) => c.ok);
  return Object.freeze({
    id: def.id,
    kind: def.kind,
    ok,
    checks: Object.freeze(checks),
    validation_valid: validation.valid,
  });
}

/**
 * Run built-in adversarial suite (negative must fail, positive must pass).
 */
export function runAdkAdversarialSuite() {
  const cases = [
    ...ADK_ADVERSARIAL_NEGATIVE_CASES.map(runCase),
    ...ADK_ADVERSARIAL_POSITIVE_CASES.map(runCase),
  ];
  const failed = cases.filter((c) => !c.ok);
  const verdict = failed.length === 0 ? "CLEAN" : "FAIL";

  return Object.freeze({
    schema: ADK_TEST_HARNESS_SCHEMA,
    truth_label: "ADK_AGENT_HARNESS_READ_ONLY",
    mode: "adversarial_suite",
    verdict,
    case_count: cases.length,
    failed_count: failed.length,
    cases: Object.freeze(cases),
    boundary: HARNESS_BOUNDARY,
  });
}

/**
 * Deep harness for one operator-supplied contract (validate + receipt preview gates).
 * @param {object} rawContract
 */
export function runAdkContractHarness(rawContract) {
  const validation = validateAgentContract(rawContract);
  const receipt = buildAdkReceiptPreview(rawContract);
  const checks = [
    Object.freeze({
      name: "contract_valid",
      ok: validation.valid,
      expected: true,
      actual: validation.valid,
    }),
  ];

  if (validation.valid) {
    checks.push(
      Object.freeze({
        name: "receipt_preview_built",
        ok: receipt.built === true,
        expected: true,
        actual: receipt.built,
      }),
    );
    const contract = validation.contract;
    checks.push(
      Object.freeze({
        name: "stop_by_default",
        ok: contract.stop_by_default === true,
        expected: true,
        actual: contract.stop_by_default,
      }),
    );
  }

  const ok = checks.every((c) => c.ok);
  return Object.freeze({
    schema: ADK_TEST_HARNESS_SCHEMA,
    truth_label: "ADK_AGENT_HARNESS_READ_ONLY",
    mode: "single_contract",
    verdict: ok ? "PASS" : "FAIL",
    checks: Object.freeze(checks),
    validation,
    receipt_preview: receipt,
    boundary: HARNESS_BOUNDARY,
  });
}
