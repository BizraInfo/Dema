#!/usr/bin/env node
// DRS-REALM-CONTRACTS-1A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDrsRealmContracts,
  realmEventDigest,
  DRS_REALM_CONTRACTS_SCHEMA,
  DRS_REALM_CONTRACTS_TRUTH_LABEL,
  DRS_REALM_CONTRACTS_GO_PHRASE,
  REALM_HELLO_SCHEMA,
  REALM_RESYNC_SCHEMA,
  REALM_EVENT_SCHEMA,
} from "../../packages/core/src/drs-realm-contracts.js";

const HEX64 = (ch) => ch.repeat(64);
const TS = "2026-08-25T07:44:10.000Z";

// Golden G-02 mission-work transcript: HELLO -> snapshot IDLE ->
// THINKING -> WORKING -> VERIFYING(SAT_ACTIVE) -> VERIFIED_DONE(with evidence).
// Every digest is derived, not pasted; any kernel drift breaks this chain.
function goldenTranscript() {
  const source = {
    component: "node0.realm_projection",
    revision: `sha256:${HEX64("a")}`,
    pid: 12345,
    session_id: "source-session-77",
  };
  const admitted = {
    component: source.component,
    revision: source.revision,
    contracts_digest: `sha256:${HEX64("b")}`,
    uid: 1000,
  };
  const hello = {
    schema: REALM_HELLO_SCHEMA,
    source,
    contracts_digest: admitted.contracts_digest,
    authority_delta: 0,
  };
  const snap = {
    schema: REALM_RESYNC_SCHEMA,
    source,
    sequence_anchor: 1841,
    current_event_digest: `sha256:${HEX64("1")}`,
    issued_at: TS,
    current_snapshot: { semantic_state: "IDLE", authority_delta: 0, reason_codes: [] },
    authority_delta: 0,
  };
  let seq = 1841;
  let prev = snap.current_event_digest;
  const event = (state, extra = {}) => {
    const ev = {
      schema: REALM_EVENT_SCHEMA,
      event_id: `evt-${++seq}`,
      sequence: seq,
      issued_at: TS,
      ttl_ms: 2500,
      source,
      kind: "presence.state_changed",
      semantic_state: state,
      authority_delta: 0,
      reason_codes: state === "VERIFYING" ? ["SAT_ACTIVE"] : [],
      payload: {
        mission: { mission_id: "mission-001", label: "Node0 qualification", phase: "VERIFY" },
        ...extra,
      },
      prev_event_digest: prev,
    };
    ev.event_digest = realmEventDigest(ev);
    prev = ev.event_digest;
    return ev;
  };
  const frames = [
    hello,
    snap,
    event("THINKING"),
    event("WORKING"),
    event("VERIFYING"),
    event("VERIFIED_DONE", { attention: { count: 0 } }),
  ];
  frames[5].evidence_refs = ["receipt:sha256:f25acaed"];
  frames[5].event_digest = realmEventDigest(frames[5]);
  return frames;
}

const JSON_MODE = process.argv.includes("--json");

export function runDrsRealmContractsCheck() {
  return runDrsRealmContracts({
    consent: DRS_REALM_CONTRACTS_GO_PHRASE,
    input: {
      transcript: goldenTranscript(),
      admitted: {
        component: "node0.realm_projection",
        revision: `sha256:${HEX64("a")}`,
        contracts_digest: `sha256:${HEX64("b")}`,
        uid: 1000,
      },
      peer: { uid: 1000, pid: 12345 },
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDrsRealmContractsCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DRS-REALM-CONTRACTS-1A");
    console.log(`  schema: ${DRS_REALM_CONTRACTS_SCHEMA}`);
    console.log(`  truth: ${DRS_REALM_CONTRACTS_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
