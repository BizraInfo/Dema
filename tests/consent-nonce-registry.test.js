// KEYCONSENT-2A · Single-use Nonce Registry kernel tests
//
// Covers all 9 DOD criteria from docs/security/KEYCONSENT_2_PREFLIGHT.md §9.
// Pure kernel; no CLI; no integration with existing gates; no network.
//
// Registry on disk:        $DEMA_HOME/consent/used-nonces.json
// Atomic write pattern:    tmp + rename (mirrors local-index-writer.js)
// File mode after rename:  0o600
// Containing dir mode:     0o700 on first create
//
// Reuses:
// - sha256, stableStringify   packages/consent/src/consent-common.js
// - DEMA_HOME resolution      packages/receipts/src/authorship-key-store.js

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  mkdir,
  stat,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordConsentNonce,
  isConsentNonceUsed,
} from "../packages/receipts/src/consent-nonce-registry.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const FIXED_NONCE_A = "deadbeef".repeat(8); // 64 hex chars
const FIXED_NONCE_B = "cafebabe".repeat(8);
const FIXED_NONCE_C = "feedface".repeat(8);
const FIXED_ACTION_TYPE = "MINT_VERDICT_RECEIPT";
const FIXED_TARGET_HASH = "a".repeat(64);
const FIXED_CONSENT_PROOF_HASH = "b".repeat(64);
const FIXED_CONSUMED_AT = "2026-05-30T08:00:00.000Z";
const FIXED_CONSUMED_AT_2 = "2026-05-30T08:01:00.000Z";

async function freshHome() {
  return await mkdtemp(join(tmpdir(), "dema-consent-nonce-registry-test-"));
}

function registryPath(home) {
  return join(home, "consent", "used-nonces.json");
}

describe("consent-nonce-registry · recordConsentNonce (DOD 9.1, 9.3, 9.5, 9.6, 9.7, 9.8)", () => {
  it("DOD-9.1 first call with a given nonce → {recorded: true, registry_entry_hash}", async () => {
    const home = await freshHome();
    try {
      const r = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      assert.equal(r.recorded, true);
      assert.ok(
        /^[a-f0-9]{64}$/.test(r.registry_entry_hash),
        "registry_entry_hash must be sha256 hex",
      );
      // Expected hash: sha256(stableStringify({nonce, action_type, target_hash, consumed_at_iso, consent_proof_hash}))
      const expected = sha256(
        stableStringify({
          nonce: FIXED_NONCE_A,
          action_type: FIXED_ACTION_TYPE,
          target_hash: FIXED_TARGET_HASH,
          consumed_at_iso: FIXED_CONSUMED_AT,
          consent_proof_hash: FIXED_CONSENT_PROOF_HASH,
        }),
      );
      assert.equal(r.registry_entry_hash, expected);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.1 repeat call with the SAME nonce → {recorded:false, error, existing_entry}; existing entry NOT overwritten", async () => {
    const home = await freshHome();
    try {
      const first = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      assert.equal(first.recorded, true);

      // Second call deliberately uses DIFFERENT action_type / target / proof
      // hash / timestamp. The original record must NOT be overwritten.
      const second = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: "DIFFERENT_ACTION",
        targetHash: "f".repeat(64),
        consentProofHash: "e".repeat(64),
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT_2,
      });
      assert.equal(second.recorded, false);
      assert.equal(second.error, "consent_nonce_already_used");
      assert.ok(second.existing_entry, "existing_entry must be returned");
      assert.equal(second.existing_entry.action_type, FIXED_ACTION_TYPE);
      assert.equal(second.existing_entry.target_hash, FIXED_TARGET_HASH);
      assert.equal(second.existing_entry.consumed_at_iso, FIXED_CONSUMED_AT);
      assert.equal(
        second.existing_entry.consent_proof_hash,
        FIXED_CONSENT_PROOF_HASH,
      );

      // Verify on disk the original record stands.
      const disk = JSON.parse(await readFile(registryPath(home), "utf8"));
      assert.equal(disk[FIXED_NONCE_A].action_type, FIXED_ACTION_TYPE);
      assert.equal(disk[FIXED_NONCE_A].target_hash, FIXED_TARGET_HASH);
      assert.equal(disk[FIXED_NONCE_A].consumed_at_iso, FIXED_CONSUMED_AT);
      assert.equal(
        disk[FIXED_NONCE_A].consent_proof_hash,
        FIXED_CONSENT_PROOF_HASH,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.1 second distinct nonce is appended; both records co-exist", async () => {
    const home = await freshHome();
    try {
      const a = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const b = await recordConsentNonce({
        nonce: FIXED_NONCE_B,
        actionType: "MARK_URP_SHAREABLE",
        targetHash: "c".repeat(64),
        consentProofHash: "d".repeat(64),
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT_2,
      });
      assert.equal(a.recorded, true);
      assert.equal(b.recorded, true);
      const disk = JSON.parse(await readFile(registryPath(home), "utf8"));
      assert.ok(disk[FIXED_NONCE_A]);
      assert.ok(disk[FIXED_NONCE_B]);
      assert.equal(Object.keys(disk).length, 2);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.3 atomic write: registry directory is created with mode 0o700 on first write", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const dirStat = await stat(join(home, "consent"));
      assert.equal(
        dirStat.mode & 0o777,
        0o700,
        "consent dir mode must be 0o700",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.3 atomic write: no leftover tmp file in consent dir after a successful write", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const entries = await readdir(join(home, "consent"));
      const tmpLeft = entries.filter((n) => n.includes(".tmp."));
      assert.deepEqual(tmpLeft, [], "no .tmp.* artifacts must remain");
      // canonical file must exist
      assert.ok(entries.includes("used-nonces.json"));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.5 no private key material is read, derived, embedded, or referenced", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const raw = await readFile(registryPath(home), "utf8");
      assert.ok(
        !raw.includes("BEGIN PRIVATE KEY"),
        "registry must NOT contain BEGIN PRIVATE KEY marker",
      );
      assert.ok(
        !raw.includes("PRIVATE KEY"),
        "registry must NOT contain any PRIVATE KEY marker",
      );
      assert.ok(
        !raw.includes("BEGIN"),
        "registry must NOT contain BEGIN markers at all",
      );
      // Entry whitelist: only nonce + action_type + target_hash + consumed_at_iso + consent_proof_hash
      const disk = JSON.parse(raw);
      const entry = disk[FIXED_NONCE_A];
      assert.deepEqual(Object.keys(entry).sort(), [
        "action_type",
        "consent_proof_hash",
        "consumed_at_iso",
        "target_hash",
      ]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.6 consumed_at_iso is captured at consumption time and stored in the registry record", async () => {
    const home = await freshHome();
    try {
      const r = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      assert.equal(r.recorded, true);
      const disk = JSON.parse(await readFile(registryPath(home), "utf8"));
      assert.equal(disk[FIXED_NONCE_A].consumed_at_iso, FIXED_CONSUMED_AT);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.6 omitted consumedAtIso → registry captures a real ISO timestamp at write time", async () => {
    const home = await freshHome();
    try {
      const before = new Date().toISOString();
      const r = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
      });
      const after = new Date().toISOString();
      assert.equal(r.recorded, true);
      const disk = JSON.parse(await readFile(registryPath(home), "utf8"));
      const ts = disk[FIXED_NONCE_A].consumed_at_iso;
      assert.ok(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(ts),
        "consumed_at_iso must be a valid ISO-8601 UTC timestamp",
      );
      // sanity bound — generated timestamp falls in [before, after]
      assert.ok(ts >= before && ts <= after);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.7 registry file mode is 0o600 after first write", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const s = await stat(registryPath(home));
      assert.equal(
        s.mode & 0o777,
        0o600,
        "registry mode must be 0o600 after first write",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.7 registry file mode is 0o600 after a subsequent rewrite (second nonce added)", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      await recordConsentNonce({
        nonce: FIXED_NONCE_B,
        actionType: "MARK_URP_SHAREABLE",
        targetHash: "c".repeat(64),
        consentProofHash: "d".repeat(64),
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT_2,
      });
      const s = await stat(registryPath(home));
      assert.equal(
        s.mode & 0o777,
        0o600,
        "registry mode must be 0o600 after rewrite",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.8 determinism: same inputs + injected consumedAtIso → byte-identical registry bytes", async () => {
    const home1 = await freshHome();
    const home2 = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home1,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home2,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const bytes1 = await readFile(registryPath(home1));
      const bytes2 = await readFile(registryPath(home2));
      assert.ok(
        bytes1.equals(bytes2),
        "byte-identical registry bytes across runs with identical inputs",
      );
    } finally {
      await rm(home1, { recursive: true, force: true });
      await rm(home2, { recursive: true, force: true });
    }
  });

  it("DOD-9.8 determinism: registry_entry_hash matches sha256(stableStringify(record)) and is stable across runs", async () => {
    const home1 = await freshHome();
    const home2 = await freshHome();
    try {
      const a = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home1,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const b = await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home2,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      assert.equal(a.registry_entry_hash, b.registry_entry_hash);
    } finally {
      await rm(home1, { recursive: true, force: true });
      await rm(home2, { recursive: true, force: true });
    }
  });
});

describe("consent-nonce-registry · isConsentNonceUsed (DOD 9.4)", () => {
  it("DOD-9.4 missing registry file → false (reader is pure/stateless)", async () => {
    const home = await freshHome();
    try {
      const used = await isConsentNonceUsed({
        nonce: FIXED_NONCE_A,
        demaHome: home,
      });
      assert.equal(used, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.4 nonce on the list → true", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const used = await isConsentNonceUsed({
        nonce: FIXED_NONCE_A,
        demaHome: home,
      });
      assert.equal(used, true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.4 nonce NOT on the list (registry exists with other nonces) → false", async () => {
    const home = await freshHome();
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const used = await isConsentNonceUsed({
        nonce: FIXED_NONCE_C,
        demaHome: home,
      });
      assert.equal(used, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("consent-nonce-registry · DOD 9.2 DEMA_HOME resolution + 9.9 crash safety", () => {
  it("DOD-9.2 explicit demaHome arg is used (never touches ~/.dema)", async () => {
    const home = await freshHome();
    try {
      // Stash + null out env so the resolver MUST use the arg.
      const prev = process.env.DEMA_HOME;
      delete process.env.DEMA_HOME;
      try {
        await recordConsentNonce({
          nonce: FIXED_NONCE_A,
          actionType: FIXED_ACTION_TYPE,
          targetHash: FIXED_TARGET_HASH,
          consentProofHash: FIXED_CONSENT_PROOF_HASH,
          demaHome: home,
          consumedAtIso: FIXED_CONSUMED_AT,
        });
        const s = await stat(registryPath(home));
        assert.ok(
          s.isFile(),
          "registry must be written under the injected demaHome",
        );
      } finally {
        if (prev !== undefined) process.env.DEMA_HOME = prev;
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.2 falls back to process.env.DEMA_HOME when demaHome not supplied", async () => {
    const home = await freshHome();
    const prev = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const s = await stat(registryPath(home));
      assert.ok(s.isFile(), "env-resolved demaHome must back the registry");
      const used = await isConsentNonceUsed({ nonce: FIXED_NONCE_A });
      assert.equal(used, true);
    } finally {
      if (prev === undefined) delete process.env.DEMA_HOME;
      else process.env.DEMA_HOME = prev;
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.9 crash safety: orphan *.tmp.* file is harmless; canonical state is preserved", async () => {
    const home = await freshHome();
    try {
      // First, record a real nonce so canonical state exists.
      await recordConsentNonce({
        nonce: FIXED_NONCE_A,
        actionType: FIXED_ACTION_TYPE,
        targetHash: FIXED_TARGET_HASH,
        consentProofHash: FIXED_CONSENT_PROOF_HASH,
        demaHome: home,
        consumedAtIso: FIXED_CONSUMED_AT,
      });
      const canonicalBefore = await readFile(registryPath(home));

      // Simulate a crash: writer wrote tmp but never renamed.
      const tmpPath = join(
        home,
        "consent",
        `used-nonces.json.tmp.${process.pid}.simcrash`,
      );
      await writeFile(tmpPath, JSON.stringify({ ghost: "data" }), {
        mode: 0o600,
      });

      // Reader: nonce-A is still used; orphan tmp is invisible.
      const usedA = await isConsentNonceUsed({
        nonce: FIXED_NONCE_A,
        demaHome: home,
      });
      assert.equal(usedA, true);

      const usedC = await isConsentNonceUsed({
        nonce: FIXED_NONCE_C,
        demaHome: home,
      });
      assert.equal(usedC, false);

      // Canonical bytes unchanged.
      const canonicalAfter = await readFile(registryPath(home));
      assert.ok(canonicalBefore.equals(canonicalAfter));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-9.9 reading when consent dir exists but used-nonces.json is missing → false (not throw)", async () => {
    const home = await freshHome();
    try {
      // Create just the dir, no registry file.
      await mkdir(join(home, "consent"), { recursive: true, mode: 0o700 });
      const used = await isConsentNonceUsed({
        nonce: FIXED_NONCE_A,
        demaHome: home,
      });
      assert.equal(used, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
