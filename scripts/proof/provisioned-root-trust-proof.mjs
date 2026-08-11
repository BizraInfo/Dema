#!/usr/bin/env node
// PROVISIONED-ROOT-TRUST-BOUNDARY-1A — independent end-to-end proof.
//
// The unit matrix runs inside one process, so it cannot by itself rule out that
// something was carried in memory across the rotation. This proof spends the
// producing PROCESS entirely: phase 1 stands a habitat up and exits; phase 2 is
// a fresh interpreter that has only the disk to go on, and must still verify a
// history signed by a key that is no longer the active one.
//
//   1 provision K0 as root          5 re-open via the production root provider
//   2 write K0 history              6 verify the chain from the provisioned K0
//   3 rotate K0 -> K1               7 observe active authority is K1
//   4 EXIT the producing process    8 tamper a receipt   9 confirm rejection
//
// Disposable home only. Fixture keys only. Never a real ~/.dema, never a real
// key, no network, no push. Read the boundary block at the end before quoting
// any line of this output: it does NOT prove host-level tamper resistance.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SELF = fileURLToPath(import.meta.url);

const P = (p) => join(REPO, p);
const load = {
  keys: () => import(P("packages/receipts/src/authorship-key-store.js")),
  ledger: () => import(P("packages/receipts/src/canonical-ledger.js")),
  receipt: () => import(P("packages/receipts/src/canonical-receipt.js")),
  sig: () => import(P("packages/receipts/src/authorship-signature.js")),
  root: () => import(P("packages/genesis/src/node-root-trust.js")),
  witness: () => import(P("packages/genesis/src/node0-genesis-witness.js")),
  corridor: () => import(P("packages/mission/src/corridor-closure-gatherer.js")),
};

const NODE_ID = "node0-proof-fixture";
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

// ── phase 1 ── produce, then die ──────────────────────────────────────────
async function phase1(home) {
  const ks = await load.keys();
  const cl = await load.ledger();
  const cr = await load.receipt();
  const sg = await load.sig();
  const rt = await load.root();

  await ks.initAuthorshipKey({
    consent: ks.KEY_INIT_CONSENT_PHRASE, demaHome: home, now: "2026-08-11T00:00:00.000Z",
  });
  const K0 = await ks.loadPublicKey(home);

  // (1) root FIRST, under its own phrase, before any history exists.
  const prov = await rt.provisionNodeRootTrust({
    demaHome: home, nodeId: NODE_ID, rootPublicKeyPem: K0,
    consent: rt.ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId: "proof-ceremony", establishedAt: "2026-08-11T00:00:00.000Z",
  });
  if (!prov.ok) throw new Error(`phase1 provision failed: ${prov.reason}`);

  // Genesis is not established until the root is PINNED out of band. Without
  // this the production consumer in phase 2 refuses, which is the correct
  // behaviour and would make the proof measure an unestablished node.
  const wit = await load.witness();
  const pinned = await wit.establishGenesisWitness({
    demaHome: home, witnessPath: `${home}-witness.json`, nodeId: NODE_ID,
    ceremonyId: "proof-ceremony", consent: wit.WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
    witnessedAt: "2026-08-11T00:00:00.000Z",
  });
  if (!pinned.ok) throw new Error(`phase1 pin failed: ${pinned.reason}`);

  // (2) ordinary history signed by K0.
  for (let i = 0; i < 2; i += 1) {
    const r = await cl.appendCanonicalReceipt({
      canonicalBody: { schema: "proof.v0", event: "PROOF_ENTRY", n: i },
      truthLabel: cr.VALID_TRUTH_LABELS[0],
      whatProves: "one K0-signed history entry",
      whatDoesNotProve: "nothing about host integrity",
      consent: cr.CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: home,
      now: `2026-08-11T00:0${1 + i}:00.000Z`,
    });
    if (!r.appended) throw new Error(`phase1 append failed: ${r.error}`);
  }

  // (3) real rotation machinery, K0 -> K1.
  const rot = await ks.rotateAuthorshipKey({
    consent: ks.KEY_ROTATE_CONSENT_PHRASE, demaHome: home,
    retiredAt: "2026-08-11T01:00:00.000Z", reason: "proof_rotation",
    envelope: { nonce: "proof-nonce", ceremony_id: "proof-cer", reason: "proof" },
  });
  if (!rot.rotated) throw new Error(`phase1 rotation failed: ${rot.error}`);
  const K1 = await ks.loadPublicKey(home);

  out({
    phase: 1,
    k0_fingerprint: sg.fingerprintPublicKeyPem(K0),
    k1_fingerprint: sg.fingerprintPublicKeyPem(K1),
    root_fingerprint: prov.root_public_key_fingerprint,
    ledger_entries: (await cl.loadCanonicalLedger({ demaHome: home })).length,
  });
  // (4) the producing process ends here. Nothing survives but the disk.
}

// ── phase 2 ── a fresh interpreter, disk only ─────────────────────────────
async function phase2(home, expect) {
  const ks = await load.keys();
  const cl = await load.ledger();
  const cr = await load.receipt();
  const sg = await load.sig();
  const rt = await load.root();
  const corridor = await load.corridor();

  // (5) the ORDINARY production provider — no injection, no test hook.
  const root = await rt.loadNodeRootTrust({ demaHome: home, expectedNodeId: NODE_ID });
  if (!root.ok) throw new Error(`phase2 root unreadable: ${root.reason}`);

  // (6) history verifies from the provisioned root, across the rotation.
  const entries = await cl.loadCanonicalLedger({ demaHome: home });
  const walk = cr.verifyCanonicalAuthorityChain({
    entries, genesisPubkeyPem: root.rootTrustAnchorPem,
  });

  // (7) and today's authority is the OTHER key, on purpose.
  const currentFp = sg.fingerprintPublicKeyPem(await ks.loadPublicKey(home));

  // The real production consumer, resolving its own anchor from disk.
  const append = corridor.buildLedgerAppender({
    demaHome: home, now: "2026-08-11T02:00:00.000Z", transactionId: "proof-tx",
    witnessPath: `${home}-witness.json`,
  });
  let consumer = { ok: false, error: null };
  try {
    const r = await append({
      canonicalBody: { closure_transaction_id: "proof-tx", omega0_seal_head: "e".repeat(64) },
      truthLabel: "MEASURED_LOCAL",
    });
    consumer = { ok: r.ok === true, error: null };
  } catch (err) {
    consumer = { ok: false, error: err.message };
  }

  // (8) tamper one receipt body, (9) confirm the walk rejects it.
  const path = join(home, "receipts", "canonical-ledger.ndjson");
  const lines = readFileSync(path, "utf8").trim().split("\n");
  const victim = JSON.parse(lines[0]);
  victim.canonical_body = { ...victim.canonical_body, n: 999 };
  lines[0] = JSON.stringify(victim);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  const tampered = cr.verifyCanonicalAuthorityChain({
    entries: JSON.parse(`[${lines.join(",")}]`),
    genesisPubkeyPem: root.rootTrustAnchorPem,
  });

  const facts = {
    phase: 2,
    root_fingerprint: root.rootTrustFingerprint,
    root_is_k0: root.rootTrustFingerprint === expect.k0_fingerprint,
    root_is_not_current: root.rootTrustFingerprint !== currentFp,
    current_authority_is_k1: currentFp === expect.k1_fingerprint,
    chain_verified_from_root: walk.verified === true,
    successions_crossed: walk.successions?.length ?? 0,
    walk_lands_on_current_authority: walk.final_authority_fingerprint === currentFp,
    production_consumer_ok: consumer.ok,
    production_consumer_error: consumer.error,
    tamper_rejected: tampered.verified === false,
    tamper_reason: tampered.reason ?? null,
  };
  out(facts);
  return facts;
}

// ── driver ────────────────────────────────────────────────────────────────
const mode = process.argv[2];
if (mode === "--phase1") {
  await phase1(process.argv[3]);
} else if (mode === "--phase2") {
  await phase2(process.argv[3], JSON.parse(process.argv[4]));
} else {
  const home = mkdtempSync(join(tmpdir(), "prt-proof-"));
  let code = 1;
  try {
    const one = spawnSync(process.execPath, [SELF, "--phase1", home], { encoding: "utf8" });
    process.stderr.write(one.stderr ?? "");
    if (one.status !== 0) throw new Error("phase 1 failed");
    const p1 = JSON.parse(one.stdout.trim().split("\n").pop());

    const two = spawnSync(process.execPath, [SELF, "--phase2", home, JSON.stringify(p1)], { encoding: "utf8" });
    process.stderr.write(two.stderr ?? "");
    if (two.status !== 0) throw new Error("phase 2 failed");
    const p2 = JSON.parse(two.stdout.trim().split("\n").pop());

    const REQUIRED = [
      "root_is_k0", "root_is_not_current", "current_authority_is_k1",
      "chain_verified_from_root", "walk_lands_on_current_authority",
      "production_consumer_ok", "tamper_rejected",
    ];
    const failed = REQUIRED.filter((k) => p2[k] !== true);
    const ok = failed.length === 0 && p2.successions_crossed === 1
      && p1.k0_fingerprint !== p1.k1_fingerprint;

    out({
      proof: "PROVISIONED-ROOT-TRUST-BOUNDARY-1A",
      ok,
      failed_assertions: failed,
      phase1: p1,
      phase2: p2,
      producing_process_spent: true,
      boundary: {
        real_home_touched: false,
        real_keys_used: false,
        network_used: false,
        authority_delta: 0,
        proves:
          "one provisioned genesis root, established out-of-band under its own consent "
          + "phrase, lets ONE real production consumer verify a K0-signed history across "
          + "a K0->K1 rotation in a process that never saw K0 created",
        does_not_prove:
          "resistance to a compromised host or root administrator, who can rewrite the "
          + "root record directly; nor revocation, recovery, re-genesis, or any other "
          + "production caller than the one migrated",
      },
    });
    code = ok ? 0 : 1;
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  process.exit(code);
}
