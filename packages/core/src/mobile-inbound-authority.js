// DEMA-MOBILE-INBOUND-AUTHORITY-0A · the door frame for the phone, built
// before any transport exists.
//
// An inbound chat message IS remote write into the node — the corridor the
// strictest closure invariant (NODE0-DEPLOYMENT-REMOTE-WRITE-1A) governs. This
// kernel is the authority half of DEMA-MOBILE-CHANNEL-0A (TASK-074): every
// crossing is evaluated fail-closed and sealed into a privacy-hashed,
// sha256-addressed crossing receipt. The transport half (OpenClaw-pattern
// long-poll adapter) is DESIGNED_NOT_LIVE and gated on operator token custody,
// provider consent, and a remote-write corridor GO — none of which this kernel
// grants or needs.
//
// Laws encoded here:
//  - EXACT-STRING COMMAND TABLE: the whole trimmed (case-folded) text must
//    equal a declared read-only command. No arguments, no flags, no parsing
//    surface — therefore no injection surface. The table carries surface
//    NAMES, never functions: no execution path exists in this kernel at all.
//  - PINNED SENDER: exact-match identity, never a pattern. Missing pin fails
//    closed (OPERATOR_PIN_REQUIRED), never open.
//  - VERDICT COMPUTED INSIDE: buildMobileCrossingReceipt derives the verdict
//    itself; a caller-asserted verdict is refused (the crypto-agility /
//    hash-bridge pattern).
//  - PRIVACY BY HASH: raw foreign text and raw sender ids never enter receipt
//    bytes — only their sha256. A refusal is a crossing too, and gets sealed.
//  - LIVE IS A VERSION, NOT A FLAG: v0.1 receipts carry channel_live:false and
//    verification refuses a receipt declaring true. Going live is a v0.2
//    schema decision behind its own GOs, never a config flip.
//
// Pure kernel: no fs, no network, no tokens, no platform SDK, no wall clock
// (decidedAt injected). Reuses sha256Hex + stableStringify — no new crypto.

import { sha256Hex } from "../../receipts/src/hash-util.js";
import { stableStringify } from "../../consent/src/consent-common.js";

export const MOBILE_INBOUND_SCHEMA = "bizra.dema.mobile_inbound_crossing.v0.1";

export const MOBILE_PLATFORMS = Object.freeze(["telegram", "discord"]);

// 0A surface: three read-only commands. Growing this table is a reviewed edit
// with tests, never runtime registration.
export const MOBILE_COMMAND_TABLE = Object.freeze({
  status: Object.freeze({ surface: "dema status", read_only: true }),
  receipts: Object.freeze({ surface: "dema receipts", read_only: true }),
  help: Object.freeze({ surface: "mobile command table", read_only: true }),
});

export const MOBILE_INBOUND_REASON_CODES = Object.freeze([
  "MESSAGE_MALFORMED",
  "OPERATOR_PIN_REQUIRED",
  "PLATFORM_UNKNOWN",
  "SENDER_NOT_PINNED_OPERATOR",
  "REPLAY_DETECTED",
  "COMMAND_NOT_DECLARED",
  "VERDICT_NOT_CALLER_ASSERTABLE",
  "DECIDED_AT_REQUIRED",
  "CROSSING_RECEIPT_MALFORMED",
  "CROSSING_HASH_MISMATCH",
  "CHANNEL_LIVE_NOT_DECLARABLE",
]);

function fail(reason) {
  return { ok: false, reason };
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * Evaluate one inbound message, fail-closed. Pure: replay state is injected
 * (`seenMessageIds`), never read from disk.
 */
export function evaluateMobileInbound({
  message,
  pinnedOperatorSenderId,
  seenMessageIds = [],
} = {}) {
  if (!isNonEmptyString(pinnedOperatorSenderId)) {
    return fail("OPERATOR_PIN_REQUIRED");
  }
  if (
    !isPlainObject(message) ||
    !isNonEmptyString(message.platform) ||
    !isNonEmptyString(message.platform_message_id) ||
    !isNonEmptyString(message.sender_id) ||
    typeof message.text !== "string"
  ) {
    return fail("MESSAGE_MALFORMED");
  }
  if (!MOBILE_PLATFORMS.includes(message.platform)) {
    return fail("PLATFORM_UNKNOWN");
  }
  if (message.sender_id !== pinnedOperatorSenderId) {
    return fail("SENDER_NOT_PINNED_OPERATOR");
  }
  const seen = Array.isArray(seenMessageIds)
    ? seenMessageIds
    : [...seenMessageIds];
  if (seen.includes(message.platform_message_id)) {
    return fail("REPLAY_DETECTED");
  }
  const command = message.text.trim().toLowerCase();
  const spec = MOBILE_COMMAND_TABLE[command];
  if (!spec) {
    return fail("COMMAND_NOT_DECLARED");
  }
  return { ok: true, command, surface: spec.surface, read_only: true };
}

/**
 * Seal one crossing — accepted OR refused — into a sha256-addressed receipt.
 * The verdict is derived inside this path; a caller supplying one is refused.
 * Raw text and raw sender ids never enter the body: sha256 only.
 */
export function buildMobileCrossingReceipt(input = {}) {
  if (!isPlainObject(input)) return fail("CROSSING_RECEIPT_MALFORMED");
  if ("verdict" in input) return fail("VERDICT_NOT_CALLER_ASSERTABLE");
  if (!isNonEmptyString(input.decidedAt)) return fail("DECIDED_AT_REQUIRED");

  const evaluated = evaluateMobileInbound({
    message: input.message,
    pinnedOperatorSenderId: input.pinnedOperatorSenderId,
    seenMessageIds: input.seenMessageIds,
  });

  // A malformed message cannot be honestly hashed into a crossing body.
  if (!evaluated.ok && evaluated.reason === "MESSAGE_MALFORMED") {
    return fail("MESSAGE_MALFORMED");
  }
  if (!evaluated.ok && evaluated.reason === "OPERATOR_PIN_REQUIRED") {
    return fail("OPERATOR_PIN_REQUIRED");
  }

  const verdict = evaluated.ok
    ? { ok: true, command: evaluated.command, surface: evaluated.surface }
    : { ok: false, reason: evaluated.reason };

  const body = {
    schema: MOBILE_INBOUND_SCHEMA,
    platform: input.message.platform,
    platform_message_id: input.message.platform_message_id,
    sender_id_sha256: sha256Hex(input.message.sender_id),
    text_sha256: sha256Hex(input.message.text),
    verdict,
    channel_live: false,
    decided_at: input.decidedAt,
  };
  const crossing_hash = sha256Hex(stableStringify(body));
  return {
    ok: true,
    receipt: Object.freeze({
      ...body,
      verdict: Object.freeze(verdict),
      crossing_hash,
    }),
  };
}

/**
 * Verify a crossing receipt: structure, hash recomputation, and the v0.1 law
 * that a live channel is not declarable — a receipt claiming channel_live:true
 * is refused even if internally self-consistent.
 */
export function verifyMobileCrossingReceipt(receipt) {
  if (
    !isPlainObject(receipt) ||
    receipt.schema !== MOBILE_INBOUND_SCHEMA ||
    !isNonEmptyString(receipt.platform_message_id) ||
    !isNonEmptyString(receipt.sender_id_sha256) ||
    !isNonEmptyString(receipt.text_sha256) ||
    !isPlainObject(receipt.verdict) ||
    typeof receipt.channel_live !== "boolean" ||
    !isNonEmptyString(receipt.decided_at) ||
    !isNonEmptyString(receipt.crossing_hash)
  ) {
    return fail("CROSSING_RECEIPT_MALFORMED");
  }
  if (receipt.channel_live !== false) {
    return fail("CHANNEL_LIVE_NOT_DECLARABLE");
  }
  const body = {
    schema: receipt.schema,
    platform: receipt.platform,
    platform_message_id: receipt.platform_message_id,
    sender_id_sha256: receipt.sender_id_sha256,
    text_sha256: receipt.text_sha256,
    verdict: { ...receipt.verdict },
    channel_live: receipt.channel_live,
    decided_at: receipt.decided_at,
  };
  if (sha256Hex(stableStringify(body)) !== receipt.crossing_hash) {
    return fail("CROSSING_HASH_MISMATCH");
  }
  return { ok: true };
}
