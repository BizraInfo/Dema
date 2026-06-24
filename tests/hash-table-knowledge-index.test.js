import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildHashTableKnowledgeIndex,
  queryHashTableKnowledgeIndex,
  verifyHashTableKnowledgeIndex,
  normalizeKnowledgeEntry,
  HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA,
  HASH_TABLE_AXES,
} from "../packages/core/src/hash-table-knowledge-index.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function hashEntries() {
  return [
    {
      id: "component:dema-face",
      axis: "component",
      key: "dema",
      title: "Dema face",
      summary: "Local companion interface boundary.",
      evidence: ["docs/ARCHITECTURE.md"],
      tags: ["node0", "face"],
    },
    {
      id: "claim:rsi-preview-only",
      axis: "claim",
      key: "rsi-preview-only",
      title: "RSI preview only",
      summary: "RSI proposal kernel does not execute proposals.",
      evidence: ["docs/02-architecture/RSI_PROPOSAL_PREVIEW_v0_1.md"],
      tags: ["rsi", "boundary"],
    },
    {
      id: "risk:overclaim",
      axis: "risk",
      key: "overclaim",
      title: "Overclaim risk",
      summary: "Framework labels can outrun implementation evidence.",
      evidence: ["docs/02-architecture/HHMM_STATE_MACHINE_v0_1.md"],
      tags: ["ihsan", "claim-discipline"],
    },
  ];
}

test("1 · builds deterministic frozen six-axis buckets", () => {
  const a = buildHashTableKnowledgeIndex({ entries: hashEntries(), namespace: "node0" });
  const b = buildHashTableKnowledgeIndex({ entries: hashEntries(), namespace: "node0" });
  assert.equal(a.schema, HASH_TABLE_KNOWLEDGE_INDEX_SCHEMA);
  assert.deepEqual(a.axes, HASH_TABLE_AXES);
  assert.equal(a.entry_count, 3);
  assert.equal(a.index_hash, b.index_hash);
  assert.match(a.index_hash, SHA256_HEX);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(verifyHashTableKnowledgeIndex(a).valid, true);
});

test("2 · query returns the matching bucket only (hit/miss)", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const hit = queryHashTableKnowledgeIndex({ index, axis: "risk", key: "overclaim" });
  assert.equal(hit.valid, true);
  assert.equal(hit.found, true);
  assert.equal(hit.entries.length, 1);
  assert.equal(hit.entries[0].id, "risk:overclaim");

  const miss = queryHashTableKnowledgeIndex({ index, axis: "risk", key: "missing" });
  assert.equal(miss.valid, true);
  assert.equal(miss.found, false);
  assert.equal(miss.reason_code, "bucket_not_found");
});

test("3 · rejects unknown axes and missing evidence (fail closed)", () => {
  const badAxis = normalizeKnowledgeEntry({ id: "x", axis: "unknown", key: "x", evidence: ["a"] });
  assert.equal(badAxis.valid, false);
  assert.equal(badAxis.reason_code, "axis_unknown");

  const noEvidence = normalizeKnowledgeEntry({ id: "x", axis: "claim", key: "x" });
  assert.equal(noEvidence.valid, false);
  assert.equal(noEvidence.reason_code, "evidence_required");
});

test("4 · rejects duplicate entry ids (fail closed)", () => {
  const [entry] = hashEntries();
  const out = buildHashTableKnowledgeIndex({ entries: [entry, { ...entry }] });
  assert.equal(out.valid, false);
  assert.equal(out.reason_code, "duplicate_entry_id");
});

test("5 · index hash changes when an entry body changes", () => {
  const base = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const changed = buildHashTableKnowledgeIndex({
    entries: hashEntries().map((entry) =>
      entry.id === "risk:overclaim" ? { ...entry, summary: "Changed bounded summary." } : entry,
    ),
  });
  assert.notEqual(base.index_hash, changed.index_hash);
});

test("6 · verifier catches entry, index, and boundary tampering", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });

  const entryTamper = JSON.parse(JSON.stringify(index));
  entryTamper.entries[0].summary = "tampered";
  assert.ok(verifyHashTableKnowledgeIndex(entryTamper).blocked_by.some((b) => b.includes("entry_hash_mismatch")));

  const indexTamper = JSON.parse(JSON.stringify(index));
  indexTamper.namespace = "tampered";
  assert.ok(verifyHashTableKnowledgeIndex(indexTamper).blocked_by.includes("index_hash_mismatch"));

  const boundaryTamper = JSON.parse(JSON.stringify(index));
  boundaryTamper.boundary.network_call_performed = true;
  assert.ok(verifyHashTableKnowledgeIndex(boundaryTamper).blocked_by.some((b) => b.includes("boundary_not_false")));
});

test("7 · source has no fs/network/process/clock/random surfaces", async () => {
  const src = await readFile(
    new URL("../packages/core/src/hash-table-knowledge-index.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("8 · boundary all-false and no semantic-truth/database overclaim", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  for (const [key, value] of Object.entries(index.boundary)) {
    assert.equal(value, false, `boundary.${key} must remain false`);
  }
  assert.ok(index.what_this_does_not_prove.some((line) => /does not prove semantic truth/i.test(line)));
  assert.ok(index.what_this_does_not_prove.some((line) => /not a database/i.test(line)));
});

test("9 · query fails closed on a tampered index (verifies before serving)", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const tampered = JSON.parse(JSON.stringify(index));
  tampered.namespace = "tampered"; // breaks index_hash
  const q = queryHashTableKnowledgeIndex({ index: tampered, axis: "risk", key: "overclaim" });
  assert.equal(q.valid, false);
  assert.equal(q.reason_code, "hash_table_index_invalid");
  assert.ok(q.blocked_by.includes("index_hash_mismatch"));
});

test("10 · a bucket fabricated inconsistently with entries is rejected (bucket_hash is load-bearing, not decorative)", () => {
  const index = buildHashTableKnowledgeIndex({ entries: hashEntries() });
  const tampered = JSON.parse(JSON.stringify(index));
  // fabricate ONLY the bucket copy (entries array untouched), then recompute index_hash
  // over the tampered body so the index_hash backstop passes — isolating buckets_mismatch.
  const axisBuckets = tampered.buckets.risk;
  const someBucketId = Object.keys(axisBuckets)[0];
  axisBuckets[someBucketId].entries[0].summary = "fabricated bucket content";
  const { index_hash: _drop, ...body } = tampered;
  tampered.index_hash = sha256(stableStringify(body));

  const v = verifyHashTableKnowledgeIndex(tampered);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.includes("buckets_mismatch"), JSON.stringify(v.blocked_by));
  assert.ok(!v.blocked_by.includes("index_hash_mismatch"), "index_hash backstop was bypassed, so buckets_mismatch is what caught it");
});
