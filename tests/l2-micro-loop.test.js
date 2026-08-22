import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runL1Cycle, verifyChain } from "../packages/core/src/l1-micro-loop.js";
import {
  L2_SCHEMA,
  L2_TRUTH_LABEL,
  runL2Chain,
} from "../packages/core/src/l2-micro-loop.js";

const NOW = 1_800_000_000_000;

function freshSandbox() {
  const root = mkdtempSync(join(tmpdir(), "l2-"));
  writeFileSync(join(root, "a.txt"), "alpha\n");
  writeFileSync(join(root, "c.txt"), "charlie\n");
  writeFileSync(join(root, "e.txt"), "echo\n");
  return root;
}

function lease(root, over = {}) {
  return {
    lease_id: "LEASE-L2-001",
    scope_root: root,
    expires_at: NOW + 60_000,
    budget_acts: 3,
    ...over,
  };
}

const ACTS = Object.freeze([
  Object.freeze({ act_id: "act:a-b", src: "a.txt", dst: "b.txt" }),
  Object.freeze({ act_id: "act:c-d", src: "c.txt", dst: "d.txt" }),
]);

test("L2-01: two judge-free L1 acts close under one envelope and one chain", () => {
  const root = freshSandbox();
  const out = runL2Chain({
    sandboxRoot: root,
    acts: ACTS,
    lease: lease(root),
    now: NOW,
  });

  assert.equal(out.ok, true);
  assert.equal(out.schema, L2_SCHEMA);
  assert.equal(out.truth_label, L2_TRUTH_LABEL);
  assert.equal(out.outcome, "PASS");
  assert.equal(out.decision, "stop_clean");
  assert.equal(out.completed_acts, 2);
  assert.equal(out.attempted_acts, 2);
  assert.equal(out.remaining_budget, 1);
  assert.equal(out.authority_delta, 0);
  assert.equal(out.receipts.length, 2);
  assert.equal(existsSync(join(root, "b.txt")), true);
  assert.equal(existsSync(join(root, "d.txt")), true);
  assert.equal(existsSync(join(root, "a.txt")), false);
  assert.equal(existsSync(join(root, "c.txt")), false);

  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.entries, 2);
  assert.equal(out.chain_entries_after - out.chain_entries_before, 2);
});

test("L2-02: the whole chain is refused before mutation when envelope budget is insufficient", () => {
  const root = freshSandbox();
  const out = runL2Chain({
    sandboxRoot: root,
    acts: ACTS,
    lease: lease(root, { budget_acts: 1 }),
    now: NOW,
  });

  assert.equal(out.ok, false);
  assert.equal(out.reason, "lease_budget_insufficient_for_chain");
  assert.equal(out.attempted_acts, 0);
  assert.equal(out.completed_acts, 0);
  assert.equal(out.authority_delta, 0);
  assert.equal(existsSync(join(root, "a.txt")), true);
  assert.equal(existsSync(join(root, "c.txt")), true);
  assert.equal(existsSync(join(root, "b.txt")), false);
  assert.equal(existsSync(join(root, ".l1", "cycle.json")), false);
});

test("L2-03: failure preserves the verified prefix and never attempts later acts", () => {
  const root = freshSandbox();
  writeFileSync(join(root, "d.txt"), "occupied\n");

  const out = runL2Chain({
    sandboxRoot: root,
    acts: [
      ACTS[0],
      ACTS[1],
      { act_id: "act:e-f", src: "e.txt", dst: "f.txt" },
    ],
    lease: lease(root),
    now: NOW,
  });

  assert.equal(out.ok, false);
  assert.equal(out.outcome, "HALTED_VERIFIED_PREFIX");
  assert.equal(out.reason, "dst_occupied");
  assert.equal(out.failed_act_id, "act:c-d");
  assert.equal(out.completed_acts, 1);
  assert.equal(out.attempted_acts, 2);
  assert.equal(out.authority_delta, 0);

  assert.equal(existsSync(join(root, "b.txt")), true, "first verified act stays committed");
  assert.equal(existsSync(join(root, "a.txt")), false);
  assert.equal(readFileSync(join(root, "d.txt"), "utf8"), "occupied\n");
  assert.equal(existsSync(join(root, "c.txt")), true, "failed act leaves source intact");
  assert.equal(existsSync(join(root, "e.txt")), true, "later act not attempted");
  assert.equal(existsSync(join(root, "f.txt")), false);

  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.entries, 1, "only the successful prefix is sealed");
});

test("L2-04: malformed and empty chains fail closed before any L1 state exists", () => {
  for (const acts of [undefined, null, [], [{ src: "a.txt", dst: "b.txt" }]]) {
    const root = freshSandbox();
    const out = runL2Chain({ sandboxRoot: root, acts, lease: lease(root), now: NOW });
    assert.equal(out.ok, false);
    assert.equal(out.authority_delta, 0);
    assert.equal(out.attempted_acts, 0);
    assert.equal(existsSync(join(root, ".l1", "cycle.json")), false);
  }
});

test("L2-05: self-certification refusal on act one cannot be laundered by L2", () => {
  const root = freshSandbox();
  const out = runL2Chain({
    sandboxRoot: root,
    acts: ACTS,
    lease: lease(root),
    proposer: "same:party",
    certifier: "same:party",
    now: NOW,
  });

  assert.equal(out.ok, false);
  assert.equal(out.outcome, "HALTED_VERIFIED_PREFIX");
  assert.equal(out.reason, "admission_refused");
  assert.equal(out.completed_acts, 0);
  assert.equal(out.attempted_acts, 1);
  assert.equal(out.authority_delta, 0);
  assert.equal(existsSync(join(root, "a.txt")), true);
  assert.equal(existsSync(join(root, "c.txt")), true);
});

test("L2-06: an expired envelope refuses the chain before the first act", () => {
  const root = freshSandbox();
  const out = runL2Chain({
    sandboxRoot: root,
    acts: ACTS,
    lease: lease(root, { expires_at: NOW }),
    now: NOW,
  });

  assert.equal(out.ok, false);
  assert.equal(out.reason, "lease_expired");
  assert.equal(out.attempted_acts, 0);
  assert.equal(out.completed_acts, 0);
  assert.equal(out.authority_delta, 0);
  assert.equal(existsSync(join(root, "a.txt")), true);
});

test("L2-07: L2 extends an existing L1 history instead of creating a second receipt spine", () => {
  const root = freshSandbox();
  const first = runL1Cycle({
    sandboxRoot: root,
    src: "a.txt",
    dst: "b.txt",
    lease: lease(root),
    now: NOW,
  });
  assert.equal(first.ok, true);

  const out = runL2Chain({
    sandboxRoot: root,
    acts: [
      { act_id: "act:c-d", src: "c.txt", dst: "d.txt" },
      { act_id: "act:e-f", src: "e.txt", dst: "f.txt" },
    ],
    lease: lease(root),
    now: NOW + 1,
  });

  assert.equal(out.ok, true);
  assert.equal(out.chain_entries_before, 1);
  assert.equal(out.chain_entries_after, 3);
  assert.equal(verifyChain(root).entries, 3);
  assert.equal(out.receipts[0].prev_head, first.receipt.head);
});

test("L2-08: every receipt and result remains authority-monotonic", () => {
  const root = freshSandbox();
  const out = runL2Chain({ sandboxRoot: root, acts: ACTS, lease: lease(root), now: NOW });
  assert.equal(out.authority_delta, 0);
  for (const receipt of out.receipts) assert.equal(receipt.authority_delta, 0);
});
