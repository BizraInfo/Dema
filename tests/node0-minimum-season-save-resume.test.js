// NODE0-MINIMUM-SEASON-SAVE-RESUME-1A — S1..S13 acceptance contract.
//
// The proof this slice owes is not "the functions return objects" — it is that a
// NEW OPERATING-SYSTEM PROCESS, holding no chat history and no shared memory,
// reconstructs the exact continuation from bytes alone. So S3, S6, S7 and S13
// spawn real child processes and, where the contract says "terminate", really
// call process.exit() mid-transaction. An injected-fs fake would prove nothing
// here: `finally` does not run after process.exit, and surviving exactly that is
// what the save law is for.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEMANTIC_STATE_FIELDS,
  buildSeasonState,
  buildSeasonHead,
  hashSeasonState,
  verifySeasonState,
  verifySeasonHead,
  validateSeasonStateInput,
  findSecretBearingFields,
  planNode0MinimumSeasonSaveResume,
  buildNode0MinimumSeasonSaveResumePayload,
  verifyNode0MinimumSeasonSaveResume,
  runNode0MinimumSeasonSaveResume,
  node0MinimumSeasonSaveResumeBoundary,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
  NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE,
} from "../packages/core/src/node0-minimum-season-save-resume.js";
import {
  saveSeasonState,
  seasonStatus,
  resumeSeason,
  loadSeasonHead,
  _internal,
} from "../packages/receipts/src/season-state-store.js";
import { runNode0MinimumSeasonSaveResumeCheck } from "../scripts/review/node0-minimum-season-save-resume-check.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const STORE = join(REPO_ROOT, "packages", "receipts", "src", "season-state-store.js");

const COMMIT = "68b8efd43925335a4b3f3742ea735baaa501c2b9";
const TREE = "35e50e2df264c841fcc7624af635604bdff9779c";

const newHome = () => mkdtemp(join(tmpdir(), "dema-season-"));
const safeJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

function baseState(over = {}) {
  return {
    season_id: "season-test",
    mission_id: "NODE0-MINIMUM-SEASON-SAVE-RESUME-1A",
    mission_contract_hash: null,
    mission_phase: "IMPLEMENTATION",
    completed_steps: ["kernel implemented", "store implemented"],
    next_safe_action: "QUALIFY_MINIMUM_SEASON_SAVE_RESUME",
    must_not_repeat: ["reopen C4D", "alter commit 68b8efd", "begin Node1"],
    pending_consent: [],
    last_receipt_hash: null,
    repository_commit: COMMIT,
    repository_tree: TREE,
    saved_at: "2026-08-05T12:00:00Z",
    ...over,
  };
}

/** Run the shipped CLI in a genuinely separate OS process. */
function cli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", json: safeJson(r.stdout) };
}

async function childScript(home, name, body) {
  const p = join(home, name);
  await writeFile(p, body, "utf8");
  return p;
}

// ── S1 ──────────────────────────────────────────────────────────────────────
test("S1: first save creates sequence 1, writes state+receipt+HEAD, re-read verifies, status reports exactly", async () => {
  const home = await newHome();
  const r = await saveSeasonState({ demaHome: home, state: baseState() });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.state_sequence, 1);
  assert.match(r.state_hash, /^sha256:[0-9a-f]{64}$/);
  assert.match(r.receipt_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(r.state.previous_state_hash, null);

  const states = (await readdir(_internal.statesDir(home, "season-test"))).filter((f) => f.endsWith(".json"));
  const receipts = (await readdir(_internal.receiptsDir(home, "season-test"))).filter((f) => f.endsWith(".json"));
  assert.equal(states.length, 1);
  assert.equal(receipts.length, 1);

  const head = JSON.parse(await readFile(_internal.headPath(home, "season-test"), "utf8"));
  assert.equal(verifySeasonHead(head).ok, true);
  assert.equal(head.state_hash, r.state_hash);

  const loaded = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(loaded.ok, true);
  assert.equal(verifySeasonState(loaded.state).ok, true);

  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.ok, true);
  assert.equal(st.mission_id, "NODE0-MINIMUM-SEASON-SAVE-RESUME-1A");
  assert.equal(st.mission_phase, "IMPLEMENTATION");
  assert.equal(st.state_sequence, 1);
  assert.equal(st.next_safe_action, "QUALIFY_MINIMUM_SEASON_SAVE_RESUME");
  assert.deepEqual([...st.must_not_repeat], ["reopen C4D", "alter commit 68b8efd", "begin Node1"]);
  await rm(home, { recursive: true, force: true });
});

// ── S2 ──────────────────────────────────────────────────────────────────────
test("S2: second save binds to sequence 1, old state stays immutable, HEAD points only to sequence 2", async () => {
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  const firstPath = join(_internal.statesDir(home, "season-test"), _internal.objectName(first.state_hash));
  const firstBytes = await readFile(firstPath, "utf8");

  const second = await saveSeasonState({
    demaHome: home,
    state: baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T13:00:00Z" }),
  });
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.state_sequence, 2);
  assert.equal(second.state.previous_state_hash, first.state_hash);

  assert.equal(await readFile(firstPath, "utf8"), firstBytes, "content-addressed state must be immutable");

  const head = JSON.parse(await readFile(_internal.headPath(home, "season-test"), "utf8"));
  assert.equal(head.state_sequence, 2);
  assert.equal(head.state_hash, second.state_hash);
  assert.notEqual(head.state_hash, first.state_hash);
  await rm(home, { recursive: true, force: true });
});

// ── S3 ──────────────────────────────────────────────────────────────────────
test("S3: a brand-new process reconstructs the exact continuation from DEMA_HOME alone", async () => {
  const home = await newHome();
  const stateA = baseState({
    mission_phase: "IMPLEMENTATION_COMPLETE_AWAITING_QUALIFICATION",
    pending_consent: [{ phrase: "GO: push season slice", scope: "push" }],
  });

  const saver = await childScript(home, "proc-a.mjs", `
import { saveSeasonState } from ${JSON.stringify(STORE)};
const r = await saveSeasonState({ demaHome: process.env.DEMA_HOME, state: ${JSON.stringify(stateA)}, worldAnchor: { observed: { fixture: "S3-world" } } });
if (!r.ok) { console.error(JSON.stringify(r)); process.exit(1); }
console.log(JSON.stringify({ state_hash: r.state_hash, receipt_hash: r.receipt_hash }));
`);
  const a = spawnSync(process.execPath, [saver], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });
  assert.equal(a.status, 0, a.stderr);
  const saved = JSON.parse(a.stdout.trim().split("\n").pop());

  // Process B: clean process, given only the checkout and DEMA_HOME.
  const b = cli(["season", "resume", "--json", "--dema-home", home]);
  assert.equal(b.status, 0, b.stderr);
  const c = b.json.continuation;
  assert.equal(b.json.ok, true);
  assert.equal(c.mission_id, "NODE0-MINIMUM-SEASON-SAVE-RESUME-1A");
  assert.equal(c.mission_phase, "IMPLEMENTATION_COMPLETE_AWAITING_QUALIFICATION");
  assert.deepEqual([...c.completed_steps], ["kernel implemented", "store implemented"]);
  assert.deepEqual([...c.must_not_repeat], ["reopen C4D", "alter commit 68b8efd", "begin Node1"]);
  assert.equal(c.next_safe_action, "QUALIFY_MINIMUM_SEASON_SAVE_RESUME");
  assert.equal(c.pending_consent.length, 1);
  assert.equal(c.state_hash, saved.state_hash);
  assert.equal(b.json.receipt_hash, saved.receipt_hash);
  assert.equal(b.json.executed, false);
  assert.equal(b.json.mutated, false);
  await rm(home, { recursive: true, force: true });
});

// ── S4 ──────────────────────────────────────────────────────────────────────
test("S4: resume preserves pending consent as pending and grants no authority", async () => {
  const home = await newHome();
  // REALM0-ANCHOR-BINDING-0B refusal record — original property: pending consent survives as PENDING.
  // Original expected blocker: none (legacy resume returned the continuation).
  // New prerequisite: WORLD_ANCHOR_MATCH (resume withholds on every other
  // outcome). The save is therefore anchored through the PRODUCTION path so
  // the test still reaches and proves its original property; the legacy
  // withholding itself is proven by B-07 in realm0-anchor-binding.test.js.
  await saveSeasonState({
    demaHome: home,
    state: baseState({ pending_consent: [{ phrase: "GO: push the season slice", scope: "push" }] }),
    worldAnchor: { observed: { fixture: "S4-world" } },
  });
  const r = await resumeSeason({ demaHome: home, seasonId: "season-test" });
  assert.equal(r.ok, true);
  assert.equal(r.consent_granted, false);
  assert.equal(r.continuation.consent_granted, false);
  assert.equal(r.continuation.pending_consent.length, 1);
  assert.equal(r.continuation.pending_consent[0].phrase, "GO: push the season slice");
  assert.equal(r.executed, false);
  assert.equal(r.mutated, false);
  assert.equal(Object.values(r.continuation.boundary).every((v) => v === false), true);

  const before = await readFile(_internal.headPath(home, "season-test"), "utf8");
  await resumeSeason({ demaHome: home, seasonId: "season-test" });
  assert.equal(await readFile(_internal.headPath(home, "season-test"), "utf8"), before, "resume mutates nothing");
  await rm(home, { recursive: true, force: true });
});

// ── S5 ──────────────────────────────────────────────────────────────────────
test("S5: three prohibited repeats survive a new process byte-exactly", async () => {
  const home = await newHome();
  const prohibited = [
    "reopen C4D",
    "alter commit 68b8efd43925335a4b3f3742ea735baaa501c2b9",
    "  begin  Node1  ",
  ];
  // REALM0-ANCHOR-BINDING-0B refusal record — original property: must_not_repeat survives byte-exactly.
  // Original expected blocker: none (legacy resume returned the continuation).
  // New prerequisite: WORLD_ANCHOR_MATCH (resume withholds on every other
  // outcome). The save is therefore anchored through the PRODUCTION path so
  // the test still reaches and proves its original property; the legacy
  // withholding itself is proven by B-07 in realm0-anchor-binding.test.js.
  await saveSeasonState({
    demaHome: home,
    state: baseState({ must_not_repeat: prohibited }),
    worldAnchor: { observed: { fixture: "S5-world" } },
  });

  const r = cli(["season", "resume", "--json", "--dema-home", home]);
  assert.equal(r.status, 0, r.stderr);
  const got = r.json.continuation.must_not_repeat;
  assert.equal(got.length, 3);
  for (let i = 0; i < prohibited.length; i++) {
    assert.equal(got[i], prohibited[i], "byte-exact, including order and whitespace");
    assert.equal(Buffer.compare(Buffer.from(got[i], "utf8"), Buffer.from(prohibited[i], "utf8")), 0);
  }
  await rm(home, { recursive: true, force: true });
});

// ── S6 ──────────────────────────────────────────────────────────────────────
test("S6: real process death before HEAD replacement leaves the previous HEAD valid and authoritative", async () => {
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  const headBefore = await readFile(_internal.headPath(home, "season-test"), "utf8");

  const crash = await childScript(home, "crash-6.mjs", `
import { saveSeasonState } from ${JSON.stringify(STORE)};
await saveSeasonState({
  demaHome: process.env.DEMA_HOME,
  state: ${JSON.stringify(baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T14:00:00Z" }))},
  hooks: { afterReceiptFsync: () => { process.exit(9); } },
});
console.log("UNREACHABLE");
`);
  const c = spawnSync(process.execPath, [crash], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });
  assert.equal(c.status, 9, "child must really have died at the injected point");
  assert.ok(!c.stdout.includes("UNREACHABLE"));

  assert.equal(await readFile(_internal.headPath(home, "season-test"), "utf8"), headBefore);
  const loaded = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.state_hash, first.state_hash);
  assert.equal(loaded.state.state_sequence, 1);

  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.state_sequence, 1, "orphan content must never advance the sequence");
  await rm(home, { recursive: true, force: true });
});

// ── S7 ──────────────────────────────────────────────────────────────────────
test("S7: real process death immediately after HEAD publication leaves a fully verifiable new HEAD", async () => {
  const home = await newHome();
  await saveSeasonState({ demaHome: home, state: baseState() });

  const crash = await childScript(home, "crash-7.mjs", `
import { saveSeasonState } from ${JSON.stringify(STORE)};
await saveSeasonState({
  demaHome: process.env.DEMA_HOME,
  state: ${JSON.stringify(baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T15:00:00Z" }))},
  hooks: { afterHeadReplace: () => { process.exit(7); } },
});
console.log("UNREACHABLE");
`);
  const c = spawnSync(process.execPath, [crash], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });
  assert.equal(c.status, 7, "child must have died right after HEAD publication");
  assert.ok(!c.stdout.includes("UNREACHABLE"));

  const loaded = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  assert.equal(loaded.state.state_sequence, 2);
  assert.equal(loaded.state.mission_phase, "QUALIFICATION");
  assert.equal(verifySeasonState(loaded.state).ok, true);

  const r = cli(["season", "status", "--json", "--dema-home", home]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.state_sequence, 2);
  assert.equal(r.json.verified, true);
  await rm(home, { recursive: true, force: true });
});

// ── S8 ──────────────────────────────────────────────────────────────────────
test("S8: one altered byte in a stored state makes status and resume fail closed, with zero mutation", async () => {
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  const statePath = join(_internal.statesDir(home, "season-test"), _internal.objectName(first.state_hash));

  const raw = JSON.parse(await readFile(statePath, "utf8"));
  raw.next_safe_action = "PUSH_TO_MAIN"; // one field; stored hash left untouched
  await writeFile(statePath, JSON.stringify(raw, null, 2) + "\n", "utf8");

  const headBefore = await readFile(_internal.headPath(home, "season-test"), "utf8");
  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.ok, false);
  assert.equal(st.reason, "state_hash_mismatch");

  const rs = await resumeSeason({ demaHome: home, seasonId: "season-test" });
  assert.equal(rs.ok, false);
  assert.equal(rs.reason, "state_hash_mismatch");
  assert.equal(rs.continuation, undefined, "a refused resume must not project a continuation");
  assert.equal(await readFile(_internal.headPath(home, "season-test"), "utf8"), headBefore);

  const cliR = cli(["season", "status", "--json", "--dema-home", home]);
  assert.equal(cliR.status, 1, "refusal must exit non-zero");
  assert.ok(!cliR.stderr.includes("at Object."), "no stack trace may leak");
  await rm(home, { recursive: true, force: true });
});

// ── S9 ──────────────────────────────────────────────────────────────────────
test("S9: altering HEAD state hash, receipt hash or sequence fails closed", async () => {
  for (const [field, value] of [
    ["state_hash", "sha256:" + "0".repeat(64)],
    ["receipt_hash", "sha256:" + "1".repeat(64)],
    ["state_sequence", 99],
  ]) {
    const home = await newHome();
    await saveSeasonState({ demaHome: home, state: baseState() });
    const hp = _internal.headPath(home, "season-test");
    const head = JSON.parse(await readFile(hp, "utf8"));
    head[field] = value; // head_hash deliberately NOT recomputed
    await writeFile(hp, JSON.stringify(head, null, 2) + "\n", "utf8");

    const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
    assert.equal(st.ok, false, `${field} tamper must be refused`);
    assert.equal(st.reason, "malformed_head");
    await rm(home, { recursive: true, force: true });
  }
});

test("S9b: a HEAD re-hashed after tampering still fails — the fence, not HEAD, owns the sequence", async () => {
  const home = await newHome();
  await saveSeasonState({ demaHome: home, state: baseState() });
  const second = await saveSeasonState({
    demaHome: home, state: baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T16:00:00Z" }),
  });
  assert.equal(second.state_sequence, 2);

  // Roll HEAD back to sequence 1's objects but claim sequence 2, and RE-HASH so
  // the forgery is internally self-consistent. Hash-binding alone would accept
  // it; the independent anchor (the sequence fence) is what refuses.
  const seq1 = JSON.parse(await readFile(join(_internal.seqDir(home, "season-test"), _internal.seqName(1)), "utf8"));
  const forged = buildSeasonHead({
    season_id: "season-test",
    state_hash: seq1.state_hash,
    receipt_hash: seq1.receipt_hash,
    state_sequence: 2,
  });
  assert.equal(verifySeasonHead(forged).ok, true, "the forgery IS internally self-consistent");
  await writeFile(_internal.headPath(home, "season-test"), JSON.stringify(forged, null, 2) + "\n", "utf8");

  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.ok, false);
  assert.equal(st.reason, "head_candidates_conflict");
  await rm(home, { recursive: true, force: true });
});

// ── S10 ─────────────────────────────────────────────────────────────────────
test("S10: resume against a different commit or tree returns typed REPOSITORY_MISMATCH", async () => {
  const home = await newHome();
  // REALM0-ANCHOR-BINDING-0B refusal record — original property: wrong commit/tree is a typed REPOSITORY_MISMATCH; the matching pair resumes.
  // Original expected blocker: none (legacy resume returned the continuation).
  // New prerequisite: WORLD_ANCHOR_MATCH (resume withholds on every other
  // outcome). The save is therefore anchored through the PRODUCTION path so
  // the test still reaches and proves its original property; the legacy
  // withholding itself is proven by B-07 in realm0-anchor-binding.test.js.
  await saveSeasonState({
    demaHome: home, state: baseState(), worldAnchor: { observed: { fixture: "S10-world" } },
  });

  const wrongCommit = await resumeSeason({ demaHome: home, seasonId: "season-test", repositoryCommit: "a".repeat(40) });
  assert.equal(wrongCommit.ok, false);
  assert.equal(wrongCommit.outcome, "REPOSITORY_MISMATCH");
  assert.equal(wrongCommit.reason, "repository_commit_mismatch");
  assert.equal(wrongCommit.continuation, undefined);

  const wrongTree = await resumeSeason({
    demaHome: home, seasonId: "season-test", repositoryCommit: COMMIT, repositoryTree: "b".repeat(40),
  });
  assert.equal(wrongTree.outcome, "REPOSITORY_MISMATCH");
  assert.equal(wrongTree.reason, "repository_tree_mismatch");

  const right = await resumeSeason({
    demaHome: home, seasonId: "season-test", repositoryCommit: COMMIT, repositoryTree: TREE,
  });
  assert.equal(right.ok, true, "the matching pair still resumes");

  const r = cli(["season", "resume", "--json", "--dema-home", home, "--repo-commit", "c".repeat(40)]);
  assert.equal(r.status, 1);
  assert.equal(r.json.outcome, "REPOSITORY_MISMATCH");
  await rm(home, { recursive: true, force: true });
});

// ── S11 ─────────────────────────────────────────────────────────────────────
test("S11: status and resume on an unused home return typed EMPTY with no stack and no path leakage", async () => {
  const home = await newHome();
  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.ok, true);
  assert.equal(st.outcome, "EMPTY");
  const rs = await resumeSeason({ demaHome: home, seasonId: "season-test" });
  assert.equal(rs.outcome, "EMPTY");
  assert.equal(rs.continuation, undefined);

  for (const sub of ["status", "resume"]) {
    const r = cli(["season", sub, "--json", "--dema-home", home]);
    assert.equal(r.status, 0, "EMPTY is a legitimate first-use answer, not a failure");
    assert.equal(r.json.outcome, "EMPTY");
    assert.ok(!r.stderr.includes("Error"), "no exception surface");
    assert.ok(!/\/(etc|root)\//.test(r.stdout), "no filesystem detail outside DEMA_HOME");
  }
  await rm(home, { recursive: true, force: true });
});

// ── S12 ─────────────────────────────────────────────────────────────────────
test("S12: semantically identical state hashes identically; key order and clock cannot change it", async () => {
  const a = buildSeasonState(baseState());

  const src = baseState({ saved_at: "2027-01-01T00:00:00Z" });
  const shuffled = {};
  for (const k of Object.keys(src).sort().reverse()) shuffled[k] = src[k];
  const b = buildSeasonState(shuffled);

  assert.equal(a.ok && b.ok, true);
  assert.equal(a.state.state_hash, b.state.state_hash, "key order and saved_at must not move the hash");
  assert.notEqual(a.state.saved_at, b.state.saved_at, "the clock genuinely differed");

  const c = buildSeasonState(baseState({ next_safe_action: "SOMETHING_ELSE" }));
  assert.notEqual(c.state.state_hash, a.state.state_hash, "a real semantic change MUST move the hash");

  assert.ok(!SEMANTIC_STATE_FIELDS.includes("saved_at"), "clock excluded from the covered subset");
  assert.ok(!SEMANTIC_STATE_FIELDS.includes("state_hash"));

  // ...but the clock IS bound by the receipt, so it is attested, not unmoored.
  const home = await newHome();
  const saved = await saveSeasonState({ demaHome: home, state: baseState() });
  assert.equal(saved.receipt.saved_at, "2026-08-05T12:00:00Z");
  assert.equal(saved.receipt.state_hash, saved.state_hash);
  await rm(home, { recursive: true, force: true });
});

// ── S13 ─────────────────────────────────────────────────────────────────────
test("S13: two processes racing from the same HEAD — exactly one publishes, the stale one fails closed", async () => {
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  assert.equal(first.state_sequence, 1);

  const barrier = join(home, "barrier");
  await mkdir(barrier, { recursive: true });

  // Each child loads HEAD, then blocks at the documented linkFile seam until the
  // other has also loaded HEAD. Both therefore derive sequence 2 from the SAME
  // prior HEAD and genuinely race the fence — this is a race, not a retry.
  const mkChild = (tag, other, action) => childScript(home, `race-${tag}.mjs`, `
import { writeFileSync, existsSync } from "node:fs";
import { link } from "node:fs/promises";
import { saveSeasonState, DEFAULT_STORE_OPS } from ${JSON.stringify(STORE)};
const B = ${JSON.stringify(barrier)};
let armed = false;
const ops = { ...DEFAULT_STORE_OPS, linkFile: async (a, b) => {
  if (!armed) {
    armed = true;
    writeFileSync(B + "/${tag}.ready", "1");
    const deadline = Date.now() + 10000;
    while (!existsSync(B + "/${other}.ready") && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  return link(a, b);
} };
const state = ${JSON.stringify(baseState({ saved_at: "2026-08-05T17:00:00Z" }))};
state.next_safe_action = ${JSON.stringify(action)};
const r = await saveSeasonState({ demaHome: process.env.DEMA_HOME, ops, state });
console.log(JSON.stringify({ ok: r.ok, reason: r.reason ?? null, seq: r.state_sequence ?? null }));
`);

  const pa = await mkChild("a", "b", "ACTION_FROM_WRITER_A");
  const pb = await mkChild("b", "a", "ACTION_FROM_WRITER_B");

  const run = (p) =>
    new Promise((resolve) => {
      const ch = spawn(process.execPath, [p], { env: { ...process.env, DEMA_HOME: home } });
      let out = "";
      ch.stdout.on("data", (d) => (out += d));
      ch.on("close", () => resolve(safeJson(out.trim().split("\n").pop()) ?? { ok: false, reason: "no_output" }));
    });

  const [ra, rb] = await Promise.all([run(pa), run(pb)]);
  const winners = [ra, rb].filter((r) => r.ok);
  const losers = [ra, rb].filter((r) => !r.ok);
  assert.equal(winners.length, 1, `exactly one writer may publish sequence 2: ${JSON.stringify([ra, rb])}`);
  assert.equal(losers.length, 1);
  assert.equal(losers[0].reason, "stale_head_lost_race");
  assert.equal(winners[0].seq, 2);

  const loaded = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  assert.equal(loaded.state.state_sequence, 2);
  assert.equal(loaded.state.previous_state_hash, first.state_hash);
  assert.equal(verifySeasonState(loaded.state).ok, true, "no corrupt chain");
  await rm(home, { recursive: true, force: true });
});

// ── contract-level fail-closed conditions ───────────────────────────────────
test("secret-bearing state is refused before it is ever written", async () => {
  const home = await newHome();
  for (const [field, value] of [
    ["completed_steps", ["exported GITHUB_TOKEN=ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]],
    ["must_not_repeat", ["-----BEGIN OPENSSH PRIVATE KEY-----"]],
    ["completed_steps", ["used key sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"]],
    ["completed_steps", ["aws AKIAIOSFODNN7EXAMPLE rotated"]],
  ]) {
    const r = await saveSeasonState({ demaHome: home, state: baseState({ [field]: value }) });
    assert.equal(r.ok, false, `${field}=${value} must be refused`);
    assert.equal(r.reason, "secret_bearing_state");
  }
  assert.equal((await loadSeasonHead({ demaHome: home, seasonId: "season-test" })).outcome, "EMPTY",
    "a refused save must persist nothing");

  // legitimate SHA-bearing and env-shaped prose must NOT false-positive
  assert.equal(findSecretBearingFields({ s: "alter commit 68b8efd43925335a4b3f3742ea735baaa501c2b9" }).length, 0);
  assert.equal(findSecretBearingFields({ s: "STATE_SEQUENCE=2" }).length, 0);
  await rm(home, { recursive: true, force: true });
});

test("contract violations are individually named and fail closed", () => {
  for (const [over, reason] of [
    [{ completed_steps: ["a", "a"] }, "completed_steps_duplicate"],
    [{ pending_consent: "none" }, "pending_consent_shape_invalid"],
    [{ pending_consent: [{ phrase: "x" }] }, "pending_consent_shape_invalid"],
    [{ pending_consent: [{ phrase: "x", scope: "y", granted: true }] }, "pending_consent_shape_invalid"],
    [{ repository_commit: "not-a-sha" }, "repository_commit_malformed"],
    [{ repository_tree: "ABCDEF" }, "repository_tree_malformed"],
    [{ next_safe_action: "do everything" }, "next_safe_action_malformed"],
    [{ mission_phase: "lowercase" }, "mission_phase_malformed"],
    [{ season_id: "../escape" }, "season_id_malformed"],
    [{ must_not_repeat: "reopen C4D" }, "must_not_repeat_not_array"],
  ]) {
    const v = validateSeasonStateInput(baseState(over));
    assert.equal(v.ok, false, `${reason} must be refused`);
    assert.ok(v.blocked_by.includes(reason), `expected ${reason}, got ${v.blocked_by.join(",")}`);
  }
  assert.equal(validateSeasonStateInput(baseState()).ok, true);
});

test("unknown schema, sequence regression and missing state each fail closed", async () => {
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  const sp = join(_internal.statesDir(home, "season-test"), _internal.objectName(first.state_hash));
  const s = JSON.parse(await readFile(sp, "utf8"));
  s.schema = "bizra.dema.some_other_thing.v9";
  await writeFile(sp, JSON.stringify(s, null, 2) + "\n", "utf8");
  const st = await seasonStatus({ demaHome: home, seasonId: "season-test" });
  assert.equal(st.ok, false);
  assert.equal(st.reason, "unknown_schema");
  await rm(home, { recursive: true, force: true });

  const home2 = await newHome();
  await saveSeasonState({ demaHome: home2, state: baseState() });
  await saveSeasonState({ demaHome: home2, state: baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T18:00:00Z" }) });
  const regress = await saveSeasonState({ demaHome: home2, state: baseState({ state_sequence: 2, saved_at: "2026-08-05T19:00:00Z" }) });
  assert.equal(regress.ok, false);
  assert.equal(regress.reason, "sequence_regression");
  await rm(home2, { recursive: true, force: true });

  const home3 = await newHome();
  const only = await saveSeasonState({ demaHome: home3, state: baseState() });
  await rm(join(_internal.statesDir(home3, "season-test"), _internal.objectName(only.state_hash)));
  const gone = await seasonStatus({ demaHome: home3, seasonId: "season-test" });
  assert.equal(gone.ok, false);
  assert.equal(gone.reason, "state_missing");
  await rm(home3, { recursive: true, force: true });
});

test("S6b: a writer that dies between winning the fence and replacing HEAD is repaired by replaying the same save", async () => {
  // The window between S6 (before the fence) and S7 (after HEAD) is the one that
  // can strand a season: the sequence is already OWNED, so a naive retry would
  // hit EEXIST forever, while HEAD still names the previous state.
  const home = await newHome();
  const first = await saveSeasonState({ demaHome: home, state: baseState() });
  const second = baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T20:00:00Z" });

  const crash = await childScript(home, "crash-6b.mjs", `
import { saveSeasonState } from ${JSON.stringify(STORE)};
await saveSeasonState({
  demaHome: process.env.DEMA_HOME,
  state: ${JSON.stringify(second)},
  hooks: { afterFencePublish: () => { process.exit(6); } },
});
console.log("UNREACHABLE");
`);
  const c = spawnSync(process.execPath, [crash], { encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });
  assert.equal(c.status, 6, "child must have died holding the fence");

  // HEAD is stranded one behind, but still valid and authoritative.
  const stranded = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(stranded.ok, true);
  assert.equal(stranded.state.state_hash, first.state_hash);
  assert.equal(stranded.state.state_sequence, 1);

  // Replaying the identical save repairs HEAD instead of deadlocking on EEXIST.
  const repaired = await saveSeasonState({ demaHome: home, state: second });
  assert.equal(repaired.ok, true, JSON.stringify(repaired));
  assert.equal(repaired.idempotent, true);
  assert.equal(repaired.reason, "already_saved_idempotently");
  assert.equal(repaired.state_sequence, 2);

  const after = await loadSeasonHead({ demaHome: home, seasonId: "season-test" });
  assert.equal(after.state.state_sequence, 2, "HEAD must have caught up");
  assert.equal(after.state.previous_state_hash, first.state_hash);
  assert.equal(verifySeasonState(after.state).ok, true);
  await rm(home, { recursive: true, force: true });
});

test("a genuinely different state at an owned sequence is refused, not silently accepted", async () => {
  const home = await newHome();
  await saveSeasonState({ demaHome: home, state: baseState() });
  await saveSeasonState({ demaHome: home, state: baseState({ mission_phase: "QUALIFICATION", saved_at: "2026-08-05T21:00:00Z" }) });
  // sequence 2 is owned by the QUALIFICATION state; a different seq-2 candidate
  // must lose, and it must not be mistaken for an idempotent replay.
  const conflict = await saveSeasonState({
    demaHome: home, state: baseState({ state_sequence: 2, mission_phase: "SOMETHING_ELSE", saved_at: "2026-08-05T22:00:00Z" }),
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "sequence_regression");
  await rm(home, { recursive: true, force: true });
});

// ── scaffold contract surface (consumed by the review gate) ─────────────────
test("plan is fail-closed without the exact consent phrase", () => {
  const plan = planNode0MinimumSeasonSaveResume({ consent: "wrong", input: {} });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan is eligible with exact consent and well-formed input", () => {
  const plan = planNode0MinimumSeasonSaveResume({
    consent: NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE, input: baseState(),
  });
  assert.equal(plan.eligible, true, plan.blocked_by.join(", "));
  assert.equal(
    planNode0MinimumSeasonSaveResume({
      consent: NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE + " ", input: baseState(),
    }).eligible,
    false,
    "trailing whitespace is not the phrase",
  );
});

test("payload is content-addressed and carries an all-false boundary", () => {
  const payload = buildNode0MinimumSeasonSaveResumePayload(baseState());
  assert.equal(payload.schema, NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA);
  assert.equal(payload.truth_label, NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.boundary.execution_allowed, false);
  assert.equal(payload.boundary.live_execution_performed, false);
  assert.equal(Object.values(node0MinimumSeasonSaveResumeBoundary()).every((v) => v === false), true);
});

test("verify accepts a freshly built payload and rejects a tampered content_hash", () => {
  const payload = buildNode0MinimumSeasonSaveResumePayload(baseState());
  assert.equal(verifyNode0MinimumSeasonSaveResume(payload).ok, true);
  assert.equal(
    verifyNode0MinimumSeasonSaveResume({ ...payload, content_hash: `sha256:${"0".repeat(64)}` }).ok,
    false,
  );
});

test("verify rejects a field change that did not update the content_hash", () => {
  const payload = buildNode0MinimumSeasonSaveResumePayload(baseState());
  assert.equal(verifyNode0MinimumSeasonSaveResume({ ...payload, truth_label: "FORGED" }).ok, false);
});

test("verify still rejects a forgery whose hash WAS recomputed, when it violates the contract", () => {
  // Internal consistency alone cannot catch a fully-recomputed forgery; the
  // contract re-check can, whenever the forged value is not a legal one. For a
  // forgery that is BOTH self-consistent and contract-legal, the independent
  // anchor is the on-disk fence + chain, proven by S9b — not this payload.
  const forged = buildNode0MinimumSeasonSaveResumePayload(
    baseState({ next_safe_action: "not a valid action" }),
  );
  const v = verifyNode0MinimumSeasonSaveResume(forged);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "state_contract_violated");
});

test("verifySeasonState rejects an added alien field even when the covered subset still hashes", () => {
  const built = buildSeasonState(baseState());
  assert.equal(verifySeasonState(built.state).ok, true);
  const withAlien = { ...built.state, injected_authority: "granted" };
  const v = verifySeasonState(withAlien);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "state_fields_unexpected");
  assert.equal(hashSeasonState(withAlien), built.state.state_hash,
    "the covered subset genuinely still hashes — the field-set check is what caught it");
});

test("review gate closes the loop: build -> verify -> tamper-reject", () => {
  const result = runNode0MinimumSeasonSaveResumeCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.schema, NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA);
  assert.equal(result.truth_label, NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL);
});

test("orchestrator boundary stays all-false (no execution authority)", () => {
  const result = runNode0MinimumSeasonSaveResume({
    consent: NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE, input: baseState(),
  });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.boundary.execution_allowed, false);
  assert.equal(result.boundary.live_execution_performed, false);
});
