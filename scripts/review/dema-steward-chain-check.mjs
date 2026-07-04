#!/usr/bin/env node
// DEMA-STEWARD-CHAIN-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaStewardChain,
  DEMA_STEWARD_CHAIN_SCHEMA,
  DEMA_STEWARD_CHAIN_TRUTH_LABEL,
  DEMA_STEWARD_CHAIN_GO_PHRASE,
} from "../../packages/core/src/dema-steward-chain.js";
import { buildDemaStandPayload } from "../../packages/core/src/dema-stand.js";
import { DEMA_STAND_CANONICAL_FIXTURE } from "./dema-stand-check.mjs";

const JSON_MODE = process.argv.includes("--json");

// Deterministic canonical fixture: three real STAND payloads built for three
// consecutive UTC days, evaluated as-of the third day → IN_PROGRESS 3/7.
export function buildStewardChainCanonicalFixture() {
  const receipts = ["2026-07-01", "2026-07-02", "2026-07-03"].map((day) =>
    buildDemaStandPayload({
      ...structuredClone(DEMA_STAND_CANONICAL_FIXTURE),
      observed_at_iso: `${day}T08:00:00Z`,
      drain: "less",
    }),
  );
  return { today_utc_date: "2026-07-03", required_days: 7, receipts };
}

export function runDemaStewardChainCheck() {
  return runDemaStewardChain({
    consent: DEMA_STEWARD_CHAIN_GO_PHRASE,
    input: buildStewardChainCanonicalFixture(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaStewardChainCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-STEWARD-CHAIN-1A");
    console.log(`  schema: ${DEMA_STEWARD_CHAIN_SCHEMA}`);
    console.log(`  truth: ${DEMA_STEWARD_CHAIN_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
