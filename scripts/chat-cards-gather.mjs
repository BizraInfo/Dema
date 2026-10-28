#!/usr/bin/env node
// NODE0-CHAT-CARDS-1A gatherer — streams a ChatGPT export JSONL and writes
// metadata-only Conversation Cards to ~/.dema/chat-cards/. Read-only on the
// source; no network, no model. Usage: node scripts/chat-cards-gather.mjs <export.jsonl> [--limit N]
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { buildChatCard, verifyChatCard, rankCards, selectTopDistinctCards } from "../packages/core/src/chat-cards.js";

const src = process.argv[2];
const li = process.argv.indexOf("--limit");
const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
if (!src) { console.error("usage: chat-cards-gather.mjs <export.jsonl> [--limit N]"); process.exit(2); }

const outDir = join(process.env.DEMA_HOME || join(homedir(), ".dema"), "chat-cards");
mkdirSync(outDir, { recursive: true });
const cards = [];
let offset = 0, bad = 0;
const rl = createInterface({ input: createReadStream(src, { encoding: "utf8" }), crlfDelay: Infinity });
for await (const line of rl) {
  const length = Buffer.byteLength(line) + 1;
  if (cards.length < limit && line.trim()) {
    try {
      const conversation = JSON.parse(line);
      const card = buildChatCard({
        provider: "chatgpt",
        conversation,
        content_sha256: createHash("sha256").update(line).digest("hex"),
        source_ref: { offset, length },
      });
      if (!verifyChatCard(card).ok) throw new Error("verify failed");
      cards.push(card);
    } catch { bad += 1; }
  }
  offset += length;
}
const out = join(outDir, "chatgpt.cards.json");
writeFileSync(out, JSON.stringify({ schema: "bizra.dema.chat_card_set.v0.1", count: cards.length, skipped: bad, cards }, null, 1));
const shortlist = join(outDir, "chatgpt.shortlist.json");
writeFileSync(shortlist, JSON.stringify({ schema: "bizra.dema.chat_shortlist.v0.1", claim_label: "DERIVED", ranked: rankCards(cards, 100), distinct_top10: selectTopDistinctCards(cards, 10) }, null, 1));
console.log(JSON.stringify({ shortlist, out, count: cards.length, skipped: bad }));
