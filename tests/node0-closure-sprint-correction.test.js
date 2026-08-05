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

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
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

test("D3b the gate is positioned before consent, nonce and lock acquisition", async () => {
  const src = await readFile(CLI, "utf8");
  const gate = src.indexOf("const seasonGate = await corridorRenameSeasonFateGate");
  assert.ok(gate > 0, "the season/FATE gate is absent from the effect route");

  const after = src.slice(gate);
  const iConsent = after.indexOf("corridorConsentGate(argv");
  const iNonce = after.indexOf("claimCorridorWriteNonce(argv");
  const iLock = after.indexOf("acquireClosureLock({");
  const iTx = after.indexOf("runTransactionalMechanicalClosure({");
  for (const [name, i] of [["consent", iConsent], ["nonce", iNonce], ["lock", iLock], ["transaction", iTx]]) {
    assert.ok(i > 0, `${name} not found after the gate — ordering cannot be established`);
  }
  assert.ok(iConsent < iNonce && iNonce < iLock && iLock < iTx, "expected consent -> nonce -> lock -> transaction after the gate");

  // The superseded post-lock shape check must be gone.
  assert.equal(src.includes("assessReversibility("), false, "the post-lock shape check is still on the effect path");
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
