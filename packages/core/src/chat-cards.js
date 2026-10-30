// NODE0-CHAT-CARDS-1A — pure, provider-neutral Conversation Card kernel.
//
// PREVIEW_ONLY · NOT ML · NOT runtime. Turns gatherer-supplied conversation
// METADATA (never message text) into a deterministic, content-addressed card.
// Zero I/O; no clock. The gatherer streams the export and supplies the
// content hash and source reference. Message bodies never enter a card.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const CHAT_CARD_SCHEMA = "bizra.dema.chat_card.v0.1";
export const CHAT_CARD_TRUTH_LABEL = "CHAT_CARD_METADATA_ONLY";
const FORBIDDEN_KEYS = Object.freeze(["text", "content", "parts", "message_text", "raw"]);
const MAX_TITLE = 160;

const isoFromEpoch = (s) =>
  typeof s === "number" && Number.isFinite(s) && s > 0 ? new Date(Math.round(s * 1000)).toISOString() : null;

// Counts message nodes in a ChatGPT-style `mapping` tree without reading bodies.
export function countMappingMessages(mapping) {
  if (!mapping || typeof mapping !== "object") return 0;
  let n = 0;
  for (const node of Object.values(mapping)) if (node && node.message) n += 1;
  return n;
}

// Structure-only signals: roles, content types and tree shape. Bodies are never read.
export function extractSignals(conversation) {
  const mapping = conversation?.mapping && typeof conversation.mapping === "object" ? conversation.mapping : {};
  let user_messages = 0, code_messages = 0, branch_points = 0;
  for (const node of Object.values(mapping)) {
    if (!node) continue;
    if (Array.isArray(node.children) && node.children.length > 1) branch_points += 1;
    const m = node.message;
    if (!m) continue;
    if (m.author?.role === "user") user_messages += 1;
    if (m.content?.content_type === "code") code_messages += 1;
  }
  const span = (conversation?.update_time ?? 0) - (conversation?.create_time ?? 0);
  return { user_messages, code_messages, branch_points, span_days: span > 0 ? Math.round(span / 864) / 100 : 0 };
}

// Deterministic structural weight (higher = more likely to hold durable material).
export function scoreSignals(card) {
  const s = card.signals || {};
  return Math.round(
    (Math.log2(1 + (card.message_count || 0)) * 10 +
      (s.branch_points || 0) * 3 +
      (s.code_messages || 0) * 0.5 +
      Math.log2(1 + (s.span_days || 0)) * 4) * 100,
  ) / 100;
}

export function rankCards(cards, top = 100) {
  return cards
    .map((c) => ({ conversation_id: c.conversation_id, title: c.title, created_at: c.created_at, message_count: c.message_count, signals: c.signals, score: scoreSignals(c) }))
    .sort((a, b) => b.score - a.score || a.conversation_id.localeCompare(b.conversation_id))
    .slice(0, top);
}

export function buildChatCard({ provider, conversation, content_sha256, source_ref }) {
  if (typeof provider !== "string" || !provider) throw new Error("provider required");
  if (!conversation || typeof conversation.conversation_id !== "string") throw new Error("conversation_id required");
  if (!/^[0-9a-f]{64}$/.test(content_sha256 || "")) throw new Error("content_sha256 must be 64-hex");
  const ref = source_ref || {};
  const body = {
    schema: CHAT_CARD_SCHEMA,
    truth_label: CHAT_CARD_TRUTH_LABEL,
    provider,
    conversation_id: conversation.conversation_id,
    title: String(conversation.title ?? "").slice(0, MAX_TITLE),
    created_at: isoFromEpoch(conversation.create_time),
    updated_at: isoFromEpoch(conversation.update_time),
    model: conversation.default_model_slug ?? null,
    archived: conversation.is_archived === true,
    message_count: countMappingMessages(conversation.mapping),
    signals: extractSignals(conversation),
    content_sha256,
    source_ref: { offset: ref.offset ?? null, length: ref.length ?? null },
    claim_label: "UNKNOWN",
    boundary: {
      content_read_performed: false,
      model_invocation_performed: false,
      external_provider_called: false,
      mutation_performed: false,
    },
  };
  return Object.freeze({ ...body, card_sha256: sha256(stableStringify(body)) });
}

export function verifyChatCard(card) {
  const reasons = [];
  if (!card || card.schema !== CHAT_CARD_SCHEMA) reasons.push("schema_mismatch");
  else {
    for (const k of FORBIDDEN_KEYS) if (k in card) reasons.push(`forbidden_key:${k}`);
    for (const [k, v] of Object.entries(card.boundary || {})) if (v !== false) reasons.push(`boundary_not_false:${k}`);
    if (!card.boundary) reasons.push("boundary_missing");
    const { card_sha256, ...body } = card;
    if (card_sha256 !== sha256(stableStringify(body))) reasons.push("hash_mismatch");
  }
  return { ok: reasons.length === 0, reasons };
}

// Collapses ritual/boilerplate titles into one cluster; "Branch ·" copies stay distinct.
const RITUAL_CLUSTERS = Object.freeze([
  [/^core system update/, "core system update"],
  [/^peak output performance/, "peak output performance"],
  [/^new chat$/, "new chat"],
  [/^system initialization summary/, "system initialization summary"],
  [/^conversation summary request/, "conversation summary request"],
]);

export function normalizeTitleCluster(title) {
  const t = String(title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  for (const [re, name] of RITUAL_CLUSTERS) if (re.test(t)) return name;
  return t.replace(/[0-9]+/g, "#");
}

// Top-N by structural score with at most one representative per title cluster.
export function selectTopDistinctCards(cards, limit = 10) {
  const seen = new Set();
  const out = [];
  const sorted = [...cards].sort(
    (a, b) => scoreSignals(b) - scoreSignals(a) || a.conversation_id.localeCompare(b.conversation_id),
  );
  for (const c of sorted) {
    const cluster = normalizeTitleCluster(c.title);
    if (seen.has(cluster)) continue;
    seen.add(cluster);
    out.push({
      conversation_id: c.conversation_id,
      title: c.title,
      cluster_id: sha256(cluster).slice(0, 12),
      created_at: c.created_at,
      message_count: c.message_count,
      score: scoreSignals(c),
      source_ref: c.source_ref,
      content_sha256: c.content_sha256,
    });
    if (out.length >= limit) break;
  }
  return out;
}
