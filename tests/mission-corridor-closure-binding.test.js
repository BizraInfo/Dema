// CCB-01…08 — CORRIDOR-CLOSURE-BINDING-1A.
//
// mission-corridor-closure.test.js proves the WELD's contract against injected
// doubles. This file proves the BINDING: that the CLI path drives a real
// corridor on disk from CREATED to COMPLETE through real consent, a real
// O_EXCL nonce store, a real signed receipt ledger and a real anchor log — and
// that the guards refuse when attacked rather than merely being well-shaped.
//
// The distinction matters because the weld's own header records its ceiling:
// a forged registry ({ has: () => false }) still yields COMPLETE. Only a caller
// bound to actual bytes closes that, and only a test that drives that caller
// can prove it closed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyCorridorJournal, buildCorridorConsentContext } from "../packages/mission/src/mission-corridor.js";
import { verifyCanonicalLedger } from "../packages/receipts/src/canonical-ledger.js";
import {
  buildDiskConsentRegistry, buildRenameEffectAdapter, readClosureAnchorLog,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import { initAuthorshipKey, KEY_INIT_CONSENT_PHRASE, loadPublicKey } from "../packages/receipts/src/authorship-key-store.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMA = join(REPO, "bin/dema");
const ID = "ccb-closure-probe";

const newHome = () => mkdtemp(join(tmpdir(), "ccb-"));
const future = () => new Date(Date.now() + 3_600_000).toISOString();

function run(home, args, { allowFail = false } = {}) {
  try {
    return execFileSync("node", [DEMA, ...args, "--dema-home", home, "--json"], {
      cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home },
    });
  } catch (e) {
    if (allowFail) return `${e.stdout ?? ""}${e.stderr ?? ""}`;
    throw new Error(`dema ${args.join(" ")} failed: ${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
}

// Two-step root-bound consent, exactly as an operator performs it: read the
// card, then authorise precisely that context.
function consented(home, args, nonce, extra = []) {
  const expires = future();
  const base = [...args, "--nonce", nonce, "--expires", expires];
  const card = JSON.parse(run(home, base));
  assert.equal(card.step, "CONSENT_CARD", "step 1 must write nothing and print a card");
  return {
    card,
    result: JSON.parse(run(home, [...base, "--consent", card.required_phrase, "--consent-context", card.consent_context_hash, ...extra])),
  };
}

// `start` is the one write whose consent also commits the contract TIMESTAMP:
// the card fixes created_at_iso and the authorizing run must carry it back, so
// a later clock can never silently change the contract the operator approved.
async function startedCorridor(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const expires = future();
  const args = [
    "mission", "corridor", "start", "--id", ID,
    "--objective", "CCB probe: drive one corridor to a verified COMPLETE",
    "--base-sha", "0".repeat(40), "--nonce", "ccb-start", "--expires", expires,
  ];
  const card = JSON.parse(run(home, args));
  assert.equal(card.step, "CONSENT_CARD");
  const started = JSON.parse(run(home, [
    ...args, "--created-at", card.created_at_iso,
    "--consent", card.required_phrase, "--consent-context", card.consent_context_hash,
  ]));
  assert.equal(started.ok, true, "corridor must start");
  return started;
}

const WALK = ["PREFLIGHT", "PLANNING", "IMPLEMENTING", "VERIFYING", "SAT_REVIEW", "CHECKPOINT"];

async function walkToCheckpoint(home) {
  let n = 0;
  for (const to of WALK) {
    const { result } = consented(home, ["mission", "corridor", "advance", ID, "--to", to], `ccb-adv-${++n}`);
    assert.equal(result.state, to, `advance to ${to} must land`);
  }
}

async function seedEstate(home, name = "closure-evidence.draft.json") {
  const estate = join(home, "missions", ID, "estate");
  await mkdir(estate, { recursive: true, mode: 0o700 });
  await writeFile(join(estate, name), JSON.stringify({ claim: "ccb probe" }) + "\n", { mode: 0o600 });
  return estate;
}

describe("CCB · corridor closure BINDING — real consent, real nonces, real ledger, real anchor", () => {

  test("CCB-01: advance walks CREATED→CHECKPOINT and every event stays chain-valid", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);

    const dir = join(home, "missions", ID);
    const doc = JSON.parse(await readFile(join(dir, "contract.json"), "utf8"));
    const journal = (await readFile(join(dir, "journal.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(journal.length, 7, "CREATED + six advances");
    assert.equal(journal[journal.length - 1].state, "CHECKPOINT");
    assert.equal(verifyCorridorJournal({ contract: doc.contract, contract_hash: doc.contract_hash, journal }).ok, true);
  });

  test("CCB-02: a transition outside the closed map is refused, nothing written", async () => {
    const home = await newHome();
    await startedCorridor(home);
    const out = run(home, ["mission", "corridor", "advance", ID, "--to", "VERIFYING",
      "--nonce", "ccb-bad", "--expires", future()], { allowFail: true });
    assert.match(out, /transition not allowed: CREATED → VERIFYING/);
    const journal = (await readFile(join(home, "missions", ID, "journal.jsonl"), "utf8")).trim().split("\n");
    assert.equal(journal.length, 1, "a refused advance must not append");
  });

  test("CCB-03: advance can never reach a terminal state — terminals have their own consent kinds", async () => {
    const home = await newHome();
    await startedCorridor(home);
    for (const terminal of ["COMPLETE", "STOPPED"]) {
      const out = run(home, ["mission", "corridor", "advance", ID, "--to", terminal,
        "--nonce", `ccb-t-${terminal}`, "--expires", future()], { allowFail: true });
      // COMPLETE is caught by the CLI guard (it has its own verb); STOPPED is
      // caught deeper, by the consent kernel itself. Either is a real refusal.
      assert.match(
        out,
        /not reachable via advance|transition not allowed|advance_to_terminal_forbidden/i,
        `advance → ${terminal} must refuse`,
      );
    }
    // and the kernel refuses it independently of the CLI's own guard
    const ctx = buildCorridorConsentContext({
      kind: "ADVANCE", mission_id: ID, contract_hash: `sha256:${"0".repeat(64)}`,
      mission_root: "/tmp/x", nonce: "n", expires_at: future(), requested_state: "STOPPED",
    });
    assert.equal(ctx.ok, false);
    assert.ok(ctx.blocked_by.includes("advance_to_terminal_forbidden"));
  });

  test("CCB-04: an ADVANCE consent for one state cannot authorize a different state", async () => {
    const common = {
      kind: "ADVANCE", mission_id: ID, contract_hash: `sha256:${"a".repeat(64)}`,
      mission_root: "/tmp/ccb", nonce: "shared-nonce", expires_at: "2030-01-01T00:00:00.000Z",
    };
    const toPlanning = buildCorridorConsentContext({ ...common, requested_state: "PLANNING" });
    const toVerifying = buildCorridorConsentContext({ ...common, requested_state: "VERIFYING" });
    assert.ok(toPlanning.ok && toVerifying.ok);
    assert.notEqual(
      toPlanning.envelope.consent_context_hash,
      toVerifying.envelope.consent_context_hash,
      "the target state MUST be bound into consent, or one phrase authorizes every transition",
    );
    assert.notEqual(toPlanning.envelope.required_phrase, toVerifying.envelope.required_phrase);
  });

  test("CCB-05: complete is refused from any state other than CHECKPOINT", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await seedEstate(home);
    const out = run(home, ["mission", "corridor", "complete", ID,
      "--nonce", "ccb-early", "--expires", future()], { allowFail: true });
    assert.match(out, /reachable only from CHECKPOINT/);
    assert.equal(existsSync(join(home, "missions", ID, "closure.json")), false);
  });

  test("CCB-06: the full closure reaches COMPLETE and verifies from persisted artefacts alone", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);

    const { result } = consented(home, ["mission", "corridor", "complete", ID], "ccb-close");
    assert.equal(result.ok, true);
    assert.equal(result.state, "COMPLETE");
    assert.equal(result.terminal_outcome, "COMPLETED_VERIFIED");
    assert.ok(result.seal_head, "a seal must exist");
    assert.ok(result.ledger_head, "the canonical ledger must have advanced");
    assert.ok(result.anchor_hash, "an anchor must witness the extended ledger");

    // Outsider re-derivation: nothing below trusts what the runner reported.
    const dir = join(home, "missions", ID);
    const doc = JSON.parse(await readFile(join(dir, "contract.json"), "utf8"));
    const journal = (await readFile(join(dir, "journal.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    const chain = verifyCorridorJournal({ contract: doc.contract, contract_hash: doc.contract_hash, journal });
    assert.equal(chain.ok, true, `journal must verify: ${chain.blocked_by.join(", ")}`);

    const terminal = journal[journal.length - 1];
    assert.equal(terminal.state, "COMPLETE");
    assert.equal(terminal.terminal_outcome, "COMPLETED_VERIFIED");

    const ledger = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
    assert.equal(ledger.verified, true, "the signed receipt chain must verify");
    assert.equal(readClosureAnchorLog({ demaHome: home }).length, 1);

    // The bounded effect really happened: content conserved, draft promoted.
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), false);

    // COMPLETE is terminal: the journal cannot be extended afterwards.
    const after = run(home, ["mission", "corridor", "advance", ID, "--to", "PLANNING",
      "--nonce", "ccb-after", "--expires", future()], { allowFail: true });
    assert.match(after, /transition not allowed|terminal/i);
  });

  test("CCB-07: single-use consent is bound to REAL BYTES, not to a well-shaped object", async () => {
    const home = await newHome();
    const registry = buildDiskConsentRegistry({
      demaHome: home, targetHash: "t".repeat(64), consentProofHash: "c".repeat(64),
    });
    // A fresh, initialised registry reports unused — the failure mode that made
    // every first closure refuse before the directory was created eagerly.
    assert.equal(await registry.has("ccb-n1"), false);
    await registry.add("ccb-n1");
    assert.equal(await registry.has("ccb-n1"), true, "consumption must survive as bytes on disk");

    // The replay is refused by the filesystem's exclusive create, not by a flag.
    await assert.rejects(() => registry.add("ccb-n1"), /already_used/);

    // A path-escaping nonce can never address a file outside the registry.
    await assert.rejects(() => registry.add("../escape"), /malformed/);
    assert.equal(await registry.has("../escape"), true, "malformed nonces never read as available");

    // A SECOND registry over the same home sees the same bytes — the guarantee
    // does not live in process memory.
    const reopened = buildDiskConsentRegistry({ demaHome: home });
    assert.equal(await reopened.has("ccb-n1"), true);
  });

  // Found by a blind-spot ledger over this slice: MCW-12 races two in-process
  // calls over a Set. Nothing had ever raced two real OS processes over the real
  // registry and the real journal file — which is the case the atomic nonce
  // store exists to arbitrate, and the case where an unlocked append could fork
  // the chain.
  test("CCB-09: two concurrent OS processes cannot both complete the same corridor", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    await seedEstate(home);

    // Pre-derive two DISTINCT authorised consents, then fire both at once: each
    // is individually valid, so only a real guard can separate them.
    const authorised = ["ccb-race-a", "ccb-race-b"].map((nonce) => {
      const expires = future();
      const base = ["mission", "corridor", "complete", ID, "--nonce", nonce, "--expires", expires];
      const card = JSON.parse(run(home, base));
      return [...base, "--consent", card.required_phrase, "--consent-context", card.consent_context_hash];
    });

    // MUST be genuinely concurrent. execFileSync inside a Promise executor runs
    // to completion before the next promise is even constructed, which would
    // make this a sequential test wearing a concurrency costume — it would pass
    // against a completely unguarded implementation.
    const outcomes = await Promise.all(authorised.map((args) =>
      new Promise((resolve) => {
        execFile("node", [DEMA, ...args, "--dema-home", home, "--json"],
          { cwd: REPO, env: { ...process.env, DEMA_HOME: home } },
          (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}` }));
      })));

    const completed = outcomes.filter((o) => {
      try { return JSON.parse(o.out).state === "COMPLETE"; } catch { return false; }
    });
    assert.equal(completed.length, 1, `exactly one process may complete; got ${completed.length}`);

    // The decisive check: whatever the loser did, the journal must still be a
    // single valid chain. A forked or double-indexed journal is corruption even
    // if the COMPLETE count happens to be right.
    const dir = join(home, "missions", ID);
    const doc = JSON.parse(await readFile(join(dir, "contract.json"), "utf8"));
    const journal = (await readFile(join(dir, "journal.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    const chain = verifyCorridorJournal({ contract: doc.contract, contract_hash: doc.contract_hash, journal });
    assert.equal(chain.ok, true, `journal must remain one valid chain: ${chain.blocked_by.join(", ")}`);
    assert.equal(journal.filter((e) => e.state === "COMPLETE").length, 1, "exactly one COMPLETE event may exist");

    // And the world moved exactly once.
    const estate = join(dir, "estate");
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), false);
  });

  // CCB-09 can only catch the race when it wins the interleaving. This asserts
  // the same guard deterministically: with the lock already held, no closure may
  // start — no Omega0, no rename, no ledger append, no journal event.
  test("CCB-10: a held closure lock refuses a second closure outright", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);

    const dir = join(home, "missions", ID);
    await writeFile(join(dir, ".closure.lock"), JSON.stringify({ pid: 1, mission_id: ID }) + "\n", { mode: 0o600 });

    const out = run(home, ["mission", "corridor", "complete", ID,
      "--nonce", "ccb-locked", "--expires", future()], { allowFail: true });
    assert.match(out, /another closure is already running/);

    // Nothing may have moved: no effect, no closure record, journal untouched.
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), false);
    assert.equal(existsSync(join(dir, "closure.json")), false);
    const journal = (await readFile(join(dir, "journal.jsonl"), "utf8")).trim().split("\n");
    assert.equal(journal.length, 7, "a refused closure must not append");
  });

  test("CCB-08: the bounded effect refuses to overwrite an existing target", async () => {
    const home = await newHome();
    const estate = join(home, "estate");
    await mkdir(estate, { recursive: true });
    await writeFile(join(estate, "a.json"), "A");
    await writeFile(join(estate, "b.json"), "B");
    const adapter = buildRenameEffectAdapter({ scopeRoot: estate, from: "a.json", to: "b.json" });
    // Silently clobbering b.json would destroy content while preserving the file
    // count — which is exactly what Omega0's verification measures.
    assert.throws(() => adapter.apply(adapter.propose()), /already exists/);
    assert.equal(adapter.manifest().length, 2, "a refused effect leaves the world untouched");
  });
});
