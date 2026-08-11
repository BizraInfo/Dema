#!/usr/bin/env node
// NODE0-HISTORY-REPLAY-1A — the producer for `full_history_replayable`.
//
//   node scripts/proof/node0-history-replay-proof.mjs [--dema-home <p>] [--json]
//
// THE TRAP THIS IS BUILT AROUND. A process that still holds the history in
// memory can "replay" it perfectly and prove nothing. So this spends its own
// producing process: phase 1 establishes a genesis root through the real
// ceremony, writes real receipts, rotates the authorship key, and EXITS. Phase 2
// is a fresh interpreter that has never seen any of it.
//
// AND REPLAYING IS NOT ENOUGH. A replayer that accepts everything reconstructs a
// forgery just as happily as a true history. So phase 2 also feeds the replayer
// four corruptions on throwaway copies of the home and records whether each was
// actually REFUSED. A control that fails to reject flips the verdict to REFUTED.
//
// BOUNDARY: disposable DEMA_HOME only, fixture keys only. No real ~/.dema, no
// real key, no network. Spawns child node processes (that is the point) and
// writes one artefact under the given home.

import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const SELF = fileURLToPath(import.meta.url);
const DEMA = join(REPO, "bin/dema");
const P = (p) => join(REPO, p);

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const hi = argv.indexOf("--dema-home");
const DEMA_HOME = hi !== -1 ? argv[hi + 1] : mkdtempSync(join(tmpdir(), "node0-replay-"));

const NODE_ID = "node0-replay-proof";
const CONSENT = "ESTABLISH NODE GENESIS ROOT TRUST";
const emit = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

// ── phase 1 ── author the history, then die ───────────────────────────────
async function phase1(home) {
  const ks = await import(P("packages/receipts/src/authorship-key-store.js"));
  const cl = await import(P("packages/receipts/src/canonical-ledger.js"));
  const cr = await import(P("packages/receipts/src/canonical-receipt.js"));

  const run = (args) => spawnSync("node", [DEMA, ...args], {
    cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home },
  });

  const init = run(["authorship", "key", "init", "--consent", "GENERATE AUTHORSHIP KEY", "--json"]);
  if (init.status !== 0) throw new Error(`key init failed: ${init.stdout}${init.stderr}`);

  // The origin is established by the REAL human command, so the history this
  // replay reconstructs is anchored the way a real Node's would be.
  const est = run(["genesis", "root", "establish", "--node-id", NODE_ID,
    "--ceremony-id", "replay-proof", "--consent", CONSENT, "--json"]);
  if (est.status !== 0) throw new Error(`ceremony failed: ${est.stdout}${est.stderr}`);

  for (let i = 0; i < 3; i += 1) {
    const r = await cl.appendCanonicalReceipt({
      canonicalBody: { schema: "replay.proof.v0", event: "TRANSITION", n: i },
      truthLabel: cr.VALID_TRUTH_LABELS[0],
      whatProves: "one durable K0-signed transition",
      whatDoesNotProve: "nothing about host integrity",
      consent: cr.CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: home,
      now: `2026-08-11T00:1${i}:00.000Z`,
    });
    if (!r.appended) throw new Error(`append failed: ${r.error}`);
  }

  const rot = await ks.rotateAuthorshipKey({
    consent: ks.KEY_ROTATE_CONSENT_PHRASE, demaHome: home,
    retiredAt: "2026-08-11T01:00:00.000Z", reason: "replay_proof",
    envelope: { nonce: "rp-nonce", ceremony_id: "rp-cer", reason: "replay" },
  });
  if (!rot.rotated) throw new Error(`rotation failed: ${rot.error}`);

  // Transient producer state must not survive into replay. Anything the author
  // kept for its own convenience is deleted before it exits.
  const scratch = join(home, "node0", "worker-scratch");
  mkdirSync(scratch, { recursive: true });
  writeFileSync(join(scratch, "producer-memory.json"), JSON.stringify({ note: "transient" }));
  rmSync(join(home, "node0", "worker-scratch"), { recursive: true, force: true });

  emit({ phase: 1, authored: true });
}

// ── phase 2 ── a fresh interpreter, disk only ─────────────────────────────
async function phase2(home) {
  const ks = await import(P("packages/receipts/src/authorship-key-store.js"));
  const cl = await import(P("packages/receipts/src/canonical-ledger.js"));
  const cr = await import(P("packages/receipts/src/canonical-receipt.js"));
  const sg = await import(P("packages/receipts/src/authorship-signature.js"));
  const rt = await import(P("packages/genesis/src/node-root-trust.js"));
  const { existsSync } = await import("node:fs");

  /// The replayer under test: durable bytes in, reconstructed lineage out. It
  /// consults the root record, the ledger and nothing else — no worker state, no
  /// model, no in-process memory.
  const replay = async (h) => {
    const root = await rt.loadNodeRootTrust({ demaHome: h });
    if (!root.ok) return { ok: false, reason: root.reason };
    const entries = await cl.loadCanonicalLedger({ demaHome: h });
    if (entries.length === 0) return { ok: false, reason: "empty_history" };
    const walk = cr.verifyCanonicalAuthorityChain({
      entries, genesisPubkeyPem: root.rootTrustAnchorPem,
    });
    if (!walk.verified) return { ok: false, reason: walk.reason };
    return {
      ok: true,
      genesis: root.rootTrustFingerprint,
      final: walk.final_authority_fingerprint,
      successions: walk.successions.length,
      entries: entries.length,
    };
  };

  const clean = await replay(home);
  if (!clean.ok) throw new Error(`clean replay failed: ${clean.reason}`);

  const activeFp = sg.fingerprintPublicKeyPem(await ks.loadPublicKey(home));

  // ── negative controls, each on a throwaway copy ──────────────────────────
  const ledgerPath = (h) => join(h, "receipts", "canonical-ledger.ndjson");
  const copy = (tag) => {
    const c = mkdtempSync(join(tmpdir(), `replay-neg-${tag}-`));
    cpSync(home, c, { recursive: true });
    return c;
  };
  const rejects = async (c) => {
    const r = await replay(c);
    rmSync(c, { recursive: true, force: true });
    return r.ok === false;
  };

  // 1. one byte changed inside a receipt body
  const tampered = copy("tamper");
  {
    const lines = readFileSync(ledgerPath(tampered), "utf8").trim().split("\n");
    const first = JSON.parse(lines[0]);
    first.canonical_body = { ...first.canonical_body, n: 999 };
    lines[0] = JSON.stringify(first);
    writeFileSync(ledgerPath(tampered), `${lines.join("\n")}\n`);
  }
  const tampered_receipt_rejected = await rejects(tampered);

  // 2. prev_hash linkage broken by reordering
  const reordered = copy("reorder");
  {
    const lines = readFileSync(ledgerPath(reordered), "utf8").trim().split("\n");
    [lines[0], lines[1]] = [lines[1], lines[0]];
    writeFileSync(ledgerPath(reordered), `${lines.join("\n")}\n`);
  }
  const reordered_chain_rejected = await rejects(reordered);

  // 3. the genesis root removed entirely -> must fail closed, never guess
  const rootless = copy("rootless");
  rmSync(join(rootless, "genesis"), { recursive: true, force: true });
  const missing_root_rejected = await rejects(rootless);

  // 4. an unrelated key offered as the origin
  const foreign = copy("foreign");
  {
    const p = join(foreign, "genesis", "root-trust-v1.json");
    // The real record is published read-only (0o400), which is why this control
    // has to unlock its own throwaway copy before it can forge one. That EACCES
    // is itself a small fact about the store: an attacker cannot simply
    // overwrite the origin in place.
    chmodSync(p, 0o600);
    const rec = JSON.parse(readFileSync(p, "utf8"));
    const kx = sg.generateEd25519Keypair();
    rec.root_public_key_pem = kx.public_key_pem;
    rec.root_public_key_fingerprint = kx.public_key_fingerprint;
    delete rec.body_sha256; // the fingerprint re-derivation is the check under test
    writeFileSync(p, JSON.stringify(rec, null, 2));
  }
  const foreign_root_rejected = await rejects(foreign);

  const facts = {
    producer_process_exited: true,
    replayed_in_fresh_process: true,
    genesis_root_recovered: Boolean(clean.genesis),
    chain_verified_from_root: clean.ok,
    authority_succession_replayed: clean.successions > 0,
    final_authority_matches_store: clean.final === activeFp,
    worker_state_absent: !existsSync(join(home, "node0", "worker-scratch")),
    tampered_receipt_rejected,
    reordered_chain_rejected,
    missing_root_rejected,
    foreign_root_rejected,
    genesis_root_fingerprint: clean.genesis,
    final_authority_fingerprint: clean.final,
    ledger_entries: clean.entries,
    successions_replayed: clean.successions,
  };
  emit({ phase: 2, facts });
  return facts;
}

// ── driver ────────────────────────────────────────────────────────────────
const mode = argv[0];
if (mode === "--phase1") {
  await phase1(argv[1]);
} else if (mode === "--phase2") {
  await phase2(argv[1]);
} else {
  const { sha256CanonicalJsonV1 } = await import(P("packages/canon/src/sha256-canonical-json-v1.js"));
  const { buildHistoryReplayObservation } = await import(P("packages/core/src/node0-history-replay-observation.js"));
  const { currentHistoryReplayKernelHash, HISTORY_REPLAY_ARTEFACT_RELPATH } =
    await import(P("packages/core/src/node0-history-replay-adapter.js"));

  const authored = mkdtempSync(join(tmpdir(), "node0-replay-src-"));
  let code = 1;
  try {
    const one = spawnSync(process.execPath, [SELF, "--phase1", authored], { encoding: "utf8" });
    process.stderr.write(one.stderr ?? "");
    if (one.status !== 0) throw new Error("phase 1 failed");

    const two = spawnSync(process.execPath, [SELF, "--phase2", authored], { encoding: "utf8" });
    process.stderr.write(two.stderr ?? "");
    if (two.status !== 0) throw new Error("phase 2 failed");
    const facts = JSON.parse(two.stdout.trim().split("\n").pop()).facts;

    const observation = buildHistoryReplayObservation({
      facts,
      evidenceClass: "OBSERVED",
      observedAt: new Date().toISOString(),
      executedCodeHash: currentHistoryReplayKernelHash(),
      hash: sha256CanonicalJsonV1,
    });

    const artefact = join(DEMA_HOME, HISTORY_REPLAY_ARTEFACT_RELPATH);
    mkdirSync(dirname(artefact), { recursive: true });
    writeFileSync(artefact, `${JSON.stringify(observation, null, 2)}\n`);

    const report = {
      schema: "bizra.dema.node0_history_replay_proof.v0.1",
      dema_home: DEMA_HOME,
      artefact,
      replay_verdict: observation.replay_verdict,
      observed: observation.observed,
      genesis_root_fingerprint: observation.genesis_root_fingerprint,
      final_authority_fingerprint: observation.final_authority_fingerprint,
      successions_replayed: observation.successions_replayed,
      negative_controls: observation.negative_controls,
      observation_hash: observation.observation_hash,
      what_this_does_not_prove:
        "Does not prove host-level tamper resistance, endurance, or replay of any state outside the canonical ledger and the genesis root record. The producing process is spent, but the disk it wrote is trusted as durable evidence.",
    };
    if (JSON_MODE) emit(report);
    else {
      console.log(`verdict:   ${report.replay_verdict}   observed=${report.observed}`);
      console.log(`lineage:   root ${String(report.genesis_root_fingerprint).slice(0, 16)} -> current ${String(report.final_authority_fingerprint).slice(0, 16)} (${report.successions_replayed} succession)`);
      console.log(`controls:  ${Object.entries(report.negative_controls).map(([k, v]) => `${k}=${v}`).join(" ")}`);
      console.log(`artefact:  ${artefact}`);
    }
    code = observation.observed === true ? 0 : 1;
  } finally {
    rmSync(authored, { recursive: true, force: true });
  }
  process.exit(code);
}
