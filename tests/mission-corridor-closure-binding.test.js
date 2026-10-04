// CCB-01…19 — CORRIDOR-CLOSURE-BINDING-1A / C3 bound path.
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
import { execFileSync, execFile, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, chmod, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyCorridorJournal, buildCorridorConsentContext } from "../packages/mission/src/mission-corridor.js";
import { verifyCanonicalLedger } from "../packages/receipts/src/canonical-ledger.js";
import { replayClosureTransaction, MISSION_CLOSURE_TX_RELDIR } from "../packages/receipts/src/mission-closure-transaction.js";
import { inspectConsentNonce } from "../packages/receipts/src/consent-nonce-claim.js";
import {
  buildDiskConsentRegistry, buildRenameEffectAdapter, buildRenameEffectIntent,
  readClosureAnchorLog,
} from "../packages/mission/src/corridor-closure-gatherer.js";
import { inspectClosureOwnership } from "../packages/receipts/src/mission-closure-ownership.js";
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
    assert.match(terminal.closure_transaction_id, /^corridor-[0-9a-f]{64}$/);
    assert.match(terminal.consent_claim_hash, /^[0-9a-f]{64}$/);
    assert.match(terminal.prepared_intent_hash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(terminal.seal_head, result.seal_head);
    assert.equal(terminal.ledger_head, result.ledger_head);
    assert.equal(terminal.anchor_hash, result.anchor_hash);

    const tx = await replayClosureTransaction({
      demaHome: home,
      transactionId: terminal.closure_transaction_id,
    });
    assert.equal(tx.ok, true, tx.reason);
    assert.deepEqual(tx.events.map((event) => event.phase), [
      "PREPARED",
      "EFFECT_INTENT_PERSISTED",
      "EFFECT_APPLIED",
      "VERIFIED",
      "SEALED",
      "LEDGER_COMMITTED",
      "ANCHORED",
      "RESOLVED",
    ]);
    assert.equal(tx.terminal_outcome, "COMPLETED_VERIFIED");

    const ledger = await verifyCanonicalLedger({ demaHome: home, pubkeyPem: await loadPublicKey(home) });
    assert.equal(ledger.verified, true, "the signed receipt chain must verify");
    assert.equal(readClosureAnchorLog({ demaHome: home }).length, 1);
    const status = JSON.parse(run(home, ["mission", "corridor", "status", ID]));
    assert.equal(status.closure_verification?.verified, true, "verify_with status must rebind C2, ledger, and anchor bytes");

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
    // Cutover 2026-08-11: this exercised `has` then `add`. Every property it
    // proved is preserved below against the single `claim` call that replaced
    // them — including the one that motivated eager directory creation, since a
    // fresh home must GRANT rather than refuse the first closure.
    const first = await registry.claim("ccb-n1");
    assert.equal(first.granted, true, "a fresh home must grant the first claim");

    // The replay is refused by the filesystem's exclusive create, not by a flag.
    const replay = await registry.claim("ccb-n1");
    assert.equal(replay.granted, false, "consumption must survive as bytes on disk");
    assert.equal(replay.consumed, true);
    assert.equal(replay.reason, "consent_already_consumed");

    // A path-escaping nonce still cannot address a file outside the registry —
    // and the reason CHANGED with the cutover, so the assertion changes with it.
    //
    // The legacy store used the raw nonce as the filename, so it had to REJECT
    // `../escape` to stay inside its directory. The canonical claim names every
    // file by the nonce's digest, so no nonce can address anything outside the
    // registry by construction, and it deliberately accepts any non-NUL string.
    // Re-asserting the old rejection would pin the WEAKER guarantee and would
    // also make this adapter stricter than the single consent authority it is
    // supposed to be a face for. So the structural property is asserted instead.
    const escape = await registry.claim("../escape");
    assert.equal(escape.granted, true, "safety here is structural, not a veto on the nonce's text");
    const claimFiles = await readdir(join(home, "consent", "nonces-v1"));
    assert.equal(claimFiles.length, 2, "both claims landed in the registry directory");
    for (const f of claimFiles) {
      assert.match(f, /^[0-9a-f]{64}\.json$/, "every claim file is digest-named, never nonce-named");
    }
    assert.deepEqual(await readdir(home), ["consent"], "a hostile nonce wrote nothing outside the registry");

    // A SECOND registry over the same home sees the same bytes — the guarantee
    // does not live in process memory.
    const reopened = buildDiskConsentRegistry({ demaHome: home });
    assert.equal((await reopened.claim("ccb-n1")).granted, false);

    // And the record landed in the CANONICAL namespace, not the superseded one.
    assert.equal(existsSync(join(home, "consent", "nonces-v1")), true);
    assert.equal(existsSync(join(home, "consent", "nonces")), false);
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
  test("CCB-10: a held different-transaction lock refuses any effect", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);

    const dir = join(home, "missions", ID);
    await writeFile(join(dir, ".closure.lock"), JSON.stringify({ pid: 1, mission_id: ID }) + "\n", { mode: 0o600 });

    const expires = future();
    const args = ["mission", "corridor", "complete", ID,
      "--nonce", "ccb-locked", "--expires", expires];
    const card = JSON.parse(run(home, args));
    assert.equal(card.step, "CONSENT_CARD", "a read-only consent card does not contend on the effect lock");
    const out = run(home, [
      ...args,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ], { allowFail: true });
    assert.match(out, /another closure is already running/);

    // C1 authority is consumed before lock acquisition, but no world effect,
    // receipt, closure record, or terminal journal event may be created.
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

  test("CCB-11: prepared rename intent binds exact operands and measured pre-state", async () => {
    const home = await newHome();
    const estate = join(home, "estate");
    await mkdir(estate, { recursive: true });
    await writeFile(join(estate, "a.json"), "A");
    await writeFile(join(estate, "other.json"), "B");

    const a = buildRenameEffectIntent({ scopeRoot: estate, from: "a.json", to: "sealed.json" });
    const same = buildRenameEffectIntent({ scopeRoot: estate, from: "a.json", to: "sealed.json" });
    const otherTarget = buildRenameEffectIntent({ scopeRoot: estate, from: "a.json", to: "other-sealed.json" });
    assert.equal(a.ok, true, a.reason);
    assert.equal(same.ok, true, same.reason);
    assert.equal(otherTarget.ok, true, otherTarget.reason);
    assert.equal(a.prepared_intent_hash, same.prepared_intent_hash);
    assert.notEqual(a.prepared_intent_hash, otherTarget.prepared_intent_hash);
    assert.match(a.prepared_intent_hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(a.intent.plan_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(a.intent.before_hash, a.intent.expected_after_hash);
  });

  test("CCB-12: path-hostile rename operands are refused before any mutation", async () => {
    const home = await newHome();
    const estate = join(home, "estate");
    await mkdir(estate, { recursive: true });
    await writeFile(join(estate, "inside.json"), "inside");
    await writeFile(join(home, "outside.json"), "outside");

    for (const [from, to] of [
      ["../outside.json", "stolen.json"],
      ["inside.json", "../outside-sealed.json"],
      ["/tmp/absolute.json", "sealed.json"],
    ]) {
      const prepared = buildRenameEffectIntent({ scopeRoot: estate, from, to });
      assert.equal(prepared.ok, false, `${from} -> ${to} must be refused`);
      assert.equal(prepared.reason, "rename_operand_outside_scope");
      assert.throws(
        () => buildRenameEffectAdapter({ scopeRoot: estate, from, to }),
        /rename_operand_outside_scope/,
      );
    }
    assert.equal(await readFile(join(home, "outside.json"), "utf8"), "outside");
    assert.equal(await readFile(join(estate, "inside.json"), "utf8"), "inside");
  });

  test("CCB-13: a COMPLETE card cannot authorize changed rename operands", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);
    const expires = future();
    const base = ["mission", "corridor", "complete", ID, "--nonce", "ccb-intent", "--expires", expires];
    const card = JSON.parse(run(home, base));

    const changed = run(home, [
      ...base,
      "--to", "closure-evidence.other.json",
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ], { allowFail: true });
    assert.match(changed, /consent_context_mismatch/);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.other.json")), false);
  });

  test("CCB-14: the CLI refuses an out-of-scope rename before consent or mutation", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);
    const outside = join(home, "outside.json");
    await writeFile(outside, "outside");

    const out = run(home, [
      "mission", "corridor", "complete", ID,
      "--from", "../outside.json",
      "--to", "stolen.json",
      "--nonce", "ccb-traversal",
      "--expires", future(),
    ], { allowFail: true });
    assert.match(out, /rename_operand_outside_scope/);
    assert.equal(await readFile(outside, "utf8"), "outside");
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
  });

  test("CCB-15: production CLI recovers a SIGKILL after no-replace target publication", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);
    const nonce = "ccb-kill-recover";
    const expires = future();
    const base = ["mission", "corridor", "complete", ID, "--nonce", nonce, "--expires", expires];
    const card = JSON.parse(run(home, base));
    const authorisedArgs = [
      ...base,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ];
    const authorised = [
      ...authorisedArgs,
      "--dema-home", home,
      "--json",
    ];

    const killed = spawnSync(process.execPath, [
      "--import",
      new URL("./fixtures/kill-after-first-rename-preload.mjs", import.meta.url).pathname,
      DEMA,
      ...authorised,
    ], {
      cwd: REPO,
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        DEMA_HOME: home,
        BIZRA_TEST_KILL_UNLINK_PATH: join(estate, "closure-evidence.draft.json"),
      },
    });
    assert.equal(killed.signal, "SIGKILL", `CLI did not die at no-replace boundary: ${killed.stderr}`);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), true);

    const claimed = await inspectConsentNonce({ nonce, demaHome: home });
    assert.equal(claimed.claim_hash_valid, true);
    const interrupted = await replayClosureTransaction({
      demaHome: home,
      transactionId: claimed.claim.transaction_id,
    });
    assert.deepEqual(interrupted.events.map((event) => event.phase), [
      "PREPARED", "EFFECT_INTENT_PERSISTED",
    ]);
    assert.equal(existsSync(join(home, "missions", ID, ".closure.lock")), true);

    const recovered = JSON.parse(run(home, authorisedArgs));
    assert.equal(recovered.ok, true);
    assert.equal(recovered.state, "COMPLETE");

    const finished = await replayClosureTransaction({
      demaHome: home,
      transactionId: claimed.claim.transaction_id,
    });
    assert.deepEqual(finished.events.map((event) => event.phase), [
      "PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED",
      "SEALED", "LEDGER_COMMITTED", "ANCHORED", "RESOLVED",
    ]);
    assert.equal(finished.terminal_outcome, "COMPLETED_VERIFIED");
    assert.equal(existsSync(join(home, "missions", ID, ".closure.lock")), false);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), false);
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), true);

    const dir = join(home, "missions", ID);
    const transactionDir = join(
      home, MISSION_CLOSURE_TX_RELDIR, claimed.claim.transaction_id,
    );
    const snapshotArtifacts = async () => {
      const journal = await readFile(join(dir, "journal.jsonl"), "utf8");
      const journalEvents = journal.trim().split("\n").map((line) => JSON.parse(line));
      const eventNames = (await readdir(join(transactionDir, "events"))).sort();
      return {
        journal,
        journal_claim: await readFile(
          join(dir, `.journal-index-${journalEvents.at(-1).index}.claim`), "utf8",
        ),
        ledger: await readFile(join(home, "receipts", "canonical-ledger.ndjson"), "utf8"),
        anchors: await readFile(join(home, "anchors", "corridor-closure-anchors.ndjson"), "utf8"),
        closure: await readFile(join(dir, "closure.json"), "utf8"),
        transaction: await readFile(join(transactionDir, "transaction.json"), "utf8"),
        c2_events: await Promise.all(eventNames.map(async (name) => ({
          name,
          bytes: await readFile(join(transactionDir, "events", name), "utf8"),
        }))),
      };
    };
    const beforeRetry = await snapshotArtifacts();
    assert.equal(
      beforeRetry.journal.trim().split("\n")
        .map((line) => JSON.parse(line))
        .filter((event) => event.state === "COMPLETE").length,
      1,
      "the first cold recovery must produce exactly one COMPLETE",
    );
    assert.equal(beforeRetry.ledger.trim().split("\n").length, 1, "exactly one receipt");
    assert.equal(beforeRetry.anchors.trim().split("\n").length, 1, "exactly one anchor");
    assert.equal(beforeRetry.c2_events.length, 8, "exactly one file per C2 phase");
    const idempotent = JSON.parse(run(home, authorisedArgs));
    assert.equal(idempotent.ok, true);
    assert.equal(idempotent.recovered, true);
    assert.deepEqual(
      await snapshotArtifacts(),
      beforeRetry,
      "exact terminal retry must preserve every durable artifact byte-for-byte",
    );
  });

  test("CCB-16: a different transaction holding the global closure tail blocks before C2 or effect", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);
    const receiptsDir = join(home, "receipts");
    await mkdir(receiptsDir, { recursive: true, mode: 0o700 });
    await writeFile(
      join(receiptsDir, ".corridor-closure-tail.lock"),
      `${JSON.stringify({
        schema: "bizra.dema.corridor_closure_tail_lock.v1",
        pid: process.pid,
        mission_id: "another-mission",
        transaction_id: "another-live-transaction",
      })}\n`,
      { mode: 0o600 },
    );

    const expires = future();
    const base = ["mission", "corridor", "complete", ID,
      "--nonce", "ccb-global-lock", "--expires", expires];
    const card = JSON.parse(run(home, base));
    const blocked = run(home, [
      ...base,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ], { allowFail: true });
    assert.match(blocked, /canonical closure tail is owned by another transaction/);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), false);
    assert.equal(existsSync(join(home, MISSION_CLOSURE_TX_RELDIR)), false);
  });

  test("CCB-17: an expired pre-effect recovery cannot execute under the historical claim time", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    const estate = await seedEstate(home);
    const dir = join(home, "missions", ID);
    const lock = join(dir, ".closure.lock");
    await writeFile(lock, `${JSON.stringify({
      schema: "bizra.dema.corridor_closure_lock.v1",
      pid: process.pid,
      mission_id: "other",
      transaction_id: "different-transaction",
    })}\n`, { mode: 0o600 });

    const base = ["mission", "corridor", "complete", ID,
      "--nonce", "ccb-expired-recovery", "--expires", "2030-01-01T00:00:00.000Z"];
    const card = JSON.parse(run(home, base));
    const authorised = [
      ...base,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ];
    const first = run(home, authorised, { allowFail: true });
    assert.match(first, /another closure is already running/);
    await unlink(lock);

    const expired = run(home, [...authorised, "--now", "2031-01-01T00:00:00.000Z"], { allowFail: true });
    assert.match(expired, /consent_expired/);
    assert.equal(existsSync(join(estate, "closure-evidence.draft.json")), true);
    assert.equal(existsSync(join(estate, "closure-evidence.sealed.json")), false);
  });

  test("CCB-18: status and terminal recovery fail closed when ledger or anchor evidence is missing", async () => {
    for (const missing of ["ledger", "anchor"]) {
      const home = await newHome();
      await startedCorridor(home);
      await walkToCheckpoint(home);
      await seedEstate(home);
      const base = ["mission", "corridor", "complete", ID,
        "--nonce", `ccb-missing-${missing}`, "--expires", future()];
      const card = JSON.parse(run(home, base));
      const authorised = [
        ...base,
        "--consent", card.required_phrase,
        "--consent-context", card.consent_context_hash,
      ];
      const completed = JSON.parse(run(home, authorised));
      assert.equal(completed.state, "COMPLETE");
      const path = missing === "ledger"
        ? join(home, "receipts", "canonical-ledger.ndjson")
        : join(home, "anchors", "corridor-closure-anchors.ndjson");
      await unlink(path);

      const status = run(home, ["mission", "corridor", "status", ID], { allowFail: true });
      assert.match(status, /"verified": false/);
      const recovery = run(home, authorised, { allowFail: true });
      assert.match(recovery, /terminal artifact recovery failed closed/);
    }
  });

  test("CCB-19: C2 resolves before corridor COMPLETE and a failed journal append recovers exactly", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    await seedEstate(home);
    const dir = join(home, "missions", ID);
    const journalPath = join(dir, "journal.jsonl");
    const nonce = "ccb-resolve-before-complete";
    const base = ["mission", "corridor", "complete", ID,
      "--nonce", nonce, "--expires", future()];
    const card = JSON.parse(run(home, base));
    const authorised = [
      ...base,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ];

    await chmod(journalPath, 0o400);
    const interrupted = run(home, authorised, { allowFail: true });
    await chmod(journalPath, 0o600);
    assert.match(interrupted, /EACCES|permission denied/i);

    const claimed = await inspectConsentNonce({ nonce, demaHome: home });
    assert.equal(claimed.claim_hash_valid, true);
    const tx = await replayClosureTransaction({
      demaHome: home,
      transactionId: claimed.claim.transaction_id,
    });
    assert.equal(tx.phase, "RESOLVED", "C2 must resolve before a corridor COMPLETE is externally visible");
    assert.equal(tx.terminal_outcome, "COMPLETED_VERIFIED");

    const journalBeforeRecovery = (await readFile(journalPath, "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(journalBeforeRecovery.at(-1).state, "CHECKPOINT");

    const recovered = JSON.parse(run(home, authorised));
    assert.equal(recovered.state, "COMPLETE");
    const journalAfterRecovery = (await readFile(journalPath, "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(journalAfterRecovery.filter((event) => event.state === "COMPLETE").length, 1);
    const finalTx = await replayClosureTransaction({
      demaHome: home,
      transactionId: claimed.claim.transaction_id,
    });
    assert.deepEqual(finalTx.events.map((event) => event.phase), [
      "PREPARED", "EFFECT_INTENT_PERSISTED", "EFFECT_APPLIED", "VERIFIED",
      "SEALED", "LEDGER_COMMITTED", "ANCHORED", "RESOLVED",
    ]);
  });

  test("CCB-20: already-COMPLETE terminal recovery reacquires ownership before RESOLVED", async () => {
    const home = await newHome();
    await startedCorridor(home);
    await walkToCheckpoint(home);
    await seedEstate(home);

    const nonce = "ccb-terminal-ownership";
    const expires = future();
    const base = ["mission", "corridor", "complete", ID,
      "--nonce", nonce, "--expires", expires];
    const card = JSON.parse(run(home, base));
    const authorised = [
      ...base,
      "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash,
    ];
    const completed = JSON.parse(run(home, authorised));
    assert.equal(completed.state, "COMPLETE");

    const claimed = await inspectConsentNonce({ nonce, demaHome: home });
    assert.equal(claimed.claim_hash_valid, true);
    const transactionId = claimed.claim.transaction_id;
    const transactionDir = join(home, MISSION_CLOSURE_TX_RELDIR, transactionId);
    const eventsDir = join(transactionDir, "events");
    const eventNames = await readdir(eventsDir);
    let resolvedName = null;
    for (const name of eventNames) {
      const event = JSON.parse(await readFile(join(eventsDir, name), "utf8"));
      if (event.phase === "RESOLVED") resolvedName = name;
    }
    assert.ok(resolvedName, "the completed fixture must contain RESOLVED");
    await unlink(join(eventsDir, resolvedName));

    const interrupted = await replayClosureTransaction({
      demaHome: home,
      transactionId,
    });
    assert.equal(interrupted.ok, true, interrupted.reason);
    assert.equal(interrupted.phase, "ANCHORED");
    const ownershipBefore = await inspectClosureOwnership({
      demaHome: home,
      transactionId,
    });
    assert.equal(ownershipBefore.state, "PRESENT");

    const recovered = JSON.parse(run(home, authorised));
    assert.equal(recovered.ok, true);
    assert.equal(recovered.recovered, true);

    const ownershipAfter = await inspectClosureOwnership({
      demaHome: home,
      transactionId,
    });
    assert.equal(ownershipAfter.state, "PRESENT");
    assert.ok(
      ownershipAfter.generation > ownershipBefore.generation,
      "terminal recovery must acquire a newer owner generation before writing RESOLVED",
    );
    const final = await replayClosureTransaction({ demaHome: home, transactionId });
    assert.equal(final.phase, "RESOLVED");
    assert.equal(final.terminal_outcome, "COMPLETED_VERIFIED");
  });
});
