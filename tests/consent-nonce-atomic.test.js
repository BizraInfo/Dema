import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  recordConsentNonce,
  isConsentNonceUsed,
} from "../packages/receipts/src/consent-nonce-registry.js";

// CONSENT-NONCE-ATOMIC-1A proof contract (audit 2026-07-19 finding rank 1).
//
// Old defect: consumption was a shared-JSON read-modify-write — concurrent
// presentations of the SAME nonce could all read "unused" and all succeed
// (frozen 07-16 audit: 20/20 double-consumptions), and racing DIFFERENT nonces
// lost updates. Corrupt registry state degraded to {} (appeared unused).
//
// New authority: one exclusive-create (`wx`) file per nonce under
// $DEMA_HOME/consent/used-nonces.d/ — first creator wins at the kernel level.
// The legacy used-nonces.json stays as a written MIRROR for existing readers.

const HOME = () => mkdtempSync(join(tmpdir(), "nonce-atomic-"));
const NONCE = (c) => String(c).repeat(64).slice(0, 64);

const BASE = {
  actionType: "MINT_VERDICT_RECEIPT",
  targetHash: "t".repeat(64),
  consentProofHash: "p".repeat(64),
  consumedAtIso: "2026-07-19T00:00:00.000Z",
};

test("T1 100 concurrent presentations of one nonce: exactly one success", async () => {
  const demaHome = HOME();
  const results = await Promise.all(
    Array.from({ length: 100 }, () =>
      recordConsentNonce({ ...BASE, nonce: NONCE("a"), demaHome }),
    ),
  );
  const wins = results.filter((r) => r.recorded === true);
  const replays = results.filter(
    (r) => r.recorded === false && r.error === "consent_nonce_already_used",
  );
  assert.equal(wins.length, 1, `expected 1 win, got ${wins.length}`);
  assert.equal(replays.length, 99);
  assert.match(wins[0].registry_entry_hash, /^[0-9a-f]{64}$/);
});

test("T2 concurrent DIFFERENT nonces are all durable (no lost update)", async () => {
  const demaHome = HOME();
  const nonces = "0123456789abcdefghij".split("").map((c) => NONCE(c));
  const results = await Promise.all(
    nonces.map((nonce) => recordConsentNonce({ ...BASE, nonce, demaHome })),
  );
  assert.ok(results.every((r) => r.recorded === true), "all should win their own nonce");
  for (const nonce of nonces) {
    assert.equal(
      await isConsentNonceUsed({ nonce, demaHome }),
      true,
      `nonce ${nonce.slice(0, 4)}… must be durably consumed`,
    );
  }
});

test("T3 corrupt per-nonce state fails closed, never reads as unused", async () => {
  const demaHome = HOME();
  const dir = join(demaHome, "consent", "used-nonces.d");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${NONCE("b")}.json`), "not json{{{");
  const r = await recordConsentNonce({ ...BASE, nonce: NONCE("b"), demaHome });
  assert.equal(r.recorded, false);
  assert.equal(r.error, "consent_nonce_state_corrupt");
});

test("T4 legacy-registry nonce is honored as already used (upgrade compat)", async () => {
  const demaHome = HOME();
  const dir = join(demaHome, "consent");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "used-nonces.json"),
    JSON.stringify({
      [NONCE("c")]: {
        action_type: "MINT_VERDICT_RECEIPT",
        target_hash: "t".repeat(64),
        consumed_at_iso: "2026-07-01T00:00:00.000Z",
        consent_proof_hash: "p".repeat(64),
      },
    }),
  );
  const r = await recordConsentNonce({ ...BASE, nonce: NONCE("c"), demaHome });
  assert.equal(r.recorded, false);
  assert.equal(r.error, "consent_nonce_already_used");
  assert.equal(r.existing_entry.consumed_at_iso, "2026-07-01T00:00:00.000Z");
  assert.equal(await isConsentNonceUsed({ nonce: NONCE("c"), demaHome }), true);
});

test("T5 corrupt legacy registry refuses consumption (no fail-open {})", async () => {
  const demaHome = HOME();
  const dir = join(demaHome, "consent");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "used-nonces.json"), "corrupt!!");
  const r = await recordConsentNonce({ ...BASE, nonce: NONCE("d"), demaHome });
  assert.equal(r.recorded, false);
  assert.equal(r.error, "consent_nonce_registry_corrupt");
});

test("T6 path-escaping nonce is refused and creates nothing", async () => {
  const demaHome = HOME();
  const r = await recordConsentNonce({ ...BASE, nonce: "../../evil", demaHome });
  assert.equal(r.recorded, false);
  assert.equal(r.error, "consent_nonce_invalid");
  let entries = [];
  try {
    entries = readdirSync(join(demaHome, "consent", "used-nonces.d"));
  } catch {
    /* dir may not exist — also fine */
  }
  assert.deepEqual(entries, []);
});

test("T7 winner writes the legacy mirror so existing readers keep working", async () => {
  const demaHome = HOME();
  await recordConsentNonce({ ...BASE, nonce: NONCE("e"), demaHome });
  const legacy = JSON.parse(
    (await import("node:fs/promises")).readFile
      ? await (await import("node:fs/promises")).readFile(
          join(demaHome, "consent", "used-nonces.json"),
          "utf8",
        )
      : "",
  );
  assert.ok(Object.hasOwn(legacy, NONCE("e")), "mirror must carry the nonce");
});

test("T8 sequential replay contract unchanged: second call returns existing entry", async () => {
  const demaHome = HOME();
  const first = await recordConsentNonce({ ...BASE, nonce: NONCE("f"), demaHome });
  assert.equal(first.recorded, true);
  const second = await recordConsentNonce({
    ...BASE,
    nonce: NONCE("f"),
    consumedAtIso: "2026-07-19T09:09:09.000Z",
    demaHome,
  });
  assert.equal(second.recorded, false);
  assert.equal(second.error, "consent_nonce_already_used");
  assert.equal(second.existing_entry.consumed_at_iso, BASE.consumedAtIso);
});
