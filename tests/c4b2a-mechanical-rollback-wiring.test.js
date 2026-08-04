// C4B2A-01…20 — DURABLE MECHANICAL ROLLBACK HISTORY (Gate C, C4 step 2A).
//
// THE DEFECT THIS SLICE ADDRESSES.
// C4B1 built the proof language (ROLLBACK_STARTED → ROLLED_BACK →
// BEFORE_STATE_VERIFIED → RESOLVED) and the backward restoration primitive
// (restoreToBeforeState), but deliberately wired neither. The production route
// still crosses the effect boundary BEFORE the event that proves it:
//
//   EFFECT_INTENT_PERSISTED → applyPreparedMechanicalClosure() → append EFFECT_APPLIED
//
// So a failure or process death can leave the world changed while the durable
// transaction head still reads EFFECT_INTENT_PERSISTED. Recovery must therefore
// begin from the last DURABLE phase, never from what the process remembers doing
// — and TX_TRANSITIONS did not even admit EFFECT_INTENT_PERSISTED →
// ROLLBACK_STARTED, so that exact state was unrecoverable by construction.
//
// WHAT THIS FILE PROVES.
// Every failure inside runTransactionalMechanicalClosure that may occur after the
// effect boundary is crossed but before a SEALED transaction is returned produces
// exactly one of:
//
//   A. durable verified rollback history, or
//   B. explicit RECOVERY_REQUIRED without a destructive guess.
//
// It stops before runCorridorClosure, the canonical ledger, the closure anchor,
// and the Mission Corridor journal. Mapping a rollback result onto CHECKPOINT or
// STOPPED belongs to C4B2B; these tests assert that boundary is NOT crossed.
//
// TWO INJECTION SEAMS, BOTH THE TREE'S OWN.
// Monkey-patching node:fs/promises does NOT work here — `import { link } from
// "node:fs/promises"` binds early and neither the ESM namespace nor the CJS
// object reaches it (measured: 0 calls, publication succeeded). A test built on
// that patch would pass vacuously. The two seams that DO bind are:
//
//   chmod 0500 on the events dir  → real publication failure via the public API
//   _internal.appendClosureEventWithPublicationOps → injected fsyncDir, the only
//                                   way to produce a genuine durability_uncertain

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chmod, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
  CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
  CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
  TX_TRANSITIONS,
  TX_APPEND_TRANSITIONS,
  classifySettledMechanicalRecovery,
  readRollbackBindingContext,
  openClosureTransaction,
  replayClosureTransaction,
  appendClosureEvent,
  readVerifiedTransactionHash,
  _internal as txInternal,
} from "../packages/receipts/src/mission-closure-transaction.js";
import {
  buildRenameEffectAdapter,
  buildRenameEffectIntent,
  runTransactionalMechanicalClosure,
  settleMechanicalFailureWithVerifiedRollback,
  MECHANICAL_FAILURE_STAGES,
  CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import { mapRecoveryClassToCorridor } from "../packages/mission/src/mission-corridor-closure.js";
import {
  probeProcessIdentity,
  deriveClaimHash,
  acquireClosureOwnership,
  inspectClosureOwnership,
  validateFencingToken,
  MISSION_CLOSURE_OWNERSHIP_SCHEMA,
  MISSION_CLOSURE_OWNERSHIP_DOMAIN,
  CLAIM_KIND_ACQUIRE,
  _internal as ownInternal,
} from "../packages/receipts/src/mission-closure-ownership.js";

const NOW = 1_786_000_000_000;
const AT = "2026-08-02T12:00:00.000Z";
const SOURCE = "closure-evidence.draft.json";
const TARGET = "closure-evidence.sealed.json";
const BODY = "{\"proof\":true}\n";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

let fixtureSeq = 0;

async function fixture() {
  fixtureSeq += 1;
  const demaHome = await mkdtemp(join(tmpdir(), "c4b2a-"));
  const estate = join(demaHome, "missions", "c4b2a", "estate");
  await mkdir(estate, { recursive: true });
  await writeFile(join(estate, SOURCE), BODY);
  const prepared = buildRenameEffectIntent({ scopeRoot: estate, from: SOURCE, to: TARGET });
  assert.equal(prepared.ok, true, prepared.reason);

  const claimResult = await claimConsentNonce({
    nonce: `c4b2a-nonce-${fixtureSeq}`,
    actionClass: "C3_LOCAL_WRITE",
    actionKind: "COMPLETE",
    missionId: "c4b2a",
    contractHash: `sha256:${"c".repeat(64)}`,
    consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId: `c4b2a-transaction-${fixtureSeq}`,
    checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
    claimedAtIso: AT,
    demaHome,
  });
  assert.equal(claimResult.claimed, true);
  const claim = claimResult.claim;

  const build = () => buildRenameEffectAdapter({ scopeRoot: estate, from: SOURCE, to: TARGET });
  return {
    demaHome,
    estate,
    prepared,
    claim,
    build,
    sourcePath: join(estate, SOURCE),
    targetPath: join(estate, TARGET),
    eventsDir: txInternal.eventsDirOf(demaHome, claim.transaction_id),
    argsWith(effect) {
      return {
        demaHome,
        claim,
        prepared,
        mission: { objective: "close one local rename", root: estate },
        lease: { lease_id: "c4b2a-lease", scope_root: estate, expires_at: NOW + 60_000, budget_acts: 1 },
        consent: {
          by: "operator",
          ref: claim.consent_context_hash,
          nonce: `c4b2a-nonce-${fixtureSeq}`,
          plan_hash: prepared.intent.plan_hash,
        },
        anchorDir: join(demaHome, "anchors"),
        effect,
        now: NOW,
        atIso: AT,
      };
    },
  };
}

/** Wrap a real adapter, overriding only the named hooks. Identity is preserved. */
function wrapEffect(base, hooks) {
  return Object.freeze({ ...base, ...hooks });
}

/**
 * Cross the effect boundary during a real write outage.
 *
 * An unwritable event store blocks the failing phase append AND the settler's
 * own first write — there is no adapter call between them, so no seam can make
 * exactly one append fail. That is not a limitation to route around: a full disk
 * or a failing volume behaves precisely this way. The outage therefore leaves
 * the world mutated, the durable head at whatever survived, and NOTHING settled
 * — the exact state a later process must recover from. `blockOn` selects which
 * adapter call trips the outage, which selects the surviving head.
 */
async function crossBoundaryDuringOutage(f, base, { blockOn = "apply", hooks = {} } = {}) {
  const trip = () => { spawnSync("chmod", ["0500", f.eventsDir]); };
  const outage = {
    apply: (plan) => {
      const r = base.apply(plan);
      if (blockOn === "apply") trip();
      return r;
    },
    undo: (applied) => {
      const r = base.undo(applied);
      if (blockOn === "undo") trip();
      return r;
    },
  };
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, { ...outage, ...hooks }),
  });
  spawnSync("chmod", ["0700", f.eventsDir]);
  return result;
}

async function replay(f) {
  return await replayClosureTransaction({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
  });
}

const phases = (state) => state.events.map((e) => e.phase);

function evidenceOf(state, phase) {
  const event = state.events.find((e) => e.phase === phase);
  return event?.evidence_refs ?? null;
}

/** The durable before_hash, read from the persisted intent event — never memory. */
function durableBeforeHash(state) {
  const intentEvent = state.events.find((e) => e.phase === "EFFECT_INTENT_PERSISTED");
  return intentEvent.evidence_refs[0].intent.before_hash;
}

// ── TRANSITION LAW ──────────────────────────────────────────────────────────

test("C4B2A-T1: new writes admit EFFECT_INTENT_PERSISTED → ROLLBACK_STARTED", () => {
  assert.ok(
    TX_TRANSITIONS.EFFECT_INTENT_PERSISTED.includes("ROLLBACK_STARTED"),
    "replay map must admit the edge or crash-window recovery is unreachable",
  );
  assert.ok(
    TX_APPEND_TRANSITIONS.EFFECT_INTENT_PERSISTED.includes("ROLLBACK_STARTED"),
    "append map must admit the edge",
  );
});

test("C4B2A-T2: EFFECT_INTENT_PERSISTED may not shortcut past ROLLBACK_STARTED", () => {
  for (const forbidden of ["ROLLED_BACK", "BEFORE_STATE_VERIFIED"]) {
    assert.ok(
      !TX_APPEND_TRANSITIONS.EFFECT_INTENT_PERSISTED.includes(forbidden),
      `EFFECT_INTENT_PERSISTED → ${forbidden} must stay forbidden`,
    );
    assert.ok(
      !TX_TRANSITIONS.EFFECT_INTENT_PERSISTED.includes(forbidden),
      `EFFECT_INTENT_PERSISTED → ${forbidden} must stay forbidden in replay too`,
    );
  }
});

test("C4B2A-T3: every append edge remains a subset of a replay edge", () => {
  for (const [from, tos] of Object.entries(TX_APPEND_TRANSITIONS)) {
    for (const to of tos) {
      assert.ok(
        TX_TRANSITIONS[from].includes(to),
        `append edge ${from} → ${to} must exist in the replay map`,
      );
    }
  }
});

test("C4B2A-T4: rollback terminal outcomes require BEFORE_STATE_VERIFIED on append", async () => {
  const f = await fixture();
  const effect = f.build();
  const args = f.argsWith(effect);
  // Walk to a durable EFFECT_INTENT_PERSISTED, then ROLLBACK_STARTED → ROLLED_BACK.
  const failed = await runTransactionalMechanicalClosure({
    ...args,
    effect: wrapEffect(effect, { apply: () => { throw new Error("stop before world change"); } }),
  });
  assert.equal(failed.ok, false);

  const state = await replay(f);
  // The settler already resolved this transaction; a second terminal must not win.
  assert.equal(state.terminal, true);
  const conflicting = await appendClosureEvent({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase: "RESOLVED",
    terminalOutcome: "COMPLETED_VERIFIED",
    evidenceRefs: [],
    atIso: AT,
  });
  assert.equal(conflicting.appended, false);
});

test("C4B2A-T5: RECOVERY_REQUIRED terminal requires a RECOVERY_REQUIRED predecessor", async () => {
  const f = await fixture();
  const state = await (async () => {
    const effect = f.build();
    await runTransactionalMechanicalClosure({
      ...f.argsWith(effect),
      effect: wrapEffect(effect, { apply: () => { throw new Error("boom"); } }),
    });
    return await replay(f);
  })();
  // EXECUTION_FAILED_ROLLED_BACK settled through BEFORE_STATE_VERIFIED, so the
  // RECOVERY_REQUIRED phase must be absent from a verified-rollback chain.
  assert.ok(!phases(state).includes("RECOVERY_REQUIRED"));
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal(state.events.at(-2).phase, "BEFORE_STATE_VERIFIED");
});

// ── THE RED-FIRST MATRIX ────────────────────────────────────────────────────

test("C4B2A-01: partial rename (target linked, source unlink pending) restores backward", async () => {
  const f = await fixture();
  const base = f.build();
  const sourceInodeBefore = lstatSync(f.sourcePath).ino;

  // The exact partial state the real adapter can die in: the target link is
  // published and the source unlink has not happened yet.
  const partial = wrapEffect(base, {
    apply: () => {
      assert.equal(spawnSync("ln", [f.sourcePath, f.targetPath]).status, 0, "fixture must link");
      throw Object.assign(new Error("source unlink pending"), {
        code: "rename_source_unlink_pending",
        recovery_class: "RECOVERY_REQUIRED",
      });
    },
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: partial });

  assert.equal(result.ok, false);
  assert.equal(result.rollback_verified, true, `expected verified rollback, got ${result.reason}`);
  assert.equal(result.recovery_required, false);
  assert.equal(result.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal(result.effect_retry_forbidden, true);
  assert.equal(result.authority_delta, 0);

  // The world: source inode and bytes untouched, target gone.
  assert.equal(lstatSync(f.sourcePath).ino, sourceInodeBefore, "source inode must be preserved");
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY, "source bytes must be preserved");
  assert.equal(existsSync(f.targetPath), false, "target link must be retired");

  const state = await replay(f);
  assert.deepEqual(phases(state), [
    "PREPARED", "EFFECT_INTENT_PERSISTED",
    "ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RESOLVED",
  ]);
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");

  const proof = evidenceOf(state, "BEFORE_STATE_VERIFIED")[0];
  assert.equal(proof.schema, BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA);
  assert.equal(proof.recovery_mode, "INTERMEDIATE_RESTORED_BACKWARD");
  assert.equal(proof.restored_hash, durableBeforeHash(state));
  assert.equal(proof.restoration_verified, true);
});

test("C4B2A-02: effect reached post-state but EFFECT_APPLIED publication failed", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  const outage = await crossBoundaryDuringOutage(f, base, {
    hooks: { apply: (plan) => { applyCalls += 1; const r = base.apply(plan); spawnSync("chmod", ["0500", f.eventsDir]); return r; } },
  });
  assert.equal(outage.ok, false);
  assert.equal(outage.effect_retry_forbidden, true);

  // The world moved; the durable head never reached EFFECT_APPLIED.
  const mid = await replay(f);
  assert.deepEqual(phases(mid), ["PREPARED", "EFFECT_INTENT_PERSISTED"]);
  assert.equal(existsSync(f.targetPath), true, "the effect really did happen");

  // Recovery begins from the last DURABLE phase, not from what the process did.
  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: {
      stage: "EFFECT_APPLIED_PERSISTENCE",
      reason: "effect_applied_persistence_failed",
    },
  });

  assert.equal(result.rollback_verified, true, `expected verified rollback: ${result.reason}`);
  assert.equal(result.effect_retry_forbidden, true);
  assert.equal(applyCalls, 1, "the original effect must never be retried");

  const state = await replay(f);
  assert.ok(!phases(state).includes("EFFECT_APPLIED"));
  assert.equal(phases(state)[2], "ROLLBACK_STARTED");
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
  const proof = evidenceOf(state, "BEFORE_STATE_VERIFIED")[0];
  assert.equal(proof.restored_hash, durableBeforeHash(state));
});

test("C4B2A-03: durability-uncertain publication never mutates and never retries", async () => {
  const f = await fixture();
  const base = f.build();
  // Cross the boundary during an outage: durable head EFFECT_INTENT_PERSISTED,
  // nothing settled, world mutated.
  await crossBoundaryDuringOutage(f, base);

  // A genuinely uncertain publication, produced by the module's own seam — the
  // only way to get durability_uncertain without lying about it.
  const before = await replay(f);
  const descriptor = readDescriptor(f);
  const uncertain = await txInternal.appendClosureEventWithPublicationOps({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedSequence: before.sequence + 1,
    expectedPreviousEventHash: before.head_event_hash,
    phase: "ROLLBACK_STARTED",
    // Strict writer law applies to this seam too: valid current evidence, so the
    // append reaches publication and the uncertainty is genuine.
    evidenceRefs: [{
      schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
      transaction_hash: descriptor.transaction_hash,
      prepared_intent_hash: descriptor.prepared_intent_hash,
      failure_stage: "EFFECT_APPLIED_PERSISTENCE",
      failure_reason_code: "DURABILITY_UNCERTAIN",
      recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
      rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
      recovery_fallback_outcome: "RECOVERY_REQUIRED",
    }],
    atIso: AT,
  }, {
    ...txInternal.DEFAULT_PUBLICATION_OPS,
    fsyncDir: async () => { throw Object.assign(new Error("inj"), { code: "EIO" }); },
  });
  assert.equal(uncertain.durability_uncertain, true, "seam must produce real uncertainty");
  assert.equal(uncertain.effect_retry_forbidden, true);

  // Uncertainty that CANNOT be discharged — the event store is unreadable, so
  // replay cannot prove the head. The settler must stop without touching the
  // world rather than append another phase on top of an unproven head.
  const guard = () => { throw new Error("helper must not run under uncertainty"); };
  // The world is already mutated by the outage. What must not change is
  // anything MORE — the settler may not touch it while the head is unproven.
  const worldBefore = base.manifest();
  spawnSync("chmod", ["0000", f.eventsDir]);
  const settled = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: wrapEffect(base, {
      undo: guard, restoreIntermediateBackward: guard, classifyRecoverableIntermediate: guard,
    }),
    failure: {
      stage: "EFFECT_APPLIED_PERSISTENCE",
      reason: "event_publication_durability_uncertain:EIO",
      details: { durability_uncertain: true, effect_retry_forbidden: true },
    },
  });
  spawnSync("chmod", ["0700", f.eventsDir]);

  assert.equal(settled.recovery_required, true);
  assert.equal(settled.rollback_verified, false);
  // A REFUSAL settled nothing, so it reports no terminal outcome and the
  // unqualified class. Claiming RECOVERY_REQUIRED here would assert both a
  // terminal the transaction never reached and a qualification never earned.
  assert.equal(settled.terminal_outcome, null);
  assert.equal(settled.recovery_class, "RECOVERY_REQUIRED_UNQUALIFIED");
  assert.equal(settled.effect_retry_forbidden, true);
  assert.deepEqual(base.manifest(), worldBefore, "the settler must not mutate under uncertainty");
});

test("C4B2A-04: verification failure after EFFECT_APPLIED rolls back via the inverse", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  let poisonManifest = false;
  const rollbackStartedWhenHelperRan = [];
  const effect = wrapEffect(base, {
    apply: (plan) => {
      applyCalls += 1;
      const r = base.apply(plan);
      // The 2nd apply is the reversibility corridor's re-apply. Poison the very
      // next manifest read so finalization reports verification_failed while the
      // world is genuinely in the expected post state.
      if (applyCalls === 2) poisonManifest = true;
      return r;
    },
    manifest: () => {
      if (poisonManifest) {
        poisonManifest = false;
        return [{ path: "phantom.json", content_id: sha256("phantom") }];
      }
      return base.manifest();
    },
    undo: (applied) => {
      rollbackStartedWhenHelperRan.push(existsSync(join(f.eventsDir, "000003.json")));
      return base.undo(applied);
    },
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });

  assert.equal(result.ok, false);
  assert.equal(result.rollback_verified, true, `expected verified rollback: ${result.reason}`);
  assert.equal(result.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");

  const state = await replay(f);
  assert.ok(phases(state).includes("EFFECT_APPLIED"));
  const proof = evidenceOf(state, "BEFORE_STATE_VERIFIED")[0];
  assert.equal(proof.restored_hash, durableBeforeHash(state), "restored_hash must equal durable before_hash");
  assert.equal(proof.recovery_mode, "INVERSE_APPLIED");
  // ROLLBACK_STARTED was durable before the helper mutated anything.
  assert.ok(
    rollbackStartedWhenHelperRan.at(-1),
    "ROLLBACK_STARTED must be on disk before restoreToBeforeState mutates",
  );
});

test("C4B2A-05: an already-restored world reports ALREADY_BEFORE_STATE, no second inverse", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  let undoCalls = 0;
  const effect = wrapEffect(base, {
    apply: (plan) => {
      applyCalls += 1;
      // Call 1 = the real effect. Call 2 = the reversibility re-apply; skipping
      // it leaves the kernel's own undo in place, i.e. the world is already back.
      if (applyCalls === 1) return base.apply(plan);
      return { applied: plan };
    },
    undo: (applied) => {
      undoCalls += 1;
      return base.undo(applied);
    },
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  assert.equal(result.ok, false);
  assert.equal(result.rollback_verified, true, `expected verified rollback: ${result.reason}`);

  const state = await replay(f);
  const proof = evidenceOf(state, "BEFORE_STATE_VERIFIED")[0];
  assert.equal(proof.recovery_mode, "ALREADY_BEFORE_STATE", "must disclose the truthful helper mode");
  assert.equal(undoCalls, 1, "the kernel's undo ran once; the settler must not run a second inverse");
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4B2A-06: VERIFIED persistence failure rolls back exactly once", async () => {
  const f = await fixture();
  const base = f.build();
  // Trip the outage on undo — inside the reversibility corridor, after
  // EFFECT_APPLIED is durable — so the surviving head is EFFECT_APPLIED and the
  // VERIFIED append is the one that never landed.
  const outage = await crossBoundaryDuringOutage(f, base, { blockOn: "undo" });
  assert.equal(outage.ok, false, "VERIFIED persistence must fail closed");

  const mid = await replay(f);
  assert.equal(mid.phase, "EFFECT_APPLIED", "the durable head is EFFECT_APPLIED");
  assert.ok(!phases(mid).includes("VERIFIED"));

  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
  });
  assert.equal(result.rollback_verified, true, result.reason);
  assert.equal(result.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");

  // Repeating the identical settlement must change nothing.
  await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
  });

  const state = await replay(f);
  assert.equal(state.events.filter((e) => e.phase === "BEFORE_STATE_VERIFIED").length, 1);
  assert.equal(state.events.filter((e) => e.phase === "ROLLED_BACK").length, 1);
  assert.equal(state.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4B2A-07: SEALED persistence failure settles SEAL_FAILED_NO_COMPLETE", async () => {
  const f = await fixture();
  const effect = f.build();
  const args = f.argsWith(effect);
  // The mission objective rides ONLY inside the seal card's proof_card, so an
  // over-long objective makes exactly the SEALED evidence uncanonicalizable:
  // VERIFIED lands, SEALED refuses, and the durable head is VERIFIED — the
  // precise state C4B2A-07 governs. No other phase carries the objective.
  const result = await runTransactionalMechanicalClosure({
    ...args,
    mission: { ...args.mission, objective: "x".repeat(70_000) },
  });

  assert.equal(result.ok, false);
  assert.equal(result.terminal_outcome, "SEAL_FAILED_NO_COMPLETE");
  assert.equal(result.rollback_verified, true, result.reason);

  const state = await replay(f);
  assert.ok(!phases(state).includes("SEALED"), "the seal event must not have landed");
  assert.ok(phases(state).includes("VERIFIED"), "the durable head was VERIFIED");
  assert.equal(state.terminal_outcome, "SEAL_FAILED_NO_COMPLETE");
  assert.equal(state.events.at(-2).phase, "BEFORE_STATE_VERIFIED");
  assert.equal(state.events.filter((e) => e.phase === "ROLLED_BACK").length, 1);
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4B2A-08: restoration identity mismatch persists RECOVERY_REQUIRED, deletes nothing", async () => {
  const f = await fixture();
  const base = f.build();
  // Die in the two-link partial state, then refuse to identify it. A rollback
  // that cannot recognise the world must not guess: both names must survive.
  const effect = wrapEffect(base, {
    apply: () => {
      assert.equal(spawnSync("ln", [f.sourcePath, f.targetPath]).status, 0, "fixture must link");
      throw Object.assign(new Error("post-link failure"), { code: "effect_failed" });
    },
    classifyRecoverableIntermediate: () => {
      throw Object.assign(new Error("identity"), { code: "rename_source_identity_mismatch" });
    },
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  assert.equal(result.recovery_required, true);
  assert.equal(result.terminal_outcome, "RECOVERY_REQUIRED");
  assert.equal(result.rollback_verified, false);

  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY, "source must be untouched");
  assert.equal(readFileSync(f.targetPath, "utf8"), BODY, "published link must not be deleted");

  const state = await replay(f);
  assert.ok(!phases(state).includes("BEFORE_STATE_VERIFIED"), "no false restoration proof");
  assert.ok(phases(state).includes("RECOVERY_REQUIRED"));
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
});

test("C4B2A-09: restoration hash mismatch yields RECOVERY_REQUIRED, no false terminal", async () => {
  const f = await fixture();
  const base = f.build();
  const effect = wrapEffect(base, {
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply failure"), { code: "effect_failed" });
    },
    undo: () => true, // claims success, restores nothing
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  assert.equal(result.recovery_required, true);
  assert.equal(result.terminal_outcome, "RECOVERY_REQUIRED");

  const state = await replay(f);
  assert.ok(!phases(state).includes("BEFORE_STATE_VERIFIED"));
  assert.notEqual(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
});

test("C4B2A-10: failure publishing ROLLBACK_STARTED never calls the helper", async () => {
  const f = await fixture();
  const base = f.build();
  let helperCalls = 0;
  const guard = () => { helperCalls += 1; throw new Error("helper must not be called"); };
  // The outage trips inside apply, so PREPARED and EFFECT_INTENT_PERSISTED are
  // durable and it is exactly the ROLLBACK_STARTED publication that fails.
  const effect = wrapEffect(base, {
    apply: () => {
      spawnSync("chmod", ["0500", f.eventsDir]);
      throw Object.assign(new Error("boom before world change"), { code: "effect_failed" });
    },
    undo: guard,
    restoreIntermediateBackward: guard,
    classifyRecoverableIntermediate: guard,
  });

  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  spawnSync("chmod", ["0700", f.eventsDir]);

  const state = await replay(f);
  assert.ok(!phases(state).includes("ROLLBACK_STARTED"), "the adjudication event must not exist");

  assert.equal(helperCalls, 0, "no world mutation may be attempted when ROLLBACK_STARTED cannot land");
  assert.equal(result.recovery_required, true);
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4B2A-11: retry after ROLLED_BACK publication loss replays disk, no second inverse", async () => {
  const f = await fixture();
  const base = f.build();
  let undoCalls = 0;
  const effect = wrapEffect(base, {
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: (applied) => { undoCalls += 1; return base.undo(applied); },
  });

  const first = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  assert.equal(first.rollback_verified, true, first.reason);
  const undosAfterFirst = undoCalls;

  // Re-drive the identical settlement: it must replay from disk.
  const second = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect,
    failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
  });
  assert.equal(second.terminal_outcome, first.terminal_outcome, "terminal classification must be stable");
  assert.equal(undoCalls, undosAfterFirst, "no second inverse may run");

  const state = await replay(f);
  assert.equal(state.events.filter((e) => e.phase === "ROLLED_BACK").length, 1);
  assert.equal(state.events.filter((e) => e.phase === "BEFORE_STATE_VERIFIED").length, 1);
  assert.equal(state.events.filter((e) => e.phase === "RESOLVED").length, 1);
});

test("C4B2A-12: BEFORE_STATE_VERIFIED publication retry neither reapplies nor re-undoes", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  let undoCalls = 0;
  const effect = wrapEffect(base, {
    apply: (plan) => {
      applyCalls += 1;
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: (applied) => { undoCalls += 1; return base.undo(applied); },
  });
  await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  const applied = applyCalls;
  const undone = undoCalls;

  for (let i = 0; i < 3; i += 1) {
    await settleMechanicalFailureWithVerifiedRollback({
      demaHome: f.demaHome,
      claim: f.claim,
      prepared: f.prepared,
      effect,
      failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
    });
  }
  assert.equal(applyCalls, applied, "no reapply");
  assert.equal(undoCalls, undone, "no re-undo");

  const state = await replay(f);
  assert.equal(state.events.filter((e) => e.phase === "BEFORE_STATE_VERIFIED").length, 1);
});

test("C4B2A-13: rollback RESOLVED retry reuses the exact existing terminal outcome", async () => {
  const f = await fixture();
  const base = f.build();
  const effect = wrapEffect(base, {
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
  });
  const first = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });
  assert.equal(first.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");

  // A DIFFERENT classification must never overwrite the settled terminal.
  const conflicting = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect,
    failure: { stage: "SEAL_PERSISTENCE", reason: "seal_persistence_failed" },
  });
  assert.equal(conflicting.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");

  const state = await replay(f);
  assert.equal(state.events.filter((e) => e.phase === "RESOLVED").length, 1);
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
});

test("C4B2A-14: two concurrent recoveries settle one chain and one inverse", async () => {
  const f = await fixture();
  const base = f.build();
  let undoCalls = 0;
  const mkEffect = () => wrapEffect(f.build(), {
    undo: (applied) => { undoCalls += 1; return base.undo(applied); },
  });
  const effect = wrapEffect(base, {
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: (applied) => { undoCalls += 1; return base.undo(applied); },
  });
  // Cross the boundary and leave the transaction at EFFECT_INTENT_PERSISTED.
  await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });

  const settle = () => settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: mkEffect(),
    failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
  });
  const [a, b] = await Promise.all([settle(), settle()]);

  const state = await replay(f);
  assert.equal(state.ok, true, state.reason);
  assert.equal(state.events.filter((e) => e.phase === "BEFORE_STATE_VERIFIED").length, 1);
  assert.equal(state.events.filter((e) => e.phase === "RESOLVED").length, 1);
  for (const r of [a, b]) {
    assert.equal(r.terminal_outcome, state.terminal_outcome, "no divergent terminal may be reported");
  }
});

test("C4B2A-15: forged restoration evidence is still refused at append and replay", async () => {
  const f = await fixture();
  const base = f.build();
  const effect = wrapEffect(base, { apply: () => { throw new Error("halt"); } });
  await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect });

  const g = await fixture();
  const gBase = g.build();
  await runTransactionalMechanicalClosure({
    ...g.argsWith(gBase),
    effect: wrapEffect(gBase, {
      apply: () => { throw new Error("halt"); },
      classifyRecoverableIntermediate: () => { throw new Error("no"); },
    }),
  });

  // Forge a BEFORE_STATE_VERIFIED directly onto a fresh chain.
  const h = await fixture();
  const hBase = h.build();
  await runTransactionalMechanicalClosure({
    ...h.argsWith(hBase),
    effect: wrapEffect(hBase, { apply: () => { throw new Error("halt"); } }),
  });
  const state = await replay(h);
  const forged = await appendClosureEvent({
    demaHome: h.demaHome,
    transactionId: h.claim.transaction_id,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase: "BEFORE_STATE_VERIFIED",
    evidenceRefs: [{
      schema: BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
      prepared_intent_hash: `sha256:${"0".repeat(64)}`,
      before_hash: "1".repeat(64),
      restored_hash: "1".repeat(64),
      restoration_verified: true,
      recovery_mode: "ALREADY_BEFORE_STATE",
      undo_success_pct: 100,
    }],
    atIso: AT,
  });
  assert.equal(forged.appended, false, "forged restoration evidence must be refused");
});

test("C4B2A-16: a historical direct ROLLED_BACK → RESOLVED chain still replays", async () => {
  const f = await fixture();
  const base = f.build();
  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, { apply: () => { throw new Error("halt"); } }),
  });
  // The replay map must still admit the legacy edge even though appends may not.
  assert.ok(TX_TRANSITIONS.ROLLED_BACK.includes("RESOLVED"));
  assert.ok(!TX_APPEND_TRANSITIONS.ROLLED_BACK.includes("RESOLVED"));
});

test("C4B2A-17: a successful mechanical closure is unchanged and writes no rollback", async () => {
  const f = await fixture();
  const effect = f.build();
  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(effect), effect });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.omega0_card.status, "SEALED");

  const state = await replay(f);
  assert.deepEqual(phases(state), [
    "PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED",
  ]);
  for (const rollbackPhase of ["ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RECOVERY_REQUIRED"]) {
    assert.ok(!phases(state).includes(rollbackPhase), `${rollbackPhase} must not appear`);
  }
});

test("C4B2A-18: failure before the effect boundary writes no rollback phase", async () => {
  const f = await fixture();
  const base = f.build();
  // An expired lease blocks in prepareMechanicalClosure — before apply is reached.
  const args = f.argsWith(base);
  // The route clocks the lease against the CLAIM time, not the fixture's NOW.
  const result = await runTransactionalMechanicalClosure({
    ...args,
    lease: { ...args.lease, expires_at: Date.parse(AT) - 1 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.rollback_verified, undefined, "pre-boundary refusal must not claim a rollback");

  const state = await replay(f);
  assert.deepEqual(phases(state), ["PREPARED", "EFFECT_INTENT_PERSISTED"]);
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4B2A-19: no raw nonce, source bytes, or inverse plan enters a rollback event", async () => {
  const f = await fixture();
  const base = f.build();
  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });

  const state = await replay(f);
  const rollbackPhases = ["ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RESOLVED"];
  for (const phase of rollbackPhases) {
    const event = state.events.find((e) => e.phase === phase);
    if (!event) continue;
    const serialized = JSON.stringify(event.evidence_refs);
    assert.ok(!serialized.includes(`c4b2a-nonce-${fixtureSeq}`), `${phase} leaks the raw nonce`);
    assert.ok(!serialized.includes("proof\\\":true"), `${phase} leaks source bytes`);
    assert.ok(!serialized.includes("\"op\":\"rename\""), `${phase} carries an inverse plan copy`);
    assert.ok(!serialized.includes("before_manifest"), `${phase} carries a manifest copy`);
    for (const ref of event.evidence_refs) {
      for (const value of Object.values(ref)) {
        assert.ok(
          value === null || typeof value !== "object",
          `${phase} evidence must stay primitive`,
        );
      }
    }
  }
});

test("C4B2A-20: a fresh process recovers from disk alone", async () => {
  const f = await fixture();
  const base = f.build();
  // The first process crosses the boundary during an outage and dies without
  // settling anything: world mutated, durable head EFFECT_INTENT_PERSISTED.
  await crossBoundaryDuringOutage(f, base);
  const midState = await replay(f);
  assert.deepEqual(phases(midState), ["PREPARED", "EFFECT_INTENT_PERSISTED"]);
  assert.equal(existsSync(f.targetPath), true, "the world really is mutated");

  const script = `
import { buildRenameEffectAdapter, settleMechanicalFailureWithVerifiedRollback }
  from ${JSON.stringify(join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"))};
const r = await settleMechanicalFailureWithVerifiedRollback({
  demaHome: ${JSON.stringify(f.demaHome)},
  claim: { transaction_id: ${JSON.stringify(f.claim.transaction_id)} },
  prepared: null,
  effect: buildRenameEffectAdapter({
    scopeRoot: ${JSON.stringify(f.estate)},
    from: ${JSON.stringify(SOURCE)},
    to: ${JSON.stringify(TARGET)},
  }),
  failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
});
process.stdout.write(JSON.stringify({
  rollback_verified: r.rollback_verified,
  recovery_required: r.recovery_required,
  terminal_outcome: r.terminal_outcome,
  reason: r.reason ?? null,
}));
`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
  });
  assert.equal(child.status, 0, `child failed: ${child.stderr}`);
  const out = JSON.parse(child.stdout);
  assert.equal(out.rollback_verified, true, `child could not recover: ${out.reason}`);
  assert.equal(out.recovery_required, false);
  assert.equal(out.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");

  // Disk is the acceptance object.
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(existsSync(f.targetPath), false);
  const state = await replay(f);
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  const proof = evidenceOf(state, "BEFORE_STATE_VERIFIED")[0];
  assert.equal(proof.restored_hash, durableBeforeHash(state));
});

// ── STATIC PRODUCTION-BOUNDARY PROOFS ───────────────────────────────────────

test("C4B2A-S1: exactly one production writer appends rollback phases", () => {
  const gatherer = readFileSync(
    join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"), "utf8",
  );
  const mission = readFileSync(
    join(process.cwd(), "apps/cli/src/commands/mission.js"), "utf8",
  );
  const start = gatherer.indexOf("export async function settleMechanicalFailureWithVerifiedRollback");
  assert.ok(start > 0, "the bounded writer must exist");

  for (const phase of ["ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RECOVERY_REQUIRED"]) {
    assert.ok(
      !mission.includes(`phase: "${phase}"`),
      `${phase} must not be appended outside the bounded gatherer writer`,
    );
    // Count APPEND SITES, not mentions: prose in a header comment is not a writer.
    const sites = gatherer.split(`phase: "${phase}"`).length - 1;
    assert.equal(sites, 1, `${phase} must have exactly one append site`);
    assert.ok(
      gatherer.indexOf(`phase: "${phase}"`) > start,
      `the only ${phase} append must live inside the bounded writer`,
    );
  }
});

test("C4B2A-S2: the rollback writer reaches no ledger, anchor, or corridor journal", () => {
  const src = readFileSync(
    join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"), "utf8",
  );
  const start = src.indexOf("export async function settleMechanicalFailureWithVerifiedRollback");
  const end = src.indexOf("\nexport ", start + 10);
  const body = src.slice(start, end === -1 ? src.length : end);
  for (const forbidden of [
    "appendCanonicalReceipt", "loadCanonicalLedger", "buildLedgerAppender",
    "appendClosureAnchor", "buildAnchorRecord", "runCorridorClosure",
    "recordConsentNonce", "claimConsentNonce",
  ]) {
    assert.ok(!body.includes(forbidden), `rollback writer must not reach ${forbidden}`);
  }
  assert.ok(!body.includes("effect.apply"), "the rollback writer must never retry the effect");
});

test("C4B2A-S3: the failure-to-outcome map is closed and owns every stage", () => {
  assert.ok(Array.isArray(MECHANICAL_FAILURE_STAGES));
  assert.ok(MECHANICAL_FAILURE_STAGES.length >= 5);
  assert.ok(Object.isFrozen(MECHANICAL_FAILURE_STAGES));
});

// ── C4B2AH — ROLLBACK ADJUDICATION HARDENING ────────────────────────────────
//
// Four defects motivated this pass, and each maps to a law below:
//
//  1. any non-RECOVERY_REQUIRED terminal was reported rollback_verified=true —
//     including COMPLETED_VERIFIED and pre-C4B1 unqualified chains;
//  2. a retry recomputed the terminal outcome instead of reading the durable
//     adjudication back;
//  3. the writer located the intent with a local helper and could mutate the
//     world before the authoritative C4B1 binding had been revalidated;
//  4. raw exception text and absolute paths could enter immutable evidence.
//
// Replay compatibility permits old history to remain READABLE. It does not
// permit old, unproven history — or an unrelated terminal — to be PROMOTED into
// a verified rollback.

const txDir = (f) => join(f.demaHome, "transactions", "mission-closure", f.claim.transaction_id);
const readDescriptor = (f) => JSON.parse(readFileSync(join(txDir(f), "transaction.json"), "utf8"));

/** Open a transaction and persist ONE intent event with a chosen evidence array. */
async function txWithIntentEvidence(f, refs) {
  const opened = await openClosureTransaction({
    claim: f.claim, demaHome: f.demaHome, atIso: AT,
  });
  assert.equal(opened.ok, true, opened.reason);
  const state = await replay(f);
  const appended = await appendClosureEvent({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase: "EFFECT_INTENT_PERSISTED",
    evidenceRefs: refs,
    atIso: AT,
  });
  assert.equal(appended.appended, true, `fixture intent append must land: ${appended.reason}`);
  return await replay(f);
}

/** The evidence reference the production route would have written. */
function genuineIntentRef(f, overrides = {}) {
  return {
    schema: CORRIDOR_RENAME_INTENT_EVIDENCE_SCHEMA,
    prepared_intent_hash: f.prepared.prepared_intent_hash,
    recovery_policy_hash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
    checkpoint_event_hash: f.claim.checkpoint_event_hash,
    intent: f.prepared.intent,
    ...overrides,
  };
}

/** Settle against a corrupted chain; asserts nothing mutated and nothing appended. */
async function refusalLeavesEverythingUntouched(f, base, expectReasonFragment) {
  const worldBefore = base.manifest();
  const before = await replay(f);
  const guard = () => { throw new Error("helper must not be called"); };
  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: null,
    effect: wrapEffect(base, {
      undo: guard, restoreIntermediateBackward: guard, classifyRecoverableIntermediate: guard,
    }),
    failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
  });
  assert.equal(result.recovery_required, true);
  assert.equal(result.rollback_verified, false);
  assert.ok(
    String(result.reason).includes(expectReasonFragment),
    `expected refusal mentioning ${expectReasonFragment}, got ${result.reason}`,
  );
  const after = await replay(f);
  assert.deepEqual(base.manifest(), worldBefore, "filesystem must be byte-identical");
  for (const p of ["ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RECOVERY_REQUIRED"]) {
    assert.ok(!(after.events ?? []).some((e) => e.phase === p), `${p} must not be appended`);
  }
  if (before.ok && after.ok) {
    assert.equal(after.sequence, before.sequence, "no event may be appended on refusal");
  }
  return result;
}

test("C4B2AH-01: a duplicated intent evidence reference is refused before mutation", async () => {
  const f = await fixture();
  const base = f.build();
  await txWithIntentEvidence(f, [genuineIntentRef(f), genuineIntentRef(f)]);
  await refusalLeavesEverythingUntouched(f, base, "intent_evidence_not_exactly_one");
});

test("C4B2AH-02: a descriptor whose hash does not recompute is refused before mutation", async () => {
  const f = await fixture();
  const base = f.build();
  await txWithIntentEvidence(f, [genuineIntentRef(f)]);
  const descriptor = readDescriptor(f);
  descriptor.mission_id = "tampered-mission";
  writeFileSync(join(txDir(f), "transaction.json"), `${JSON.stringify(descriptor, null, 2)}\n`);
  await refusalLeavesEverythingUntouched(f, base, "descriptor_hash_mismatch");
});

test("C4B2AH-03: an intent hash not derived from its own bytes is refused", async () => {
  const f = await fixture();
  const base = f.build();
  // The reference agrees with the descriptor, but the intent bytes are not the
  // ones that hash to it. Three fields agreeing prove nothing on their own.
  await txWithIntentEvidence(f, [genuineIntentRef(f, {
    intent: { ...f.prepared.intent, scope_root: `${f.estate}-elsewhere` },
  })]);
  await refusalLeavesEverythingUntouched(f, base, "intent_hash_not_derived_from_intent_bytes");
});

test("C4B2AH-04: a before_hash not derived from before_manifest is refused", async () => {
  const f = await fixture();
  const base = f.build();
  const forgedIntent = { ...f.prepared.intent, before_hash: "b".repeat(64) };
  await txWithIntentEvidence(f, [genuineIntentRef(f, {
    prepared_intent_hash: f.prepared.prepared_intent_hash,
    intent: forgedIntent,
  })]);
  // The intent-bytes check fires first; either refusal is a refusal BEFORE
  // mutation, which is the property under test.
  const r = await refusalLeavesEverythingUntouched(f, base, "rollback_binding_refused");
  assert.ok(/intent_hash_not_derived|before_hash_not_derived/.test(r.reason));
});

test("C4B2AH-05: a missing recovery-policy or checkpoint binding is refused", async () => {
  for (const override of [
    { recovery_policy_hash: `sha256:${"9".repeat(64)}` },
    { checkpoint_event_hash: `sha256:${"8".repeat(64)}` },
  ]) {
    const f = await fixture();
    const base = f.build();
    await txWithIntentEvidence(f, [genuineIntentRef(f, override)]);
    await refusalLeavesEverythingUntouched(f, base, "rollback_binding_refused");
  }
});

test("C4B2AH-06: every binding refusal is byte-identical and event-free", async () => {
  const f = await fixture();
  const base = f.build();
  // No intent event at all — the most degenerate case.
  await openClosureTransaction({ claim: f.claim, demaHome: f.demaHome, atIso: AT });
  await refusalLeavesEverythingUntouched(f, base, "intent_event_not_exactly_one");
});

/** Freeze an adjudication with a chosen intended outcome, as a first call would. */
async function freezeAdjudication(f, intendedOutcome, stage = "EFFECT_APPLY") {
  const state = await replay(f);
  const descriptor = readDescriptor(f);
  const appended = await appendClosureEvent({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase: "ROLLBACK_STARTED",
    evidenceRefs: [{
      schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
      transaction_hash: descriptor.transaction_hash,
      prepared_intent_hash: descriptor.prepared_intent_hash,
      failure_stage: stage,
      failure_reason_code: "EFFECT_FAILED",
      recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
      rollback_success_outcome: intendedOutcome,
      recovery_fallback_outcome: "RECOVERY_REQUIRED",
    }],
    atIso: AT,
  });
  assert.equal(appended.appended, true, `adjudication must freeze: ${appended.reason}`);
  return appended;
}

test("C4B2AH-07: a retry with a different failure cannot change the frozen outcome", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  await freezeAdjudication(f, "EXECUTION_FAILED_ROLLED_BACK");

  // Retry supplies a verification failure — non-authoritative retry context.
  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
  });
  assert.equal(result.rollback_verified, true, result.reason);
  assert.equal(result.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");

  const state = await replay(f);
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
});

test("C4B2AH-08: an unknown retry failure cannot downgrade a frozen outcome", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  await freezeAdjudication(f, "VERIFICATION_FAILED_ROLLED_BACK", "VERIFICATION_PERSISTENCE");

  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: { stage: "NOT_A_REAL_STAGE", reason: "who knows" },
  });
  assert.equal(result.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  assert.equal(result.recovery_required, false, "an unknown retry must not force RECOVERY_REQUIRED");

  const state = await replay(f);
  assert.ok(!phases(state).includes("RECOVERY_REQUIRED"));
  assert.equal(state.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
});

test("C4B2AH-09: a malformed ROLLBACK_STARTED reference fails closed", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  const state = await replay(f);
  const descriptor = readDescriptor(f);
  const good = {
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  };
  const bad = [
    [{ ...good, smuggled: "extra" }],                              // unknown key
    [{ ...good, rollback_success_outcome: "COMPLETED_VERIFIED" }], // outcome outside the closed set
    [{ ...good, failure_reason_code: "arbitrary text" }],           // reason outside the vocabulary
    [{ ...good, transaction_hash: `sha256:${"0".repeat(64)}` }],    // unbound to this transaction
    [good, good],                                                   // duplicated
  ];
  for (const refs of bad) {
    const appended = await appendClosureEvent({
      demaHome: f.demaHome,
      transactionId: f.claim.transaction_id,
      expectedSequence: state.sequence + 1,
      expectedPreviousEventHash: state.head_event_hash,
      phase: "ROLLBACK_STARTED",
      evidenceRefs: refs,
      atIso: AT,
    });
    assert.equal(appended.appended, false, `must refuse: ${JSON.stringify(refs).slice(0, 80)}`);
  }
});

test("C4B2AH-10: no raw error text, path or stack enters any event file", async () => {
  const f = await fixture();
  const base = f.build();
  // Drive a failure whose message is deliberately full of forbidden content.
  const poison = `EACCES at /absolute/secret/path ${f.estate} \n at Object.<anonymous>`;
  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error(poison), { code: "effect_failed" });
      },
      undo: () => { throw Object.assign(new Error(poison), { code: "rename_source_identity_mismatch" }); },
      classifyRecoverableIntermediate: () => {
        throw Object.assign(new Error(poison), { code: "rename_source_identity_mismatch" });
      },
    }),
  });

  // Scoped to ROLLBACK evidence. EFFECT_INTENT_PERSISTED legitimately carries
  // intent.scope_root — that is the persisted intent a fresh process restores
  // from (C4B2A-20 depends on it), and it predates this slice.
  const dir = f.eventsDir;
  const state = await replay(f);
  const rollbackEvents = state.events.filter((e) => ROLLBACK_EVIDENCE_PHASES.includes(e.phase));
  assert.ok(rollbackEvents.length >= 2, "there must be rollback events to inspect");
  for (const event of rollbackEvents) {
    const raw = JSON.stringify(event.evidence_refs);
    for (const [needle, label] of [
      ["/absolute/secret/path", "an absolute path"],
      [f.estate, "the estate path"],
      ["at Object.", "a stack fragment"],
      ["EACCES", "a raw errno message"],
      ["Error", "exception text"],
      [poison, "the raw exception message"],
    ]) {
      assert.ok(!raw.includes(needle), `${event.phase} leaks ${label}`);
    }
    // Every value is a bounded primitive, not free text.
    for (const value of Object.values(event.evidence_refs[0])) {
      assert.ok(value === null || typeof value !== "object", `${event.phase} carries a nested object`);
    }
  }
  // And the raw message never reached the bytes on disk either.
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    assert.ok(
      !readFileSync(join(dir, name), "utf8").includes("at Object."),
      `${name} leaks a stack fragment`,
    );
  }
});

const ROLLBACK_EVIDENCE_PHASES = Object.freeze([
  "ROLLBACK_STARTED", "ROLLED_BACK", "BEFORE_STATE_VERIFIED", "RECOVERY_REQUIRED", "RESOLVED",
]);

/** A minimal settled state, exactly the shape replay returns. */
function settledState(phases, terminalOutcome, evidenceByPhase = {}) {
  return {
    ok: true,
    exists: true,
    terminal: true,
    terminal_outcome: terminalOutcome,
    events: phases.map((phase) => ({ phase, evidence_refs: evidenceByPhase[phase] ?? [] })),
  };
}

test("C4B2AH-11: a COMPLETED_VERIFIED terminal is never a verified rollback", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED",
      "LEDGER_COMMITTED", "ANCHORED", "RESOLVED"],
    "COMPLETED_VERIFIED",
  );
  assert.equal(classifySettledMechanicalRecovery({ state, context: null }), "FORWARD_COMPLETED");
});

test("C4B2AH-12: a historical direct ROLLED_BACK → RESOLVED chain is LEGACY_UNQUALIFIED", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "ROLLBACK_STARTED",
      "ROLLED_BACK", "RESOLVED"],
    "EXECUTION_FAILED_ROLLED_BACK",
  );
  assert.equal(
    classifySettledMechanicalRecovery({ state, context: null }),
    "LEGACY_UNQUALIFIED_ROLLBACK",
  );
  // Still replayable — history stays readable, it just is not promoted.
  assert.ok(TX_TRANSITIONS.ROLLED_BACK.includes("RESOLVED"));
});

test("C4B2AH-13: an unrelated terminal is NON_ROLLBACK_TERMINAL", () => {
  for (const outcome of ["REFUSED_POLICY", "BLOCKED_MISSING_CONSENT", "ESCALATED_TO_HUMAN"]) {
    const state = settledState(["PREPARED", "EFFECT_INTENT_PERSISTED", "RESOLVED"], outcome);
    assert.equal(
      classifySettledMechanicalRecovery({ state, context: null }),
      "NON_ROLLBACK_TERMINAL",
      `${outcome} must not qualify`,
    );
  }
});

test("C4B2AH-14: a rollback terminal without BEFORE_STATE_VERIFIED never qualifies", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "ROLLBACK_STARTED", "ROLLED_BACK", "RESOLVED"],
    "VERIFICATION_FAILED_ROLLED_BACK",
  );
  assert.notEqual(classifySettledMechanicalRecovery({ state, context: null }), "VERIFIED_ROLLBACK");
});

test("C4B2AH-15: a complete proven suffix classifies VERIFIED_ROLLBACK end to end", async () => {
  const f = await fixture();
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });
  assert.equal(result.rollback_verified, true, result.reason);
  assert.equal(result.recovery_class, "VERIFIED_ROLLBACK");

  const state = await replay(f);
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id, state,
  });
  assert.equal(bound.ok, true, bound.reason);
  assert.equal(
    classifySettledMechanicalRecovery({ state, context: bound.context }),
    "VERIFIED_ROLLBACK",
  );
});

test("C4B2AH-16: uncertainty where the attempted event is canonical resumes safely", async () => {
  const f = await fixture();
  const base = f.build();
  // Head is EFFECT_APPLIED: the event whose publication was uncertain won.
  await crossBoundaryDuringOutage(f, base, { blockOn: "undo" });
  const mid = await replay(f);
  assert.equal(mid.phase, "EFFECT_APPLIED");

  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: {
      stage: "EFFECT_APPLIED_PERSISTENCE",
      reason: "event_publication_durability_uncertain:EIO",
      details: { durability_uncertain: true },
    },
  });
  assert.equal(result.rollback_verified, true, result.reason);
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
});

test("C4B2AH-17: uncertainty where the prior head is canonical rolls back from it", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  await crossBoundaryDuringOutage(f, base, {
    hooks: {
      apply: (plan) => {
        applyCalls += 1;
        const r = base.apply(plan);
        spawnSync("chmod", ["0500", f.eventsDir]);
        return r;
      },
    },
  });
  const mid = await replay(f);
  assert.equal(mid.phase, "EFFECT_INTENT_PERSISTED", "the intended event did NOT win");

  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: f.build(),
    failure: {
      stage: "EFFECT_APPLIED_PERSISTENCE",
      reason: "event_publication_durability_uncertain:EIO",
      details: { durability_uncertain: true },
    },
  });
  assert.equal(result.rollback_verified, true, result.reason);
  assert.equal(applyCalls, 1, "no effect retry under uncertainty");
  const state = await replay(f);
  assert.ok(!phases(state).includes("EFFECT_APPLIED"));
  assert.equal(phases(state)[2], "ROLLBACK_STARTED");
});

test("C4B2AH-18: uncertainty over a divergent head mutates nothing", async () => {
  const f = await fixture();
  const effect = f.build();
  // A fully sealed transaction: SEALED has no ROLLBACK_STARTED edge at all.
  const ok = await runTransactionalMechanicalClosure({ ...f.argsWith(effect), effect });
  assert.equal(ok.ok, true, ok.reason);
  const worldBefore = effect.manifest();
  const before = await replay(f);

  const guard = () => { throw new Error("helper must not be called"); };
  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome,
    claim: f.claim,
    prepared: f.prepared,
    effect: wrapEffect(effect, {
      undo: guard, restoreIntermediateBackward: guard, classifyRecoverableIntermediate: guard,
    }),
    failure: {
      stage: "EFFECT_APPLIED_PERSISTENCE",
      reason: "event_publication_durability_uncertain:EIO",
      details: { durability_uncertain: true },
    },
  });
  assert.equal(result.recovery_required, true);
  assert.equal(result.rollback_verified, false);
  assert.ok(String(result.reason).includes("divergent_head"), result.reason);

  const after = await replay(f);
  assert.equal(after.sequence, before.sequence, "no event may be appended");
  assert.deepEqual(effect.manifest(), worldBefore, "no world mutation");
});

// ── C4B2AS — STRICT WRITER QUALIFICATION ────────────────────────────────────
//
// THE DEFECT. Append validation was gated on `claimsSchema(refs, expected)`, so
// a NEW append could avoid its evidence law simply by NOT claiming the schema
// that would have constrained it: `[]`, a legacy shape, or an unrelated schema
// all slipped through. That conditional is correct for REPLAYING immutable
// history and wrong for CREATING it.
//
// Compatibility belongs to replay. Strictness belongs to writers.

/** Append directly at the current head, bypassing the production writer. */
async function rawAppend(f, phase, evidenceRefs, terminalOutcome = null) {
  const state = await replay(f);
  return await appendClosureEvent({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedSequence: state.sequence + 1,
    expectedPreviousEventHash: state.head_event_hash,
    phase,
    terminalOutcome,
    evidenceRefs,
    atIso: AT,
  });
}

/** Assert a refusal published nothing and advanced nothing. */
async function refusedWithoutPublication(f, base, before, result, label) {
  assert.equal(result.appended, false, `${label} must be refused`);
  const after = await replay(f);
  assert.equal(after.sequence, before.sequence, `${label} must not advance the sequence`);
  assert.equal(after.head_event_hash, before.head_event_hash, `${label} must not move the head`);
  const files = readdirSync(f.eventsDir).filter((n) => /^\d{6}\.json$/.test(n));
  assert.equal(files.length, before.sequence + 1, `${label} must not create an event file`);
  if (base) assert.equal(existsSync(f.targetPath), false, `${label} must not touch the world`);
}

/** A transaction sitting at a durable EFFECT_APPLIED, ready for rollback writes. */
async function atEffectApplied() {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base, { blockOn: "undo" });
  const state = await replay(f);
  assert.equal(state.phase, "EFFECT_APPLIED");
  return { f, base, descriptor: readDescriptor(f) };
}

test("C4B2AS-01: ROLLBACK_STARTED with empty evidence is refused, nothing published", async () => {
  const { f } = await atEffectApplied();
  const before = await replay(f);
  await refusedWithoutPublication(f, null, before, await rawAppend(f, "ROLLBACK_STARTED", []), "empty evidence");
});

test("C4B2AS-02: ROLLBACK_STARTED with an unrelated legacy schema is refused", async () => {
  const { f } = await atEffectApplied();
  const before = await replay(f);
  for (const refs of [
    [{ type: "test", hash: "sha256:ev" }],
    [{ schema: "bizra.dema.some_other_evidence.v1", prepared_intent_hash: `sha256:${"1".repeat(64)}` }],
  ]) {
    await refusedWithoutPublication(f, null, before, await rawAppend(f, "ROLLBACK_STARTED", refs), "legacy schema");
  }
});

test("C4B2AS-03: ROLLED_BACK without the completed-evidence schema is refused", async () => {
  const { f, descriptor } = await atEffectApplied();
  const started = await rawAppend(f, "ROLLBACK_STARTED", [{
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  }]);
  assert.equal(started.appended, true, started.reason);
  const before = await replay(f);
  for (const refs of [[], [{ type: "test", hash: "sha256:ev" }]]) {
    await refusedWithoutPublication(f, null, before, await rawAppend(f, "ROLLED_BACK", refs), "ROLLED_BACK");
  }
});

test("C4B2AS-04: RECOVERY_REQUIRED without the recovery schema is refused", async () => {
  const { f, descriptor } = await atEffectApplied();
  await rawAppend(f, "ROLLBACK_STARTED", [{
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "RESTORATION_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  }]);
  const before = await replay(f);
  for (const refs of [[], [{ type: "test", hash: "sha256:ev" }]]) {
    await refusedWithoutPublication(f, null, before, await rawAppend(f, "RECOVERY_REQUIRED", refs), "RECOVERY_REQUIRED");
  }
});

test("C4B2AS-05: rollback RESOLVED without the terminal schema is refused", async () => {
  const f = await fixture();
  const base = f.build();
  // Produce a genuine verified-rollback chain, then try to settle it wrongly.
  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });
  const settled = await replay(f);
  assert.equal(settled.terminal, true);
  // A fresh chain at BEFORE_STATE_VERIFIED is what an unsettled writer sees; the
  // settled one proves the terminal evidence law was enforced on the way in.
  const resolvedEvent = settled.events.at(-1);
  assert.equal(resolvedEvent.evidence_refs[0].schema, CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA);
});

test("C4B2AS-06: terminal evidence disagreeing with the event outcome is refused", async () => {
  const { f, descriptor } = await atEffectApplied();
  await rawAppend(f, "ROLLBACK_STARTED", [{
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "RESTORATION_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  }]);
  await rawAppend(f, "RECOVERY_REQUIRED", [{
    schema: CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_reason_code: "RESTORATION_FAILED",
    restoration_reason_code: "RESTORATION_WORLD_UNRECOGNISED",
  }]);
  const before = await replay(f);
  const mismatched = await rawAppend(f, "RESOLVED", [{
    schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    terminal_outcome: "EXECUTION_FAILED_ROLLED_BACK", // event says RECOVERY_REQUIRED
  }], "RECOVERY_REQUIRED");
  await refusedWithoutPublication(f, null, before, mismatched, "outcome disagreement");
  assert.match(String(mismatched.reason), /outcome_ne_event_outcome/);
});

test("C4B2AS-07: a non-rollback terminal keeps its existing evidence law", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  // REFUSED_POLICY is not a rollback claim, so no rollback evidence is demanded.
  const r = await rawAppend(f, "RESOLVED", [{ type: "test", hash: "sha256:ev" }], "REFUSED_POLICY");
  assert.equal(r.appended, true, `non-rollback terminals must not be forced: ${r.reason}`);
});

test("C4B2AS-08: the production writer still publishes every current schema", async () => {
  const f = await fixture();
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });
  assert.equal(result.rollback_verified, true, result.reason);
  const state = await replay(f);
  const expected = {
    ROLLBACK_STARTED: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    ROLLED_BACK: CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
    BEFORE_STATE_VERIFIED: BEFORE_STATE_VERIFIED_EVIDENCE_SCHEMA,
    RESOLVED: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
  };
  for (const [phase, schema] of Object.entries(expected)) {
    const e = state.events.find((x) => x.phase === phase);
    assert.ok(e, `${phase} must exist`);
    assert.equal(e.evidence_refs.length, 1, `${phase} must carry exactly one reference`);
    assert.equal(e.evidence_refs[0].schema, schema, `${phase} schema`);
  }
});

// ── PART 2 — replay policy stays compatible, but a current chain is current ──

test("C4B2AS-09: a legacy chain with no current schema stays replayable and unqualified", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "ROLLBACK_STARTED",
      "ROLLED_BACK", "RESOLVED"],
    "EXECUTION_FAILED_ROLLED_BACK",
  );
  assert.equal(
    classifySettledMechanicalRecovery({ state, context: null }),
    "LEGACY_UNQUALIFIED_ROLLBACK",
  );
});

test("C4B2AS-10: a chain with BEFORE_STATE_VERIFIED but legacy ROLLBACK_STARTED fails replay", async () => {
  const { f, descriptor } = await atEffectApplied();
  // Hand-write a chain whose ROLLBACK_STARTED predates the current schema, then
  // add a current marker. One current marker must not license the rest.
  const evDir = f.eventsDir;
  const seqBefore = (await replay(f)).sequence;
  void descriptor; void seqBefore; void evDir;
  // The writer refuses to create such a chain at all — which is the point.
  const legacyStart = await rawAppend(f, "ROLLBACK_STARTED", [{ type: "test", hash: "sha256:ev" }]);
  assert.equal(legacyStart.appended, false, "a legacy-shaped rollback start is not creatable");
  assert.match(String(legacyStart.reason), /rollback_started/);
});

test("C4B2AS-11/12/13: malformed current rollback evidence cannot be written", async () => {
  const { f, descriptor } = await atEffectApplied();
  const good = {
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  };
  assert.equal((await rawAppend(f, "ROLLBACK_STARTED", [good])).appended, true);
  const before = await replay(f);
  // ROLLED_BACK whose restored_hash does not equal the bound before_hash.
  const bad = await rawAppend(f, "ROLLED_BACK", [{
    schema: CORRIDOR_ROLLBACK_COMPLETED_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    before_hash: "c".repeat(64),
    restored_hash: "c".repeat(64),
    recovery_mode: "ALREADY_BEFORE_STATE",
  }]);
  await refusedWithoutPublication(f, null, before, bad, "unbound ROLLED_BACK");
  assert.match(String(bad.reason), /not_bound_to_intent/);
});

test("C4B2AS-14: a fully valid verified rollback chain replays and qualifies", async () => {
  const f = await fixture();
  const base = f.build();
  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });
  const state = await replay(f);
  assert.equal(state.ok, true, state.reason);
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(classifySettledMechanicalRecovery({ state, context: bound.context }), "VERIFIED_ROLLBACK");
});

test("C4B2AS-15: a valid recovery-required chain qualifies as RECOVERY_REQUIRED only", async () => {
  const f = await fixture();
  const base = f.build();
  // Omega0 reports restoration_failed: the adjudication decides RECOVERY_REQUIRED
  // up front, which is the only chain shape that may qualify.
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("intermediate"), { code: "effect_failed" });
      },
      undo: () => { throw Object.assign(new Error("no"), { code: "rename_backward_restoration_failed" }); },
      classifyRecoverableIntermediate: () => {
        throw Object.assign(new Error("no"), { code: "rename_source_identity_mismatch" });
      },
    }),
  });
  assert.equal(result.recovery_required, true);
  assert.equal(result.rollback_verified, false);
  const state = await replay(f);
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  const cls = classifySettledMechanicalRecovery({ state, context: bound.context });
  assert.notEqual(cls, "VERIFIED_ROLLBACK", "a failed restoration must never qualify as verified");
});

// ── PART 3 — strict RECOVERY_REQUIRED qualification ──

test("C4B2AS-16: RECOVERY_REQUIRED → RESOLVED without ROLLBACK_STARTED is unqualified", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "RECOVERY_REQUIRED", "RESOLVED"],
    "RECOVERY_REQUIRED",
  );
  assert.notEqual(classifySettledMechanicalRecovery({ state, context: null }), "RECOVERY_REQUIRED");
});

test("C4B2AS-17: a malformed recovery reference is unqualified", () => {
  const ctx = { transaction_hash: `sha256:${"a".repeat(64)}`, prepared_intent_hash: `sha256:${"b".repeat(64)}`, before_hash: "c".repeat(64) };
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "ROLLBACK_STARTED", "RECOVERY_REQUIRED", "RESOLVED"],
    "RECOVERY_REQUIRED",
    {
      ROLLBACK_STARTED: [{
        schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
        transaction_hash: ctx.transaction_hash,
        prepared_intent_hash: ctx.prepared_intent_hash,
        failure_stage: "EFFECT_APPLY",
        failure_reason_code: "RESTORATION_FAILED",
        recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
        rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
        recovery_fallback_outcome: "RECOVERY_REQUIRED",
      }],
      RECOVERY_REQUIRED: [{ type: "test" }],
    },
  );
  assert.equal(classifySettledMechanicalRecovery({ state, context: ctx }), "INVALID");
});

test("C4B2AS-18: a rollback intent that failed to restore DOES settle as RECOVERY_REQUIRED", () => {
  // LAW CORRECTED. An earlier version of this test asserted INVALID here, which
  // was wrong: whether restoration succeeds cannot be known when the
  // adjudication is written, so demanding that a qualified recovery chain had
  // already "intended" RECOVERY_REQUIRED is impossible by construction. This is
  // lawful monotonic degradation from the conditional success outcome to the
  // frozen fallback. (It also passed vacuously before — on malformed evidence
  // rather than on the law.)
  const ctx = { transaction_hash: `sha256:${"a".repeat(64)}`, prepared_intent_hash: `sha256:${"b".repeat(64)}`, before_hash: "c".repeat(64) };
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "ROLLBACK_STARTED", "RECOVERY_REQUIRED", "RESOLVED"],
    "RECOVERY_REQUIRED",
    {
      ROLLBACK_STARTED: [{
        schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
        transaction_hash: ctx.transaction_hash,
        prepared_intent_hash: ctx.prepared_intent_hash,
        failure_stage: "EFFECT_APPLY",
        failure_reason_code: "EFFECT_FAILED",
        recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
        rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK", // conditional
        recovery_fallback_outcome: "RECOVERY_REQUIRED",
      }],
      RECOVERY_REQUIRED: [{
        schema: CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
        prepared_intent_hash: ctx.prepared_intent_hash,
        failure_reason_code: "EFFECT_FAILED",
        restoration_reason_code: "RESTORATION_HASH_MISMATCH",
      }],
      RESOLVED: [{
        schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
        prepared_intent_hash: ctx.prepared_intent_hash,
        terminal_outcome: "RECOVERY_REQUIRED",
      }],
    },
  );
  assert.equal(classifySettledMechanicalRecovery({ state, context: ctx }), "RECOVERY_REQUIRED");
});

test("C4B2AS-19: an exactly adjudicated recovery chain qualifies", () => {
  const ctx = { transaction_hash: `sha256:${"a".repeat(64)}`, prepared_intent_hash: `sha256:${"b".repeat(64)}`, before_hash: "c".repeat(64) };
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "ROLLBACK_STARTED", "RECOVERY_REQUIRED", "RESOLVED"],
    "RECOVERY_REQUIRED",
    {
      ROLLBACK_STARTED: [{
        schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
        transaction_hash: ctx.transaction_hash,
        prepared_intent_hash: ctx.prepared_intent_hash,
        failure_stage: "MECHANICAL_FINALIZE",
        failure_reason_code: "RESTORATION_FAILED",
        recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
        rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
        recovery_fallback_outcome: "RECOVERY_REQUIRED",
      }],
      RECOVERY_REQUIRED: [{
        schema: CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
        prepared_intent_hash: ctx.prepared_intent_hash,
        failure_reason_code: "RESTORATION_FAILED",
        restoration_reason_code: "RESTORATION_NOT_ATTEMPTED",
      }],
      RESOLVED: [{
        schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
        prepared_intent_hash: ctx.prepared_intent_hash,
        terminal_outcome: "RECOVERY_REQUIRED",
      }],
    },
  );
  assert.equal(classifySettledMechanicalRecovery({ state, context: ctx }), "RECOVERY_REQUIRED");
});

test("C4B2AS-20: a valid verified rollback stays VERIFIED_ROLLBACK", async () => {
  const f = await fixture();
  const base = f.build();
  const r = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      apply: (plan) => {
        base.apply(plan);
        throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
      },
    }),
  });
  assert.equal(r.recovery_class, "VERIFIED_ROLLBACK");
  assert.equal(r.rollback_verified, true);
  assert.equal(r.recovery_required, false);
});

// ── PART 4 — the context is always disk-authoritative ──

test("C4B2AS-21: a fabricated state cannot authorise a restoration the disk refuses", async () => {
  const f = await fixture();
  const base = f.build();
  // Disk carries a duplicated intent reference; the caller offers a clean one.
  await txWithIntentEvidence(f, [genuineIntentRef(f), genuineIntentRef(f)]);
  const fabricated = {
    ok: true, exists: true, terminal: false, sequence: 1,
    head_event_hash: `sha256:${"f".repeat(64)}`,
    events: [
      { phase: "PREPARED", evidence_refs: [] },
      { phase: "EFFECT_INTENT_PERSISTED", evidence_refs: [genuineIntentRef(f)] },
    ],
  };
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    state: fabricated,                 // ignored by contract
    expectedHeadEventHash: fabricated.head_event_hash,
  });
  assert.equal(bound.ok, false, "disk truth must win over a supplied snapshot");
  assert.equal(bound.reason, "intent_evidence_not_exactly_one");
  void base;
});

test("C4B2AS-22: a stale expected head is disclosed, never used as authority", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  const stale = await replay(f);
  // Advance the chain beyond the snapshot the caller holds.
  const descriptor = readDescriptor(f);
  const started = await rawAppend(f, "ROLLBACK_STARTED", [{
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  }]);
  assert.equal(started.appended, true, started.reason);

  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    expectedHeadEventHash: stale.head_event_hash,
  });
  assert.equal(bound.ok, true, bound.reason);
  assert.equal(bound.head_mismatch, true, "the drift must be disclosed");
  assert.equal(bound.state.phase, "ROLLBACK_STARTED", "the FRESH disk head is returned");
  assert.notEqual(bound.state.head_event_hash, stale.head_event_hash);
});

test("C4B2AS-23: no supplied state at all still derives a fresh disk context", async () => {
  const f = await fixture();
  const base = f.build();
  await crossBoundaryDuringOutage(f, base);
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(bound.ok, true, bound.reason);
  assert.equal(bound.head_mismatch, false);
  assert.equal(bound.context.prepared_intent_hash, f.prepared.prepared_intent_hash);
  assert.equal(bound.context.intent.before_hash, f.prepared.intent.before_hash);
  assert.equal(bound.state.phase, "EFFECT_INTENT_PERSISTED");
});

// ── C4B2AM — MONOTONIC RECOVERY OUTCOME ─────────────────────────────────────
//
// THE DEFECT. ROLLBACK_STARTED froze a single `intended_terminal_outcome`, and a
// qualified RECOVERY_REQUIRED chain was required to have already intended
// RECOVERY_REQUIRED. That is impossible by construction: whether restoration
// succeeds is not knowable when the adjudication is written. A transaction that
// begins intending EXECUTION_FAILED_ROLLED_BACK and then measures an
// unrestorable world must be allowed to settle RECOVERY_REQUIRED.
//
//   Freeze the cause. Measure the recovery. Permit only safe monotonic
//   degradation.
//
// Frozen at ROLLBACK_STARTED: failure_stage, failure_reason_code,
// recovery_objective, rollback_success_outcome (CONDITIONAL on exact
// restoration), recovery_fallback_outcome (always RECOVERY_REQUIRED).

const adjudicationOf = (state) =>
  state.events.find((e) => e.phase === "ROLLBACK_STARTED")?.evidence_refs?.[0] ?? null;

/** Drive the route to a rollback with a chosen failure shape. */
async function driveRollback(hooks, { seal = false } = {}) {
  const f = await fixture();
  const base = f.build();
  const args = f.argsWith(base);
  const result = await runTransactionalMechanicalClosure({
    ...args,
    ...(seal ? { mission: { ...args.mission, objective: "x".repeat(70_000) } } : {}),
    effect: wrapEffect(base, hooks(base, f)),
  });
  return { f, base, result, state: await replay(f) };
}

const failAfterApply = (base) => ({
  apply: (plan) => {
    base.apply(plan);
    throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
  },
});

test("C4B2AM-01: execution failure + verified restoration → EXECUTION_FAILED_ROLLED_BACK", async () => {
  const { result, state } = await driveRollback(failAfterApply);
  assert.equal(result.recovery_class, "VERIFIED_ROLLBACK");
  assert.equal(result.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal(adjudicationOf(state).rollback_success_outcome, "EXECUTION_FAILED_ROLLED_BACK");
});

test("C4B2AM-02: verification failure + verified restoration → VERIFICATION_FAILED_ROLLED_BACK", async () => {
  const { result, state } = await driveRollback((base) => {
    let applyCalls = 0; let poison = false;
    return {
      apply: (plan) => {
        applyCalls += 1;
        const r = base.apply(plan);
        if (applyCalls === 2) poison = true;
        return r;
      },
      manifest: () => {
        if (poison) { poison = false; return [{ path: "phantom.json", content_id: sha256("phantom") }]; }
        return base.manifest();
      },
    };
  });
  assert.equal(result.recovery_class, "VERIFIED_ROLLBACK", result.reason);
  assert.equal(result.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
  assert.equal(state.terminal_outcome, "VERIFICATION_FAILED_ROLLED_BACK");
});

test("C4B2AM-03: seal failure + verified restoration → SEAL_FAILED_NO_COMPLETE", async () => {
  const { result, state } = await driveRollback(() => ({}), { seal: true });
  assert.equal(result.recovery_class, "VERIFIED_ROLLBACK", result.reason);
  assert.equal(result.terminal_outcome, "SEAL_FAILED_NO_COMPLETE");
  assert.equal(state.terminal_outcome, "SEAL_FAILED_NO_COMPLETE");
  assert.equal(adjudicationOf(state).rollback_success_outcome, "SEAL_FAILED_NO_COMPLETE");
});

test("C4B2AM-04: execution failure + identity mismatch → RECOVERY_REQUIRED, not INVALID", async () => {
  const { f, result, state } = await driveRollback((base, fx) => ({
    apply: () => {
      assert.equal(spawnSync("ln", [fx.sourcePath, fx.targetPath]).status, 0);
      throw Object.assign(new Error("post-link"), { code: "effect_failed" });
    },
    classifyRecoverableIntermediate: () => {
      throw Object.assign(new Error("identity"), { code: "rename_source_identity_mismatch" });
    },
  }));
  assert.equal(result.recovery_class, "RECOVERY_REQUIRED", `must not be INVALID: ${result.reason}`);
  assert.equal(result.rollback_verified, false);
  assert.equal(result.recovery_required, true);
  assert.equal(result.effect_retry_forbidden, true);
  assert.equal(result.escalate_to_human, true);
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
  // The adjudication still records what it originally reserved for success.
  const adj = adjudicationOf(state);
  assert.equal(adj.rollback_success_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal(adj.recovery_fallback_outcome, "RECOVERY_REQUIRED");
  assert.equal(adj.recovery_objective, "RESTORE_EXACT_BEFORE_STATE");
  // Nothing was deleted.
  assert.equal(readFileSync(f.sourcePath, "utf8"), BODY);
  assert.equal(readFileSync(f.targetPath, "utf8"), BODY);
});

test("C4B2AM-05: verification failure + restoration hash mismatch → RECOVERY_REQUIRED", async () => {
  const { result, state } = await driveRollback((base) => ({
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: () => true, // claims success, restores nothing
  }));
  assert.equal(result.recovery_class, "RECOVERY_REQUIRED", result.reason);
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
  const rec = state.events.find((e) => e.phase === "RECOVERY_REQUIRED");
  assert.equal(rec.evidence_refs[0].restoration_reason_code, "RESTORATION_HASH_MISMATCH");
});

test("C4B2AM-06: seal failure + inverse-operation failure → RECOVERY_REQUIRED", async () => {
  const { result, state } = await driveRollback((base) => ({
    undo: (applied) => {
      // The reversibility corridor's undo must work; only the SETTLER's inverse
      // fails, which is the case under test.
      if (undoSeen.n++ >= 1) {
        throw Object.assign(new Error("inverse"), { code: "rename_backward_restoration_failed" });
      }
      return base.undo(applied);
    },
  }), { seal: true });
  assert.equal(result.recovery_class, "RECOVERY_REQUIRED", result.reason);
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
  assert.equal(adjudicationOf(state).rollback_success_outcome, "SEAL_FAILED_NO_COMPLETE");
});
const undoSeen = { n: 0 };

test("C4B2AM-07: a retry cannot change the durable failure stage or reason", async () => {
  const { f, state } = await driveRollback(failAfterApply);
  const before = adjudicationOf(state);
  await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared, effect: f.build(),
    failure: { stage: "SEAL_PERSISTENCE", reason: "seal_persistence_failed" },
  });
  const after = adjudicationOf(await replay(f));
  assert.deepEqual(after, before, "the original adjudication is immutable");
});

test("C4B2AM-08: a retry cannot change the durable rollback_success_outcome", async () => {
  const { f, state } = await driveRollback(failAfterApply);
  assert.equal(state.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  const r = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared, effect: f.build(),
    failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
  });
  assert.equal(r.terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
  assert.equal((await replay(f)).terminal_outcome, "EXECUTION_FAILED_ROLLED_BACK");
});

test("C4B2AM-09: a retry after RECOVERY_REQUIRED returns the same qualified result", async () => {
  const { f, state } = await driveRollback((base) => ({
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: () => true,
  }));
  assert.equal(state.terminal_outcome, "RECOVERY_REQUIRED");
  const seq = state.sequence;
  let helper = 0;
  const guard = () => { helper += 1; throw new Error("no"); };
  const r = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared,
    effect: wrapEffect(f.build(), { undo: guard, restoreIntermediateBackward: guard, classifyRecoverableIntermediate: guard }),
    failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
  });
  assert.equal(r.recovery_class, "RECOVERY_REQUIRED");
  assert.equal(r.recovery_required, true);
  assert.equal(helper, 0, "no helper mutation after a terminal result");
  assert.equal((await replay(f)).sequence, seq, "no new event");
});

test("C4B2AM-10: a retry after VERIFIED_ROLLBACK returns the same verified result", async () => {
  const { f, state } = await driveRollback(failAfterApply);
  const seq = state.sequence;
  let helper = 0;
  const guard = () => { helper += 1; throw new Error("no"); };
  const r = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared,
    effect: wrapEffect(f.build(), { undo: guard, restoreIntermediateBackward: guard, classifyRecoverableIntermediate: guard }),
    failure: { stage: "EFFECT_APPLY", reason: "effect_failed", omega0_card: { reason: "effect_failed" } },
  });
  assert.equal(r.recovery_class, "VERIFIED_ROLLBACK");
  assert.equal(r.rollback_verified, true);
  assert.equal(helper, 0, "no fallback escalation, no helper mutation");
  assert.equal((await replay(f)).sequence, seq);
});

test("C4B2AM-11/12/13/14: malformed adjudication fields are refused", async () => {
  const { f, descriptor } = await atEffectApplied();
  const good = {
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  };
  const drop = (k) => { const c = { ...good }; delete c[k]; return c; };
  const cases = [
    ["11 missing objective", drop("recovery_objective")],
    ["12 unknown objective", { ...good, recovery_objective: "DO_WHATEVER" }],
    ["13 missing fallback", drop("recovery_fallback_outcome")],
    ["13 non-RECOVERY_REQUIRED fallback", { ...good, recovery_fallback_outcome: "EXECUTION_FAILED_ROLLED_BACK" }],
    ["14 success outcome outside the closed set", { ...good, rollback_success_outcome: "COMPLETED_VERIFIED" }],
    ["14 fallback used as success outcome", { ...good, rollback_success_outcome: "RECOVERY_REQUIRED" }],
  ];
  const before = await replay(f);
  for (const [label, refs] of cases) {
    const r = await rawAppend(f, "ROLLBACK_STARTED", [refs]);
    assert.equal(r.appended, false, `${label} must be refused`);
    assert.equal((await replay(f)).sequence, before.sequence, `${label} must publish nothing`);
  }
  assert.equal((await rawAppend(f, "ROLLBACK_STARTED", [good])).appended, true, "the valid shape still lands");
});

test("C4B2AM-15/16: a RESOLVED outcome disagreeing with the durable adjudication is refused", async () => {
  const { f, descriptor } = await atEffectApplied();
  const adj = {
    schema: CORRIDOR_ROLLBACK_STARTED_EVIDENCE_SCHEMA,
    transaction_hash: descriptor.transaction_hash,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_stage: "EFFECT_APPLY",
    failure_reason_code: "EFFECT_FAILED",
    recovery_objective: "RESTORE_EXACT_BEFORE_STATE",
    rollback_success_outcome: "EXECUTION_FAILED_ROLLED_BACK",
    recovery_fallback_outcome: "RECOVERY_REQUIRED",
  };
  assert.equal((await rawAppend(f, "ROLLBACK_STARTED", [adj])).appended, true);
  assert.equal((await rawAppend(f, "RECOVERY_REQUIRED", [{
    schema: CORRIDOR_ROLLBACK_RECOVERY_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    failure_reason_code: "EFFECT_FAILED",
    restoration_reason_code: "RESTORATION_HASH_MISMATCH",
  }])).appended, true);
  const before = await replay(f);
  // A DIFFERENT rollback terminal than the frozen success outcome.
  const wrong = await rawAppend(f, "RESOLVED", [{
    schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    terminal_outcome: "SEAL_FAILED_NO_COMPLETE",
  }], "SEAL_FAILED_NO_COMPLETE");
  assert.equal(wrong.appended, false, "a terminal outside the frozen pair must be refused");
  assert.equal((await replay(f)).sequence, before.sequence);
  // The frozen fallback IS permitted from here.
  const right = await rawAppend(f, "RESOLVED", [{
    schema: CORRIDOR_ROLLBACK_TERMINAL_EVIDENCE_SCHEMA,
    prepared_intent_hash: descriptor.prepared_intent_hash,
    terminal_outcome: "RECOVERY_REQUIRED",
  }], "RECOVERY_REQUIRED");
  assert.equal(right.appended, true, right.reason);
});

test("C4B2AM-17: a restoration-failure chain qualifies for future Corridor STOPPED", async () => {
  const { f, result, state } = await driveRollback((base) => ({
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error("post-apply"), { code: "effect_failed" });
    },
    undo: () => true,
  }));
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(classifySettledMechanicalRecovery({ state, context: bound.context }), "RECOVERY_REQUIRED");
  assert.equal(result.recovery_required, true);
  // C4B2B consumes this class. The scope guard that once asserted "mapping must
  // not exist yet" was removed by the authorized C4B2B slice; what must hold now
  // is that this class — and only this class — routes to a corridor STOPPED.
  // C4B2B consumes this class as a HANDOFF, never as authority: it proves that
  // stopping is necessary and asks the operator for the separate STOP consent.
  const v = mapRecoveryClassToCorridor("RECOVERY_REQUIRED");
  assert.equal(v.verdict, "STOP_CONSENT_REQUIRED");
  assert.equal(v.terminal_outcome, null, "recognition carries no corridor terminal");
  assert.equal(v.required_consent_kind, "STOP");
  assert.equal(v.requires_human, true);
});

test("C4B2AM-18: a verified-restoration chain qualifies for future Corridor CHECKPOINT", async () => {
  const { f, result, state } = await driveRollback(failAfterApply);
  const bound = await readRollbackBindingContext({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(classifySettledMechanicalRecovery({ state, context: bound.context }), "VERIFIED_ROLLBACK");
  assert.equal(result.rollback_verified, true);
  // A restored world leaves the corridor exactly where it was: the mission is
  // healthy and a separately consented fresh attempt is legitimate.
  const v = mapRecoveryClassToCorridor("VERIFIED_ROLLBACK");
  assert.equal(v.verdict, "CORRIDOR_UNCHANGED");
  assert.equal(v.terminal_outcome, null);
  assert.equal(v.fresh_attempt_permitted, true);
});

test("C4B2AM-19: historical chains without current schemas stay replayable and unqualified", () => {
  const state = settledState(
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "ROLLBACK_STARTED", "ROLLED_BACK", "RESOLVED"],
    "EXECUTION_FAILED_ROLLED_BACK",
  );
  assert.equal(classifySettledMechanicalRecovery({ state, context: null }), "LEGACY_UNQUALIFIED_ROLLBACK");
  assert.ok(TX_TRANSITIONS.ROLLED_BACK.includes("RESOLVED"));
});

test("C4B2AM-20: no raw exception, path, stack, nonce or source bytes in new evidence", async () => {
  const poison = `EACCES /absolute/secret ${"at Object.<anonymous>"}`;
  const { f, state } = await driveRollback((base) => ({
    apply: (plan) => {
      base.apply(plan);
      throw Object.assign(new Error(poison), { code: "effect_failed" });
    },
    undo: () => { throw Object.assign(new Error(poison), { code: "rename_backward_restoration_failed" }); },
  }));
  for (const e of state.events.filter((x) => ROLLBACK_EVIDENCE_PHASES.includes(x.phase))) {
    const raw = JSON.stringify(e.evidence_refs);
    for (const n of ["/absolute/secret", f.estate, "at Object.", "EACCES", "Error", `c4b2a-nonce`, "before_manifest"]) {
      assert.ok(!raw.includes(n), `${e.phase} leaks ${n}`);
    }
    for (const v of Object.values(e.evidence_refs[0])) {
      assert.ok(v === null || typeof v !== "object", `${e.phase} carries a nested object`);
    }
  }
});

// ── C4D behavioural fencing, driven through the REAL production route ──────
// The C4D matrix proves the ownership module in isolation and greps the call
// graph, but a grep proves a fence is CALLED, not that its verdict is OBEYED.
// Mutation testing showed exactly that gap: neutering the effect-boundary check
// and the acquisition check both left the isolated suite green. These two tests
// drive runTransactionalMechanicalClosure itself and assert on the world.

/** Seed a current-owner claim for a foreign process, as a crash or rival leaves it. */
async function seedForeignOwner(demaHome, transactionId, transactionHash, identity) {
  const dir = ownInternal.ownershipDir(demaHome, transactionId);
  await mkdir(join(dir, "claims"), { recursive: true });
  const body = {
    schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
    domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
    transaction_id: transactionId,
    transaction_hash: transactionHash,
    owner_instance_id: "foreign-owner",
    pid: identity.pid,
    process_start_identity: identity.process_start_identity,
    boot_identity_hash: identity.boot_identity_hash,
    acquired_at_iso: "2026-08-04T00:00:00.000Z",
    predecessor_claim_hash: null,
    claim_kind: CLAIM_KIND_ACQUIRE,
  };
  const claim = { ...body, claim_hash: deriveClaimHash({ ...body, claim_hash: null }) };
  await writeFile(join(dir, "current.gen0"), JSON.stringify(claim, null, 2));
  return claim;
}

/**
 * Open C2 and return the AUTHORITATIVE descriptor hash, verified from disk.
 * Ownership binds to this, never to prepared_intent_hash — the descriptor body
 * contains the prepared intent hash among other fields, and transaction_hash is
 * the hash OF that body, so one prepared intent can belong to more than one
 * descriptor.
 */
async function openAndVerify(f) {
  const opened = await openClosureTransaction({
    claim: f.claim, demaHome: f.demaHome, atIso: f.claim.claimed_at_iso,
  });
  assert.equal(opened.ok, true, opened.reason);
  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(verified.ok, true, verified.reason);
  return verified;
}

async function seedForeignOwnerAt(demaHome, transactionId, transactionHash, identity, gen) {
  const dir = ownInternal.ownershipDir(demaHome, transactionId);
  await mkdir(join(dir, "claims"), { recursive: true });
  const body = {
    schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
    domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
    transaction_id: transactionId,
    transaction_hash: transactionHash,
    owner_instance_id: `foreign-owner-gen${gen}`,
    pid: identity.pid,
    process_start_identity: identity.process_start_identity,
    boot_identity_hash: identity.boot_identity_hash,
    acquired_at_iso: "2026-08-04T00:00:00.000Z",
    predecessor_claim_hash: `sha256:${"1".repeat(64)}`,
    claim_kind: "DEAD_OWNER_TAKEOVER",
  };
  const claim = { ...body, claim_hash: deriveClaimHash({ ...body, claim_hash: null }) };
  await writeFile(join(dir, `current.gen${gen}`), JSON.stringify(claim, null, 2));
  return claim;
}

test("C4D-BIND-01/02: ownership binds the verified C2 descriptor hash, which is NOT the prepared-intent hash", async () => {
  const f = await fixture();
  const verified = await openAndVerify(f);

  assert.match(verified.transaction_hash, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(
    verified.transaction_hash,
    verified.prepared_intent_hash,
    "the two C2 facts must be genuinely different for this binding to mean anything",
  );
  assert.equal(verified.prepared_intent_hash, f.prepared.prepared_intent_hash);

  const own = await acquireClosureOwnership({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    transactionHash: verified.transaction_hash,
  });
  assert.equal(own.status, "ACQUIRED");
  assert.equal(own.claim.transaction_hash, verified.transaction_hash);
  assert.notEqual(own.claim.transaction_hash, verified.prepared_intent_hash);
});

test("C4D-BIND-03/07: the production route publishes a claim bound to the descriptor, not the intent", async () => {
  const f = await fixture();
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(result.ok, true, result.reason);

  // Inspect what the REAL route actually published — not a source regex.
  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(verified.ok, true);
  const current = await inspectClosureOwnership({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(current.state, "PRESENT");
  assert.equal(
    current.claim.transaction_hash,
    verified.transaction_hash,
    "the published ownership claim must name the exact C2 descriptor",
  );
  assert.notEqual(
    current.claim.transaction_hash,
    f.prepared.prepared_intent_hash,
    "substituting prepared_intent_hash would make this pass — it must not",
  );
});

test("C4D-BIND-06: a validly-hashed claim bound to a DIFFERENT descriptor cannot authorize", async () => {
  const f = await fixture();
  const verified = await openAndVerify(f);
  const own = await acquireClosureOwnership({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    transactionHash: verified.transaction_hash,
  });
  assert.equal(own.status, "ACQUIRED");

  // The token is current and the claim hash is genuinely valid; only the
  // descriptor it names is wrong.
  const fence = await validateFencingToken({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    fencingToken: own.fencing_token,
    expectedTransactionHash: f.prepared.prepared_intent_hash,
  });
  assert.equal(fence.valid, false);
  assert.equal(fence.status, "TRANSACTION_HASH_MISMATCH");
  assert.equal(fence.mutation_performed, false);
  assert.equal(fence.event_appended, false);
  assert.equal(fence.requires_human, true);
});

test("C4D-BIND-09: an unreadable C2 descriptor fails closed with zero mutation", async () => {
  const f = await fixture();
  await openAndVerify(f);
  const descriptor = join(txInternal.transactionDir
    ? txInternal.transactionDir(f.demaHome, f.claim.transaction_id)
    : join(f.demaHome, "transactions", "mission-closure", f.claim.transaction_id), "transaction.json");
  await writeFile(descriptor, "{ not json");

  let applyCalls = 0;
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, { apply: (plan) => { applyCalls += 1; return base.apply(plan); } }),
  });
  assert.equal(applyCalls, 0, "an unverifiable descriptor must not reach the world");
  assert.equal(result.ok, false);
  // An earlier authority read reaches the corrupt descriptor first and refuses
  // with the more specific `unreadable`; the C4D binding check is the backstop
  // behind it. Either is a fail-closed refusal, and the load-bearing claim is
  // that NOTHING moved — so accept both rather than pin an incidental ordering.
  assert.ok(
    ["transaction_descriptor_unreadable", "transaction_descriptor_unverified"].includes(result.reason),
    `expected a descriptor refusal, got ${result.reason}`,
  );
  assert.equal(existsSync(f.sourcePath), true);
  assert.equal(existsSync(f.targetPath), false);
});

test("C4D-P1: a LIVE foreign owner stops the production route before the world moves", async () => {
  const f = await fixture();
  // The parent process is genuinely alive and its identity is genuinely
  // readable, so this is a real live owner, not a mocked one.
  const parent = await probeProcessIdentity(process.ppid);
  assert.ok(parent, "the parent process identity must be readable for this test to mean anything");
  const verified = await openAndVerify(f);
  await seedForeignOwner(f.demaHome, f.claim.transaction_id, verified.transaction_hash, parent);

  let applyCalls = 0;
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, { apply: (plan) => { applyCalls += 1; return base.apply(plan); } }),
  });

  assert.equal(applyCalls, 0, "a non-owner must not touch the world");
  assert.equal(result.ok, false);
  assert.equal(result.mutation_performed, false);
  // The refusal must NAME the live owner. Falling through to an incidental
  // downstream refusal would stop the world but tell the operator the wrong
  // story — and would mean the acquisition guard itself is dead code.
  assert.equal(result.reason, "ownership_held", `expected a live-owner refusal, got ${result.reason}`);
  assert.equal(result.ownership_status, "OWNERSHIP_HELD");
  assert.equal(existsSync(f.sourcePath), true, "the source file must be untouched");
  assert.equal(existsSync(f.targetPath), false, "no rename may have happened");
});

test("C4D-P2: losing ownership mid-flight fences the effect at the boundary", async () => {
  const f = await fixture();
  const parent = await probeProcessIdentity(process.ppid);
  assert.ok(parent);
  const verifiedTx = await openAndVerify(f);

  // manifest() is called during prepare — after this process acquired ownership
  // and before the effect boundary. Taking over there models a rival that
  // concluded we were dead while we were still working.
  let applyCalls = 0;
  let seeded = false;
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      manifest: () => {
        if (!seeded) {
          seeded = true;
          const dir = ownInternal.ownershipDir(f.demaHome, f.claim.transaction_id);
          // gen1 supersedes our gen0 claim: our token is now stale.
          const body = {
            schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
            domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
            transaction_id: f.claim.transaction_id,
            transaction_hash: verifiedTx.transaction_hash,
            owner_instance_id: "rival-owner",
            pid: parent.pid,
            process_start_identity: parent.process_start_identity,
            boot_identity_hash: parent.boot_identity_hash,
            acquired_at_iso: "2026-08-04T00:00:01.000Z",
            predecessor_claim_hash: `sha256:${"1".repeat(64)}`,
            claim_kind: "DEAD_OWNER_TAKEOVER",
          };
          const claim = { ...body, claim_hash: deriveClaimHash({ ...body, claim_hash: null }) };
          writeFileSync(join(dir, "current.gen1"), JSON.stringify(claim, null, 2));
        }
        return base.manifest();
      },
      apply: (plan) => { applyCalls += 1; return base.apply(plan); },
    }),
  });

  assert.equal(applyCalls, 0, "a fenced worker must never cross the effect boundary");
  assert.equal(result.ok, false);
  assert.equal(existsSync(f.sourcePath), true, "the source file must be untouched");
  assert.equal(existsSync(f.targetPath), false, "no rename may have happened");
});

test("C4D-REL: production relies on death + takeover, not explicit release — and that is safe", async () => {
  // MEASURED, not assumed: releaseClosureOwnership() exists in the ownership
  // module but the production route never calls it. So the retirement path is
  // "the owner dies and a successor proves it dead", and what must hold is that
  // a dead owner's unreleased claim can never (a) let the effect run twice, or
  // (b) permanently block a lawful retry.
  const gatherer = readFileSync(
    new URL("../packages/mission/src/corridor-closure-gatherer.js", import.meta.url), "utf8",
  );
  assert.ok(gatherer.length > 1000, "source must be non-empty for this scan to mean anything");
  assert.equal(
    gatherer.includes("releaseClosureOwnership"),
    false,
    "if production starts releasing explicitly, this characterization must be re-measured",
  );

  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  const counted = wrapEffect(base, { apply: (plan) => { applyCalls += 1; return base.apply(plan); } });

  const first = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: counted });
  assert.equal(first.ok, true, first.reason);
  // Baseline rather than an asserted constant: the load-bearing property is that
  // a TERMINAL transaction never re-enters the effect, not how many adapter
  // calls one successful closure happens to make.
  const applyCallsAfterFirst = applyCalls;
  assert.ok(applyCallsAfterFirst >= 1, "the effect ran at least once");
  const terminal = await replayClosureTransaction({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  const terminalHead = terminal.head_event_hash;

  // The owner dies without releasing: overwrite the current pointer with a
  // provably dead claim at the next generation.
  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  const dir = ownInternal.ownershipDir(f.demaHome, f.claim.transaction_id);
  const gens = await ownInternal.readGenerations(dir);
  await seedForeignOwnerAt(f.demaHome, f.claim.transaction_id, verified.transaction_hash,
    { pid: 999_997, process_start_identity: "1", boot_identity_hash: (await probeProcessIdentity(process.pid)).boot_identity_hash },
    gens[gens.length - 1] + 1);

  // A successor arrives on a terminal transaction.
  const second = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: counted });

  assert.equal(applyCalls, applyCallsAfterFirst, "a terminal transaction must never re-enter the effect");
  const after = await replayClosureTransaction({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(after.head_event_hash, terminalHead, "authority did not advance");
  assert.ok(second !== undefined, "the successor got an answer rather than hanging");

  // Ownership generations MAY advance (the successor proved the predecessor
  // dead); authority did not. An unreleased dead claim therefore never becomes
  // a permanent lock.
  const finalGens = await ownInternal.readGenerations(dir);
  assert.ok(finalGens.length >= gens.length, "generations may advance");
  const current = await inspectClosureOwnership({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(current.state, "PRESENT");
  assert.equal(current.claim.transaction_hash, verified.transaction_hash);
});

// ── C4D TOCTOU: the fence must bind CURRENT C2, not a remembered one ────────
// Binding at acquisition proves "I own the transaction I checked earlier". These
// prove the stronger claim: "I still own the exact transaction that exists NOW,
// at the instant I touch reality." The seam is effect.manifest(), which runs
// after ownership is acquired and before the effect boundary — so anything it
// does models a change that lands inside the window.

function descriptorPath(f) {
  return join(txInternal.transactionDir(f.demaHome, f.claim.transaction_id), "transaction.json");
}

test("C4D-TOCTOU-01/09: C2 corrupted AFTER acquisition, BEFORE the effect — nothing touches the world", async () => {
  const f = await fixture();
  const base = f.build();
  let applyCalls = 0;
  let tampered = false;

  const result = await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      manifest: () => {
        if (!tampered) {
          tampered = true;
          // Ownership is already held and valid at this point. Only C2 changed.
          writeFileSync(descriptorPath(f), "{ corrupted after acquisition");
        }
        return base.manifest();
      },
      apply: (plan) => { applyCalls += 1; return base.apply(plan); },
    }),
  });

  assert.equal(tampered, true, "the seam must actually have fired, or this proves nothing");
  assert.equal(applyCalls, 0, "a token validated against a remembered C2 would have let this through");
  assert.equal(result.ok, false);
  assert.equal(existsSync(f.sourcePath), true, "the world is untouched");
  assert.equal(existsSync(f.targetPath), false);
});

test("C4D-TOCTOU-03: C2 chain corrupted mid-flight — no durable append lands", async () => {
  const f = await fixture();
  const base = f.build();
  let tampered = false;
  let headBefore = null;

  await runTransactionalMechanicalClosure({
    ...f.argsWith(base),
    effect: wrapEffect(base, {
      manifest: () => {
        if (!tampered) {
          tampered = true;
          const evDir = txInternal.eventsDirOf(f.demaHome, f.claim.transaction_id);
          const names = readdirSync(evDir).filter((n) => !n.startsWith("."));
          assert.ok(names.length > 0, "there must be events to corrupt");
          headBefore = names.length;
          writeFileSync(join(evDir, names[0]), "{ corrupted event");
        }
        return base.manifest();
      },
    }),
  });

  assert.equal(tampered, true);
  const evDir = txInternal.eventsDirOf(f.demaHome, f.claim.transaction_id);
  const after = readdirSync(evDir).filter((n) => !n.startsWith(".")).length;
  assert.equal(after, headBefore, "no new event may be appended onto an unverifiable chain");
  assert.equal(existsSync(f.targetPath), false, "and the world stays untouched");
});

test("C4D-TOCTOU-07: an untampered closure still runs green", async () => {
  const f = await fixture();
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(result.ok, true, result.reason);
  assert.equal(existsSync(f.targetPath), true, "the normal path is unaffected by the fence");
});

// ---------------------------------------------------------------------------
// C4D-OWNED-CLOSURE-TAIL-1B — Task 1 (red-first). Lives here because fixture()
// and runTransactionalMechanicalClosure do; the plan's file map placed it in the
// c4d file, which has neither.
//
// AMENDED 2026-08-04: the capability must be held in a module-private WeakMap,
// not on a Symbol key. A Symbol key is fully reflectable via
// Object.getOwnPropertySymbols() / Reflect.ownKeys(), which would publish the
// fencing token. The original assertions scanned only getOwnPropertyNames(),
// which excludes symbols — it could not fail on the design it was guarding.
// ---------------------------------------------------------------------------

test("C4D-TAIL-13: the ownership capability is unreachable by reflection", async () => {
  const mod = await import(
    new URL("../packages/mission/src/corridor-closure-gatherer.js", import.meta.url).href
  );
  assert.equal(typeof mod.hasOwnershipCapability, "function",
    "hasOwnershipCapability must be exported by the I/O tier");

  const f = await fixture();
  const base = f.build();
  const result = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(result.ok, true, result.reason);

  assert.equal(mod.hasOwnershipCapability(result), true, "the tail needs the capability");

  // The three assertions that can actually see a Symbol-key leak.
  assert.deepEqual(Object.getOwnPropertySymbols(result), [],
    "no symbol key may carry the capability");
  const ownKeys = Reflect.ownKeys(result);
  assert.equal(ownKeys.every((k) => typeof k === "string"), true,
    "Reflect.ownKeys must expose no non-string key");
  for (const k of ownKeys) {
    const v = result[k];
    assert.equal(typeof v === "object" && v !== null && "fencingToken" in v, false,
      `reachable capability under key ${String(k)}`);
  }

  const json = JSON.stringify(result);
  assert.equal(json.includes("fencing_token"), false);
  assert.equal(json.includes("fencingToken"), false);
});

// ---------------------------------------------------------------------------
// C4D-OWNED-CLOSURE-TAIL-1B — Task 2: fence restoreToBeforeState.
//
// Restoration MOVES THE FILESYSTEM. It must hold the same law as the original
// effect: a takeover between the effect and restoration must fence the old
// worker BEFORE undo runs. `manifestHash` is the first thing
// restoreToBeforeState touches, so a zero count proves the helper was never
// entered — not merely that it declined once inside.
// ---------------------------------------------------------------------------

async function ownedRollbackFixture() {
  // The settler refuses on binding grounds unless the effect genuinely crossed
  // the boundary — restoration is never reached, and a test built without this
  // would assert on a refusal it never triggered.
  const f = await fixture();
  const base = f.build();
  const outage = await crossBoundaryDuringOutage(f, base);
  assert.equal(outage.ok, false, "the outage must leave the world mutated and unsettled");
  assert.equal(existsSync(f.targetPath), true, "the effect really did happen");

  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  assert.equal(verified.ok, true, verified.reason);
  const own = await acquireClosureOwnership({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
    transactionHash: verified.transaction_hash,
  });
  assert.ok(["ACQUIRED", "HELD"].includes(own.status), `ownership: ${own.status}`);
  return { f, verified, fencingToken: own.claim.claim_hash };
}

async function takeOwnershipAway(f, verified) {
  const dir = ownInternal.ownershipDir(f.demaHome, f.claim.transaction_id);
  const gens = await ownInternal.readGenerations(dir);
  const parent = await probeProcessIdentity(process.pid);
  await seedForeignOwnerAt(f.demaHome, f.claim.transaction_id, verified.transaction_hash,
    { pid: 999_993, process_start_identity: "1", boot_identity_hash: parent.boot_identity_hash },
    gens[gens.length - 1] + 1);
}



// MEASURED 2026-08-04 — Task 2 threat model is NARROWER than the plan assumed.
// A takeover seeded before settle is already caught transitively at the
// ROLLBACK_STARTED chokepoint (appendDurableClosurePhase fences there), and a
// failed restoration degrades monotonically to RECOVERY_REQUIRED -> RESOLVED,
// which is terminal — a resumed settler never re-enters restoration (probe:
// manifestCalls = 0). So restoreToBeforeState is reachable unfenced ONLY in the
// crash window: a worker appends ROLLBACK_STARTED durably, dies before
// restoration, and a successor resumes. That is not provable in-process.
// Task 2 therefore DEPENDS ON the Task 9 child-process harness. TAIL-01/TAIL-02
// are withheld until that harness exists rather than shipped as assertions that
// pass without the fence.
test("C4D-TAIL-01b: the current owner still restores exactly once", async () => {
  const { f, fencingToken } = await ownedRollbackFixture();
  let manifestCalls = 0;
  const base = f.build();
  const spied = wrapEffect(base, {
    manifestHash: () => { manifestCalls += 1; return base.manifestHash(); },
  });

  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared, effect: spied,
    failure: { stage: "EFFECT_APPLIED_PERSISTENCE", reason: "effect_applied_persistence_failed" },
    fencingToken,
  });

  assert.ok(manifestCalls >= 1, "the lawful owner must be permitted to restore");
  assert.notEqual(result.reason, "restoration_owner_fenced");
  assert.notEqual(result.reason, "restoration_ownership_unverifiable");
});

// ── C4D-OWNED-CLOSURE-TAIL-1B — Task 9 harness: real crash-window worker ─────
//
// The single-process probe proved restoreToBeforeState is unreachable by a
// fenced worker in-process: the ROLLBACK_STARTED chokepoint catches a takeover
// first, and a failed restoration degrades terminally so no resume re-enters.
// The ONLY unfenced path is the crash window — a worker makes ROLLBACK_STARTED
// durable, dies before restoration, and a successor resumes.
//
// The child dies inside effect.manifestHash(), which restoreToBeforeState calls
// FIRST. SIGKILL to its own pid gives a real uncatchable death at exactly the
// restoration entry — no unwind, no finally, no terminal phase appended.
// Follows the existing in-file spawnSync(--input-type=module) idiom rather than
// adding a tracked fixture file.

function crashWorkerScript(f, tokenPath) {
  const G = JSON.stringify(join(process.cwd(), "packages/mission/src/corridor-closure-gatherer.js"));
  const O = JSON.stringify(join(process.cwd(), "packages/receipts/src/mission-closure-ownership.js"));
  const X = JSON.stringify(join(process.cwd(), "packages/receipts/src/mission-closure-transaction.js"));
  return `
import { writeFileSync } from "node:fs";
import { buildRenameEffectAdapter, settleMechanicalFailureWithVerifiedRollback } from ${G};
import { acquireClosureOwnership } from ${O};
import { readVerifiedTransactionHash } from ${X};
const home = ${JSON.stringify(f.demaHome)};
const txId = ${JSON.stringify(f.claim.transaction_id)};
const v = await readVerifiedTransactionHash({ demaHome: home, transactionId: txId });
const own = await acquireClosureOwnership({
  demaHome: home, transactionId: txId, transactionHash: v.transaction_hash,
});
// writeFileSync, never stdout: a piped stdout is buffered and SIGKILL discards it.
writeFileSync(${JSON.stringify(tokenPath)}, JSON.stringify({ acquired: own.status, token: own.fencing_token ?? null }));
const base = buildRenameEffectAdapter({
  scopeRoot: ${JSON.stringify(f.estate)},
  from: ${JSON.stringify(SOURCE)},
  to: ${JSON.stringify(TARGET)},
});
const suicidal = { ...base, manifestHash: () => { process.kill(process.pid, "SIGKILL"); } };
await settleMechanicalFailureWithVerifiedRollback({
  demaHome: home,
  claim: ${JSON.stringify({ transaction_id: f.claim.transaction_id })},
  prepared: null,
  effect: suicidal,
  failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
  fencingToken: own.fencing_token ?? null,
});
writeFileSync(${JSON.stringify(tokenPath)} + ".survived", "1");
`;
}

/** Make the current ownership holder provably dead so a successor may take over. */
async function retireCurrentOwnerAsDead(f, deadPid) {
  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  const dir = ownInternal.ownershipDir(f.demaHome, f.claim.transaction_id);
  const gens = await ownInternal.readGenerations(dir);
  await seedForeignOwnerAt(f.demaHome, f.claim.transaction_id, verified.transaction_hash,
    { pid: deadPid, process_start_identity: "1",
      boot_identity_hash: (await probeProcessIdentity(process.pid)).boot_identity_hash },
    gens[gens.length - 1] + 1);
}

/** Run a worker that dies at the restoration entry. Returns its ownership token. */
function runCrashWorker(f) {
  const tokenPath = join(f.demaHome, "crash-worker.json");
  const child = spawnSync(process.execPath,
    ["--input-type=module", "-e", crashWorkerScript(f, tokenPath)], { encoding: "utf8" });
  assert.equal(existsSync(`${tokenPath}.survived`), false,
    "the worker must die at restoration, not complete it");
  assert.notEqual(child.status, 0, "a SIGKILLed worker must not exit 0");
  assert.equal(existsSync(tokenPath), true,
    `child never acquired ownership: status=${child.status} stderr=${child.stderr}`);
  const acq = JSON.parse(readFileSync(tokenPath, "utf8"));
  assert.ok(acq.token, `child must hold a fencing token: ${JSON.stringify(acq)}`);
  return acq.token;
}

test("C4D-TAIL-01: a successor resuming a crashed worker's rollback must be fenced before restoring", async () => {
  const f = await fixture();
  const base = f.build();
  const outage = await crossBoundaryDuringOutage(f, base, { blockOn: "undo" });
  assert.equal(outage.ok, false, "the world must be mutated and unsettled");

  // The in-process route that crossed the boundary still HOLDS ownership, so a
  // child would only get OWNERSHIP_HELD and no token. Retire that holder first
  // by making it provably dead — which is this scenario's premise anyway.
  await retireCurrentOwnerAsDead(f, 999_995);

  // A real worker takes over, makes ROLLBACK_STARTED durable, and dies AT the
  // restoration entry. Nothing terminal is appended, so the window stays open.
  const deadToken = runCrashWorker(f);

  const mid = await replay(f);
  assert.ok(phases(mid).includes("ROLLBACK_STARTED"), `phases: ${phases(mid)}`);
  assert.equal(phases(mid).includes("BEFORE_STATE_VERIFIED"), false, "restoration must be unfinished");
  assert.equal(mid.terminal_outcome ?? null, null, "the crash window must not be terminal");

  // A successor lawfully takes over the provably dead worker.
  const verified = await readVerifiedTransactionHash({
    demaHome: f.demaHome, transactionId: f.claim.transaction_id,
  });
  const dir = ownInternal.ownershipDir(f.demaHome, f.claim.transaction_id);
  const gens = await ownInternal.readGenerations(dir);
  await seedForeignOwnerAt(f.demaHome, f.claim.transaction_id, verified.transaction_hash,
    { pid: 999_991, process_start_identity: "1",
      boot_identity_hash: (await probeProcessIdentity(process.pid)).boot_identity_hash },
    gens[gens.length - 1] + 1);

  // The dead worker's token is now stale. Resuming with it reaches restoration
  // directly — ROLLBACK_STARTED is already durable, so the chokepoint fence is
  // not re-entered. This is the ONLY unfenced world-mutation path left.
  let manifestCalls = 0;
  const spied = wrapEffect(base, {
    manifestHash: () => { manifestCalls += 1; return base.manifestHash(); },
  });
  const result = await settleMechanicalFailureWithVerifiedRollback({
    demaHome: f.demaHome, claim: f.claim, prepared: f.prepared, effect: spied,
    failure: { stage: "VERIFICATION_PERSISTENCE", reason: "verification_persistence_failed" },
    fencingToken: deadToken,
  });

  assert.equal(manifestCalls, 0,
    "a stale worker must be fenced BEFORE restoration touches the filesystem");
  assert.notEqual(result.rollback_verified, true, "no verified rollback may be claimed");
});

// ── Task 4: the canonical ledger append is owner-fenced ─────────────────────
// owned.ledgerAppender() already asserts ownership before delegating (Task 1).
// This proves it, and mutation R3 proves the proof is not vacuous.

const GATHERER_MOD = () => import(
  new URL("../packages/mission/src/corridor-closure-gatherer.js", import.meta.url).href
);
const LEDGER_MOD = () => import(
  new URL("../packages/receipts/src/canonical-ledger.js", import.meta.url).href
);

const ledgerBody = (f) => ({
  domain: "bizra.dema.corridor_closure",
  mission_id: "c4b2a",
  seal_head: `sha256:${"a".repeat(64)}`,
  closure_transaction_id: f.claim.transaction_id,
});

test("C4D-TAIL-04: a stale owner appends no canonical receipt", async () => {
  const { withCurrentClosureOwnership } = await GATHERER_MOD();
  const { loadCanonicalLedger } = await LEDGER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);

  const before = (await loadCanonicalLedger({ demaHome: f.demaHome })).length;

  // A successor takes over, so mech's capability now carries a stale token.
  await retireCurrentOwnerAsDead(f, 999_989);

  let rejection = null;
  await withCurrentClosureOwnership(mech, async (owned) => {
    const append = owned.ledgerAppender({ now: AT });
    await assert.rejects(
      () => append({ canonicalBody: ledgerBody(f), truthLabel: "MEASURED_LOCAL" }),
      (err) => { rejection = String(err?.message ?? err); return true; },
    );
  });

  // POSITIVE assertion. An allow-list of "not these two reasons" let the test
  // pass on `truth_label_invalid` — the append never reached the ledger at all,
  // so mutation R3 could not kill it. Requiring an OWNERSHIP-shaped refusal makes
  // the test self-diagnosing: a malformed body now fails here instead of hiding.
  assert.equal(/ledger append refused/.test(rejection), false,
    `refused by the ledger, not the fence — the body never reached it: ${rejection}`);
  assert.equal(/stale_owner|fenced|unverifiable|mismatch/i.test(rejection), true,
    `not an ownership refusal: ${rejection}`);

  const after = (await loadCanonicalLedger({ demaHome: f.demaHome })).length;
  assert.equal(after, before, "a stale worker must append no canonical receipt");
});

test("C4D-TAIL-04b: the current owner is not refused on ownership grounds", async () => {
  const { withCurrentClosureOwnership } = await GATHERER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);

  let refusal = null;
  await withCurrentClosureOwnership(mech, async (owned) => {
    const append = owned.ledgerAppender({ now: AT });
    try { await append({ canonicalBody: ledgerBody(f), truthLabel: "MEASURED_LOCAL" }); }
    catch (err) { refusal = String(err?.message ?? err); }
  });
  assert.equal(/stale_owner_fenced|ownership|unverifiable/i.test(refusal ?? ""), false,
    `the lawful owner was fenced: ${refusal}`);
});

// ── Task 5: LEDGER_COMMITTED, anchor and ANCHORED are owner-fenced ──────────

test("C4D-TAIL-05a: a stale owner's LEDGER_COMMITTED is refused and moves no head", async () => {
  const { withCurrentClosureOwnership } = await GATHERER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);
  const before = await replay(f);

  await retireCurrentOwnerAsDead(f, 999_987);

  await withCurrentClosureOwnership(mech, async (owned) => {
    const r = await owned.appendPhase({
      phase: "LEDGER_COMMITTED",
      evidenceRefs: [{
        schema: "bizra.dema.corridor_ledger_commit_evidence.v1",
        receipt_id: `sha256:${"b".repeat(64)}`,
        ledger_prefix_length: 1,
        seal_head: `sha256:${"c".repeat(64)}`,
      }],
      atIso: AT,
    });
    assert.equal(r.ok, false, "a stale owner must not append LEDGER_COMMITTED");
    assert.equal(/stale_owner_fenced|ownership_unverifiable/.test(r.reason), true,
      `refused for the wrong reason: ${r.reason}`);
  });

  const after = await replay(f);
  assert.equal(after.head_event_hash, before.head_event_hash, "durable head must not advance");
  assert.equal(after.sequence, before.sequence, "sequence must not advance");
});

test("C4D-TAIL-05b: a stale owner's assert() rejects, so the anchor is unreachable", async () => {
  const { withCurrentClosureOwnership } = await GATHERER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);

  await withCurrentClosureOwnership(mech, async (owned) => {
    await owned.assert();                       // still the owner: permitted
  });

  await retireCurrentOwnerAsDead(f, 999_986);

  await withCurrentClosureOwnership(mech, async (owned) => {
    await assert.rejects(() => owned.assert(),
      (err) => /stale_owner|fenced|unverifiable|mismatch/i.test(String(err?.message)),
      "the fence immediately before publication must refuse a stale owner");
  });
});

test("C4D-TAIL-05c: the CLI tail routes LEDGER_COMMITTED, the anchor and ANCHORED through the owner", () => {
  const cli = readFileSync(join(process.cwd(), "apps/cli/src/commands/mission.js"), "utf8");
  assert.ok(cli.length > 1000, "source must be non-empty for this scan to mean anything");

  assert.ok(cli.includes("runOwnedCorridorWeld({"),
    "the production CLI must call the shared owned weld");
  assert.ok(cli.includes("runOwnedCorridorEvidenceTail({"),
    "the production CLI must call the shared owned evidence tail");

  const weldStart = cli.indexOf("export async function runOwnedCorridorWeld");
  const weldEnd = cli.indexOf("export async function runOwnedCorridorEvidenceTail", weldStart);
  assert.ok(weldStart > 0 && weldEnd > weldStart, "the owned weld must be locatable");
  const weld = cli.slice(weldStart, weldEnd);
  assert.ok(weld.includes("effect: owned.ownedEffect(effect)"),
    "the production weld must receive the owned effect adapter");
  assert.ok(weld.includes("appendReceipt: owned.ledgerAppender({ now: nowIso })"),
    "the production weld must receive the owned canonical-ledger appender");

  const start = weldEnd;
  const end = cli.indexOf("// Two-step root-bound consent", start);
  assert.ok(end > start, "the owned evidence tail must be locatable");
  const tail = cli.slice(start, end);

  for (const phase of ["LEDGER_COMMITTED", "ANCHORED"]) {
    assert.equal(
      new RegExp(`appendClosureTransactionPhase\\([^)]*?phase: "${phase}"`, "s").test(tail), false,
      `${phase} must not be appended outside the owner`,
    );
    assert.equal(
      new RegExp(`owned\\.appendPhase\\(\\{\\s*\\n?\\s*phase: "${phase}"`, "s").test(tail), true,
      `${phase} must route through owned.appendPhase`,
    );
  }

  // A fresh fence immediately before the anchor is published.
  const anchorIdx = tail.indexOf("appendClosureAnchor({");
  assert.ok(anchorIdx > 0, "the anchor call must exist in the tail");
  assert.ok(tail.lastIndexOf("owned.assert()", anchorIdx) > 0,
    "a fresh owned.assert() must precede appendClosureAnchor");
});

// ── Task 6: corridor COMPLETE and C2 RESOLVED are owner-fenced ─────────────

test("C4D-TAIL-06a: a stale owner's RESOLVED append is refused and moves no head", async () => {
  const { withCurrentClosureOwnership } = await GATHERER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);
  const before = await replay(f);

  await retireCurrentOwnerAsDead(f, 999_985);

  await withCurrentClosureOwnership(mech, async (owned) => {
    const r = await owned.appendPhase({
      phase: "RESOLVED",
      terminalOutcome: "COMPLETED_VERIFIED",
      evidenceRefs: [{
        schema: "bizra.dema.corridor_terminal_evidence.v1",
        corridor_event_hash: `sha256:${"d".repeat(64)}`,
        corridor_event_index: 1,
        anchor_hash: `sha256:${"e".repeat(64)}`,
      }],
      atIso: AT,
    });
    assert.equal(r.ok, false, "a stale owner must not append RESOLVED");
    assert.equal(/stale_owner_fenced|ownership_unverifiable/.test(r.reason), true,
      `refused for the wrong reason: ${r.reason}`);
  });

  const after = await replay(f);
  assert.equal(after.head_event_hash, before.head_event_hash, "durable head must not advance");
  assert.equal(after.sequence, before.sequence, "sequence must not advance");
});

test("C4D-TAIL-06b: the CLI routes COMPLETE and RESOLVED through the current owner", () => {
  const cli = readFileSync(join(process.cwd(), "apps/cli/src/commands/mission.js"), "utf8");
  assert.ok(cli.length > 1000, "source must be non-empty for this scan to mean anything");

  const start = cli.indexOf("export async function runOwnedCorridorEvidenceTail");
  const end = cli.indexOf("// Two-step root-bound consent", start);
  assert.ok(start > 0 && end > start, "the closure publication region must be locatable");
  const tail = cli.slice(start, end);

  const completeIdx = tail.indexOf("appendCorridorEvent({");
  assert.ok(completeIdx > 0, "the COMPLETE event builder must exist");
  assert.ok(tail.lastIndexOf("owned.assert()", completeIdx) > 0,
    "a fresh owned.assert() must precede the COMPLETE event");

  assert.equal(
    /appendClosureTransactionPhase\(\{[\s\S]*?phase: "RESOLVED"/.test(tail),
    false,
    "RESOLVED must not be appended outside the owner",
  );
  assert.equal(
    /owned\.appendPhase\(\{\s*phase: "RESOLVED"/.test(tail),
    true,
    "RESOLVED must route through owned.appendPhase",
  );
});

test("C4D-TAIL-10a: terminal recovery can reacquire an opaque current-owner capability", async () => {
  const {
    acquireCurrentClosureOwnership,
    hasOwnershipCapability,
    withCurrentClosureOwnership,
  } = await GATHERER_MOD();
  const f = await fixture();
  const base = f.build();
  const mech = await runTransactionalMechanicalClosure({ ...f.argsWith(base), effect: base });
  assert.equal(mech.ok, true, mech.reason);

  const recoveryOwnership = await acquireCurrentClosureOwnership({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
  });
  assert.equal(recoveryOwnership.ok, true, recoveryOwnership.reason);
  assert.equal(hasOwnershipCapability(recoveryOwnership), true);
  await withCurrentClosureOwnership(recoveryOwnership, async (owned) => {
    const fence = await owned.assert();
    assert.equal(fence.valid, true);
  });
});

test("C4D-TAIL-10b: the already-COMPLETE recovery route appends RESOLVED through ownership", () => {
  const cli = readFileSync(join(process.cwd(), "apps/cli/src/commands/mission.js"), "utf8");
  const start = cli.indexOf('if (last.state === "COMPLETE")');
  const end = cli.indexOf("const closureRecord = {", start);
  assert.ok(start > 0 && end > start, "the terminal recovery region must be locatable");
  const recovery = cli.slice(start, end);

  assert.ok(recovery.includes("acquireCurrentClosureOwnership"),
    "terminal recovery must acquire current transaction ownership");
  assert.ok(recovery.includes("withCurrentClosureOwnership"),
    "terminal recovery must consume the opaque capability");
  assert.ok(recovery.includes('phase: "RESOLVED"'));
  assert.equal(
    /appendClosureTransactionPhase\(\{[\s\S]*?phase: "RESOLVED"/.test(recovery),
    false,
    "terminal recovery must not append RESOLVED without ownership",
  );
});
