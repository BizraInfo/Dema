// KEYCONSENT-2A · Single-use Nonce Registry kernel tests
//
// Registry on disk: $DEMA_HOME/consent/used-nonces.json
//
// ── RETIRED 2026-08-11 · consent cutover part 3 ──────────────────────────────
//
// This suite proved nine DOD criteria for `recordConsentNonce`, the aggregate
// read-modify-write consumption writer. Part 3 retired that writer: it creates
// nothing, for any caller, with no flag or privileged path that re-enables it.
// A suite that kept asserting write behaviour would have had to un-retire it.
//
// WHAT MOVED, so nothing is silently lost. The write-side criteria described a
// SECOND authority entitled to decide consent consumption, which is the thing
// canon rejects. Their properties now belong to `consent-nonce-claim.js` and are
// proved against it:
//
//   9.1 first-call / repeat-call semantics   → CNA-03, CNA-06 (consent-nonce-atomic)
//   9.3 atomic write, no leftover tmp file   → CNA-01, CNA-02 (O_EXCL, no lost update)
//   9.5 no private key material              → still true by construction; the claim
//                                              module loads no key path
//   9.6 consumed_at captured at consumption  → claimedAtIso on the canonical claim
//   9.7 file/dir modes                       → claim writes 0o600 under a 0o700 dir
//   9.8 determinism of the record bytes      → claim_hash, re-derived on every read
//                                              (NRC suite, consent-nonce-claim.test)
//
// WHAT STAYS HERE. Reading. The superseded store remains readable so the
// canonical claim can consult it for REFUSAL, and a nonce spent under the old
// regime can never be re-won. Retirement is not deletion — no history is
// removed, rewritten, or migrated, and no migration record is fabricated for it.
//
// The original write-side assertions live in git history at 8f42685^.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordConsentNonce,
  isConsentNonceUsed,
  _internal,
} from "../packages/receipts/src/consent-nonce-registry.js";

const RETIRED = "legacy_consent_authority_retired";
const FIXED_NONCE_A = "nonce-aaaa-0001";
const FIXED_NONCE_B = "nonce-bbbb-0002";

const freshHome = () => mkdtemp(join(tmpdir(), "keyconsent2a-"));
const registryPath = (home) => join(home, "consent", "used-nonces.json");

const withHome = async (fn) => {
  const home = await freshHome();
  try { return await fn(home); } finally { await rm(home, { recursive: true, force: true }); }
};

/// Seeds the store the way HISTORY left it — as bytes. Deliberately not through
/// the retired writer: a fixture that needed the writer alive would make
/// retirement untestable, and the evidence that matters is the file on disk.
async function seedHistoricalRegistry(home, entries) {
  await mkdir(join(home, "consent"), { recursive: true, mode: 0o700 });
  await writeFile(registryPath(home), JSON.stringify(entries), { mode: 0o600 });
}

const historicalEntry = (consumedAtIso = "2026-01-01T00:00:00.000Z") => ({
  action_type: "C3_LOCAL_WRITE",
  target_hash: "t".repeat(64),
  consumed_at_iso: consumedAtIso,
  consent_proof_hash: "c".repeat(64),
});

describe("consent-nonce-registry · the writer is structurally retired", () => {
  it("KC2A-R1: recording refuses on a FRESH home and creates no registry", async () => {
    await withHome(async (home) => {
      const r = await recordConsentNonce({
        nonce: FIXED_NONCE_A, actionType: "C3_LOCAL_WRITE",
        targetHash: "t".repeat(64), consentProofHash: "c".repeat(64), demaHome: home,
      });
      assert.equal(r.recorded, false);
      assert.equal(r.error, RETIRED);
      assert.equal(r.superseded_by, "packages/receipts/src/consent-nonce-claim.js");
      // A fresh home is the case that would betray a writer still working: there
      // is nothing to collide with, so a refusal here can only be structural.
      await assert.rejects(() => readFile(registryPath(home)), /ENOENT/);
    });
  });

  it("KC2A-R2: no argument shape re-enables it", async () => {
    await withHome(async (home) => {
      const shapes = [
        {},
        { nonce: FIXED_NONCE_A, demaHome: home },
        { nonce: FIXED_NONCE_A, demaHome: home, consumedAtIso: "2026-01-01T00:00:00.000Z" },
        { nonce: FIXED_NONCE_A, actionType: "X", targetHash: "t".repeat(64), consentProofHash: "c".repeat(64), demaHome: home, force: true },
      ];
      for (const args of shapes) {
        const r = await recordConsentNonce(args);
        assert.equal(r.recorded, false, `re-enabled by ${JSON.stringify(Object.keys(args))}`);
        assert.equal(r.error, RETIRED);
      }
      assert.deepEqual(await readdir(home), [], "not one of those shapes created anything");
    });
  });

  it("KC2A-R3: it does not rewrite or delete history it finds", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      const before = await readFile(registryPath(home), "utf8");
      await recordConsentNonce({
        nonce: FIXED_NONCE_B, actionType: "C3_LOCAL_WRITE",
        targetHash: "t".repeat(64), consentProofHash: "c".repeat(64), demaHome: home,
      });
      assert.equal(await readFile(registryPath(home), "utf8"), before,
        "a retired writer must not touch the historical record either");
    });
  });
});

describe("consent-nonce-registry · isConsentNonceUsed (DOD 9.4) — reading is untouched", () => {
  it("DOD-9.4 missing registry file → false (reader is pure/stateless)", async () => {
    await withHome(async (home) => {
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A, demaHome: home }), false);
    });
  });

  it("DOD-9.4 nonce on the list → true", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A, demaHome: home }), true,
        "the superseded store must remain readable as refusal evidence");
    });
  });

  it("DOD-9.4 nonce NOT on the list (registry exists with other nonces) → false", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_B, demaHome: home }), false,
        "a populated registry must not read as universally consumed");
    });
  });

  it("DOD-9.9 an orphan tmp file is harmless; canonical state is preserved", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      await writeFile(join(home, "consent", `used-nonces.json.tmp.${process.pid}.simcrash`), "{ partial", "utf8");
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A, demaHome: home }), true);
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_B, demaHome: home }), false);
    });
  });

  it("DOD-9.9 consent dir exists but used-nonces.json is missing → false (not throw)", async () => {
    await withHome(async (home) => {
      await mkdir(join(home, "consent"), { recursive: true, mode: 0o700 });
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A, demaHome: home }), false);
    });
  });
});

describe("consent-nonce-registry · DOD 9.2 home resolution", () => {
  it("DOD-9.2 explicit demaHome arg is used (never touches ~/.dema)", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      assert.equal(_internal.paths(home).file, registryPath(home));
      assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A, demaHome: home }), true);
    });
  });

  it("DOD-9.2 falls back to process.env.DEMA_HOME when demaHome not supplied", async () => {
    await withHome(async (home) => {
      await seedHistoricalRegistry(home, { [FIXED_NONCE_A]: historicalEntry() });
      const prior = process.env.DEMA_HOME;
      process.env.DEMA_HOME = home;
      try {
        assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_A }), true);
        // NEGATIVE CONTROL: without the fallback working, the assertion above
        // could pass from an unrelated ambient home.
        assert.equal(await isConsentNonceUsed({ nonce: FIXED_NONCE_B }), false);
      } finally {
        if (prior === undefined) delete process.env.DEMA_HOME;
        else process.env.DEMA_HOME = prior;
      }
    });
  });
});
