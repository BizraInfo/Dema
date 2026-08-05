// NODE0-BRIDGE-READINESS-PROMOTION-CORRECTION-1C — items 1-12.
//
// Every defect below survived a full green matrix. That is the point: the suite
// was strong against regression from encoded expectations and blind to
// unexercised CLI combinations, a reachable undefined variable, an unvalidated
// loop bound, a "read-only" command that writes, and a receipt that forgot what
// it had already observed. These tests encode the combinations nobody ran.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat, chmod } from "node:fs/promises";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { initAuthorshipKey, KEY_INIT_CONSENT_PHRASE } from "../packages/receipts/src/authorship-key-store.js";
import { saveSeasonState } from "../packages/receipts/src/season-state-store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  assertSafeRunId,
  observedRunBoundary,
  readAnchor,
  readRecords,
  takeSample,
  ENDURANCE_RELDIR,
  ENDURANCE_ANCHOR_FILE,
} from "../apps/cli/src/commands/node0-run.js";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../bin/dema", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));
const ID = "pc1c-probe";
const SEASON = "pc1c-season";

async function freshHome(tag) {
  return await mkdtemp(join(tmpdir(), `pc1c-${tag}-`));
}

// ── real-corridor harness (mirrors tests/node0-closure-sprint-correction.test.js) ──
const newCorridorHome = () => mkdtemp(join(tmpdir(), "pc1c-corr-"));
const future = () => new Date(Date.now() + 3_600_000).toISOString();

function runDema(home, args, { allowFail = false } = {}) {
  try {
    return execFileSync("node", [CLI, ...args, "--dema-home", home, "--json"], {
      cwd: REPO, encoding: "utf8", env: { ...process.env, DEMA_HOME: home },
    });
  } catch (e) {
    if (allowFail) return `${e.stdout ?? ""}${e.stderr ?? ""}`;
    throw new Error(`dema ${args.join(" ")} failed: ${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
}

function consented(home, args, nonce, extra = []) {
  const base = [...args, "--nonce", nonce, "--expires", future()];
  const card = JSON.parse(runDema(home, base));
  assert.equal(card.step, "CONSENT_CARD");
  return JSON.parse(runDema(home, [...base, "--consent", card.required_phrase,
    "--consent-context", card.consent_context_hash, ...extra]));
}

// The Season/FATE gate refuses (`season_state_unusable:EMPTY`) BEFORE the
// consent gate that contains the preflight, so an unseeded season never reaches
// the code under test. Measured: PC-01 passed against the unfixed tree twice
// before this was added.
function executingRepo() {
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim(),
    tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: REPO, encoding: "utf8" }).trim(),
  };
}

async function seedSeason(home) {
  const { commit, tree } = executingRepo();
  const r = await saveSeasonState({
    demaHome: home,
    state: {
      season_id: SEASON, mission_id: ID, mission_phase: "LOCAL_EFFECT_PREPARED",
      completed_steps: [], next_safe_action: "ACTION:CORRIDOR_RENAME_EXECUTE",
      must_not_repeat: [],
      pending_consent: [{ phrase: `GO: complete mission corridor ${ID}`, scope: "corridor" }],
      repository_commit: commit, repository_tree: tree, saved_at: "2026-08-06T02:00:00Z",
    },
  });
  assert.equal(r.ok, true, `season fixture failed: ${r.reason ?? ""}`);
}

async function corridorAtCheckpoint(home) {
  await initAuthorshipKey({ consent: KEY_INIT_CONSENT_PHRASE, demaHome: home });
  const expires = future();
  const args = [
    "mission", "corridor", "start", "--id", ID,
    "--objective", "PC1C probe: reach the Season consent preflight on the real route",
    "--base-sha", "0".repeat(40), "--nonce", "pc1c-start", "--expires", expires,
  ];
  const card = JSON.parse(runDema(home, args));
  const started = JSON.parse(runDema(home, [
    ...args, "--created-at", card.created_at_iso,
    "--consent", card.required_phrase, "--consent-context", card.consent_context_hash,
  ]));
  assert.equal(started.ok, true, "corridor must start");
  let n = 0;
  for (const to of ["PREFLIGHT", "PLANNING", "IMPLEMENTING", "VERIFYING", "SAT_REVIEW", "CHECKPOINT"]) {
    const r = consented(home, ["mission", "corridor", "advance", ID, "--to", to], `pc1c-adv-${++n}`);
    assert.equal(r.state, to, `advance to ${to} must land`);
  }
  const estate = join(home, "missions", ID, "estate");
  await mkdir(estate, { recursive: true, mode: 0o700 });
  await writeFile(join(estate, "closure-evidence.draft.json"), JSON.stringify({ claim: "pc1c" }) + "\n", { mode: 0o600 });
  return estate;
}

// Runs the real CLI. `allowFail` because several of these MUST exit non-zero.
async function dema(args, { allowFail = true } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...args], {
      timeout: 60000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (e) {
    if (!allowFail) throw e;
    return { code: e.code ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("PROMOTION-CORRECTION-1C", () => {
  // ── item 1 + 2: the combination that raised ReferenceError ──────────────
  //
  // The preflight is reached only from corridorConsentGate, which refuses
  // before it without --nonce/--expires, and that gate is reached only from a
  // REAL corridor at CHECKPOINT. A test that skips this setup dies at "no
  // corridor found" and passes while proving nothing — measured: an earlier
  // draft of PC-01 passed against the unfixed tree for exactly that reason.
  it("PC-01 --season-preflight with --effect-root refuses structurally, never ReferenceError", async () => {
    const home = await newCorridorHome();
    const estate = await corridorAtCheckpoint(home);
    await seedSeason(home);
    const out = runDema(home, [
      "mission", "corridor", "complete", ID,
      "--season-preflight", "--season", SEASON,
      "--nonce", "pc1c-preflight", "--expires", future(),
      "--effect-root", estate,
    ], { allowFail: true });

    assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 300)}`);
    // The defect: `state.pending_effect` was read while `state` was unbound in
    // this function, so the operator got a stack trace instead of a refusal.
    assert.doesNotMatch(out, /ReferenceError/, `must not crash:\n${out.slice(0, 700)}`);
    assert.doesNotMatch(out, /state is not defined/);
  });

  it("PC-02 the preflight never claims a FATE policy decision it did not make", async () => {
    const home = await newCorridorHome();
    const estate = await corridorAtCheckpoint(home);
    await seedSeason(home);
    const out = runDema(home, [
      "mission", "corridor", "complete", ID,
      "--season-preflight", "--season", SEASON,
      "--nonce", "pc1c-fate", "--expires", future(),
      "--effect-root", estate,
    ], { allowFail: true });

    assert.equal(/no corridor found/.test(out), false, `never reached the gate: ${out.slice(0, 300)}`);
    // It used to print `fate: <verdict>` AND "no independent FATE policy
    // decision is claimed" in the same output. Both cannot be true.
    if (/no independent FATE policy decision/.test(out)) {
      assert.doesNotMatch(
        out, /^\s*fate:/m,
        `output claims a FATE verdict and disclaims one simultaneously:\n${out.slice(0, 700)}`,
      );
    }
  });

  // ── item 4: unvalidated duration ────────────────────────────────────────
  it("PC-03 a non-numeric --duration-ms is refused before anything is written", async () => {
    const home = await freshHome("dur");
    const r = await dema([
      "node0", "run", "--dema-home", home,
      "--run-id", "durcheck", "--duration-ms", "abc", "--interval-ms", "10",
    ]);
    assert.notEqual(r.code, 0, "NaN duration must fail closed");
    assert.match(r.out, /duration-ms/);
    // "Nothing was written" must be literally true.
    await assert.rejects(
      () => stat(join(home, ENDURANCE_RELDIR, "durcheck")),
      /ENOENT/,
      "a refused run must not leave a directory behind",
    );
  });

  // ── item 5: run id confinement ──────────────────────────────────────────
  it("PC-04 a traversing run id is refused by the kernel and the CLI", () => {
    for (const bad of ["../escape", "a/b", "..", ".", "", "x y", "with space"]) {
      assert.throws(() => assertSafeRunId(bad), /unsafe_run_id/, `must refuse ${JSON.stringify(bad)}`);
    }
    for (const good of ["run-1", "soak-24h", "a.b_c-9"]) {
      assert.equal(assertSafeRunId(good), good);
    }
  });

  it("PC-05 the CLI refuses a traversing run id without writing outside the subtree", async () => {
    const home = await freshHome("trav");
    const r = await dema([
      "node0", "run", "--dema-home", home,
      "--run-id", "../../escaped", "--duration-ms", "1", "--interval-ms", "1",
    ]);
    assert.notEqual(r.code, 0);
    await assert.rejects(() => stat(join(home, "escaped")), /ENOENT/);
  });

  // ── item 6: --judge must write nothing ──────────────────────────────────
  it("PC-06 --judge on a nonexistent run creates no directory", async () => {
    const home = await freshHome("judge");
    const r = await dema([
      "node0", "run", "--dema-home", home, "--run-id", "ghost", "--judge", "--json",
    ]);
    assert.notEqual(r.code, 0, "judging an absent run is not a pass");
    await assert.rejects(
      () => stat(join(home, ENDURANCE_RELDIR, "ghost")),
      /ENOENT/,
      "a read-only judgment must not create the run directory",
    );
  });

  // ── item 7: unreadable != absent ────────────────────────────────────────
  it("PC-07 an unreadable record is an integrity refusal, not an absent run", async () => {
    const home = await freshHome("eacces");
    const dir = join(home, ENDURANCE_RELDIR, "locked");
    await mkdir(dir, { recursive: true });
    const p = join(dir, "samples.jsonl");
    await writeFile(p, "{}\n");
    await chmod(p, 0o000);
    try {
      await assert.rejects(
        () => readRecords({ demaHome: home, runId: "locked" }),
        /endurance_record_unreadable/,
        "EACCES must not read as 'the run never existed'",
      );
    } finally {
      await chmod(p, 0o600);
    }
    // Control: a genuinely absent run is still absence.
    assert.deepEqual(await readRecords({ demaHome: home, runId: "never-ran" }), []);
  });

  // ── items 8 + 9: malformed anchors are named ────────────────────────────
  it("PC-08 a malformed anchor is reported as malformed, never as unwitnessed", async () => {
    const home = await freshHome("anchor");
    const mk = async (runId, body) => {
      const dir = join(home, ENDURANCE_RELDIR, runId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, ENDURANCE_ANCHOR_FILE), body);
      return runId;
    };
    const torn = await readAnchor({ demaHome: home, runId: await mk("torn", "{ not json") });
    assert.equal(torn.malformed, true);
    assert.match(torn.reason, /anchor_json_invalid/);

    const neg = await readAnchor({ demaHome: home, runId: await mk("neg", JSON.stringify({ head_seq: -1 })) });
    assert.equal(neg.malformed, true, "a negative head_seq can only under-count the chain");
    assert.match(neg.reason, /head_seq_invalid/);

    const frac = await readAnchor({ demaHome: home, runId: await mk("frac", JSON.stringify({ head_seq: 1.5 })) });
    assert.equal(frac.malformed, true);

    // Control: absent stays absent, and a valid anchor stays valid.
    assert.equal(await readAnchor({ demaHome: home, runId: "nothing-here" }), null);
    const ok = await readAnchor({ demaHome: home, runId: await mk("ok", JSON.stringify({ head_seq: 0 })) });
    assert.equal(ok.malformed, undefined);
    assert.equal(ok.head_seq, 0);
  });

  // ── items 11 + 12: the receipt may not forget what it observed ──────────
  it("PC-09 a sample carries the runtime boundary the snapshot disclosed", async () => {
    const s = await takeSample({
      at: Date.now(),
      demaHome: "/tmp/whatever",
      snapshotFn: async () => ({
        attests: {
          mission_verdict: "ATTENTION",
          results: { memory: { home: "/tmp/whatever" } },
          boundary: { tool_executed: true, child_process_invoked: true, network_used: false },
        },
        content_hash: "abc",
      }),
    });
    assert.equal(s.boundary.tool_executed, true);
    assert.equal(s.boundary.child_process_invoked, true);
    assert.equal(s.boundary.network_used, false);
  });

  it("PC-10 the run boundary is the UNION of observations, and silence cannot lower it", () => {
    const u = observedRunBoundary([
      { boundary: { tool_executed: false, child_process_invoked: false } },
      { boundary: { tool_executed: true, child_process_invoked: true } },
      { boundary: { tool_executed: false, child_process_invoked: false } },
    ]);
    assert.equal(u.tool_executed, true, "one observation that executed a tool makes the run one that did");
    assert.equal(u.child_process_invoked, true);
    assert.equal(u.samples_disclosing_boundary, 3);
    assert.equal(u.boundary_derived_from_samples, true);

    // A legacy sample with no boundary must not be read as a denial.
    const withSilent = observedRunBoundary([
      { boundary: { tool_executed: true } },
      { at_ms: 1, ok: true },
      null,
    ]);
    assert.equal(withSilent.tool_executed, true);
    assert.equal(withSilent.samples_disclosing_boundary, 1);

    // Empty is honestly empty, not falsely clean.
    const none = observedRunBoundary([]);
    assert.equal(none.samples_disclosing_boundary, 0);
    assert.equal(none.tool_executed, false);
  });

  it("PC-11 a sealed receipt discloses observed activity instead of a constant", async () => {
    const home = await freshHome("receipt");
    const r = await dema([
      "node0", "run", "--dema-home", home, "--run-id", "disclose",
      "--duration-ms", "1", "--interval-ms", "1",
    ]);
    assert.equal(r.code === 0 || r.code === 1, true, "the run completes or judges INSUFFICIENT");
    const receipt = JSON.parse(
      await readFile(join(home, ENDURANCE_RELDIR, "disclose", "endurance-receipt.json"), "utf8"),
    );
    assert.equal(receipt.boundary.boundary_derived_from_samples, true);
    assert.ok(receipt.boundary.samples_disclosing_boundary >= 1, "at least one sample disclosed");
    // Facts this command structurally cannot perform stay false.
    for (const k of ["daemon", "model_invoked", "effect_executed", "nonce_claimed", "transaction_prepared"]) {
      assert.equal(receipt.boundary[k], false, `${k} must remain false`);
    }
  });
});
