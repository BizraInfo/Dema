#!/usr/bin/env node
// NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A — review gate. Runs the proof
// loop against a clean fixture (must PASS) and a content-read-claiming fixture
// (must be REJECTED), so the gate fails closed on either regression.

import { pathToFileURL } from "node:url";

import {
  runConsentedInventoryGathererPreview,
  CONSENTED_INVENTORY_CANONICAL_FIXTURE,
  CONSENTED_INVENTORY_MALICIOUS_FIXTURE,
  CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
  CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
  CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-consented-inventory-gatherer-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runConsentedInventoryGathererPreviewCheck() {
  const blocked_by = [];

  const clean = runConsentedInventoryGathererPreview({
    consent: CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE,
    input: CONSENTED_INVENTORY_CANONICAL_FIXTURE,
  });
  if (!clean.ok) for (const c of clean.blocked_by || []) blocked_by.push(`clean:${c}`);

  const malicious = runConsentedInventoryGathererPreview({
    consent: CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE,
    input: CONSENTED_INVENTORY_MALICIOUS_FIXTURE,
  });
  if (malicious.ok) blocked_by.push("malicious_fixture_not_rejected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: CONSENTED_INVENTORY_GATHERER_PREVIEW_SCHEMA,
    truth_label: CONSENTED_INVENTORY_GATHERER_PREVIEW_TRUTH_LABEL,
    content_hash: clean.content_hash ?? null,
    total_files: clean.total_files ?? null,
    sensitive_count: (clean.sensitive_name_candidates || []).length,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runConsentedInventoryGathererPreviewCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - NODE0-CONSENTED-INVENTORY-GATHERER-PREVIEW-1A");
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const c of result.blocked_by || []) console.log(`    ${c}`);
  }
  if (!result.ok) process.exit(1);
}
