// NODE0-CLOSURE-SPRINT-CORRECTION-1A — one regression test per shipped defect.
//
// Each of these four defects passed a full green matrix in the first closure
// sprint. They are recorded here so that a future change reintroducing any of
// them fails loudly instead of being absorbed.
//
// D1 the runner marked a FAILED node healthy      (ok: snap?.ok !== false)
// D2 the runner could observe a different home    (snapshot read process.env)
// D3 FATE ran AFTER the nonce and locks were taken, while claiming nothing was written
// D4 the "FATE gate" called two predicates, not the typed contract

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { takeSample, HEALTHY_MISSION_VERDICT } from "../apps/cli/src/commands/node0-run.js";
import { buildHealthSnapshot } from "../packages/mission/src/health-snapshot.js";
import { saveSeasonState } from "../packages/receipts/src/season-state-store.js";
import { initAuthorshipKey, KEY_INIT_CONSENT_PHRASE } from "../packages/receipts/src/authorship-key-store.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMA = join(REPO, "bin/dema");
const CLI = join(REPO, "apps", "cli", "src", "commands", "mission.js");
const ID = "csc-probe";
const SEASON = "csc-season";

const homes = [];
async function newHome() {
  const h = await mkdtemp(join(tmpdir(), "csc-"));
  homes.push(h);
  return h;
}

// PROMOTION-CORRECTION-1C. `homes` accumulated every temporary DEMA home and
// nothing ever read it, so each run left a directory tree behind — including,
// and especially, when a test failed. `after` runs on the failure path too.
after(async () => {
  for (const h of homes) await rm(h, { recursive: true, force: true });
});

function executingRepo() {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: REPO, encoding: "utf8" }).trim();
  return { commit, tree };
}

async function seedSeason(home, over = {}) {
  const { commit, tree } = executingRepo();
  const r = await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON,
      mission_id: ID,
      mission_phase: "LOCAL_EFFECT_PREPARED",
      completed_steps: [],
      next_safe_action: "ACTION:CORRIDOR_RENAME_EXECUTE",
      must_not_repeat: [],
      pending_consent: [{ phrase: `GO: complete mission corridor ${ID}`, scope: "corridor" }],
      repository_commit: commit,
      repository_tree: tree,
      saved_at: "2026-08-05T09:00:00Z",
      ...over,
    },
  });
  assert.equal(r.ok, true, `season fixture failed: ${r.reason ?? ""}`);
}

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

const future = () => new Date(Date.now() + 3_600_000).toISOString();

function consented(home, args, nonce, extra = []) {
  const base = [...args, "--nonce", nonce, "--expires", future()];
  const card = JSON.parse(run(home, base));
  assert.equal(card.step, "CONSENT_CARD");
  return JSON.parse(run(home, [...base, "--consent", card.required_phrase,
    "--consent-context", card.consent_context_hash, ...extra]));
}

/**
 * Drive a REAL corridor to CHECKPOINT with a seeded estate file.
 *
 * Without this the `complete` route dies at "no corridor found" long before the
 * Season/FATE gate, and a test asserting a refusal would pass while proving
 * nothing. That is the exact defect class this file exists to close, so the
 * setup is mandatory rather than convenient.
 */
async function corridorAtCheckpoint(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const expires = future();
  const args = [
    "mission", "corridor", "start", "--id", ID,
    "--objective", "CSC probe: reach the Season/FATE gate on the real effect route",
    "--base-sha", "0".repeat(40), "--nonce", "csc-start", "--expires", expires,
  ];
  const card = JSON.parse(run(home, args));
  const started = JSON.parse(run(home, [
    ...args, "--created-at", card.created_at_iso,
    "--consent", card.required_phrase, "--consent-context", card.consent_context_hash,
  ]));
  assert.equal(started.ok, true, "corridor must start");

  let n = 0;
  for (const to of ["PREFLIGHT", "PLANNING", "IMPLEMENTING", "VERIFYING", "SAT_REVIEW", "CHECKPOINT"]) {
    const r = consented(home, ["mission", "corridor", "advance", ID, "--to", to], `csc-adv-${++n}`);
    assert.equal(r.state, to, `advance to ${to} must land`);
  }

  const estate = join(home, "missions", ID, "estate");
  await mkdir(estate, { recursive: true, mode: 0o700 });
  await writeFile(join(estate, "closure-evidence.draft.json"), JSON.stringify({ claim: "csc" }) + "\n", { mode: 0o600 });
  return estate;
}

// Count everything the effect route could have written before FATE.
async function writtenArtefacts(home) {
  const walk = async (dir) => {
    let out = [];
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(await walk(p));
      else out.push(p);
    }
    return out;
  };
  const all = await walk(home);
  return {
    nonces: all.filter((p) => p.includes(join("consent", "nonces"))).length,
    locks: all.filter((p) => p.endsWith(".lock")).length,
    transactions: all.filter((p) => p.includes("closure-tx")).length,
  };
}

// ── D1 ─────────────────────────────────────────────────────────────────────

test("D1 a FAILED health snapshot can never produce a healthy endurance sample", async () => {
  const mk = (verdict) => async () => ({
    attests: { mission_verdict: verdict, results: { memory: { home: "/H" } } },
    content_hash: "sha256:x",
  });

  // The exact defect: buildHealthSnapshot returns NO top-level `ok`, so the old
  // `snap?.ok !== false` was `undefined !== false` — always true.
  const real = await buildHealthSnapshot({ demaHome: "/nonexistent-home-for-this-test" });
  assert.equal(real.ok, undefined, "control: the snapshot still has no top-level ok — the old expression would be vacuous");
  assert.ok(real.attests.mission_verdict, "control: the verdict lives at attests.mission_verdict");

  for (const [verdict, expected] of [
    ["CLEAN", true], ["ATTENTION", false], ["FAILED", false],
    [null, false], [undefined, false], ["SOMETHING_NEW", false],
  ]) {
    const s = await takeSample({ at: 1, demaHome: "/H", snapshotFn: mk(verdict) });
    assert.equal(s.ok, expected, `verdict ${String(verdict)} produced ok=${s.ok}`);
    assert.equal(s.mission_verdict, verdict ?? null);
  }
  assert.equal(HEALTHY_MISSION_VERDICT, "CLEAN");
});

test("D1b a thrown snapshot is an unhealthy observation, not an absent one", async () => {
  const s = await takeSample({ at: 7, demaHome: "/H", snapshotFn: async () => { throw new Error("boom"); } });
  assert.equal(s.ok, false);
  assert.equal(s.at_ms, 7, "the observation must still be recorded so it reads as DEGRADED, not as a gap");
  assert.match(s.error, /boom/);
});

// ── D2 ─────────────────────────────────────────────────────────────────────

test("D2 the sampled home is the requested home, and a mismatch is visible", async () => {
  const home = await newHome();
  const s = await takeSample({ at: 1, demaHome: home });
  assert.equal(s.requested_home, home);
  assert.equal(s.inspected_home, home, "the snapshot inspected a different installation than requested");
  assert.equal(s.home_matches, true);

  // And a mismatch is surfaced rather than hidden.
  const bad = await takeSample({
    at: 1, demaHome: "/WANTED",
    snapshotFn: async () => ({ attests: { mission_verdict: "CLEAN", results: { memory: { home: "/OTHER" } } }, content_hash: "h" }),
  });
  assert.equal(bad.home_matches, false, "a home mismatch was not surfaced");
});

test("D2b buildHealthSnapshot honours an explicit demaHome and stays additive without one", async () => {
  const home = await newHome();
  const explicit = await buildHealthSnapshot({ demaHome: home });
  assert.equal(explicit.attests.results.memory.home, home);

  // Additive: with no demaHome it falls back to the environment exactly as before.
  const prev = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  try {
    const implicit = await buildHealthSnapshot({});
    assert.equal(implicit.attests.results.memory.home, home);
  } finally {
    if (prev === undefined) delete process.env.DEMA_HOME; else process.env.DEMA_HOME = prev;
  }
});

// ── D3 · THE LOAD-BEARING ONE ──────────────────────────────────────────────

test("D3 a FATE/Season refusal writes no nonce, no lock and no transaction", async () => {
  const home = await newHome();
  // A REAL corridor at CHECKPOINT — otherwise `complete` dies at "no corridor
  // found" and never reaches the gate this test claims to exercise.
  await corridorAtCheckpoint(home);

  // Seed a season that PROHIBITS the corridor rename. Everything else is valid,
  // so the route reaches the Season gate and refuses there.
  await seedSeason(home, { must_not_repeat: ["ACTION:CORRIDOR_RENAME_EXECUTE"] });

  const before = await writtenArtefacts(home);

  const out = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON,
    "--nonce", "csc-refuse", "--expires", future(),
    "--consent", `GO: complete mission corridor ${ID}`,
    "--consent-context", `sha256:${"0".repeat(64)}`,
  ], { allowFail: true });

  // The route MUST reach the gate. An early exit would make this test vacuous.
  assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 300)}`);
  assert.match(out, /season_action_refused/, `expected a Season refusal, got: ${out.slice(0, 300)}`);

  const after = await writtenArtefacts(home);
  assert.equal(after.nonces, before.nonces, "a consent nonce was claimed before the refusal");
  assert.equal(after.locks, before.locks, "a closure lock was taken before the refusal");
  assert.equal(after.transactions, before.transactions, "a transaction record was written before the refusal");
});

// ── D3b · BEHAVIORAL FATE ORDER PROOF (PROMOTION-CORRECTION-1C item 16) ────
//
// D3b used to read mission.js as a STRING and compare the character offsets of
// `const seasonGate = await corridorRenameSeasonFateGate`, `corridorConsentGate(`,
// `claimCorridorWriteNonce(`, `acquireClosureLock({` and
// `runTransactionalMechanicalClosure({`. That proved source LAYOUT, not order of
// execution: renaming the binding, reformatting, or moving the call into a helper
// broke it while the shipped behavior was unchanged. Worse, it forced `seasonGate`
// to stay bound as a deliberately-unread variable purely so the test could find it.
//
// ── HOW ORDER IS PROVEN WITHOUT READING SOURCE, AND WITHOUT A TRACE SEAM ──
// By DIFFERENTIAL REFUSAL. If gate A runs strictly before gate B, then a run in
// which BOTH would refuse must report A's refusal, never B's. Break two gates at
// once and the one that speaks is the earlier one. No event recorder, no injected
// observer, and no production change is required to observe it — the refusal
// message and the set of artefacts on disk are already the observation.
//
// FO-01 proves gate-before-consent by making the consent phrase invalid at the
// same time the Season prohibits the action: a Season refusal (not a consent
// error) can only mean the Season/FATE gate ran first.

test("FO-01 the Season/FATE gate refuses BEFORE consent is evaluated", async () => {
  const home = await newHome();
  await corridorAtCheckpoint(home);
  await seedSeason(home, { must_not_repeat: ["ACTION:CORRIDOR_RENAME_EXECUTE"] });

  const before = await writtenArtefacts(home);

  // BOTH gates would refuse: the Season prohibits the action AND the consent
  // phrase is wrong. Whichever runs first is the one that speaks.
  const out = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON,
    "--nonce", "fo-01", "--expires", future(),
    "--consent", "GO: this is not the required phrase",
    "--consent-context", `sha256:${"0".repeat(64)}`,
  ], { allowFail: true });

  // Non-vacuity: an early exit would make the whole assertion meaningless.
  assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 300)}`);

  assert.match(out, /season_action_refused/,
    `the Season/FATE gate must speak first; got: ${out.slice(0, 400)}`);
  // A consent card is what the consent gate emits when it is reached. Its
  // absence is the positive evidence that consent evaluation never began.
  assert.equal(/CONSENT_CARD/.test(out), false,
    `a consent card was issued, so consent ran before the gate: ${out.slice(0, 400)}`);

  const after = await writtenArtefacts(home);
  assert.equal(after.nonces, before.nonces, "a nonce was claimed before the gate refused");
  assert.equal(after.locks, before.locks, "a lock was taken before the gate refused");
  assert.equal(after.transactions, before.transactions, "a transaction was written before the gate refused");
});

test("FO-02 a GENUINE consent envelope cannot override a Season/FATE refusal", async () => {
  const home = await newHome();
  await corridorAtCheckpoint(home);

  // A fabricated --consent-context would make this test vacuous: consent would
  // fail on its own, so a refusal could not be attributed to the Season gate.
  // The envelope must be REAL. It binds mission id, contract hash, capability
  // scope, mission root, action class, nonce and expiry -- and deliberately NOT
  // the Season -- so an envelope minted while the Season PERMITS the action
  // stays valid for the same home, nonce and expiry once the Season prohibits it.
  const nonce = "fo-02";
  const expires = future();

  // 1. Season permits -> the route reaches consent and issues a real card.
  await seedSeason(home);
  const card = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON, "--nonce", nonce, "--expires", expires,
  ], { allowFail: true });

  // The harness drives the CLI in --json mode, so read the card as JSON rather
  // than scraping the human-readable rendering.
  const parsed = JSON.parse(card.slice(card.indexOf("{"), card.lastIndexOf("}") + 1));
  assert.equal(parsed.step, "CONSENT_CARD",
    `control: a consent card must be issued while the Season permits, got step=${parsed.step}`);
  const phrase = parsed.required_phrase;
  const contextHash = parsed.consent_context_hash;
  assert.ok(phrase, `control: the card must carry a required phrase: ${card.slice(0, 400)}`);
  assert.ok(contextHash && /^sha256:[0-9a-f]{64}$/.test(contextHash),
    `control: the card must carry a real consent_context_hash, got: ${String(contextHash)}`);

  // 2. Same home, same nonce, same expiry -- only the Season now prohibits it.
  await seedSeason(home, { must_not_repeat: ["ACTION:CORRIDOR_RENAME_EXECUTE"] });
  const before = await writtenArtefacts(home);

  const out = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON, "--nonce", nonce, "--expires", expires,
    "--consent", phrase,
    "--consent-context", contextHash,
  ], { allowFail: true });

  assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 300)}`);
  assert.match(out, /season_action_refused/,
    `a genuine consent envelope overrode the constitutional gate: ${out.slice(0, 400)}`);

  const after = await writtenArtefacts(home);
  assert.equal(after.nonces, before.nonces, "consent claimed a nonce despite the refusal");
  assert.equal(after.locks, before.locks, "consent took a lock despite the refusal");
  assert.equal(after.transactions, before.transactions, "consent opened a transaction despite the refusal");
});

test("FO-03 a consent-stage refusal claims no nonce — consent precedes the nonce", async () => {
  const home = await newHome();
  await corridorAtCheckpoint(home);
  // Season PERMITS the action, so the route passes the gate and reaches consent.
  await seedSeason(home);

  const before = await writtenArtefacts(home);

  const out = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON,
    "--nonce", "fo-03", "--expires", future(),
    "--consent", "GO: this is not the required phrase",
    "--consent-context", `sha256:${"0".repeat(64)}`,
  ], { allowFail: true });

  assert.equal(/no corridor found/.test(out), false, `never reached the route: ${out.slice(0, 300)}`);
  // The Season gate must NOT be what refused here — that would prove nothing
  // about the consent -> nonce edge.
  assert.equal(/season_action_refused/.test(out), false,
    `expected to pass the Season gate and refuse at consent; got: ${out.slice(0, 400)}`);

  const after = await writtenArtefacts(home);
  assert.equal(after.nonces, before.nonces,
    "a nonce was claimed even though consent did not succeed — the nonce precedes consent");
  assert.equal(after.locks, before.locks, "a lock was taken before consent succeeded");
  assert.equal(after.transactions, before.transactions, "a transaction was opened before consent succeeded");
});

// FO-04 is the one source assertion that is legitimately about ABSENCE of a
// specific, named, previously-shipped defect. It is a regression guard for one
// exact string that must never return to the effect path, not a proof of order.
test("FO-04 the superseded post-lock shape check is absent from the effect path", async () => {
  const src = await readFile(CLI, "utf8");
  assert.equal(src.includes("assessReversibility("), false,
    "the post-lock shape check is back on the effect path");
});

// FO-05 pins the property that made D3b brittle: the proof must survive a
// refactor that renames or inlines the gate binding. If a future change can
// break FO-01..FO-03 only by changing BEHAVIOR, this suite has done its job.
// The gate binding is deliberately NOT referenced by name anywhere above.
test("FO-05 the ordering proof does not depend on any source identifier", async () => {
  const thisFile = await readFile(
    join(REPO, "tests", "node0-closure-sprint-correction.test.js"), "utf8",
  );
  const behavioral = thisFile.slice(thisFile.indexOf("test(\"FO-01"), thisFile.indexOf("test(\"FO-04"));
  for (const identifier of [
    "const seasonGate",
    "corridorRenameSeasonFateGate",
    "corridorConsentGate(",
    "claimCorridorWriteNonce(",
    "acquireClosureLock({",
    "runTransactionalMechanicalClosure({",
  ]) {
    assert.equal(behavioral.includes(identifier), false,
      `FO-01..FO-03 reference the production identifier ${identifier} — the proof is not behavioral`);
  }
});

// ── D4 ─────────────────────────────────────────────────────────────────────

test("D4 the effect route calls the complete typed FATE contract, not two predicates", async () => {
  const src = await readFile(CLI, "utf8");
  assert.ok(src.includes("evaluateFatePolicy({"), "the effect route does not call the typed FATE contract");
  assert.ok(src.includes("evaluateSeasonActionAuthority({"), "the effect route does not evaluate Season authority");
  assert.ok(src.includes("readExecutingRepositoryBinding({ runGit: realGitRunner })"),
    "the effect route does not measure the executing repository independently");

  // And it must never re-derive the expected binding from the state itself.
  assert.equal(/repositoryCommit:\s*state\.repository_commit/.test(src), false,
    "the effect route compares the Season State against itself");
  assert.equal(/repositoryTree:\s*state\.repository_tree/.test(src), false,
    "the effect route compares the Season State against itself");
});

test("D4b a wrong repository binding refuses the effect route", async () => {
  const home = await newHome();
  await corridorAtCheckpoint(home);
  await seedSeason(home, { repository_commit: "f".repeat(40) });
  // Baseline AFTER setup: the corridor walk legitimately claims nonces of its
  // own. What must not change is the count across the refused effect call.
  const before = await writtenArtefacts(home);

  const out = run(home, [
    "mission", "corridor", "complete", ID,
    "--season", SEASON, "--nonce", "csc-bind", "--expires", future(),
  ], { allowFail: true });

  assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 240)}`);
  assert.match(out, /repository_commit_mismatch/, `expected a binding refusal, got: ${out.slice(0, 240)}`);
  const after = await writtenArtefacts(home);
  assert.equal(after.nonces, before.nonces, "a nonce was claimed despite a repository binding mismatch");
  assert.equal(after.locks, before.locks, "a lock was taken despite a repository binding mismatch");
  assert.equal(after.transactions, before.transactions, "a transaction was written despite a binding mismatch");
});
