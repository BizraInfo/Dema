// DRS-FIXTURE-PUBLISHER-1A — Realm Shell simulated-feed harness.
//
// Builds wire-law-VALID RealmHello/ResyncSnapshot/RealmEvent transcripts for
// the five golden scenarios, with `simulated: true` stamped on every frame's
// payload (and snapshot body). The propagation law proven here: because
// DRS-PRESENCE-REDUCER-2A ORs any contributing simulated marker into the
// derived view, a fixture — even a fully valid one that walks the FSM cleanly
// to VERIFIED_DONE — renders `simulated: true` and is therefore
// production-INADMISSIBLE by construction. SIMULATED_FIXTURE reason codes ride
// alongside so diagnostics can name the marker.
//
// Pure kernel: digests via packages/canon; time only as caller-supplied values.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

import {
  REALM_EVENT_SCHEMA,
  REALM_HELLO_SCHEMA,
  REALM_RESYNC_SCHEMA,
  realmEventDigest,
} from "./drs-realm-contracts.js";
import { deriveRenderRequest } from "./drs-presence-reducer.js";

export const DRS_FIXTURE_PUBLISHER_SCHEMA = "bizra.dema.drs_fixture_publisher.v0.1";
export const DRS_FIXTURE_PUBLISHER_TRUTH_LABEL = "DRS_FIXTURE_PUBLISHER_MEASURED_REPO";
export const DRS_FIXTURE_PUBLISHER_GO_PHRASE = "GO: dema realm fixture publisher";

export const FIXTURE_MARKER = "SIMULATED_FIXTURE";

export const FIXTURE_SCENARIOS = Object.freeze([
  "idle",
  "mission_work",
  "refusal",
  "recovery",
  "integrity_breach",
]);

const HEX64 = (ch) => ch.repeat(64);
const TS = "2026-08-25T07:44:10.000Z";

// The fixture component id is DISTINCT from any real producer id; a fixture
// bound to a production component name is refused at build time.
const FIXTURE_COMPONENT = "node0.realm_projection.fixture";

function defaultIdentity() {
  return Object.freeze({
    source: Object.freeze({
      component: FIXTURE_COMPONENT,
      revision: `sha256:${HEX64("f")}`,
      pid: 1,
      session_id: "fixture-session-000",
    }),
  });
}

function stampSimulated(frame) {
  if (frame.schema === REALM_RESYNC_SCHEMA) {
    frame.current_snapshot = { ...frame.current_snapshot, simulated: true };
    frame.current_snapshot.reason_codes = [
      ...new Set([...(frame.current_snapshot.reason_codes ?? []), FIXTURE_MARKER]),
    ];
  } else if (frame.schema === REALM_EVENT_SCHEMA) {
    frame.payload = { ...frame.payload, simulated: true };
  }
  return frame;
}

// ---------------------------------------------------------------------------
// Scenario builders — each returns a wire-law-valid transcript when signed
// ---------------------------------------------------------------------------

function buildFrames(scenario) {
  const { source } = defaultIdentity();
  let seq = 1841;
  let last = null;

  const snap = {
    schema: REALM_RESYNC_SCHEMA,
    source,
    sequence_anchor: 1841,
    current_event_digest: `sha256:${HEX64("1")}`,
    issued_at: TS,
    // Simulation stamped at construction; the snapshot carries no self-digest
    // beyond current_event_digest, so stamping needs no re-signing.
    current_snapshot: {
      semantic_state: "IDLE",
      simulated: true,
      reason_codes: [FIXTURE_MARKER],
      authority_delta: 0,
    },
    authority_delta: 0,
  };
  last = snap.current_event_digest;

  const hello = {
    schema: REALM_HELLO_SCHEMA,
    source,
    contracts_digest: null, // set from the caller-supplied admission contract
    authority_delta: 0,
  };

  const ev = (state, opts = {}) => {
    const f = {
      schema: REALM_EVENT_SCHEMA,
      event_id: `fixture-${++seq}`,
      sequence: seq,
      issued_at: TS,
      ttl_ms: 2500,
      source,
      kind: opts.kind ?? "presence.state_changed",
      authority_delta: 0,
      reason_codes: opts.codes ?? [],
      payload: opts.extra ?? {},
      prev_event_digest: last,
    };
    if (state !== undefined) f.semantic_state = state;
    if (opts.evidence_refs) f.evidence_refs = opts.evidence_refs;
    return f;
  };
  // THE signing choke point: simulation is stamped BEFORE digest computation,
  // so every fixture event body carries its marker inside the signature.
  const sign = (f) => {
    stampSimulated(f);
    const { event_digest, ...body } = f;
    f.event_digest = realmEventDigest(body);
    last = f.event_digest;
    return f;
  };

  const mission = { mission_id: "fixture-mission-001", label: "Fixture qualification", phase: "VERIFY" };

  switch (scenario) {
    case "idle":
      return [hello, snap];
    case "mission_work":
      return [
        hello,
        snap,
        sign(ev("THINKING", { extra: { mission } })),
        sign(ev("WORKING", { extra: { mission } })),
        sign(ev("VERIFYING", { extra: { mission }, codes: ["SAT_ACTIVE"] })),
        sign(ev("VERIFIED_DONE", { extra: { mission }, evidence_refs: ["receipt:sha256:" + HEX64("c")] })),
      ];
    case "refusal":
      return [hello, snap, sign(ev("REFUSED", { extra: { mission }, codes: ["MISSION_BINDING_MISSING"] }))];
    case "recovery":
      return [
        hello,
        snap,
        sign(ev("RECOVERY", { extra: { mission }, codes: ["RESYNC_REQUIRED"] })),
        sign(ev("VERIFYING", { extra: { mission }, codes: ["SAT_PENDING"] })),
      ];
    case "integrity_breach": {
      const good = sign(ev("WORKING", { extra: { mission } }));
      const breach = ev("VERIFYING", { extra: { mission }, codes: ["SAT_ACTIVE"] });
      stampSimulated(breach); // even the deliberately-stale frame carries the marker
      breach.ttl_ms = 999999; // stale signature -> wire law refuses DIGEST_MISMATCH
      return [hello, snap, good, breach];
    }
    default:
      throw new Error(`unknown_scenario:${scenario}`);
  }
}

// Build a complete fixture envelope bound to an explicit admission contract.
// `admitted` MUST name the fixture component identity; a fixture bound to a
// real producer's component id is refused at build time.
export function buildFixtureTranscript({ scenario, admitted, peer } = {}) {
  const blocked_by = [];
  const { source } = defaultIdentity();
  if (!FIXTURE_SCENARIOS.includes(scenario)) blocked_by.push(`unknown_scenario:${scenario}`);
  if (!admitted || typeof admitted !== "object") {
    blocked_by.push("admitted_not_object");
  } else if (admitted.component !== source.component) {
    // A fixture may never impersonate a production source component.
    blocked_by.push("fixture_bound_to_production_component");
  }
  if (!peer || typeof peer !== "object") blocked_by.push("peer_not_object");

  // Admission identity normalization: a caller-supplied peer uid is adopted
  // when the admission contract omits it (fixture peers are same-user).
  const normalizedAdmitted =
    admitted && admitted.uid === undefined && peer && peer.uid !== undefined
      ? { ...admitted, uid: peer.uid }
      : admitted;

  let transcript = [];
  if (blocked_by.length === 0) {
    transcript = buildFrames(scenario);
    const contracts = normalizedAdmitted.contracts_digest;
    for (const frame of transcript) {
      if (frame.schema === REALM_HELLO_SCHEMA) frame.contracts_digest = contracts;
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: "bizra.realm.fixture.v0.1",
    marker: FIXTURE_MARKER,
    simulated: true,
    scenario,
    source_component: source.component,
    transcript: Object.freeze(transcript),
    admitted: normalizedAdmitted ? Object.freeze({ ...normalizedAdmitted }) : undefined,
    peer: peer ? Object.freeze({ ...peer }) : undefined,
  });
}

// Walk a built fixture through wire law + reducer and prove BOTH:
//   (a) the intended semantic outcome, and
//   (b) the derived render view carries simulated:true — production-inadmissible.
export function qualifyFixture({ scenario, admitted, peer, now_ms } = {}) {
  const fixture = buildFixtureTranscript({ scenario, admitted, peer });
  const blocked_by = [...fixture.blocked_by];
  if (!fixture.ok) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by), fixture });
  }

  const derivation = deriveRenderRequest({
    transcript: fixture.transcript,
    admitted: fixture.admitted,
    peer: fixture.peer,
    now_ms,
  });

  const expected_state = {
    idle: "IDLE",
    mission_work: "VERIFIED_DONE",
    refusal: "REFUSED",
    recovery: "VERIFYING",
    integrity_breach: "UNKNOWN",
  }[scenario];

  if (scenario === "integrity_breach") {
    if (derivation.ok !== false) blocked_by.push("breach_walked_clean");
  } else if (derivation.ok !== true) {
    blocked_by.push(...derivation.blocked_by);
  }
  if (derivation.render_request.semantic_state !== expected_state) {
    blocked_by.push(
      `unexpected_state:${derivation.render_request.semantic_state}:expected:${expected_state}`,
    );
  }
  if (derivation.render_request.simulated !== true) {
    // THE law of this slice: a fixture can never render as production truth.
    blocked_by.push("simulation_marker_lost_in_derivation");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    scenario,
    expected_state,
    observed_state: derivation.render_request.semantic_state,
    render_request: derivation.render_request,
  });
}

// ---------------------------------------------------------------------------
// Universal slice contract
// ---------------------------------------------------------------------------

function validateInputShape(input) {
  const blocked_by = [];
  if (input.scenario !== undefined && !FIXTURE_SCENARIOS.includes(input.scenario)) {
    blocked_by.push(`unknown_scenario:${input.scenario}`);
  }
  if (input.admitted !== undefined && typeof input.admitted !== "object") {
    blocked_by.push("admitted_not_object");
  }
  if (input.peer !== undefined && typeof input.peer !== "object") {
    blocked_by.push("peer_not_object");
  }
  return blocked_by;
}

export function planDrsFixturePublisher({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DRS_FIXTURE_PUBLISHER_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    blocked_by.push(...validateInputShape(input));
  }
  return Object.freeze({
    schema: DRS_FIXTURE_PUBLISHER_SCHEMA,
    truth_label: DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildDrsFixturePublisherPayload(input) {
  const qualification = qualifyFixture(input);
  const body = {
    schema: DRS_FIXTURE_PUBLISHER_SCHEMA,
    truth_label: DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    // Null-normalized: canonical JSON v1 admits no undefined values, and a
    // failed early-return qualification still hashes deterministically.
    qualification: {
      scenario: input && input.scenario !== undefined ? input.scenario : null,
      expected_state: qualification.expected_state ?? null,
      observed_state: qualification.observed_state ?? null,
      blocked_by: qualification.blocked_by,
    },
    ok: qualification.ok,
    boundary: drsFixturePublisherBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

export function verifyDrsFixturePublisher(payload) {
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, reason: "payload_not_object" });
  }
  const { content_hash, ...body } = payload;
  if (sha256CanonicalJsonV1(body) !== content_hash) {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch" });
  }
  if (body.schema !== DRS_FIXTURE_PUBLISHER_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  if (body.truth_label !== DRS_FIXTURE_PUBLISHER_TRUTH_LABEL) {
    return Object.freeze({ ok: false, reason: "truth_label_mismatch" });
  }
  for (const [key, value] of Object.entries(drsFixturePublisherBoundary())) {
    if (body.boundary?.[key] !== value) {
      return Object.freeze({ ok: false, reason: `boundary_violation:${key}` });
    }
  }
  if (body.ok !== true) {
    return Object.freeze({ ok: false, reason: "qualification_not_ok" });
  }
  return Object.freeze({ ok: true, reason: null });
}

export function drsFixturePublisherBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

export function runDrsFixturePublisher({ consent, input } = {}) {
  const plan = planDrsFixturePublisher({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DRS_FIXTURE_PUBLISHER_SCHEMA,
      truth_label: DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
      boundary: drsFixturePublisherBoundary(),
      blocked_by: plan.blocked_by,
    });
  }

  const blocked_by = [];
  const payload = buildDrsFixturePublisherPayload(input);
  if (payload.ok === false) blocked_by.push(...payload.qualification.blocked_by);

  const verified = verifyDrsFixturePublisher(payload);
  if (!verified.ok) blocked_by.push(`verify_failed:${verified.reason}`);

  const tampered = { ...payload, truth_label: "TAMPER_PROBE" };
  if (verifyDrsFixturePublisher(tampered).ok) {
    blocked_by.push("tamper_probe_passed");
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DRS_FIXTURE_PUBLISHER_SCHEMA,
    truth_label: DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: drsFixturePublisherBoundary(),
    blocked_by: Object.freeze(blocked_by),
    qualification: payload.qualification,
  });
}
