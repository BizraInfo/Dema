#!/usr/bin/env node
// DEMA-RECOVERY-MISSION-ENGINE-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDemaRecoveryMissionEngine,
  makeDemaRecoveryMissionEvent,
  reconstructRecoveryCandidates,
  DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID,
  DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
  DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
  DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE,
} from "../../packages/core/src/dema-recovery-mission-engine.js";

const JSON_MODE = process.argv.includes("--json");

// Canonical fixture: a valid declare -> reconstruct -> await -> revive ->
// worker -> verifier(PASS) chain reaching SEALED. Independent verifier,
// human-chosen asset actually used — the gate proves the full guarded path,
// not just a fragment of it.
function buildFixtureEvents() {
  const sourceBoundary = { roots: ["root_a"], exclusions: [] };
  const reconstructed = reconstructRecoveryCandidates({
    evidence: [
      {
        asset_id: "a1",
        root: "root_a",
        ref: "root_a/img1.jpg",
        best_evidence_time: "2019-05-01T00:00:00Z",
        relevance: 9,
        limitations: "low-res thumbnail only",
        claim: "photo taken May 2019",
      },
    ],
    source_boundary: sourceBoundary,
  });

  const specs = [
    [
      "MISSION_DECLARED",
      {
        mission_id: "recover-2019-family-photos",
        objective_text: "Recover 2019 family photo set referenced in the chat export",
        source_boundary: sourceBoundary,
        success_definition: "human confirms the recovered photo matches the described memory",
      },
    ],
    [
      "RECONSTRUCTED",
      {
        consent_id: "consent-001",
        chronology: reconstructed.chronology,
        contradiction_map: reconstructed.contradiction_map,
        candidates: reconstructed.candidates,
        not_accessed_report: reconstructed.not_accessed_report,
      },
    ],
    ["AWAIT_HUMAN", {}],
    ["HUMAN_REVIVAL", { chosen_asset_id: "a1" }],
    ["WORKER_RESULT", { worker_id: "worker-1", result_ref: "local://out/a1-restored.jpg" }],
    ["VERIFIER_VERDICT", { verifier_id: "verifier-1", verdict: "PASS", used_asset_id: "a1" }],
  ];

  const events = [];
  let prev = DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID;
  for (const [kind, payload] of specs) {
    const event = makeDemaRecoveryMissionEvent({ seq: events.length + 1, kind, payload, prev_event: prev });
    events.push(event);
    prev = event.event_id;
  }
  return events;
}

export function runDemaRecoveryMissionEngineCheck() {
  return runDemaRecoveryMissionEngine({
    consent: DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE,
    input: { events: buildFixtureEvents() },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaRecoveryMissionEngineCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DEMA-RECOVERY-MISSION-ENGINE-1A");
    console.log(`  schema: ${DEMA_RECOVERY_MISSION_ENGINE_SCHEMA}`);
    console.log(`  truth: ${DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
