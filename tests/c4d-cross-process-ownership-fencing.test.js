// C4D-01…18 — NODE0-C4D-CROSS-PROCESS-OWNERSHIP-AND-FENCING-1A.
//
// The transaction journal is compare-and-append safe, so two racing workers
// produce exactly one durable event. That protects HISTORY. It does not protect
// the WORLD: the mechanical effect crosses the effect boundary before the loser
// learns it lost the append race. These tests pin the missing law —
//
//   one transaction → one live local process owner → one current fencing token
//   → every mutation proves that token immediately before acting
//
// — and, critically, that TIME never revokes a live owner. A paused-but-living
// process keeps ownership; otherwise it could wake after a takeover and both
// processes would touch the world. Takeover is lawful only against a provably
// dead or pid-reused predecessor.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  acquireClosureOwnership,
  inspectClosureOwnership,
  validateFencingToken,
  releaseClosureOwnership,
  deriveClaimHash,
  validateClaimShape,
  readProcessStartIdentity,
  probeProcessIdentity,
  MISSION_CLOSURE_OWNERSHIP_SCHEMA,
  MISSION_CLOSURE_OWNERSHIP_DOMAIN,
  CLAIM_KIND_ACQUIRE,
  CLAIM_KIND_TAKEOVER,
  OWNERSHIP_ACQUIRED,
  OWNERSHIP_HELD,
  OWNERSHIP_STATUS_UNVERIFIABLE,
  STALE_OWNER_FENCED,
  _internal,
} from "../packages/receipts/src/mission-closure-ownership.js";
import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  replayClosureTransaction,
  readVerifiedTransactionHash,
} from "../packages/receipts/src/mission-closure-transaction.js";
import { loadCanonicalLedger } from "../packages/receipts/src/canonical-ledger.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  loadPublicKey,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  provisionNodeRootTrust, ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
} from "../packages/genesis/src/node-root-trust.js";
import {
  establishGenesisWitness, WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-genesis-witness.js";
import {
  buildClaimBoundConsentRegistry,
  buildRenameEffectAdapter,
  buildRenameEffectIntent,
  readClosureAnchorLog,
  runTransactionalMechanicalClosure,
  withCurrentClosureOwnership,
  CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import { runCorridorClosure } from "../packages/mission/src/mission-corridor-closure.js";
import {
  appendCorridorEvent,
  buildMissionContract,
} from "../packages/mission/src/mission-corridor.js";
import { evaluateVerificationAdmission } from "../packages/core/src/verification-admission.js";
import {
  runOwnedCorridorEvidenceTail,
  runOwnedCorridorWeld,
} from "../apps/cli/src/commands/mission.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TX = "tx-c4d-0001";
const TX_HASH = "sha256:" + "a".repeat(64);

function freshHome() {
  return mkdtempSync(join(tmpdir(), "c4d-"));
}

/** Deterministic identity probe: a table of pid → identity, null otherwise. */
function fakeProbe(table) {
  return async (pid) => (table.has(pid) ? { pid, ...table.get(pid) } : null);
}

const SELF = { process_start_identity: "1000", boot_identity_hash: "sha256:" + "b".repeat(64) };

function selfProbe(extra = []) {
  return fakeProbe(new Map([[process.pid, SELF], ...extra]));
}

/** Seed a current-owner claim directly, as a crashed/foreign process would leave it. */
function seedClaim(home, { pid, startIdentity, bootHash, kind = CLAIM_KIND_ACQUIRE, predecessor = null, gen = 0, mangle = null }) {
  const dir = _internal.ownershipDir(home, TX);
  mkdirSync(join(dir, "claims"), { recursive: true });
  const body = {
    schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
    domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
    transaction_id: TX,
    transaction_hash: TX_HASH,
    owner_instance_id: "seeded-owner-instance",
    pid,
    process_start_identity: startIdentity,
    boot_identity_hash: bootHash ?? SELF.boot_identity_hash,
    acquired_at_iso: "2026-08-04T00:00:00.000Z",
    predecessor_claim_hash: predecessor,
    claim_kind: kind,
  };
  let claim = { ...body, claim_hash: deriveClaimHash({ ...body, claim_hash: null }) };
  if (mangle) claim = mangle(claim);
  writeFileSync(join(dir, `current.gen${gen}`), JSON.stringify(claim, null, 2));
  return claim;
}

describe("C4D cross-process ownership and fencing", () => {
  test("C4D-02: a live owner is NOT revoked by elapsed time", async () => {
    const home = freshHome();
    try {
      // The owner is another live pid whose identity the probe can confirm.
      const otherPid = 4242;
      const other = { process_start_identity: "777", boot_identity_hash: SELF.boot_identity_hash };
      seedClaim(home, { pid: otherPid, startIdentity: other.process_start_identity });
      const res = await acquireClosureOwnership({
        demaHome: home,
        transactionId: TX,
        transactionHash: TX_HASH,
        identityProbe: selfProbe([[otherPid, other]]),
      });
      assert.equal(res.status, OWNERSHIP_HELD, "a living owner keeps ownership no matter how old the claim is");
      assert.equal(res.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-03: a dead owner (pid gone) permits exactly one takeover", async () => {
    const home = freshHome();
    try {
      const deadPid = 999_999; // not present; pidExists() reports dead
      const prior = seedClaim(home, { pid: deadPid, startIdentity: "555" });
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH,
        identityProbe: selfProbe(),
      });
      assert.equal(res.status, OWNERSHIP_ACQUIRED);
      assert.equal(res.claim.claim_kind, CLAIM_KIND_TAKEOVER);
      assert.equal(res.claim.predecessor_claim_hash, prior.claim_hash, "takeover must chain to its predecessor");
      assert.equal(res.generation, 1);
      // Predecessor evidence survives — ownership history is immutable.
      assert.equal(existsSync(join(_internal.ownershipDir(home, TX), "current.gen0")), true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-04: pid reuse is recognised — same pid, different process birth", async () => {
    const home = freshHome();
    try {
      const reusedPid = 4243;
      // Claim says this pid was born at tick 111; the probe reports 222 today.
      seedClaim(home, { pid: reusedPid, startIdentity: "111" });
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH,
        identityProbe: selfProbe([[reusedPid, { process_start_identity: "222", boot_identity_hash: SELF.boot_identity_hash }]]),
      });
      assert.equal(res.status, OWNERSHIP_ACQUIRED, "a recycled pid is not the original owner");
      assert.equal(res.claim.claim_kind, CLAIM_KIND_TAKEOVER);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-04b: a reboot invalidates a prior-boot pid/start tuple", async () => {
    const home = freshHome();
    try {
      const pid = 4244;
      seedClaim(home, { pid, startIdentity: "111", bootHash: "sha256:" + "c".repeat(64) });
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH,
        identityProbe: selfProbe([[pid, { process_start_identity: "111", boot_identity_hash: SELF.boot_identity_hash }]]),
      });
      assert.equal(res.status, OWNERSHIP_ACQUIRED);
      assert.equal(res.claim.claim_kind, CLAIM_KIND_TAKEOVER);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-04c: a SIGKILLed owner awaiting reaping is a zombie, not a live owner", async () => {
    const home = freshHome();
    try {
      const zombiePid = 4250;
      seedClaim(home, { pid: zombiePid, startIdentity: "111" });
      // Identical pid, identical start time, identical boot — the only thing
      // that says this owner is gone is its process STATE.
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH,
        identityProbe: selfProbe([[zombiePid, {
          process_start_identity: "111",
          boot_identity_hash: SELF.boot_identity_hash,
          process_state: "Z",
        }]]),
      });
      assert.equal(res.status, OWNERSHIP_ACQUIRED, "a corpse cannot hold the world's lock");
      assert.equal(res.claim.claim_kind, CLAIM_KIND_TAKEOVER);
      // The state must never reach persisted evidence.
      assert.equal(Object.prototype.hasOwnProperty.call(res.claim, "process_state"), false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-05: unreadable process identity fails closed — never assumed dead", async () => {
    const home = freshHome();
    try {
      // ppid is alive, but the probe cannot answer for it.
      const livePid = process.ppid;
      seedClaim(home, { pid: livePid, startIdentity: "111" });
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH,
        identityProbe: selfProbe(),
      });
      assert.equal(res.status, OWNERSHIP_STATUS_UNVERIFIABLE);
      assert.equal(res.requires_human, true);
      assert.equal(res.mutation_performed, false);
      // No takeover was written.
      const gens = await _internal.readGenerations(_internal.ownershipDir(home, TX));
      assert.deepEqual(gens, [0], "an unverifiable owner must not be displaced");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-07/08/09: a stale token performs zero mutation of any kind", async () => {
    const home = freshHome();
    try {
      const first = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe(),
      });
      assert.equal(first.status, OWNERSHIP_ACQUIRED);
      const staleToken = first.fencing_token;

      // The owner dies; a new process takes over.
      const dir = _internal.ownershipDir(home, TX);
      const gen1 = JSON.parse(readFileSync(join(dir, "current.gen0"), "utf8"));
      seedClaim(home, {
        pid: 4245, startIdentity: "999", kind: CLAIM_KIND_TAKEOVER,
        predecessor: gen1.claim_hash, gen: 1,
      });

      const fence = await validateFencingToken({ demaHome: home, transactionId: TX, fencingToken: staleToken });
      assert.equal(fence.valid, false);
      assert.equal(fence.status, STALE_OWNER_FENCED);
      assert.equal(fence.mutation_performed, false, "no effect, rollback, or restoration");
      assert.equal(fence.event_appended, false, "no ledger, anchor, corridor, or C2 append");
      assert.equal(fence.effect_retry_forbidden, true);
      assert.equal(fence.requires_human, false, "a valid newer owner exists — ordinary arbitration");
      assert.equal(typeof fence.current_owner_claim_hash, "string", "the stale worker may OBSERVE the winner");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-14: a stale owner cannot release a newer owner's claim", async () => {
    const home = freshHome();
    try {
      const first = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe(),
      });
      const staleToken = first.fencing_token;
      const dir = _internal.ownershipDir(home, TX);
      const gen0 = JSON.parse(readFileSync(join(dir, "current.gen0"), "utf8"));
      seedClaim(home, { pid: 4246, startIdentity: "888", kind: CLAIM_KIND_TAKEOVER, predecessor: gen0.claim_hash, gen: 1 });

      const rel = await releaseClosureOwnership({ demaHome: home, transactionId: TX, fencingToken: staleToken });
      assert.equal(rel.released, false);
      assert.equal(rel.status, STALE_OWNER_FENCED);
      const current = await inspectClosureOwnership({ demaHome: home, transactionId: TX });
      assert.equal(current.generation, 1, "the newer owner remains current");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-15: malformed, hash-invalid, or mismatched claims fail closed", async () => {
    const cases = [
      ["hash tampered", (c) => ({ ...c, claim_hash: "sha256:" + "0".repeat(64) })],
      ["unknown key", (c) => ({ ...c, injected_env: "SECRET=1" })],
      ["missing key", (c) => { const { pid, ...rest } = c; return rest; }],
      ["field not primitive", (c) => ({ ...c, pid: { value: 1 } })],
      ["acquire carrying a predecessor", (c) => ({ ...c, predecessor_claim_hash: "sha256:" + "d".repeat(64) })],
    ];
    for (const [label, mangle] of cases) {
      const home = freshHome();
      try {
        seedClaim(home, { pid: 4247, startIdentity: "111", mangle });
        const res = await acquireClosureOwnership({
          demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe(),
        });
        assert.equal(res.status, OWNERSHIP_STATUS_UNVERIFIABLE, `${label} must fail closed`);
        assert.equal(res.requires_human, true, label);
        assert.equal(res.mutation_performed, false, label);
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    }
  });

  test("C4D-15b: a claim for a different transaction is refused", async () => {
    const home = freshHome();
    try {
      seedClaim(home, { pid: 4248, startIdentity: "111" });
      const res = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: "sha256:" + "e".repeat(64),
        identityProbe: selfProbe(),
      });
      assert.equal(res.status, OWNERSHIP_STATUS_UNVERIFIABLE);
      assert.equal(res.reason, "claim_transaction_mismatch");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-16: different transactions are owned concurrently — no global lock", async () => {
    const home = freshHome();
    try {
      const a = await acquireClosureOwnership({ demaHome: home, transactionId: "tx-a", transactionHash: TX_HASH, identityProbe: selfProbe() });
      const b = await acquireClosureOwnership({ demaHome: home, transactionId: "tx-b", transactionHash: TX_HASH, identityProbe: selfProbe() });
      assert.equal(a.status, OWNERSHIP_ACQUIRED);
      assert.equal(b.status, OWNERSHIP_ACQUIRED, "owning tx-a must not contend with tx-b");
      assert.notEqual(a.fencing_token, b.fencing_token);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D-18: raw environment, command line, or secrets cannot enter a claim", async () => {
    const home = freshHome();
    try {
      const first = await acquireClosureOwnership({ demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe() });
      const claim = first.claim;
      assert.deepEqual(Object.keys(claim).sort(), [..._internal.CLAIM_KEYS].sort(), "exact closed key set");
      const serialized = JSON.stringify(claim);
      for (const f of ["PATH=", "argv", "Error:", "    at ", "BEGIN"]) {
        assert.equal(serialized.includes(f), false, `claim must not carry ${f}`);
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("acquire is idempotent for the same live process", async () => {
    const home = freshHome();
    try {
      const a = await acquireClosureOwnership({ demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe() });
      const b = await acquireClosureOwnership({ demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe() });
      assert.equal(b.status, OWNERSHIP_ACQUIRED);
      assert.equal(b.recovered, true);
      assert.equal(b.fencing_token, a.fencing_token, "re-acquiring must not mint a second token");
      const gens = await _internal.readGenerations(_internal.ownershipDir(home, TX));
      assert.deepEqual(gens, [0], "no second generation for the same owner");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("the fencing token is body-bound — a forged claim_hash is refused", async () => {
    const forged = {
      schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA, domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
      transaction_id: TX, transaction_hash: TX_HASH, owner_instance_id: "x", pid: 1,
      process_start_identity: "1", boot_identity_hash: "sha256:" + "b".repeat(64),
      acquired_at_iso: "2026-08-04T00:00:00.000Z", predecessor_claim_hash: null,
      claim_kind: CLAIM_KIND_ACQUIRE, claim_hash: "sha256:" + "f".repeat(64),
    };
    const v = validateClaimShape(forged);
    assert.equal(v.valid, false);
    assert.equal(v.reason, "claim_hash_mismatch", "the verifier must re-derive, never trust the stored hash");
  });

  test("real /proc parsing survives a process name containing spaces and parentheses", async () => {
    // Field 2 is wrapped in parens and may contain both, so the only correct
    // split is at the LAST ')'. This is the classic /proc parsing bug.
    const start = await readProcessStartIdentity(process.pid);
    assert.match(String(start), /^\d+$/, "our own start time must parse");
    const identity = await probeProcessIdentity(process.pid);
    assert.equal(identity.pid, process.pid);
    assert.match(identity.boot_identity_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(await readProcessStartIdentity(999_999), null, "a missing pid is null, not a throw");
    assert.equal(await readProcessStartIdentity(-1), null);
  });
});

// ── real concurrently-spawned processes ────────────────────────────────────
// Mocked probes cannot prove the filesystem arbitration. These spawn actual
// Node processes and align them with explicit ready/go barrier files — never a
// timing sleep, which would prove nothing about the race.

// The child must HOLD ownership after acquiring, exactly as the production
// route holds it across the effect boundary. An earlier version exited the
// instant it acquired, and the race then produced two ACQUIRED results — not a
// double-owner bug but a lawful takeover of a genuinely dead predecessor. That
// is correct behaviour against an artificial scenario: a winner that dies
// immediately SHOULD be succeeded. Holding until released is what makes this
// test measure "at most one LIVE owner", which is the actual C4D law.
const CHILD = `
import { acquireClosureOwnership } from "REPO/packages/receipts/src/mission-closure-ownership.js";
import { writeFileSync, existsSync } from "node:fs";
const [, , home, tx, txHash, ready, go, out, done] = process.argv;
writeFileSync(ready, "1");
while (!existsSync(go)) {}                      // explicit barrier, not a sleep
const res = await acquireClosureOwnership({ demaHome: home, transactionId: tx, transactionHash: txHash });
writeFileSync(out, JSON.stringify({ status: res.status, token: res.fencing_token ?? null, kind: res.claim?.claim_kind ?? null, gen: res.generation ?? null }));
while (!existsSync(done)) {}                    // stay alive: a live owner is not succeeded
`;

function spawnRacers(home, count, tx, txHash, dir) {
  const script = join(dir, "racer.mjs");
  writeFileSync(script, CHILD.replace("REPO", REPO_ROOT));
  const go = join(dir, "GO");
  const done = join(dir, "DONE");
  const kids = [];
  for (let i = 0; i < count; i += 1) {
    kids.push({
      ready: join(dir, `ready.${i}`),
      out: join(dir, `out.${i}`),
      proc: spawn(process.execPath, [script, home, tx, txHash, join(dir, `ready.${i}`), go, join(dir, `out.${i}`), done], { stdio: "ignore" }),
    });
  }
  return { kids, go, done };
}

async function waitFor(predicate, label, ms = 30_000) {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setImmediate(r));
  }
}

async function runRace(home, count, tx, txHash, dir) {
  const { kids, go, done } = spawnRacers(home, count, tx, txHash, dir);
  await waitFor(() => kids.every((k) => existsSync(k.ready)), "racers ready");
  writeFileSync(go, "1");                          // release them together
  try {
    // Existence alone is not publication: the parent can observe the pathname
    // after open(2) but before writeFileSync has finished the JSON bytes. Wait
    // for each complete parse while every child is still ALIVE and holding, so
    // a live owner cannot be succeeded mid-measurement.
    await waitFor(
      () => kids.every((k) => {
        try {
          JSON.parse(readFileSync(k.out, "utf8"));
          return true;
        } catch {
          return false;
        }
      }),
      "complete racer results",
    );
    return kids.map((k) => JSON.parse(readFileSync(k.out, "utf8")));
  } finally {
    writeFileSync(done, "1");                      // always let children exit
    await Promise.all(kids.map((k) => new Promise((res) => k.proc.on("exit", res))));
  }
}

describe("C4D production wiring", () => {
  test("C4D-09p: the production append chokepoint refuses a stale token", async () => {
    const { appendClosureTransactionPhase } = await import(
      "../packages/mission/src/corridor-closure-gatherer.js"
    );
    const home = freshHome();
    try {
      const first = await acquireClosureOwnership({
        demaHome: home, transactionId: TX, transactionHash: TX_HASH, identityProbe: selfProbe(),
      });
      const staleToken = first.fencing_token;
      const dir = _internal.ownershipDir(home, TX);
      const gen0 = JSON.parse(readFileSync(join(dir, "current.gen0"), "utf8"));
      seedClaim(home, { pid: 4249, startIdentity: "321", kind: CLAIM_KIND_TAKEOVER, predecessor: gen0.claim_hash, gen: 1 });

      const res = await appendClosureTransactionPhase({
        demaHome: home,
        transactionId: TX,
        phase: "EFFECT_APPLIED",
        evidenceRefs: [],
        atIso: "2026-08-04T00:00:00.000Z",
        fencingToken: staleToken,
      });
      assert.equal(res.ok, false);
      // The chokepoint now re-derives the transaction hash from CURRENT C2 bytes
      // before it will honour any token. Here no verifiable C2 exists at all, so
      // it fails closed on the binding before it ever reaches the staleness
      // question — which is the stricter of the two refusals, and the right one:
      // a token cannot be authoritative for a transaction that cannot be read.
      assert.equal(res.reason, "ownership_unverifiable");
      assert.equal(res.ownership.reason, "transaction_binding_unverifiable");
      assert.equal(res.ownership.requires_human, true);
      assert.equal(res.ownership.event_appended, false);
      assert.equal(res.ownership.mutation_performed, false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("C4D call-graph: no production durable append bypasses the fence", async () => {
    const src = readFileSync(
      join(REPO_ROOT, "packages/mission/src/corridor-closure-gatherer.js"),
      "utf8",
    );
    assert.ok(src.length > 1000, "source must be non-empty for this scan to mean anything");

    // Every call to the durable-append chokepoint inside production must hand it
    // a fencing token. The definition itself is the only exception.
    const calls = src.split("await appendDurableClosurePhase({").slice(1);
    assert.ok(calls.length >= 9, `expected the known append call sites, found ${calls.length}`);
    const unfenced = calls.filter((tail) => !tail.slice(0, 200).includes("fencingToken"));
    assert.deepEqual(unfenced.map((t) => t.split("\n")[2]?.trim()), [], "every durable append must be fenced");

    // The mechanical effect must be fenced immediately before it is applied.
    const effectIdx = src.indexOf("applyPreparedMechanicalClosure({ prepared: mechanicalPrepared");
    assert.ok(effectIdx > 0, "the production effect call must exist");
    const preamble = src.slice(Math.max(0, effectIdx - 1200), effectIdx);
    assert.ok(
      preamble.includes("validateCurrentC2Ownership({"),
      "the effect boundary must revalidate against CURRENT C2 immediately before acting",
    );
    // …and that helper must re-derive from disk, never accept a caller's hash.
    const helperIdx = src.indexOf("async function validateCurrentC2Ownership(");
    assert.ok(helperIdx > 0, "the fresh-C2 helper must exist");
    const helper = src.slice(helperIdx, helperIdx + 1400);
    assert.ok(
      helper.includes("readVerifiedTransactionHash({"),
      "the fence must re-read C2 from disk, not trust an acquisition-time value",
    );
    // No mutation boundary may still be handed a cached transaction hash.
    assert.equal(
      /expectedTransactionHash[,:]\s*$/m.test(src.slice(0, helperIdx))
        || src.slice(helperIdx + 1400).includes("expectedTransactionHash,"),
      false,
      "no caller may thread a cached transaction hash to a mutation boundary",
    );

    // Ownership must be acquired before the first durable phase, not after.
    assert.ok(
      src.indexOf("acquireClosureOwnership({") < src.indexOf('phase: "EFFECT_INTENT_PERSISTED"'),
      "ownership must precede the first durable append",
    );

    // Read-only surfaces stay ownership-free — fencing a replay would turn an
    // observation into a mutation-shaped operation.
    const replayDef = src.indexOf("export async function resolveRenameEffectIntent(");
    assert.ok(replayDef > 0);
    assert.equal(
      src.slice(replayDef, replayDef + 900).includes("acquireClosureOwnership"),
      false,
      "read-only intent resolution must not require ownership",
    );
  });
});

describe("C4D real concurrent processes", () => {
  test("C4D-01: N real processes race — exactly one acquires", async () => {
    const home = freshHome();
    const dir = mkdtempSync(join(tmpdir(), "c4d-race-"));
    try {
      const results = await runRace(home, 5, TX, TX_HASH, dir);
      const acquired = results.filter((r) => r.status === OWNERSHIP_ACQUIRED);
      const held = results.filter((r) => r.status === OWNERSHIP_HELD);
      assert.equal(results.length, 5);
      assert.equal(acquired.length, 1, `exactly one owner, got ${JSON.stringify(results.map((r) => r.status))}`);
      assert.equal(held.length, 4, "every loser reports OWNERSHIP_HELD, not an error");
      const gens = await _internal.readGenerations(_internal.ownershipDir(home, TX));
      assert.deepEqual(gens, [0], "exactly one current claim, no partial or corrupt generations");
      const current = await inspectClosureOwnership({ demaHome: home, transactionId: TX });
      assert.equal(current.state, "PRESENT");
      assert.equal(current.claim.claim_hash, acquired[0].token);
      assert.equal(current.claim.claim_kind, CLAIM_KIND_ACQUIRE);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("C4D-06: N real processes race to take over ONE dead owner — one winner", async () => {
    const home = freshHome();
    const dir = mkdtempSync(join(tmpdir(), "c4d-take-"));
    try {
      // A provably dead predecessor: pid absent, real boot identity so live
      // children compare against the same boot.
      const bootHash = (await probeProcessIdentity(process.pid)).boot_identity_hash;
      const prior = seedClaim(home, { pid: 999_998, startIdentity: "1", bootHash });
      const results = await runRace(home, 4, TX, TX_HASH, dir);
      const acquired = results.filter((r) => r.status === OWNERSHIP_ACQUIRED);
      assert.equal(acquired.length, 1, `exactly one takeover wins, got ${JSON.stringify(results.map((r) => r.status))}`);
      assert.equal(acquired[0].kind, CLAIM_KIND_TAKEOVER);
      assert.equal(acquired[0].gen, 1);
      assert.equal(results.filter((r) => r.status === OWNERSHIP_HELD).length, 3, "losers observe the winner");
      const current = await inspectClosureOwnership({ demaHome: home, transactionId: TX });
      assert.equal(current.claim.predecessor_claim_hash, prior.claim_hash, "immutable predecessor relation");
      assert.equal(existsSync(join(_internal.ownershipDir(home, TX), "current.gen0")), true, "predecessor evidence preserved");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// C4D-OWNED-CLOSURE-TAIL-1B — Task 1 (red-first)
//
// Red phase uses dynamic import so a missing export fails THESE tests only,
// instead of a module-load SyntaxError that would take the whole file down and
// hide whether anything else regressed. Converts to a static import at Step 3.
// ---------------------------------------------------------------------------

const GATHERER_URL = new URL(
  "../packages/mission/src/corridor-closure-gatherer.js",
  import.meta.url,
).href;

test("C4D-TAIL-12: a tail mutation without the capability fails closed", async () => {
  const mod = await import(GATHERER_URL);
  assert.equal(
    typeof mod.withCurrentClosureOwnership,
    "function",
    "withCurrentClosureOwnership must be exported by the I/O tier",
  );
  await assert.rejects(
    () => mod.withCurrentClosureOwnership({ ok: true }, async () => "should not run"),
    /ownership_capability_absent/,
  );
});

// ---------------------------------------------------------------------------
// C4D-TAIL-15 — real two-process post-ledger tail race
//
// This deliberately starts from the corridor's real C1/C2/Omega0 fixture shape,
// with one signed canonical receipt already durable and C2 still at SEALED.
// Two separately spawned Node processes then contend to resume that SAME tail.
// A synthetic rival-owner file alone cannot satisfy this test: both contenders
// must cross an explicit ready/go barrier and terminate in declared OS exit
// classes while the winner remains alive long enough for the loser to observe it.
// ---------------------------------------------------------------------------

const TAIL_AT = "2026-08-02T12:00:00.000Z";
const TAIL_NOW = 1_786_000_000_000;
const TAIL_SOURCE = "closure-evidence.draft.json";
const TAIL_TARGET = "closure-evidence.sealed.json";
let tailFixtureSeq = 0;

function buildCheckpointCorridor(missionId) {
  const built = buildMissionContract({
    mission_id: missionId,
    objective: "close one local rename under a real two-process tail race",
    base_sha: "0".repeat(40),
    permitted_actions: ["analyze", "edit", "test"],
    merge_policy: "checkpoint_required",
    time_budget_hours: 1,
    repair_budget_per_slice: 1,
    stop_conditions: ["ownership_lost"],
    created_at_iso: "2026-08-02T05:00:00.000Z",
  });
  assert.equal(built.ok, true, built.blocked_by.join(","));
  let journal = [];
  const states = [
    "CREATED", "PREFLIGHT", "PLANNING", "IMPLEMENTING",
    "VERIFYING", "SAT_REVIEW", "CI_WAIT", "CHECKPOINT",
  ];
  for (const [index, state] of states.entries()) {
    const appended = appendCorridorEvent({
      contract_hash: built.contract_hash,
      journal,
      event: {
        state,
        at_iso: `2026-08-02T${String(index + 5).padStart(2, "0")}:00:00.000Z`,
        next_command: `fixture-step-${index + 1}`,
      },
    });
    assert.equal(appended.ok, true, `${state}: ${appended.blocked_by.join(",")}`);
    journal = appended.journal;
  }
  return { contract: built.contract, contractHash: built.contract_hash, journal };
}

function verificationAdmission(missionId) {
  return ({ card }) => {
    const admission = evaluateVerificationAdmission({
      proposed_act: `corridor-closure:${missionId}`,
      verifier: "hash_equality",
      proposer: "corridor-closure-effect-adapter",
      certifier: "omega0-mechanical-closure-route",
      bindings: { expected_post_sha256: card.after_hash },
    });
    return {
      admitted: admission.self_verifiable === true,
      reason: admission.refusal_reason ?? null,
    };
  };
}

async function postLedgerTailFixture({ retireOwner = true } = {}) {
  tailFixtureSeq += 1;
  const demaHome = freshHome();
  const missionId = `c4d-tail-${tailFixtureSeq}`;
  const transactionId = `c4d-tail-transaction-${tailFixtureSeq}`;
  const nonce = `c4d-tail-nonce-${tailFixtureSeq}`;
  const estate = join(demaHome, "missions", missionId, "estate");
  mkdirSync(estate, { recursive: true });
  writeFileSync(join(estate, TAIL_SOURCE), "{\"proof\":true}\n");
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome });
  // PROVISIONED-ROOT-TRUST-BOUNDARY-1A: the tail resume appends to a ledger
  // that already has entries, which is exactly the path that now demands a
  // provisioned genesis root instead of nominating the current active key.
  const rooted = await provisionNodeRootTrust({
    demaHome,
    nodeId: "c4d-node",
    rootPublicKeyPem: await loadPublicKey(demaHome),
    consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId: `c4d-genesis-${tailFixtureSeq}`,
    establishedAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(rooted.ok, true, rooted.reason ?? "root trust must provision");
  // Genesis is not established until the root is PINNED out of band.
  const pinned = await establishGenesisWitness({
    demaHome, witnessPath: `${demaHome}-witness.json`, nodeId: "c4d-node",
    ceremonyId: `c4d-genesis-${tailFixtureSeq}`, consent: WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
    witnessedAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(pinned.ok, true, pinned.reason ?? "ceremony pin must establish");
  process.env.DEMA_GENESIS_WITNESS = `${demaHome}-witness.json`;

  const prepared = buildRenameEffectIntent({
    scopeRoot: estate,
    from: TAIL_SOURCE,
    to: TAIL_TARGET,
  });
  assert.equal(prepared.ok, true, prepared.reason);
  const claimResult = await claimConsentNonce({
    nonce,
    actionClass: "C3_LOCAL_WRITE",
    actionKind: "COMPLETE",
    missionId,
    contractHash: `sha256:${"c".repeat(64)}`,
    consentContextHash: `sha256:${"d".repeat(64)}`,
    transactionId,
    checkpointEventHash: `sha256:${"e".repeat(64)}`,
    preparedIntentHash: prepared.prepared_intent_hash,
    recoveryPolicyHash: CORRIDOR_RENAME_RECOVERY_POLICY_HASH,
    claimedAtIso: TAIL_AT,
    demaHome,
  });
  assert.equal(claimResult.claimed, true);

  const claim = claimResult.claim;
  const mission = {
    objective: "close one local rename under a real two-process tail race",
    root: estate,
  };
  const lease = {
    lease_id: `c4d-tail-lease-${tailFixtureSeq}`,
    scope_root: estate,
    expires_at: TAIL_NOW + 60_000,
    budget_acts: 1,
  };
  const consent = {
    by: "operator",
    ref: claim.consent_context_hash,
    nonce,
    plan_hash: prepared.intent.plan_hash,
  };
  const anchorDir = join(demaHome, "anchors");
  const effectConfig = {
    scopeRoot: estate,
    from: TAIL_SOURCE,
    to: TAIL_TARGET,
  };
  const mechanicalArgs = {
    demaHome,
    claim,
    prepared,
    mission,
    lease,
    consent,
    anchorDir,
    now: TAIL_NOW,
    atIso: TAIL_AT,
  };
  const effect = buildRenameEffectAdapter(effectConfig);
  const mechanical = await runTransactionalMechanicalClosure({
    ...mechanicalArgs,
    effect,
  });
  assert.equal(mechanical.ok, true, mechanical.reason);
  const corridor = buildCheckpointCorridor(missionId);

  // Establish the exact crash-recovery starting point: the signed receipt is
  // durable, but no post-ledger C2 phase exists yet.
  const preTail = await withCurrentClosureOwnership(mechanical, async (owned) =>
    runCorridorClosure({
      contract: { mission_id: missionId },
      contract_hash: corridor.contractHash,
      journal: corridor.journal,
      mission,
      lease,
      consent,
      anchorDir,
      effect: owned.ownedEffect(effect),
      now: TAIL_NOW,
      omega0Card: mechanical.omega0_card,
      transactionBinding: {
        transaction_id: transactionId,
        consent_claim_hash: claim.claim_hash,
        prepared_intent_hash: prepared.prepared_intent_hash,
      },
      appendReceipt: owned.ledgerAppender({ now: TAIL_AT }),
      verifyAdmission: verificationAdmission(missionId),
      consentRegistry: buildClaimBoundConsentRegistry({ demaHome, claim }),
    })
  );
  assert.equal(preTail.state, "COMPLETE", preTail.terminal_outcome);
  assert.equal((await loadCanonicalLedger({ demaHome })).length, 1);
  const beforeRace = await replayClosureTransaction({ demaHome, transactionId });
  assert.equal(beforeRace.phase, "SEALED");
  for (const phase of ["LEDGER_COMMITTED", "ANCHORED", "RESOLVED"]) {
    assert.equal(beforeRace.events.some((event) => event.phase === phase), false);
  }

  if (retireOwner) {
    // The process that crossed the effect boundary is still alive (this parent).
    // Replace it with a valid, provably-dead successor so the two real children
    // race for one lawful takeover rather than both observing this live process.
    await supersedeCurrentTailOwner({ demaHome, transactionId }, 999_994);
  }

  return {
    demaHome,
    transactionId,
    mechanical,
    closure: preTail,
    claim,
    prepared,
    corridor,
    config: {
      mechanicalArgs,
      effectConfig,
      corridor: {
        missionId,
        contractHash: corridor.contractHash,
        journal: corridor.journal,
      },
      atIso: TAIL_AT,
      now: TAIL_NOW,
    },
  };
}

async function supersedeCurrentTailOwner({ demaHome, transactionId }, deadPid) {
  const verified = await readVerifiedTransactionHash({ demaHome, transactionId });
  assert.equal(verified.ok, true, verified.reason);
  const current = await inspectClosureOwnership({ demaHome, transactionId });
  assert.equal(current.state, "PRESENT");
  const identity = await probeProcessIdentity(process.pid);
  const body = {
    schema: MISSION_CLOSURE_OWNERSHIP_SCHEMA,
    domain: MISSION_CLOSURE_OWNERSHIP_DOMAIN,
    transaction_id: transactionId,
    transaction_hash: verified.transaction_hash,
    owner_instance_id: `c4d-tail-successor-${deadPid}`,
    pid: deadPid,
    process_start_identity: "1",
    boot_identity_hash: identity.boot_identity_hash,
    acquired_at_iso: TAIL_AT,
    predecessor_claim_hash: current.claim.claim_hash,
    claim_kind: CLAIM_KIND_TAKEOVER,
  };
  const claim = {
    ...body,
    claim_hash: deriveClaimHash({ ...body, claim_hash: null }),
  };
  writeFileSync(
    join(_internal.ownershipDir(demaHome, transactionId), `current.gen${current.generation + 1}`),
    JSON.stringify(claim, null, 2),
  );
}

function runFixtureEvidenceTail(fixture, onBoundary) {
  return runOwnedCorridorEvidenceTail({
    mechanical: fixture.mechanical,
    home: fixture.demaHome,
    transactionId: fixture.transactionId,
    consentClaimHash: fixture.claim.claim_hash,
    preparedIntentHash: fixture.prepared.prepared_intent_hash,
    nowIso: TAIL_AT,
    closureResult: fixture.closure,
    contractHash: fixture.corridor.contractHash,
    journal: fixture.corridor.journal,
    buildTerminalEvent: (anchor) => ({
      state: "COMPLETE",
      at_iso: TAIL_AT,
      terminal_outcome: "COMPLETED_VERIFIED",
      requires_human: false,
      note: `C4D owned-tail fixture · seal ${fixture.closure.omega0_card.seal_head}`,
      next_command: `dema mission corridor status ${fixture.corridor.contract.mission_id}`,
      closure_transaction_id: fixture.transactionId,
      consent_claim_hash: fixture.claim.claim_hash,
      prepared_intent_hash: fixture.prepared.prepared_intent_hash,
      seal_head: fixture.closure.omega0_card.seal_head,
      ledger_head: fixture.closure.ledger_head,
      anchor_hash: anchor.anchor_hash,
    }),
    onBoundary,
  });
}

test("C4D-TAIL-03g: verification-failure undo rechecks ownership before restoring", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  try {
    await supersedeCurrentTailOwner(fixture, 999_984);
    const effect = buildRenameEffectAdapter(fixture.config.effectConfig);
    const result = await runOwnedCorridorWeld({
      mechanical: fixture.mechanical,
      effect,
      nowIso: TAIL_AT,
      closureArgs: {
        contract: { mission_id: fixture.corridor.contract.mission_id },
        contract_hash: fixture.corridor.contractHash,
        journal: fixture.corridor.journal,
        mission: fixture.config.mechanicalArgs.mission,
        lease: fixture.config.mechanicalArgs.lease,
        consent: fixture.config.mechanicalArgs.consent,
        anchorDir: fixture.config.mechanicalArgs.anchorDir,
        now: TAIL_NOW,
        omega0Card: fixture.mechanical.omega0_card,
        transactionBinding: {
          transaction_id: fixture.transactionId,
          consent_claim_hash: fixture.claim.claim_hash,
          prepared_intent_hash: fixture.prepared.prepared_intent_hash,
        },
        verifyAdmission: () => ({ admitted: false, reason: "forced_refusal" }),
        consentRegistry: buildClaimBoundConsentRegistry({
          demaHome: fixture.demaHome,
          claim: fixture.claim,
        }),
      },
    });
    assert.equal(result.terminal_outcome, "RECOVERY_REQUIRED");
    assert.equal(result.reason_detail, "verification_failure_restoration_unverified");
    assert.equal(
      existsSync(join(fixture.config.effectConfig.scopeRoot, fixture.config.effectConfig.to)),
      true,
      "a stale worker must not restore the renamed target",
    );
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

test("C4D-TAIL-05d: takeover before LEDGER_COMMITTED advances no durable tail", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  try {
    const result = await runFixtureEvidenceTail(fixture, async (boundary) => {
      if (boundary === "BEFORE_LEDGER_COMMITTED") {
        await supersedeCurrentTailOwner(fixture, 999_983);
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "LEDGER_COMMITTED");
    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.phase, "SEALED");
    assert.equal(readClosureAnchorLog({ demaHome: fixture.demaHome }).length, 0);
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

test("C4D-TAIL-05e: takeover before anchor publication publishes no anchor", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  try {
    await assert.rejects(
      () => runFixtureEvidenceTail(fixture, async (boundary) => {
        if (boundary === "AFTER_LEDGER_COMMITTED") {
          await supersedeCurrentTailOwner(fixture, 999_982);
        }
      }),
      /stale_owner|fenced|unverifiable|mismatch/i,
    );
    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.phase, "LEDGER_COMMITTED");
    assert.equal(readClosureAnchorLog({ demaHome: fixture.demaHome }).length, 0);
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

test("C4D-TAIL-05f: takeover after anchor publication appends no ANCHORED phase", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  try {
    const result = await runFixtureEvidenceTail(fixture, async (boundary) => {
      if (boundary === "AFTER_ANCHOR_PUBLISHED") {
        await supersedeCurrentTailOwner(fixture, 999_981);
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "ANCHORED");
    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.phase, "LEDGER_COMMITTED");
    assert.equal(readClosureAnchorLog({ demaHome: fixture.demaHome }).length, 1);
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

test("C4D-TAIL-06c: takeover before COMPLETE never reaches RESOLVED construction", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  const boundaries = [];
  try {
    await assert.rejects(
      () => runFixtureEvidenceTail(fixture, async (boundary) => {
        boundaries.push(boundary);
        if (boundary === "AFTER_ANCHORED") {
          await supersedeCurrentTailOwner(fixture, 999_980);
        }
      }),
      /stale_owner|fenced|unverifiable|mismatch/i,
    );
    assert.equal(boundaries.includes("BEFORE_RESOLVED"), false);
    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.phase, "ANCHORED");
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

test("C4D-TAIL-06d: takeover before RESOLVED appends no terminal C2 phase", async () => {
  const fixture = await postLedgerTailFixture({ retireOwner: false });
  try {
    const result = await runFixtureEvidenceTail(fixture, async (boundary) => {
      if (boundary === "BEFORE_RESOLVED") {
        await supersedeCurrentTailOwner(fixture, 999_979);
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, "RESOLVED");
    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.phase, "ANCHORED");
    assert.equal(state.terminal_outcome, null);
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
  }
});

function spawnTailChild({ childPath, configPath, tag, ready, go, fenced }) {
  return new Promise((resolve) => {
    const proc = spawn(
      process.execPath,
      [childPath, configPath, tag, ready, go, fenced],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, DEMA_HOME: JSON.parse(readFileSync(configPath, "utf8")).mechanicalArgs.demaHome },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let out = "";
    let err = "";
    proc.stdout.on("data", (chunk) => { out += chunk; });
    proc.stderr.on("data", (chunk) => { err += chunk; });
    const timeout = setTimeout(() => proc.kill("SIGKILL"), 45_000);
    proc.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ tag, code, signal, out, err });
    });
  });
}

test("C4D-TAIL-15: two real processes resuming one post-ledger transaction produce one tail", async () => {
  const fixture = await postLedgerTailFixture();
  const raceDir = mkdtempSync(join(tmpdir(), "c4d-tail-race-"));
  const configPath = join(fixture.demaHome, "tail-resume-config.json");
  const childPath = new URL("./fixtures/c4d-tail-resume-child.mjs", import.meta.url).pathname;
  const go = join(raceDir, "GO");
  const fencedSignal = join(raceDir, "FENCED");
  writeFileSync(configPath, `${JSON.stringify(fixture.config)}\n`);

  try {
    const children = ["A", "B"].map((tag) => {
      const ready = join(raceDir, `ready.${tag}`);
      return {
        ready,
        result: spawnTailChild({
          childPath,
          configPath,
          tag,
          ready,
          go,
          fenced: fencedSignal,
        }),
      };
    });
    await waitFor(() => children.every((child) => existsSync(child.ready)), "tail racers ready");
    writeFileSync(go, "1");
    const results = await Promise.all(children.map((child) => child.result));
    const parsed = results.map((result) => {
      let report = null;
      try { report = JSON.parse(result.out); } catch { /* classification below rejects it */ }
      return { ...result, report };
    });
    const winners = parsed.filter((result) =>
      result.code === 0 && result.signal === null && result.report?.class === "WINNER"
    );
    const fenced = parsed.filter((result) =>
      result.code === 3 && result.signal === null && result.report?.class === "FENCED"
    );

    assert.equal(
      winners.length + fenced.length,
      2,
      `both children must terminate in a declared class: ${JSON.stringify(parsed)}`,
    );
    assert.equal(winners.length, 1, "exactly one process may complete the tail");
    assert.equal(fenced.length, 1, "the loser must be fenced, not crashed");
    assert.match(fenced[0].report.reason, /ownership_held|stale_owner_fenced/);
    assert.equal(
      existsSync(`${fencedSignal}.ready`),
      true,
      "the winner may exit only after the loser's declaration crossed its durability boundary",
    );
    assert.deepEqual(
      JSON.parse(readFileSync(fencedSignal, "utf8")),
      fenced[0].report,
      "the durable fence declaration must match the loser's classified report",
    );

    const ledger = await loadCanonicalLedger({ demaHome: fixture.demaHome });
    const forTx = ledger.filter(
      (entry) => entry.canonical_body?.closure_transaction_id === fixture.transactionId,
    );
    assert.equal(forTx.length, 1, "exactly one canonical receipt for one transaction");

    const state = await replayClosureTransaction({
      demaHome: fixture.demaHome,
      transactionId: fixture.transactionId,
    });
    assert.equal(state.ok, true, state.reason);
    for (const phase of ["LEDGER_COMMITTED", "ANCHORED", "RESOLVED"]) {
      assert.equal(
        state.events.filter((event) => event.phase === phase).length,
        1,
        `${phase} must appear exactly once`,
      );
    }
    assert.deepEqual(
      state.events.map((event) => event.phase),
      [
        "PREPARED",
        "EFFECT_INTENT_PERSISTED",
        "EFFECT_APPLIED",
        "VERIFIED",
        "SEALED",
        "LEDGER_COMMITTED",
        "ANCHORED",
        "RESOLVED",
      ],
      "the one canonical tail must be complete and ordered",
    );
  } finally {
    rmSync(fixture.demaHome, { recursive: true, force: true });
    rmSync(raceDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// C4D-TAIL-14 — STOP is its own sovereign act.
//
// A later STOP is a NEW consented act under its own phrase and its own capability
// scope. It must never require the COMPLETE worker's ownership — alive or dead —
// because a corridor whose closure worker died must still be stoppable by a human.
//
// This drives the REAL production CLI in a CHILD PROCESS. `corridorFail()` calls
// `process.exit(1)`, so an in-process invocation would take the test runner down
// with it instead of failing one test. The mutation control R11 (STOP coupled to
// COMPLETE ownership) turns exactly this test red.
// ---------------------------------------------------------------------------

function walkHome(dir, base = "") {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    return statSync(full).isDirectory() ? walkHome(full, rel) : [rel];
  });
}

test("C4D-TAIL-14: an independently consented STOP needs no COMPLETE capability", async () => {
  const home = freshHome();
  const missionId = "c4d-tail-14-stop";
  try {
    const corridor = buildCheckpointCorridor(missionId);
    const dir = join(home, "missions", missionId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(dir, "contract.json"),
      `${JSON.stringify({
        schema: "bizra.dema.mission_contract.v1",
        truth_label: "PREVIEW_ONLY",
        contract: corridor.contract,
        contract_hash: corridor.contractHash,
      })}\n`,
      { mode: 0o600 },
    );
    writeFileSync(
      join(dir, "journal.jsonl"),
      `${corridor.journal.map((e) => JSON.stringify(e)).join("\n")}\n`,
      { mode: 0o600 },
    );
    assert.equal(corridor.journal.at(-1).state, "CHECKPOINT",
      "the corridor must be lawfully eligible for STOP before the act");

    const dema = (args) => {
      try {
        return {
          rc: 0,
          out: execFileSync("node", [join(REPO_ROOT, "bin/dema"), ...args], {
            encoding: "utf8", cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"],
          }),
          err: "",
        };
      } catch (err) {
        return { rc: err.status ?? 1, out: err.stdout || "", err: err.stderr || "" };
      }
    };

    const base = [
      "mission", "corridor", "stop", missionId,
      "--dema-home", home,
      "--nonce", "c4d-tail-14-nonce",
      "--expires", "2099-01-01T00:00:00.000Z",
      "--json",
    ];

    // 1 · the consent card writes nothing and names the exact required phrase
    const card = dema(base);
    assert.equal(card.rc, 0, `consent card must print cleanly: ${card.err}`);
    const offer = JSON.parse(card.out);
    assert.equal(offer.step, "CONSENT_CARD");
    assert.equal(offer.required_phrase, `GO: stop mission corridor ${missionId}`);

    // 2 · the consented STOP succeeds with NO closure ownership capability anywhere
    const stopped = dema([...base,
      "--consent", offer.required_phrase,
      "--consent-context", offer.consent_context_hash,
    ]);
    assert.equal(stopped.rc, 0,
      `STOP must not require the COMPLETE owner's capability: ${stopped.err}`);
    const result = JSON.parse(stopped.out);
    assert.equal(result.ok, true);
    assert.equal(result.state, "STOPPED");

    // 3 · exactly one durable STOPPED, and it is terminal
    const events = readFileSync(join(dir, "journal.jsonl"), "utf8")
      .trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(events.filter((e) => e.state === "STOPPED").length, 1,
      "exactly one STOPPED event may be appended");
    assert.equal(events.at(-1).state, "STOPPED", "the corridor must be terminal");

    // 4 · no ownership claim, no C2 phase, no canonical receipt, no anchor
    const paths = walkHome(home).sort();
    const closureShaped = paths.filter((p) =>
      /ownership|closure|ledger|anchor|transaction/i.test(p));
    assert.deepEqual(closureShaped, [],
      `STOP must create no closure/ownership artifact — found ${closureShaped.join(", ")}`);
    assert.deepEqual(
      paths.filter((p) => !p.startsWith("consent/nonces-v1/")),
      [
        `missions/${missionId}/.journal-index-8.claim`,
        `missions/${missionId}/contract.json`,
        `missions/${missionId}/journal.jsonl`,
      ],
      "STOP writes only its corridor journal, its index claim and its consent nonce",
    );

    // 5 · nothing internal leaks to the operator surface
    const surface = `${stopped.out}${stopped.err}`;
    assert.equal(/fencing_token|fencingToken|OWNERSHIP_CAPABILIT/i.test(surface), false,
      "no raw capability or fencing token may reach operator output");
    assert.equal(/\n\s+at .+\.js:\d+:\d+/.test(surface), false,
      "no stack trace may reach operator output");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
