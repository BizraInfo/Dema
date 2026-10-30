#!/usr/bin/env node
// NODE0-WISDOM-LEDGER-1A gatherer — operator-consented, local, read-only.
// Seeks (byte offset) to the distinct top-10 conversations from the chat-card
// shortlist, extracts redacted wisdom atoms, cross-checks against the live repo,
// and writes the ledger + report under ~/.dema/wisdom/. No network, no model.
// Usage: node scripts/wisdom-ledger-gather.mjs <export.jsonl>
import { openSync, readSync, closeSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { extractWisdomAtoms, buildWisdomLedger, verifyWisdomLedger } from "../packages/core/src/wisdom-ledger.js";

const src = process.argv[2];
if (!src) { console.error("usage: wisdom-ledger-gather.mjs <export.jsonl>"); process.exit(2); }
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.DEMA_HOME || join(homedir(), ".dema");
const shortlist = JSON.parse(readFileSync(join(home, "chat-cards", "chatgpt.shortlist.json"), "utf8"));
const targets = shortlist.distinct_top10;
if (!Array.isArray(targets) || !targets.length) { console.error("no distinct_top10; rerun chat-cards-gather"); process.exit(2); }

const paths = execFileSync("git", ["-C", repo, "ls-files"], { encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter(Boolean);
const sliceRe = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d+[A-Z]\b/g;
const slices = new Set();
for (const p of paths) for (const m of p.matchAll(sliceRe)) slices.add(m[0]);
for (const f of ["docs/CURRENT_LIMITS.md", ...paths.filter((p) => /capability-truth-registry|^docs\/.*\.md$/.test(p))]) {
  try { for (const m of readFileSync(join(repo, f), "utf8").matchAll(sliceRe)) slices.add(m[0]); } catch {}
}
const inventory = { paths, slices: [...slices] };

const fd = openSync(src, "r");
const atoms = [];
const perConv = [];
let mismatched = 0;
try {
  for (const t of targets) {
    const buf = Buffer.alloc(t.source_ref.length);
    readSync(fd, buf, 0, buf.length, t.source_ref.offset);
    // Strip CR?LF line ending only — content hash is over payload bytes.
    const line = buf.toString("utf8").replace(/\r?\n$/, "");
    if (createHash("sha256").update(line).digest("hex") !== t.content_sha256) { mismatched += 1; continue; }
    const got = extractWisdomAtoms(JSON.parse(line), inventory);
    atoms.push(...got);
    perConv.push({ title: t.title, created_at: t.created_at, message_count: t.message_count, atoms: got.length });
  }
} finally { closeSync(fd); }

const ledger = buildWisdomLedger({ source: { file_sha256_of_cards: null, conversations: targets.map((t) => t.conversation_id) }, atoms });
const v = verifyWisdomLedger(ledger);
mkdirSync(join(home, "wisdom"), { recursive: true });
const ledgerPath = join(home, "wisdom", "chatgpt-top10-wisdom-ledger.json");
// Do not append fields after seal — verifyWisdomLedger hashes every key except
// ledger_sha256. Conversation rollup is a sidecar, not part of the sealed body.
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
const perConvPath = join(home, "wisdom", "chatgpt-top10-per-conversation.json");
writeFileSync(perConvPath, JSON.stringify({ schema: "bizra.dema.wisdom_per_conversation.v0.1", conversations: perConv }, null, 1));

// Specificity: recent, slice-bearing, prose-like (not JSON/table/log) lines rank first.
const gemScore = (a) =>
  (a.created_at >= "2026-09-01" ? 3 : 0) + (a.referenced_slices.length ? 3 : 0) + (a.referenced_paths.length ? 1 : 0) +
  (a.atom_kind === "LOST_GOLDEN_GEM" ? 2 : a.atom_kind === "INVARIANT_RULE" ? 1 : 0) +
  (/^[{\[|`]|^\W|"\w+":|\\n|http/.test(a.snippet) ? -6 : 0) + (a.snippet.length >= 40 && a.snippet.length <= 220 ? 1 : 0);
const GEM_KINDS = new Set(["LOST_GOLDEN_GEM", "ARCHITECTURE_DECISION", "INVARIANT_RULE"]);
const topGems = ledger.atoms.filter((a) => GEM_KINDS.has(a.atom_kind) && !a.superseded_by)
  .sort((a, b) => gemScore(b) - gemScore(a) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 15);
const topPush = ledger.atoms.filter((a) => a.atom_kind === "BRANCH_PUSHBACK")
  .sort((a, b) => (b.pushback_kind === "OPERATOR_CORRECTION") - (a.pushback_kind === "OPERATOR_CORRECTION") || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10);
const gemLine = (a, i) => `${i + 1}. [${(a.created_at ?? "?").slice(0, 10)}] ${a.atom_kind} · ${a.disk_status} · ${a.claim_label}\n   ${a.snippet}${a.referenced_slices.length ? `\n   slices: ${a.referenced_slices.join(", ")}` : ""}`;
const pushLine = (a, i) => `${i + 1}. [${(a.created_at ?? "?").slice(0, 10)}] ${a.pushback_kind}\n   ${a.pushback_kind === "REGENERATION" ? "REJECTED" : "OPERATOR"}: ${a.snippet}\n   ${a.pushback_kind === "REGENERATION" ? "ACCEPTED" : "DRAFT"}: ${a.counterpart_snippet}`;
const take = (k, n) => ledger.atoms.filter((a) => a.atom_kind === k && !a.superseded_by).slice(-n).reverse();
const bullet = (a) => `- [${(a.created_at ?? "?").slice(0, 10)}] ${a.snippet}${a.referenced_slices.length ? ` _(${a.referenced_slices.join(", ")})_` : ""}`;
const md = [
  "# Top-10 Golden Gems Report (LOCAL · PREVIEW · chat claims = UNKNOWN unless disk-anchored)",
  `Ledger: \`${ledger.ledger_sha256.slice(0, 16)}…\` · atoms: ${ledger.atom_count} · verify: ${v.ok ? "OK" : v.reasons.join(",")} · hash-mismatched seeks: ${mismatched}`,
  "", "## Conversations", "| # | Date | Msgs | Atoms | Title |", "|---|---|---|---|---|",
  ...perConv.map((c, i) => `| ${i + 1} | ${(c.created_at ?? "").slice(0, 10)} | ${c.message_count} | ${c.atoms} | ${c.title} |`),
  "", `## Counts by kind\n${Object.entries(ledger.by_kind).map(([k, n]) => `- ${k}: ${n}`).join("\n")}`,
  "", "## Unbuilt gem candidates (slice/path in chat, not on disk) — newest first", ...take("LOST_GOLDEN_GEM", 25).map(bullet),
  "", "## Disk-anchored artifacts (DERIVED)", ...take("ARTIFACT_ANCHOR", 15).map(bullet),
  "", "## Invariant rules (UNKNOWN until checked)", ...take("INVARIANT_RULE", 20).map(bullet),
  "", "## Architecture decisions (UNKNOWN until checked)", ...take("ARCHITECTURE_DECISION", 15).map(bullet),
  "", "## Top 15 gems (ranked by specificity)", ...topGems.map(gemLine),
  "", "## Top 10 pushback pairs (rejected draft vs. correction)", ...topPush.map(pushLine),
].join("\n");
const reportPath = join(home, "wisdom", "TOP10_GOLDEN_GEMS_REPORT.md");
writeFileSync(reportPath, md);
if (process.argv.includes("--print")) console.log("\nTOP 15 GEMS\n" + topGems.map(gemLine).join("\n") + "\n\nTOP 10 PUSHBACK PAIRS\n" + topPush.map(pushLine).join("\n") + "\n");
console.log(JSON.stringify({ ledgerPath, reportPath, atoms: ledger.atom_count, by_kind: ledger.by_kind, verify: v, mismatched }));
