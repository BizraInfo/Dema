// NPC intent binder — hardening v0.1 · DEMA-NPC-INTENT-BINDER-HARDENING-1A.
//
// PREVIEW_ONLY · NOT runtime · NOT execution · the UPSTREAM front-end to TADE.
//
// Purpose: take raw, UNTRUSTED agent/LLM output (a ```json fence or bare JSON)
// and fail-closed bind it into a content-addressed intent packet carrying the
// canonical 17-key preview boundary. This is where orchestration moves from
// probabilistic agent text into a deterministic, verifiable local artifact
// behind the FATE boundary — the packet, not the model's word, is what any
// downstream (TADE, review gate, human) trusts.
//
// No-overclaim (Ihsān): a bound packet proves ONLY that the raw output parsed
// to a well-formed intent with the required fields and is content-addressed. It
// does NOT prove the action is safe, consented, authorized, or executed. Every
// failure path (non-JSON, malformed, missing required field) fails CLOSED to a
// deterministic REJECTION packet (bound:false + reason) — never a throw, never a
// silent pass, never a partial bind.
//
// Pure: no fs, network, process, clock, or random. It parses an in-memory string
// argument; it never reads files. Deep-frozen, canonical 17-key all-false
// boundary. Mirrors the content-addressing of node0-task-decomposition-engine.js.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NPC_INTENT_BINDER_SCHEMA =
  "bizra.dema.npc_intent_binder_hardening.v0.1";
export const NPC_INTENT_BINDER_TRUTH_LABEL = "NPC_INTENT_BINDER_PREVIEW_ONLY";

export const REQUIRED_INTENT_FIELDS = Object.freeze(["action_type", "target_path"]);

export const BINDER_REJECT_REASONS = Object.freeze([
  "empty_input",
  "non_json_input",
  "malformed_json",
  "not_object",
  "missing_action_type",
  "missing_target_path",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "raw agent output parsed to a well-formed intent object",
  "required fields (action_type, target_path) are present and non-empty",
  "the intent is content-addressed (deterministic packet_hash)",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "does NOT prove the action is safe to execute",
  "does NOT prove consent was collected",
  "does NOT prove the action is authorized or that execution occurred",
  "no runtime, no model invocation, no mint",
]);

// ── deterministic content addressing (mirrors sibling kernels) ──────────────
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const parts = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined
          ? []
          : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}

function packetHash(body) {
  return `sha256:${createHash("sha256").update(stableStringify(body), "utf8").digest("hex")}`;
}

// Extract the JSON text from raw agent output: a ```json ... ``` fence if
// present, else the trimmed raw. JS uses .trim() (candidate brief's .strip() is
// invalid JS).
function extractJsonText(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function freezePacket(body) {
  return Object.freeze({ ...body, packet_hash: packetHash(body) });
}

function reject(reasons) {
  return freezePacket({
    schema: NPC_INTENT_BINDER_SCHEMA,
    truth_label: NPC_INTENT_BINDER_TRUTH_LABEL,
    bound: false,
    intent: null,
    reject_reasons: Object.freeze([...reasons]),
    authority: "untrusted_unbound",
    boundary: buildPreviewBoundary(),
    what_this_proves: Object.freeze([]),
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

/**
 * Bind raw untrusted agent output into a fail-closed, content-addressed intent
 * packet. Never throws; malformed input yields a deterministic rejection packet.
 * @param {{ raw?: string }} args
 */
export function bindNpcIntent({ raw } = {}) {
  const jsonText = extractJsonText(raw);
  if (jsonText.length === 0) return reject(["empty_input"]);

  const looksJson = jsonText[0] === "{" || jsonText[0] === "[";
  if (!looksJson) return reject(["non_json_input"]);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return reject(["malformed_json"]);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return reject(["not_object"]);
  }

  const reasons = [];
  if (!isNonEmptyString(parsed.action_type)) reasons.push("missing_action_type");
  if (!isNonEmptyString(parsed.target_path)) reasons.push("missing_target_path");
  if (reasons.length > 0) return reject(reasons);

  // Canonical, normalized intent — deterministic ordering via stableStringify.
  const intent = Object.freeze({ ...parsed });
  return freezePacket({
    schema: NPC_INTENT_BINDER_SCHEMA,
    truth_label: NPC_INTENT_BINDER_TRUTH_LABEL,
    bound: true,
    intent,
    reject_reasons: Object.freeze([]),
    authority: "bound_preview_not_authorized",
    boundary: buildPreviewBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}

/**
 * Re-derive the packet from its own bound intent and confirm it matches. Body-
 * bound: a forged intent (e.g. target_path swapped to /etc/shadow after binding)
 * is caught because re-derivation from the intent yields a different hash.
 * @param {object} packet
 * @returns {{ ok: boolean, reason?: string, expected_hash?: string }}
 */
export function verifyNpcIntentPacket(packet) {
  if (!packet || typeof packet !== "object") {
    return { ok: false, reason: "packet_not_object" };
  }
  if (packet.bound !== true || !packet.intent || typeof packet.intent !== "object") {
    return { ok: false, reason: "not_a_bound_packet" };
  }
  const recomputed = bindNpcIntent({ raw: JSON.stringify(packet.intent) });
  if (recomputed.packet_hash !== packet.packet_hash) {
    return {
      ok: false,
      reason: "packet_hash_mismatch",
      expected_hash: recomputed.packet_hash,
    };
  }
  return { ok: true };
}
