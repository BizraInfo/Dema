import test from "node:test";
import assert from "node:assert/strict";

import { buildConsentPlanPreview } from "../packages/consent/src/consent-planner.js";
import { buildMissionDraftPreview } from "../packages/mission/src/mission-draft.js";

// Salvaged idea (QWEN-CODE-SCREEN 2026-06-02): bound intent length to prevent
// DoS via oversized intent strings (hash/stringify/extract on MB-scale input).
// Implemented SYNC — no async ripple, no new Date(), unlike the rejected source.

const OVERSIZED_INTENT = "a".repeat(11 * 1024); // 11 KiB — over any sane bound
const NORMAL_INTENT = "Audit Downloads and send to Slack";

test("buildConsentPlanPreview rejects an oversized intent (DoS bound)", () => {
  assert.throws(
    () => buildConsentPlanPreview({ intent: OVERSIZED_INTENT }),
    /exceeds maximum length/i,
  );
});

test("buildMissionDraftPreview rejects an oversized intent (DoS bound)", () => {
  assert.throws(
    () => buildMissionDraftPreview({ intent: OVERSIZED_INTENT }),
    /exceeds maximum length/i,
  );
});

test("a normal-length intent is unaffected by the bound", () => {
  assert.doesNotThrow(() => buildConsentPlanPreview({ intent: NORMAL_INTENT }));
  assert.doesNotThrow(() =>
    buildMissionDraftPreview({ intent: NORMAL_INTENT }),
  );
});
