// GENESIS_RUNTIME_SPINE_1A.0 — the runnable check for the URP-0 local ignition
// loop. Every test drives the REAL runtime against a REAL temporary directory:
// no fake filesystem, no stubbed verifier, no asserted booleans.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  URP0_EVENT_KINDS,
  URP0_HUMAN_ID,
  URP0_MISSION_ID,
  URP0_SAT_LANES,
  makeUrp0Event,
  reduceUrp0Events,
  urp0MissionConsentPhrase,
} from "../packages/genesis/src/urp0-kernel.js";
import { buildAdmissionContract, admissionConsentPhrase } from "../packages/genesis/src/urp0-mission-kernel.js";
import { judgeUrp0Mission, verifyBlock0Candidate, verifyUrp0Judgment } from "../packages/genesis/src/urp0-sat5.js";
import {
  admitHuman0,
  authorizeAndExecute,
  conservativeOffer,
  measurePossessed,
  missionConsentCard,
  replayFromDisk,
  sealBlock0,
  worldState,
} from "../scripts/genesis/urp0-runtime.mjs";
import { appendEvent, loadEvents, resolveStateRootDir, statePermissions } from "../scripts/genesis/urp0-store.mjs";
import { loopbackOrigins, startUrp0Server } from "../scripts/genesis/urp0-server.mjs";
import { portFree, preflight } from "../scripts/genesis-node0.mjs";

// One isolated world per test: its own DEMA_HOME and its own source tree.
function makeWorld() {
  const base = mkdtempSync(join(tmpdir(), "genesis-spine-"));
  const demaHome = join(base, "dema-home");
  const source = join(base, "source");
  mkdirSync(join(source, "nested", "deeper"), { recursive: true });
  writeFileSync(join(source, "readme.md"), "# doc\n");
  writeFileSync(join(source, "kernel.js"), "export const x = 1;\n");
  writeFileSync(join(source, "data.json"), '{"a":1}\n');
  writeFileSync(join(source, "NOTICE"), "no extension\n");
  writeFileSync(join(source, "nested", "deeper", "pixel.png"), "not-really-a-png");
  const stateRootDir = join(demaHome, "genesis", "urp0");
  return { base, demaHome, source, stateRootDir, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

function admitPhrase() {
  const contract = buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] });
  return admissionConsentPhrase({ human_id: "HUMAN-0", node_id: "NODE0", contract_hash: contract.contract_hash });
}

// Drive the whole loop the way the browser does.
function runFullLoop(w, { root = w.source } = {}) {
  const admitted = admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
  assert.equal(admitted.ok, true, JSON.stringify(admitted.blocked_by));

  const card = missionConsentCard(w.stateRootDir, { root, now_iso: new Date().toISOString() });
  assert.equal(card.ok, true, JSON.stringify(card.blocked_by));

  const run = authorizeAndExecute(w.stateRootDir, {
    consent_context: card.consent_context,
    phrase: card.card.required_phrase,
    now_iso: new Date().toISOString(),
  });
  return { admitted, card, run };
}

test("URP-0 closes the full genesis loop and seals a Block0 local candidate", () => {
  const w = makeWorld();
  try {
    const { card, run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));

    // Five verifiers, all PASS, all re-derived.
    assert.equal(run.judgment.verifier_verdicts.length, 5);
    assert.deepEqual(run.judgment.verifier_verdicts.map((v) => v.id), URP0_SAT_LANES.map((l) => l.id));
    assert.equal(run.judgment.admissible, true, JSON.stringify(run.judgment.failing_verifiers));
    assert.equal(run.judgment.autonomous_ai_agent, false);

    // The mission actually counted the real tree.
    assert.equal(run.result.counts.files, 5);
    assert.ok(run.result.counts.directories >= 2);
    assert.equal(run.result.type_histogram.document, 1);
    assert.equal(run.result.type_histogram.code, 1);
    assert.equal(run.result.type_histogram.data, 1);
    assert.equal(run.result.type_histogram.no_extension, 1);
    assert.equal(run.result.type_histogram.image, 1);
    assert.equal(run.result.canonical_root, card.contract.canonical_root);

    // Source non-mutation, measured either side of the walk.
    assert.equal(run.source_fingerprint_before, run.source_fingerprint_after);

    // The world-state transition is real: the root moved.
    assert.notEqual(run.previous_state_root, run.resulting_state_root);

    const sealed = sealBlock0(w.stateRootDir, {
      repository_base_commit: "badb1c18e3fffae8fa26083e8e8d3bb9d96fdc1b",
      implementation_commit: "test",
      constitution_source_hash: "sha256:test",
      topology_source_hash: "sha256:test",
    });
    assert.equal(sealed.ok, true, JSON.stringify(sealed.blocked_by));
    assert.equal(sealed.block0.truth_label, "LOCAL_CANDIDATE");
    assert.equal(sealed.block0.economy.token_created, false);
    assert.equal(sealed.block0.economy.urp_treasury_balance, 0);
    assert.equal(sealed.block0.network.internet_gateway, false);
    assert.equal(verifyBlock0Candidate({ body: sealed.block0, block0_hash: sealed.block0_hash }).ok, true);
  } finally {
    w.cleanup();
  }
});

test("restart reconstructs the identical state root from persisted evidence alone", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    sealBlock0(w.stateRootDir, { repository_base_commit: "x", implementation_commit: "y", constitution_source_hash: "h", topology_source_hash: "h" });

    const live = worldState(w.stateRootDir).urp.state_root;
    // A fresh reduction over the bytes on disk — nothing carried in memory.
    const disk = replayFromDisk(w.stateRootDir);
    assert.equal(disk.ok, true, JSON.stringify(disk.blocked_by));
    assert.equal(disk.state_root, live);
    assert.equal(disk.duplicate_human_registration, false);
    assert.equal(disk.duplicate_node_registration, false);
    assert.equal(disk.duplicate_mission_admission, false);

    // Local state is 0700 / 0600, proved by stat rather than by intent.
    const perms = statePermissions(w.stateRootDir);
    assert.equal(perms[w.stateRootDir], "700");
    assert.equal(perms[join(w.stateRootDir, "journal.ndjson")], "600");
  } finally {
    w.cleanup();
  }
});

test("world-cell completion binds one verified DEMA effect and refuses duplicates", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    // The completion contract uses the World-Cell mission id end to end.
    // Rebind the fixture journal's otherwise fixed URP mission id before adding
    // the completion event, preserving the kernel's hash chain.
    const reboundMissionId = "NODE0-STATE-BRIEF-MISSION-1A";
    let previousEvent = "GENESIS";
    const rebound = loadEvents(w.stateRootDir).map((event, index) => {
      const payload = ["MISSION_DECLARED", "CONSENT_REQUESTED", "MISSION_AUTHORIZED", "MISSION_EXECUTED", "SAT_JUDGMENT_RECORDED", "RECEIPT_RECORDED"].includes(event.kind)
        ? { ...event.payload, mission_id: reboundMissionId }
        : event.payload;
      const next = makeUrp0Event({ seq: index + 1, kind: event.kind, payload, prev_event: previousEvent });
      previousEvent = next.event_id;
      return next;
    });
    writeFileSync(join(w.stateRootDir, "journal.ndjson"), `${rebound.map((event) => JSON.stringify(event)).join("\n")}\n`);
    const mission = Object.values(worldState(w.stateRootDir).missions).find((m) => m.status === "RECEIPTED");
    assert.ok(mission);
    const hash = "a".repeat(64);
    const payload = {
      mission_id: "NODE0-STATE-BRIEF-MISSION-1A",
      dema_mission_id: reboundMissionId,
      dema_capsule_sha256: hash,
      output_sha256: hash,
      observation_sha256: hash,
      dema_receipt_sha256: hash,
      pat7_evidence_sha256: hash,
      pat7_count: 7,
      sat5_judgment_hash: run.judgment.judgment_hash.replace(/^sha256:/, ""),
      sat5_all_pass: true,
      effect_count: 1,
      duplicate_effects: 0,
      recovery_status: "VERIFIED_PROCESS_REPLAY",
      authority_delta: 0,
      public_gateway: false,
      federation: false,
      node1_admitted: false,
      token_minted: false,
      completed_at: new Date().toISOString(),
      urp_attempt_id: mission.attempt_id,
      urp_receipt_sha256: run.receipt_hash.replace(/^sha256:/, ""),
    };
    const completed = appendEvent(w.stateRootDir, "WORLD_CELL_MISSION_COMPLETED", payload);
    assert.equal(completed.ok, true, JSON.stringify(completed.blocked_by));
    assert.equal(worldState(w.stateRootDir).world_cell.mission_id, payload.mission_id);
    const duplicate = appendEvent(w.stateRootDir, "WORLD_CELL_MISSION_COMPLETED", payload);
    assert.equal(duplicate.ok, false);
    assert.deepEqual(duplicate.blocked_by, ["world_cell_already_completed"]);
  } finally {
    w.cleanup();
  }
});

test("a near-match consent phrase is refused and grants no authority", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });

    // One trailing period. Nothing else changed.
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: `${card.card.required_phrase}.`,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("exact_consent_not_matched"));

    const state = worldState(w.stateRootDir);
    const attempt = Object.values(state.missions)[0];
    assert.equal(attempt.mission_id, URP0_MISSION_ID);
    assert.equal(attempt.status, "CONSENT_REQUESTED");
    assert.equal(Object.keys(state.receipts).length, 0);
    assert.equal(state.block0, null);

    // §14: the refused attempt is permanently on the record, and a FRESH attempt
    // id still lets the operator retry. One mistyped phrase must not poison the
    // mission for the life of the world.
    const retryCard = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const retry = authorizeAndExecute(w.stateRootDir, {
      consent_context: retryCard.consent_context,
      phrase: retryCard.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(retry.ok, true, JSON.stringify(retry.blocked_by));
    const after = worldState(w.stateRootDir);
    assert.equal(Object.keys(after.missions).length, 2);
    assert.equal(Object.values(after.missions).filter((m) => m.status === "CONSENT_REQUESTED").length, 1);
    assert.equal(Object.values(after.missions).filter((m) => m.status === "RECEIPTED").length, 1);
  } finally {
    w.cleanup();
  }
});

test("a replayed consent context cannot authorize a second mission", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const first = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(first.ok, true, JSON.stringify(first.blocked_by));

    const replayed = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(replayed.ok, false);
    assert.ok(replayed.blocked_by.includes("duplicate_mission_declaration"));
  } finally {
    w.cleanup();
  }
});

test("an expired consent context is refused at act time", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const issued = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: issued });
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("consent_expired"), JSON.stringify(run.blocked_by));
  } finally {
    w.cleanup();
  }
});

test("a self-issued forever window is refused", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const stretched = { ...card.consent_context, expires_at_iso: new Date(Date.now() + 86400000).toISOString() };
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: stretched,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, false);
    assert.ok(run.blocked_by.includes("consent_window_too_wide"));
  } finally {
    w.cleanup();
  }
});

test("symlinks are counted and never followed", () => {
  const w = makeWorld();
  try {
    const outside = join(w.base, "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "secret.txt"), "must never be counted\n");
    symlinkSync(outside, join(w.source, "escape-link"));

    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    assert.equal(run.result.counts.symlinks, 1);
    assert.equal(run.result.observed.symlinks_followed, 0);
    assert.equal(run.result.observed.entries_outside_root, 0);
    // secret.txt sits behind the link: still 5 files, so the link was not walked.
    assert.equal(run.result.counts.files, 5);
  } finally {
    w.cleanup();
  }
});

test("founder bypass is rejected by the kernel, whatever the payload claims", () => {
  const events = [];
  const e = makeUrp0Event({
    seq: 1,
    kind: "HUMAN_REGISTERED",
    prev_event: "GENESIS",
    payload: {
      human_id: URP0_HUMAN_ID,
      roles: ["ARCHITECT", "FIRST_USER"],
      founder_bypass: true,
      self_approval: false,
      sat_exemption: false,
      mint_authority: false,
      treasury_authority: false,
      unbounded_resource_authority: false,
      admission_contract_hash: "sha256:x",
      consent_receipt_hash: "sha256:y",
    },
  });
  events.push(e);
  const out = reduceUrp0Events(events);
  assert.equal(out.ok, false);
  assert.deepEqual(out.blocked_by, ["founder_bypass_claimed:founder_bypass"]);
  assert.equal(out.state, null);
});

test("a tampered event payload breaks its own chain link", () => {
  const w = makeWorld();
  try {
    const { run } = runFullLoop(w);
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));
    const events = loadEvents(w.stateRootDir);
    const forged = events.map((ev) =>
      ev.kind === "MISSION_EXECUTED"
        ? { ...ev, payload: { ...ev.payload, result_hash: `sha256:${"0".repeat(64)}` } }
        : ev,
    );
    const out = reduceUrp0Events(forged);
    assert.equal(out.ok, false);
    assert.equal(out.blocked_by[0], "event_id_mismatch");
  } finally {
    w.cleanup();
  }
});

test("a forged ADMISSIBLE judgment is rejected because verdicts are re-derived", () => {
  const w = makeWorld();
  try {
    admitHuman0(w.stateRootDir, { phrase: admitPhrase(), now_iso: new Date().toISOString() });
    const card = missionConsentCard(w.stateRootDir, { root: w.source, now_iso: new Date().toISOString() });
    const run = authorizeAndExecute(w.stateRootDir, {
      consent_context: card.consent_context,
      phrase: card.card.required_phrase,
      now_iso: new Date().toISOString(),
    });
    assert.equal(run.ok, true, JSON.stringify(run.blocked_by));

    // Evidence that genuinely fails SAT-2: the submitted phrase never matched.
    const events = loadEvents(w.stateRootDir);
    const badEvidence = {
      events,
      admission_contract: buildAdmissionContract({ human_id: "HUMAN-0", node_id: "NODE0", roles: ["ARCHITECT", "FIRST_USER"] }).body,
      sat_set: worldState(w.stateRootDir).sat.registered,
      resource_offer: worldState(w.stateRootDir).resource_offer,
      contract: run.contract,
      contract_hash: run.contract_hash,
      consent_context: card.consent_context,
      consent_context_hash: card.consent_context_hash,
      submitted_phrase: "GO: something else entirely",
      authorized_at_iso: new Date().toISOString(),
      observation: run.observation,
      result: run.result,
      receipt_body: run.receipt,
      receipt_hash: run.receipt_hash,
      previous_state_root: run.previous_state_root,
      resulting_state_root: run.resulting_state_root,
      source_fingerprint_before: run.source_fingerprint_before,
      source_fingerprint_after: run.source_fingerprint_after,
      declared_write_paths: [],
      state_root_dir: w.stateRootDir,
    };
    const honest = judgeUrp0Mission(badEvidence);
    assert.equal(honest.admissible, false);
    assert.ok(honest.failing_verifiers.includes("SAT-2"));

    // Now forge it to ADMISSIBLE and recompute the hash. Re-derivation still wins.
    const forged = {
      ...honest,
      verifier_verdicts: honest.verifier_verdicts.map((v) => ({ ...v, verdict: "PASS", reasons: [] })),
      set_verdict: "ADMISSIBLE",
      admissible: true,
      failing_verifiers: [],
    };
    const check = verifyUrp0Judgment({ evidence: badEvidence, judgment: forged });
    assert.equal(check.ok, false);
    assert.ok(check.blocked_by.includes("admissibility_not_rederivable"));
  } finally {
    w.cleanup();
  }
});

test("missing evidence refuses rather than defaulting to pass", () => {
  const judgment = judgeUrp0Mission({ events: [] });
  assert.equal(judgment.admissible, false);
  assert.equal(judgment.evidence_complete, false);
  assert.equal(judgment.verifier_verdicts.length, 5);
  assert.equal(judgment.set_verdict, "REFUSED");
});

test("the resource offer is a strict fraction of what the node possesses", () => {
  const possessed = measurePossessed();
  const allowed = conservativeOffer(possessed);
  assert.ok(allowed.cpu_threads < possessed.cpu_threads);
  assert.ok(allowed.memory_bytes < possessed.memory_bytes);
  assert.ok(allowed.cpu_threads >= 1);
  assert.ok(allowed.wall_clock_seconds > 0);
});

test("the SAT set is the constitutional five, not the obsolete council", () => {
  assert.deepEqual(URP0_SAT_LANES.map((l) => l.id), ["SAT-1", "SAT-2", "SAT-3", "SAT-4", "SAT-5"]);
  const lanes = URP0_SAT_LANES.map((l) => l.lane).join(",");
  for (const obsolete of ["Guardian", "Reasoner", "Builder", "Critic", "Archivist"]) {
    assert.ok(!lanes.includes(obsolete), `obsolete council member leaked: ${obsolete}`);
  }
  assert.equal(URP0_EVENT_KINDS.filter(kind => kind !== "SYSTEM_PLANE_BOUND").length, 12);
  assert.ok(URP0_EVENT_KINDS.includes("SYSTEM_PLANE_BOUND"));
});

test("the required phrase is bound to the root and the contract", () => {
  const a = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/a", contract_hash: "sha256:1" });
  const b = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/b", contract_hash: "sha256:1" });
  const c = urp0MissionConsentPhrase({ mission_id: URP0_MISSION_ID, canonical_root: "/a", contract_hash: "sha256:2" });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test("state lives under DEMA_HOME, never beside the source", () => {
  const dir = resolveStateRootDir({ DEMA_HOME: "/tmp/example-dema-home" });
  assert.equal(dir, "/tmp/example-dema-home/genesis/urp0");
});

// --- launcher: the three defects the operator's first real run exposed --------

test("preflight refuses a port that is already held, naming the port", async () => {
  const squatter = createServer();
  await new Promise((r) => squatter.listen(0, "127.0.0.1", r));
  const taken = squatter.address().port;
  try {
    assert.equal(await portFree(taken), false);

    const gaps = await preflight({ needUi: false, apiPort: taken });
    assert.equal(gaps.length, 1, JSON.stringify(gaps));
    assert.match(gaps[0], new RegExp(`^api_port_in_use:${taken}`));
    // The message has to be actionable, not just true.
    assert.match(gaps[0], /ss -tlnp/);
    assert.match(gaps[0], /GENESIS_API_PORT/);
  } finally {
    await new Promise((r) => squatter.close(r));
  }
  // Freed again once the squatter lets go.
  assert.equal(await portFree(taken), true);
});

test("preflight passes when the ports are free", async () => {
  const probe = createServer();
  await new Promise((r) => probe.listen(0, "127.0.0.1", r));
  const free = probe.address().port;
  await new Promise((r) => probe.close(r));
  assert.deepEqual(await preflight({ needUi: false, apiPort: free }), []);
});

test("CORS follows the UI port instead of hardcoding 3000", async () => {
  const w = makeWorld();
  const uiPort = 3117; // deliberately not 3000
  const { server, url } = await startUrp0Server({ stateRootDir: w.stateRootDir, port: 0, uiPort });
  try {
    const allowed = await fetch(`${url}/readyz`, { headers: { origin: `http://127.0.0.1:${uiPort}` } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), `http://127.0.0.1:${uiPort}`);

    const alsoAllowed = await fetch(`${url}/readyz`, { headers: { origin: `http://localhost:${uiPort}` } });
    assert.equal(alsoAllowed.headers.get("access-control-allow-origin"), `http://localhost:${uiPort}`);

    // The old hardcoded origin is NOT blessed when the UI runs elsewhere...
    const stale = await fetch(`${url}/readyz`, { headers: { origin: "http://127.0.0.1:3000" } });
    assert.equal(stale.headers.get("access-control-allow-origin"), null);

    // ...and no origin at all is still refused a CORS header.
    const foreign = await fetch(`${url}/readyz`, { headers: { origin: "http://evil.example" } });
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise((r) => server.close(r));
    w.cleanup();
  }
});

test("loopbackOrigins covers both loopback spellings and nothing else", () => {
  assert.deepEqual(loopbackOrigins(3000), ["http://127.0.0.1:3000", "http://localhost:3000"]);
  assert.deepEqual(loopbackOrigins(3117), ["http://127.0.0.1:3117", "http://localhost:3117"]);
});
