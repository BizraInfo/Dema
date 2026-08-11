import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
  establishGenesisWitness,
  loadAnchoredGenesisRoot,
} from "../packages/genesis/src/node0-genesis-witness.js";
import {
  nodeRootTrustPath,
  nodeRootTrustBodyHash,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
} from "../packages/genesis/src/node-root-trust.js";
import {
  establishNodeGenesisRoot,
  inspectGenesisRootFreshness,
  GENESIS_ROOT_REQUIRES_FRESH_NODE,
} from "../packages/genesis/src/node0-genesis-root-ceremony.js";
import {
  initAuthorshipKey,
  loadPublicKey,
  KEY_INIT_CONSENT_PHRASE,
} from "../packages/receipts/src/authorship-key-store.js";
import {
  appendCanonicalReceipt,
} from "../packages/receipts/src/canonical-ledger.js";
import {
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";

/**
 * COMPOSED-SEALED-MANIFEST-ERASURE-PROOF-1A
 *
 * The composed property, end to end: a sealed genesis record on disk, an
 * independently placed witness pin OUTSIDE DEMA_HOME, a valid authoritative
 * continuation — then erase or substitute the local evidence, restart from a
 * clean process, and the external witness must still detect prior history and
 * refuse. The critical invariant:
 *
 *   DELETING THE EVIDENCE UNDER EVALUATION CAN NEVER MANUFACTURE A NEW GENESIS.
 *
 * MEASURED SEAM, BEFORE REPAIR (this file is the red-first spec of the fix):
 * `inspectGenesisRootFreshness` read only DEMA_HOME-local facts — ledger,
 * generations, retirements, root record. Erase DEMA_HOME and every predicate
 * resets to "fresh"; `establishNodeGenesisRoot` then manufactures a new origin,
 * and the surviving witness pin only bites LATER, at ledger append. Detection
 * on first authoritative continuation is F6's floor, but the ceremony itself
 * consulting the pin is the invariant's true shape: refuse AT the ceremony.
 * The pin stays veto-only — it may block a fresh root; it may never supply one.
 *
 * HONEST SCOPE. The Block0 12-slot manifest (`block0-manifest.js`) has no disk
 * persistence anywhere in the tree yet — there is no Block0 file to erase. The
 * sealed-manifest-on-disk of the CURRENT composition is the canonical root
 * record `genesis/root-trust-v1.json` plus its external commitment, and that is
 * the object these variants erase, substitute, mutate, and rehash. When Block0
 * gains persistence, these variants extend to it.
 *
 * FIXTURE KEYS AND DISPOSABLE HOMES ONLY. No real ~/.dema, no real pin, no
 * founder identity. The genesis SIGNER remains an operator authority gate.
 */

const AT = "2026-08-12T00:00:00.000Z";
const NODE = "node0-erasure-fixture";
const CEREMONY = "erasure-ceremony-1";
const LABEL = VALID_TRUTH_LABELS[0];

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "erc-home-"));
  const trust = mkdtempSync(join(tmpdir(), "erc-trust-"));
  return { home, trust, witnessPath: join(trust, "genesis-witness-v1.json") };
}
const cleanup = (f) => {
  rmSync(f.home, { recursive: true, force: true });
  rmSync(f.trust, { recursive: true, force: true });
};

/** Sovereign lifecycle up to "continuation valid": key → root (via the real
 *  ceremony) → witness pin. Returns K0 pem. */
async function establishedNode(f) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE, demaHome: f.home, now: AT,
  });
  assert.equal(r.initialized, true, r.error ?? "");
  const c = await establishNodeGenesisRoot({
    demaHome: f.home, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId: CEREMONY, now: AT, witnessPath: f.witnessPath,
  });
  assert.equal(c.established, true, c.reason ?? "");
  const w = await establishGenesisWitness({
    demaHome: f.home, witnessPath: f.witnessPath, nodeId: NODE, ceremonyId: CEREMONY,
    consent: WITNESS_GENESIS_ROOT_CONSENT_PHRASE, witnessedAt: AT,
  });
  assert.equal(w.ok, true, w.reason ?? "");
  return loadPublicKey(f.home);
}

async function appendHistory(f, n = 1) {
  for (let i = 0; i < n; i += 1) {
    const r = await appendCanonicalReceipt({
      canonicalBody: { schema: "erc.probe.v0", event: "PROBE", n: i },
      truthLabel: LABEL, whatProves: "fixture history", whatDoesNotProve: "nothing beyond it",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: f.home,
      now: `2026-08-12T00:1${i}:00.000Z`,
    });
    assert.equal(r.appended, true, r.error ?? "");
  }
}

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

// ── ERC-01 ── original intact → PASS, and the ceremony refuses a second origin
test("ERC-01: intact composition anchors, and a second ceremony cannot re-originate", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, true, anchored.reason ?? "");

    const again = await establishNodeGenesisRoot({
      demaHome: f.home, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
      ceremonyId: "erasure-ceremony-2", now: AT, witnessPath: f.witnessPath,
    });
    assert.equal(again.established, false);
    assert.equal(again.reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
    assert.ok(again.blocked_by.includes("root_trust_already_established"));
  } finally { cleanup(f); }
});

// ── ERC-02 ── THE INVARIANT: full local erasure cannot manufacture a new Genesis
test("ERC-02: erasing DEMA_HOME cannot manufacture a new Genesis while the pin survives", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    await appendHistory(f, 2);

    // Erase the entire local world — root record, ledger, keys, everything.
    rmSync(f.home, { recursive: true, force: true });
    // Re-key the "fresh" impostor node exactly as a real fresh node would.
    const r = await initAuthorshipKey({
      consent: KEY_INIT_CONSENT_PHRASE, demaHome: f.home, now: AT,
    });
    assert.equal(r.initialized, true, r.error ?? "");

    // Anchor-blind negative control: without the pin the erased node LOOKS
    // fresh. This pins that the refusal below comes from the witness
    // consultation and from nothing else.
    const blind = await inspectGenesisRootFreshness({ demaHome: f.home });
    assert.equal(blind.fresh, true,
      "control: erasure resets every DEMA_HOME-local freshness predicate");

    // The composed law: the ceremony consults the surviving out-of-home pin.
    const witnessed = await inspectGenesisRootFreshness({
      demaHome: f.home, witnessPath: f.witnessPath,
    });
    assert.equal(witnessed.fresh, false);
    assert.ok(witnessed.blocked_by.includes("genesis_witness_pin_present"),
      `blocked_by=${JSON.stringify(witnessed.blocked_by)}`);

    const forged = await establishNodeGenesisRoot({
      demaHome: f.home, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
      ceremonyId: "post-erasure", now: AT, witnessPath: f.witnessPath,
    });
    assert.equal(forged.established, false);
    assert.equal(forged.reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
    assert.ok(forged.blocked_by.includes("genesis_witness_pin_present"));
  } finally { cleanup(f); }
});

// ── ERC-03 ── sealed record deleted alone → continuation refuses; ceremony refuses
test("ERC-03: deleting the sealed root record refuses continuation and re-origination", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    rmSync(nodeRootTrustPath(f.home), { force: true });

    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, false);
    assert.equal(anchored.reason, "root_trust_unavailable");

    const again = await establishNodeGenesisRoot({
      demaHome: f.home, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
      ceremonyId: "post-delete", now: AT, witnessPath: f.witnessPath,
    });
    assert.equal(again.established, false);
    assert.ok(again.blocked_by.includes("genesis_witness_pin_present"));
  } finally { cleanup(f); }
});

// ── ERC-04 ── sealed record substituted by a coherent attacker record → REFUSE
test("ERC-04: substituted root with attacker key is refused by the composed reader", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const { generateEd25519Keypair } =
      await import("../packages/receipts/src/authorship-signature.js");
    const attacker = generateEd25519Keypair();
    forgeRoot(f.home, (r) => ({
      ...r,
      root_public_key_pem: attacker.public_key_pem,
      root_public_key_fingerprint: attacker.public_key_fingerprint,
    }));
    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, false, "a substituted origin must not anchor");
  } finally { cleanup(f); }
});

// ── ERC-05/06 ── content modified · rehashed locally → REFUSE (commitment law)
test("ERC-05: mutated-and-rehashed sealed record still refused — self-rehash is not proof", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    forgeRoot(f.home, (r) => ({ ...r, established_at: "2099-01-01T00:00:00.000Z" }));
    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, false);
    assert.equal(anchored.reason, "genesis_witness_commitment_mismatch");
  } finally { cleanup(f); }
});

// ── ERC-07 ── witness truncated → REFUSE everywhere; corrupt pin ≠ absent pin
test("ERC-07: a truncated witness fails closed for continuation AND for the ceremony", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    // The pin ships write-protected; truncation here models a corrupting actor
    // with file ownership, not a casual overwrite.
    chmodSync(f.witnessPath, 0o600);
    writeFileSync(f.witnessPath, readFileSync(f.witnessPath, "utf8").slice(0, 40));

    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, false, "a truncated pin must never anchor");

    rmSync(f.home, { recursive: true, force: true });
    await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: f.home, now: AT });
    const witnessed = await inspectGenesisRootFreshness({
      demaHome: f.home, witnessPath: f.witnessPath,
    });
    assert.equal(witnessed.fresh, false,
      "a corrupt pin is NOT an absent pin — the ceremony must refuse, not shrug");
    assert.ok(witnessed.blocked_by.some((b) => b.startsWith("genesis_witness_unreadable:")),
      `blocked_by=${JSON.stringify(witnessed.blocked_by)}`);
  } finally { cleanup(f); }
});

// ── ERC-08 ── witness substituted with another node's pin → REFUSE
test("ERC-08: a substituted witness from a different origin refuses the real root", async () => {
  const f = fixture();
  const g = fixture();
  try {
    await establishedNode(f);
    await establishedNode(g);
    chmodSync(f.witnessPath, 0o600);
    writeFileSync(f.witnessPath, readFileSync(g.witnessPath, "utf8"));
    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, false, "an alien pin must not anchor this root");
  } finally { cleanup(f); cleanup(g); }
});

// ── ERC-09 ── unrelated but internally valid node vs the original witness → REFUSE
test("ERC-09: an unrelated coherent node cannot continue under the original witness", async () => {
  const f = fixture();
  const g = fixture();
  try {
    await establishedNode(f);
    await establishedNode(g);
    // g's world is internally valid — against ITS pin it anchors.
    const own = await loadAnchoredGenesisRoot({ demaHome: g.home, witnessPath: g.witnessPath });
    assert.equal(own.ok, true, "control: the unrelated node is internally coherent");
    // Against f's surviving pin it must refuse.
    const cross = await loadAnchoredGenesisRoot({ demaHome: g.home, witnessPath: f.witnessPath });
    assert.equal(cross.ok, false, "coherence is not identity — the pin binds one origin");
  } finally { cleanup(f); cleanup(g); }
});

// ── ERC-10 ── genuine monotonic extension → PASS, ceremony still refuses re-origin
test("ERC-10: legitimate history extension keeps anchoring; origin stays unmanufacturable", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    await appendHistory(f, 3);
    const anchored = await loadAnchoredGenesisRoot({ demaHome: f.home, witnessPath: f.witnessPath });
    assert.equal(anchored.ok, true, anchored.reason ?? "");

    const again = await establishNodeGenesisRoot({
      demaHome: f.home, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
      ceremonyId: "post-extension", now: AT, witnessPath: f.witnessPath,
    });
    assert.equal(again.established, false);
    assert.ok(again.blocked_by.includes("canonical_history_exists"));
    assert.ok(again.blocked_by.includes("root_trust_already_established"));
  } finally { cleanup(f); }
});

// ── ERC-12 ── the law is WIRED: the one production ceremony path passes the pin
test("ERC-12: the CLI ceremony adapter consults the witness pin", () => {
  const src = readFileSync(
    new URL("../apps/cli/src/commands/genesis.js", import.meta.url), "utf8");
  assert.ok(src.includes("resolveWitnessPath"),
    "the CLI must resolve the pin path at the authority boundary");
  const call = src.slice(src.indexOf("await establishNodeGenesisRoot({"));
  assert.ok(call.slice(0, call.indexOf("});")).includes("witnessPath:"),
    "a hardened kernel nothing calls is not a defence — the ceremony call must pass witnessPath");
});

// ── ERC-11 ── restart from a clean process: disk alone decides, both directions
test("ERC-11: a fresh OS process anchors the intact world and refuses the erased one", async () => {
  const f = fixture();
  try {
    await establishedNode(f);
    const probe = (home, witnessPath) => execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { loadAnchoredGenesisRoot } from ${JSON.stringify(
        new URL("../packages/genesis/src/node0-genesis-witness.js", import.meta.url).href
      )};
      const r = await loadAnchoredGenesisRoot({ demaHome: ${JSON.stringify(home)}, witnessPath: ${JSON.stringify(witnessPath)} });
      process.stdout.write(JSON.stringify({ ok: r.ok, reason: r.reason ?? null }));
    `], { cwd: import.meta.dirname, encoding: "utf8" });

    const intact = JSON.parse(probe(f.home, f.witnessPath));
    assert.equal(intact.ok, true, intact.reason ?? "");

    rmSync(f.home, { recursive: true, force: true });
    const erased = JSON.parse(probe(f.home, f.witnessPath));
    assert.equal(erased.ok, false, "after erasure a clean process must refuse from disk alone");
  } finally { cleanup(f); }
});
