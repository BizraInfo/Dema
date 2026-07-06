#!/usr/bin/env node
// DEMA-VERIFIED-ANSWER-RECEIPT-CACHE-PREVIEW-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaVerifiedAnswerReceiptCachePreview,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-verified-answer-receipt-cache-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaVerifiedAnswerReceiptCachePreviewCheck() {
  // Canonical fixture: a well-formed verified-answer record input (clock injected via created_at).
  return runDemaVerifiedAnswerReceiptCachePreview({
    consent: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
    input: {
      canonical_question: "what is the ihsan floor",
      answer: "The IHSAN floor is 0.95.",
      answer_summary: "IHSAN floor = 0.95",
      source_refs: ["core/integration/constants.py"],
      source_hashes: [`sha256:${"a".repeat(64)}`],
      consent_scope: "public",
      freshness_policy: { ttl_ms: 86_400_000 },
      created_at: 1_751_800_000_000,
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaVerifiedAnswerReceiptCachePreviewCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-VERIFIED-ANSWER-RECEIPT-CACHE-PREVIEW-1A");
    console.log(`  schema: ${DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
