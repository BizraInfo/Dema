#!/usr/bin/env node
// LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A — review gate.
// Binds one already-produced local-model invocation result into the Pulse evidence
// lane as suggestion-only data. No model invocation. No network.

import { pathToFileURL } from "node:url";

import {
  runLocalModelPulseBindingPreview,
  buildLocalModelPulseBindingPreviewPayload,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL,
  LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/local-model-pulse-binding-preview.js";
import { exampleCompletedInvocationResult } from "./local-model-pulse-binding-fixtures.mjs";

const JSON_MODE = process.argv.includes("--json");
const H = (c) => `sha256:${c.repeat(64)}`;

export function runLocalModelPulseBindingPreviewCheck() {
  return runLocalModelPulseBindingPreview({
    consent: LOCAL_MODEL_PULSE_BINDING_PREVIEW_GO_PHRASE,
    input: {
      mission_id: "review-local-model-pulse-binding-1a",
      pulse_receipt_ref: H("a"),
      invocation_result: exampleCompletedInvocationResult(),
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runLocalModelPulseBindingPreviewCheck();
  const payload = buildLocalModelPulseBindingPreviewPayload({
    mission_id: "review-local-model-pulse-binding-1a",
    pulse_receipt_ref: H("a"),
    invocation_result: exampleCompletedInvocationResult(),
  });
  const boundaryAllFalse = Object.values(result.boundary || {}).every((v) => v === false);
  const ok = result.ok === true && result.action_allowed === false && boundaryAllFalse;

  if (JSON_MODE) {
    console.log(JSON.stringify({
      schema: result.schema,
      truth_label: result.truth_label,
      preview_only: true,
      ok,
      status: result.status,
      suggestion_admissible: result.suggestion_admissible,
      source_invocation_ref: result.source_invocation_ref,
      content_hash: result.content_hash,
      payload_content_hash: payload.content_hash,
      action_allowed: result.action_allowed,
      authority_delta: result.authority_delta,
      mint_allowed: result.mint_allowed,
      wallet_used: result.wallet_used,
      federation_live: result.federation_live,
      boundary_all_false: boundaryAllFalse,
      blocked_by: result.blocked_by,
    }, null, 2));
  } else {
    console.log("DEMA - LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A");
    console.log(`  schema: ${LOCAL_MODEL_PULSE_BINDING_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${LOCAL_MODEL_PULSE_BINDING_PREVIEW_TRUTH_LABEL}`);
    console.log(`  status: ${result.status}`);
    console.log(`  suggestion_admissible: ${result.suggestion_admissible}`);
    console.log(`  content_hash: ${result.content_hash}`);
    console.log(`  action_allowed: ${result.action_allowed} | authority_delta: ${result.authority_delta}`);
    console.log(`  boundary_all_false: ${boundaryAllFalse}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}`);
    if (!ok) for (const code of result.blocked_by || []) console.log(`    ${code}`);
  }

  if (!ok) process.exit(1);
}
