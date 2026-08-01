import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  runL1Cycle,
  resumeL1Cycle,
  verifyChain,
  checkLease,
  PHASES,
  L1_SCHEMA,
} from "../packages/core/src/l1-micro-loop.js";

const NOW = 1_700_000_000_000;

function freshSandbox(content = "the seed does not argue; it grows\n") {
  const root = mkdtempSync(join(tmpdir(), "l1-"));
  writeFileSync(join(root, "seed.txt"), content);
  return root;
}

function lease(root, over = {}) {
  return {
    lease_id: "LEASE-TEST-001",
    scope_root: root,
    expires_at: NOW + 60_000,
    budget_acts: 1,
    ...over,
  };
}

function run(root, over = {}) {
  return runL1Cycle({
    sandboxRoot: root,
    src: "seed.txt",
    dst: "renamed-seed.txt",
    lease: lease(root),
    now: NOW,
    ...over,
  });
}

// Resume mutates, so it carries the same lease as the cycle it finishes.
function resume(root, over = {}) {
  return resumeL1Cycle({
    sandboxRoot: root,
    lease: lease(root),
    now: NOW + 1000,
    ...over,
  });
}

test("L1-01: happy path — one act, one proof, one receipt, stop clean", () => {
  const root = freshSandbox();
  const out = run(root);
  assert.equal(out.ok, true);
  assert.equal(out.outcome, "PASS");
  assert.equal(out.decision, "stop_clean");
  assert.equal(out.authority_delta, 0);
  assert.equal(out.verify.passed, true);
  assert.equal(existsSync(join(root, "renamed-seed.txt")), true);
  assert.equal(existsSync(join(root, "seed.txt")), false);
  assert.equal(out.receipt.schema, L1_SCHEMA);
  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.entries, 1);
});

test("L1-02: lease violations fail closed BEFORE any mutation", () => {
  const cases = [
    [null, "lease_required"],
    [{}, "lease_required"],
    [lease("/somewhere/else"), "lease_scope_violation"],
    [lease(undefined, { expires_at: NOW - 1 }), "lease_expired"],
    [lease(undefined, { budget_acts: 0 }), "lease_budget_exhausted"],
  ];
  for (const [l, reason] of cases) {
    const root = freshSandbox();
    const theLease = l && l.scope_root === undefined ? { ...l, scope_root: root } : l;
    const out = run(root, { lease: theLease });
    assert.equal(out.ok, false, reason);
    assert.equal(out.reason, reason);
    assert.equal(existsSync(join(root, "seed.txt")), true, "untouched");
    assert.equal(existsSync(join(root, ".l1", "cycle.json")), false, "no state persisted");
  }
});

test("L1-03: act escaping the sandbox fails closed", () => {
  const root = freshSandbox();
  const out = run(root, { dst: "../escape.txt" });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "lease_scope_violation");
  assert.equal(existsSync(join(root, "seed.txt")), true);
});

test("L1-04: self-certification cannot reach ACT (admission kernel wired)", () => {
  const root = freshSandbox();
  const out = run(root, { proposer: "same:party", certifier: "same:party" });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "admission_refused");
  assert.equal(out.detail, "self_certification");
  assert.equal(existsSync(join(root, "seed.txt")), true, "no mutation");
});

test("L1-05: kill at EVERY phase boundary — resume converges, chain stays valid", () => {
  for (const phase of ["PROPOSED", "ADMITTED", "CHECKPOINTED", "ACTED", "VERIFIED"]) {
    const root = freshSandbox();
    assert.throws(() => run(root, { crash_after: phase }), /simulated-kill/, phase);
    const resumed = resume(root);
    assert.equal(resumed.ok, true, `${phase}: resume ok`);
    assert.equal(resumed.authority_delta, 0, phase);
    const converged =
      resumed.outcome === "PASS" || resumed.outcome === "ABORTED_CLEAN";
    assert.equal(converged, true, `${phase}: ${resumed.outcome}`);
    if (resumed.outcome === "PASS") {
      assert.equal(existsSync(join(root, "renamed-seed.txt")), true, phase);
    } else {
      assert.equal(existsSync(join(root, "seed.txt")), true, phase);
    }
    assert.equal(verifyChain(root).valid, true, `${phase}: chain`);
    // resume is idempotent
    const again = resume(root, { now: NOW + 2000 });
    assert.equal(again.outcome, "ALREADY_COMPLETE", phase);
  }
});

test("L1-06: forged verification fails — tampered content rolls back verified", () => {
  const root = freshSandbox();
  // crash after ACT, then tamper with the moved file before resume
  assert.throws(() => run(root, { crash_after: "ACTED" }), /simulated-kill/);
  writeFileSync(join(root, "renamed-seed.txt"), "tampered content\n");
  const resumed = resume(root);
  assert.equal(resumed.ok, false);
  assert.equal(resumed.outcome, "FAIL_ROLLED_BACK");
  assert.equal(resumed.reason, "verification_failed");
  assert.equal(resumed.authority_delta, 0);
  assert.equal(resumed.restore_verified, true, "restore is itself hash-verified");
  assert.equal(
    readFileSync(join(root, "seed.txt"), "utf8"),
    "the seed does not argue; it grows\n",
    "original content restored from checkpoint",
  );
  assert.equal(verifyChain(root).valid, true);
});

test("L1-07: a forged chain entry is detected", () => {
  const root = freshSandbox();
  run(root);
  const chainPath = join(root, ".l1", "chain.jsonl");
  const entry = JSON.parse(readFileSync(chainPath, "utf8").trim());
  entry.outcome = "PASS_BUT_EDITED";
  writeFileSync(chainPath, JSON.stringify(entry) + "\n");
  const chain = verifyChain(root);
  assert.equal(chain.valid, false);
  assert.equal(chain.why, "head_forged");
});

test("L1-08: every failure path reports authority_delta 0", () => {
  const outs = [];
  const r1 = freshSandbox();
  assert.throws(() => run(r1, { crash_after: "ACTED" }), /simulated-kill/);
  writeFileSync(join(r1, "renamed-seed.txt"), "x");
  outs.push(resume(r1, { lease: lease(r1), now: NOW }));
  const r2 = freshSandbox();
  assert.throws(() => run(r2, { crash_after: "PROPOSED" }), /simulated-kill/);
  outs.push(resume(r2, { lease: lease(r2), now: NOW }));
  for (const o of outs) {
    assert.equal(o.authority_delta, 0);
  }
});

test("L1-09: phase order is law and every persisted phase is a member", () => {
  assert.deepEqual(PHASES, [
    "PROPOSED", "ADMITTED", "CHECKPOINTED", "ACTED",
    "VERIFIED", "SEALED", "DECIDED",
  ]);
  const root = freshSandbox();
  run(root);
  const state = JSON.parse(readFileSync(join(root, ".l1", "cycle.json"), "utf8"));
  assert.equal(state.phase, "DECIDED");
  assert.ok(PHASES.includes(state.phase));
});

test("L1-10: checkLease is pure and fail-closed on shape", () => {
  const root = freshSandbox();
  assert.equal(checkLease(undefined, { sandboxRoot: root, now: NOW }), "lease_required");
  assert.equal(
    checkLease({ lease_id: "", scope_root: root, expires_at: NOW + 1, budget_acts: 1 },
      { sandboxRoot: root, now: NOW }),
    "lease_required",
  );
  assert.equal(
    checkLease({ lease_id: "x", scope_root: root, expires_at: NOW + 1, budget_acts: 1.5 },
      { sandboxRoot: root, now: NOW }),
    "lease_budget_exhausted",
  );
  assert.equal(
    checkLease(lease(root), { sandboxRoot: root, now: NOW }),
    null,
  );
});

test("L1-12: remaining defensive branches — chain prev mismatch, no cycle, unknown phase", () => {
  const root = freshSandbox();
  run(root);
  const chainPath = join(root, ".l1", "chain.jsonl");
  const entry = JSON.parse(readFileSync(chainPath, "utf8").trim());
  writeFileSync(
    chainPath,
    JSON.stringify({ ...entry, prev_head: "wrong-genesis" }) + "\n",
  );
  const chain = verifyChain(root);
  assert.equal(chain.valid, false);
  assert.equal(chain.why, "prev_head_mismatch");

  const empty = mkdtempSync(join(tmpdir(), "l1-empty-"));
  assert.equal(resume(empty, { lease: lease(empty) }).reason, "no_cycle");

  const root2 = freshSandbox();
  run(root2);
  const statePath = join(root2, ".l1", "cycle.json");
  const st = JSON.parse(readFileSync(statePath, "utf8"));
  st.phase = "MYSTERY";
  writeFileSync(statePath, JSON.stringify(st));
  const res = resume(root2, { lease: lease(root2) });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unknown_phase");
  assert.equal(res.authority_delta, 0);
});

test("L1-11: source missing refuses before persisting anything", () => {
  const root = freshSandbox();
  const out = run(root, { src: "not-there.txt" });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "source_missing");
  assert.equal(existsSync(join(root, ".l1", "cycle.json")), false);
});

// ---------------------------------------------------------------------------
// Blast-radius regressions. Each of these returned PASS before the guards:
// admission asked "is this check judge-free?" and never asked "what does this
// act destroy, and can the act reach the evidence?".
// ---------------------------------------------------------------------------

test("L1-13 (E1): an occupied dst is refused — rename destroys what it lands on", () => {
  const root = freshSandbox();
  const victim = "IRREPLACEABLE VICTIM DATA\n";
  writeFileSync(join(root, "renamed-seed.txt"), victim);
  const out = run(root);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "dst_occupied");
  assert.equal(readFileSync(join(root, "renamed-seed.txt"), "utf8"), victim);
  assert.equal(existsSync(join(root, "seed.txt")), true, "src untouched");
  assert.equal(existsSync(join(root, ".l1", "cycle.json")), false, "no state persisted");
});

test("L1-13b (E1): a dangling symlink still occupies its path", () => {
  const root = freshSandbox();
  symlinkSync(join(root, "nothing-here.txt"), join(root, "renamed-seed.txt"));
  const out = run(root);
  assert.equal(out.ok, false);
  assert.equal(out.reason, "dst_occupied");
});

test("L1-14 (E2): the act cannot reach the audit trail it will be judged by", () => {
  const root = freshSandbox();
  run(root);
  writeFileSync(join(root, "seed2.txt"), "second\n");
  const second = runL1Cycle({
    sandboxRoot: root, src: "seed2.txt", dst: "two.txt",
    lease: lease(root), now: NOW + 1,
  });
  assert.equal(second.ok, true);
  assert.equal(verifyChain(root).entries, 2, "two receipts of real history");

  // Erasure-by-rename: move the chain away, and sealReceipt would re-anchor at
  // genesis — a one-entry chain that verifies clean, sealing its own erasure.
  const evil = runL1Cycle({
    sandboxRoot: root, src: ".l1/chain.jsonl", dst: "harmless.txt",
    lease: lease(root), now: NOW + 2,
  });
  assert.equal(evil.ok, false);
  assert.equal(evil.reason, "act_targets_audit_state");
  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.entries, 2, "history survived");

  // Planting into the checkpoint store is the same hole from the other side.
  const plant = runL1Cycle({
    sandboxRoot: root, src: "two.txt", dst: ".l1/backup/planted.bak",
    lease: lease(root), now: NOW + 3,
  });
  assert.equal(plant.ok, false);
  assert.equal(plant.reason, "act_targets_audit_state");
});

test("L1-15 (E4): a symlink out of the sandbox is not in scope", () => {
  const root = freshSandbox();
  const outside = mkdtempSync(join(tmpdir(), "l1-OUTSIDE-"));
  symlinkSync(outside, join(root, "link"));
  const out = run(root, { dst: "link/target.txt" });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "lease_scope_violation");
  assert.equal(existsSync(join(outside, "target.txt")), false, "nothing left the scope");
  assert.equal(existsSync(join(root, "seed.txt")), true);

  // A symlinked SOURCE reaches out of scope just as far.
  const root2 = freshSandbox();
  const outside2 = mkdtempSync(join(tmpdir(), "l1-OUTSIDE2-"));
  writeFileSync(join(outside2, "secret.txt"), "exfiltrate me\n");
  symlinkSync(join(outside2, "secret.txt"), join(root2, "peek.txt"));
  const out2 = run(root2, { src: "peek.txt", dst: "copied.txt" });
  assert.equal(out2.ok, false);
  assert.equal(out2.reason, "lease_scope_violation");
  assert.equal(existsSync(join(outside2, "secret.txt")), true, "source not moved");
});

test("L1-16 (E3): resume is a mutation and stands under the same lease", () => {
  const cases = [
    [undefined, "lease_required"],
    [{ expires_at: NOW - 1 }, "lease_expired"],
    [{ lease_id: "SOME-OTHER-LEASE" }, "lease_mismatch"],
  ];
  for (const [over, reason] of cases) {
    const root = freshSandbox();
    assert.throws(() => run(root, { crash_after: "ACTED" }), /simulated-kill/);
    writeFileSync(join(root, "renamed-seed.txt"), "tampered\n");
    const theLease = over === undefined ? undefined : lease(root, over);
    const out = resumeL1Cycle({ sandboxRoot: root, lease: theLease, now: NOW + 1000 });
    assert.equal(out.ok, false, reason);
    assert.equal(out.reason, reason);
    assert.equal(out.authority_delta, 0, reason);
    // The refusal must also mean no rollback rename happened.
    assert.equal(existsSync(join(root, "renamed-seed.txt")), true, `${reason}: no mutation`);
    assert.equal(existsSync(join(root, "seed.txt")), false, `${reason}: no mutation`);
  }

  // With the cycle's own live lease, resume still completes.
  const root = freshSandbox();
  assert.throws(() => run(root, { crash_after: "ACTED" }), /simulated-kill/);
  const ok = resume(root);
  assert.equal(ok.outcome, "PASS");
});

// ---------------------------------------------------------------------------
// Chain continuity — out-of-band erasure must not re-anchor as genesis.
// ---------------------------------------------------------------------------

test("L1-17 (E5): external chain delete fails closed — not a clean genesis", () => {
  const root = freshSandbox();
  const first = run(root);
  assert.equal(first.ok, true);
  assert.equal(verifyChain(root).entries, 1);
  assert.equal(existsSync(join(root, ".l1", "last_seal_head")), true);

  unlinkSync(join(root, ".l1", "chain.jsonl"));
  const erased = verifyChain(root);
  assert.equal(erased.valid, false);
  assert.equal(erased.why, "chain_absent_with_history");
  assert.equal(erased.genesis, false);
  assert.equal(erased.entries, 0);

  // A follow-on cycle must refuse BEFORE mutation — no re-anchor seal.
  writeFileSync(join(root, "seed2.txt"), "second\n");
  const second = runL1Cycle({
    sandboxRoot: root,
    src: "seed2.txt",
    dst: "two.txt",
    lease: lease(root),
    now: NOW + 1,
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "chain_absent_with_history");
  assert.equal(existsSync(join(root, "seed2.txt")), true, "untouched");
  assert.equal(existsSync(join(root, "two.txt")), false);
});

test("L1-17b: mid-first-cycle crash without a seal remains genesis", () => {
  const root = freshSandbox();
  assert.throws(() => run(root, { crash_after: "CHECKPOINTED" }), /simulated-kill/);
  assert.equal(existsSync(join(root, ".l1", "backup")), true);
  assert.equal(existsSync(join(root, ".l1", "cycle.json")), true);
  assert.equal(existsSync(join(root, ".l1", "chain.jsonl")), false);
  assert.equal(existsSync(join(root, ".l1", "last_seal_head")), false);
  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.genesis, true);
  assert.equal(chain.entries, 0);
});

test("L1-17c: empty chain file fails closed", () => {
  const root = freshSandbox();
  run(root);
  writeFileSync(join(root, ".l1", "chain.jsonl"), "");
  const empty = verifyChain(root);
  assert.equal(empty.valid, false);
  assert.equal(empty.why, "chain_absent_with_history");
});

test("L1-17d: fresh sandbox with no .l1 is genesis", () => {
  const root = freshSandbox();
  const chain = verifyChain(root);
  assert.equal(chain.valid, true);
  assert.equal(chain.genesis, true);
  assert.equal(chain.entries, 0);
});

// ---------------------------------------------------------------------------
// Anchored mode (CHAIN-ANCHOR-1A wired). `.l1/last_seal_head` is an in-band
// witness — it dies with the directory it testifies about. These prove the
// loop now carries an expectation the act cannot reach.
// ---------------------------------------------------------------------------

function anchorDirOutside() {
  return mkdtempSync(join(tmpdir(), "l1-anchor-"));
}

function anchorRecords(anchorDir) {
  const p = join(anchorDir, "chain-anchor.jsonl");
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8").trim();
  return raw ? raw.split("\n").map((l) => JSON.parse(l)) : [];
}

test("L1-17: anchored seal records the head outside the leased scope", () => {
  const root = freshSandbox();
  const anchorDir = anchorDirOutside();
  const out = run(root, { anchorDir });
  assert.equal(out.outcome, "PASS");

  const recs = anchorRecords(anchorDir);
  assert.equal(recs.length, 1, "one seal, one anchor");
  assert.equal(recs[0].entries, 1);
  assert.equal(recs[0].head, verifyChain(root).head, "anchor binds the sealed head");
  assert.equal(recs[0].prev_anchor, "anchor-genesis");

  // A second cycle extends both chain and anchor log.
  writeFileSync(join(root, "seed2.txt"), "second\n");
  const two = runL1Cycle({
    sandboxRoot: root, src: "seed2.txt", dst: "two.txt",
    lease: lease(root), now: NOW + 1, anchorDir,
  });
  assert.equal(two.outcome, "PASS");
  const recs2 = anchorRecords(anchorDir);
  assert.equal(recs2.length, 2);
  assert.equal(recs2[1].entries, 2);
  assert.equal(recs2[1].prev_anchor, recs2[0].anchor_hash, "anchor log is hash-linked");
});

test("L1-18: THE CLOSE — full erasure is refused before any mutation", () => {
  const root = freshSandbox();
  const anchorDir = anchorDirOutside();
  assert.equal(run(root, { anchorDir }).outcome, "PASS");

  // Erase BOTH the chain and its in-band witness — the case that still read
  // as a clean genesis and let the loop keep sealing over erased history.
  unlinkSync(join(root, ".l1", "chain.jsonl"));
  unlinkSync(join(root, ".l1", "last_seal_head"));
  const blind = verifyChain(root);
  assert.equal(blind.valid, true, "in-band verify still cannot see the erasure");
  assert.equal(blind.entries, 0);

  // The loop can. And it refuses before touching a single file.
  writeFileSync(join(root, "next.txt"), "next\n");
  const out = runL1Cycle({
    sandboxRoot: root, src: "next.txt", dst: "next-done.txt",
    lease: lease(root), now: NOW + 1, anchorDir,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "anchor_erased");
  assert.equal(existsSync(join(root, "next.txt")), true, "no mutation");
  assert.equal(existsSync(join(root, "next-done.txt")), false, "no mutation");

  // Resume is gated by the same expectation.
  const resumed = resumeL1Cycle({
    sandboxRoot: root, lease: lease(root), now: NOW + 2, anchorDir,
  });
  assert.equal(resumed.ok, false);
  assert.equal(resumed.reason, "anchor_erased");
  assert.equal(resumed.authority_delta, 0);
});

test("L1-19: an anchor inside the leased scope is refused — it could erase its own judge", () => {
  const root = freshSandbox();
  const out = run(root, { anchorDir: join(root, "anchors") });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "anchor_inside_scope");
  assert.equal(existsSync(join(root, "seed.txt")), true, "no mutation");
});

test("L1-20: a forged anchor log is refused, and a stale anchor reads as EXTENDED", () => {
  const root = freshSandbox();
  const anchorDir = anchorDirOutside();
  assert.equal(run(root, { anchorDir }).outcome, "PASS");

  // Growth past the anchor is provable from head history, not assumed.
  writeFileSync(join(root, "seed2.txt"), "second\n");
  const grown = runL1Cycle({
    sandboxRoot: root, src: "seed2.txt", dst: "two.txt",
    lease: lease(root), now: NOW + 1, anchorDir,
  });
  assert.equal(grown.outcome, "PASS", "an honestly extended chain still runs");

  // Editing an anchor record breaks the link and the loop stops.
  const p = join(anchorDir, "chain-anchor.jsonl");
  const recs = anchorRecords(anchorDir);
  recs[0].entries = 99;
  writeFileSync(p, recs.map((r) => JSON.stringify(r)).join("\n") + "\n");

  writeFileSync(join(root, "seed3.txt"), "third\n");
  const out = runL1Cycle({
    sandboxRoot: root, src: "seed3.txt", dst: "three.txt",
    lease: lease(root), now: NOW + 2, anchorDir,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "anchor_log_forged");
  assert.equal(existsSync(join(root, "seed3.txt")), true, "no mutation");
});
