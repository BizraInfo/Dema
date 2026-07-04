import test from "node:test";
import assert from "node:assert/strict";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

import {
  planDemaStewardChain,
  buildDemaStewardChainPayload,
  verifyDemaStewardChain,
  runDemaStewardChain,
  daysFromCivilDate,
  DEMA_STEWARD_CHAIN_SCHEMA,
  DEMA_STEWARD_CHAIN_TRUTH_LABEL,
  DEMA_STEWARD_CHAIN_GO_PHRASE,
} from "../packages/core/src/dema-steward-chain.js";
import { buildDemaStandPayload } from "../packages/core/src/dema-stand.js";
import {
  runDemaStewardChainCheck,
  buildStewardChainCanonicalFixture,
} from "../scripts/review/dema-steward-chain-check.mjs";
import { DEMA_STAND_CANONICAL_FIXTURE as STAND_FIXTURE } from "../scripts/review/dema-stand-check.mjs";

function receiptFor(day, drain = "less") {
  return buildDemaStandPayload({
    ...structuredClone(STAND_FIXTURE),
    observed_at_iso: `${day}T08:00:00Z`,
    drain,
  });
}

function chainInput(days, today, required = 7) {
  return {
    today_utc_date: today,
    required_days: required,
    receipts: days.map((d) => (typeof d === "string" ? receiptFor(d) : d)),
  };
}

const FIXTURE = () => buildStewardChainCanonicalFixture();

// ---------------------------------------------------------------------------
// Scaffold proof contract
// ---------------------------------------------------------------------------

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planDemaStewardChain({ consent: "wrong", input: FIXTURE() });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planDemaStewardChain({
    consent: DEMA_STEWARD_CHAIN_GO_PHRASE,
    input: FIXTURE(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildDemaStewardChainPayload(FIXTURE());
  assert.equal(payload.schema, DEMA_STEWARD_CHAIN_SCHEMA);
  assert.equal(payload.truth_label, DEMA_STEWARD_CHAIN_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  for (const [key, value] of Object.entries(payload.boundary)) {
    assert.equal(value, false, `boundary.${key} must be false`);
  }
});

test("verify accepts a freshly built payload", () => {
  const payload = buildDemaStewardChainPayload(FIXTURE());
  assert.equal(verifyDemaStewardChain(payload).ok, true);
});

test("verify rejects a tampered content_hash", () => {
  const payload = buildDemaStewardChainPayload(FIXTURE());
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  assert.equal(verifyDemaStewardChain(tampered).ok, false);
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildDemaStewardChainPayload(FIXTURE());
  const forged = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaStewardChain(forged).ok, false);
});

test("verify re-derives from raw input: forged verdict + recomputed hash still rejected", () => {
  const payload = buildDemaStewardChainPayload(FIXTURE());
  const { content_hash: _drop, ...body } = payload;
  body.verdict = "COMPLETE";
  body.day_report = { title: "forged", days: [], drain_series: [], drain_summary: {}, receipt_hashes: [] };
  const laundered = { ...body, content_hash: `sha256:${sha256(stableStringify(body))}` };
  const verdict = verifyDemaStewardChain(laundered);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason_code, "derived_fields_mismatch");
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runDemaStewardChainCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, DEMA_STEWARD_CHAIN_SCHEMA);
  assert.equal(result.truth_label, DEMA_STEWARD_CHAIN_TRUTH_LABEL);
  assert.equal(result.payload.verdict, "IN_PROGRESS");
  assert.equal(result.payload.progress, "3/7");
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runDemaStewardChain({
    consent: DEMA_STEWARD_CHAIN_GO_PHRASE,
    input: FIXTURE(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});

// ---------------------------------------------------------------------------
// Chain domain: honest day math, fail-closed links, no fabricated days
// ---------------------------------------------------------------------------

test("seven consecutive verified days => COMPLETE with the day report", () => {
  const days = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06", "2026-07-07"];
  const payload = buildDemaStewardChainPayload(chainInput(days, "2026-07-07"));
  assert.equal(payload.verdict, "COMPLETE");
  assert.equal(payload.progress, "7/7");
  assert.equal(payload.next_required_day, null);
  assert.equal(payload.day_report.days.length, 7);
  assert.equal(payload.day_report.drain_summary.less, 7);
  assert.equal(verifyDemaStewardChain(payload).ok, true);
});

test("day 1 only => IN_PROGRESS 1/7 and next required day is tomorrow", () => {
  const payload = buildDemaStewardChainPayload(chainInput(["2026-07-03"], "2026-07-03"));
  assert.equal(payload.verdict, "IN_PROGRESS");
  assert.equal(payload.progress, "1/7");
  assert.equal(payload.next_required_day, "2026-07-04");
  assert.equal(payload.day_report, null);
});

test("gap inside the chain => CHAIN_BROKEN with the missing date named", () => {
  const payload = buildDemaStewardChainPayload(
    chainInput(["2026-07-01", "2026-07-03"], "2026-07-03"),
  );
  assert.equal(payload.verdict, "CHAIN_BROKEN");
  assert.deepEqual(payload.chain.missing_days, ["2026-07-02"]);
});

test("skipped morning (no receipt yesterday) => CHAIN_BROKEN", () => {
  const payload = buildDemaStewardChainPayload(
    chainInput(["2026-07-01", "2026-07-02"], "2026-07-04"),
  );
  assert.equal(payload.verdict, "CHAIN_BROKEN");
  assert.ok(payload.chain.missing_days.includes("2026-07-03"));
});

test("a tampered receipt fails the whole chain closed", () => {
  const good = receiptFor("2026-07-02");
  const bad = { ...receiptFor("2026-07-03"), truth_label: "FORGED" };
  const payload = buildDemaStewardChainPayload(
    chainInput([good, bad], "2026-07-03"),
  );
  assert.equal(payload.verdict, "RECEIPTS_INVALID");
  assert.equal(payload.invalid_receipts.length, 1);
  assert.equal(payload.chain, null);
  assert.equal(payload.day_report, null);
});

test("two receipts on the same day count as one day, flagged as duplicate", () => {
  const payload = buildDemaStewardChainPayload(
    chainInput(["2026-07-03", receiptFor("2026-07-03", "same")], "2026-07-03"),
  );
  assert.equal(payload.chain.days_present, 1);
  assert.deepEqual(payload.chain.duplicate_days, ["2026-07-03"]);
  assert.equal(payload.verdict, "IN_PROGRESS");
});

test("drain series is recorded verbatim per day, never inferred", () => {
  const payload = buildDemaStewardChainPayload(
    chainInput(
      [receiptFor("2026-07-01", "more"), receiptFor("2026-07-02", "same"), receiptFor("2026-07-03", "less")],
      "2026-07-03",
    ),
  );
  assert.deepEqual(
    payload.chain.drain_series.map((d) => d.drain),
    ["more", "same", "less"],
  );
});

test("no receipts => NOT_STARTED, next required day is today", () => {
  const payload = buildDemaStewardChainPayload(chainInput([], "2026-07-03"));
  assert.equal(payload.verdict, "NOT_STARTED");
  assert.equal(payload.next_required_day, "2026-07-03");
});

test("day math is pure and correct across a month boundary", () => {
  assert.equal(daysFromCivilDate("2026-07-01") - daysFromCivilDate("2026-06-30"), 1);
  assert.equal(daysFromCivilDate("2026-03-01") - daysFromCivilDate("2026-02-28"), 1);
  assert.equal(daysFromCivilDate("2024-03-01") - daysFromCivilDate("2024-02-28"), 2);
});

test("malformed input fails closed with named blocks", () => {
  const plan = planDemaStewardChain({
    consent: DEMA_STEWARD_CHAIN_GO_PHRASE,
    input: { today_utc_date: "yesterday", required_days: 99, receipts: "nope" },
  });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("today_utc_date_invalid"));
  assert.ok(plan.blocked_by.includes("required_days_invalid"));
  assert.ok(plan.blocked_by.includes("receipts_must_be_array"));
  const rejected = buildDemaStewardChainPayload({ nope: true });
  assert.equal(rejected.rejected, true);
  assert.equal(verifyDemaStewardChain(rejected).ok, false);
});

test("kernel stays pure: no fs/network/process/clock/random imports or calls", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../packages/core/src/dema-steward-chain.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /node:fs|node:net|node:http|node:https|child_process/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /Date\.now|new Date\s*\(|Math\.random/);
});
