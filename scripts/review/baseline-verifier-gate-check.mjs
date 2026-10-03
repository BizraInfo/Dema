#!/usr/bin/env node
// BASELINE-VERIFIER-GATE-1A — pure review gate for the restored preview kernel.

import { pathToFileURL } from "node:url";

import {
  BASELINE_VERIFIER_GATE_GO_PHRASE,
  BASELINE_VERIFIER_GATE_SCHEMA,
  BASELINE_VERIFIER_GATE_TRUTH_LABEL,
  runBaselineVerifierGate,
} from "../../packages/core/src/baseline-verifier-gate.js";
import { verifyOneEventEnvelope } from "../../packages/core/src/node0-sse-envelope-stream.js";

const JSON_MODE = process.argv.includes("--json");

export function runBaselineVerifierGateCheck() {
  const result = runBaselineVerifierGate({
    consent: BASELINE_VERIFIER_GATE_GO_PHRASE,
    input: {
      proposalText: `review ${BASELINE_VERIFIER_GATE_GO_PHRASE}`,
    },
  });
  if (!result.ok) return result;

  const blocked_by = [];
  const eventHash = verifyOneEventEnvelope(result.event, 1, null, blocked_by, "event_1");
  if (eventHash !== result.event.event_hash) blocked_by.push("event_hash_mismatch");

  return Object.freeze({
    ...result,
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runBaselineVerifierGateCheck();

  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - BASELINE-VERIFIER-GATE-1A");
    console.log(`  schema: ${BASELINE_VERIFIER_GATE_SCHEMA}`);
    console.log(`  truth: ${BASELINE_VERIFIER_GATE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
