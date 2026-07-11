#!/usr/bin/env node
// DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A — review gate. Runs the slice proof
// loop (build → permit the matched context → block a replay) and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runRootBoundConsentEnvelopePreview,
  ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA,
  ROOT_BOUND_CONSENT_EVAL_SCHEMA,
  ROOT_BOUND_CONSENT_TRUTH_LABEL,
} from "../../packages/consent/src/root-bound-consent-envelope-preview.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical consent-context input: a C1_READ consent bound to one exact proposal,
// capability scope, payload, and root set, with an unused nonce and a future expiry.
// The caller has already hashed the underlying documents — only hashes are bound.
const CANONICAL_INPUT = {
  proposal_hash: `sha256:${"1".repeat(64)}`,
  action_class: "C1_READ",
  capability_scope_hash: `sha256:${"2".repeat(64)}`,
  payload_hash: `sha256:${"3".repeat(64)}`,
  root_set_hash: `sha256:${"4".repeat(64)}`,
  nonce: "gate-canonical-nonce",
  expires_at: "2999-01-01T00:00:00Z",
  required_phrase: "GO: dema root-bound consent envelope preview 1a",
};

export function runRootBoundConsentEnvelopePreviewCheck() {
  return runRootBoundConsentEnvelopePreview({
    input: CANONICAL_INPUT,
    now: "2026-07-11T00:00:00Z",
    usedNonces: [],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runRootBoundConsentEnvelopePreviewCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A");
    console.log(`  envelope_schema: ${ROOT_BOUND_CONSENT_ENVELOPE_SCHEMA}`);
    console.log(`  eval_schema: ${ROOT_BOUND_CONSENT_EVAL_SCHEMA}`);
    console.log(`  truth: ${ROOT_BOUND_CONSENT_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
