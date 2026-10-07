#!/usr/bin/env node
// DRS-FIXTURE-PUBLISHER-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDrsFixturePublisher,
  DRS_FIXTURE_PUBLISHER_SCHEMA,
  DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
  DRS_FIXTURE_PUBLISHER_GO_PHRASE,
} from "../../packages/core/src/drs-fixture-publisher.js";

const JSON_MODE = process.argv.includes("--json");

const HEX64 = (ch) => ch.repeat(64);

// Canonical gate fixture: the mission_work scenario — a fully wire-law-valid
// transcript that walks to VERIFIED_DONE yet MUST render simulated:true.
export function runDrsFixturePublisherCheck() {
  return runDrsFixturePublisher({
    consent: DRS_FIXTURE_PUBLISHER_GO_PHRASE,
    input: {
      scenario: "mission_work",
      admitted: {
        component: "node0.realm_projection.fixture",
        revision: `sha256:${HEX64("f")}`,
        contracts_digest: `sha256:${HEX64("d")}`,
        uid: 1000,
      },
      peer: { uid: 1000, pid: 1 },
      now_ms: 5000,
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDrsFixturePublisherCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DRS-FIXTURE-PUBLISHER-1A");
    console.log(`  schema: ${DRS_FIXTURE_PUBLISHER_SCHEMA}`);
    console.log(`  truth: ${DRS_FIXTURE_PUBLISHER_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
