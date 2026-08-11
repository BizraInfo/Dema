import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  GENESIS_WITNESS_SCHEMA,
  WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
  rootRecordCommitment,
  establishGenesisWitness,
  loadGenesisWitness,
  loadAnchoredGenesisRoot,
} from "../packages/genesis/src/node0-genesis-witness.js";
import {
  provisionNodeRootTrust,
  loadNodeRootTrust,
  nodeRootTrustPath,
  nodeRootTrustBodyHash,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
} from "../packages/genesis/src/node-root-trust.js";
import {
  initAuthorshipKey, rotateAuthorshipKey, loadPublicKey,
  KEY_INIT_CONSENT_PHRASE, KEY_ROTATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import { generateEd25519Keypair, fingerprintPublicKeyPem } from "../packages/receipts/src/authorship-signature.js";

/**
 * NODE0-GENESIS-ANCHOR-1A — the defect the self-rehash control found.
 *
 * MEASURED ON d52a6fa, BEFORE REPAIR. Mutate `genesis/root-trust-v1.json`'s
 * payload — swap in an attacker's public key and fingerprint — then RECOMPUTE
 * `body_sha256` over the new body, and `loadNodeRootTrust` ACCEPTS it. The
 * record's digest is computed over the record's own body, so an actor who can
 * rewrite the payload can rewrite the digest. That is self-certification, and
 * this estate already has a law against it: a state cannot prove its own binding.
 *
 * WHAT SAVED IT IN PRACTICE, AND WHY THAT IS NOT ENOUGH. Under a NON-EMPTY
 * ledger the substitution is caught, because the real entries were signed by the
 * real K0 and the chain returns signature_invalid. So the root's only anchor was
 * the history it exists to validate. Under an EMPTY ledger — a Node at genesis,
 * which is exactly when the root is established — nothing disagrees, and an
 * attacker holding the matching private key can then author a complete,
 * internally coherent history the node believes.
 *
 * WHY K0 SIGNING ITSELF DOES NOT FIX IT. A signature over the root record proves
 * possession of the key named in the record. An attacker who substitutes their
 * own KX signs their own record just as validly. Possession is not identity.
 *
 * THE ANCHOR IS THEREFORE OUT-OF-BAND, and inherited rather than invented:
 * bootstrap trust is an axiom established outside the system, and continuity
 * after bootstrap is cryptographically verified. Bitcoin hardcodes block 0 and
 * publishes its hash; a VM guest states its trust in the host; in-toto names a
 * builder identity outside the artifact. BIZRA's out-of-band act is the sovereign
 * human ceremony, and this slice gives that act a durable, independently-stored
 * commitment: a TOFU pin, held OUTSIDE DEMA_HOME.
 *
 * THE PIN MAY VETO. IT MAY NEVER NOMINATE. It carries a fingerprint and a
 * commitment — never key material, never a PEM. A pin that could supply a root
 * would simply be a second genesis authority wearing a smaller hat, and
 * ROOT-ANCHOR-11 refuses that representation outright.
 *
 * BOUNDED CLAIM. This proves that unauthorized mutation cannot be silently
 * ACCEPTED given the sovereign ceremony and the integrity of the local bootstrap
 * verifier. It does not claim resistance to a malicious kernel, root
 * administrator, firmware, hypervisor, or an attacker who can replace both the
 * verifier and every local trust store. Those remain stated host assumptions.
 *
 * FIXTURE KEYS AND DISPOSABLE HOMES ONLY. No real ~/.dema, no real pin.
 */

const AT = "2026-08-11T00:00:00.000Z";
const NODE = "node0-anchor-fixture";
const CEREMONY = "anchor-ceremony-1";

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "ga-home-"));
  const trust = mkdtempSync(join(tmpdir(), "ga-trust-"));
  return { home, trust, witnessPath: join(trust, "genesis-witness-v1.json") };
}
const cleanup = (f) => { rmSync(f.home, { recursive: true, force: true }); rmSync(f.trust, { recursive: true, force: true }); };

async function establishedNode(f, { rotate = false } = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: f.home, now: AT });
  const K0 = await loadPublicKey(f.home);
  const p = await provisionNodeRootTrust({
    demaHome: f.home, nodeId: NODE, rootPublicKeyPem: K0,
    consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE, ceremonyId: CEREMONY, establishedAt: AT,
  });
  assert.equal(p.ok, true, p.reason ?? "");
  const w = await establishGenesisWitness({
    demaHome: f.home, witnessPath: f.witnessPath, nodeId: NODE, ceremonyId: CEREMONY,
    consent: WITNESS_GENESIS_ROOT_CONSENT_PHRASE, witnessedAt: AT,
  });
  assert.equal(w.ok, true, w.reason ?? "");
  let K1 = null;
  if (rotate) {
    const r = await rotateAuthorshipKey({
      consent: KEY_ROTATE_CONSENT_PHRASE, demaHome: f.home, retiredAt: "2026-08-11T01:00:00.000Z",
      reason: "anchor", envelope: { nonce: "ga-n", ceremony_id: "ga-c", reason: "anchor" },
    });
    assert.equal(r.rotated, true, r.error ?? "");
    K1 = await loadPublicKey(f.home);
  }
  return { K0, K1 };
}

/** Rewrite the root record as an attacker would: new payload, recomputed digest. */
function forgeRoot(home, mutate) {
  const p = nodeRootTrustPath(home);
  const rec = JSON.parse(readFileSync(p, "utf8"));
  const forged = mutate({ ...rec });
  const { body_sha256: _drop, ...body } = forged;
  forged.body_sha256 = nodeRootTrustBodyHash(body);
  chmodSync(p, 0o600);
  writeFileSync(p, JSON.stringify(forged, null, 2));
  return forged;
}

// ── ROOT-ANCHOR-01 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-01: canonical root + correct independent pin verifies", async () => {
  const f = fixture();
  try {
    const { K0 } = await establishedNode(f);
    const r = await loadAnchoredGenesisRoot({
      demaHome: f.home, witnessPath: f.witnessPath, expectedNodeId: NODE,
    });
    assert.equal(r.ok, true, r.reason ?? "");
    assert.equal(r.rootTrustAnchorPem, K0, "the anchored root must be byte-identical to K0");
    assert.equal(r.rootTrustFingerprint, fingerprintPublicKeyPem(K0));
    assert.equal(r.anchor, "CEREMONY_PINNED");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-02 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-02: payload changed with a stale body hash fails", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const p = nodeRootTrustPath(f.home);
    const rec = JSON.parse(readFileSync(p, "utf8"));
    chmodSync(p, 0o600);
    writeFileSync(p, JSON.stringify({ ...rec, node_id: "attacker" }, null, 2)); // hash NOT recomputed
    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "root_trust_body_hash_mismatch");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-03 ── THE MEASURED DEFECT ─────────────────────────────────
test("ROOT-ANCHOR-03: payload changed WITH the body hash recomputed still fails", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    // Forge a field that leaves BOTH the key and the node binding intact, so the
    // input actually reaches the commitment gate. A node_id forgery is refused
    // one gate earlier (genesis_witness_node_binding_mismatch) — also correct,
    // but it would have pinned a reason the input never reaches.
    forgeRoot(f.home, (r) => ({ ...r, established_at: "2099-01-01T00:00:00.000Z" }));

    // The structural loader alone still accepts it — that is the defect, and it
    // is asserted here rather than hidden, because the anchored path is what
    // must catch it.
    assert.equal((await loadNodeRootTrust({ demaHome: f.home })).ok, true,
      "structural load is self-certifying by construction; the pin is the fix");

    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(r.ok, false, "a self-rehashed forgery must not be anchored");
    assert.equal(r.reason, "genesis_witness_commitment_mismatch");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-04 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-04: attacker's own KX, rehashed and self-consistent, fails on the pin", async () => {
  const f = fixture();
  try {
    const { K0 } = await establishedNode(f);
    const kx = generateEd25519Keypair();
    forgeRoot(f.home, (r) => ({
      ...r, root_public_key_pem: kx.public_key_pem,
      root_public_key_fingerprint: kx.public_key_fingerprint,
    }));
    // Internally coherent: the record's fingerprint derives from its own PEM.
    const structural = await loadNodeRootTrust({ demaHome: f.home });
    assert.equal(structural.ok, true, "the forgery is internally consistent");
    assert.notEqual(structural.rootTrustFingerprint, fingerprintPublicKeyPem(K0));

    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "genesis_witness_fingerprint_mismatch",
      "the pin holds the sovereign-selected K0 and must veto KX");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-05 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-05: root swap PLUS a coherent attacker-signed history still fails", async () => {
  const victim = fixture();
  const attacker = fixture();
  try {
    await establishedNode(victim);
    // The attacker builds a complete, internally perfect node of their own.
    const { K0: KX } = await establishedNode(attacker);

    // Transplant BOTH the forged root and the forged history onto the victim.
    const rp = nodeRootTrustPath(victim.home);
    chmodSync(rp, 0o600);
    writeFileSync(rp, readFileSync(nodeRootTrustPath(attacker.home), "utf8"));

    const r = await loadAnchoredGenesisRoot({ demaHome: victim.home, witnessPath: victim.witnessPath });
    assert.equal(r.ok, false, "a coherent forged genesis must not survive an independent pin");
    assert.equal(r.reason, "genesis_witness_fingerprint_mismatch");
    assert.notEqual(fingerprintPublicKeyPem(KX), null);
  } finally { cleanup(victim); cleanup(attacker); }
});

// ── ROOT-ANCHOR-06 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-06: a missing pin after establishment fails closed, never silently accepts", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    rmSync(f.witnessPath, { force: true });
    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "genesis_witness_unavailable");
    // And it must NOT be regenerated from the root it is supposed to check.
    assert.equal((await loadGenesisWitness({ witnessPath: f.witnessPath })).ok, false);
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-07 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-07: a pin naming a different fingerprint fails closed", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const w = JSON.parse(readFileSync(f.witnessPath, "utf8"));
    chmodSync(f.witnessPath, 0o600);
    writeFileSync(f.witnessPath, JSON.stringify({ ...w, canonical_root_fingerprint: "f".repeat(64) }));
    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(r.ok, false);
    assert.ok(["genesis_witness_fingerprint_mismatch", "genesis_witness_body_hash_mismatch"].includes(r.reason), r.reason);
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-08 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-08: correct root with a wrong node binding fails", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const r = await loadAnchoredGenesisRoot({
      demaHome: f.home, witnessPath: f.witnessPath, expectedNodeId: "some-other-node",
    });
    assert.equal(r.ok, false);
    assert.ok(r.reason.includes("node_binding"), r.reason);
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-09 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-09: after a legitimate K0->K1 succession the root remains K0", async () => {
  const f = fixture();
  try {
    const { K0, K1 } = await establishedNode(f, { rotate: true });
    const r = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath, expectedNodeId: NODE });
    assert.equal(r.ok, true, r.reason ?? "");
    assert.equal(r.rootTrustFingerprint, fingerprintPublicKeyPem(K0), "root stays K0");
    assert.notEqual(r.rootTrustFingerprint, fingerprintPublicKeyPem(K1), "current authority is K1");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-10 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-10: nothing local may nominate the root — the pin is the only source", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const src = readFileSync(
      new URL("../packages/genesis/src/node0-genesis-witness.js", import.meta.url), "utf8");
    // The anchored loader must not reach for any of the classic self-nominators.
    for (const forbidden of ["loadPublicKey", "entries[0]", "loadGenerationPublicKey", "retired"]) {
      assert.ok(!src.includes(forbidden),
        `the witness module must never consult ${forbidden} to decide the root`);
    }
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-11 ────────────────────────────────────────────────────────
test("ROOT-ANCHOR-11: a pin carrying key material is refused — veto only, never nominate", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const w = JSON.parse(readFileSync(f.witnessPath, "utf8"));
    // The honest pin holds no PEM at all.
    assert.ok(!JSON.stringify(w).includes("BEGIN PUBLIC KEY"),
      "a witness must never carry key material");

    chmodSync(f.witnessPath, 0o600);
    const kx = generateEd25519Keypair();
    writeFileSync(f.witnessPath, JSON.stringify({ ...w, root_public_key_pem: kx.public_key_pem }));
    const r = await loadGenesisWitness({ witnessPath: f.witnessPath });
    assert.equal(r.ok, false, "a witness offering a root must be rejected as a representation");
    assert.equal(r.reason, "genesis_witness_may_not_carry_key_material");
  } finally { cleanup(f); }
});

// ── ROOT-ANCHOR-12 ── removal control ─────────────────────────────────────
test("ROOT-ANCHOR-12: without the commitment check, the self-rehash forgery passes again", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    forgeRoot(f.home, (r) => ({ ...r, established_at: "2099-01-01T00:00:00.000Z" }));

    // Simulate the repair being removed: compare ONLY the fingerprint, which the
    // node_id forgery leaves untouched. This is what the code looked like before
    // the commitment was added, and it must let the forgery through — proving the
    // commitment check is what does the work in ROOT-ANCHOR-03.
    const witness = (await loadGenesisWitness({ witnessPath: f.witnessPath })).witness;
    const root = await loadNodeRootTrust({ demaHome: f.home });
    const fingerprintOnly = root.rootTrustFingerprint === witness.canonical_root_fingerprint;
    assert.equal(fingerprintOnly, true,
      "fingerprint alone does NOT catch this forgery — the record commitment does");

    const full = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(full.ok, false, "with the commitment check present, it is caught");
  } finally { cleanup(f); }
});

// ── consent ───────────────────────────────────────────────────────────────
test("ROOT-ANCHOR-C1: the witness consent phrase is exact and distinct", async () => {
  const f = fixture();
  try {
    await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: f.home, now: AT });
    const K0 = await loadPublicKey(f.home);
    await provisionNodeRootTrust({
      demaHome: f.home, nodeId: NODE, rootPublicKeyPem: K0,
      consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE, ceremonyId: CEREMONY, establishedAt: AT,
    });
    for (const phrase of [undefined, "", ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
                          KEY_INIT_CONSENT_PHRASE,
                          WITNESS_GENESIS_ROOT_CONSENT_PHRASE.toLowerCase()]) {
      const r = await establishGenesisWitness({
        demaHome: f.home, witnessPath: f.witnessPath, nodeId: NODE, ceremonyId: CEREMONY,
        consent: phrase, witnessedAt: AT,
      });
      assert.equal(r.ok, false, `phrase ${JSON.stringify(phrase)} must not witness`);
      assert.equal(r.reason, "consent_required");
    }
  } finally { cleanup(f); }
});

test("ROOT-ANCHOR-C2: a conflicting existing witness is never overwritten", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const before = readFileSync(f.witnessPath, "utf8");
    // Identical, fully-valid inputs: the refusal must come from the pin already
    // existing, not from any earlier validation. A mismatched ceremony_id is
    // refused one gate earlier, against the root, which would test the wrong law.
    const second = await establishGenesisWitness({
      demaHome: f.home, witnessPath: f.witnessPath, nodeId: NODE, ceremonyId: CEREMONY,
      consent: WITNESS_GENESIS_ROOT_CONSENT_PHRASE, witnessedAt: "2026-08-12T00:00:00.000Z",
    });
    assert.equal(second.ok, false);
    assert.equal(second.reason, "genesis_witness_already_established");
    assert.equal(readFileSync(f.witnessPath, "utf8"), before, "not one byte may change");
  } finally { cleanup(f); }
});

test("ROOT-ANCHOR-C3: the witness schema and epistemic status are declared", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const w = JSON.parse(readFileSync(f.witnessPath, "utf8"));
    assert.equal(w.schema, GENESIS_WITNESS_SCHEMA);
    assert.equal(w.epistemic_status, "CEREMONY_PINNED");
    assert.equal(w.authority_delta, 0);
    assert.equal(typeof w.canonical_root_record_commitment, "string");
    assert.equal(w.canonical_root_record_commitment,
      rootRecordCommitment(JSON.parse(readFileSync(nodeRootTrustPath(f.home), "utf8"))));
  } finally { cleanup(f); }
});
