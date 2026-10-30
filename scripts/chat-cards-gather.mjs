#!/usr/bin/env node
// NODE0-CHAT-CARDS-1A gatherer — streams a ChatGPT export JSONL and writes
// metadata-only Conversation Cards to ~/.dema/chat-cards/. Read-only on the
// source; no network, no model. Usage: node scripts/chat-cards-gather.mjs <export.jsonl> [--limit N]
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildChatCard, verifyChatCard, rankCards, selectTopDistinctCards } from "../packages/core/src/chat-cards.js";

import { pathToFileURL } from "node:url";

/**
 * Exact byte-range JSONL records from a Buffer. Length includes the terminating
 * LF (and CR if CRLF). A final record without newline uses its true byte length
 * (no phantom +1). Parse text excludes the line ending so content hashes stay
 * CRLF/LF stable.
 */
export function* iterateJsonlByteRanges(buf) {
  let offset = 0;
  while (offset < buf.length) {
    const nl = buf.indexOf(0x0a, offset);
    if (nl === -1) {
      const length = buf.length - offset;
      if (length === 0) break;
      let end = buf.length;
      if (buf[end - 1] === 0x0d) end -= 1;
      yield {
        offset,
        length,
        line: buf.subarray(offset, end).toString("utf8"),
      };
      break;
    }
    const length = nl - offset + 1;
    let end = nl;
    if (end > offset && buf[end - 1] === 0x0d) end -= 1;
    yield {
      offset,
      length,
      line: buf.subarray(offset, end).toString("utf8"),
    };
    offset = nl + 1;
  }
}

/**
 * Streamed exact byte-range JSONL records. Same offset/length/line contract as
 * `iterateJsonlByteRanges`, without requiring the whole file in memory.
 * Callers that hit `--limit` should destroy the readable to stop I/O early.
 */
export async function* iterateJsonlByteRangesFromStream(readable) {
  let fileOffset = 0;
  let carry = Buffer.alloc(0);
  for await (const chunk of readable) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const buf = carry.length === 0 ? piece : Buffer.concat([carry, piece]);
    let start = 0;
    while (true) {
      const nl = buf.indexOf(0x0a, start);
      if (nl === -1) break;
      const length = nl - start + 1;
      let end = nl;
      if (end > start && buf[end - 1] === 0x0d) end -= 1;
      yield {
        offset: fileOffset + start,
        length,
        line: buf.subarray(start, end).toString("utf8"),
      };
      start = nl + 1;
    }
    if (start > 0) {
      fileOffset += start;
      carry = buf.subarray(start);
    } else {
      carry = buf;
    }
  }
  if (carry.length > 0) {
    let end = carry.length;
    if (carry[end - 1] === 0x0d) end -= 1;
    yield {
      offset: fileOffset,
      length: carry.length,
      line: carry.subarray(0, end).toString("utf8"),
    };
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const src = process.argv[2];
  const li = process.argv.indexOf("--limit");
  const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
  if (!src) {
    console.error("usage: chat-cards-gather.mjs <export.jsonl> [--limit N]");
    process.exit(2);
  }

  const outDir = join(process.env.DEMA_HOME || join(homedir(), ".dema"), "chat-cards");
  mkdirSync(outDir, { recursive: true });
  const cards = [];
  let bad = 0;
  const stream = createReadStream(src);
  try {
    for await (const rec of iterateJsonlByteRangesFromStream(stream)) {
      if (cards.length >= limit) {
        stream.destroy();
        break;
      }
      if (!rec.line.trim()) continue;
      try {
        const conversation = JSON.parse(rec.line);
        const card = buildChatCard({
          provider: "chatgpt",
          conversation,
          content_sha256: createHash("sha256").update(rec.line).digest("hex"),
          source_ref: { offset: rec.offset, length: rec.length },
        });
        if (!verifyChatCard(card).ok) throw new Error("verify failed");
        cards.push(card);
      } catch {
        bad += 1;
      }
    }
  } catch (err) {
    // destroy() after limit can surface as ERR_STREAM_PREMATURE_CLOSE — ignore.
    if (err?.code !== "ERR_STREAM_PREMATURE_CLOSE") throw err;
  }
  const out = join(outDir, "chatgpt.cards.json");
  writeFileSync(
    out,
    JSON.stringify(
      { schema: "bizra.dema.chat_card_set.v0.1", count: cards.length, skipped: bad, cards },
      null,
      1,
    ),
  );
  const shortlist = join(outDir, "chatgpt.shortlist.json");
  writeFileSync(
    shortlist,
    JSON.stringify(
      {
        schema: "bizra.dema.chat_shortlist.v0.1",
        claim_label: "DERIVED",
        ranked: rankCards(cards, 100),
        distinct_top10: selectTopDistinctCards(cards, 10),
      },
      null,
      1,
    ),
  );
  console.log(JSON.stringify({ shortlist, out, count: cards.length, skipped: bad }));
}
