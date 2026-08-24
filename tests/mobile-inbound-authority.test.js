/**
 * DEMA-MOBILE-INBOUND-AUTHORITY-0A tests
 *
 * The phone joins Node0 through the front door — and this kernel IS the door
 * frame, built before any transport exists. An inbound chat message is remote
 * write into the node, so every crossing is evaluated fail-closed and sealed
 * into a privacy-hashed, sha256-addressed crossing receipt. Pure tests: no
 * network, no tokens, no platform SDK, no fs.
 *
 * Laws under test:
 *  - exact-string command table: the WHOLE trimmed text must equal a declared
 *    read-only command — no arguments, no parsing surface, no injection surface;
 *  - sender identity is a pinned exact match, never a pattern;
 *  - the verdict is computed INSIDE the receipt path, never caller-asserted;
 *  - raw foreign text and raw sender ids NEVER appear in receipt bytes;
 *  - channel_live is false and unrepresentable as true in v0.1 — going live is
 *    a version bump, not a flag.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_INBOUND_SCHEMA,
  MOBILE_COMMAND_TABLE,
  MOBILE_INBOUND_REASON_CODES,
  MOBILE_PLATFORMS,
  evaluateMobileInbound,
  buildMobileCrossingReceipt,
  verifyMobileCrossingReceipt,
} from "../packages/core/src/mobile-inbound-authority.js";
import { sha256Hex } from "../packages/receipts/src/hash-util.js";
import { stableStringify } from "../packages/consent/src/consent-common.js";

const OPERATOR = "tg-777000111";
const MSG = Object.freeze({
  platform: "telegram",
  platform_message_id: "m-1001",
  sender_id: OPERATOR,
  text: "status",
});
const AT = "2026-08-20T08:00:00.000Z";

function evalOk(overrides = {}) {
  return evaluateMobileInbound({
    message: { ...MSG, ...overrides },
    pinnedOperatorSenderId: OPERATOR,
    seenMessageIds: [],
  });
}

describe("MOBILE-INBOUND-AUTHORITY-0A · command table shape", () => {
  it("every_declared_command_is_read_only_and_names_a_surface", () => {
    const entries = Object.entries(MOBILE_COMMAND_TABLE);
    assert.ok(entries.length >= 1);
    for (const [cmd, spec] of entries) {
      assert.equal(typeof cmd, "string");
      assert.equal(spec.read_only, true, `${cmd} must be read-only in 0A`);
      assert.equal(typeof spec.surface, "string");
      assert.ok(Object.isFrozen(spec));
      // No execution path exists in the table: values carry names, never code.
      for (const v of Object.values(spec)) {
        assert.notEqual(typeof v, "function");
      }
    }
    assert.ok(Object.isFrozen(MOBILE_COMMAND_TABLE));
  });
});

describe("MOBILE-INBOUND-AUTHORITY-0A · evaluateMobileInbound", () => {
  it("operator_sending_a_declared_command_is_accepted_read_only", () => {
    const v = evalOk();
    assert.equal(v.ok, true);
    assert.equal(v.command, "status");
    assert.equal(v.read_only, true);
    assert.equal(typeof v.surface, "string");
  });

  it("sender_pinning_is_exact_match_never_a_pattern", () => {
    for (const sender of ["tg-777000112", "TG-777000111", " tg-777000111"]) {
      const v = evalOk({ sender_id: sender });
      assert.equal(v.ok, false);
      assert.equal(v.reason, "SENDER_NOT_PINNED_OPERATOR");
    }
    // an EMPTY sender is structurally malformed — the more precise refusal wins
    assert.equal(evalOk({ sender_id: "" }).reason, "MESSAGE_MALFORMED");
  });

  it("undeclared_command_is_refused_including_declared_command_plus_arguments", () => {
    for (const text of ["reboot", "status now", "receipts --json", "rm -rf /", "STATUS; drop"]) {
      const v = evalOk({ text });
      assert.equal(v.ok, false, `"${text}" must refuse`);
      assert.equal(v.reason, "COMMAND_NOT_DECLARED");
    }
  });

  it("declared_command_matches_whole_trimmed_text_case_insensitive", () => {
    assert.equal(evalOk({ text: "  STATUS  " }).ok, true);
    assert.equal(evalOk({ text: "Receipts" }).ok, true);
  });

  it("replay_of_a_seen_platform_message_id_is_refused", () => {
    const v = evaluateMobileInbound({
      message: MSG,
      pinnedOperatorSenderId: OPERATOR,
      seenMessageIds: ["m-1001"],
    });
    assert.equal(v.ok, false);
    assert.equal(v.reason, "REPLAY_DETECTED");
  });

  it("unknown_platform_is_refused", () => {
    const v = evalOk({ platform: "carrier-pigeon" });
    assert.equal(v.ok, false);
    assert.equal(v.reason, "PLATFORM_UNKNOWN");
    assert.ok(MOBILE_PLATFORMS.includes("telegram"));
    assert.ok(MOBILE_PLATFORMS.includes("discord"));
  });

  it("malformed_messages_fail_closed", () => {
    for (const bad of [null, "status", 7, {}, { ...MSG, text: 5 }, { ...MSG, platform_message_id: "" }]) {
      const v = evaluateMobileInbound({
        message: bad,
        pinnedOperatorSenderId: OPERATOR,
        seenMessageIds: [],
      });
      assert.equal(v.ok, false);
      assert.equal(v.reason, "MESSAGE_MALFORMED");
    }
  });

  it("missing_pinned_operator_id_fails_closed_never_open", () => {
    const v = evaluateMobileInbound({ message: MSG, seenMessageIds: [] });
    assert.equal(v.ok, false);
    assert.equal(v.reason, "OPERATOR_PIN_REQUIRED");
  });

  it("every_refusal_reason_is_registered", () => {
    for (const r of [
      "SENDER_NOT_PINNED_OPERATOR",
      "COMMAND_NOT_DECLARED",
      "REPLAY_DETECTED",
      "PLATFORM_UNKNOWN",
      "MESSAGE_MALFORMED",
      "OPERATOR_PIN_REQUIRED",
    ]) {
      assert.ok(MOBILE_INBOUND_REASON_CODES.includes(r), r);
    }
  });
});

describe("MOBILE-INBOUND-AUTHORITY-0A · crossing receipt", () => {
  const build = (over = {}) =>
    buildMobileCrossingReceipt({
      message: { ...MSG, ...over },
      pinnedOperatorSenderId: OPERATOR,
      seenMessageIds: [],
      decidedAt: AT,
    });

  it("verdict_is_computed_inside_a_caller_asserted_verdict_is_refused", () => {
    const res = buildMobileCrossingReceipt({
      message: MSG,
      pinnedOperatorSenderId: OPERATOR,
      seenMessageIds: [],
      decidedAt: AT,
      verdict: { ok: true },
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "VERDICT_NOT_CALLER_ASSERTABLE");
  });

  it("accepted_crossing_seals_schema_verdict_and_hash", () => {
    const res = build();
    assert.equal(res.ok, true);
    const r = res.receipt;
    assert.equal(r.schema, MOBILE_INBOUND_SCHEMA);
    assert.equal(r.verdict.ok, true);
    assert.equal(r.verdict.command, "status");
    assert.equal(r.channel_live, false);
    const { crossing_hash, ...body } = r;
    assert.equal(crossing_hash, sha256Hex(stableStringify(body)));
    assert.ok(Object.isFrozen(r));
  });

  it("refused_crossing_is_still_sealed_with_its_exact_reason", () => {
    const res = build({ text: "reboot" });
    assert.equal(res.ok, true, "a refusal is a crossing too — it gets a receipt");
    assert.equal(res.receipt.verdict.ok, false);
    assert.equal(res.receipt.verdict.reason, "COMMAND_NOT_DECLARED");
  });

  it("raw_text_and_raw_sender_never_appear_in_receipt_bytes", () => {
    const secretText = "reboot the-secret-plan-xyzzy";
    const res = build({ text: secretText });
    const bytes = stableStringify(res.receipt);
    assert.ok(!bytes.includes("xyzzy"), "raw foreign text leaked into receipt");
    assert.ok(!bytes.includes(OPERATOR), "raw sender id leaked into receipt");
    assert.equal(res.receipt.sender_id_sha256, sha256Hex(OPERATOR));
    assert.equal(res.receipt.text_sha256, sha256Hex(secretText));
  });

  it("decided_at_is_injected_never_wall_clock", () => {
    const res = buildMobileCrossingReceipt({
      message: MSG,
      pinnedOperatorSenderId: OPERATOR,
      seenMessageIds: [],
    });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "DECIDED_AT_REQUIRED");
  });

  it("verify_recomputes_the_hash_and_tamper_breaks_it", () => {
    const r = build().receipt;
    assert.equal(verifyMobileCrossingReceipt(r).ok, true);
    const tampered = { ...r, verdict: { ...r.verdict, command: "receipts" } };
    const res = verifyMobileCrossingReceipt(tampered);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "CROSSING_HASH_MISMATCH");
  });

  it("channel_live_true_is_unrepresentable_in_v0_1", () => {
    const r = build().receipt;
    const forged = { ...r, channel_live: true };
    // even with a recomputed hash, v0.1 verification refuses a live claim
    const { crossing_hash, ...body } = forged;
    const resealed = { ...body, crossing_hash: sha256Hex(stableStringify(body)) };
    const res = verifyMobileCrossingReceipt(resealed);
    assert.equal(res.ok, false);
    assert.equal(res.reason, "CHANNEL_LIVE_NOT_DECLARABLE");
  });

  it("malformed_receipts_fail_closed", () => {
    for (const bad of [null, {}, { schema: "wrong" }, 7]) {
      const res = verifyMobileCrossingReceipt(bad);
      assert.equal(res.ok, false);
      assert.equal(res.reason, "CROSSING_RECEIPT_MALFORMED");
    }
  });
});
