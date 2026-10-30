import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  DEEPSEEK_V41_FLASH_ADMIT_SCHEMA,
  DEEPSEEK_V41_FLASH_ADMIT_TRUTH_LABEL,
  SOURCE_PDF,
  ADMIT_STATUS,
  WEIGHTS_FETCH_REQUIRES,
  buildDeepseekV41FlashAdmitPreview,
  refuseWeightsFetch,
  verifyDeepseekV41FlashAdmitPreview,
  runDeepseekV41FlashAdmitGate,
} from "../packages/core/src/deepseek-v41-flash-admit-preview.js";

test("admit preview is MAP_CANDIDATE with authority_delta 0 and no weights", () => {
  const admit = buildDeepseekV41FlashAdmitPreview({ human_go: "GO" });
  assert.equal(admit.schema, DEEPSEEK_V41_FLASH_ADMIT_SCHEMA);
  assert.equal(admit.truth_label, DEEPSEEK_V41_FLASH_ADMIT_TRUTH_LABEL);
  assert.equal(admit.admit_status, ADMIT_STATUS);
  assert.equal(admit.authority_delta, 0);
  assert.equal(admit.weights.fetched, false);
  assert.equal(admit.weights.invoke_allowed, false);
  assert.equal(admit.source_pdf.sha256, SOURCE_PDF.sha256);
  assert.equal(admit.paper_claims.global_kv_bytes_per_token, 890);
  assert.ok(admit.kv_estate.bounded_replay);
  assert.match(admit.admit_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(admit), true);
});

test("verify + gate pass; forged weights_fetched fails", () => {
  const run = runDeepseekV41FlashAdmitGate({ human_go: "GO" });
  assert.equal(run.ok, true);
  const forged = {
    ...run.admit,
    weights: { ...run.admit.weights, fetched: true },
  };
  assert.equal(verifyDeepseekV41FlashAdmitPreview(forged).ok, false);
});

test("weights fetch refuses without exact GO phrase; phrase still does not download", () => {
  assert.equal(refuseWeightsFetch("GO").ok, false);
  assert.equal(refuseWeightsFetch("GO").reason, "CONSENT_MISSING_OR_MISMATCH");
  const matched = refuseWeightsFetch(WEIGHTS_FETCH_REQUIRES);
  assert.equal(matched.fetched, false);
  assert.match(matched.reason, /NOT_IMPLEMENTED/);
});

test("source PDF still present on disk (existence only — content not re-hashed here)", () => {
  assert.equal(existsSync(SOURCE_PDF.path_declared), true);
});
