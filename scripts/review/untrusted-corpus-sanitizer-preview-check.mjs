#!/usr/bin/env node
// UNTRUSTED-CORPUS-SANITIZER-PREVIEW-1A — review gate. Runs the Layer -1 gate on the REAL attack that
// motivated it (a pasted transcript carrying a synthetic secret + an injection payload) and proves the
// gate ran correctly and returned BLOCKED.

import { pathToFileURL } from "node:url";

import {
  runUntrustedCorpusSanitizerPreview,
  untrustedCorpusSanitizerPreviewBoundary,
  exampleAttackText,
  UNTRUSTED_CORPUS_SANITIZER_PREVIEW_SCHEMA,
  UNTRUSTED_CORPUS_SANITIZER_PREVIEW_TRUTH_LABEL,
  UNTRUSTED_CORPUS_SANITIZER_PREVIEW_GO_PHRASE,
} from "../../packages/core/src/untrusted-corpus-sanitizer-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runUntrustedCorpusSanitizerPreviewCheck() {
  return runUntrustedCorpusSanitizerPreview({
    consent: UNTRUSTED_CORPUS_SANITIZER_PREVIEW_GO_PHRASE,
    input: { text: exampleAttackText(), source: "pasted-third-party-ai-transcript" },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runUntrustedCorpusSanitizerPreviewCheck();
  const boundaryAllFalse = Object.values(untrustedCorpusSanitizerPreviewBoundary()).every((v) => v === false);
  // The gate ran correctly AND correctly refused the attack.
  const caughtAttack = result.verdict === "BLOCKED" && result.injection_count > 0 && result.secret_count > 0;
  const ok = result.ok && caughtAttack;

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          schema: result.schema,
          truth_label: result.truth_label,
          preview_only: true,
          status: result.status,
          gate_ran_ok: result.ok,
          caught_attack: caughtAttack,
          verdict: result.verdict,
          ingest_allowed: result.ingest_allowed,
          ingest_performed: result.ingest_performed,
          secret_count: result.secret_count,
          injection_count: result.injection_count,
          authority_count: result.authority_count,
          boundary_all_false: boundaryAllFalse,
          mint_allowed: result.mint_allowed,
          authority_delta: result.authority_delta,
          what_this_proves: result.what_this_proves,
          what_this_does_not_prove: result.what_this_does_not_prove,
          blocked_by: result.blocked_by,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("DEMA - UNTRUSTED-CORPUS-SANITIZER-PREVIEW-1A (PREVIEW_ONLY · Layer -1 corpus safety gate)");
    console.log(`  schema: ${UNTRUSTED_CORPUS_SANITIZER_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${UNTRUSTED_CORPUS_SANITIZER_PREVIEW_TRUTH_LABEL}`);
    console.log(`  gate ran: ${result.status} | VERDICT: ${result.verdict} | ingest_allowed: ${result.ingest_allowed}`);
    console.log(`  caught: ${result.secret_count} secret(s) · ${result.injection_count} injection(s) · ${result.authority_count} authority-escalation(s)`);
    console.log(`  boundary_all_false: ${boundaryAllFalse} | ingest_performed: ${result.ingest_performed} | mint_allowed: ${result.mint_allowed}`);
    console.log(`  result: ${ok ? "PASS" : "FAIL"}${caughtAttack ? " (attack correctly BLOCKED)" : ""}`);
    if (!ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
      if (!caughtAttack) console.log("    attack_not_caught");
    }
  }

  if (!ok) process.exit(1);
}
