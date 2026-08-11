import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  provisionNodeRootTrust,
  loadNodeRootTrust,
  nodeRootTrustPath,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
  NODE_ROOT_TRUST_SCHEMA,
} from "../packages/genesis/src/node-root-trust.js";
import {
  initAuthorshipKey,
  rotateAuthorshipKey,
  loadPublicKey,
  KEY_INIT_CONSENT_PHRASE,
  KEY_ROTATE_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  appendCanonicalReceipt,
  loadCanonicalLedger,
} from "../packages/receipts/src/canonical-ledger.js";
import {
  verifyCanonicalAuthorityChain,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";
import {
  generateEd25519Keypair,
  fingerprintPublicKeyPem,
} from "../packages/receipts/src/authorship-signature.js";
import { buildLedgerAppender } from "../packages/mission/src/corridor-closure-gatherer.js";

/**
 * PROVISIONED-ROOT-TRUST-BOUNDARY-1A — where a Node's historical trust begins.
 *
 * THE CLAIM UNDER TEST, and nothing wider: a Node can provision ONE genesis
 * root anchor K0 under explicit human micro-consent, independently of the
 * canonical receipt chain, and one existing PRODUCTION historical-verification
 * path can use that anchor before AND after K0 -> K1.
 *
 * WHY THE PRODUCTION PATH AND NOT A HARNESS. `buildLedgerAppender` was chosen
 * because it discriminates: it takes no injected key, it verified before a
 * rotation, and it returned signature_invalid after one. A test that injected
 * the root itself would prove the verifier works — which was already proven —
 * and say nothing about whether a real caller can reach a legitimate root. So
 * RTA-04 goes through the ordinary dependency path with NO test-only injection.
 *
 * THE THREE THINGS A ROOT IS NOT, each with its own row:
 *   RTA-02 / RTA-09  archived + current existence of K0 is not authority
 *   RTA-05           the current key is not the root
 *   RTA-08           the ledger may not nominate its own ancestor
 *
 * RTA-12 is the negative control that keeps the rest honest: a refuse-everything
 * implementation satisfies every rejection above it, so one path must be proven
 * to cross K0 root -> K0 history -> K0->K1 succession -> K1 current authority.
 *
 * FIXTURE KEYS ONLY. Disposable DEMA_HOME only. No real home, no real keys.
 */

const LABEL = VALID_TRUTH_LABELS[0];
const NODE = "node0-fixture";
const AT = "2026-08-11T00:00:00.000Z";

const home = () => mkdtemp(join(tmpdir(), "rta-"));

const provision = (h, pem, over = {}) =>
  provisionNodeRootTrust({
    demaHome: h,
    nodeId: NODE,
    rootPublicKeyPem: pem,
    consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId: "rta-ceremony",
    establishedAt: AT,
    ...over,
  });

/** A K0 identity plus one ordinary receipt it legitimately signed. */
async function homeWithK0History(h, { receipts = 1 } = {}) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: h, now: AT });
  const K0 = await loadPublicKey(h);
  for (let i = 0; i < receipts; i += 1) {
    const r = await appendCanonicalReceipt({
      canonicalBody: { schema: "rta.probe.v0", event: "PROBE", n: i },
      truthLabel: LABEL,
      whatProves: "fixture history",
      whatDoesNotProve: "nothing beyond it",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome: h,
      now: `2026-08-11T00:0${1 + i}:00.000Z`,
    });
    assert.equal(r.appended, true, r.error ?? "");
  }
  return K0;
}

/** Drive the REAL rotation machinery. K0 -> K1, succession pair written. */
async function rotate(h, n = 1) {
  const r = await rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE,
    demaHome: h,
    retiredAt: `2026-08-11T01:0${n}:00.000Z`,
    reason: "rta_rotation",
    envelope: { nonce: `rta-nonce-${n}`, ceremony_id: `rta-cer-${n}`, reason: "rta" },
  });
  assert.equal(r.rotated, true, r.error ?? "");
  return loadPublicKey(h);
}

/**
 * The production consumer, driven exactly as production drives it. A
 * transactionId is required to reach the historical check, and the append is
 * expected to succeed or throw — both are real outcomes of the real path.
 */
async function runProductionConsumer(h, txId = "rta-transaction") {
  const append = buildLedgerAppender({ demaHome: h, now: "2026-08-11T02:00:00.000Z", transactionId: txId });
  return append({
    canonicalBody: { closure_transaction_id: txId, omega0_seal_head: "e".repeat(64) },
    truthLabel: "MEASURED_LOCAL",
  });
}

// ── RTA-01 ────────────────────────────────────────────────────────────────
test("RTA-01: a fresh home provisions K0 as root and reads back exactly K0", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h, { receipts: 0 });

  const p = await provision(h, K0);
  assert.equal(p.ok, true, p.reason ?? "");
  assert.equal(p.authority_delta, 0);
  assert.equal(p.root_public_key_fingerprint, fingerprintPublicKeyPem(K0));

  const r = await loadNodeRootTrust({ demaHome: h });
  assert.equal(r.ok, true, r.reason ?? "");
  assert.equal(r.rootTrustAnchorPem, K0, "root must be byte-identical to K0");
  assert.equal(r.rootTrustFingerprint, fingerprintPublicKeyPem(K0));
  assert.equal(r.nodeId, NODE);

  // No private key material may ever reach the record.
  const raw = await readFile(nodeRootTrustPath(h), "utf8");
  assert.doesNotMatch(raw, /PRIVATE KEY/);
});

// ── RTA-02 ────────────────────────────────────────────────────────────────
test("RTA-02: K0 active + canonical history but NO provisioned root fails closed", async () => {
  const h = await home();
  await homeWithK0History(h);
  // Deliberately no provision(). K0 is the active key AND the chain's first
  // signer — every ingredient for a silent promotion is present.
  const absent = await loadNodeRootTrust({ demaHome: h });
  assert.equal(absent.ok, false);
  assert.equal(absent.reason, "root_trust_unavailable");

  await assert.rejects(
    () => runProductionConsumer(h),
    /root_trust_unavailable/,
    "the production consumer must refuse, not promote the active/first key",
  );
});

// ── RTA-03 ────────────────────────────────────────────────────────────────
test("RTA-03: before rotation, the production consumer verifies through the root", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  assert.equal((await provision(h, K0)).ok, true);

  const out = await runProductionConsumer(h);
  assert.equal(out.ok, true);
});

// ── RTA-04 ── LOAD BEARING ────────────────────────────────────────────────
test("RTA-04: after K0->K1 the same production consumer still verifies, with NO injection", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  assert.equal((await provision(h, K0)).ok, true);

  const K1 = await rotate(h);
  assert.notEqual(K1, K0, "rotation must actually change the active key");

  // The real path. No key is handed in; the appender resolves the root itself.
  const out = await runProductionConsumer(h);
  assert.equal(out.ok, true, "post-rotation append must succeed through the provisioned root");

  // And the two answers are intentionally DIFFERENT, which is the whole point.
  const root = await loadNodeRootTrust({ demaHome: h });
  const currentFp = fingerprintPublicKeyPem(await loadPublicKey(h));
  assert.equal(root.rootTrustFingerprint, fingerprintPublicKeyPem(K0), "root stays K0");
  assert.equal(currentFp, fingerprintPublicKeyPem(K1), "current authority is K1");
  assert.notEqual(root.rootTrustFingerprint, currentFp,
    "root trust and current authority must not collapse into one value");
});

// ── RTA-05 ────────────────────────────────────────────────────────────────
test("RTA-05: the CURRENT key is not the root — anchoring at K1 refuses", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  assert.equal((await provision(h, K0)).ok, true);
  const K1 = await rotate(h);

  const entries = await loadCanonicalLedger({ demaHome: h });
  const atK1 = verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: K1 });
  assert.equal(atK1.verified, false);
  assert.equal(atK1.reason, "signature_invalid");
  assert.equal(atK1.at_index, 0, "K1 fails at K0's very first entry");

  // Control: the same entries DO verify from K0. Without this, the row above
  // could pass against a chain that was simply broken.
  assert.equal(verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: K0 }).verified, true);
});

// ── RTA-06 ────────────────────────────────────────────────────────────────
test("RTA-06: an unrelated root refuses against K0 history", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  const Kx = generateEd25519Keypair();
  assert.equal((await provision(h, Kx.public_key_pem)).ok, true);

  const loaded = await loadNodeRootTrust({ demaHome: h });
  assert.equal(loaded.ok, true, "an unrelated key is still a well-formed root record");
  assert.notEqual(loaded.rootTrustFingerprint, fingerprintPublicKeyPem(K0));

  await assert.rejects(() => runProductionConsumer(h), /existing_chain_signature_invalid/);
});

// ── RTA-07 ────────────────────────────────────────────────────────────────
test("RTA-07: a second provision REFUSES and changes zero bytes", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h, { receipts: 0 });
  assert.equal((await provision(h, K0)).ok, true);
  const before = await readFile(nodeRootTrustPath(h), "utf8");

  const K1 = generateEd25519Keypair();
  const second = await provision(h, K1.public_key_pem, { ceremonyId: "rta-ceremony-2" });
  assert.equal(second.ok, false);
  assert.equal(second.reason, "root_trust_already_established");
  assert.equal(second.authority_delta, 0);

  const after = await readFile(nodeRootTrustPath(h), "utf8");
  assert.equal(after, before, "a refused provision must not write a single byte");
  assert.equal((await loadNodeRootTrust({ demaHome: h })).rootTrustAnchorPem, K0);
});

// ── RTA-08 ────────────────────────────────────────────────────────────────
test("RTA-08: a ledger that nominates another first signer cannot move the root", async () => {
  // The attack is NOT a hand-edited field — receipt_id already covers that, so
  // a mutated fingerprint dies on content-hash integrity and would prove
  // nothing about anchoring. The real self-nomination is a chain that is
  // PERFECTLY well-formed and internally consistent, signed end-to-end by Kx,
  // declaring Kx as its own first signer. Follow the chain's nomination and it
  // verifies; follow the provisioned root and it must not.
  const attacker = await home();
  const Kx = await homeWithK0History(attacker, { receipts: 2 });

  const victim = await home();
  const K0 = await homeWithK0History(victim);
  assert.equal((await provision(victim, K0)).ok, true);
  assert.notEqual(fingerprintPublicKeyPem(Kx), fingerprintPublicKeyPem(K0));

  // Transplant the attacker's flawless Kx chain over the victim's ledger.
  const ledger = (h) => join(h, "receipts", "canonical-ledger.ndjson");
  const forged = await readFile(ledger(attacker), "utf8");
  await writeFile(ledger(victim), forged, "utf8");

  // Control: the transplanted chain really is valid under its OWN nominee, so
  // the refusal below is the anchor deciding — not a chain that was broken.
  const entries = await loadCanonicalLedger({ demaHome: victim });
  assert.equal(verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: Kx }).verified, true,
    "precondition: the forged chain is internally perfect under Kx");

  const root = await loadNodeRootTrust({ demaHome: victim });
  assert.equal(root.rootTrustFingerprint, fingerprintPublicKeyPem(K0), "root unmoved by the transplant");
  await assert.rejects(
    () => runProductionConsumer(victim),
    /existing_chain_signature_invalid/,
    "the anchor must refuse a chain that appointed its own ancestor",
  );
});

// ── RTA-09 ────────────────────────────────────────────────────────────────
test("RTA-09: K0 present in the generation archive is not authority", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  await rotate(h); // K0 now lives ONLY in generations/, retired but present.

  const genDir = join(h, "keys", "generations", fingerprintPublicKeyPem(K0));
  const archived = await readFile(join(genDir, "public.pem"), "utf8").catch(() => null);
  assert.ok(archived, "precondition: K0 must actually be archived for this to mean anything");

  // Archived, retired, byte-present — and still not a root.
  assert.equal((await loadNodeRootTrust({ demaHome: h })).reason, "root_trust_unavailable");
  await assert.rejects(() => runProductionConsumer(h), /root_trust_unavailable/);
});

// ── RTA-10 ────────────────────────────────────────────────────────────────
test("RTA-10: malformed root state fails closed, one reason per defect", async () => {
  const K0 = generateEd25519Keypair().public_key_pem;
  const cases = [
    ["not json at all", "root_trust_malformed", (r) => "{{{"],
    ["unknown schema", "root_trust_schema_unknown", (r) => JSON.stringify({ ...r, schema: "other.v9" })],
    ["truncated record", "root_trust_missing:ceremony_id", (r) => {
      const { ceremony_id, ...rest } = r; return JSON.stringify(rest);
    }],
    ["fingerprint disagreement", "root_trust_fingerprint_mismatch",
      (r) => JSON.stringify({ ...r, root_public_key_fingerprint: "0".repeat(64), body_sha256: undefined })],
    ["malformed PEM", "root_trust_public_key_invalid",
      (r) => JSON.stringify({ ...r, root_public_key_pem: "-----BEGIN PUBLIC KEY-----\nnope\n", body_sha256: undefined })],
    ["escalating authority_delta", "root_trust_authority_delta_nonzero",
      (r) => JSON.stringify({ ...r, authority_delta: 1, body_sha256: undefined })],
    ["body hash disagreement", "root_trust_body_hash_mismatch",
      (r) => JSON.stringify({ ...r, ceremony_id: "swapped-after-signing" })],
  ];

  for (const [name, expected, mutate] of cases) {
    const h = await home();
    assert.equal((await provision(h, K0)).ok, true);
    const p = nodeRootTrustPath(h);
    const record = JSON.parse(await readFile(p, "utf8"));
    await chmod(p, 0o600);
    await writeFile(p, mutate(record), "utf8");
    const r = await loadNodeRootTrust({ demaHome: h });
    assert.equal(r.ok, false, `${name} must fail closed`);
    assert.equal(r.reason, expected, name);
  }
});

// ── RTA-11 ────────────────────────────────────────────────────────────────
test("RTA-11: a valid record in the wrong node refuses when binding is enforced", async () => {
  const h = await home();
  const K0 = generateEd25519Keypair().public_key_pem;
  assert.equal((await provision(h, K0)).ok, true);

  const wrong = await loadNodeRootTrust({ demaHome: h, expectedNodeId: "some-other-node" });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "root_trust_node_binding_mismatch");

  // Control: the SAME record verifies under its own node id, so the refusal
  // above is the binding check and not a record that was broken anyway.
  assert.equal((await loadNodeRootTrust({ demaHome: h, expectedNodeId: NODE })).ok, true);
});

// ── RTA-12 ── NEGATIVE-CONTROL INTEGRITY ──────────────────────────────────
test("RTA-12: one full path crosses K0 root -> K0 history -> succession -> K1 authority", async () => {
  const h = await home();
  const K0 = await homeWithK0History(h);
  assert.equal((await provision(h, K0)).ok, true);
  const K1 = await rotate(h);

  const entries = await loadCanonicalLedger({ demaHome: h });
  const walk = verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: K0 });

  assert.equal(walk.verified, true, walk.reason ?? "");
  assert.equal(walk.successions.length, 1, "exactly one K0->K1 succession was crossed");
  assert.equal(walk.successions[0].predecessor_fingerprint, fingerprintPublicKeyPem(K0));
  assert.equal(walk.successions[0].successor_fingerprint, fingerprintPublicKeyPem(K1));
  assert.equal(walk.final_authority_fingerprint, fingerprintPublicKeyPem(K1),
    "the walk lands on the CURRENT authority, having started from the ROOT");
  assert.equal(walk.pending_successor, null);

  // A refuse-everything implementation cannot reach here, which is what makes
  // the eleven rejections above meaningful.
  assert.equal((await runProductionConsumer(h)).ok, true);
});

// ── consent ───────────────────────────────────────────────────────────────
test("RTA-C1: provisioning refuses every phrase but its own", async () => {
  const K0 = generateEd25519Keypair().public_key_pem;
  // The key-init phrase is the dangerous near-miss: consenting to make a key is
  // NOT consenting to establish permanent Node genesis trust.
  for (const phrase of [undefined, "", KEY_INIT_CONSENT_PHRASE, KEY_ROTATE_CONSENT_PHRASE,
                        ESTABLISH_ROOT_TRUST_CONSENT_PHRASE.toLowerCase(),
                        ` ${ESTABLISH_ROOT_TRUST_CONSENT_PHRASE} `]) {
    const h = await home();
    const r = await provisionNodeRootTrust({
      demaHome: h, nodeId: NODE, rootPublicKeyPem: K0,
      consent: phrase, ceremonyId: "c", establishedAt: AT,
    });
    assert.equal(r.ok, false, `phrase ${JSON.stringify(phrase)} must not provision`);
    assert.equal(r.reason, "consent_required");
    assert.equal((await loadNodeRootTrust({ demaHome: h })).reason, "root_trust_unavailable");
  }
});

test("RTA-C2: private key material is refused before anything is written", async () => {
  const h = await home();
  const kp = generateEd25519Keypair();
  const r = await provision(h, kp.private_key_pem);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "private_key_material_refused");
  assert.equal((await loadNodeRootTrust({ demaHome: h })).reason, "root_trust_unavailable");
});

test("RTA-C3: a read error is not reported as an absent root", async () => {
  const h = await home();
  // A directory where the record should be: readFile fails with EISDIR, which
  // must NOT collapse into "this Node never had a root".
  await mkdir(join(h, "genesis", "root-trust-v1.json"), { recursive: true });
  const r = await loadNodeRootTrust({ demaHome: h });
  assert.equal(r.ok, false);
  assert.match(r.reason, /^root_trust_unreadable:/);
  assert.notEqual(r.reason, "root_trust_unavailable");
});

test("RTA-C4: the stored schema is the declared one", async () => {
  const h = await home();
  assert.equal((await provision(h, generateEd25519Keypair().public_key_pem)).ok, true);
  const record = JSON.parse(await readFile(nodeRootTrustPath(h), "utf8"));
  assert.equal(record.schema, NODE_ROOT_TRUST_SCHEMA);
  assert.equal(record.authority_delta, 0);
});
