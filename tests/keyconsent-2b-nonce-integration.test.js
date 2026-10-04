// KEYCONSENT-2B · verdict-attest nonce-registry integration tests
//
// Wires the KEYCONSENT-2A single-use nonce registry into the
// KEYCONSENT-1B verdict-attest gate. Covers the four DOD criteria from
// docs/security/KEYCONSENT_2_PREFLIGHT.md §10 (verdict-attest-only this
// slice; authorship-sign and urp-choose are deferred to KEYCONSENT-1B-bis
// and KEYCONSENT-1B-ter) plus two structural carry-over checks proving
// the KEYCONSENT-1B body/boundary shape is preserved.
//
// SCOPE (this slice):
// - verdict-attest ONLY. No authorship-sign / urp-choose changes here.
// - Within one $DEMA_HOME (tmpdir per test). No cross-machine replay.
// - Reuses KEYCONSENT-2A recordConsentNonce kernel (no duplication).

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  attestVerdict,
  ATTEST_CONSENT_PHRASE,
  ATTEST_ACTION_TYPE,
} from "../packages/receipts/src/verdict-attest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import { nonceDigest } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  initAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";

const VALID_INPUT = Object.freeze({ name: "alice", value: 100 });
const VALID_RULE = "canonical-shape.v0.1";
const FIXED_NOW = "2026-05-30T08:00:30.000Z";
const FIXED_CREATED = "2026-05-30T08:00:00.000Z";
const FIXED_EXPIRES = "2026-05-30T08:05:00.000Z";
const FIXED_NONCE_A = "ab".repeat(32);
const FIXED_NONCE_B = "cd".repeat(32);

function inputHashOf(input) {
  return sha256(stableStringify(input));
}

async function freshHomeWithKey() {
  const home = await mkdtemp(join(tmpdir(), "dema-kc2b-test-"));
  await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE,
    demaHome: home,
  });
  return home;
}

async function buildAttestConsent({ home, input, nonce }) {
  const hash = inputHashOf(input);
  return buildConsentProof({
    phrase: ATTEST_CONSENT_PHRASE,
    actionScope: {
      action_type: ATTEST_ACTION_TYPE,
      target_hash: hash,
      rule_id: VALID_RULE,
    },
    demaHome: home,
    nonce: nonce || FIXED_NONCE_A,
    createdAtIso: FIXED_CREATED,
    expiresAtIso: FIXED_EXPIRES,
  });
}

// Reads the CANONICAL claim store. The retired aggregate file
// (consent/used-nonces.json) is no longer written by any live path; it survives
// only as a refusal source for nonces consumed before the cutover.
async function readRegistry(home) {
  const dir = join(home, "consent", "nonces-v1");
  // A refused attest creates no claim, so an absent directory is an EMPTY store,
  // not an error — several DODs assert "nothing was written".
  let names;
  try { names = await readdir(dir); } catch { return {}; }
  const out = {};
  for (const n of names) {
    const claim = JSON.parse(await readFile(join(dir, n), "utf8"));
    out[claim.nonce_digest ?? n.replace(/\.json$/, "")] = claim;
  }
  return out;
}

// ── UPDATED 2026-08-10 · PARALLEL_CONSENT_REPLAY_AUTHORITY cutover ──────────
// verdict-attest now claims through `consent-nonce-claim.js`, the ONE canonical
// consumption authority, instead of the superseded `consent-nonce-registry.js`.
// The BEHAVIOUR these DODs assert is unchanged in every case — first attest
// wins, replay is refused, a pre-consumed nonce is refused, and a refused replay
// still leaves no receipt and no chain advance. What changed is WHERE the claim
// lives and WHICH authority answers, and the reason codes now say so:
//
//   registry file  consent/used-nonces.json  ->  consent/nonces-v1/<digest>.json
//   replay         consent_nonce_already_used -> consent_nonce_already_claimed
//   pre-consumed   consent_nonce_already_used -> consent_nonce_legacy_consumed
//
// The last one is strictly more informative: it names that the refusal came from
// a SUPERSEDED store rather than from the live one. Historical safety is intact
// — the cutover added consent/used-nonces.json to the canonical module's legacy
// refusal set, which DOD-10.4 is precisely what caught as missing.
describe("KEYCONSENT-2B · verdict-attest nonce-registry integration", () => {
  it("DOD-10.1: first attest with a given consent proof → attested:true, registry has nonce", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);

      const registry = await readRegistry(home);
      // Keyed by DIGEST, not by the raw nonce: the canonical store never lets the
      // raw value become a filesystem path. Same fact, path-safe by construction.
      const key = nonceDigest(FIXED_NONCE_A);
      assert.ok(
        Object.prototype.hasOwnProperty.call(registry, key),
        "canonical claim store must contain the consumed nonce",
      );
      const entry = registry[key];
      assert.equal(entry.action_kind, ATTEST_ACTION_TYPE);
      assert.equal(entry.contract_hash, inputHashOf(VALID_INPUT));
      // Canonical field names: consent_context_hash / claimed_at_iso. Same facts.
      assert.equal(
        entry.consent_context_hash,
        cp.consent_proof.consent_proof_hash,
      );
      assert.ok(
        typeof entry.claimed_at_iso === "string" &&
          entry.claimed_at_iso.length > 0,
        "claimed_at_iso must be captured",
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-10.2: second attest with SAME consent proof (replay) → attested:false, error consent_consent_nonce_already_claimed", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const first = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(first.attested, true);

      const second = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(second.attested, false);
      assert.equal(second.error, "consent_consent_nonce_already_claimed");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-10.3: failed consent_proof verification (tamper) → nonce NOT recorded", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({
        home,
        input: VALID_INPUT,
        nonce: FIXED_NONCE_B,
      });
      const tampered = Object.freeze({
        ...cp.consent_proof,
        consent_phrase: "DIFFERENT PHRASE",
      });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: tampered,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      // Consent verification fires BEFORE the registry write — error
      // surfaces as a consent_proof_* code, not a consent_* registry code.
      assert.equal(r.error, "consent_proof_consent_proof_hash_mismatch");

      // Registry must not contain the tampered nonce. The file may not
      // even exist (no successful write happened); both states are OK.
      let registryExists = true;
      let registry = {};
      try {
        registry = await readRegistry(home);
      } catch {
        registryExists = false;
      }
      if (registryExists) {
        assert.ok(
          !Object.prototype.hasOwnProperty.call(registry, FIXED_NONCE_B),
          "registry must NOT record a nonce whose consent failed verification",
        );
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("DOD-10.4: pre-existing nonce in registry (out-of-band) → attest with that nonce → attested:false", async () => {
    const home = await freshHomeWithKey();
    try {
      // Seed the registry out-of-band with the nonce we are about to use
      // in a fresh consent proof. Simulates a parallel process / prior
      // session having consumed this nonce already.
      const cp = await buildAttestConsent({
        home,
        input: VALID_INPUT,
        nonce: FIXED_NONCE_A,
      });
      const consentDir = join(home, "consent");
      await mkdir(consentDir, { recursive: true, mode: 0o700 });
      const preExisting = {
        [FIXED_NONCE_A]: {
          action_type: ATTEST_ACTION_TYPE,
          target_hash: inputHashOf(VALID_INPUT),
          consumed_at_iso: "2026-05-30T07:59:00.000Z",
          consent_proof_hash: "deadbeef".repeat(8),
        },
      };
      await writeFile(
        join(consentDir, "used-nonces.json"),
        stableStringify(preExisting),
        { encoding: "utf8", mode: 0o600 },
      );

      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, false);
      // A pre-consumed nonce is refused because a SUPERSEDED store still holds it.
      // Naming that is strictly more informative than the old generic code.
      assert.equal(r.error, "consent_consent_nonce_legacy_consumed");

      // Post-cutover this splits into two stronger facts.
      // (a) the historical LEGACY marker is untouched — refusal reads it, never
      //     rewrites it, and the cutover must not erase or migrate old history.
      const legacy = JSON.parse(
        await readFile(join(home, "consent", "used-nonces.json"), "utf8"),
      );
      assert.equal(legacy[FIXED_NONCE_A].consent_proof_hash, "deadbeef".repeat(8));
      // (b) the refused call created NO canonical claim. A refusal that still
      //     consumed would be the worst possible outcome: spent, and unprovable.
      assert.deepEqual(await readRegistry(home), {});
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("STRUCT-1: body still includes consent_proof_hash (unchanged from KC-1B)", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);
      assert.ok(/^[a-f0-9]{64}$/.test(r.body.consent_proof_hash));
      assert.equal(
        r.body.consent_proof_hash,
        cp.consent_proof.consent_proof_hash,
      );
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("STRUCT-2: boundary block unchanged on successful attest (all KC-1B flags intact)", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await buildAttestConsent({ home, input: VALID_INPUT });
      const r = await attestVerdict({
        rule: VALID_RULE,
        input: VALID_INPUT,
        consent: ATTEST_CONSENT_PHRASE,
        consentProof: cp.consent_proof,
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(r.attested, true);
      assert.equal(r.boundary.local_only, true);
      assert.equal(r.boundary.private_key_loaded, true);
      assert.equal(r.boundary.receipt_written, true);
      assert.equal(r.boundary.signature_emitted, true);
      assert.equal(r.boundary.rule_executed, true);
      assert.equal(r.boundary.network_used, false);
      assert.equal(r.boundary.federation_used, false);
      assert.equal(r.boundary.token_minted, false);
      assert.equal(r.boundary.share_published, false);
      assert.equal(r.boundary.poi_score_calculated, false);
      assert.equal(r.boundary.economic_claim_made, false);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
