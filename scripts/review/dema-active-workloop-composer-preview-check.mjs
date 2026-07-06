#!/usr/bin/env node
// DEMA-ACTIVE-WORKLOOP-COMPOSER-PREVIEW-1A — review gate. Runs the proof loop
// against a clean fixture (must PASS / proceed) and a monitor-critical fixture
// (must be blocked, stop_blocked), so the gate fails closed if either the happy
// path breaks or a hard block slips through.

import { pathToFileURL } from "node:url";

import {
  runDemaActiveWorkloopComposerPreview,
  DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE,
  DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE,
  DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
  DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
  DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/dema-active-workloop-composer-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaActiveWorkloopComposerPreviewCheck() {
  const blocked_by = [];

  const clean = runDemaActiveWorkloopComposerPreview({
    consent: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE,
    input: DEMA_ACTIVE_WORKLOOP_CANONICAL_FIXTURE,
  });
  if (!clean.ok) {
    for (const code of clean.blocked_by || []) blocked_by.push(`clean:${code}`);
  }
  if (clean.allowed_next_action !== "run_safe_task") {
    blocked_by.push(`clean:next_action_${clean.allowed_next_action}`);
  }

  const malicious = runDemaActiveWorkloopComposerPreview({
    consent: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_GO_PHRASE,
    input: DEMA_ACTIVE_WORKLOOP_MALICIOUS_FIXTURE,
  });
  if (malicious.proceed_allowed !== false) blocked_by.push("malicious_fixture_proceeded");
  if (malicious.allowed_next_action !== "stop_blocked") blocked_by.push("malicious_not_stop_blocked");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA,
    truth_label: DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL,
    content_hash: clean.content_hash ?? null,
    clean_next_action: clean.allowed_next_action ?? null,
    malicious_next_action: malicious.allowed_next_action ?? null,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaActiveWorkloopComposerPreviewCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-ACTIVE-WORKLOOP-COMPOSER-PREVIEW-1A");
    console.log(`  schema: ${DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${DEMA_ACTIVE_WORKLOOP_COMPOSER_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }
  if (!result.ok) process.exit(1);
}
