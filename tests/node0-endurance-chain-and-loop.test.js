// NODE0-ENDURANCE-CHAIN-1A + NODE0-REVERSIBLE-EFFECT-LOOP-1A
//
// Two proofs the closure program was still missing.
//
// EC-*   the endurance record is tamper-EVIDENT. Measured before this slice:
//        deleting the last 10 of 26 samples left the verdict at `HEALTHY ok:true`
//        still reporting "continuously observed", with no integrity field
//        anywhere in the result.
//
// LOOP-* the reversible effect loop survives a real SIGKILL, resumes to COMPLETE,
//        and then REFUSES to happen a second time.
//
// The honest boundary is asserted, not assumed: LOOP-03 proves the no-repeat
// refusal is NOT attributable to Season `must_not_repeat`, which is preserved
// but not enforced at an effect boundary.

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  chainEnduranceRecord,
  buildEnduranceAnchor,
  verifyEnduranceChain,
  enduranceRecordHash,
  ENDURANCE_HEADER_KIND,
  ENDURANCE_SAMPLE_KIND,
  ENDURANCE_EVIDENCE_CLASSES,
} from "../packages/core/src/node0-endurance-chain.js";
import { judgeRun, measureRunnerCodeHash, ENDURANCE_RELDIR, ENDURANCE_ANCHOR_FILE }
  from "../apps/cli/src/commands/node0-run.js";
import { saveSeasonState, loadSeasonHead } from "../packages/receipts/src/season-state-store.js";
import { initAuthorshipKey, KEY_INIT_CONSENT_PHRASE } from "../packages/receipts/src/authorship-key-store.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMA = join(REPO, "bin/dema");
const HOUR = 3_600_000;
const T0 = 1_700_000_000_000;

// ───────────────────────────── EC: record integrity ─────────────────────────────

const CODE_HASH = "sha256:" + "c".repeat(64);

function buildRecord({ runId = "ec-run", count = 26, evidenceClass = "ELAPSED", ok = true } = {}) {
  let prev = chainEnduranceRecord({
    record: {
      kind: ENDURANCE_HEADER_KIND, run_id: runId,
      runner_code_hash: CODE_HASH, evidence_class: evidenceClass,
    },
  });
  const records = [prev];
  for (let i = 0; i < count; i += 1) {
    prev = chainEnduranceRecord({
      record: { kind: ENDURANCE_SAMPLE_KIND, run_id: runId, at_ms: T0 + i * HOUR, ok },
      prev,
    });
    records.push(prev);
  }
  return records;
}

async function layDownRun(records, { runId = "ec-run", anchor = "true-head" } = {}) {
  const home = await mkdtemp(join(tmpdir(), "ec-"));
  const dir = join(home, ENDURANCE_RELDIR, runId);
  await mkdir(dir, { recursive: true });
  return { home, dir, write: async (recs, anchorHead) => {
    await writeFile(join(dir, "samples.jsonl"), recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
    if (anchorHead !== null) {
      await writeFile(join(dir, ENDURANCE_ANCHOR_FILE),
        JSON.stringify(buildEnduranceAnchor({ head: anchorHead ?? recs.at(-1), runId })));
    }
  } };
}

describe("EC · the endurance record is tamper-evident", () => {

  test("EC-01 truncating the record can never read HEALTHY (control: intact reads HEALTHY)", async () => {
    const records = buildRecord({ count: 26 });
    const { home, write } = await layDownRun(records);

    // CONTROL. Without this the test would also pass against an implementation
    // that simply refuses everything.
    await write(records, records.at(-1));
    const intact = await judgeRun({ demaHome: home, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(intact.verdict, "HEALTHY", `control must be healthy: ${intact.reason}`);
    assert.equal(intact.ok, true);
    assert.equal(intact.chain.chain_state, "SEALED");
    assert.equal(intact.chain.tamper_evident, true);

    // Remove the last 10 records. The anchor still names the true head.
    await write(records.slice(0, -10), records.at(-1));
    const cut = await judgeRun({ demaHome: home, runId: "ec-run", targetMs: 15 * HOUR, intervalMs: HOUR });
    assert.equal(cut.verdict, "BROKEN", "a truncated record must not be judged healthy");
    assert.equal(cut.ok, false);
    assert.equal(cut.chain.chain_state, "TRUNCATED");
    assert.match(cut.reason, /records_truncated/);
  });

  test("EC-02 a chain cannot witness itself: an anchor re-derived from the survivors passes", async () => {
    const records = buildRecord({ count: 26 });
    const truncated = records.slice(0, -10);

    // THE POINT. The surviving records are a perfectly valid chain — a prefix of
    // a valid chain always is. Anchoring them to their OWN last record reports
    // SEALED, cheerfully, having detected nothing. This is why the anchor must be
    // an independent artefact and why re-deriving it is not verification.
    const selfAnchored = verifyEnduranceChain({
      records: truncated,
      anchor: buildEnduranceAnchor({ head: truncated.at(-1), runId: "ec-run" }),
      runId: "ec-run",
    });
    assert.equal(selfAnchored.ok, true, "a truncated prefix IS a valid chain — that is the hazard");
    assert.equal(selfAnchored.chain_state, "SEALED");

    // Against the real anchor the same bytes are caught.
    const witnessed = verifyEnduranceChain({
      records: truncated,
      anchor: buildEnduranceAnchor({ head: records.at(-1), runId: "ec-run" }),
      runId: "ec-run",
    });
    assert.equal(witnessed.ok, false);
    assert.equal(witnessed.chain_state, "TRUNCATED");

    // And with no anchor at all the module refuses rather than vouching.
    const unwitnessed = verifyEnduranceChain({ records: truncated, anchor: null, runId: "ec-run" });
    assert.equal(unwitnessed.ok, false);
    assert.match(unwitnessed.reason, /anchor_missing/);
  });

  test("EC-03 editing any record is caught by re-derivation, not by a stored hash", async () => {
    const records = buildRecord({ count: 6 });
    const tampered = records.map((r, i) => (i === 3 ? { ...r, ok: true, at_ms: r.at_ms + 1 } : r));
    const v = verifyEnduranceChain({
      records: tampered, anchor: buildEnduranceAnchor({ head: records.at(-1), runId: "ec-run" }), runId: "ec-run",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason, /record_hash_mismatch_at_seq_3/);

    // A forger who also rewrites the stored hash still breaks the NEXT link,
    // because prev_hash is re-derived too.
    const resealed = tampered.map((r, i) => (i === 3 ? { ...r, hash: enduranceRecordHash(r) } : r));
    const v2 = verifyEnduranceChain({
      records: resealed, anchor: buildEnduranceAnchor({ head: records.at(-1), runId: "ec-run" }), runId: "ec-run",
    });
    assert.equal(v2.ok, false);
    assert.match(v2.reason, /prev_hash_mismatch_at_seq_4/);
  });

  test("EC-04 run-id traversal law: a foreign record is a REFUSAL, never a filter", async () => {
    const mine = buildRecord({ runId: "ec-run", count: 4 });
    const other = buildRecord({ runId: "other-run", count: 4 });
    // Splicing another run's sample in must not be silently dropped: dropping it
    // shrinks the evidence while leaving the observed span intact, which is how
    // two short runs get presented as one long one.
    const spliced = [...mine, { ...other[2], seq: mine.length, prev_hash: mine.at(-1).hash }];
    const v = verifyEnduranceChain({
      records: spliced, anchor: buildEnduranceAnchor({ head: spliced.at(-1), runId: "ec-run" }), runId: "ec-run",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason, /foreign_run_id_at_seq_5/);

    // Asking for a run the record is not from is also a refusal.
    const wrongAsk = verifyEnduranceChain({
      records: mine, anchor: buildEnduranceAnchor({ head: mine.at(-1), runId: "ec-run" }), runId: "ec-run-2",
    });
    assert.equal(wrongAsk.ok, false);
    assert.match(wrongAsk.reason, /run_id_mismatch/);
  });

  test("EC-05 a crash between append and anchor is TORN_TAIL, not tampering", async () => {
    const records = buildRecord({ count: 8 });
    // Lag of exactly one: the sample was fsynced, the anchor rewrite was not.
    const torn = verifyEnduranceChain({
      records, anchor: buildEnduranceAnchor({ head: records.at(-2), runId: "ec-run" }), runId: "ec-run",
    });
    assert.equal(torn.ok, true, "a real crash must not be reported as tampering");
    assert.equal(torn.chain_state, "TORN_TAIL");

    // Lag of two cannot come from that window — one append is fsynced before the
    // anchor is touched, so the anchor can never fall two behind honestly.
    const suspicious = verifyEnduranceChain({
      records, anchor: buildEnduranceAnchor({ head: records.at(-3), runId: "ec-run" }), runId: "ec-run",
    });
    assert.equal(suspicious.ok, false);
    assert.match(suspicious.reason, /anchor_lags_records_by_2_appends/);
  });

  test("EC-06 a CUSTOM_TEST record can be HEALTHY but never meets an endurance target", async () => {
    const records = buildRecord({ count: 26, evidenceClass: ENDURANCE_EVIDENCE_CLASSES.CUSTOM_TEST });
    const { home, write } = await layDownRun(records);
    await write(records, records.at(-1));
    const v = await judgeRun({ demaHome: home, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });

    assert.equal(v.verdict, "HEALTHY", "synthesised samples still prove the JUDGMENT works");
    assert.equal(v.chain.chain_state, "SEALED");
    assert.equal(v.chain.elapsed_evidence, false);
    // The load-bearing line: a synthesised record can never be cited as a node
    // having endured anything.
    assert.equal(v.target_met_by_elapsed_run, false);

    const elapsed = buildRecord({ count: 26, evidenceClass: ENDURANCE_EVIDENCE_CLASSES.ELAPSED });
    const l = await layDownRun(elapsed);
    await l.write(elapsed, elapsed.at(-1));
    const e = await judgeRun({ demaHome: l.home, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(e.target_met_by_elapsed_run, true, "control: an ELAPSED record can meet a target");
  });

  test("EC-07 an unwitnessed legacy record is not vouched for and not accused", async () => {
    const home = await mkdtemp(join(tmpdir(), "ec-legacy-"));
    const dir = join(home, ENDURANCE_RELDIR, "old"); await mkdir(dir, { recursive: true });
    const lines = [];
    for (let i = 0; i <= 25; i += 1) lines.push(JSON.stringify({ at_ms: T0 + i * HOUR, ok: true }));
    await writeFile(join(dir, "samples.jsonl"), lines.join("\n") + "\n");

    const v = await judgeRun({ demaHome: home, runId: "old", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(v.chain.chain_state, "ABSENT");
    assert.equal(v.chain.tamper_evident, false, "an unchained record may never be called tamper-evident");
    assert.equal(v.verdict, "HEALTHY", "nor may it be accused of tampering it shows no sign of");
    assert.equal(v.target_met_by_elapsed_run, false, "but it cannot support a target claim either");
  });

  test("EC-10 total erasure is named as erasure, not reported as a run that never happened", async () => {
    const records = buildRecord({ count: 26 });
    const { home, dir } = await layDownRun(records);
    await writeFile(join(dir, ENDURANCE_ANCHOR_FILE),
      JSON.stringify(buildEnduranceAnchor({ head: records.at(-1), runId: "ec-run" })));
    // Every record deleted. The anchor survives, still naming head_seq 26.
    await writeFile(join(dir, "samples.jsonl"), "");

    const wiped = await judgeRun({ demaHome: home, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(wiped.chain.chain_state, "TRUNCATED",
      "a wiped run must not be reported as ABSENT — that is the conflation this module exists to prevent");
    assert.match(wiped.chain.reason, /records_erased/);
    assert.equal(wiped.verdict, "BROKEN");
    assert.equal(wiped.ok, false);

    // CONTROL: a run that genuinely never happened has no anchor either, and is
    // ABSENT — absence must stay distinguishable from erasure in BOTH directions.
    const neverRan = await mkdtemp(join(tmpdir(), "ec-never-"));
    await mkdir(join(neverRan, ENDURANCE_RELDIR, "ec-run"), { recursive: true });
    const none = await judgeRun({ demaHome: neverRan, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(none.chain.chain_state, "ABSENT");
    assert.equal(none.chain.reason, "no_records");

    // And swapping chained records for unchained ones, with the anchor still
    // present, is a replacement — not a legacy record.
    await writeFile(join(dir, "samples.jsonl"), JSON.stringify({ at_ms: T0, ok: true }) + "\n");
    const swapped = await judgeRun({ demaHome: home, runId: "ec-run", targetMs: 24 * HOUR, intervalMs: HOUR });
    assert.equal(swapped.chain.chain_state, "BROKEN");
    assert.match(swapped.chain.reason, /anchor_present_but_records_are_unchained/);
  });

  test("EC-08 the runner binds the record to the BYTES it executed", async () => {
    const measured = await measureRunnerCodeHash();
    assert.match(measured, /^sha256:[0-9a-f]{64}$/);
    // Deterministic: the same bytes hash the same way twice.
    assert.equal(await measureRunnerCodeHash(), measured);

    // A header missing the binding is refused — the record would say what
    // happened but not what was running when it happened.
    const unbound = chainEnduranceRecord({
      record: { kind: ENDURANCE_HEADER_KIND, run_id: "x", evidence_class: "ELAPSED" },
    });
    const v = verifyEnduranceChain({
      records: [unbound], anchor: buildEnduranceAnchor({ head: unbound, runId: "x" }), runId: "x",
    });
    assert.equal(v.ok, false);
    assert.equal(v.reason, "header_runner_binding_missing");
  });

  test("EC-09 the CLI runner writes a SEALED ELAPSED record and refuses to extend a broken one", async () => {
    const home = await mkdtemp(join(tmpdir(), "ec-cli-"));
    const runOnce = (extra = []) => spawnSync("node", [
      DEMA, "node0", "run", "--run-id", "cli", "--dema-home", home,
      "--interval-ms", "5", "--duration-ms", "1", "--json", ...extra,
    ], { cwd: REPO, encoding: "utf8", timeout: 60_000, env: { ...process.env, DEMA_HOME: home } });

    const first = runOnce();
    // `node0 run --json` prints a human banner BEFORE the receipt, so stdout is
    // not pure JSON. Recorded as an observed wart of the shipped CLI; this test
    // reads around it rather than changing shipped behaviour to suit itself.
    const jsonOf = (s) => JSON.parse(s.slice(s.indexOf("{")));
    const receipt = jsonOf(first.stdout);
    assert.equal(receipt.chain_state, "SEALED", `expected SEALED, got ${first.stdout}${first.stderr}`);
    assert.equal(receipt.tamper_evident, true);
    assert.equal(receipt.evidence_class, "ELAPSED");
    assert.equal(receipt.runner_code_hash, await measureRunnerCodeHash(),
      "the record must bind to the bytes this test can independently measure");

    // Corrupt the record, then prove the runner will not append a clean tail on
    // top of damage — that would launder it into an otherwise-valid chain.
    const path = join(home, ENDURANCE_RELDIR, "cli", "samples.jsonl");
    const recs = (await readFile(path, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(recs.length >= 2, "control: the run must have produced a header and a sample");
    await writeFile(path, recs.slice(0, -1).map((r) => JSON.stringify(r)).join("\n") + "\n");

    const second = runOnce();
    assert.notEqual(second.status, 0, "extending a truncated record must fail");
    assert.match(`${second.stdout}${second.stderr}`, /refusing to extend run 'cli'/);
    const after = (await readFile(path, "utf8")).trim().split("\n");
    assert.equal(after.length, recs.length - 1, "a refused run must append nothing");
  });
});

// ─────────────────── LOOP: the reversible effect, end to end ───────────────────

const ID = "loop-probe";
const SEASON = "loop-season";
const future = () => new Date(Date.now() + 3_600_000).toISOString();
const git = (a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" }).trim();

function run(home, args, { allowFail = false } = {}) {
  const seasoned = args.includes("complete") && !args.includes("--season")
    ? [...args, "--season", SEASON] : args;
  try {
    return execFileSync("node", [DEMA, ...seasoned, "--dema-home", home, "--json"],
      { cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home } });
  } catch (e) {
    if (!allowFail) throw new Error(`${e.stdout ?? ""}${e.stderr ?? ""}`);
    return `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
}

function consented(home, args, nonce) {
  const base = [...args, "--nonce", nonce, "--expires", future()];
  const card = JSON.parse(run(home, base));
  return JSON.parse(run(home, [...base, "--consent", card.required_phrase,
    "--consent-context", card.consent_context_hash]));
}

/** A corridor at CHECKPOINT with a seeded estate, under a Season bound to THIS checkout. */
async function corridorReadyToComplete(mustNotRepeat = []) {
  const home = await mkdtemp(join(tmpdir(), "loop-"));
  await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON, mission_id: ID, mission_phase: "LOCAL_EFFECT_PREPARED",
      completed_steps: [], next_safe_action: "ACTION:CORRIDOR_RENAME_EXECUTE",
      must_not_repeat: mustNotRepeat,
      pending_consent: [{ phrase: `GO: complete mission corridor ${ID}`, scope: "corridor" }],
      repository_commit: git(["rev-parse", "HEAD"]),
      repository_tree: git(["rev-parse", "HEAD^{tree}"]),
      saved_at: "2026-08-05T09:00:00Z",
    },
  });
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });

  const startArgs = ["mission", "corridor", "start", "--id", ID,
    "--objective", "LOOP: drive one corridor to a verified COMPLETE",
    "--base-sha", "0".repeat(40), "--nonce", "loop-start", "--expires", future()];
  const card = JSON.parse(run(home, startArgs));
  run(home, [...startArgs, "--created-at", card.created_at_iso,
    "--consent", card.required_phrase, "--consent-context", card.consent_context_hash]);
  let n = 0;
  for (const to of ["PREFLIGHT", "PLANNING", "IMPLEMENTING", "VERIFYING", "SAT_REVIEW", "CHECKPOINT"]) {
    assert.equal(consented(home, ["mission", "corridor", "advance", ID, "--to", to], `loop-adv-${++n}`).state, to);
  }
  const estate = join(home, "missions", ID, "estate");
  await mkdir(estate, { recursive: true, mode: 0o700 });
  await writeFile(join(estate, "closure-evidence.draft.json"), JSON.stringify({ claim: "loop" }) + "\n", { mode: 0o600 });
  return { home, estate };
}

const countComplete = async (home) =>
  (await readFile(join(home, "missions", ID, "journal.jsonl"), "utf8"))
    .trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.state === "COMPLETE").length;

describe("LOOP · the reversible effect survives a kill and refuses to repeat", () => {

  test("LOOP-01 A is SIGKILLed mid-effect, B resumes to COMPLETE, C cannot repeat it", async () => {
    const { home, estate } = await corridorReadyToComplete();
    const draft = join(estate, "closure-evidence.draft.json");
    const sealed = join(estate, "closure-evidence.sealed.json");

    const base = ["mission", "corridor", "complete", ID, "--nonce", "loop-c1", "--expires", future()];
    const card = JSON.parse(run(home, base));
    const authorised = [...base, "--consent", card.required_phrase,
      "--consent-context", card.consent_context_hash];

    // ── A: die after the target is published, before the source is unlinked ──
    const killed = spawnSync(process.execPath, [
      "--import", new URL("./fixtures/kill-after-first-rename-preload.mjs", import.meta.url).pathname,
      DEMA, ...authorised, "--season", SEASON, "--dema-home", home, "--json",
    ], {
      cwd: REPO, encoding: "utf8", timeout: 30_000,
      env: { ...process.env, DEMA_HOME: home, BIZRA_TEST_KILL_UNLINK_PATH: draft },
    });
    assert.equal(killed.signal, "SIGKILL", `A did not die at the boundary: ${killed.stderr}`);
    assert.equal(existsSync(draft), true, "A died mid-effect: both sides exist");
    assert.equal(existsSync(sealed), true);
    assert.equal(await countComplete(home), 0, "a killed process completes nothing");

    // ── B: resume with the EXACT original consent and nonce ──
    const recovered = JSON.parse(run(home, authorised));
    assert.equal(recovered.ok, true);
    assert.equal(recovered.state, "COMPLETE");
    assert.equal(existsSync(draft), false, "the effect settled exactly once");
    assert.equal(existsSync(sealed), true);
    assert.equal(await countComplete(home), 1);

    // ── C: a THIRD process, fresh nonce, with the operand PUT BACK ──
    // Re-creating the draft matters: without it the route would refuse merely
    // because the source file is gone, which proves nothing about repetition.
    await writeFile(draft, JSON.stringify({ claim: "loop-again" }) + "\n", { mode: 0o600 });
    const repeat = run(home, ["mission", "corridor", "complete", ID,
      "--nonce", "loop-repeat", "--expires", future()], { allowFail: true });

    assert.match(repeat, /already COMPLETE/, `C must be refused, got: ${repeat.slice(0, 300)}`);
    // Refused at the consent-card stage: no card was even issued, so no nonce
    // could be claimed and no lock taken.
    assert.equal(repeat.includes("CONSENT_CARD"), false, "C must not even receive a consent card");
    assert.equal(await countComplete(home), 1, "exactly one COMPLETE may ever exist");
    assert.equal(existsSync(sealed), true, "the settled world is untouched");
    assert.equal(JSON.parse(await readFile(draft, "utf8")).claim, "loop-again",
      "the re-created operand was left exactly as the test wrote it — no second rename");
  });

  test("LOOP-02 the no-repeat refusal is NOT attributable to Season must_not_repeat", async () => {
    // must_not_repeat is EMPTY here. If the repeat is still refused, the refusal
    // cannot be credited to must_not_repeat — it comes from corridor terminal
    // state. Asserting this stops the claim being upgraded to
    // "must_not_repeat is enforced at an effect boundary", which it is not.
    const { home, estate } = await corridorReadyToComplete([]);
    const head = await loadSeasonHead({ demaHome: home, seasonId: SEASON });
    assert.equal(head.ok, true);
    assert.deepEqual(head.state.must_not_repeat, [], "control: the policy list is empty");

    assert.equal(consented(home, ["mission", "corridor", "complete", ID], "loop-once").state, "COMPLETE");

    await writeFile(join(estate, "closure-evidence.draft.json"), JSON.stringify({ claim: "again" }) + "\n", { mode: 0o600 });
    const repeat = run(home, ["mission", "corridor", "complete", ID,
      "--nonce", "loop-twice", "--expires", future()], { allowFail: true });
    assert.match(repeat, /already COMPLETE/);
    assert.equal(await countComplete(home), 1);
  });

  test("LOOP-03 the Season gate still refuses the effect route when its binding is wrong", async () => {
    const { home } = await corridorReadyToComplete();
    // Repoint the Season at a commit this checkout is not running. The binding is
    // measured from git, so the state cannot vouch for itself.
    await saveSeasonState({
      demaHome: home,
      state: {
        season_id: SEASON, mission_id: ID, mission_phase: "LOCAL_EFFECT_PREPARED",
        completed_steps: [], next_safe_action: "ACTION:CORRIDOR_RENAME_EXECUTE",
        must_not_repeat: [],
        pending_consent: [{ phrase: `GO: complete mission corridor ${ID}`, scope: "corridor" }],
        repository_commit: "0".repeat(40), repository_tree: git(["rev-parse", "HEAD^{tree}"]),
        saved_at: "2026-08-05T10:00:00Z",
      },
    });
    const out = run(home, ["mission", "corridor", "complete", ID,
      "--nonce", "loop-badbind", "--expires", future()], { allowFail: true });
    assert.match(out, /repository_commit_mismatch/);
    assert.match(out, /nothing was written/);
    assert.equal(await countComplete(home), 0);
  });
});
