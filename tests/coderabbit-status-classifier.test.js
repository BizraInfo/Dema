import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyCodeRabbitStatusText,
  isCodeRabbitCreditExhaustion,
} from "../scripts/review/coderabbit-status-classifier.mjs";

test("classifies prepaid-credit CodeRabbit failure as external skip", () => {
  const report = classifyCodeRabbitStatusText(
    "CodeRabbit\tfail\t0\t\tPrepaid credits exhausted - enable the review add-on",
  );
  assert.equal(report.ok, true);
  assert.equal(report.statuses[0].classified_state, "SKIPPED_EXTERNAL_CREDIT_EXHAUSTED");
  assert.equal(report.statuses[0].blocks_merge, false);
});

test("does not skip generic CodeRabbit failures without credit evidence", () => {
  const report = classifyCodeRabbitStatusText(
    "CodeRabbit\tfail\t0\t\tReview found unresolved blocking comments",
  );
  assert.equal(report.ok, false);
  assert.equal(report.statuses[0].classified_state, "FAILED_REVIEW_SIGNAL");
  assert.equal(report.statuses[0].blocks_merge, true);
});

test("does not treat rate-limit wording alone as credit exhaustion", () => {
  assert.equal(isCodeRabbitCreditExhaustion("Review limit reached"), false);
});

test("keeps classifier output immutable", () => {
  const report = classifyCodeRabbitStatusText(
    "CodeRabbit\tfail\t0\t\tPrepaid credits exhausted - enable the review add-on",
  );
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.statuses));
  assert.ok(Object.isFrozen(report.statuses[0]));
  assert.ok(Object.isFrozen(report.blocking_failures));
});
