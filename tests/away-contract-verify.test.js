import test from "node:test";
import assert from "node:assert/strict";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import {
  AWAY_CONTRACT_VERIFY_RESULT_SCHEMA,
  AWAY_CONTRACT_VERIFY_TRUTH_LABEL,
  verifyAwayContract,
} from "../packages/core/src/away-contract-verify.js";

// AWAY-CONTRACT-VERIFY-1A — body-bound verification only. Verify proves the
// exact body still matches the validated body; it grants nothing, starts
// nothing, and detects laundering (forged or recomputed fields).

const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-03-0002",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: refresh stale TESTING rows",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY", "LOCAL_EDIT", "COMMIT_ALLOWED"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test · npm run check only",
    commit_policy: "local commits on the active feat branch only",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T06:00:00.000Z",
    stop_conditions: ["test failure", "unexpected file mutation"],
    receipt_required: true,
    review_required_on_return: true,
    ...overrides,
  };
}

function validatedPair(overrides = {}) {
  const contract = validContract(overrides);
  const validation_result = validateAwayContract(contract, { now_iso: NOW_ISO });
  assert.equal(validation_result.valid, true, "fixture must validate");
  return { contract, validation_result };
}

function thaw(value) {
  return JSON.parse(JSON.stringify(value));
}

test("valid contract + matching validation_result verifies, body-bound", () => {
  const report = verifyAwayContract(validatedPair(), { now_iso: NOW_ISO });

  assert.equal(report.valid, true);
  assert.equal(report.rejected, false);
  assert.equal(report.schema, AWAY_CONTRACT_VERIFY_RESULT_SCHEMA);
  assert.equal(report.truth_label, AWAY_CONTRACT_VERIFY_TRUTH_LABEL);
  assert.equal(report.contract_id, "away-2026-07-03-0002");
  assert.match(report.contract_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(report.blocked_by, []);
  assert.ok(report.verified_contract);
  assert.equal(report.verification.schema_validation_valid, true);
  assert.equal(report.verification.contract_hash_matches, true);
  assert.equal(report.verification.normalized_body_matches, true);
  assert.equal(report.verification.launder_attempt_detected, false);
  assert.equal(report.verification.receipt_required, true);
  assert.equal(report.verification.review_required_on_return, true);
});

test("missing input / contract / validation_result reject", () => {
  for (const [input, code] of [
    [null, "input_not_object"],
    [undefined, "input_not_object"],
    ["x", "input_not_object"],
    [{}, "contract_missing"],
    [{ contract: validContract() }, "validation_result_missing"],
    [{ validation_result: {} }, "contract_missing"],
  ]) {
    const report = verifyAwayContract(input, { now_iso: NOW_ISO });
    assert.equal(report.valid, false);
    assert.ok(report.blocked_by.includes(code), `expected ${code}`);
    assert.equal(report.verified_contract, null);
  }
});

test("missing now_iso rejects — clock injected, never read", () => {
  const report = verifyAwayContract(validatedPair(), {});
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("schema_validation_failed"));
});

test("invalid contract rejects even when validation_result claims valid (forged valid:true)", () => {
  const { validation_result } = validatedPair();
  const badContract = validContract({ risk_ceiling: 99 });
  const forged = { ...thaw(validation_result), valid: true, rejected: false };

  const report = verifyAwayContract(
    { contract: badContract, validation_result: forged },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("schema_validation_failed"));
  assert.equal(report.verification.launder_attempt_detected, true);
});

test("validation_result not valid / rejected:true rejects", () => {
  const { contract, validation_result } = validatedPair();
  const notValid = { ...thaw(validation_result), valid: false };
  const r1 = verifyAwayContract({ contract, validation_result: notValid }, { now_iso: NOW_ISO });
  assert.ok(r1.blocked_by.includes("validation_result_not_valid"));

  const rejectedTrue = { ...thaw(validation_result), rejected: true };
  const r2 = verifyAwayContract({ contract, validation_result: rejectedTrue }, { now_iso: NOW_ISO });
  assert.ok(r2.blocked_by.includes("validation_result_not_valid"));
});

test("wrong validation_result truth label or schema rejects", () => {
  const { contract, validation_result } = validatedPair();

  const wrongLabel = { ...thaw(validation_result), truth_label: "SOMETHING_ELSE" };
  const r1 = verifyAwayContract({ contract, validation_result: wrongLabel }, { now_iso: NOW_ISO });
  assert.ok(r1.blocked_by.includes("validation_result_truth_label_mismatch"));

  const wrongSchema = { ...thaw(validation_result), schema: "bizra.dema.other.v1" };
  const r2 = verifyAwayContract({ contract, validation_result: wrongSchema }, { now_iso: NOW_ISO });
  assert.ok(r2.blocked_by.includes("validation_result_schema_mismatch"));
});

test("missing contract_hash or normalized_contract rejects", () => {
  const { contract, validation_result } = validatedPair();

  const noHash = thaw(validation_result);
  noHash.contract_hash = null;
  const r1 = verifyAwayContract({ contract, validation_result: noHash }, { now_iso: NOW_ISO });
  assert.ok(r1.blocked_by.includes("contract_hash_missing"));

  const noBody = thaw(validation_result);
  noBody.normalized_contract = null;
  const r2 = verifyAwayContract({ contract, validation_result: noBody }, { now_iso: NOW_ISO });
  assert.ok(r2.blocked_by.includes("normalized_contract_missing"));
});

test("contract_hash mismatch rejects and flags laundering", () => {
  const { contract, validation_result } = validatedPair();
  const tampered = thaw(validation_result);
  tampered.contract_hash = "sha256:" + "0".repeat(64);

  const report = verifyAwayContract({ contract, validation_result: tampered }, { now_iso: NOW_ISO });
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("contract_hash_mismatch"));
  assert.equal(report.verification.launder_attempt_detected, true);
});

test("mutation after validation rejects (raw contract drifted from validated body)", () => {
  const { validation_result } = validatedPair();
  const mutated = validContract({ mission_scope: "docs-only PLUS push everything" });

  const report = verifyAwayContract(
    { contract: mutated, validation_result: thaw(validation_result) },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(
    report.blocked_by.includes("contract_hash_mismatch") ||
      report.blocked_by.includes("normalized_body_mismatch"),
  );
  assert.equal(report.verification.launder_attempt_detected, true);
});

test("launder: modified normalized_contract with externally recomputed hash rejects", () => {
  const { contract, validation_result } = validatedPair();
  const laundered = thaw(validation_result);
  laundered.normalized_contract.risk_ceiling = 3;
  // attacker recomputes a self-consistent hash over their modified body
  laundered.contract_hash = validateAwayContract(
    { ...thaw(contract), risk_ceiling: 3 },
    { now_iso: NOW_ISO },
  ).contract_hash;

  const report = verifyAwayContract({ contract, validation_result: laundered }, { now_iso: NOW_ISO });
  assert.equal(report.valid, false);
  assert.ok(
    report.blocked_by.includes("normalized_body_mismatch") ||
      report.blocked_by.includes("contract_hash_mismatch"),
  );
  assert.equal(report.verification.launder_attempt_detected, true);
});

test("launder: modified allowed_actions after validation rejects", () => {
  const { validation_result } = validatedPair();
  const escalated = validContract({
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY", "LOCAL_EDIT", "COMMIT_ALLOWED", "MODEL_ALLOWED"],
    forbidden_actions: ["PUSH_ALLOWED", "NETWORK_ALLOWED"],
    model_policy: "allowed",
  });

  const report = verifyAwayContract(
    { contract: escalated, validation_result: thaw(validation_result) },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.equal(report.verification.launder_attempt_detected, true);
});

test("launder: never-grantable action smuggled into contract rejects at validation layer", () => {
  const { validation_result } = validatedPair();
  const smuggled = validContract({
    allowed_actions: ["READ_ONLY", "BYPASS_CONSENT"],
    forbidden_actions: [],
  });

  const report = verifyAwayContract(
    { contract: smuggled, validation_result: thaw(validation_result) },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("schema_validation_failed"));
});

test("any true boundary key in validation_result rejects", () => {
  const { contract, validation_result } = validatedPair();
  const hot = thaw(validation_result);
  hot.boundary.execution_attempted = true;

  const report = verifyAwayContract({ contract, validation_result: hot }, { now_iso: NOW_ISO });
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("validation_result_boundary_not_all_false"));
});

test("F5 regression: empty / junk validation_result boundary rejects (not vacuously all-false)", () => {
  const { contract, validation_result } = validatedPair();
  for (const bad of [{}, { junk_key: false }]) {
    const forged = { ...thaw(validation_result), boundary: bad };
    const report = verifyAwayContract({ contract, validation_result: forged }, { now_iso: NOW_ISO });
    assert.equal(report.valid, false, JSON.stringify(bad));
    assert.ok(
      report.blocked_by.includes("validation_result_boundary_not_all_false"),
      JSON.stringify(bad),
    );
  }
});

test("deterministic: raw array reordering verifies against the original validation_result", () => {
  const { validation_result } = validatedPair();
  const reordered = validContract({
    allowed_actions: ["COMMIT_ALLOWED", "LOCAL_EDIT", "TEST_ONLY", "DOCS_ONLY", "READ_ONLY", "READ_ONLY"],
    stop_conditions: ["unexpected file mutation", "test failure"],
  });

  const report = verifyAwayContract(
    { contract: reordered, validation_result: thaw(validation_result) },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, true, report.blocked_by.join(","));
  assert.equal(report.verification.normalized_body_matches, true);
});

test("verifier boundary is all-false on every path", () => {
  const paths = [
    verifyAwayContract(validatedPair(), { now_iso: NOW_ISO }),
    verifyAwayContract(null, { now_iso: NOW_ISO }),
    verifyAwayContract(
      { contract: validContract({ risk_ceiling: 99 }), validation_result: {} },
      { now_iso: NOW_ISO },
    ),
  ];
  for (const report of paths) {
    assert.deepEqual(report.boundary, {
      execution_attempted: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      contract_started: false,
      compiler_invoked: false,
    });
  }
});
