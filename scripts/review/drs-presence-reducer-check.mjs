#!/usr/bin/env node
// DRS-PRESENCE-REDUCER-2A — review gate. Runs the slice proof loop and emits the verdict.

import { pathToFileURL } from "node:url";

import {
  runDrsPresenceReducer,
  DRS_PRESENCE_REDUCER_SCHEMA,
  DRS_PRESENCE_REDUCER_TRUTH_LABEL,
  DRS_PRESENCE_REDUCER_GO_PHRASE,
} from "../../packages/core/src/drs-presence-reducer.js";
import { realmEventDigest } from "../../packages/core/src/drs-realm-contracts.js";

const HEX64 = (ch) => ch.repeat(64);
const TS = "2026-08-25T07:44:10.000Z";

// Golden G-02 fixture, derived (never pasted): HELLO -> snapshot IDLE ->
// THINKING -> WORKING -> VERIFYING(SAT_ACTIVE) -> VERIFIED_DONE(with evidence).
export function goldenInput() {
  const source = {
    component: "node0.realm_projection",
    revision: `sha256:${HEX64("a")}`,
    pid: 12345,
    session_id: "source-session-77",
  };
  let seq = 1841;
  let last = null;
  const sign = (ev) => {
    ev.prev_event_digest = last ?? `sha256:${HEX64("1")}`;
    const { event_digest, ...body } = ev;
    ev.event_digest = realmEventDigest(body);
    last = ev.event_digest;
    return ev;
  };
  const baseEvent = (n) => ({
    schema: "bizra.realm.event.v0.1",
    event_id: `evt-${++seq}`,
    sequence: seq,
    issued_at: TS,
    ttl_ms: 2500,
    source,
    kind: "presence.state_changed",
    authority_delta: 0,
    reason_codes: [],
    payload: {},
    __now_ms__: n,
  });
  const snap = {
    schema: "bizra.realm.resync.v0.1",
    source,
    sequence_anchor: 1841,
    current_event_digest: `sha256:${HEX64("1")}`,
    issued_at: TS,
    current_snapshot: { semantic_state: "IDLE", authority_delta: 0, reason_codes: [] },
    authority_delta: 0,
  };
  last = snap.current_event_digest;
  const mk = (state, n, extra = {}, codes = [], evidence_refs = null) => {
    const ev = baseEvent(n);
    ev.semantic_state = state;
    ev.reason_codes = codes;
    ev.payload = extra;
    if (evidence_refs !== null) ev.evidence_refs = evidence_refs;
    return sign(ev);
  };
  const mission = { mission_id: "mission-001", label: "Node0 qualification", phase: "VERIFY" };

  return {
    transcript: [
      {
        schema: "bizra.realm.hello.v0.1",
        source,
        contracts_digest: `sha256:${HEX64("b")}`,
        authority_delta: 0,
      },
      snap,
      mk("THINKING", 1000, { mission }),
      mk("WORKING", 2000, { mission }),
      mk("VERIFYING", 3000, { mission }, ["SAT_ACTIVE"]),
      mk("VERIFIED_DONE", 4000, { mission }, [], ["receipt:sha256:f25acaed"]),
    ],
    admitted: {
      component: source.component,
      revision: source.revision,
      contracts_digest: `sha256:${HEX64("b")}`,
      uid: 1000,
    },
    peer: { uid: 1000, pid: 12345 },
    now_ms: 4500,
  };
}

const JSON_MODE = process.argv.includes("--json");

export function runDrsPresenceReducerCheck() {
  return runDrsPresenceReducer({
    consent: DRS_PRESENCE_REDUCER_GO_PHRASE,
    input: goldenInput(),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDrsPresenceReducerCheck();

  if (JSON_MODE) {
    // Strip heavy/non-summary fields here if the envelope carries them.
    const { ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - DRS-PRESENCE-REDUCER-2A");
    console.log(`  schema: ${DRS_PRESENCE_REDUCER_SCHEMA}`);
    console.log(`  truth: ${DRS_PRESENCE_REDUCER_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.blocked_by || []) console.log(`    ${code}`);
    }
  }

  if (!result.ok) process.exit(1);
}
