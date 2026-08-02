import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  BLOCK_REASONS,
  OMEGA0_SCHEMA,
  enforceAnchorPolicy,
  replaySeal,
  runMechanicalClosure,
} from "../packages/core/src/omega0-mechanical-closure.js";
import * as omega0 from "../packages/core/src/omega0-mechanical-closure.js";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const NOW = 1_700_000_000_000;
const H = (n) => String(n).repeat(64).slice(0, 64);

/** Real-filesystem effect adapter: moves loose files into buckets, reversibly. */
function fileAdapter(root, { breakIt = null, calls = null } = {}) {
  let journal = [];
  return {
    propose() {
      return readdirSync(root)
        .filter((n) => n.endsWith(".txt"))
        .sort()
        .map((n) => ({ op: "move", src: n, dst: join("bucket", n) }));
    },
    manifest() {
      const out = [];
      const walk = (rel) => {
        for (const n of readdirSync(join(root, rel), { withFileTypes: true })) {
          const r = join(rel, n.name);
          if (n.isDirectory()) walk(r);
          else out.push({ path: r, content_id: sha256(readFileSync(join(root, r))) });
        }
      };
      walk(".");
      return out.sort((a, b) => a.path.localeCompare(b.path));
    },
    apply(plan) {
      if (calls) calls.apply = (calls.apply ?? 0) + 1;
      journal = [];
      mkdirSync(join(root, "bucket"), { recursive: true });
      for (const op of plan) {
        renameSync(join(root, op.src), join(root, op.dst));
        journal.push(op);
      }
      if (breakIt === "destroy") {
        // simulate a corridor that loses content
        writeFileSync(join(root, journal[0].dst), "OVERWRITTEN\n");
      }
      return journal.slice();
    },
    recoverApplied(plan) {
      if (calls) calls.recover = (calls.recover ?? 0) + 1;
      return plan.slice();
    },
    undo(applied) {
      if (calls) calls.undo = (calls.undo ?? 0) + 1;
      for (const op of [...applied].reverse()) {
        renameSync(join(root, op.dst), join(root, op.src));
      }
      if (breakIt === "bad_undo") writeFileSync(join(root, applied[0].src), "TAMPERED\n");
      return true;
    },
    anchorState() {
      return { anchorLog: [], observed: null };
    },
  };
}

function sandbox(files = ["a.txt", "b.txt"]) {
  const root = mkdtempSync(join(tmpdir(), "om0-"));
  files.forEach((f, i) => writeFileSync(join(root, f), `content-${i}\n`));
  return root;
}

function baseArgs(root, over = {}) {
  const anchorDir = mkdtempSync(join(tmpdir(), "om0-anchor-"));
  return {
    mission: { objective: "organize loose files", root },
    lease: { lease_id: "L1", scope_root: root, expires_at: NOW + 6e4, budget_acts: 1 },
    consent: { by: "Mumu", ref: "test-consent" },
    anchorDir,
    effect: fileAdapter(root),
    now: NOW,
    ...over,
  };
}

function genericMoveIntent(effect, scopeRoot) {
  const plan = effect.propose();
  const before = effect.manifest();
  const expectedAfter = before
    .map((entry) => {
      const move = plan.find((op) => op.op === "move" && op.src === entry.path);
      return move ? { ...entry, path: move.dst } : { ...entry };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    scope_root: scopeRoot,
    plan,
    plan_hash: sha256(JSON.stringify(plan)),
    before_manifest: before,
    before_hash: sha256(JSON.stringify(before)),
    expected_after_manifest: expectedAfter,
    expected_after_hash: sha256(JSON.stringify(expectedAfter)),
  };
}

test("OM0-01: happy path — consented, anchored, reversible, sealed", () => {
  const root = sandbox();
  const out = runMechanicalClosure(baseArgs(root));
  assert.equal(out.status, "SEALED");
  assert.equal(out.schema, OMEGA0_SCHEMA);
  assert.equal(out.verification.source_loss, 0);
  assert.equal(out.verification.content_hash_changes, 0);
  assert.equal(out.reversibility.proven, true);
  assert.equal(out.reversibility.undo_success_pct, 100);
  assert.equal(out.proof_card.status, "VERIFIED_WITHIN_DECLARED_SCOPE");
  assert.equal(out.proof_card.anchor_enforced, true);
  assert.equal(out.authority_delta, 0);
  assert.ok(out.seal_head);
  // the effect really happened
  assert.deepEqual(readdirSync(join(root, "bucket")).sort(), ["a.txt", "b.txt"]);
});

test("OM0-02: THE LAW — a missing anchor BLOCKS before any mutation", () => {
  const root = sandbox();
  const args = baseArgs(root);
  delete args.anchorDir;
  const out = runMechanicalClosure(args);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.reason, "anchor_required");
  assert.equal(out.authority_delta, 0);
  // nothing moved — the world is untouched
  assert.deepEqual(readdirSync(root).sort(), ["a.txt", "b.txt"]);
});

test("OM0-03: an anchor inside the leased scope is refused", () => {
  const root = sandbox();
  const out = runMechanicalClosure(baseArgs(root, { anchorDir: join(root, ".anchor") }));
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.reason, "anchor_inside_scope");
  assert.deepEqual(readdirSync(root).sort(), ["a.txt", "b.txt"]);
});

test("OM0-04: erased / truncated / forked anchor history each BLOCK by name", () => {
  const anchored = (records, observed) =>
    enforceAnchorPolicy({
      anchorDir: "/outside", scopeRoot: "/scope", anchorLog: records, observed,
    });
  const rec = (entries, head, prev = "anchor-genesis") => {
    const body = { schema: "bizra.dema.chain_anchor.v0.1", chain_id: "c", entries, head, prev_anchor: prev, at: null };
    return { ...body, anchor_hash: sha256(JSON.stringify(body) + prev) };
  };
  const r1 = rec(2, H(1));
  assert.equal(anchored([r1], { entries: 0, head: H(1) }).reason, "anchor_erased");
  assert.equal(anchored([r1], { entries: 1, head: H(2) }).reason, "anchor_truncated");
  assert.equal(anchored([r1], { entries: 2, head: H(2) }).reason, "anchor_forked");
  assert.equal(anchored([{ ...r1, entries: 99 }], { entries: 2, head: H(1) }).reason, "anchor_log_forged");
  assert.equal(anchored([r1], { entries: 2, head: H(1) }).ok, true);
});

test("OM0-05: consent bound to an exact plan hash — a changed plan is AUTHORITY_MISMATCH", () => {
  const root = sandbox();
  const args = baseArgs(root);
  args.consent = { by: "Mumu", ref: "r", plan_hash: sha256("a plan that is not this plan") };
  const out = runMechanicalClosure(args);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.reason, "authority_mismatch");
  assert.deepEqual(readdirSync(root).sort(), ["a.txt", "b.txt"], "no mutation on mismatch");

  // and the matching hash passes
  const root2 = sandbox();
  const args2 = baseArgs(root2);
  const planHash = sha256(JSON.stringify(args2.effect.propose()));
  args2.consent = { by: "Mumu", ref: "r", plan_hash: planHash };
  assert.equal(runMechanicalClosure(args2).status, "SEALED");
});

test("OM0-06: lease and consent preconditions each BLOCK", () => {
  const cases = [
    [{ lease: undefined }, "lease_required"],
    [{ lease: { lease_id: "L", scope_root: "/x", expires_at: NOW - 1 } }, "lease_expired"],
    [{ consent: undefined }, "consent_required"],
    [{ effect: {} }, "adapter_incomplete"],
  ];
  for (const [over, reason] of cases) {
    const root = sandbox();
    const args = baseArgs(root, over);
    if (over.lease && over.lease.scope_root === "/x") args.mission.root = "/x";
    const out = runMechanicalClosure(args);
    assert.equal(out.status, "BLOCKED", reason);
    assert.equal(out.reason, reason);
    assert.equal(out.authority_delta, 0);
  }
  // scope mismatch between mission root and lease
  const root = sandbox();
  const bad = baseArgs(root);
  bad.lease.scope_root = "/elsewhere";
  assert.equal(runMechanicalClosure(bad).reason, "lease_scope_violation");
});

test("OM0-07: an effect that destroys content is caught and rolled back", () => {
  const root = sandbox();
  const args = baseArgs(root, { effect: fileAdapter(root, { breakIt: "destroy" }) });
  const out = runMechanicalClosure(args);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.reason, "verification_failed");
  assert.ok(out.verification.source_loss > 0, "loss detected by the route, not reported by the adapter");
  assert.equal(out.rolled_back, true);
});

test("OM0-08: a dishonest undo is caught — restoration is hash-verified", () => {
  const root = sandbox();
  const args = baseArgs(root, { effect: fileAdapter(root, { breakIt: "bad_undo" }) });
  const out = runMechanicalClosure(args);
  assert.equal(out.status, "BLOCKED");
  assert.equal(out.reason, "restoration_failed");
  assert.notEqual(out.before_hash, out.restored_hash);
});

test("OM0-09: replay law — a fresh reader recomputes the seal and the world", () => {
  const root = sandbox();
  const sealed = runMechanicalClosure(baseArgs(root));
  assert.equal(sealed.status, "SEALED");

  // fresh adapter = fresh process reading the same world
  const replay = replaySeal(sealed, fileAdapter(root));
  assert.equal(replay.replayed, true);
  assert.equal(replay.seal_head_matches, true);
  assert.equal(replay.world_state_matches, true);

  // tamper with the world → replay refuses
  writeFileSync(join(root, "bucket", "a.txt"), "changed after seal\n");
  const replay2 = replaySeal(sealed, fileAdapter(root));
  assert.equal(replay2.replayed, false);
  assert.equal(replay2.world_state_matches, false);

  // tamper with the card → replay refuses
  const forged = { ...sealed, before_hash: "0".repeat(64) };
  assert.equal(replaySeal(forged, fileAdapter(root)).seal_head_matches, false);
  assert.equal(replaySeal({ status: "BLOCKED" }, fileAdapter(root)).replayed, false);
});

test("OM0-10: every terminal state emits a card with a named reason (law 5)", () => {
  const root = sandbox();
  const args = baseArgs(root);
  delete args.anchorDir;
  const blocked = runMechanicalClosure(args);
  assert.ok(BLOCK_REASONS.includes(blocked.reason));
  assert.equal(Object.isFrozen(blocked), true);
  assert.ok(blocked.what_this_does_not_prove.includes("Ω0-H"));

  const sealed = runMechanicalClosure(baseArgs(sandbox()));
  assert.equal(sealed.reason, null);
  assert.equal(Object.isFrozen(sealed), true);
  assert.ok(sealed.what_this_does_not_prove.includes("unattended"));
});

test("OM0-11: preparation binds the persisted intent without mutating the world", () => {
  const root = sandbox();
  const args = baseArgs(root);
  const intent = genericMoveIntent(args.effect, root);

  const prepared = omega0.prepareMechanicalClosure({ ...args, intent });

  assert.equal(prepared.status, "PREPARED");
  assert.equal(prepared.intent.plan_hash, intent.plan_hash);
  assert.equal(prepared.intent.before_hash, intent.before_hash);
  assert.equal(prepared.intent.expected_after_hash, intent.expected_after_hash);
  assert.equal(Object.isFrozen(prepared), true);
  assert.deepEqual(readdirSync(root).sort(), ["a.txt", "b.txt"], "prepare must be read-only");
});

test("OM0-12: applyPrepared applies exactly once from the measured pre-state", () => {
  const root = sandbox();
  const calls = {};
  const effect = fileAdapter(root, { calls });
  const args = baseArgs(root, { effect });
  const prepared = omega0.prepareMechanicalClosure({ ...args, intent: genericMoveIntent(effect, root) });

  const applied = omega0.applyPreparedMechanicalClosure({ prepared, effect });

  assert.equal(applied.status, "APPLIED");
  assert.equal(applied.recovery_mode, "APPLIED_FROM_PRE_STATE");
  assert.equal(calls.apply, 1);
  assert.equal(calls.recover ?? 0, 0);
  assert.deepEqual(readdirSync(join(root, "bucket")).sort(), ["a.txt", "b.txt"]);
});

test("OM0-13: finalizeApplied proves restoration and seals the split happy path", () => {
  const root = sandbox();
  const calls = {};
  const effect = fileAdapter(root, { calls });
  const args = baseArgs(root, { effect });
  const intent = genericMoveIntent(effect, root);
  const prepared = omega0.prepareMechanicalClosure({ ...args, intent });
  const applied = omega0.applyPreparedMechanicalClosure({ prepared, effect });

  const sealed = omega0.finalizeAppliedMechanicalClosure({ applied, effect });

  assert.equal(sealed.status, "SEALED");
  assert.equal(sealed.before_hash, intent.before_hash);
  assert.equal(sealed.after_hash, intent.expected_after_hash);
  assert.equal(sealed.reversibility.proven, true);
  assert.equal(sealed.proof_card.status, "VERIFIED_WITHIN_DECLARED_SCOPE");
  assert.equal(calls.undo, 1);
  assert.equal(calls.apply, 2, "one initial apply plus one reversibility reapply");
  assert.deepEqual(readdirSync(join(root, "bucket")).sort(), ["a.txt", "b.txt"]);
});

test("OM0-14: cold recovery prepares from expected post-state without an initial reapply", () => {
  const root = sandbox();
  const firstEffect = fileAdapter(root);
  const firstArgs = baseArgs(root, { effect: firstEffect });
  const persistedIntent = JSON.parse(JSON.stringify(genericMoveIntent(firstEffect, root)));

  // Model the first process dying immediately after the real mutation: only the
  // persisted intent and the post-state survive into the fresh process.
  firstEffect.apply(persistedIntent.plan);

  const calls = {};
  const freshEffect = fileAdapter(root, { calls });
  const prepared = omega0.prepareMechanicalClosure({
    ...firstArgs,
    effect: freshEffect,
    intent: persistedIntent,
  });
  const applied = omega0.applyPreparedMechanicalClosure({ prepared, effect: freshEffect });

  assert.equal(prepared.status, "PREPARED");
  assert.equal(applied.status, "APPLIED");
  assert.equal(applied.recovery_mode, "RECOVERED_FROM_EXPECTED_POST_STATE");
  assert.equal(calls.recover, 1, "fresh process reconstructs the undo handle");
  assert.equal(calls.apply ?? 0, 0, "fresh process must not perform a second initial apply");

  const sealed = omega0.finalizeAppliedMechanicalClosure({ applied, effect: freshEffect });
  assert.equal(sealed.status, "SEALED");
  assert.equal(calls.undo, 1);
  assert.equal(calls.apply, 1, "only the deliberate reapply after verified undo is permitted");
});

test("OM0-15: a third observed state blocks with RECOVERY_REQUIRED-compatible evidence", () => {
  const root = sandbox();
  const calls = {};
  const effect = fileAdapter(root, { calls });
  const args = baseArgs(root, { effect });
  const intent = genericMoveIntent(effect, root);
  writeFileSync(join(root, "unexpected.txt"), "unaccounted state\n");

  const blocked = omega0.prepareMechanicalClosure({ ...args, intent });

  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.reason, "restoration_failed");
  assert.equal(blocked.recovery_class, "RECOVERY_REQUIRED");
  assert.equal(blocked.reason_detail, "observed_state_is_neither_pre_nor_expected_post");
  assert.equal(calls.apply ?? 0, 0);
  assert.equal(calls.recover ?? 0, 0);
});

test("OM0-16: a scope-bearing intent cannot redirect authority to another estate", () => {
  const authorisedRoot = sandbox(["authorised.txt"]);
  const otherRoot = sandbox(["other.txt"]);
  const calls = {};
  const otherEffect = fileAdapter(otherRoot, { calls });
  const args = baseArgs(authorisedRoot, { effect: otherEffect });
  const intent = genericMoveIntent(otherEffect, otherRoot);

  const blocked = omega0.prepareMechanicalClosure({ ...args, intent });

  assert.equal(blocked.status, "BLOCKED");
  assert.equal(blocked.reason, "authority_mismatch");
  assert.equal(blocked.reason_detail, "prepared_intent_scope_mismatch");
  assert.deepEqual(readdirSync(authorisedRoot), ["authorised.txt"]);
  assert.deepEqual(readdirSync(otherRoot), ["other.txt"]);
  assert.equal(calls.apply ?? 0, 0);
});
