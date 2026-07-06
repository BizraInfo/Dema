#!/usr/bin/env node
// NODE0-NODESPACE-BOUNDARY-PREVIEW-1A — review gate. Runs the slice proof loop
// against a clean fixture (must PASS) and a malicious fixture (must be REJECTED),
// so the gate fails closed if either the happy path breaks or a bad input slips.

import { pathToFileURL } from "node:url";

import {
  runNode0NodespaceBoundaryPreview,
  NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE,
  NODE0_NODESPACE_BOUNDARY_MALICIOUS_FIXTURE,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/node0-nodespace-boundary-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0NodespaceBoundaryPreviewCheck() {
  const blocked_by = [];

  const clean = runNode0NodespaceBoundaryPreview({
    consent: NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE,
    input: NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE,
  });
  if (!clean.ok) {
    for (const code of clean.blocked_by || []) blocked_by.push(`clean:${code}`);
  }

  const malicious = runNode0NodespaceBoundaryPreview({
    consent: NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE,
    input: NODE0_NODESPACE_BOUNDARY_MALICIOUS_FIXTURE,
  });
  if (malicious.ok) blocked_by.push("malicious_fixture_not_rejected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
    truth_label: NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
    content_hash: clean.content_hash ?? null,
    homebase_device_count: clean.homebase_device_count ?? null,
    os_count: clean.os_count ?? null,
    filesystem_root_count: clean.filesystem_root_count ?? null,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0NodespaceBoundaryPreviewCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - NODE0-NODESPACE-BOUNDARY-PREVIEW-1A");
    console.log(`  schema: ${NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
