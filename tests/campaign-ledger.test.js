// NODE0-CAMPAIGN-LEDGER-1A — hash-chained campaign ledger tests (red-first).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendCampaignEvent,
  buildCampaignLedger,
  deriveCampaignState,
  verifyCampaignLedger,
} from "../packages/core/src/campaign-ledger.js";

const lease = { max_model_calls: 1, max_service_transitions: 0, network_mode: "LOOPBACK_ONLY" };
const fresh = () => buildCampaignLedger({ campaign_id: "C-1", goal: "g", definition_of_done: ["d"], authority_lease: lease });
const clone = (x) => JSON.parse(JSON.stringify(x));

test("fresh ledger verifies and derives RUNNING with zero calls", () => {
  const l = fresh();
  assert.deepEqual(verifyCampaignLedger(l), { ok: true, reasons: [] });
  assert.deepEqual(deriveCampaignState(l), { status: "RUNNING", model_calls_used: 0, service_transitions_used: 0 });
  assert.equal(l.boundary.runtime_executed, false);
  assert.equal(l.authority_delta, 0);
});

test("a call within budget verifies; over budget is rejected", () => {
  let l = appendCampaignEvent(fresh(), { kind: "MODEL_CALL" });
  assert.equal(verifyCampaignLedger(l).ok, true);
  l = appendCampaignEvent(l, { kind: "MODEL_CALL" });
  assert.ok(verifyCampaignLedger(l).reasons.includes("model_call_budget_exceeded"));
});

test("rewriting history, widening the lease, or truncating is rejected", () => {
  const base = appendCampaignEvent(fresh(), { kind: "MODEL_CALL" });
  const rewritten = clone(base);
  rewritten.events[1].kind = "OBSERVATION";
  assert.ok(verifyCampaignLedger(rewritten).reasons.includes("event_hash_mismatch"));

  const widened = clone(base);
  widened.contract.authority_lease.max_model_calls = 999;
  assert.ok(verifyCampaignLedger(widened).reasons.includes("contract_hash_mismatch"));

  const truncated = clone(base);
  truncated.events.pop();
  assert.ok(verifyCampaignLedger(truncated).reasons.includes("head_hash_mismatch"));
});

test("stored counters cannot disagree with events (reset is rejected)", () => {
  const l = appendCampaignEvent(fresh(), { kind: "MODEL_CALL" });
  const forged = clone(l);
  forged.state.model_calls_used = 0;
  assert.ok(verifyCampaignLedger(forged).reasons.includes("state_mismatch"));
});

test("terminal status cannot return to RUNNING without an amendment", () => {
  let l = appendCampaignEvent(fresh(), { kind: "STATUS", status: "DOD_REACHED" });
  l = appendCampaignEvent(l, { kind: "STATUS", status: "RUNNING" });
  assert.ok(verifyCampaignLedger(l).reasons.includes("terminal_resurrected"));
  const ok = appendCampaignEvent(
    appendCampaignEvent(fresh(), { kind: "STATUS", status: "DOD_REACHED" }),
    { kind: "STATUS", status: "RUNNING", amendment_of: 3 },
  );
  assert.equal(verifyCampaignLedger(ok).ok, true);
});

test("non-zero authority_delta, bad lease, and unknown kinds fail closed", () => {
  assert.throws(() => appendCampaignEvent(fresh(), { kind: "MODEL_CALL", authority_delta: 1 }), /authority_delta/);
  assert.throws(() => appendCampaignEvent(fresh(), { kind: "NOPE" }), /kind/);
  assert.throws(() => buildCampaignLedger({ campaign_id: "x", goal: "g", definition_of_done: [], authority_lease: lease }), /definition_of_done/);
  assert.throws(() => buildCampaignLedger({ campaign_id: "x", goal: "g", definition_of_done: ["d"], authority_lease: { max_model_calls: -1, max_service_transitions: 0 } }), /lease/);
});

test("append is pure: input ledger is not mutated", () => {
  const l = fresh();
  const before = JSON.stringify(l);
  appendCampaignEvent(l, { kind: "MODEL_CALL" });
  assert.equal(JSON.stringify(l), before);
});
