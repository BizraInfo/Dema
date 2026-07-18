import test from "node:test";
import assert from "node:assert/strict";

import {
  planDemaRecoveryMissionEngine,
  buildDemaRecoveryMissionEnginePayload,
  verifyDemaRecoveryMissionEngine,
  runDemaRecoveryMissionEngine,
  reduceDemaRecoveryMissionEvents,
  makeDemaRecoveryMissionEvent,
  reconstructRecoveryCandidates,
  DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID,
  DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
  DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
  DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE,
} from "../packages/core/src/dema-recovery-mission-engine.js";
import { runDemaRecoveryMissionEngineCheck } from "../scripts/review/dema-recovery-mission-engine-check.mjs";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

// Each test encodes part of the DEMA-RECOVERY-MISSION-ENGINE-1A proof contract:
// deterministic replay of an injected event history into a human-gated
// recovery-mission state machine, chain integrity, no auto-selection, verifier
// independence, all fail-closed.

const SOURCE_BOUNDARY = Object.freeze({ roots: ["root_a", "root_b"], exclusions: ["root_c"] });

// A poisoned evidence corpus: a1/a2/a4 are inside the boundary, a3 lives under
// the excluded root_c (poison fixture — must never surface).
function evidenceFixture() {
  return [
    {
      asset_id: "a1",
      root: "root_a",
      ref: "root_a/img1.jpg",
      best_evidence_time: "2019-05-01T00:00:00Z",
      relevance: 9,
      limitations: "low-res thumbnail only",
      claim: "photo taken May 2019",
    },
    {
      asset_id: "a2",
      root: "root_b",
      ref: "root_b/img2.jpg",
      best_evidence_time: null,
      relevance: 7,
      limitations: "exif stripped",
      claim: "photo taken, date unknown",
    },
    {
      asset_id: "a3",
      root: "root_c",
      ref: "root_c/img3.jpg",
      best_evidence_time: "2019-06-01T00:00:00Z",
      relevance: 10,
      limitations: "",
      claim: "poison: outside declared boundary",
    },
    {
      asset_id: "a4",
      root: "root_a",
      ref: "root_a/img4.jpg",
      best_evidence_time: "2019-06-10T00:00:00Z",
      relevance: 8,
      limitations: "",
      claim: "photo taken June 2019",
      conflicts_with: [{ asset_id: "a1", claim: "photo taken May 2019" }],
    },
  ];
}

function reconstructedFixture() {
  return reconstructRecoveryCandidates({ evidence: evidenceFixture(), source_boundary: SOURCE_BOUNDARY });
}

function chain(specs) {
  const events = [];
  let prev = DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID;
  for (const [kind, payload] of specs) {
    const event = makeDemaRecoveryMissionEvent({ seq: events.length + 1, kind, payload, prev_event: prev });
    events.push(event);
    prev = event.event_id;
  }
  return events;
}

const declareSpec = () => [
  "MISSION_DECLARED",
  {
    mission_id: "recover-2019-family-photos",
    objective_text: "Recover 2019 family photo set referenced in the chat export",
    source_boundary: SOURCE_BOUNDARY,
    success_definition: "human confirms the recovered photo matches the described memory",
  },
];

const reconstructSpec = (reconstructed = reconstructedFixture()) => [
  "RECONSTRUCTED",
  {
    consent_id: "consent-001",
    chronology: reconstructed.chronology,
    contradiction_map: reconstructed.contradiction_map,
    candidates: reconstructed.candidates,
    not_accessed_report: reconstructed.not_accessed_report,
  },
];

const awaitHumanSpec = () => ["AWAIT_HUMAN", {}];
const revivalSpec = (chosen_asset_id = "a1") => ["HUMAN_REVIVAL", { chosen_asset_id }];
const workerResultSpec = (worker_id = "worker-1") => ["WORKER_RESULT", { worker_id, result_ref: "local://out/a1-restored.jpg" }];
const verifierPassSpec = (verifier_id = "verifier-1", used_asset_id = "a1") =>
  ["VERIFIER_VERDICT", { verifier_id, verdict: "PASS", used_asset_id }];
const verifierFailSpec = (verifier_id = "verifier-1", used_asset_id = "a1") =>
  ["VERIFIER_VERDICT", { verifier_id, verdict: "FAIL", used_asset_id }];

// Full happy-path chain: declare -> reconstruct -> await -> revive -> worker -> verifier(PASS) -> SEALED.
function sealedFixtureEvents() {
  return chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), revivalSpec(), workerResultSpec(), verifierPassSpec()]);
}

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaRecoveryMissionEngine({ consent: "wrong", input: { events: [] } });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaRecoveryMissionEngine({ consent: DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE, input: { events: [] } });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("plan blocks input without an events array", () => {
  const plan = planDemaRecoveryMissionEngine({ consent: DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE, input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("input_events_not_array"));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  assert.equal(payload.schema, DEMA_RECOVERY_MISSION_ENGINE_SCHEMA);
  assert.equal(payload.truth_label, DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  assert.equal(verifyDemaRecoveryMissionEngine(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaRecoveryMissionEngine(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  // Internal-consistency check: a field changed but the stored hash did not, so
  // recompute-over-body must differ from content_hash.
  //
  // NOTE the harder launder this slice does NOT yet defend against: changing a
  // field AND recomputing the hash so the body is self-consistent. Internal
  // consistency alone cannot catch that — you need an INDEPENDENT anchor
  // (a signature over the payload, or an externally measured state hash). When
  // this slice gains one, add a test that forges + recomputes and still expects
  // rejection. Until then, do not claim launder-resistance.
  const payload = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaRecoveryMissionEngine(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaRecoveryMissionEngineCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_RECOVERY_MISSION_ENGINE_SCHEMA);
  assert.equal(result.truth_label, DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaRecoveryMissionEngine({ consent: DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE, input: { events: sealedFixtureEvents() } });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ── reconstructRecoveryCandidates (spec §3 pure helper) ─────────────────────

test("reconstruct never emits an item outside source_boundary (poison fixture)", () => {
  const result = reconstructedFixture();
  const surfacedIds = [
    ...result.chronology.map((c) => c.asset_id),
    ...result.candidates.map((c) => c.asset_id),
    ...result.candidates.flatMap((c) => c.source_lineage.map((l) => l.ref)),
  ];
  assert.ok(!surfacedIds.includes("a3"), `poison asset a3 leaked: ${surfacedIds}`);
  assert.ok(!surfacedIds.some((v) => typeof v === "string" && v.includes("root_c")), "excluded root leaked into output");
  assert.ok(
    result.not_accessed_report.some((r) => r.asset_id === "a3" && r.reason === "out_of_source_boundary"),
    "poison exclusion not named in not_accessed_report",
  );
});

test("unknown-time evidence goes to the UNKNOWN bucket, never interpolated", () => {
  const result = reconstructedFixture();
  const a2Entry = result.chronology.find((c) => c.asset_id === "a2");
  assert.ok(a2Entry, "a2 missing from chronology");
  assert.equal(a2Entry.best_evidence_time, "UNKNOWN");
  // Known-time entries are still real ISO timestamps, never guessed.
  const a1Entry = result.chronology.find((c) => c.asset_id === "a1");
  assert.equal(a1Entry.best_evidence_time, "2019-05-01T00:00:00Z");
});

test("contradiction appears verbatim in the contradiction_map", () => {
  const result = reconstructedFixture();
  assert.deepEqual(result.contradiction_map, [
    { asset_a: "a4", claim_a: "photo taken June 2019", asset_b: "a1", claim_b: "photo taken May 2019" },
  ]);
});

test("candidates are capped at 7, ranked by declared relevance as a labeled integer position", () => {
  const evidence = Array.from({ length: 9 }, (_, i) => ({
    asset_id: `c${i + 1}`,
    root: "root_a",
    ref: `root_a/c${i + 1}.jpg`,
    best_evidence_time: `2019-0${(i % 9) + 1}-01T00:00:00Z`,
    relevance: 9 - i, // c1 highest relevance, c9 lowest
    limitations: "",
    claim: `claim ${i + 1}`,
  }));
  const result = reconstructRecoveryCandidates({ evidence, source_boundary: { roots: ["root_a"], exclusions: [] } });
  assert.equal(result.candidates.length, 7);
  assert.deepEqual(result.candidates.map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(result.candidates.map((c) => c.asset_id), ["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
  for (const c of result.candidates) assert.ok(Number.isInteger(c.rank), "rank must be an integer, never a decimal score");
  assert.ok(
    result.not_accessed_report.some((r) => r.asset_id === "c8" && r.reason === "exceeds_candidate_cap"),
    "excess candidate not named in not_accessed_report",
  );
  assert.ok(result.not_accessed_report.some((r) => r.asset_id === "c9" && r.reason === "exceeds_candidate_cap"));
});

test("a candidate with no source_lineage is rejected as orphan content", () => {
  const events = chain([
    declareSpec(),
    [
      "RECONSTRUCTED",
      {
        consent_id: "consent-001",
        chronology: [],
        contradiction_map: [],
        candidates: [{ asset_id: "orphan", source_lineage: [], limitations: "" }],
        not_accessed_report: [],
      },
    ],
  ]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("candidate_source_lineage_empty"));
});

test("RECONSTRUCTED requires a declared mission and an exact-string consent_id", () => {
  const beforeDeclare = reduceDemaRecoveryMissionEvents(chain([reconstructSpec()]));
  assert.equal(beforeDeclare.ok, false);
  assert.ok(beforeDeclare.blocked_by.includes("reconstruct_requires_declared_state"));

  const events = chain([
    declareSpec(),
    [
      "RECONSTRUCTED",
      {
        consent_id: "",
        chronology: [],
        contradiction_map: [],
        candidates: [],
        not_accessed_report: [],
      },
    ],
  ]);
  const missingConsent = reduceDemaRecoveryMissionEvents(events);
  assert.equal(missingConsent.ok, false);
  assert.ok(missingConsent.blocked_by.includes("consent_id_missing"));
});

test("RECONSTRUCTED rejects more than 7 candidates", () => {
  const candidates = Array.from({ length: 8 }, (_, i) => ({
    asset_id: `x${i}`,
    source_lineage: [{ root: "root_a", ref: `root_a/x${i}.jpg` }],
    limitations: "",
  }));
  const events = chain([
    declareSpec(),
    ["RECONSTRUCTED", { consent_id: "c1", chronology: [], contradiction_map: [], candidates, not_accessed_report: [] }],
  ]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("candidates_exceed_cap"));
});

// ── full state machine ───────────────────────────────────────────────────────

test("AWAIT_HUMAN moves CANDIDATES_READY to AWAITING_HUMAN", () => {
  const result = reduceDemaRecoveryMissionEvents(chain([declareSpec(), reconstructSpec(), awaitHumanSpec()]));
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.state.current_state, "AWAITING_HUMAN");
});

test("AWAITING_HUMAN cannot advance without HUMAN_REVIVAL — no auto-selection", () => {
  const events = chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), workerResultSpec()]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("worker_result_requires_in_use_mission_state"));
});

test("HUMAN_REVIVAL rejects a chosen asset that was not a surfaced candidate", () => {
  const events = chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), revivalSpec("not-a-candidate")]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("revival_asset_not_a_candidate"));
});

test("HUMAN_REVIVAL with a real candidate moves AWAITING_HUMAN to IN_USE_MISSION", () => {
  const result = reduceDemaRecoveryMissionEvents(chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), revivalSpec()]));
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.state.current_state, "IN_USE_MISSION");
  assert.equal(result.state.chosen_asset_id, "a1");
});

test("WORKER_RESULT alone reaches VERIFYING, never SEALED — evidence, not authority", () => {
  const events = chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), revivalSpec(), workerResultSpec()]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.state.current_state, "VERIFYING");
  assert.notEqual(result.state.current_state, "SEALED");
  assert.equal(result.state.seal_receipt, null);
});

test("VERIFIER_VERDICT rejects a verifier that is the same actor as the worker", () => {
  const events = chain([
    declareSpec(),
    reconstructSpec(),
    awaitHumanSpec(),
    revivalSpec(),
    workerResultSpec("worker-1"),
    verifierPassSpec("worker-1", "a1"),
  ]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("verifier_is_generator"));
});

test("VERIFIER_VERDICT rejects a verdict on an asset that was not the one used in the mission", () => {
  const events = chain([
    declareSpec(),
    reconstructSpec(),
    awaitHumanSpec(),
    revivalSpec("a1"),
    workerResultSpec("worker-1"),
    verifierPassSpec("verifier-1", "a2"),
  ]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("asset_not_used_in_mission"));
});

test("VERIFIER_VERDICT PASS from an independent verifier on the used asset reaches SEALED with a seal_receipt", () => {
  const result = reduceDemaRecoveryMissionEvents(sealedFixtureEvents());
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.state.current_state, "SEALED");
  assert.deepEqual(result.state.seal_receipt, {
    asset_id: "a1",
    verifier_id: "verifier-1",
    worker_id: "worker-1",
    sealed_at_seq: 6,
  });
});

test("VERIFIER_VERDICT FAIL moves VERIFYING to STOPPED with cause verify_failed", () => {
  const events = chain([
    declareSpec(),
    reconstructSpec(),
    awaitHumanSpec(),
    revivalSpec(),
    workerResultSpec(),
    verifierFailSpec(),
  ]);
  const result = reduceDemaRecoveryMissionEvents(events);
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.state.current_state, "STOPPED");
  assert.equal(result.state.stop_cause, "verify_failed");
});

test("STOP moves any non-terminal state to STOPPED, narrating the cause", () => {
  for (const cause of ["missing_source_identity", "privacy_ambiguity", "budget_exhausted", "authority_exceeded"]) {
    const result = reduceDemaRecoveryMissionEvents(chain([declareSpec(), ["STOP", { cause }]]));
    assert.equal(result.ok, true, `${cause}: ${result.blocked_by?.join(", ")}`);
    assert.equal(result.state.current_state, "STOPPED");
    assert.equal(result.state.stop_cause, cause);
  }
  const invalid = reduceDemaRecoveryMissionEvents(chain([declareSpec(), ["STOP", { cause: "not_a_real_cause" }]]));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.blocked_by.includes("stop_cause_invalid"));
});

test("SEALED and STOPPED are terminal — any further event is rejected", () => {
  const sealed = reduceDemaRecoveryMissionEvents(sealedFixtureEvents());
  assert.equal(sealed.ok, true);
  const afterSeal = [
    ...sealedFixtureEvents(),
    makeDemaRecoveryMissionEvent({ seq: 7, kind: "STOP", payload: { cause: "budget_exhausted" }, prev_event: sealed.state.head.event_id }),
  ];
  const rejected = reduceDemaRecoveryMissionEvents(afterSeal);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.blocked_by.includes("mission_already_terminal"));

  const stoppedEvents = chain([declareSpec(), ["STOP", { cause: "budget_exhausted" }]]);
  const stopped = reduceDemaRecoveryMissionEvents(stoppedEvents);
  assert.equal(stopped.ok, true);
  const afterStop = [
    ...stoppedEvents,
    makeDemaRecoveryMissionEvent({ seq: 3, kind: "AWAIT_HUMAN", payload: {}, prev_event: stopped.state.head.event_id }),
  ];
  const rejectedAfterStop = reduceDemaRecoveryMissionEvents(afterStop);
  assert.equal(rejectedAfterStop.ok, false);
  assert.ok(rejectedAfterStop.blocked_by.includes("mission_already_terminal"));
});

test("full happy path: declare -> reconstruct -> await -> revive -> worker -> verifier(PASS) -> SEALED", () => {
  const result = reduceDemaRecoveryMissionEvents(sealedFixtureEvents());
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.events_applied, 6);
  assert.equal(result.state.current_state, "SEALED");
  assert.equal(result.state.mission_id, "recover-2019-family-photos");
  assert.equal(result.state.chosen_asset_id, "a1");
});

test("deterministic replay: same events produce the same content hash", () => {
  const a = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  const b = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  assert.equal(a.content_hash, b.content_hash);
});

test("a failed replay yields a null mission_state in the payload (fail-closed)", () => {
  const events = chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), workerResultSpec()]);
  const payload = buildDemaRecoveryMissionEnginePayload({ events });
  assert.equal(payload.replay.ok, false);
  assert.equal(payload.mission_state, null);
  assert.equal(payload.current_state, null);
});

test("an unknown event kind halts the replay fail-closed", () => {
  const declared = chain([declareSpec()]);
  const alien = makeDemaRecoveryMissionEvent({ seq: 2, kind: "MISSION_DECLARED", payload: declareSpec()[1], prev_event: declared[0].event_id });
  const result = reduceDemaRecoveryMissionEvents([declared[0], { ...alien, kind: "MISSION_TELEPORT", event_id: alien.event_id }]);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("kind_unknown"));
});

test("a forged event_id or broken prev_event halts the replay fail-closed", () => {
  const events = sealedFixtureEvents();
  const forgedId = [...events];
  forgedId[1] = { ...events[1], event_id: "sha256:" + "f".repeat(64) };
  const forgedResult = reduceDemaRecoveryMissionEvents(forgedId);
  assert.equal(forgedResult.ok, false);
  assert.ok(forgedResult.blocked_by.includes("event_id_mismatch"));

  const brokenChain = [...events];
  brokenChain[2] = makeDemaRecoveryMissionEvent({ seq: 3, kind: "AWAIT_HUMAN", payload: {}, prev_event: "sha256:" + "0".repeat(64) });
  const brokenResult = reduceDemaRecoveryMissionEvents(brokenChain);
  assert.equal(brokenResult.ok, false);
  assert.ok(brokenResult.blocked_by.includes("prev_event_mismatch"));
});

test("non-canonical event content halts fail-closed as event_not_canonicalizable — never a throw", () => {
  const cyclic = {};
  cyclic.self = cyclic;
  const event = {
    seq: 1,
    kind: "MISSION_DECLARED",
    payload: cyclic,
    prev_event: DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID,
    event_id: "sha256:" + "0".repeat(64),
  };
  const result = reduceDemaRecoveryMissionEvents([event]);
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("event_not_canonicalizable"));
  const payload = buildDemaRecoveryMissionEnginePayload({ events: [event] });
  assert.equal(payload.replay.ok, false);
  assert.equal(payload.mission_state, null);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
});

function rehash(payload) {
  const { content_hash, ...body } = payload;
  return Object.freeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

test("verifier rejects forged-and-rehashed payloads on every declared invariant", () => {
  const payload = buildDemaRecoveryMissionEnginePayload({ events: sealedFixtureEvents() });
  const failedPayload = buildDemaRecoveryMissionEnginePayload({
    events: chain([declareSpec(), reconstructSpec(), awaitHumanSpec(), workerResultSpec()]),
  });
  const casesToCode = [
    [rehash({ ...payload, canonicalization_algorithm: "wrong.canon.v9" }), "canonicalization_algorithm_mismatch"],
    [rehash({ ...payload, hash_algorithm: "md5" }), "hash_algorithm_mismatch"],
    [rehash({ ...payload, text_encoding: "utf-16" }), "text_encoding_mismatch"],
    [rehash({ ...payload, schema: "bizra.dema.other.v9" }), "schema_mismatch"],
    [rehash({ ...payload, truth_label: "FORGED" }), "truth_label_mismatch"],
    [rehash({ ...payload, boundary: { ...payload.boundary, execution_allowed: true } }), "boundary_shape_invalid"],
    [rehash({ ...payload, mission_state: null }), "mission_state_inconsistent"],
    [rehash({ ...failedPayload, mission_state: payload.mission_state, current_state: payload.current_state }), "mission_state_present_for_failed_replay"],
    [rehash({ ...payload, current_state: "STOPPED" }), "current_state_mismatch"],
    [rehash({ ...payload, seal_receipt: null }), "seal_receipt_mismatch"],
  ];
  for (const [forged, code] of casesToCode) {
    const verdict = verifyDemaRecoveryMissionEngine(forged);
    assert.equal(verdict.ok, false, code);
    assert.ok(verdict.blocked_by.includes(code), `${code}: got ${verdict.blocked_by}`);
  }
});
