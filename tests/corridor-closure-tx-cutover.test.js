// CTX-01… — C3-CLOSURE-TX-CUTOVER-1A.
//
// These tests bind C1 + C2 to the real filesystem rename seam. In-memory phase
// arrays are deliberately insufficient: the acceptance object is the replayed
// transaction history plus measured disk state after process loss.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs, { existsSync, readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import { replayClosureTransaction } from "../packages/receipts/src/mission-closure-transaction.js";
import {
  buildRenameEffectAdapter,
  buildRenameEffectIntent,
  buildLedgerAppender,
  appendClosureAnchor,
  runTransactionalMechanicalClosure,
  CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";

const NOW = 1_786_000_000_000;
const AT = "2026-08-02T12:00:00.000Z";

async function fixture() {
  const demaHome = await mkdtemp(join(tmpdir(), "ctx-c3-"));
  const estate = join(demaHome, "missions", "ctx-c3", "estate");
  await mkdir(estate, { recursive: true });
  await writeFile(join(estate, "closure-evidence.draft.json"), "{\"proof\":true}\n");
  const prepared = buildRenameEffectIntent({
    scopeRoot: estate,
    from: "closure-evidence.draft.json",
    to: "closure-evidence.sealed.json",
  });
  assert.equal(prepared.ok, true, prepared.reason);

  const claimResult = await claimConsentNonce({
    nonce: "ctx-c3-nonce",
    actionClass: "C3_LOCAL_WRITE",
    actionKind: "COMPLETE",
    missionId: "ctx-c3",
    contractHash: `sha256:${"c".repeat(64)}`,
    consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId: "ctx-c3-transaction",
    checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
    claimedAtIso: AT,
    demaHome,
  });
  assert.equal(claimResult.claimed, true);
  const claim = claimResult.claim;
  return {
    demaHome,
    estate,
    prepared,
    claim,
    args: {
      demaHome,
      claim,
      prepared,
      mission: { objective: "close one local rename", root: estate },
      lease: { lease_id: "ctx-c3-lease", scope_root: estate, expires_at: NOW + 60_000, budget_acts: 1 },
      consent: {
        by: "operator",
        ref: claim.consent_context_hash,
        nonce: "ctx-c3-nonce",
        plan_hash: prepared.intent.plan_hash,
      },
      anchorDir: join(demaHome, "anchors"),
      effect: buildRenameEffectAdapter({
        scopeRoot: estate,
        from: "closure-evidence.draft.json",
        to: "closure-evidence.sealed.json",
      }),
      now: NOW,
      atIso: AT,
    },
  };
}

test("CTX-01: C1 claim opens C2 and the real rename reaches a replayable SEALED phase", async () => {
  const f = await fixture();
  const result = await runTransactionalMechanicalClosure(f.args);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.omega0_card.status, "SEALED");

  const replay = await replayClosureTransaction({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
  });
  assert.equal(replay.ok, true, replay.reason);
  assert.deepEqual(
    replay.events.map((event) => event.phase),
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED"],
  );
  assert.equal(existsSync(join(f.estate, "closure-evidence.draft.json")), false);
  assert.equal(existsSync(join(f.estate, "closure-evidence.sealed.json")), true);
  assert.equal(existsSync(join(f.demaHome, "missions", "consent-nonces")), false);
  assert.equal(existsSync(join(f.demaHome, "consent", "nonces")), false);
});

test("CTX-02: SIGKILL after no-replace target publication cold-recovers the two-link intermediate", async () => {
  const f = await fixture();
  const configPath = join(f.demaHome, "kill-after-rename.json");
  await writeFile(configPath, `${JSON.stringify({
    effect: {
      scopeRoot: f.estate,
      from: "closure-evidence.draft.json",
      to: "closure-evidence.sealed.json",
    },
    args: {
      ...f.args,
      effect: undefined,
    },
  })}\n`);

  const child = spawnSync(process.execPath, [
    new URL("./fixtures/corridor-closure-kill-after-rename.mjs", import.meta.url).pathname,
    configPath,
  ], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(child.signal, "SIGKILL", `child did not die at rename boundary: ${child.stderr}`);

  const interrupted = await replayClosureTransaction({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
  });
  assert.equal(interrupted.ok, true, interrupted.reason);
  assert.deepEqual(
    interrupted.events.map((event) => event.phase),
    ["PREPARED", "EFFECT_INTENT_PERSISTED"],
  );
  assert.equal(
    existsSync(join(f.estate, "closure-evidence.draft.json")),
    true,
    "process death between target publication and source unlink leaves the source link visible",
  );
  assert.equal(existsSync(join(f.estate, "closure-evidence.sealed.json")), true);

  // Recovery must classify the exact two-name/same-inode state, finish only the
  // pending source unlink, then prove restoration. It must never overwrite or
  // treat an arbitrary occupied target as this intermediate.
  const recovered = await runTransactionalMechanicalClosure(f.args);
  assert.equal(recovered.ok, true, recovered.reason);
  assert.equal(recovered.resumed_from_post_state, true);

  const replayed = await replayClosureTransaction({
    demaHome: f.demaHome,
    transactionId: f.claim.transaction_id,
  });
  assert.equal(replayed.ok, true, replayed.reason);
  assert.deepEqual(
    replayed.events.map((event) => event.phase),
    ["PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED", "SEALED"],
  );
  assert.equal(existsSync(join(f.estate, "closure-evidence.draft.json")), false);
  assert.equal(existsSync(join(f.estate, "closure-evidence.sealed.json")), true);
});

test("CTX-03: an occupied target appearing inside the old stat-to-rename window is never overwritten", async () => {
  const f = await fixture();
  const sourcePath = join(f.estate, "closure-evidence.draft.json");
  const targetPath = join(f.estate, "closure-evidence.sealed.json");
  const originalStat = fs.statSync;
  const originalLink = fs.linkSync;
  let targetInjected = false;

  // Old code did stat(target) then rename(source,target). This shim creates the
  // victim immediately after that negative observation. New code publishes via
  // link(2), whose EEXIST result is atomic and cannot clobber the victim.
  fs.statSync = function injectAfterNegativeStat(path, ...rest) {
    if (!targetInjected && String(path) === targetPath) {
      targetInjected = true;
      fs.writeFileSync(targetPath, "victim-must-survive\n");
      const err = new Error("injected stale ENOENT");
      err.code = "ENOENT";
      throw err;
    }
    return originalStat.call(this, path, ...rest);
  };
  fs.linkSync = function injectBeforeNoReplaceLink(source, target, ...rest) {
    if (!targetInjected
        && (String(target) === targetPath || String(target).endsWith("/closure-evidence.sealed.json"))) {
      targetInjected = true;
      fs.writeFileSync(targetPath, "victim-must-survive\n");
    }
    return originalLink.call(this, source, target, ...rest);
  };
  syncBuiltinESMExports();

  try {
    assert.throws(
      () => f.args.effect.apply(f.prepared.intent.plan),
      /exists|target|EEXIST/i,
    );
  } finally {
    fs.statSync = originalStat;
    fs.linkSync = originalLink;
    syncBuiltinESMExports();
  }

  assert.equal(readFileSync(sourcePath, "utf8"), "{\"proof\":true}\n");
  assert.equal(readFileSync(targetPath, "utf8"), "victim-must-survive\n");
});

test("CTX-04: swapping the measured estate root for a symlink refuses before outside mutation", async () => {
  const f = await fixture();
  const parked = `${f.estate}.parked`;
  const outside = await mkdtemp(join(tmpdir(), "ctx-c3-outside-"));
  const original = await readFile(join(f.estate, "closure-evidence.draft.json"), "utf8");
  await rename(f.estate, parked);
  await writeFile(join(outside, "closure-evidence.draft.json"), original);
  await symlink(outside, f.estate, "dir");

  const blocked = await runTransactionalMechanicalClosure(f.args);

  assert.equal(blocked.ok, false, "root identity drift must fail closed");
  assert.match(blocked.reason, /root_identity|scope_root/i);
  assert.equal(existsSync(join(outside, "closure-evidence.draft.json")), true);
  assert.equal(existsSync(join(outside, "closure-evidence.sealed.json")), false);
});

test("CTX-05: a replayed valid SEALED transaction reuses its card with zero effect mutation calls", async () => {
  const f = await fixture();
  const first = await runTransactionalMechanicalClosure(f.args);
  assert.equal(first.ok, true, first.reason);

  const base = buildRenameEffectAdapter({
    scopeRoot: f.estate,
    from: "closure-evidence.draft.json",
    to: "closure-evidence.sealed.json",
  });
  const calls = { propose: 0, apply: 0, undo: 0, recover: 0 };
  const effect = {
    ...base,
    propose(...args) { calls.propose += 1; return base.propose(...args); },
    apply(...args) { calls.apply += 1; return base.apply(...args); },
    undo(...args) { calls.undo += 1; return base.undo(...args); },
    recoverApplied(...args) { calls.recover += 1; return base.recoverApplied(...args); },
  };

  const replayed = await runTransactionalMechanicalClosure({ ...f.args, effect });

  assert.equal(replayed.ok, true, replayed.reason);
  assert.equal(replayed.reused_sealed_card, true);
  assert.deepEqual(calls, { propose: 0, apply: 0, undo: 0, recover: 0 });
  assert.equal(replayed.omega0_card.seal_head, first.omega0_card.seal_head);
});

test("CTX-06: anchor append refuses a regressing prefix and a head outside the ledger prefix", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "ctx-anchor-order-"));
  const firstHead = "a".repeat(64);
  const secondHead = "b".repeat(64);
  await mkdir(join(demaHome, "receipts"), { recursive: true });
  await writeFile(join(demaHome, "receipts", "canonical-ledger.ndjson"), [
    JSON.stringify({ receipt_id: firstHead }),
    JSON.stringify({ receipt_id: secondHead }),
  ].join("\n") + "\n");

  appendClosureAnchor({ demaHome, entries: 2, head: secondHead });
  assert.throws(
    () => appendClosureAnchor({ demaHome, entries: 1, head: firstHead }),
    /not_monotonic|regression/i,
  );

  const otherHome = await mkdtemp(join(tmpdir(), "ctx-anchor-prefix-"));
  await mkdir(join(otherHome, "receipts"), { recursive: true });
  await writeFile(join(otherHome, "receipts", "canonical-ledger.ndjson"), [
    JSON.stringify({ receipt_id: firstHead }),
    JSON.stringify({ receipt_id: secondHead }),
  ].join("\n") + "\n");
  assert.throws(
    () => appendClosureAnchor({ demaHome: otherHome, entries: 2, head: "c".repeat(64) }),
    /prefix|head/i,
  );
});

test("CTX-07: anchor acknowledgement follows file and directory fsync", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "ctx-anchor-fsync-"));
  const head = "d".repeat(64);
  await mkdir(join(demaHome, "receipts"), { recursive: true });
  await writeFile(
    join(demaHome, "receipts", "canonical-ledger.ndjson"),
    `${JSON.stringify({ receipt_id: head })}\n`,
  );
  const originalFsync = fs.fsyncSync;
  let fsyncCalls = 0;
  fs.fsyncSync = function countedFsync(fd) {
    fsyncCalls += 1;
    return originalFsync.call(this, fd);
  };
  syncBuiltinESMExports();
  try {
    appendClosureAnchor({ demaHome, entries: 1, head });
  } finally {
    fs.fsyncSync = originalFsync;
    syncBuiltinESMExports();
  }
  assert.ok(fsyncCalls >= 2, `expected file + directory fsync, observed ${fsyncCalls}`);
});

test("CTX-08: the signed ledger receipt claims only SEALED and LEDGER_COMMITTED facts", async () => {
  const demaHome = await mkdtemp(join(tmpdir(), "ctx-ledger-words-"));
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome });
  const append = buildLedgerAppender({
    demaHome,
    now: AT,
    transactionId: "ctx-wording-transaction",
  });
  const out = await append({
    canonicalBody: {
      closure_transaction_id: "ctx-wording-transaction",
      omega0_seal_head: "e".repeat(64),
    },
    truthLabel: "MEASURED_LOCAL",
  });

  assert.equal(out.ok, true);
  assert.match(out.receipt.what_this_proves, /SEALED/);
  assert.match(out.receipt.what_this_proves, /LEDGER_COMMITTED/);
  assert.doesNotMatch(out.receipt.what_this_proves, /anchored|reached COMPLETE/i);
});

test("CTX-09: C1 intent or recovery-policy drift blocks before C2 and mutation", async () => {
  for (const field of ["prepared_intent_hash", "recovery_policy_hash"]) {
    const f = await fixture();
    const claim = { ...f.claim, [field]: `sha256:${"0".repeat(64)}` };
    const blocked = await runTransactionalMechanicalClosure({ ...f.args, claim });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, "mechanical_transaction_authority_mismatch");
    assert.ok(blocked.drifted_fields.includes(field));
    assert.equal(existsSync(join(f.estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(f.estate, "closure-evidence.sealed.json")), false);
    const replay = await replayClosureTransaction({
      demaHome: f.demaHome,
      transactionId: f.claim.transaction_id,
    });
    assert.equal(replay.exists, false, `${field} drift opened C2`);
  }
});
