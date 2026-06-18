import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNCIL_SEAT_PAT_ROUTING_SCHEMA,
  COUNCIL_SEAT_NAMES,
  COUNCIL_SEAT_PAT_ROUTES,
  normalizeCouncilSeatToken,
  detectCouncilSeatInInput,
  buildCouncilSeatPatRoutingPreview,
  formatCouncilSeatPatRoutingResponse,
} from "../packages/core/src/council-seat-pat-routing.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("UX3-01: five council seats map to PAT roles with stable agent ids", () => {
  assert.equal(COUNCIL_SEAT_NAMES.length, 5);
  assert.equal(COUNCIL_SEAT_PAT_ROUTES.Guardian.pat_role, "Auditor");
  assert.equal(COUNCIL_SEAT_PAT_ROUTES.Builder.pat_agent_id, "pat-engineer");
  assert.equal(COUNCIL_SEAT_PAT_ROUTES.Archivist.pat_role, "Scribe");
});

test("UX3-02: normalizeCouncilSeatToken is case-insensitive", () => {
  assert.equal(normalizeCouncilSeatToken("guardian"), "Guardian");
  assert.equal(normalizeCouncilSeatToken("BUILDER"), "Builder");
  assert.equal(normalizeCouncilSeatToken("nope"), null);
});

test("UX3-03: detectCouncilSeatInInput handles triggers and bare seat tokens", () => {
  assert.equal(detectCouncilSeatInInput("guardian"), "Guardian");
  assert.equal(detectCouncilSeatInInput("talk to the reasoner"), "Reasoner");
  assert.equal(detectCouncilSeatInInput("ask the critic"), "Critic");
  assert.equal(detectCouncilSeatInInput("council seat archivist"), "Archivist");
  assert.equal(detectCouncilSeatInInput("ask status"), null);
});

test("UX3-04: routed preview carries schema, boundary, and routing fields", () => {
  const out = buildCouncilSeatPatRoutingPreview({ seat: "Builder" });
  assert.equal(out.schema, COUNCIL_SEAT_PAT_ROUTING_SCHEMA);
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(out.routing_status, "routed_preview_only");
  assert.equal(out.selected_seat, "Builder");
  assert.equal(out.pat_role, "Engineer");
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(Object.isFrozen(out), true);
});

test("UX3-05: unresolved seat returns seat_unresolved without throwing", () => {
  const out = buildCouncilSeatPatRoutingPreview({ seat: "oracle" });
  assert.equal(out.routing_status, "seat_unresolved");
  assert.equal(out.selected_seat, null);
});

test("UX3-06: formatCouncilSeatPatRoutingResponse mentions preview-only posture", () => {
  const routed = buildCouncilSeatPatRoutingPreview({ seat: "Guardian" });
  const text = formatCouncilSeatPatRoutingResponse(routed);
  assert.match(text, /preview only/i);
  assert.match(text, /pat-auditor/);
  const table = formatCouncilSeatPatRoutingResponse(
    buildCouncilSeatPatRoutingPreview(),
  );
  assert.match(table, /Guardian/);
  assert.match(table, /talk to the guardian/i);
});

test("UX3-07: preview is deterministic for fixed clock", () => {
  const fixed = new Date("2026-06-18T12:00:00.000Z");
  const a = buildCouncilSeatPatRoutingPreview({
    seat: "Critic",
    now: fixed,
  });
  const b = buildCouncilSeatPatRoutingPreview({
    seat: "Critic",
    now: fixed,
  });
  assert.deepEqual(a, b);
});
