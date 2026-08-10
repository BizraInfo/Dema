import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { recordConsentNonce as recordAtomic, isConsentNonceUsed as isUsedAtomic, _internal as atomicInternal } from "../packages/receipts/src/consent-nonce-registry-atomic.js";
import { recordConsentNonce as recordAggregate, isConsentNonceUsed as isUsedAggregate } from "../packages/receipts/src/consent-nonce-registry.js";
import { claimConsentNonce, LEGACY_NAMESPACES, CONSENT_NONCE_RELDIR } from "../packages/receipts/src/consent-nonce-claim.js";

/**
 * CONSENT-CUTOVER-PART-3 — the legacy consent authority is STRUCTURALLY retired.
 *
 * Part 2 removed the last production caller of the superseded consumption
 * writers. That is a CALL-GRAPH fact and it expires the moment somebody writes a
 * new call. Part 3 makes it a property of the code: the writers can no longer
 * create a consumption at all, for any caller, in any tree.
 *
 * WHAT IS RETIRED AND WHAT IS NOT.
 *
 *   RETIRED — creating new consumption. `recordConsentNonce` in both legacy
 *   modules refuses unconditionally. There is no flag, no environment variable
 *   and no privileged caller that re-enables it.
 *
 *   KEPT — reading. The superseded stores stay readable, and the canonical claim
 *   still consults them for REFUSAL, so a nonce spent under the old regime can
 *   never be re-won. History is evidence; it is not deleted, rewritten, or
 *   migrated, and no migration record is fabricated for it.
 *
 * THE ASYMMETRY THIS CLOSES. `consent-parallel-replay-authority` pinned an
 * escape that only opened in one direction: a legacy-consumed nonce was correctly
 * refused by the canonical authority, while a canonically-claimed nonce could
 * still be consumed AGAIN in the legacy store. The closed half is exactly what
 * made the open half easy to miss. With the writer retired the open half cannot
 * be reached, and the test below re-runs the experiment in BOTH directions
 * rather than asserting the repair from one side.
 */

const fresh = () => mkdtempSync(join(tmpdir(), "legacy-retired-"));
const withHome = async (fn) => {
  const home = fresh();
  try { return await fn(home); } finally { rmSync(home, { recursive: true, force: true }); }
};

const RETIRED = "legacy_consent_authority_retired";

/// Seeds a legacy consumption the way HISTORY did, by writing the bytes the old
/// regime left behind. It deliberately does NOT go through the retired writer:
/// a fixture that needed the writer alive would make retirement untestable, and
/// the evidence that matters is the file on disk, not the API that made it.
function seedHistoricalLegacyConsumption(home, nonce) {
  const dir = atomicInternal.paths(home).dir;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    atomicInternal.paths(home).entry(nonce),
    JSON.stringify(atomicInternal.buildEntry({
      actionType: "C3_LOCAL_WRITE",
      targetHash: "t".repeat(64),
      consumedAtIso: "2026-01-01T00:00:00.000Z",
      consentProofHash: "c".repeat(64),
    })),
    { mode: 0o600 },
  );
}

test("LCA · the writers cannot create consumption, for any caller", async (t) => {
  await t.test("LCA-01: the atomic writer refuses on a FRESH home and writes nothing", async () => {
    await withHome(async (home) => {
      const r = await recordAtomic({
        nonce: "lca-n1", actionType: "C3_LOCAL_WRITE",
        targetHash: "t".repeat(64), consentProofHash: "c".repeat(64), demaHome: home,
      });
      assert.equal(r.recorded, false);
      assert.equal(r.error, RETIRED);
      // A fresh home is the case that would betray a writer still working: there
      // is nothing to collide with, so a refusal here can only be structural.
      assert.equal(existsSync(atomicInternal.paths(home).dir), false, "the retired writer created no store");

      // And the reader FAILS CLOSED on an absent directory — a never-initialised
      // store is indistinguishable from an erased one, so it reports USED. That
      // is shipped behaviour, not a consequence of retirement, and it is why the
      // corridor's disk adapter used to create this directory eagerly: without
      // it, every first closure on a fresh home was refused. Part 2 dropped that
      // workaround safely because the adapter no longer reads this store at all —
      // the canonical claim probes the legacy namespaces itself and does
      // distinguish absent from unreadable (proved by LCA-10 and LCA-12).
      assert.equal(await isUsedAtomic({ nonce: "lca-n1", demaHome: home }), true,
        "the atomic legacy reader fails closed on an absent store");
    });
  });

  await t.test("LCA-02: the aggregate writer refuses on a FRESH home and writes nothing", async () => {
    await withHome(async (home) => {
      const r = await recordAggregate({
        nonce: "lca-n2", actionType: "C3_LOCAL_WRITE",
        targetHash: "t".repeat(64), consentProofHash: "c".repeat(64), demaHome: home,
      });
      assert.equal(r.recorded, false);
      assert.equal(r.error, RETIRED);
      assert.equal(existsSync(join(home, LEGACY_NAMESPACES.attestRegistryFile)), false, "the retired writer created no registry file");
      assert.equal(await isUsedAggregate({ nonce: "lca-n2", demaHome: home }), false);
    });
  });

  await t.test("LCA-03: repeated calls never accumulate a store", async () => {
    await withHome(async (home) => {
      for (let i = 0; i < 5; i += 1) {
        await recordAtomic({ nonce: `lca-loop-${i}`, demaHome: home, targetHash: "t".repeat(64), consentProofHash: "c".repeat(64) });
      }
      assert.equal(existsSync(atomicInternal.paths(home).dir), false);
    });
  });
});

test("LCA · reading history still works — retirement is not deletion", async (t) => {
  await t.test("LCA-04: a historically consumed nonce still reads as used", async () => {
    await withHome(async (home) => {
      seedHistoricalLegacyConsumption(home, "lca-hist");
      assert.equal(await isUsedAtomic({ nonce: "lca-hist", demaHome: home }), true,
        "the superseded store must remain readable as refusal evidence");
    });
  });

  await t.test("LCA-05: the historical bytes are left exactly as found", async () => {
    await withHome(async (home) => {
      seedHistoricalLegacyConsumption(home, "lca-untouched");
      const path = atomicInternal.paths(home).entry("lca-untouched");
      const before = readFileSync(path, "utf8");
      await recordAtomic({ nonce: "lca-untouched", demaHome: home, targetHash: "t".repeat(64), consentProofHash: "c".repeat(64) });
      assert.equal(readFileSync(path, "utf8"), before, "a retired writer must not rewrite history either");
    });
  });
});

test("LCA · the bidirectional replay experiment, re-run", async (t) => {
  await t.test("LCA-10: legacy-first — the canonical authority still REFUSES a legacy-consumed nonce", async () => {
    await withHome(async (home) => {
      seedHistoricalLegacyConsumption(home, "lca-legacy-first");
      const r = await claimConsentNonce({ nonce: "lca-legacy-first", demaHome: home, transactionId: "tx-1" });
      assert.equal(r.claimed, false, "history must keep refusing");
      assert.equal(r.reason, "consent_nonce_legacy_consumed");
      // The direction that was already closed must STAY closed. A repair that
      // silently opened it would look like progress in the other direction.
      assert.equal(existsSync(join(home, CONSENT_NONCE_RELDIR)), false, "a refused claim creates no canonical record");
    });
  });

  await t.test("LCA-11: canonical-first — the legacy authority can no longer consume the same nonce", async () => {
    await withHome(async (home) => {
      const first = await claimConsentNonce({ nonce: "lca-canon-first", demaHome: home, transactionId: "tx-1" });
      assert.equal(first.claimed, true, "the canonical authority claims it");

      // THE PINNED DEFECT, re-run. This previously succeeded — the same nonce was
      // consumed a SECOND time in the legacy store while the canonical claim held
      // it, which is what made the escape asymmetric.
      const legacy = await recordAtomic({
        nonce: "lca-canon-first", demaHome: home,
        targetHash: "t".repeat(64), consentProofHash: "c".repeat(64),
      });
      assert.equal(legacy.recorded, false, "the legacy authority must no longer be able to consume anything");
      assert.equal(legacy.error, RETIRED);
      assert.equal(existsSync(atomicInternal.paths(home).dir), false, "and must leave no second consumption record");
    });
  });

  await t.test("LCA-12: the escape is now closed in BOTH directions", async () => {
    await withHome(async (home) => {
      // Direction A: legacy then canonical → refused (proved in LCA-10).
      seedHistoricalLegacyConsumption(home, "lca-both-a");
      assert.equal((await claimConsentNonce({ nonce: "lca-both-a", demaHome: home, transactionId: "t" })).claimed, false);

      // Direction B: canonical then legacy → impossible, not merely refused.
      assert.equal((await claimConsentNonce({ nonce: "lca-both-b", demaHome: home, transactionId: "t" })).claimed, true);
      assert.equal((await recordAtomic({ nonce: "lca-both-b", demaHome: home, targetHash: "t".repeat(64), consentProofHash: "c".repeat(64) })).recorded, false);

      // POSITIVE CONTROL. If the canonical authority had ALSO been broken by this
      // change, every assertion above would pass vacuously. A fresh nonce must
      // still be claimable, and exactly once.
      assert.equal((await claimConsentNonce({ nonce: "lca-control", demaHome: home, transactionId: "t" })).claimed, true);
      assert.equal((await claimConsentNonce({ nonce: "lca-control", demaHome: home, transactionId: "other" })).claimed, false);
      assert.equal(readdirSync(join(home, CONSENT_NONCE_RELDIR)).length, 2, "two canonical claims: lca-both-b and lca-control");
    });
  });
});
