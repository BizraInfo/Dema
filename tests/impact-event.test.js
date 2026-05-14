import test from "node:test";
import assert from "node:assert/strict";

import { buildImpactEventStub } from "../packages/impact/src/impact-event.js";

test("ImpactEvent stub is schema-tagged and cannot claim reward or external validation", () => {
  const event = buildImpactEventStub({
    mission_id: "mission_123",
    evidence_root_hash: "sha256:evidence",
    summary: "bounded local verification preview"
  });

  assert.equal(event.schema, "bizra.dema.impact_event_stub.v0.1");
  assert.equal(event.mode, "PREVIEW_ONLY");
  assert.equal(event.locality, "local_placeholder");
  assert.equal(event.imp_minted, false);
  assert.equal(event.reward_claimed, false);
  assert.equal(event.global_verification, false);
  assert.equal(event.sat_permit, false);
  assert.equal(event.boundary.execution_enabled, false);
  assert.equal(event.boundary.receipt_minted, false);
});

test("ImpactEvent stub survives JSON round trip", () => {
  const event = buildImpactEventStub({ mission_id: "mission_123" });
  const roundTrip = JSON.parse(JSON.stringify(event));

  assert.equal(roundTrip.schema, "bizra.dema.impact_event_stub.v0.1");
  assert.equal(roundTrip.imp_minted, false);
  assert.equal(roundTrip.reward_claimed, false);
});
