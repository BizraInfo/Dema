#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { makeNode0RealmEvent } from "../../packages/core/src/node0-realm-state-kernel.js";
import {
  DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
  DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
  DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
  DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE,
  DEMA_MISSION_WORKER_HANDOFF_AUTHORITY_ATTACK_FIXTURE,
  DEMA_MISSION_WORKER_HANDOFF_DRIFT_ATTACK_FIXTURE,
  runDemaMissionWorkerHandoff,
  verifyDemaMissionWorkerHandoff,
} from "../../packages/core/src/dema-mission-worker-handoff.js";

export function runDemaMissionWorkerHandoffCheck() {
  const blocked_by = [];
  const clean = runDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: DEMA_MISSION_WORKER_HANDOFF_CANONICAL_FIXTURE,
  });
  if (!clean.ok) blocked_by.push(...clean.blocked_by.map((code) => `clean:${code}`));

  const authorityAttack = runDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: DEMA_MISSION_WORKER_HANDOFF_AUTHORITY_ATTACK_FIXTURE,
  });
  if (authorityAttack.ok || !authorityAttack.blocked_by.includes("authority_delta_nonzero")) {
    blocked_by.push("authority_attack_not_rejected");
  }

  const driftAttack = runDemaMissionWorkerHandoff({
    consent: DEMA_MISSION_WORKER_HANDOFF_GO_PHRASE,
    input: DEMA_MISSION_WORKER_HANDOFF_DRIFT_ATTACK_FIXTURE,
  });
  if (driftAttack.ok || !driftAttack.blocked_by.includes("consent_scope_hash_drift")) {
    blocked_by.push("drift_attack_not_rejected");
  }

  if (clean.ok) {
    const history = [...clean.event_history];
    const original = history.at(-1);
    const forged = makeNode0RealmEvent({
      seq: original.seq,
      kind: original.kind,
      payload: { ...original.payload, authority_delta: 1 },
      prev_event: original.prev_event,
    });
    history[history.length - 1] = forged;
    const forgedEnvelope = {
      ...clean,
      event_history: history,
      handoff_event_id: forged.event_id,
      replay: { ...clean.replay, head: { ...clean.replay.head, event_id: forged.event_id } },
    };
    const verdict = verifyDemaMissionWorkerHandoff(forgedEnvelope);
    if (verdict.ok || !verdict.blocked_by.includes("handoff_authority_delta_nonzero")) {
      blocked_by.push("forged_rehashed_authority_not_rejected");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_MISSION_WORKER_HANDOFF_SCHEMA,
    truth_label: DEMA_MISSION_WORKER_HANDOFF_TRUTH_LABEL,
    continuity_status: clean.continuity_status ?? null,
    handoff_event_id: clean.handoff_event_id ?? null,
    authority_delta: clean.authority_delta ?? 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaMissionWorkerHandoffCheck();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
