// PARALLEL_CONSENT_REPLAY_AUTHORITY — cutover part 1: verdict-attest.
//
// RED FIRST. Before the cutover, a nonce already claimed through the canonical
// authority can still be spent attesting a verdict, because verdict-attest
// records through the LEGACY registry and `recordConsentNonce` never looks at
// `consent/nonces-v1`. These tests assert the post-cutover law.
//
// THE PROPERTY IS "ONE AUTHORITY", NOT "BOTH AGREE". Making the legacy writer
// also refuse would leave two components entitled to decide consumption, which
// is the architecture canon rejects. The test therefore checks the CALL GRAPH,
// not merely the outcome: no live decision surface may write the legacy
// namespace at all.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attestVerdict, ATTEST_CONSENT_PHRASE, ATTEST_ACTION_TYPE } from "../packages/receipts/src/verdict-attest.js";
import { buildConsentProof } from "../packages/receipts/src/consent-proof.js";
import { initAuthorshipKey, KEY_INIT_CONSENT_PHRASE } from "../packages/receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import { claimConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";

const VALID_INPUT = Object.freeze({ name: "alice", value: 100 });
const VALID_RULE = "canonical-shape.v0.1";
const NOW = "2026-05-30T08:00:30.000Z";
const CREATED = "2026-05-30T08:00:00.000Z";
const EXPIRES = "2026-05-30T08:05:00.000Z";
const NONCE = "cd".repeat(32);

async function freshHomeWithKey() {
  const home = await mkdtemp(join(tmpdir(), "cutover-"));
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  return home;
}
const consentFor = (home, nonce) =>
  buildConsentProof({
    phrase: ATTEST_CONSENT_PHRASE,
    actionScope: { action_type: ATTEST_ACTION_TYPE, target_hash: sha256(stableStringify(VALID_INPUT)), rule_id: VALID_RULE },
    demaHome: home,
    nonce,
    createdAtIso: CREATED,
    expiresAtIso: EXPIRES,
  });
const attest = (home, cp) =>
  attestVerdict({ rule: VALID_RULE, input: VALID_INPUT, consent: ATTEST_CONSENT_PHRASE, consentProof: cp.consent_proof, demaHome: home, now: NOW });

describe("consent authority cutover · verdict-attest uses the canonical claim", () => {
  it("POSITIVE CONTROL: a first attest with an unused nonce still succeeds", async () => {
    const home = await freshHomeWithKey();
    try {
      const r = await attest(home, await consentFor(home, NONCE));
      assert.equal(r.attested, true, "the cutover must not break the happy path");
    } finally { await rm(home, { recursive: true, force: true }); }
  });

  it("attest's own replay is still refused — behaviour unchanged by the cutover", async () => {
    const home = await freshHomeWithKey();
    try {
      const cp = await consentFor(home, NONCE);
      assert.equal((await attest(home, cp)).attested, true);
      const second = await attest(home, cp);
      assert.equal(second.attested, false);
      // Only the reason code changes: the authority answering it is now named.
      assert.match(second.error, /consent_nonce_already/);
    } finally { await rm(home, { recursive: true, force: true }); }
  });

  // ── THE DEFECT THIS SLICE CLOSES ───────────────────────────────────────────
  it("a nonce already claimed CANONICALLY cannot then be spent attesting", async () => {
    const home = await freshHomeWithKey();
    try {
      const claim = await claimConsentNonce({ nonce: NONCE, demaHome: home });
      assert.equal(claim.claimed, true, "precondition: the canonical claim is taken");
      const r = await attest(home, await consentFor(home, NONCE));
      assert.equal(r.attested, false, "the canonical claim must bind attest too");
    } finally { await rm(home, { recursive: true, force: true }); }
  });

  // ── historical safety must survive the cutover ─────────────────────────────
  it("a nonce consumed under the LEGACY regime still cannot be spent attesting", async () => {
    const home = await freshHomeWithKey();
    try {
      // Cutover part 3 retired the legacy WRITER, so the historical marker is
      // seeded as history actually left it — the bytes on disk — rather than
      // through an API that no longer creates consumption. The property under
      // test is unchanged and is about the READ: legacy history must still
      // refuse. A fixture that needed the writer alive would have made
      // retirement untestable.
      const legacyDir = join(home, "consent", "nonces");
      await mkdir(legacyDir, { recursive: true, mode: 0o700 });
      await writeFile(join(legacyDir, `${NONCE}.json`), JSON.stringify({
        action_type: ATTEST_ACTION_TYPE,
        target_hash: sha256(stableStringify(VALID_INPUT)),
        consumed_at_iso: "2026-01-01T00:00:00.000Z",
        consent_proof_hash: `sha256:${"9".repeat(64)}`,
      }), { mode: 0o600 });
      assert.equal(existsSync(join(legacyDir, `${NONCE}.json`)), true, "precondition: a historical legacy marker exists");
      const r = await attest(home, await consentFor(home, NONCE));
      assert.equal(r.attested, false, "legacy history must remain a refusal, never erased");
    } finally { await rm(home, { recursive: true, force: true }); }
  });

  it("attest writes the CANONICAL store and no longer writes the legacy one", async () => {
    const home = await freshHomeWithKey();
    try {
      await attest(home, await consentFor(home, NONCE));
      const v1 = join(home, "consent", "nonces-v1");
      assert.ok(existsSync(v1) && readdirSync(v1).length === 1, "one canonical claim was created");
      // The legacy namespace must not be written by a live decision path.
      assert.equal(existsSync(join(home, "consent", "used-nonces.json")), false);
      assert.equal(existsSync(join(home, "consent", "nonces")), false);
    } finally { await rm(home, { recursive: true, force: true }); }
  });
});

// ── §6 · live call-graph regression, semantic rather than a fragile count ────
describe("consent authority cutover · no live decision surface writes the legacy store", () => {
  // Classified, not counted. Each entry states WHY it may still reference the
  // legacy writer; anything not listed is a regression.
  const ALLOWED = new Map([
    ["packages/receipts/src/consent-nonce-registry.js", "the legacy writer itself"],
    ["packages/receipts/src/consent-nonce-registry-atomic.js", "the legacy writer itself"],
    ["packages/core/src/node0-rosetta-constitution-preview.js", "documentation string only — names the file, imports nothing"],
    // corridor-closure-gatherer.js was listed here as the KNOWN REMAINING live
    // caller pending cutover part 2. Part 2 landed 2026-08-11: the gatherer's
    // adapters now commit through claimConsentNonce and it imports the legacy
    // module nowhere. The exemption is SPENT and removed — leaving it would give
    // a future regression a place to hide.
  ]);

  function liveSources(dir, out = []) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) liveSources(p, out);
      else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
  }

  it("verdict-attest no longer imports the legacy consumption writer", () => {
    const src = readFileSync("packages/receipts/src/verdict-attest.js", "utf8");
    assert.equal(/consent-nonce-registry/.test(src), false, "the live authority path must be cut over");
    assert.ok(/consent-nonce-claim/.test(src), "and must now use the canonical claim");
  });

  // A USE is an import of the legacy module or a call to its writers. A mention
  // in prose is not — verdict-attest's own cutover comment names the function it
  // stopped calling, and matching that would report the fix as the defect.
  const USES_LEGACY = (src) =>
    /from\s+["'][^"']*consent-nonce-registry[^"']*["']/.test(src) ||
    /\b(recordConsentNonce|isConsentNonceUsed)\s*\(/.test(src);

  it("every remaining USE of the legacy writer is classified", () => {
    const offenders = [];
    for (const dir of ["packages", "apps", "bin"]) {
      for (const f of liveSources(dir)) {
        const rel = f.replaceAll("\\", "/");
        if (ALLOWED.has(rel)) continue;
        if (USES_LEGACY(readFileSync(f, "utf8"))) offenders.push(rel);
      }
    }
    assert.deepEqual(offenders, [], "an unclassified live surface writes the superseded consumption namespace");
  });

  it("control: the classifier finds a real use and ignores a mere mention", () => {
    // Without both halves, the empty result above could come from a broken scan
    // OR from a scan so loose that every comment is a violation.
    //
    // The positive half was a real file — corridor-closure-gatherer.js, the last
    // known caller — until part 2 cut it over. After part 2 NO live source uses
    // the legacy writer, which is the goal and which leaves the positive control
    // with nothing real to point at. It is synthetic now, and permanently: a
    // control anchored to the last remaining offender dies the moment the
    // cutover it guards succeeds, and dies silently, leaving the empty result
    // above indistinguishable from a broken scan.
    assert.equal(USES_LEGACY(`import { recordConsentNonce } from "../receipts/src/consent-nonce-registry-atomic.js";\n`), true, "a real import must be detected");
    assert.equal(USES_LEGACY("const r = await recordConsentNonce({ nonce });\n"), true, "a real call must be detected");
    assert.equal(USES_LEGACY("if (await isConsentNonceUsed({ nonce })) return;\n"), true, "the legacy read is a use too");
    assert.equal(USES_LEGACY(readFileSync("packages/receipts/src/verdict-attest.js", "utf8")), false, "a cutover comment naming the old function is not a use");
    assert.equal(USES_LEGACY(readFileSync("packages/mission/src/corridor-closure-gatherer.js", "utf8")), false, "the part-2 cutover must read as clean, comments and all");
    assert.equal(USES_LEGACY("// we used to call recordConsentNonce here\n"), false, "prose alone must not trip it");
  });
});
