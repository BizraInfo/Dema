import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  establishNodeGenesisRoot,
  inspectGenesisRootFreshness,
  GENESIS_ROOT_CEREMONY_SCHEMA,
  GENESIS_ROOT_REQUIRES_FRESH_NODE,
  ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-genesis-root-ceremony.js";
import {
  loadNodeRootTrust,
  nodeRootTrustPath,
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
  CANONICAL_RECEIPT_CONSENT_PHRASE,
  VALID_TRUTH_LABELS,
} from "../packages/receipts/src/canonical-receipt.js";
import { fingerprintPublicKeyPem } from "../packages/receipts/src/authorship-signature.js";
import {
  establishGenesisWitness,
  WITNESS_GENESIS_ROOT_CONSENT_PHRASE,
} from "../packages/genesis/src/node0-genesis-witness.js";
import { buildLedgerAppender } from "../packages/mission/src/corridor-closure-gatherer.js";

/**
 * NODE0-GENESIS-ROOT-BOOTSTRAP-CEREMONY-1A — the human act that gives a Node an
 * origin, and the law that it may happen only once, only at the beginning.
 *
 * WHAT THE PREVIOUS SLICE LEFT OPEN. PROVISIONED-ROOT-TRUST-BOUNDARY-1A proved
 * a provisioned root works: one production consumer verified a K0-signed history
 * across K0 -> K1 through it. But the number of production paths that could
 * ESTABLISH that root was ZERO — only tests called `provisionNodeRootTrust`. A
 * primitive no human can reach is not yet part of the habitat.
 *
 * SO THE SUBJECT HERE IS THE HUMAN PATH ITSELF. GRC-01 and GRC-07 drive the
 * REAL `bin/dema` binary in a child process, not the kernel — because "a human
 * can establish this Node's origin" is a claim about a shipped command, and a
 * test that called the kernel directly would prove the kernel and say nothing
 * about whether anyone can reach it.
 *
 * ORIGIN PRECEDES HISTORY is the law under test in GRC-05 and GRC-06: once
 * canonical receipts exist or a rotation has completed, any root written now
 * would be an ancestor manufactured after the fact. The ceremony refuses.
 *
 * GRC-08 is the containment proof, and it is deliberately NOT a comment: it
 * walks the real import closure of the mission runtime and proves the
 * provisioning capability is not reachable from it. It carries its own positive
 * control, because a walker that resolves nothing reports "unreachable" for
 * everything and reads exactly like a clean pass.
 *
 * GRC-10 is the negative-control integrity test: an always-refusing bootstrap
 * satisfies every refusal row above, so the full path must be shown to DEPEND
 * on the ceremony actually happening.
 *
 * FIXTURE KEYS ONLY. Disposable DEMA_HOME only. No real home, no real keys.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMA = join(REPO, "bin/dema");
const LABEL = VALID_TRUTH_LABELS[0];
const NODE = "grc-node0";
const CEREMONY = "grc-ceremony-1";
const AT = "2026-08-11T00:00:00.000Z";

const home = () => mkdtemp(join(tmpdir(), "grc-"));

/// The ceremony pin lives OUTSIDE the home it guards.
const witnessFor = (h) => `${h}-witness.json`;

/// Pin an already-established root, so a fixture reaches the state production
/// requires: genesis is not established until BOTH the root and its pin exist.
async function pin(h, ceremonyId = CEREMONY) {
  return establishGenesisWitness({
    demaHome: h, witnessPath: witnessFor(h), nodeId: NODE, ceremonyId,
    consent: WITNESS_GENESIS_ROOT_CONSENT_PHRASE, witnessedAt: AT,
  });
}

/** Drive the REAL shipped CLI. Returns {code, out} — never throws on refusal. */
function dema(home, args) {
  try {
    const out = execFileSync("node", [DEMA, ...args], {
      cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

async function cliEstablish(h, extra = []) {
  const r = dema(h, ["genesis", "root", "establish", "--node-id", NODE,
    "--ceremony-id", CEREMONY, "--consent", ESTABLISH_ROOT_TRUST_CONSENT_PHRASE, ...extra]);
  // The pin is the sovereign act's durable half. The CLI does not write it (that
  // is its own consent), so the fixture performs it explicitly.
  if (r.code === 0) await pin(h, extra.includes("--ceremony-id") ? extra[extra.indexOf("--ceremony-id") + 1] : CEREMONY);
  return r;
}

const kernelEstablish = (h, over = {}) =>
  establishNodeGenesisRoot({
    demaHome: h, nodeId: NODE, consent: ESTABLISH_ROOT_TRUST_CONSENT_PHRASE,
    ceremonyId: CEREMONY, now: "2026-08-11T00:00:00.000Z", ...over,
  });

async function initK0(h) {
  const r = await initAuthorshipKey({
    consent: KEY_INIT_CONSENT_PHRASE, demaHome: h, now: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(r.initialized, true, r.error ?? "");
  return loadPublicKey(h);
}

async function appendHistory(h, n = 1) {
  for (let i = 0; i < n; i += 1) {
    const r = await appendCanonicalReceipt({
      canonicalBody: { schema: "grc.probe.v0", event: "PROBE", n: i },
      truthLabel: LABEL, whatProves: "fixture history", whatDoesNotProve: "nothing beyond it",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE, demaHome: h,
      now: `2026-08-11T00:1${i}:00.000Z`,
    });
    assert.equal(r.appended, true, r.error ?? "");
  }
}

async function rotate(h) {
  const r = await rotateAuthorshipKey({
    consent: KEY_ROTATE_CONSENT_PHRASE, demaHome: h, retiredAt: "2026-08-11T01:00:00.000Z",
    reason: "grc_rotation", envelope: { nonce: "grc-n", ceremony_id: "grc-c", reason: "grc" },
  });
  assert.equal(r.rotated, true, r.error ?? "");
  return loadPublicKey(h);
}

/** The already-qualified production historical consumer, driven as production drives it. */
async function productionConsumer(h, txId = "grc-transaction") {
  const append = buildLedgerAppender({
    demaHome: h, now: "2026-08-11T02:00:00.000Z", transactionId: txId,
    witnessPath: witnessFor(h),
  });
  return append({
    canonicalBody: { closure_transaction_id: txId, omega0_seal_head: "e".repeat(64) },
    truthLabel: "MEASURED_LOCAL",
  });
}

/** Durable bytes of the root record, or null when absent. */
async function rootBytes(h) {
  try { return await readFile(nodeRootTrustPath(h), "utf8"); } catch { return null; }
}

// ── GRC-01 ────────────────────────────────────────────────────────────────
test("GRC-01: a human establishes a fresh Node's genesis root through the real CLI", async () => {
  const h = await home();
  const K0 = await initK0(h);

  const r = await cliEstablish(h, ["--json"]);
  assert.equal(r.code, 0, r.out);
  const report = JSON.parse(r.out);
  assert.equal(report.schema, GENESIS_ROOT_CEREMONY_SCHEMA);
  assert.equal(report.established, true);
  assert.equal(report.authority_delta, 0);
  assert.equal(report.node_id, NODE);
  assert.equal(report.root_public_key_fingerprint, fingerprintPublicKeyPem(K0));
  assert.equal(report.boundary.bootstrap_authority, true);
  assert.equal(report.boundary.mission_capability, false);

  // The root the CLI wrote is readable by the ordinary production reader and is
  // byte-identical to K0 — not merely "a key with the same fingerprint".
  const loaded = await loadNodeRootTrust({ demaHome: h, expectedNodeId: NODE });
  assert.equal(loaded.ok, true, loaded.reason ?? "");
  assert.equal(loaded.rootTrustAnchorPem, K0);

  // No private key material may reach the record or the CLI's own output.
  assert.doesNotMatch(await rootBytes(h), /PRIVATE KEY/);
  assert.doesNotMatch(r.out, /PRIVATE KEY/);
});

// ── GRC-02 ────────────────────────────────────────────────────────────────
test("GRC-02: no consent refuses and writes zero root bytes", async () => {
  const h = await home();
  await initK0(h);

  const cli = dema(h, ["genesis", "root", "establish", "--node-id", NODE,
                       "--ceremony-id", CEREMONY, "--json"]);
  assert.equal(cli.code, 1);
  assert.equal(JSON.parse(cli.out).reason, "consent_required");

  const kernel = await kernelEstablish(h, { consent: undefined });
  assert.equal(kernel.established, false);
  assert.equal(kernel.reason, "consent_required");
  assert.equal(kernel.authority_delta, 0);
  assert.equal(await rootBytes(h), null, "an unconsented ceremony must write nothing");
});

// ── GRC-03 ────────────────────────────────────────────────────────────────
test("GRC-03: a wrong or near-miss phrase refuses and writes zero root bytes", async () => {
  const h = await home();
  await initK0(h);
  // The key-init phrase is the dangerous near-miss: consenting to MAKE a key is
  // not consenting to establish a permanent origin.
  for (const phrase of [KEY_INIT_CONSENT_PHRASE, KEY_ROTATE_CONSENT_PHRASE, "",
                        ESTABLISH_ROOT_TRUST_CONSENT_PHRASE.toLowerCase(),
                        ` ${ESTABLISH_ROOT_TRUST_CONSENT_PHRASE} `]) {
    const r = await kernelEstablish(h, { consent: phrase });
    assert.equal(r.established, false, `phrase ${JSON.stringify(phrase)} must not establish`);
    assert.equal(r.reason, "consent_required");
    assert.equal(await rootBytes(h), null);
  }
  const cli = dema(h, ["genesis", "root", "establish", "--node-id", NODE,
                       "--ceremony-id", CEREMONY, "--consent", KEY_INIT_CONSENT_PHRASE]);
  assert.equal(cli.code, 1);
  assert.equal(await rootBytes(h), null);
});

// ── GRC-04 ────────────────────────────────────────────────────────────────
test("GRC-04: a second ceremony refuses with zero durable byte change", async () => {
  const h = await home();
  await initK0(h);
  assert.equal((await cliEstablish(h)).code, 0);

  const before = await rootBytes(h);
  const beforeStat = await stat(nodeRootTrustPath(h));

  const second = await cliEstablish(h, ["--ceremony-id", "grc-ceremony-2", "--json"]);
  assert.equal(second.code, 1);
  const report = JSON.parse(second.out);
  assert.equal(report.established, false);
  assert.equal(report.reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
  assert.ok(report.blocked_by.includes("root_trust_already_established"));

  assert.equal(await rootBytes(h), before, "a refused ceremony must not change one byte");
  assert.equal((await stat(nodeRootTrustPath(h))).mtimeMs, beforeStat.mtimeMs);
});

// ── GRC-05 ────────────────────────────────────────────────────────────────
test("GRC-05: canonical history already exists — the ceremony may not manufacture an ancestor", async () => {
  const h = await home();
  await initK0(h);
  await appendHistory(h, 1);

  const fresh = await inspectGenesisRootFreshness({ demaHome: h });
  assert.equal(fresh.fresh, false);
  assert.ok(fresh.blocked_by.includes("canonical_history_exists"));
  assert.equal(fresh.ledger_entries, 1);

  const r = await cliEstablish(h, ["--json"]);
  assert.equal(r.code, 1);
  const report = JSON.parse(r.out);
  assert.equal(report.reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
  assert.ok(report.blocked_by.includes("canonical_history_exists"));
  assert.equal(await rootBytes(h), null);
});

// ── GRC-06 ────────────────────────────────────────────────────────────────
test("GRC-06: a prior rotation blocks the ceremony — K1 is never promoted to genesis", async () => {
  const h = await home();
  const K0 = await initK0(h);
  const K1 = await rotate(h);
  assert.notEqual(fingerprintPublicKeyPem(K1), fingerprintPublicKeyPem(K0));

  const fresh = await inspectGenesisRootFreshness({ demaHome: h });
  assert.equal(fresh.fresh, false);
  // Both independent witnesses of a past must fire: an extra generation AND a
  // completed retirement. Either alone would be enough; requiring both here
  // pins that the ceremony reads two separate facts, not one twice.
  assert.ok(fresh.blocked_by.includes("prior_authorship_generation"), fresh.blocked_by.join(","));
  assert.ok(fresh.blocked_by.includes("prior_key_retirement"), fresh.blocked_by.join(","));
  assert.equal(fresh.generation_count, 2);
  assert.equal(fresh.retired_count, 1);

  const r = await cliEstablish(h, ["--json"]);
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.out).reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
  assert.equal(await rootBytes(h), null,
    "the current key must never be silently written as this Node's origin");
});

// ── GRC-07 ── the whole causal path ───────────────────────────────────────
test("GRC-07: human ceremony -> K0 history -> K0->K1 -> production verification PASSES", async () => {
  const h = await home();
  const K0 = await initK0(h);

  // The ONLY establishment step, performed by the real shipped command.
  assert.equal((await cliEstablish(h)).code, 0);

  await appendHistory(h, 2);
  const K1 = await rotate(h);

  const out = await productionConsumer(h);
  assert.equal(out.ok, true, "post-rotation production verification must pass through the root");

  const root = await loadNodeRootTrust({ demaHome: h });
  const activeFp = fingerprintPublicKeyPem(await loadPublicKey(h));
  assert.equal(root.rootTrustFingerprint, fingerprintPublicKeyPem(K0), "root == K0");
  assert.equal(activeFp, fingerprintPublicKeyPem(K1), "current authority == K1");
  assert.notEqual(root.rootTrustFingerprint, activeFp, "root and current authority differ");
});

// ── GRC-08 ── containment ─────────────────────────────────────────────────
test("GRC-08: the provisioning capability is unreachable from the mission runtime", async () => {
  // Roots a model can drive by invoking ordinary mission tooling.
  const RUNTIME_ROOTS = ["packages/mission", "packages/flywheel", "packages/agents", "packages/think"];
  const CEREMONY_MODULE = resolve(REPO, "packages/genesis/src/node0-genesis-root-ceremony.js");
  const ROOT_TRUST_MODULE = resolve(REPO, "packages/genesis/src/node-root-trust.js");

  const sources = (dir, acc = []) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules") continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) sources(p, acc);
      else if (entry.endsWith(".js") || entry.endsWith(".mjs")) acc.push(p);
    }
    return acc;
  };

  /** Transitive closure over RELATIVE imports, which is how this tree links. */
  function closure(seeds) {
    const seen = new Set();
    const queue = [...seeds];
    while (queue.length) {
      const file = queue.pop();
      if (seen.has(file) || !existsSync(file)) continue;
      seen.add(file);
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']/g)) {
        queue.push(resolve(dirname(file), m[1] ?? m[2]));
      }
    }
    return seen;
  }

  const seeds = RUNTIME_ROOTS.flatMap((r) => sources(join(REPO, r)));
  assert.ok(seeds.length > 20, `precondition: runtime seed set is real (${seeds.length})`);
  const reachable = closure(seeds);

  // POSITIVE CONTROL. A walker that resolves nothing would report every module
  // unreachable and read exactly like a clean pass. node-root-trust.js IS
  // legitimately reachable from the mission runtime — the corridor READS the
  // root — so seeing it proves the walker actually walks.
  assert.ok(reachable.has(ROOT_TRUST_MODULE),
    "walker control failed: the root-trust READER must be reachable from mission runtime");

  assert.equal(reachable.has(CEREMONY_MODULE), false,
    "the genesis ceremony must NOT be reachable from mission runtime");

  // And the provisioning WRITE itself has exactly one production importer: the
  // ceremony. Module-unreachability plus a single known importer is what makes
  // "a model cannot establish its own origin" a structural fact.
  const production = ["packages", "apps", "bin", "scripts"]
    .filter((d) => existsSync(join(REPO, d)))
    .flatMap((d) => sources(join(REPO, d)))
    .filter((f) => !f.includes(`${REPO}/tests/`));
  const importers = production.filter((f) =>
    /\bprovisionNodeRootTrust\b/.test(readFileSync(f, "utf8")));
  assert.deepEqual(
    importers.map((f) => f.slice(REPO.length + 1)).sort(),
    ["packages/genesis/src/node-root-trust.js",
     "packages/genesis/src/node0-genesis-root-ceremony.js",
     "scripts/proof/provisioned-root-trust-proof.mjs"],
    "exactly one definition, one bootstrap caller, one proof harness — and nothing else",
  );
  for (const f of importers) {
    assert.ok(!RUNTIME_ROOTS.some((r) => f.startsWith(join(REPO, r))),
      `mission-runtime file must not reference the provisioning API: ${f}`);
  }
});

// ── GRC-09 ────────────────────────────────────────────────────────────────
test("GRC-09: a key without a ceremony fails the production historical consumer closed", async () => {
  const h = await home();
  await initK0(h);
  await appendHistory(h, 1);
  // The key exists and is the chain's first signer; the ceremony never happened.
  assert.equal((await loadNodeRootTrust({ demaHome: h })).reason, "root_trust_unavailable");
  await assert.rejects(() => productionConsumer(h), /root_trust_unavailable/);
});

// ── GRC-10 ── negative-control integrity ──────────────────────────────────
test("GRC-10: the full path DEPENDS on the ceremony — skipping it fails GRC-01 and GRC-07", async () => {
  // An always-refusing bootstrap satisfies GRC-02…GRC-06 and GRC-09 trivially.
  // So run the exact GRC-07 sequence with the establishment step omitted, which
  // is precisely what an always-refusing command would leave behind.
  const h = await home();
  await initK0(h);
  /* ceremony deliberately skipped */
  await appendHistory(h, 2);
  await rotate(h);

  // GRC-01's assertion fails: no root can be read.
  const absent = await loadNodeRootTrust({ demaHome: h });
  assert.equal(absent.ok, false);
  assert.equal(absent.reason, "root_trust_unavailable");

  // GRC-07's assertion fails: the production consumer refuses.
  await assert.rejects(() => productionConsumer(h), /root_trust_unavailable/);

  // And the same sequence WITH the ceremony passes — so the difference is the
  // ceremony and nothing else about the fixture.
  const ok = await home();
  await initK0(ok);
  assert.equal((await cliEstablish(ok)).code, 0);
  await appendHistory(ok, 2);
  await rotate(ok);
  assert.equal((await productionConsumer(ok)).ok, true);
});

// ── freshness inspector controls ──────────────────────────────────────────
test("GRC-F1: a genuinely fresh Node reports fresh with every predicate measured", async () => {
  const h = await home();
  await initK0(h);
  const fresh = await inspectGenesisRootFreshness({ demaHome: h });
  assert.equal(fresh.fresh, true, fresh.blocked_by.join(","));
  assert.deepEqual(fresh.blocked_by, []);
  assert.equal(fresh.ledger_entries, 0);
  assert.equal(fresh.generation_count, 1);
  assert.equal(fresh.retired_count, 0);
  assert.ok(fresh.active_fingerprint);
});

test("GRC-F2: unreadable state refuses rather than reading as fresh", async () => {
  const h = await home();
  await initK0(h);
  // A corrupt retirement registry is "I cannot tell", which is not "fresh".
  await writeFile(join(h, "keys", "retired-registry.json"), "{{{not json", "utf8");
  const fresh = await inspectGenesisRootFreshness({ demaHome: h });
  assert.equal(fresh.fresh, false);
  assert.ok(fresh.blocked_by.some((r) => r.startsWith("retired_registry_unreadable")),
    fresh.blocked_by.join(","));
  const r = await kernelEstablish(h);
  assert.equal(r.established, false);
  assert.equal(r.reason, GENESIS_ROOT_REQUIRES_FRESH_NODE);
  assert.equal(await rootBytes(h), null);
});

test("GRC-F3: identity and ceremony ids are required, never derived", async () => {
  const h = await home();
  await initK0(h);
  assert.equal((await kernelEstablish(h, { nodeId: "" })).reason, "node_id_required");
  assert.equal((await kernelEstablish(h, { ceremonyId: "" })).reason, "ceremony_id_required");
  assert.equal(await rootBytes(h), null);
  const cli = dema(h, ["genesis", "root", "establish", "--ceremony-id", CEREMONY,
                       "--consent", ESTABLISH_ROOT_TRUST_CONSENT_PHRASE]);
  assert.equal(cli.code, 1);
  assert.match(cli.out, /Node id required/);
});
