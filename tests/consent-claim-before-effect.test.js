import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCorridorClosure, resumeCorridorClosure } from "../packages/mission/src/mission-corridor-closure.js";
import { buildDiskConsentRegistry } from "../packages/mission/src/corridor-closure-gatherer.js";
import { CONSENT_NONCE_RELDIR } from "../packages/receipts/src/consent-nonce-claim.js";

/**
 * CONSENT-CUTOVER-PART-2 — the weld's consent authority is ONE committed
 * decision, never check-then-act.
 *
 * THE DEFECT. The kernel asked `registry.has(nonce)`, performed the entire
 * Omega0 transaction — the real world effect — and only then called
 * `registry.add(nonce)`. Between the question and the commitment sits every
 * durable act the corridor exists to authorise. Two missions holding the same
 * nonce both answered "unused", both performed the effect, and the loser
 * discovered it had spent unowned authority only when its `add` threw. The
 * authority arbitrated the RECORD after the fact; it never arbitrated the ACT.
 *
 * That the injected contract was satisfied by a plain `new Set()` is the tell:
 * a Set can express "was it there" and "put it there", and cannot express
 * "commit exclusively, and tell me whether I am the holder". The shape was the
 * defect, so replacing the writer underneath `has`/`add` could not have fixed
 * it.
 *
 * THE LAW. One call. `claim(key)` commits, and the operation proceeds from that
 * committed authority:
 *
 *   { granted: true,  consumed: false }  a fresh exclusive win — proceed
 *   { granted: true,  consumed: false }  the exact holder re-entering — recover
 *   { granted: false, consumed: true  }  someone else holds it — refuse, act never
 *
 * `consumed` is what a resume must read: it answers "did this authority already
 * get spent", which is the durability signal that stops a restart replaying a
 * real-world act.
 *
 * BOUNDARY. The race below is in-process and concurrent over a REAL O_EXCL
 * nonce store on disk, which is what makes it deterministic: both missions
 * reach the authority before either commits, every time. It is not a
 * cross-process race and does not claim to be one; the filesystem arbitration
 * it depends on is the same in both cases.
 */

const sha = (s) => createHash("sha256").update(s).digest("hex");

/// Each mission gets its OWN world and its OWN counter.
///
/// Two missions must not share a world here: the second apply would throw, and
/// "collided in one world" is a different finding from "reached an effect it was
/// never entitled to attempt". Per-mission counters state the law directly — the
/// refused mission touched the world ZERO times.
///
/// Counting every `apply` deliberately includes Omega0's reversibility probe.
/// The probe is undone, but it is still a real touch of the world, and a mission
/// with no authority must not get that far either. Asserting `=== 0` for the
/// loser also avoids pinning how many times a WINNER applies, which is Omega0's
/// business and not this contract's.
function effectAdapter() {
  const stats = { applies: 0 };
  let state = { "a.txt": "A", "b.txt": "B" };
  const snapshots = [];
  const adapter = {
    propose: () => [{ op: "rename", from: "a.txt", to: "a.moved.txt" }],
    manifest: () => Object.entries(state)
      .map(([p, c]) => ({ path: p, content_id: sha(c) }))
      .sort((x, y) => x.path.localeCompare(y.path)),
    apply(plan) {
      stats.applies += 1;
      snapshots.push({ ...state });
      for (const op of plan) {
        state[op.to] = state[op.from];
        delete state[op.from];
      }
      return { applied: plan };
    },
    undo() { state = snapshots.pop() ?? state; return true; },
    anchorState: () => ({ anchorLog: [], observed: null }),
  };
  return { stats, adapter };
}

const NONCE = "race-nonce-0001";
const LEASE = { lease_id: "L1", scope_root: "/scope", expires_at: 9_999, budget_acts: 1 };
const MISSION = { objective: "cutover probe", root: "/scope" };

const params = ({ missionId, effect, consentRegistry, nonce = NONCE }) => ({
  contract: { mission_id: missionId },
  contract_hash: "sha256:" + "0".repeat(64),
  journal: [],
  mission: MISSION,
  lease: LEASE,
  consent: { by: "operator", ref: "consent-1", nonce },
  anchorDir: "/anchor-outside",
  effect,
  now: 1_000,
  appendReceipt: async () => ({ ok: true, head: "sha256:" + "1".repeat(64) }),
  verifyAdmission: () => ({ admitted: true, self_verifiable: true }),
  consentRegistry,
});

const withHome = async (fn) => {
  const home = mkdtempSync(join(tmpdir(), "consent-cutover-"));
  try { return await fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

const diskRegistry = (home) => buildDiskConsentRegistry({
  demaHome: home,
  targetHash: sha("target"),
  consentProofHash: sha("proof"),
});

const nonceEntries = (home) => {
  try { return readdirSync(join(home, CONSENT_NONCE_RELDIR)); } catch { return []; }
};

describe("CBE · consent is claimed before the effect, never recorded after it", () => {

  /// One nonce, two concurrent missions, a real O_EXCL store. Returns each
  /// mission's result paired with its own world counter.
  const race = async (home, { nonceA = NONCE, nonceB = NONCE } = {}) => {
    const registry = diskRegistry(home);
    const a = effectAdapter();
    const b = effectAdapter();
    const [ra, rb] = await Promise.all([
      runCorridorClosure(params({ missionId: "race-A", effect: a.adapter, consentRegistry: registry, nonce: nonceA })),
      runCorridorClosure(params({ missionId: "race-B", effect: b.adapter, consentRegistry: registry, nonce: nonceB })),
    ]);
    return [{ result: ra, stats: a.stats }, { result: rb, stats: b.stats }];
  };

  test("CBE-01: two missions racing for one nonce yield exactly one winner, and the loser touches nothing", async () => {
    await withHome(async (home) => {
      const runs = await race(home);
      const won = runs.filter((r) => r.result.state === "COMPLETE");
      const lost = runs.filter((r) => r.result.state !== "COMPLETE");
      assert.equal(won.length, 1, "exactly one mission may complete on one nonce");
      assert.equal(lost.length, 1);
      assert.equal(lost[0].stats.applies, 0, "a mission that loses the consent race must perform NO world effect");
      assert.ok(won[0].stats.applies > 0, "the winner must actually have acted");
    });
  });

  test("CBE-02: the loser refuses on consent, not on a failed record", async () => {
    await withHome(async (home) => {
      const runs = await race(home);
      const loser = runs.find((r) => r.result.state !== "COMPLETE").result;
      assert.equal(loser.terminal_outcome, "REFUSED_POLICY");
      assert.equal(loser.reason_detail, "consent_already_consumed");
      // A refusal terminal carries no `effect_performed` at all — that is the
      // shipped shape on this path both before and after the cutover, so the
      // assertion is that it never claims an effect, not that it carries a
      // field it has never carried. CBE-01 proves the world was untouched.
      assert.notEqual(loser.effect_performed, true, "the refused mission must not report an effect");
    });
  });

  test("CBE-03: a lost race leaves exactly one authority record — the winner's", async () => {
    await withHome(async (home) => {
      await race(home);
      assert.equal(nonceEntries(home).length, 1, "one nonce, one record");
    });
  });

  test("CBE-04: POSITIVE CONTROL — two missions on DIFFERENT nonces both complete and both act", async () => {
    await withHome(async (home) => {
      const runs = await race(home, { nonceA: "solo-nonce-a", nonceB: "solo-nonce-b" });
      assert.equal(runs.filter((r) => r.result.state === "COMPLETE").length, 2, "distinct nonces must not block each other");
      for (const r of runs) assert.ok(r.stats.applies > 0, "each authorised mission must act");
      assert.equal(nonceEntries(home).length, 2);
    });
  });

  test("CBE-05: a replayed nonce never reaches the effect at all", async () => {
    await withHome(async (home) => {
      const registry = diskRegistry(home);
      const one = effectAdapter();
      const first = await runCorridorClosure(params({ missionId: "first", effect: one.adapter, consentRegistry: registry }));
      assert.equal(first.state, "COMPLETE");
      assert.ok(one.stats.applies > 0);

      const two = effectAdapter();
      const second = await runCorridorClosure(params({ missionId: "second", effect: two.adapter, consentRegistry: registry }));
      assert.equal(second.terminal_outcome, "REFUSED_POLICY");
      assert.equal(two.stats.applies, 0, "a replayed nonce must not reach the effect at all");
    });
  });
});

describe("CBE · the shape itself is refused, not merely the old writer", () => {

  test("CBE-10: a has/add registry cannot satisfy the contract — single-use stays unprovable", async () => {
    const one = effectAdapter();
    const r = await runCorridorClosure(params({
      missionId: "legacy-shape", effect: one.adapter, consentRegistry: new Set(),
    }));
    assert.equal(r.terminal_outcome, "BLOCKED_MISSING_EVIDENCE");
    assert.equal(r.reason_detail, "consent_registry_absent_single_use_unprovable");
    assert.equal(one.stats.applies, 0);
  });

  test("CBE-11: an absent registry still refuses (MCW-16 preserved)", async () => {
    const one = effectAdapter();
    const p = params({ missionId: "no-registry", effect: one.adapter, consentRegistry: undefined });
    delete p.consentRegistry;
    const r = await runCorridorClosure(p);
    assert.equal(r.terminal_outcome, "BLOCKED_MISSING_EVIDENCE");
    assert.equal(one.stats.applies, 0);
  });

  test("CBE-12: a claim that refuses without saying so is not permission", async () => {
    const one = effectAdapter();
    const r = await runCorridorClosure(params({
      missionId: "mute-claim", effect: one.adapter,
      consentRegistry: { claim: async () => ({}) },
    }));
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(one.stats.applies, 0, "an ungranted claim must never reach the effect");
  });

  test("CBE-13: a claim returning a non-object is refused, never coerced", async () => {
    const one = effectAdapter();
    const r = await runCorridorClosure(params({
      missionId: "truthy-claim", effect: one.adapter,
      consentRegistry: { claim: async () => true },
    }));
    assert.notEqual(r.state, "COMPLETE");
    assert.equal(one.stats.applies, 0);
  });
});

describe("CBE · recovery semantics are preserved exactly", () => {

  test("CBE-20: an unspent authority resumes into a fresh run", async () => {
    await withHome(async (home) => {
      const one = effectAdapter();
      const r = await resumeCorridorClosure(params({
        missionId: "resume-fresh", effect: one.adapter, consentRegistry: diskRegistry(home),
      }));
      assert.equal(r.state, "COMPLETE", "nothing was consumed, so a fresh attempt is safe");
      assert.ok(one.stats.applies > 0);
    });
  });

  test("CBE-21: a spent authority resumes to RECOVERY_REQUIRED and never replays the effect", async () => {
    await withHome(async (home) => {
      const registry = diskRegistry(home);
      const one = effectAdapter();
      const first = await runCorridorClosure(params({ missionId: "spent", effect: one.adapter, consentRegistry: registry }));
      assert.equal(first.state, "COMPLETE");

      const two = effectAdapter();
      const resumed = await resumeCorridorClosure(params({ missionId: "spent", effect: two.adapter, consentRegistry: registry }));
      assert.equal(resumed.terminal_outcome, "RECOVERY_REQUIRED");
      assert.equal(resumed.reason_detail, "transaction_already_committed_no_replay");
      assert.equal(resumed.effect_performed, false);
      assert.equal(resumed.receipt_appended, false);
      assert.equal(two.stats.applies, 0, "a resume after a spent authority must not repeat the act");
    });
  });

  test("CBE-22: resume refuses a registry of the legacy shape rather than guessing", async () => {
    const one = effectAdapter();
    const r = await resumeCorridorClosure(params({
      missionId: "resume-legacy", effect: one.adapter, consentRegistry: new Set(),
    }));
    assert.equal(r.terminal_outcome, "BLOCKED_MISSING_EVIDENCE");
    assert.equal(one.stats.applies, 0, "an unprovable authority must not reach the effect on the resume path either");
  });
});
