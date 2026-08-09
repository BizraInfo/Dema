// DEMA-CONVENE-PERSONAL-COUNCIL-1A — the alpha edge.
//
// Proves an intent entering at Dema reaches all seven seats and returns
// attributed. Deliberately also proves what it does NOT do: nobody reasoned.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convenePersonalCouncil,
  verifyConvenedCouncil,
} from "../packages/core/src/dema-convene-personal-council.js";
import { AGENT_FLEET_ROLES } from "../packages/core/src/node0-agent-fleet-roles.js";

const INTENT = "Tell me what is true about Node0 today and what to do next.";
const convene = (overrides = {}) =>
  convenePersonalCouncil({
    intent: INTENT,
    roleContracts: AGENT_FLEET_ROLES,
    ...overrides,
  });

test("DCC-01 one intent reaches all seven seats, in stable order", () => {
  const a = convene();
  assert.equal(a.convened, true);
  assert.equal(a.seat_count, 7, "the personal team is seven");
  assert.deepEqual(
    a.charges.map((c) => c.role_id),
    [
      "pat-1-archivist",
      "pat-2-extractor",
      "pat-3-cartographer",
      "pat-4-scout",
      "pat-5-applicability-engineer",
      "pat-6-reproduction-engineer",
      "pat-7-scribe",
    ],
  );
  // Same intent convenes the same council — the plan is comparable across runs.
  assert.equal(convene().content_hash, a.content_hash);
});

test("DCC-02 SAT is never convened — it is not Dema's to charge", () => {
  const envelope = convene();
  for (const charge of envelope.charges) {
    assert.ok(
      charge.role_id.startsWith("pat-"),
      `${charge.role_id} is not on the personal team`,
    );
  }
  // The roster contains SAT and it was ignored, not refused-then-included.
  assert.equal(AGENT_FLEET_ROLES.filter((r) => r.team === "SAT").length, 5);
});

test("DCC-03 HONESTY — the council convened but nobody reasoned", () => {
  const envelope = convene();
  assert.equal(
    envelope.reasoning_performed,
    false,
    "no adapter is bound; this must never read as the team thinking",
  );
  for (const charge of envelope.charges) {
    assert.equal(charge.reasoning_available, false);
  }
  assert.match(envelope.what_this_does_not_prove, /does not prove any seat reasoned/i);
  assert.equal(envelope.truth_label, "DESIGNED_NOT_LIVE");
});

test("DCC-04 each charge carries its contract's bounds, not invented ones", () => {
  const envelope = convene();
  for (const charge of envelope.charges) {
    const contract = AGENT_FLEET_ROLES.find((r) => r.role_id === charge.role_id);
    assert.equal(charge.bounded_by.mint_allowed, contract.authority.mint_allowed);
    assert.equal(charge.bounded_by.egress_allowed, contract.authority.egress_allowed);
    assert.equal(
      charge.bounded_by.corpus_write_allowed,
      contract.authority.corpus_write_allowed,
    );
    assert.equal(charge.may_spawn_subagents, contract.spawn_limit > 0);
  }
});

test("DCC-05 the boundary stays all-false — convening executes nothing", () => {
  const envelope = convene();
  for (const key of [
    "model_invocation_performed",
    "model_loaded",
    "prompt_executed",
    "network_used",
    "runtime_execution_performed",
    "filesystem_write_performed",
    "tool_executed",
  ]) {
    assert.equal(envelope.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("DCC-06 NEGATIVE CONTROL — a seat that could widen authority is not charged", () => {
  // Without this, DCC-01 would pass against a kernel that charges anything.
  const widened = AGENT_FLEET_ROLES.map((r) =>
    r.role_id === "pat-4-scout"
      ? { ...r, authority: { ...r.authority, spawn_widens_authority: true } }
      : r,
  );
  const envelope = convene({ roleContracts: widened });
  assert.equal(envelope.convened, false);
  assert.equal(envelope.reason, "seat_would_widen_authority");
  assert.equal(envelope.detail, "pat-4-scout");
  assert.equal(envelope.charges.length, 0, "a refusal charges nobody");
});

test("DCC-07 an unknown seat refuses rather than being silently dropped", () => {
  const renamed = AGENT_FLEET_ROLES.map((r) =>
    r.role_id === "pat-7-scribe" ? { ...r, role_id: "pat-7-renamed" } : r,
  );
  const envelope = convene({ roleContracts: renamed });
  assert.equal(envelope.convened, false);
  assert.equal(envelope.reason, "unknown_seat");
  assert.equal(envelope.detail, "pat-7-renamed");
});

test("DCC-08 empty intent and empty roster refuse", () => {
  assert.equal(convene({ intent: "" }).reason, "intent_required");
  assert.equal(convene({ intent: "   " }).reason, "intent_required");
  assert.equal(convenePersonalCouncil().reason, "intent_required");
  assert.equal(
    convene({ roleContracts: AGENT_FLEET_ROLES.filter((r) => r.team === "SAT") })
      .reason,
    "no_personal_team_on_roster",
  );
});

test("DCC-09 the digest binds the intent — an edited plan is caught", () => {
  const envelope = convene();
  assert.deepEqual(verifyConvenedCouncil(envelope), { ok: true });

  const swapped = { ...envelope, intent: "Do something else entirely." };
  assert.equal(verifyConvenedCouncil(swapped).ok, false);
  assert.equal(verifyConvenedCouncil(swapped).reason, "content_hash_mismatch");

  const tamperedCharge = {
    ...envelope,
    charges: envelope.charges.map((c, i) =>
      i === 0 ? { ...c, charge: "do whatever you like" } : c,
    ),
  };
  assert.equal(verifyConvenedCouncil(tamperedCharge).ok, false);
  assert.equal(verifyConvenedCouncil({ convened: false }).reason, "not_convened");
});

test("DCC-10 a different intent convenes a different plan", () => {
  const a = convene();
  const b = convene({ intent: "Something completely different." });
  assert.notEqual(a.content_hash, b.content_hash);
  // But the same seats, in the same order — routing is stable, content is not.
  assert.deepEqual(
    a.charges.map((c) => c.role_id),
    b.charges.map((c) => c.role_id),
  );
});
