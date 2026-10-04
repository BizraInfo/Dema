import test from "node:test";
import assert from "node:assert/strict";

import {
  planDrsFixturePublisher,
  buildDrsFixturePublisherPayload,
  verifyDrsFixturePublisher,
  runDrsFixturePublisher,
  buildFixtureTranscript,
  qualifyFixture,
  FIXTURE_MARKER,
  FIXTURE_SCENARIOS,
  DRS_FIXTURE_PUBLISHER_SCHEMA,
  DRS_FIXTURE_PUBLISHER_TRUTH_LABEL,
  DRS_FIXTURE_PUBLISHER_GO_PHRASE,
} from "../packages/core/src/drs-fixture-publisher.js";
import { runDrsFixturePublisherCheck } from "../scripts/review/drs-fixture-publisher-check.mjs";

const HEX64 = (ch) => ch.repeat(64);

function makeAdmitted() {
  return {
    component: "node0.realm_projection.fixture",
    revision: `sha256:${HEX64("f")}`,
    contracts_digest: `sha256:${HEX64("d")}`,
    uid: 1000,
  };
}
function makePeer() {
  return { uid: 1000, pid: 1 };
}
function build(scenario, overrides = {}) {
  return buildFixtureTranscript({
    scenario,
    admitted: overrides.admitted ?? makeAdmitted(),
    peer: overrides.peer ?? makePeer(),
  });
}
function qualify(scenario, overrides = {}) {
  return qualifyFixture({
    scenario,
    admitted: overrides.admitted ?? makeAdmitted(),
    peer: overrides.peer ?? makePeer(),
    now_ms: overrides.now_ms,
  });
}

test("scenario registry is closed and carries the SIMULATED_FIXTURE marker", () => {
  assert.deepEqual([...FIXTURE_SCENARIOS], [
    "idle",
    "mission_work",
    "refusal",
    "recovery",
    "integrity_breach",
  ]);
  assert.equal(FIXTURE_MARKER, "SIMULATED_FIXTURE");
});

test("every built fixture stamps simulated:true on its snapshot and event payloads", () => {
  for (const scenario of FIXTURE_SCENARIOS) {
    const f = build(scenario);
    assert.equal(f.ok, true, `${scenario}: ${f.blocked_by.join(",")}`);
    assert.equal(f.simulated, true);
    const snap = f.transcript.find((x) => x.schema === "bizra.realm.resync.v0.1");
    assert.equal(snap.current_snapshot.simulated, true);
    assert.ok(snap.current_snapshot.reason_codes.includes(FIXTURE_MARKER));
    for (const frame of f.transcript) {
      if (frame.schema === "bizra.realm.event.v0.1") {
        assert.equal(frame.payload.simulated, true, scenario);
      }
    }
  }
});

test("fixture digests stay internally consistent despite payload stamping (stamp-before-sign)", () => {
  // The wire law itself is the judge: a clean walk means every digest matched.
  for (const scenario of ["idle", "mission_work", "refusal", "recovery"]) {
    const q = qualify(scenario);
    assert.equal(q.ok, true, `${scenario}: ${q.blocked_by.join(",")}`);
  }
});

test("a fixture bound to a production component id is refused at build time", () => {
  const impersonator = build("idle", {
    admitted: { ...makeAdmitted(), component: "node0.realm_projection" },
  });
  assert.equal(impersonator.ok, false);
  assert.ok(impersonator.blocked_by.includes("fixture_bound_to_production_component"));
});

test("unknown scenarios are refused", () => {
  const f = build("avatar_dance_party");
  assert.equal(f.ok, false);
  assert.ok(f.blocked_by.some((b) => b.startsWith("unknown_scenario:")));
});

// ---------------------------------------------------------------------------
// Qualification outcomes per golden scenario
// ---------------------------------------------------------------------------

const EXPECTED = {
  idle: "IDLE",
  mission_work: "VERIFIED_DONE",
  refusal: "REFUSED",
  recovery: "VERIFYING",
  integrity_breach: "UNKNOWN",
};

test("each golden fixture reduces to its expected semantic state", () => {
  for (const scenario of FIXTURE_SCENARIOS) {
    const q = qualify(scenario);
    assert.equal(q.ok, true, `${scenario}: ${q.blocked_by.join(",")}`);
    assert.equal(q.observed_state, EXPECTED[scenario]);
  }
});

test("THE LAW: a fully valid fixture still renders simulated:true — never production truth", () => {
  // mission_work walks cleanly to VERIFIED_DONE with evidence refs; if any
  // layer dropped the marker this would be indistinguishable from production.
  const q = qualify("mission_work");
  assert.equal(q.observed_state, "VERIFIED_DONE");
  assert.equal(q.render_request.simulated, true);
  assert.ok(q.render_request.evidence_refs.length >= 1);
});

test("integrity-breach fixture fails the walk AND stays simulated-marked", () => {
  const q = qualify("integrity_breach");
  assert.equal(q.ok, true); // qualification PASSES because refusal is expected
  assert.equal(q.observed_state, "UNKNOWN");
  assert.equal(q.render_request.simulated, true);
});

// ---------------------------------------------------------------------------
// Universal slice contract
// ---------------------------------------------------------------------------

test("plan is fail-closed without exact consent or with malformed input", () => {
  const noConsent = planDrsFixturePublisher({ consent: "wrong", input: {} });
  assert.equal(noConsent.eligible, false);
  assert.ok(noConsent.blocked_by.includes("consent_phrase_mismatch"));

  const badInput = planDrsFixturePublisher({
    consent: DRS_FIXTURE_PUBLISHER_GO_PHRASE,
    input: { scenario: "nope", admitted: 7 },
  });
  assert.equal(badInput.eligible, false);
  assert.ok(badInput.blocked_by.some((b) => b.startsWith("unknown_scenario:")));
  assert.ok(badInput.blocked_by.includes("admitted_not_object"));
});

test("payload is content-addressed; boundary all-false; verify rejects tamper", () => {
  const input = { scenario: "mission_work", admitted: makeAdmitted(), peer: makePeer() };
  const payload = buildDrsFixturePublisherPayload(input);
  assert.equal(payload.schema, DRS_FIXTURE_PUBLISHER_SCHEMA);
  assert.equal(payload.truth_label, DRS_FIXTURE_PUBLISHER_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(verifyDrsFixturePublisher(payload).ok, true);
  assert.equal(
    verifyDrsFixturePublisher({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok,
    false,
  );
  // A FAILED qualification cannot be verified into a green claim.
  const failing = buildDrsFixturePublisherPayload({ ...input, scenario: "nope" });
  assert.equal(failing.ok, false);
  assert.equal(verifyDrsFixturePublisher({ ...failing, content_hash: failing.content_hash }).ok, false);
});

test("orchestrator returns ok on a qualifying fixture; boundary all-false", () => {
  const r = runDrsFixturePublisher({
    consent: DRS_FIXTURE_PUBLISHER_GO_PHRASE,
    input: { scenario: "mission_work", admitted: makeAdmitted(), peer: makePeer(), now_ms: 5000 },
  });
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.equal(r.qualification.observed_state, "VERIFIED_DONE");
  assert.equal(r.boundary.live_execution_performed, false);
});

test("orchestrator fails closed on a non-qualifying fixture", () => {
  // A fixture whose peer uid does not match its admission contract is refused
  // by the wire law (SOURCE_UNADMITTED), so the walk cannot reach IDLE.
  const bad = runDrsFixturePublisher({
    consent: DRS_FIXTURE_PUBLISHER_GO_PHRASE,
    input: { scenario: "idle", admitted: makeAdmitted(), peer: { uid: 1337, pid: 1 } },
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.blocked_by.some((b) => b.includes("SOURCE_UNADMITTED") || b.includes("unexpected_state")));
});

test("review gate closes the loop over the canonical fixture", () => {
  const result = runDrsFixturePublisherCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DRS_FIXTURE_PUBLISHER_SCHEMA);
  assert.equal(result.truth_label, DRS_FIXTURE_PUBLISHER_TRUTH_LABEL);
});
