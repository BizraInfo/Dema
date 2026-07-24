#!/usr/bin/env node
// DEMA-RECOVERY-MISSION-GATHERER-1B — review gate. Runs the proof loop against
// a clean fixture (must PASS) and a content-read-claiming fixture (must be
// REJECTED), so the gate fails closed on either regression.

import { pathToFileURL } from "node:url";

import {
  runDemaRecoveryMissionGatherer,
  DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  DEMA_RECOVERY_MISSION_GATHERER_MALICIOUS_FIXTURE,
  DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
  DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
  DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
} from "../../packages/core/src/dema-recovery-mission-gatherer.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaRecoveryMissionGathererCheck() {
  const blocked_by = [];

  const clean = runDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: DEMA_RECOVERY_MISSION_GATHERER_CANONICAL_FIXTURE,
  });
  if (!clean.ok) for (const c of clean.blocked_by || []) blocked_by.push(`clean:${c}`);
  if (clean.ok && !(Array.isArray(clean.candidates) && clean.candidates.length > 0)) {
    blocked_by.push("clean:no_candidates_produced");
  }

  const malicious = runDemaRecoveryMissionGatherer({
    consent: DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
    input: DEMA_RECOVERY_MISSION_GATHERER_MALICIOUS_FIXTURE,
  });
  if (malicious.ok) blocked_by.push("malicious_fixture_not_rejected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
    content_hash: clean.content_hash ?? null,
    candidate_count: clean.candidates?.length ?? null,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaRecoveryMissionGathererCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-RECOVERY-MISSION-GATHERER-1B");
    console.log(`  schema: ${result.schema}`);
    console.log(`  truth: ${result.truth_label}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const c of result.blocked_by || []) console.log(`    ${c}`);
  }
  if (!result.ok) process.exit(1);
}
