// SEASON-HANDOFF-SCRIPTS-1A — acceptance contract for the operator wrappers.
//
// The scripts are glue; the proof they owe is that the GLUE IS HONEST:
// save.sh really derives this repo's HEAD into the persisted state and
// refuses to guess a season; resume.sh really re-derives both sealed receipt
// envelopes from bytes (not string-compare), really binds the port, and is
// fail-closed on every tampered or dirty input. Tamper cases use byte-level
// mutations of real/synthetic envelopes because a checker that only matched
// pins would pass any file wearing the right label.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  digestEnvelope,
  verifyGenesisReceipts,
  checkWorktrees,
  checkPortFree,
  runPreflight,
  PRE0_BODY_DIGEST_PIN,
  PROD01_2B_RECEIPT_HASH_PIN,
} from "../scripts/season/resume-check.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SAVE_SH = join(REPO_ROOT, "scripts", "season", "save.sh");
const RESUME_SH = join(REPO_ROOT, "scripts", "season", "resume.sh");

const FROM_HASH = PROD01_2B_RECEIPT_HASH_PIN;
const SEED_COMMIT = "68b8efd43925335a4b3f3742ea735baaa501c2b9";
const SEED_TREE = "35e50e2df264c841fcc7624af635604bdff9779c";

const newHome = () => mkdtemp(join(tmpdir(), "dema-season-scripts-"));
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

async function tempGitRepo({ dirty = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "dema-season-wt-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "test@example.invalid"], dir);
  git(["config", "user.name", "test"], dir);
  await writeFile(join(dir, "seed.txt"), "seed\n");
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "seed"], dir);
  if (dirty) await writeFile(join(dir, "dirty.txt"), "uncommitted\n");
  return dir;
}

async function freePort() {
  return new Promise((res) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const p = srv.address().port;
      srv.close(() => res(p));
    });
  });
}

/** Seal a synthetic envelope exactly like the real scheme: body_digest first,
 * then receipt_hash over everything except receipt_hash itself. */
function sealEnvelope(phase, body, extraEnvelopeFields = {}) {
  const bodyDigest = createHash("sha256").update(canonicalJson(body)).digest("hex");
  const env = {
    schema: "bizra.genesis.receipt_envelope.v1",
    phase,
    sealed_at: "2026-08-25T00:00:00Z",
    body,
    body_digest: bodyDigest,
    ...extraEnvelopeFields,
  };
  return { ...env, receipt_hash: digestEnvelope(env).receipt_hash };
}

async function writeAudits(dir, pre0Env, twobEnv) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "PRE0_REALITY_RECONCILIATION_1A.json"), JSON.stringify(pre0Env, null, 2));
  await writeFile(join(dir, "PROD01_2B_REBIND_1A.json"), JSON.stringify(twobEnv, null, 2));
}

function bash(script, args, env = {}) {
  const r = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", json: safeJson(r.stdout) };
}

// ── digest scheme against the committed receipts ────────────────────────────

test("H1: committed PRE0 + 2B receipts re-derive to their recorded digests and the pins", async () => {
  const res = await verifyGenesisReceipts({});
  assert.equal(res.ok, true, JSON.stringify(res.checks, null, 2));
  assert.equal(res.pre0.body_digest, PRE0_BODY_DIGEST_PIN);
  assert.equal(res.twob.receipt_hash, PROD01_2B_RECEIPT_HASH_PIN);
});

test("H2: a flipped body byte breaks rederivation even though the recorded fields still wear the pins", async () => {
  const srcDir = join(REPO_ROOT, "docs", "audits");
  const tmp = await mkdtemp(join(tmpdir(), "dema-season-tamper-"));
  for (const f of ["PRE0_REALITY_RECONCILIATION_1A.json", "PROD01_2B_REBIND_1A.json"]) {
    await writeFile(join(tmp, f), await readFile(join(srcDir, f), "utf8"));
  }
  const pre0 = JSON.parse(await readFile(join(tmp, "PRE0_REALITY_RECONCILIATION_1A.json"), "utf8"));
  pre0.body.truth_label = "TAMPERED";
  await writeFile(join(tmp, "PRE0_REALITY_RECONCILIATION_1A.json"), JSON.stringify(pre0, null, 2));

  const res = await verifyGenesisReceipts({ auditsDir: tmp });
  assert.equal(res.ok, false);
  const names = res.checks.filter((c) => !c.pass).map((c) => c.name).sort();
  // the envelope hash covers the body, so a body flip must break BOTH the
  // body-digest pin check and the envelope rederivation — either alone would
  // mean the two hashes do not actually overlap
  assert.deepEqual(names, ["pre0_body_digest_matches_pin", "pre0_receipt_rederived"]);
  await rm(tmp, { recursive: true, force: true });
});

test("H3: synthetic chain break is isolated from hash-integrity checks (and a linked pair passes them)", async () => {
  const wrong = sealEnvelope("PRE0_TEST", { schema: "t.v0" });
  const twobBad = sealEnvelope("TWOB_TEST", {
    schema: "t2.v0",
    previous_receipt_hash: "0".repeat(64),
    bindings: { pre0_body_digest: "f".repeat(64) },
  });

  const res = await verifyGenesisReceipts({ auditsDir: await writeTemp(wrong, twobBad) });
  assert.equal(res.ok, false);
  // Synthetic envelopes cannot match the real-world pins, but they are
  // self-consistent, so both rederivation checks pass while BOTH chain checks
  // fail — proving chain verification is independent of digest rederivation.
  const failed = res.checks.filter((c) => !c.pass).map((c) => c.name).sort();
  assert.deepEqual(failed, [
    "chain_2b_binds_pre0_body_digest",
    "chain_2b_predecessor_is_pre0",
    "pre0_body_digest_matches_pin",
    "prod01_2b_receipt_matches_pin",
  ]);
  const passed = res.checks.filter((c) => c.pass).map((c) => c.name).sort();
  assert.deepEqual(passed, ["pre0_receipt_rederived", "prod01_2b_body_digest_rederived"]);

  const twobGood = sealEnvelope("TWOB_TEST", {
    schema: "t2.v0",
    previous_receipt_hash: wrong.receipt_hash,
    bindings: { pre0_body_digest: wrong.body_digest },
  }, { previous_receipt_hash: wrong.receipt_hash });
  const res2 = await verifyGenesisReceipts({ auditsDir: await writeTemp(wrong, twobGood) });
  const stillFailed = res2.checks.filter((c) => !c.pass).map((c) => c.name).sort();
  // with the chain links repaired, ONLY the world-pins remain failed
  assert.deepEqual(stillFailed, [
    "pre0_body_digest_matches_pin",
    "prod01_2b_receipt_matches_pin",
  ]);

  async function writeTemp(pre0Env, twobEnv) {
    const tmp = await mkdtemp(join(tmpdir(), "dema-season-chain-"));
    await writeAudits(tmp, pre0Env, twobEnv);
    return tmp;
  }
});

// ── worktrees and port probes are measured, not assumed ─────────────────────

test("W1: clean / dirty / non-repo worktrees are each classified truthfully", async () => {
  const clean = await tempGitRepo();
  const dirty = await tempGitRepo({ dirty: true });
  const plain = await mkdtemp(join(tmpdir(), "dema-season-plain-"));

  const [a, b, c] = checkWorktrees([clean, dirty, plain]);
  assert.equal(a.clean, true);
  assert.equal(a.dirty_count, 0);
  assert.equal(b.clean, false);
  assert.equal(b.dirty_count, 1);
  assert.equal(b.reason, "dirty_worktree");
  assert.equal(c.clean, false);
  assert.equal(c.reason, "not_a_git_worktree");

  await rm(clean, { recursive: true, force: true });
  await rm(dirty, { recursive: true, force: true });
  await rm(plain, { recursive: true, force: true });
});

test("P1: port probe reports FREE when bindable and occupied when something listens", async () => {
  const p = await freePort();
  const r1 = await checkPortFree(p);
  assert.equal(r1.free, true);

  const held = await new Promise((res) => {
    const srv = createServer();
    srv.listen(p, "127.0.0.1", () => res(srv));
  });
  const r2 = await checkPortFree(p);
  assert.equal(r2.free, false);
  assert.equal(r2.reason, "EADDRINUSE");
  held.close();
});

// ── full preflight + CLI behavior ────────────────────────────────────────────

test("R1: sandboxed preflight with clean worktree and free port is READY_FOR_HUMAN_GO", async () => {
  const wt = await tempGitRepo();
  const home = await newHome();
  const report = await runPreflight({
    from: `sha256:${FROM_HASH}`,
    worktrees: [wt],
    port: await freePort(),
    demaHome: home,
  });
  assert.equal(report.ready, true, JSON.stringify(report.blocked_by));
  assert.equal(report.outcome, "READY_FOR_HUMAN_GO");
  assert.equal(report.blocked_by.length, 0);
  await rm(wt, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

test("R2: dirty worktree AND occupied port each land in blocked_by (fail-closed)", async () => {
  const wt = await tempGitRepo({ dirty: true });
  const home = await newHome();
  const p = await freePort();
  const report = await runPreflight({
    from: FROM_HASH,
    worktrees: [wt],
    port: p,
    demaHome: home,
    // occupy the port between probe setup and run via a listener below
  });
  assert.equal(report.ready, false);
  assert.equal(report.outcome, "NOT_READY_FOR_HUMAN_GO");
  assert.ok(report.blocked_by.includes(`worktree_dirty:${wt}`));

  const held = await new Promise((res) => {
    const srv = createServer();
    srv.listen(p, "127.0.0.1", () => res(srv));
  });
  const report2 = await runPreflight({ from: FROM_HASH, worktrees: [wt], port: p, demaHome: home });
  assert.ok(report2.blocked_by.some((b) => b.startsWith(`port_EADDRINUSE:${p}`)));
  held.close();
  await rm(wt, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

test("R3: resume.sh exits 0 with the READY marker line in a verified sandbox", async () => {
  const wt = await tempGitRepo();
  const home = await newHome();
  const r = bash(RESUME_SH, ["--from", FROM_HASH], {
    DEMA_SEASON_WORKTREES: wt,
    DEMA_SEASON_PORT: String(await freePort()),
    DEMA_HOME: home,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /READY_FOR_HUMAN_GO — awaiting exact H1 block/);
  await rm(wt, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

test("R4: resume.sh refuses malformed or missing --from before probing anything", () => {
  const miss = bash(RESUME_SH, [], {});
  assert.notEqual(miss.status, 0);
  assert.match(miss.stderr, /--from <handoff-receipt-hash> is required/);

  const bad = bash(RESUME_SH, ["--from", "nothex"], {});
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /from_malformed/);
});

test("S1: save.sh derives commit+tree from THIS repo HEAD and emits a copyable handoff line", async () => {
  const home = await newHome();
  const headCommit = git(["rev-parse", "HEAD"], REPO_ROOT);
  const headTree = git(["rev-parse", "HEAD^{tree}"], REPO_ROOT);

  const r = bash(SAVE_SH, [
    "--season", "s1", "--mission", "M1", "--phase", "P1",
    "--next", "N1",
  ], { DEMA_HOME: home });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Season state saved/);
  assert.match(r.stdout, /handoff: resume elsewhere with: scripts\/season\/resume\.sh --from sha256:[0-9a-f]{64}/);

  const states = await readdir(join(home, "seasons", "s1", "states"));
  const state = JSON.parse(await readFile(join(home, "seasons", "s1", "states", states[0]), "utf8"));
  assert.equal(state.repository_commit, headCommit);
  assert.equal(state.repository_tree, headTree);
  assert.equal(state.state_sequence, 1);
  await rm(home, { recursive: true, force: true });
});

test("S2: second save appends sequence 2 onto the same season chain", async () => {
  const home = await newHome();
  bash(SAVE_SH, ["--season", "s1", "--mission", "M1", "--phase", "P1", "--next", "N1"], { DEMA_HOME: home });
  const r = bash(SAVE_SH, ["--season", "s1", "--mission", "M1", "--phase", "P2", "--next", "N2"], { DEMA_HOME: home });
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const head = JSON.parse(await readFile(join(home, "seasons", "s1", "HEAD.json"), "utf8"));
  assert.equal(head.state_sequence, 2);
  await rm(home, { recursive: true, force: true });
});

test("S3: --reason maps onto the kernel's exact-token law; conflict and non-token refusals write nothing", async () => {
  const home = await newHome();
  const r = bash(SAVE_SH, [
    "--season", "s1", "--mission", "M1", "--phase", "P1",
    "--reason", "H1_BOUNDARY_READY",
  ], { DEMA_HOME: home });
  assert.equal(r.status, 0, r.stdout + r.stderr);

  const states = await readdir(join(home, "seasons", "s1", "states"));
  const state = JSON.parse(await readFile(join(home, "seasons", "s1", "states", states[0]), "utf8"));
  assert.equal(state.next_safe_action, "H1_BOUNDARY_READY");

  const conflict = bash(SAVE_SH, [
    "--season", "s1", "--mission", "M1", "--phase", "P1",
    "--next", "X", "--reason", "Y",
  ], { DEMA_HOME: home });
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /not both/);

  // free prose is not a legal action token — the kernel owns that law
  const prose = bash(SAVE_SH, [
    "--season", "s1", "--mission", "M1", "--phase", "P1",
    "--reason", "H1 boundary, ready",
  ], { DEMA_HOME: home });
  assert.equal(prose.status, 1);
  assert.match(prose.stderr, /next_safe_action_malformed/);

  assert.equal((await readdir(join(home, "seasons", "s1", "states"))).length, 1);
  await rm(home, { recursive: true, force: true });
});

test("S4b: with exactly one existing season and no --season, save.sh resolves it automatically", async () => {
  const home = await newHome();
  bash(SAVE_SH, ["--season", "only", "--mission", "M1", "--phase", "P1", "--next", "N1"], { DEMA_HOME: home });
  const r = bash(SAVE_SH, ["--mission", "M1", "--phase", "P2", "--next", "N2"], { DEMA_HOME: home });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /using the only existing season: only/);

  const head = JSON.parse(await readFile(join(home, "seasons", "only", "HEAD.json"), "utf8"));
  assert.equal(head.state_sequence, 2);
  await rm(home, { recursive: true, force: true });
});

test("S5: no seasons → refuse asking for an explicit --season; two seasons → season_ambiguous listing both", async () => {
  const empty = await newHome();
  const r0 = bash(SAVE_SH, ["--mission", "M1", "--phase", "P1", "--next", "N1"], { DEMA_HOME: empty });
  assert.equal(r0.status, 1);
  assert.match(r0.stderr, /--season <new-id>/);
  await rm(empty, { recursive: true, force: true });

  const home = await newHome();
  const { saveSeasonState } = await import("../packages/receipts/src/season-state-store.js");
  for (const id of ["alpha", "beta"]) {
    const saved = await saveSeasonState({
      demaHome: home,
      state: {
        season_id: id, mission_id: "M1", mission_contract_hash: null,
        mission_phase: "P1", completed_steps: [], next_safe_action: "N1",
        must_not_repeat: [], pending_consent: [], last_receipt_hash: null,
        repository_commit: SEED_COMMIT, repository_tree: SEED_TREE,
        saved_at: "2026-08-25T00:00:00Z",
      },
    });
    assert.equal(saved.ok, true, JSON.stringify(saved));
  }
  const r2 = bash(SAVE_SH, ["--mission", "M1", "--phase", "P1", "--next", "N1"], { DEMA_HOME: home });
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /season_ambiguous/);
  assert.match(r2.stderr, /alpha/);
  assert.match(r2.stderr, /beta/);
  await rm(home, { recursive: true, force: true });
});
