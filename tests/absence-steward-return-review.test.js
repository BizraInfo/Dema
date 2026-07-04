import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../packages/core/src/away-contract-verify.js";
import {
  expectedAwayContractReceiptConsent,
  writeAwayContractReceipt,
} from "../packages/core/src/away-contract-receipt.js";
import {
  ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA,
  ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL,
  ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE,
  NO_RECEIPT_STATEMENT,
  NOT_LIVE_STATEMENT,
  NOTHING_EXECUTED_STATEMENT,
  deriveAbsenceStewardReturnReview,
} from "../packages/core/src/absence-steward-return-review.js";

// ABSENCE-STEWARD-RETURN-REVIEW-CHECK-1A — deterministic post-absence review
// derivation (spec ABSENCE_STEWARD_RETURN_REVIEW_v0_1.md). The review reports;
// it never claims work. v0.1 can only emit NO_ABSENCE_RECORDED /
// REVIEW_BLOCKED / READY_BUT_NOT_STARTED / EXPIRED_BEFORE_START — the
// COMPLETE verdicts belong to future runtime slices and must be unreachable.

const LEFT_ISO = "2026-07-04T03:00:00.000Z";
const RETURNED_ISO = "2026-07-04T09:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-04-0101",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: return-review fixture",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test only",
    commit_policy: "none",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T12:00:00.000Z",
    stop_conditions: ["test failure"],
    receipt_required: true,
    review_required_on_return: true,
    ...overrides,
  };
}

async function receiptedTrio(overrides = {}) {
  const home = mkdtempSync(join(tmpdir(), "return-review-"));
  try {
    const contract = validContract(overrides);
    const validation_result = validateAwayContract(contract, { now_iso: LEFT_ISO });
    const verify_result = verifyAwayContract({ contract, validation_result }, { now_iso: LEFT_ISO });
    const written = await writeAwayContractReceipt(
      {
        contract,
        validation_result,
        verify_result,
        typed_go: expectedAwayContractReceiptConsent(verify_result),
      },
      { dema_home: home, now_iso: LEFT_ISO },
    );
    assert.equal(written.written, true);
    const receipt = JSON.parse(readFileSync(written.receipt_path, "utf8"));
    return { contract, validation_result, receipt };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function windowed(trio = {}) {
  return { ...trio, left_at_iso: LEFT_ISO, returned_at_iso: RETURNED_ISO };
}

test("receipted trio with valid window derives READY_BUT_NOT_STARTED, nothing hidden", async () => {
  const trio = await receiptedTrio();
  const review = deriveAbsenceStewardReturnReview(windowed(trio));

  assert.equal(review.schema, ABSENCE_STEWARD_RETURN_REVIEW_SCHEMA);
  assert.equal(review.truth_label, ABSENCE_STEWARD_RETURN_REVIEW_TRUTH_LABEL);
  assert.equal(review.final_verdict, "READY_BUT_NOT_STARTED");
  assert.equal(review.first_line, ABSENCE_STEWARD_RETURN_REVIEW_FIRST_LINE);
  assert.equal(review.contract_id, "away-2026-07-04-0101");
  assert.equal(review.readiness_state_before_absence, "PREVIEW_READY");
  assert.equal(review.readiness_state_after_absence, "PREVIEW_READY");
  assert.deepEqual(review.receipts_seen, [trio.receipt.receipt_hash]);
  assert.deepEqual(review.receipts_missing, []);
  assert.equal(review.executed_summary, NOTHING_EXECUTED_STATEMENT);
  assert.equal(review.model_invocations, NO_RECEIPT_STATEMENT);
  assert.equal(review.network_events, NO_RECEIPT_STATEMENT);
  assert.equal(review.wallet_events, NO_RECEIPT_STATEMENT);
  assert.equal(review.token_events, NO_RECEIPT_STATEMENT);
  assert.equal(review.runtime_statement, NOT_LIVE_STATEMENT);
});

test("no contract and no receipt derives NO_ABSENCE_RECORDED", () => {
  const review = deriveAbsenceStewardReturnReview({
    left_at_iso: LEFT_ISO,
    returned_at_iso: RETURNED_ISO,
  });
  assert.equal(review.final_verdict, "NO_ABSENCE_RECORDED");
  assert.deepEqual(review.receipts_seen, []);
});

test("contract expiring inside the window derives EXPIRED_BEFORE_START", async () => {
  const trio = await receiptedTrio();
  const review = deriveAbsenceStewardReturnReview({
    ...trio,
    left_at_iso: LEFT_ISO,
    returned_at_iso: "2026-07-04T13:00:00.000Z",
  });
  assert.equal(review.final_verdict, "EXPIRED_BEFORE_START");
  assert.ok(review.expired_items.includes("away-2026-07-04-0101"));
  assert.equal(review.readiness_state_after_absence, "EXPIRED");
});

test("laundered contract derives REVIEW_BLOCKED with refused events named", async () => {
  const trio = await receiptedTrio();
  const review = deriveAbsenceStewardReturnReview(
    windowed({
      contract: { ...JSON.parse(JSON.stringify(trio.contract)), mission_scope: "docs-only PLUS push everything" },
      validation_result: trio.validation_result,
      receipt: trio.receipt,
    }),
  );
  assert.equal(review.final_verdict, "REVIEW_BLOCKED");
  assert.ok(review.refused_events.length > 0);
});

test("invalid or inverted absence window derives REVIEW_BLOCKED", async () => {
  const trio = await receiptedTrio();

  const inverted = deriveAbsenceStewardReturnReview({
    ...trio,
    left_at_iso: RETURNED_ISO,
    returned_at_iso: LEFT_ISO,
  });
  assert.equal(inverted.final_verdict, "REVIEW_BLOCKED");
  assert.ok(inverted.refused_events.includes("absence_window_invalid"));

  const missing = deriveAbsenceStewardReturnReview({ ...trio, left_at_iso: LEFT_ISO });
  assert.equal(missing.final_verdict, "REVIEW_BLOCKED");
  assert.ok(missing.refused_events.includes("returned_at_iso_required"));
});

test("verified pair without receipt derives REVIEW_BLOCKED naming the missing receipt", () => {
  const contract = validContract();
  const validation_result = validateAwayContract(contract, { now_iso: LEFT_ISO });
  const review = deriveAbsenceStewardReturnReview(
    windowed({ contract, validation_result }),
  );
  // review_required_on_return is true but no receipt exists to review against
  assert.equal(review.final_verdict, "REVIEW_BLOCKED");
  assert.ok(review.receipts_missing.length > 0);
});

test("v0.1 can never emit COMPLETE or RETURN_REVIEW_REQUIRED verdicts", async () => {
  const trio = await receiptedTrio();
  const outputs = [
    deriveAbsenceStewardReturnReview(windowed(trio)),
    deriveAbsenceStewardReturnReview({ left_at_iso: LEFT_ISO, returned_at_iso: RETURNED_ISO }),
    deriveAbsenceStewardReturnReview({
      ...trio,
      left_at_iso: LEFT_ISO,
      returned_at_iso: "2026-07-04T13:00:00.000Z",
    }),
  ];
  for (const review of outputs) {
    assert.doesNotMatch(review.final_verdict, /COMPLETE|REQUIRED/);
  }
});

test("boundary carries the spec's 10 keys, all false, on every path", async () => {
  const trio = await receiptedTrio();
  const paths = [
    deriveAbsenceStewardReturnReview(windowed(trio)),
    deriveAbsenceStewardReturnReview({ left_at_iso: LEFT_ISO, returned_at_iso: RETURNED_ISO }),
    deriveAbsenceStewardReturnReview(windowed({ contract: null })),
  ];
  for (const review of paths) {
    assert.deepEqual(review.boundary, {
      steward_started: false,
      daemon_started: false,
      scheduler_started: false,
      task_executed: false,
      model_invoked: false,
      network_used: false,
      wallet_used: false,
      token_minted: false,
      public_urp_touched: false,
      auto_consent: false,
    });
  }
});

test("kernel source stays pure: no fs, no clock, no writer reach", () => {
  const source = readFileSync(
    new URL("../packages/core/src/absence-steward-return-review.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|fs\/promises/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)/);
  assert.doesNotMatch(source, /writeAwayContractReceipt/);
});
