#!/usr/bin/env node
// AWAY-CONTRACT-1A — review gate. Runs the slice proof loop deterministically:
// compile → validate → body-bound verify → launder-reject probe → consent
// phrase derivation. Read-only: no DEMA_HOME write, no receipt, no Away Mode.

import { pathToFileURL } from "node:url";

import { compileAwayContractIntent } from "../../packages/core/src/away-contract-compiler.js";
import { validateAwayContract } from "../../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../../packages/core/src/away-contract-verify.js";
import { expectedAwayContractReceiptConsent } from "../../packages/core/src/away-contract-receipt.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture: docs-only stewardship window. Fixed act-time + expiry keep
// the whole loop deterministic (the kernels never read the clock).
const NOW_ISO = "2026-07-03T22:00:00.000Z";
const FIXTURE_INTENT = Object.freeze({
  operator_id: "gate-fixture-operator",
  node_id: "NODE0",
  mission_scope: "docs-only: away-contract gate fixture",
  allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY"],
  forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
  data_scope: "repo:docs/**",
  model_policy: "forbidden",
  tool_policy: "npm test only",
  commit_policy: "no commits in fixture window",
  push_policy: "forbidden",
  network_policy: "forbidden",
  mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
  risk_ceiling: 1,
  expires_at: "2026-07-04T06:00:00.000Z",
  stop_conditions: ["test failure", "unexpected file mutation"],
  receipt_required: true,
  review_required_on_return: true,
});

export function runAwayContractCheck() {
  const blocked_by = [];

  const compiled = compileAwayContractIntent(FIXTURE_INTENT, { now_iso: NOW_ISO });
  if (!compiled.compiled) blocked_by.push("gate_compile_failed");

  const verify = compiled.compiled
    ? verifyAwayContract(
        { contract: compiled.contract, validation_result: compiled.validation_result },
        { now_iso: NOW_ISO },
      )
    : null;
  if (!verify?.valid) blocked_by.push("gate_verify_failed");

  // Launder probe: a drifted contract against the original validation_result
  // must reject AND be flagged as a launder attempt.
  if (compiled.compiled) {
    const drifted = validateAwayContract(
      { ...compiled.contract, mission_scope: "docs-only PLUS push everything" },
      { now_iso: NOW_ISO },
    );
    const launder = verifyAwayContract(
      {
        contract: { ...compiled.contract, mission_scope: "docs-only PLUS push everything" },
        validation_result: compiled.validation_result,
      },
      { now_iso: NOW_ISO },
    );
    if (drifted.valid !== true) blocked_by.push("gate_drift_fixture_invalid");
    if (launder.valid !== false || !launder.verification.launder_attempt_detected) {
      blocked_by.push("gate_launder_probe_not_rejected");
    }
  }

  let consent_phrase = null;
  if (verify?.valid) {
    consent_phrase = expectedAwayContractReceiptConsent(verify);
    if (!consent_phrase.startsWith("GO: write away-contract receipt ")) {
      blocked_by.push("gate_consent_phrase_shape_unexpected");
    }
  }

  return Object.freeze({
    schema: "bizra.dema.review.away_contract_check.v0.1",
    truth_label: "AWAY_CONTRACT_GATE_LOCAL_ONLY",
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    contract_id: compiled.contract_id,
    contract_hash: compiled.contract_hash,
    consent_phrase_shape_ok: consent_phrase !== null,
    boundary: Object.freeze({
      execution_attempted: false,
      contract_started: false,
      receipt_written: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
    }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runAwayContractCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - AWAY-CONTRACT-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
