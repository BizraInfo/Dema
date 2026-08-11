#!/usr/bin/env node
// NODE0-GENESIS-ROOT-BOOTSTRAP-CEREMONY-1A — independent end-to-end proof.
//
// The unit matrix already drives the real CLI, but inside one test process. This
// proof separates the CEREMONY from its VERIFICATION completely: phase 1 spawns
// the shipped `bin/dema` binary, lets it establish the origin, and lets it exit.
// Phase 2 is a fresh interpreter that never saw the ceremony happen and has only
// the disk to go on — it must still verify a K0-signed history across a rotation
// through the origin that a human command left behind.
//
//   1 init K0 via the real CLI          5 rotate K0 -> K1
//   2 establish origin via the real CLI 6 fresh process: read the origin
//   3 EXIT the ceremony process         7 production consumer verifies
//   4 write ordinary K0 history         8 refuse a second ceremony
//
// Also proves the refusals a bootstrap must have: a near-miss consent phrase
// establishes nothing, and a Node that already has history cannot acquire an
// origin after the fact.
//
// Disposable home only. Fixture keys only. Never a real ~/.dema, never a real
// key, no network, no push. It does NOT prove host-level tamper resistance.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const DEMA = join(REPO, "bin/dema");
const SELF = fileURLToPath(import.meta.url);

const P = (p) => join(REPO, p);
const NODE_ID = "node0-ceremony-proof";
const CONSENT = "ESTABLISH NODE GENESIS ROOT TRUST";
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

/** Run the SHIPPED binary. Never throws — a refusal is a result, not a crash. */
function dema(home, args) {
  const r = spawnSync("node", [DEMA, ...args], {
    cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home },
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// ── phase 1 ── the human ceremony, in a process that then dies ────────────
async function phase1(home) {
  const init = dema(home, ["authorship", "key", "init",
    "--consent", "GENERATE AUTHORSHIP KEY", "--json"]);
  if (init.code !== 0) throw new Error(`phase1 key init failed: ${init.out}`);

  // A near-miss phrase must establish nothing. Proven BEFORE the real one, so a
  // later success cannot be mistaken for this attempt having worked.
  const nearMiss = dema(home, ["genesis", "root", "establish", "--node-id", NODE_ID,
    "--ceremony-id", "proof-ceremony", "--consent", "GENERATE AUTHORSHIP KEY", "--json"]);

  const established = dema(home, ["genesis", "root", "establish", "--node-id", NODE_ID,
    "--ceremony-id", "proof-ceremony", "--consent", CONSENT, "--json"]);
  if (established.code !== 0) throw new Error(`phase1 ceremony failed: ${established.out}`);
  const report = JSON.parse(established.out);

  // A second ceremony must refuse against the very origin just written.
  const second = dema(home, ["genesis", "root", "establish", "--node-id", NODE_ID,
    "--ceremony-id", "proof-ceremony-2", "--consent", CONSENT, "--json"]);

  out({
    phase: 1,
    near_miss_refused: nearMiss.code !== 0,
    near_miss_leaked_private_key: /PRIVATE KEY/.test(nearMiss.out),
    ceremony_established: report.established === true,
    root_fingerprint: report.root_public_key_fingerprint,
    node_id: report.node_id,
    authority_delta: report.authority_delta,
    second_ceremony_refused: second.code !== 0,
    second_ceremony_reason: (() => {
      try { return JSON.parse(second.out).reason; } catch { return "unparseable"; }
    })(),
  });
  // The ceremony process ends here. Nothing survives but the disk.
}

// ── phase 2 ── a fresh interpreter, disk only ─────────────────────────────
async function phase2(home, expect) {
  const ks = await import(P("packages/receipts/src/authorship-key-store.js"));
  const cl = await import(P("packages/receipts/src/canonical-ledger.js"));
  const cr = await import(P("packages/receipts/src/canonical-receipt.js"));
  const sg = await import(P("packages/receipts/src/authorship-signature.js"));
  const rt = await import(P("packages/genesis/src/node-root-trust.js"));
  const ceremony = await import(P("packages/genesis/src/node0-genesis-root-ceremony.js"));
  const corridor = await import(P("packages/mission/src/corridor-closure-gatherer.js"));

  // The origin left behind by a command this process never ran.
  const root = await rt.loadNodeRootTrust({ demaHome: home, expectedNodeId: NODE_ID });
  if (!root.ok) throw new Error(`phase2 root unreadable: ${root.reason}`);
  const K0 = await ks.loadPublicKey(home);

  // (4) ordinary K0-signed history, written AFTER the origin exists.
  for (let i = 0; i < 2; i += 1) {
    const r = await cl.appendCanonicalReceipt({
      canonicalBody: { schema: "ceremony.proof.v0", event: "PROOF_ENTRY", n: i },
      truthLabel: cr.VALID_TRUTH_LABELS[0],
      whatProves: "one K0-signed entry after the origin was established",
      whatDoesNotProve: "nothing about host integrity",
      consent: cr.CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: home,
      now: `2026-08-11T00:1${i}:00.000Z`,
    });
    if (!r.appended) throw new Error(`phase2 append failed: ${r.error}`);
  }

  // (5) real rotation machinery.
  const rot = await ks.rotateAuthorshipKey({
    consent: ks.KEY_ROTATE_CONSENT_PHRASE, demaHome: home,
    retiredAt: "2026-08-11T01:00:00.000Z", reason: "ceremony_proof",
    envelope: { nonce: "cp-nonce", ceremony_id: "cp-cer", reason: "proof" },
  });
  if (!rot.rotated) throw new Error(`phase2 rotation failed: ${rot.error}`);
  const currentFp = sg.fingerprintPublicKeyPem(await ks.loadPublicKey(home));

  // (7) the ordinary production consumer, resolving its own anchor from disk.
  const append = corridor.buildLedgerAppender({
    demaHome: home, now: "2026-08-11T02:00:00.000Z", transactionId: "ceremony-proof-tx",
  });
  let consumer = { ok: false, error: null };
  try {
    const r = await append({
      canonicalBody: { closure_transaction_id: "ceremony-proof-tx", omega0_seal_head: "e".repeat(64) },
      truthLabel: "MEASURED_LOCAL",
    });
    consumer = { ok: r.ok === true, error: null };
  } catch (err) {
    consumer = { ok: false, error: err.message };
  }

  // Post-history, post-rotation: the ceremony must now refuse outright, and its
  // reason must be the freshness law rather than an incidental error.
  const late = await ceremony.establishNodeGenesisRoot({
    demaHome: home, nodeId: NODE_ID, consent: CONSENT,
    ceremonyId: "too-late", now: "2026-08-11T03:00:00.000Z",
  });

  const facts = {
    phase: 2,
    root_fingerprint: root.rootTrustFingerprint,
    root_matches_phase1: root.rootTrustFingerprint === expect.root_fingerprint,
    root_is_k0: root.rootTrustFingerprint === sg.fingerprintPublicKeyPem(K0),
    root_is_not_current: root.rootTrustFingerprint !== currentFp,
    node_binding_held: root.nodeId === NODE_ID,
    production_consumer_ok: consumer.ok,
    production_consumer_error: consumer.error,
    late_ceremony_refused: late.established === false,
    late_ceremony_reason: late.reason,
    ledger_entries: (await cl.loadCanonicalLedger({ demaHome: home })).length,
    root_record_has_private_key: /PRIVATE KEY/.test(
      readFileSync(rt.nodeRootTrustPath(home), "utf8")),
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
  const home = mkdtempSync(join(tmpdir(), "grc-proof-"));
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

    const MUST_BE_TRUE = [
      [p1, ["near_miss_refused", "ceremony_established", "second_ceremony_refused"]],
      [p2, ["root_matches_phase1", "root_is_k0", "root_is_not_current",
            "node_binding_held", "production_consumer_ok", "late_ceremony_refused"]],
    ];
    const MUST_BE_FALSE = [
      [p1, ["near_miss_leaked_private_key"]],
      [p2, ["root_record_has_private_key"]],
    ];
    const failed = [
      ...MUST_BE_TRUE.flatMap(([o, ks]) => ks.filter((k) => o[k] !== true)),
      ...MUST_BE_FALSE.flatMap(([o, ks]) => ks.filter((k) => o[k] !== false)),
    ];
    const ok = failed.length === 0
      && p1.authority_delta === 0
      && p2.late_ceremony_reason === "genesis_root_requires_fresh_node";

    out({
      proof: "NODE0-GENESIS-ROOT-BOOTSTRAP-CEREMONY-1A",
      ok,
      failed_assertions: failed,
      phase1: p1,
      phase2: p2,
      ceremony_process_spent: true,
      boundary: {
        real_home_touched: false,
        real_keys_used: false,
        network_used: false,
        authority_delta: 0,
        proves:
          "a HUMAN, through the shipped `dema genesis root establish` command and no other "
          + "path, can establish where a fresh Node0's canonical history begins; the origin "
          + "survives the ceremony process, carries a real K0-signed history across a K0->K1 "
          + "rotation for a real production consumer, and refuses to be established twice or "
          + "after history exists",
        does_not_prove:
          "resistance to a compromised host or root administrator, who can rewrite the root "
          + "record directly; nor revocation, recovery, re-genesis, or establishing an origin "
          + "on an already-historic Node, which is deliberately refused and left unshipped",
      },
    });
    code = ok ? 0 : 1;
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  process.exit(code);
}
