import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CHAIN_ANCHOR_SCHEMA,
  CHAIN_ANCHOR_TRUTH_LABEL,
  VERDICTS,
  assertAnchorOutside,
  buildAnchorRecord,
  verifyAgainstAnchor,
  verifyAnchorLog,
} from "../packages/core/src/chain-anchor.js";
import { runL1Cycle, verifyChain } from "../packages/core/src/l1-micro-loop.js";

const hash = (s) => createHash("sha256").update(s).digest("hex");
const NOW = 1_700_000_000_000;

function anchorOf(entries, head, previous = null) {
  return buildAnchorRecord({ chain_id: "c1", entries, head, previous, hash, at: "t0" });
}
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

test("CA-01: schema, truth label, and a closed verdict vocabulary", () => {
  const v = verifyAgainstAnchor(anchorOf(1, H1), { entries: 1, head: H1 });
  assert.equal(v.schema, CHAIN_ANCHOR_SCHEMA);
  assert.equal(v.truth_label, CHAIN_ANCHOR_TRUTH_LABEL);
  assert.ok(VERDICTS.includes(v.verdict));
  assert.equal(Object.isFrozen(v), true);
});

test("CA-02: exact match is OK; nothing else passes by accident", () => {
  const v = verifyAgainstAnchor(anchorOf(2, H1), { entries: 2, head: H1 });
  assert.equal(v.verdict, "OK");
  assert.equal(v.intact, true);
});

test("CA-03: THE DEFECT — an erased chain is caught, where verifyChain says valid", () => {
  // Live reproduction: run a real cycle, anchor it, then erase the chain.
  const root = mkdtempSync(join(tmpdir(), "ca-"));
  writeFileSync(join(root, "a.txt"), "a\n");
  const out = runL1Cycle({
    sandboxRoot: root,
    src: "a.txt",
    dst: "b.txt",
    lease: { lease_id: "L", scope_root: root, expires_at: NOW + 6e4, budget_acts: 1 },
    now: NOW,
  });
  assert.equal(out.ok, true);

  const before = verifyChain(root);
  assert.equal(before.valid, true);
  assert.equal(before.entries, 1);
  const anchor = anchorOf(before.entries, before.head);

  // Erase by rename — no delete needed, and the mount forbids deletes anyway.
  renameSync(join(root, ".l1", "chain.jsonl"), join(root, ".l1", "chain.gone"));

  // Layer 1 — E5 continuity. The in-band seal marker survives the chain, so
  // the kernel now refuses instead of reporting a clean empty history.
  const chainOnly = verifyChain(root);
  assert.equal(chainOnly.valid, false, "E5 catches the chain-only delete");
  assert.equal(chainOnly.why, "chain_absent_with_history");

  // Layer 2 — the surviving false GREEN. E5's witness lives inside the same
  // directory it testifies about, so removing both leaves the kernel with no
  // evidence that history ever existed: it reports a clean genesis. This is
  // the gap an in-band guard structurally cannot close.
  renameSync(join(root, ".l1", "last_seal_head"), join(root, ".l1", "marker.gone"));

  const after = verifyChain(root);
  assert.equal(after.valid, true, "chain + marker both gone still reads as valid genesis");
  assert.equal(after.entries, 0);
  assert.equal(after.genesis, true);

  // Only an expectation held OUTSIDE the erased directory can judge this.
  const judged = verifyAgainstAnchor(anchor, after);
  assert.equal(judged.verdict, "ERASED");
  assert.equal(judged.intact, false);
  assert.equal(judged.anchored_entries, 1);
  assert.equal(judged.observed_entries, 0);
});

test("CA-04: partial loss is TRUNCATED, not ERASED — the distinction is diagnostic", () => {
  const v = verifyAgainstAnchor(anchorOf(5, H1), { entries: 2, head: H2 });
  assert.equal(v.verdict, "TRUNCATED");
  assert.equal(v.intact, false);
});

test("CA-05: same length, different head is FORKED — history replaced", () => {
  const v = verifyAgainstAnchor(anchorOf(3, H1), { entries: 3, head: H2 });
  assert.equal(v.verdict, "FORKED");
  assert.equal(v.anchored_head, H1);
  assert.equal(v.observed_head, H2);
});

test("CA-06: growth is only EXTENDED when the anchored head is proven present", () => {
  const anchor = anchorOf(2, H1);
  // Without head_history, growth is indistinguishable from replacement.
  const guessy = verifyAgainstAnchor(anchor, { entries: 4, head: H2 });
  assert.equal(guessy.verdict, "MALFORMED");
  assert.equal(guessy.intact, false);
  assert.match(guessy.detail, /head_history/);

  // With history that contains the anchored head at its position: proven.
  const good = verifyAgainstAnchor(anchor, { entries: 4, head: H2 }, {
    head_history: [H2, H1, H2, H2],
  });
  assert.equal(good.verdict, "EXTENDED");
  assert.equal(good.intact, true);

  // With history that does not: the chain was rebuilt, not extended.
  const bad = verifyAgainstAnchor(anchor, { entries: 4, head: H2 }, {
    head_history: [H2, H2, H2, H2],
  });
  assert.equal(bad.verdict, "FORKED");
  assert.equal(bad.intact, false);
});

test("CA-07: fail closed — no anchor and malformed inputs never pass", () => {
  for (const bad of [null, undefined]) {
    const v = verifyAgainstAnchor(bad, { entries: 1, head: H1 });
    assert.equal(v.verdict, "NO_ANCHOR");
    assert.equal(v.intact, false);
  }
  for (const bad of [{}, { entries: -1, head: H1 }, { entries: 1, head: "nothex" }, 42, "x"]) {
    const v = verifyAgainstAnchor(bad, { entries: 1, head: H1 });
    assert.equal(v.intact, false, JSON.stringify(bad));
  }
  for (const bad of [null, undefined, 7, "x", { entries: "many" }]) {
    const v = verifyAgainstAnchor(anchorOf(1, H1), bad);
    assert.equal(v.verdict, "MALFORMED");
    assert.equal(v.intact, false);
  }
});

test("CA-08: the anchor log protects itself — an edited anchor is detected", () => {
  const a1 = anchorOf(1, H1);
  const a2 = anchorOf(2, H2, a1);
  assert.equal(verifyAnchorLog([a1, a2], hash).verdict, "OK");

  const edited = { ...a2, entries: 99 };
  const v = verifyAnchorLog([a1, edited], hash);
  assert.equal(v.verdict, "FORKED");
  assert.equal(v.broken_at, 1);

  // Dropping the first record breaks the link, not just the count.
  assert.equal(verifyAnchorLog([a2], hash).verdict, "FORKED");
  assert.equal(verifyAnchorLog([], hash).verdict, "OK"); // empty is honestly empty
  assert.equal(verifyAnchorLog("nope", hash).verdict, "MALFORMED");
});

test("CA-09: placement law — an anchor inside the leased scope is refused", () => {
  const scope = "/tmp/sandbox";
  assert.equal(assertAnchorOutside("/tmp/sandbox/.l1", scope).intact, false);
  assert.equal(assertAnchorOutside("/tmp/sandbox", scope).intact, false);
  assert.equal(assertAnchorOutside("/var/anchors", scope).verdict, "OK");
  // sibling directory with a shared prefix must not be mistaken for inside
  assert.equal(assertAnchorOutside("/tmp/sandbox-other", scope).verdict, "OK");
  assert.equal(assertAnchorOutside(7, scope).verdict, "MALFORMED");
});

test("CA-10: purity — the kernel performs no IO and injects hash + time", () => {
  const raw = readFileSync(
    new URL("../packages/core/src/chain-anchor.js", import.meta.url),
    "utf8",
  );
  // Scan executable code only. A comment that names `Date.now()` in order to
  // forbid it is documentation, not a clock read — matching it would train the
  // next author to stop writing the prohibition down.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.equal(/from ["']node:fs["']/.test(src), false);
  assert.equal(/from ["']node:crypto["']/.test(src), false);
  assert.equal(/Date\.now\(\)/.test(src), false, "no clock read in executable code");
  assert.equal(/Math\.random/.test(src), false);
  assert.match(raw, /never Date\.now\(\)/, "the prohibition is still documented");
  // determinism: same inputs, identical anchor hash
  assert.equal(anchorOf(1, H1).anchor_hash, anchorOf(1, H1).anchor_hash);
});

test("CA-11: end-to-end — anchored survival across a second real cycle", () => {
  const root = mkdtempSync(join(tmpdir(), "ca2-"));
  const lease = (n) => ({
    lease_id: "L", scope_root: root, expires_at: NOW + 6e4, budget_acts: 1,
  });
  writeFileSync(join(root, "one.txt"), "1\n");
  runL1Cycle({ sandboxRoot: root, src: "one.txt", dst: "one-done.txt", lease: lease(), now: NOW });
  const s1 = verifyChain(root);
  const a1 = anchorOf(s1.entries, s1.head);

  writeFileSync(join(root, "two.txt"), "2\n");
  runL1Cycle({ sandboxRoot: root, src: "two.txt", dst: "two-done.txt", lease: lease(), now: NOW + 1 });
  const s2 = verifyChain(root);

  const heads = readFileSync(join(root, ".l1", "chain.jsonl"), "utf8")
    .trim().split("\n").map((l) => JSON.parse(l).head);
  const v = verifyAgainstAnchor(a1, s2, { head_history: heads });
  assert.equal(v.verdict, "EXTENDED");
  assert.equal(v.intact, true);
});
