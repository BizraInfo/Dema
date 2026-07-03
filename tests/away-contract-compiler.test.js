import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import {
  AWAY_CONTRACT_COMPILER_RESULT_SCHEMA,
  AWAY_CONTRACT_COMPILER_TRUTH_LABEL,
  compileAwayContractIntent,
} from "../packages/core/src/away-contract-compiler.js";

// AWAY-CONTRACT-COMPILER-1A — compilation only. The compiler drafts a contract
// body from structured intent; schema validates; verifier binds; receipt
// records consent. None of them starts work.

const NOW_ISO = "2026-07-03T22:00:00.000Z";

function validIntent(overrides = {}) {
  return {
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

test("valid docs-only intent compiles into a valid contract with validation attached", () => {
  const result = compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO });

  assert.equal(result.compiled, true, result.blocked_by.join(","));
  assert.equal(result.rejected, false);
  assert.equal(result.schema, AWAY_CONTRACT_COMPILER_RESULT_SCHEMA);
  assert.equal(result.truth_label, AWAY_CONTRACT_COMPILER_TRUTH_LABEL);
  assert.ok(result.contract);
  assert.equal(result.contract.schema, AWAY_CONTRACT_SCHEMA);
  assert.ok(result.contract_id);
  assert.match(result.contract_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.validation_result.valid, true);
  assert.equal(result.contract_hash, result.validation_result.contract_hash);
});

test("compiled contract re-validates independently (output compatibility)", () => {
  const result = compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO });
  const revalidated = validateAwayContract(result.contract, { now_iso: NOW_ISO });
  assert.equal(revalidated.valid, true);
  assert.equal(revalidated.contract_hash, result.contract_hash);
});

test("missing intent / missing now_iso reject", () => {
  for (const bad of [null, undefined, "intent", 4, []]) {
    const result = compileAwayContractIntent(bad, { now_iso: NOW_ISO });
    assert.equal(result.compiled, false);
    assert.ok(result.blocked_by.includes("intent_not_object"));
    assert.equal(result.contract, null);
  }
  const noNow = compileAwayContractIntent(validIntent(), {});
  assert.equal(noNow.compiled, false);
  assert.ok(noNow.blocked_by.includes("now_iso_missing"));
});

test("injected now_iso controls the outcome — no wall clock read", () => {
  const intent = validIntent({ expires_at: "2026-07-03T21:00:00.000Z" });
  const late = compileAwayContractIntent(intent, { now_iso: NOW_ISO });
  assert.equal(late.compiled, false);
  assert.ok(late.blocked_by.includes("compiled_contract_invalid"));

  const early = compileAwayContractIntent(intent, {
    now_iso: "2026-07-03T20:00:00.000Z",
  });
  assert.equal(early.compiled, true);
});

test("contract_id and hash are deterministic for same intent + now_iso", () => {
  const a = compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO });
  const b = compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO });
  assert.equal(a.contract_id, b.contract_id);
  assert.equal(a.contract_hash, b.contract_hash);
  assert.match(a.contract_id, /^away-[a-f0-9]{12}$/);
});

test("changed mission_scope or allowed_actions changes contract_id and hash", () => {
  const base = compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO });
  const scope = compileAwayContractIntent(
    validIntent({ mission_scope: "docs-only: different mission" }),
    { now_iso: NOW_ISO },
  );
  const actions = compileAwayContractIntent(
    validIntent({ allowed_actions: ["READ_ONLY", "DOCS_ONLY"] }),
    { now_iso: NOW_ISO },
  );
  assert.notEqual(base.contract_id, scope.contract_id);
  assert.notEqual(base.contract_hash, scope.contract_hash);
  assert.notEqual(base.contract_id, actions.contract_id);
  assert.notEqual(base.contract_hash, actions.contract_hash);
});

test("custom safe prefix is honored; unsafe prefix rejects", () => {
  const custom = compileAwayContractIntent(validIntent(), {
    now_iso: NOW_ISO,
    contract_id_prefix: "away-docs",
  });
  assert.equal(custom.compiled, true);
  assert.match(custom.contract_id, /^away-docs-[a-f0-9]{12}$/);

  for (const evil of ["../up", "a/b", "a b", ".hidden", ""]) {
    const result = compileAwayContractIntent(validIntent(), {
      now_iso: NOW_ISO,
      contract_id_prefix: evil,
    });
    assert.equal(result.compiled, false, evil);
    assert.ok(result.blocked_by.includes("unsafe_contract_id_prefix"), evil);
  }
});

test("never-grantable action and over-ceiling risk reject through validation", () => {
  const smuggled = compileAwayContractIntent(
    validIntent({ allowed_actions: ["READ_ONLY", "BYPASS_CONSENT"], forbidden_actions: [] }),
    { now_iso: NOW_ISO },
  );
  assert.equal(smuggled.compiled, false);
  assert.ok(smuggled.blocked_by.includes("compiled_contract_invalid"));
  assert.ok(
    smuggled.validation_result.blocked_by.includes("never_grantable_action_requested"),
  );

  const risky = compileAwayContractIntent(validIntent({ risk_ceiling: 99 }), {
    now_iso: NOW_ISO,
  });
  assert.equal(risky.compiled, false);
  assert.ok(
    risky.validation_result.blocked_by.includes("risk_ceiling_exceeds_unattended_max"),
  );
});

test("explicit receipt_required:false or review_required_on_return:false rejects — never silently flipped", () => {
  const noReceipt = compileAwayContractIntent(validIntent({ receipt_required: false }), {
    now_iso: NOW_ISO,
  });
  assert.equal(noReceipt.compiled, false);
  assert.ok(
    noReceipt.validation_result.blocked_by.includes("receipt_required_must_be_true"),
  );

  const noReview = compileAwayContractIntent(
    validIntent({ review_required_on_return: false }),
    { now_iso: NOW_ISO },
  );
  assert.equal(noReview.compiled, false);
  assert.ok(
    noReview.validation_result.blocked_by.includes("review_required_on_return_must_be_true"),
  );
});

test("omitted receipt/review fields default to true in the draft", () => {
  const intent = validIntent();
  delete intent.receipt_required;
  delete intent.review_required_on_return;
  const result = compileAwayContractIntent(intent, { now_iso: NOW_ISO });
  assert.equal(result.compiled, true);
  assert.equal(result.contract.receipt_required, true);
  assert.equal(result.contract.review_required_on_return, true);
});

test("explicit policies are preserved verbatim — never inferred from allowed_actions", () => {
  const result = compileAwayContractIntent(
    validIntent({
      allowed_actions: ["READ_ONLY", "DOCS_ONLY", "MODEL_ALLOWED"],
      forbidden_actions: [],
      model_policy: "allowed",
    }),
    { now_iso: NOW_ISO },
  );
  assert.equal(result.compiled, true);
  assert.equal(result.contract.model_policy, "allowed");
  assert.equal(result.contract.push_policy, "forbidden");
  assert.equal(result.contract.network_policy, "forbidden");
});

test("IRREVERSIBLE_ACTION compiles with the live-consent warning, never as authorization", () => {
  const result = compileAwayContractIntent(
    validIntent({
      allowed_actions: ["READ_ONLY", "IRREVERSIBLE_ACTION"],
      forbidden_actions: [],
    }),
    { now_iso: NOW_ISO },
  );
  assert.equal(result.compiled, true);
  assert.ok(
    result.warnings.includes("irreversible_action_requires_live_per_act_consent"),
  );
});

test("unknown intent fields are ignored with a warning, not compiled in", () => {
  const result = compileAwayContractIntent(
    validIntent({ auto_start: true, wallet: "0xabc" }),
    { now_iso: NOW_ISO },
  );
  assert.equal(result.compiled, true);
  assert.ok(result.warnings.includes("unknown_intent_fields_ignored"));
  assert.equal("auto_start" in result.contract, false);
  assert.equal("wallet" in result.contract, false);
});

test("compiler boundary is all-false on every path", () => {
  const paths = [
    compileAwayContractIntent(validIntent(), { now_iso: NOW_ISO }),
    compileAwayContractIntent(null, { now_iso: NOW_ISO }),
    compileAwayContractIntent(validIntent({ risk_ceiling: 99 }), { now_iso: NOW_ISO }),
  ];
  for (const result of paths) {
    assert.deepEqual(result.boundary, {
      execution_attempted: false,
      contract_started: false,
      receipt_written: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
      external_policy_compiled: false,
    });
  }
});

test("compiler source has no fs / receipt-writer / verifier reach — drafts only", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../packages/core/src/away-contract-compiler.js", import.meta.url)),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|fs\/promises/);
  assert.doesNotMatch(source, /away-contract-receipt/);
  assert.doesNotMatch(source, /away-contract-verify/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)/);
});
