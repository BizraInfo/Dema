import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0ProofChainLink,
  buildNode0ProofChainLinkPayload,
  verifyNode0ProofChainLink,
  runNode0ProofChainLink,
  NODE0_PROOF_CHAIN_LINK_SCHEMA,
  NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL,
  NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
  NODE0_PROOF_CHAIN_GENESIS_PREV,
} from "../packages/core/src/node0-proof-chain-link.js";
import { runNode0ProofChainLinkCheck } from "../scripts/review/node0-proof-chain-link-check.mjs";

// Fixture: three #307-style receipt content_hash anchors.
const RECEIPTS = [
  `sha256:${"1".repeat(64)}`,
  `sha256:${"2".repeat(64)}`,
  `sha256:${"3".repeat(64)}`,
];

test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0ProofChainLink({ consent: "wrong", receiptHashes: RECEIPTS });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan positively validates receipt anchors (empty / malformed blocked)", () => {
  const empty = planNode0ProofChainLink({
    consent: NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
    receiptHashes: [],
  });
  assert.ok(empty.blocked_by.includes("receipt_hashes_empty"));
  const malformed = planNode0ProofChainLink({
    consent: NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
    receiptHashes: ["not-a-sha256-anchor"],
  });
  assert.ok(malformed.blocked_by.includes("receipt_anchor_malformed"));
});

test("genesis link binds the genesis sentinel at index 0", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  assert.equal(chain.schema, NODE0_PROOF_CHAIN_LINK_SCHEMA);
  assert.equal(chain.links[0].index, 0);
  assert.equal(chain.links[0].prev_link_hash, NODE0_PROOF_CHAIN_GENESIS_PREV);
});

test("each link commits to the previous link hash (append-only continuity)", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  for (let i = 1; i < chain.links.length; i += 1) {
    assert.equal(chain.links[i].prev_link_hash, chain.links[i - 1].link_hash);
  }
  assert.equal(chain.head_hash, chain.links[chain.links.length - 1].link_hash);
});

test("chain is content-addressed and verify accepts a fresh chain", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  assert.match(chain.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(verifyNode0ProofChainLink(chain).ok, true);
  assert.equal(chain.boundary.execution_allowed, false);
  assert.equal(chain.boundary.live_execution_performed, false);
});

test("verify rejects a tampered receipt anchor in the middle of the chain", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  const tampered = {
    ...chain,
    links: chain.links.map((l, i) =>
      i === 1 ? { ...l, receipt_content_hash: `sha256:${"9".repeat(64)}` } : l,
    ),
  };
  const v = verifyNode0ProofChainLink(tampered);
  assert.equal(v.ok, false);
  assert.match(v.reason, /link_hash_mismatch/);
});

test("verify rejects a reordered (forked) chain", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  const reordered = {
    ...chain,
    links: [chain.links[1], chain.links[0], chain.links[2]],
  };
  assert.equal(verifyNode0ProofChainLink(reordered).ok, false);
});

test("verify rejects a forged link_hash", () => {
  const chain = buildNode0ProofChainLinkPayload(RECEIPTS);
  const forged = {
    ...chain,
    links: chain.links.map((l, i) =>
      i === 0 ? { ...l, link_hash: `sha256:${"a".repeat(64)}` } : l,
    ),
  };
  assert.equal(verifyNode0ProofChainLink(forged).ok, false);
});

test("review gate closes the loop: build -> verify -> reorder/tamper reject", () => {
  const result = runNode0ProofChainLinkCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_PROOF_CHAIN_LINK_SCHEMA);
  assert.equal(result.truth_label, NODE0_PROOF_CHAIN_LINK_TRUTH_LABEL);
  assert.ok(result.link_count >= 2);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0ProofChainLink({
    consent: NODE0_PROOF_CHAIN_LINK_GO_PHRASE,
    receiptHashes: RECEIPTS,
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});
