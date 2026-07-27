import test from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_LIBRARY_CENSUS_SCHEMA,
  SHELVES,
  SHELF_NAMES,
  classifyPath,
  shelfClass,
  buildCensus,
} from "../packages/core/src/node0-library-census.js";

const rec = (relative_path, over = {}) => ({
  relative_path,
  extension: relative_path.includes(".") ? relative_path.slice(relative_path.lastIndexOf(".")) : "",
  size: 1024,
  modified_time: "2026-04-13T00:00:00.000Z",
  file_hash: "a".repeat(64),
  ...over,
});

/* ── the defect that started this: vendor name ≠ chat export ──────────────── */

test("a .claude config directory is never chat history", () => {
  for (const p of [
    ".claude/settings.json",
    "home/.claude/projects/x/memory/MEMORY.md",
    "tools/claude-code/dist/index.js",
    ".claude/hooks/logs/stop.jsonl",
  ]) {
    assert.notEqual(classifyPath(p), "chat_history", p);
  }
});

test("real export shapes are chat history", () => {
  for (const p of [
    "exports/conversations.json",
    "corpus/conversations_unified.parquet",
    "archive/chat-export/2024-03.json",
    "Downloads/ChatGPT-Peak Output Mode.md",
    "gemini_session-notes.md",
    "chats/2025-01-14.jsonl",
  ]) {
    assert.equal(classifyPath(p), "chat_history", p);
  }
});

test("node_modules and .git are never library, whatever they look like", () => {
  assert.notEqual(classifyPath("x/node_modules/react-dom.d.ts"), "code");
  assert.notEqual(classifyPath("x/.git/objects/ab/cdef"), "config");
});

/* ── library vs node space: today's other finding ─────────────────────────── */

test("VM images, model weights and OS images are node space, not library", () => {
  for (const p of [
    "Desktop/Debian 12.x 64-bit.vmdk",
    "Desktop/Debian 12.x 64-bit.vmem",
    "models/WhiteRabbitNeo-V3-7B-Q4_K_M.gguf",
    "Downloads/kali-linux-2024.2-vmware-amd64.iso",
  ]) {
    assert.equal(shelfClass(classifyPath(p)), "node_space", p);
  }
});

test("research, chat and books are library", () => {
  for (const p of ["papers/2310.06770v2.pdf", "exports/conversations.json", "kutub/ihya.epub"]) {
    assert.equal(shelfClass(classifyPath(p)), "library", p);
  }
});

test("every shelf declares exactly one class", () => {
  for (const s of SHELF_NAMES) {
    assert.ok(["library", "node_space"].includes(SHELVES[s].class), `${s} has no class`);
  }
  assert.equal(shelfClass("unshelved"), "unknown");
});

/* ── the metadata boundary is inherited, not re-invented ──────────────────── */

test("a record carrying content is refused, not counted", () => {
  assert.throws(() => buildCensus([rec("a.md", { content: "hello" })], PROV), /CONTENT_LEAK/);
  assert.throws(() => buildCensus([rec("a.md", { preview: "hi" })], PROV), /CONTENT_LEAK/);
});

test("an undeclared field fails closed", () => {
  assert.throws(() => buildCensus([rec("a.md", { owner: "me" })], PROV), /UNDECLARED_METADATA_FIELD/);
});

/* ── census arithmetic ────────────────────────────────────────────────────── */

const PROV = { roots: ["/data/bizra"], measured_at: "2026-07-25T07:52:10.000Z" };
const sample = () => [
  rec("papers/a.pdf", { size: 100 }),
  rec("papers/b.pdf", { size: 200 }),
  rec("exports/conversations.json", { size: 50 }),
  rec("vm/Debian.vmdk", { size: 100000 }),
  rec("weird.xyzzy", { size: 7 }),
];

test("census is deterministic regardless of input order", () => {
  const a = buildCensus(sample(), PROV);
  const b = buildCensus([...sample()].reverse(), PROV);
  assert.deepEqual(a.shelves, b.shelves);
  assert.deepEqual(a.totals, b.totals);
});

test("totals split library from node space so neither is quoted for the other", () => {
  const c = buildCensus(sample(), PROV);
  assert.equal(c.totals.files, 5);
  assert.equal(c.totals.bytes, 100357);
  assert.equal(c.totals.library_bytes, 350);
  assert.equal(c.totals.node_space_bytes, 100000);
  assert.equal(c.totals.unshelved_bytes, 7);
  assert.equal(
    c.totals.library_bytes + c.totals.node_space_bytes + c.totals.unshelved_bytes,
    c.totals.bytes,
  );
});

test("an unknown extension lands in unshelved rather than a guess", () => {
  const c = buildCensus(sample(), PROV);
  assert.equal(c.shelves.unshelved.files, 1);
  assert.equal(c.shelves.unshelved.ext[".xyzzy"], 1);
});

test("duplicate relative paths are refused", () => {
  assert.throws(() => buildCensus([rec("a.md"), rec("a.md")], PROV), /DUPLICATE_RELATIVE_PATH/);
});

/* ── provenance: the rule the operator enforced today ─────────────────────── */

test("a census carries its measurement stamp and root list or it is not a measurement", () => {
  const c = buildCensus(sample(), {
    roots: ["/data/bizra"],
    measured_at: "2026-07-25T07:52:10.000Z",
  });
  assert.equal(c.schema, NODE0_LIBRARY_CENSUS_SCHEMA);
  assert.deepEqual(c.provenance.roots, ["/data/bizra"]);
  assert.equal(c.provenance.measured_at, "2026-07-25T07:52:10.000Z");
  assert.equal(c.provenance.source, "LOCAL_FILESYSTEM_METADATA");
});

test("a census without a measured_at is refused — no undated numbers", () => {
  assert.throws(() => buildCensus(sample(), { roots: ["/x"] }), /MEASURED_AT_REQUIRED/);
});

test("a census without roots is refused — a number must say what it covered", () => {
  assert.throws(
    () => buildCensus(sample(), { measured_at: "2026-07-25T07:52:10.000Z" }),
    /ROOTS_REQUIRED/,
  );
});

test("boundary is all-false and content is never read", () => {
  const c = buildCensus(sample(), { roots: ["/x"], measured_at: "2026-07-25T00:00:00.000Z" });
  assert.deepEqual(c.boundaries, {
    file_content_read: false,
    symlink_followed: false,
    file_moved_or_copied: false,
    file_deleted: false,
    network_used: false,
  });
});

test("truth label states this counts, it does not shelve", () => {
  const c = buildCensus(sample(), { roots: ["/x"], measured_at: "2026-07-25T00:00:00.000Z" });
  assert.equal(c.truth_label, "LOCAL_METADATA_CENSUS");
  assert.equal(c.does_not_prove.some((s) => s.includes("cloud")), true);
});
