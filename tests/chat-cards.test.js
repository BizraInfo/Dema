// NODE0-CHAT-CARDS-1A — pure kernel tests (metadata only, no message text).

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatCard, verifyChatCard, countMappingMessages, rankCards, normalizeTitleCluster, selectTopDistinctCards } from "../packages/core/src/chat-cards.js";

const H = "a".repeat(64);
const conv = {
  conversation_id: "c-1",
  title: "Example",
  create_time: 1700000000.5,
  update_time: 1700000100,
  default_model_slug: "gpt-x",
  is_archived: false,
  mapping: { a: { message: { content: { parts: ["SECRET BODY"] } } }, b: { message: null }, c: { message: {} } },
};

test("card is deterministic, verifies, and never carries message text", () => {
  const a = buildChatCard({ provider: "chatgpt", conversation: conv, content_sha256: H, source_ref: { offset: 0, length: 9 } });
  const b = buildChatCard({ provider: "chatgpt", conversation: conv, content_sha256: H, source_ref: { offset: 0, length: 9 } });
  assert.equal(a.card_sha256, b.card_sha256);
  assert.equal(a.message_count, 2);
  assert.equal(a.created_at, "2023-11-14T22:13:20.500Z");
  assert.ok(!JSON.stringify(a).includes("SECRET BODY"));
  assert.deepEqual(verifyChatCard(a), { ok: true, reasons: [] });
});

test("forgery: tampered field, flipped boundary, injected text are rejected", () => {
  const c = buildChatCard({ provider: "chatgpt", conversation: conv, content_sha256: H });
  assert.ok(verifyChatCard({ ...c, title: "x" }).reasons.includes("hash_mismatch"));
  const flipped = { ...c, boundary: { ...c.boundary, content_read_performed: true } };
  assert.ok(verifyChatCard(flipped).reasons.includes("boundary_not_false:content_read_performed"));
  assert.ok(verifyChatCard({ ...c, text: "leak" }).reasons.includes("forbidden_key:text"));
});

test("signals and ranking are structural, deterministic, and body-free", () => {
  const rich = {
    ...conv,
    conversation_id: "c-2",
    update_time: conv.create_time + 86400 * 10,
    mapping: {
      r: { children: ["u", "v"], message: null },
      u: { message: { author: { role: "user" }, content: { content_type: "code", parts: ["SECRET BODY"] } } },
      v: { message: { author: { role: "assistant" }, content: { content_type: "text" } } },
    },
  };
  const a = buildChatCard({ provider: "chatgpt", conversation: rich, content_sha256: H });
  const b = buildChatCard({ provider: "chatgpt", conversation: conv, content_sha256: H });
  assert.deepEqual(a.signals, { user_messages: 1, code_messages: 1, branch_points: 1, span_days: 10 });
  const ranked = rankCards([b, a]);
  assert.equal(ranked[0].conversation_id, "c-2");
  assert.deepEqual(rankCards([a, b]), ranked);
  assert.ok(!JSON.stringify(ranked).includes("SECRET BODY"));
});

test("bad inputs throw; empty mapping counts zero", () => {
  assert.throws(() => buildChatCard({ provider: "", conversation: conv, content_sha256: H }));
  assert.throws(() => buildChatCard({ provider: "p", conversation: conv, content_sha256: "zz" }));
  assert.throws(() => buildChatCard({ provider: "p", conversation: {}, content_sha256: H }));
  assert.equal(countMappingMessages(null), 0);
});

test("title clusters collapse ritual titles; distinct selection keeps one per cluster", () => {
  assert.equal(normalizeTitleCluster("Core System Update Confirmed"), "core system update");
  assert.equal(normalizeTitleCluster("Core System Update"), "core system update");
  assert.notEqual(normalizeTitleCluster("Branch · X"), normalizeTitleCluster("X"));
  const mk = (id, title, n) =>
    buildChatCard({ provider: "p", conversation: { conversation_id: id, title, mapping: Object.fromEntries(Array.from({ length: n }, (_, i) => [`m${i}`, { message: {} }])) }, content_sha256: H, source_ref: { offset: 1, length: 2 } });
  const top = selectTopDistinctCards([mk("a", "Core System Update", 50), mk("b", "Core System Update Complete", 40), mk("c", "Other", 5)], 10);
  assert.deepEqual(top.map((t) => t.conversation_id), ["a", "c"]);
  assert.deepEqual(top[0].source_ref, { offset: 1, length: 2 });
});
