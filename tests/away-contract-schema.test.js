import test from "node:test";
import assert from "node:assert/strict";

import {
  AWAY_CONTRACT_SCHEMA,
  AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA,
  AWAY_CONTRACT_TRUTH_LABEL,
  AWAY_CONTRACT_ACTION_CLASSES,
  AWAY_CONTRACT_NEVER_GRANTABLE_ACTIONS,
  AWAY_CONTRACT_ESCALATION_LEVELS,
  AWAY_CONTRACT_MAX_UNATTENDED_RISK_CEILING,
  AWAY_CONTRACT_REQUIRED_FIELDS,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";

// AWAY-CONTRACT-SCHEMA-1A — fail-closed shape validation only. The validator
// grants nothing and executes nothing; these tests encode that contract.

const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-03-0001",
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

test("valid minimal docs-only contract passes with hash + normalized body", () => {
  const report = validateAwayContract(validContract(), { now_iso: NOW_ISO });

  assert.equal(report.valid, true);
  assert.equal(report.rejected, false);
  assert.equal(report.schema, AWAY_CONTRACT_VALIDATION_RESULT_SCHEMA);
  assert.equal(report.truth_label, AWAY_CONTRACT_TRUTH_LABEL);
  assert.equal(report.contract_id, "away-2026-07-03-0001");
  assert.match(report.contract_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(report.blocked_by, []);
  assert.ok(report.normalized_contract);
  assert.deepEqual(
    report.normalized_contract.allowed_actions,
    [...report.normalized_contract.allowed_actions].sort(),
  );
});

test("every required field missing rejects with a field-specific code", () => {
  for (const field of AWAY_CONTRACT_REQUIRED_FIELDS) {
    const contract = validContract();
    delete contract[field];
    const report = validateAwayContract(contract, { now_iso: NOW_ISO });
    assert.equal(report.valid, false, `field ${field} should be required`);
    assert.equal(report.rejected, true);
    assert.equal(report.contract_hash, null);
    assert.equal(report.normalized_contract, null);
    assert.ok(report.blocked_by.length > 0, `field ${field} should block`);
  }
});

test("wrong schema rejects", () => {
  const report = validateAwayContract(
    validContract({ schema: "bizra.dema.other.v9" }),
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("schema_mismatch"));
});

test("non-object contract rejects, fail-closed", () => {
  for (const bad of [null, undefined, "contract", 7, []]) {
    const report = validateAwayContract(bad, { now_iso: NOW_ISO });
    assert.equal(report.valid, false);
    assert.ok(report.blocked_by.includes("contract_not_object"));
    assert.equal(report.contract_id, null);
  }
});

test("missing now_iso option rejects — clock is injected, never read", () => {
  const report = validateAwayContract(validContract(), {});
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("now_iso_required"));
});

test("past or unparseable expiry rejects", () => {
  const past = validateAwayContract(
    validContract({ expires_at: "2026-07-01T00:00:00.000Z" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(past.blocked_by.includes("expires_at_not_future"));

  const garbage = validateAwayContract(
    validContract({ expires_at: "someday" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(garbage.blocked_by.includes("expires_at_invalid"));
});

test("empty ids / scope / arrays reject", () => {
  const cases = [
    [{ contract_id: "  " }, "contract_id_missing"],
    [{ operator_id: "" }, "operator_id_missing"],
    [{ node_id: "" }, "node_id_missing"],
    [{ mission_scope: " " }, "mission_scope_missing"],
    [{ allowed_actions: [] }, "allowed_actions_empty"],
    [{ stop_conditions: [] }, "stop_conditions_empty"],
    [{ forbidden_actions: "PUSH_ALLOWED" }, "forbidden_actions_not_array"],
  ];
  for (const [override, code] of cases) {
    const report = validateAwayContract(validContract(override), { now_iso: NOW_ISO });
    assert.equal(report.valid, false, code);
    assert.ok(report.blocked_by.includes(code), `expected ${code}, got ${report.blocked_by}`);
  }
});

test("receipt_required=false and review_required_on_return=false reject", () => {
  const noReceipt = validateAwayContract(
    validContract({ receipt_required: false }),
    { now_iso: NOW_ISO },
  );
  assert.ok(noReceipt.blocked_by.includes("receipt_required_must_be_true"));

  const noReview = validateAwayContract(
    validContract({ review_required_on_return: false }),
    { now_iso: NOW_ISO },
  );
  assert.ok(noReview.blocked_by.includes("review_required_on_return_must_be_true"));
});

test("risk_ceiling above unattended threshold, negative, or non-integer rejects", () => {
  const high = validateAwayContract(
    validContract({ risk_ceiling: AWAY_CONTRACT_MAX_UNATTENDED_RISK_CEILING + 1 }),
    { now_iso: NOW_ISO },
  );
  assert.ok(high.blocked_by.includes("risk_ceiling_exceeds_unattended_max"));

  for (const bad of [-1, 1.5, "3", NaN]) {
    const report = validateAwayContract(validContract({ risk_ceiling: bad }), {
      now_iso: NOW_ISO,
    });
    assert.ok(report.blocked_by.includes("risk_ceiling_invalid"), String(bad));
  }
});

test("model/push/network policies must be exactly allowed or forbidden", () => {
  for (const field of ["model_policy", "push_policy", "network_policy"]) {
    for (const bad of ["maybe", "", "ALLOWED", true]) {
      const report = validateAwayContract(validContract({ [field]: bad }), {
        now_iso: NOW_ISO,
      });
      assert.ok(
        report.blocked_by.includes(`${field}_not_explicit`),
        `${field}=${bad} should reject`,
      );
    }
  }
});

test("never-grantable action in allowed_actions rejects even if listed", () => {
  for (const never of AWAY_CONTRACT_NEVER_GRANTABLE_ACTIONS) {
    const report = validateAwayContract(
      validContract({ allowed_actions: ["READ_ONLY", never] }),
      { now_iso: NOW_ISO },
    );
    assert.equal(report.valid, false, never);
    assert.ok(report.blocked_by.includes("never_grantable_action_requested"));
  }
});

test("unknown action class rejects", () => {
  const report = validateAwayContract(
    validContract({ allowed_actions: ["READ_ONLY", "TELEPORT"] }),
    { now_iso: NOW_ISO },
  );
  assert.ok(report.blocked_by.includes("unknown_action_class"));
});

test("allowed/forbidden overlap rejects", () => {
  const report = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "DOCS_ONLY"],
      forbidden_actions: ["DOCS_ONLY"],
    }),
    { now_iso: NOW_ISO },
  );
  assert.ok(report.blocked_by.includes("allowed_forbidden_overlap"));
});

test("action grants must not contradict explicit policies", () => {
  const push = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "PUSH_ALLOWED"],
      forbidden_actions: [],
      push_policy: "forbidden",
    }),
    { now_iso: NOW_ISO },
  );
  assert.ok(push.blocked_by.includes("push_action_conflicts_with_policy"));

  const model = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "MODEL_ALLOWED"],
      forbidden_actions: [],
      model_policy: "forbidden",
    }),
    { now_iso: NOW_ISO },
  );
  assert.ok(model.blocked_by.includes("model_action_conflicts_with_policy"));

  const net = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "NETWORK_ALLOWED"],
      forbidden_actions: [],
      network_policy: "forbidden",
    }),
    { now_iso: NOW_ISO },
  );
  assert.ok(net.blocked_by.includes("network_action_conflicts_with_policy"));
});

test("IRREVERSIBLE_ACTION validates in shape but carries a live-consent warning", () => {
  const report = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "IRREVERSIBLE_ACTION"],
      forbidden_actions: [],
    }),
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, true);
  assert.ok(
    report.warnings.includes("irreversible_action_requires_live_per_act_consent"),
  );
});

test("mobile_escalation_policy must be a defined level", () => {
  const report = validateAwayContract(
    validContract({ mobile_escalation_policy: "LEVEL_9_PANIC" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(report.blocked_by.includes("mobile_escalation_policy_invalid"));
  assert.ok(AWAY_CONTRACT_ESCALATION_LEVELS.includes("LEVEL_3_CONSENT_REQUIRED"));
});

test("contract_hash is deterministic across array order and duplicates", () => {
  const a = validateAwayContract(
    validContract({
      allowed_actions: ["DOCS_ONLY", "READ_ONLY", "TEST_ONLY"],
      stop_conditions: ["b", "a"],
    }),
    { now_iso: NOW_ISO },
  );
  const b = validateAwayContract(
    validContract({
      allowed_actions: ["READ_ONLY", "TEST_ONLY", "DOCS_ONLY", "READ_ONLY"],
      stop_conditions: ["a", "b", "a"],
    }),
    { now_iso: NOW_ISO },
  );
  assert.equal(a.valid, true);
  assert.equal(b.valid, true);
  assert.equal(a.contract_hash, b.contract_hash);
});

test("boundary is all-false on every path — validation grants and executes nothing", () => {
  const paths = [
    validateAwayContract(validContract(), { now_iso: NOW_ISO }),
    validateAwayContract(null, { now_iso: NOW_ISO }),
    validateAwayContract(validContract({ risk_ceiling: 99 }), { now_iso: NOW_ISO }),
  ];
  for (const report of paths) {
    assert.deepEqual(report.boundary, {
      execution_attempted: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
    });
  }
});

test("action-class vocabulary matches the spec exactly", () => {
  assert.deepEqual(
    [...AWAY_CONTRACT_ACTION_CLASSES].sort(),
    [
      "COMMIT_ALLOWED",
      "DOCS_ONLY",
      "IRREVERSIBLE_ACTION",
      "LOCAL_EDIT",
      "MOBILE_ESCALATION_ALLOWED",
      "MODEL_ALLOWED",
      "NETWORK_ALLOWED",
      "PUSH_ALLOWED",
      "READ_ONLY",
      "TEST_ONLY",
    ],
  );
});
