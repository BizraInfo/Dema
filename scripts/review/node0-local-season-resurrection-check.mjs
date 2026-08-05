#!/usr/bin/env node
// NODE0-RESURRECTION-CORRECTION-1B — gated local season resurrection driver.
//
// Drives the whole proof through the REAL CLI: save sequence 1 with pending
// consent, run `dema mission run health`, verify, save sequence 2, kill the
// process, resume from a scrubbed child, verify the preserved receipt, and only
// then save sequence 3.
//
// THE HARD LAW THIS FILE EXISTS TO ENFORCE
// ----------------------------------------
// The 1A proof promoted sequence 3 (LOCAL_SEASON_RESURRECTION_PROVEN) while its
// own Phase 5 verification was failing. The claims later turned out true, but the
// ordering that would have caught them being false was absent. So here the
// promotion is not a step that follows the gate — it is a step the gate OWNS:
// `promoteIfProven` takes the gate report and refuses to write when any check
// failed. There is no code path that writes sequence 3 without a green report.
//
//   evidence verified -> then authority state promoted.   Never the reverse.
//
// --force-fail=<check> flips one named check to failing, so the negative test can
// prove sequence 3 is absent on failure rather than assuming it.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const JSON_MODE = process.argv.includes("--json");
const FORCE_FAIL = (process.argv.find((a) => a.startsWith("--force-fail=")) ?? "").split("=")[1] ?? "";
const KEEP = process.argv.includes("--keep");

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const CLI = join(REPO, "apps/cli/src/index.js");
const CONSENT = "RUN NODE0 HEALTH SNAPSHOT";
const SEASON = "node0-local-season-resurrection-1b";

/**
 * One check per thing examined, so a green report says WHAT it verified.
 * `passed` requires at least one check: a report that examined nothing is
 * vacuous, not green — an empty result from a broken step must never read as
 * a clean pass.
 */
class GateReport {
  constructor() {
    this.checks = [];
  }
  check(item, ok, note = "") {
    this.checks.push({ item, ok: ok && FORCE_FAIL !== item, note });
    return this;
  }
  get violations() {
    return this.checks.filter((c) => !c.ok).map((c) => `${c.item}: ${c.note || "failed"}`);
  }
  get passed() {
    return this.checks.length > 0 && this.violations.length === 0;
  }
}

function cli(args, home, { allowFail = false } = {}) {
  const result = spawnSync("node", [CLI, ...args], {
    env: { ...process.env, DEMA_HOME: home },
    encoding: "utf8",
  });
  if (!allowFail && result.status !== 0 && !result.stdout) {
    throw new Error(`cli ${args.join(" ")} failed: ${result.stderr?.slice(0, 400)}`);
  }
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const parse = (s) => JSON.parse(s);
const sha256File = (p) => "sha256:" + createHash("sha256").update(readFileSync(p)).digest("hex");
const healthReceipts = (home) => {
  const dir = join(home, "receipts");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("mission-health-")) : [];
};

function saveState(home, state, path) {
  writeFileSync(path, JSON.stringify(state, null, 2));
  return parse(cli(["season", "save", "--from", path, "--dema-home", home, "--json"], home).stdout);
}

function headSequence(home) {
  const r = cli(["season", "status", "--season", SEASON, "--dema-home", home, "--json"], home, {
    allowFail: true,
  });
  try {
    return parse(r.stdout).state_sequence ?? null;
  } catch {
    return null;
  }
}

/**
 * The ONLY writer of sequence 3. Takes the gate report, not a boolean, so the
 * caller cannot promote by passing `true`. Refuses on any failed check and on
 * an empty report.
 */
function promoteIfProven(home, state, path, report) {
  if (!report.passed) {
    return { promoted: false, reason: "gate_not_passed", violations: report.violations };
  }
  const saved = saveState(home, state, path);
  return { promoted: saved.ok === true, reason: saved.ok ? "gate_passed" : saved.reason, saved };
}

export function runResurrectionProof({ root } = {}) {
  const proofRoot = root ?? mkdtempSync(join(tmpdir(), "sssf-resurrection-"));
  const home = join(proofRoot, "dema-home");
  const evidence = join(proofRoot, "evidence");
  for (const d of [home, evidence]) execFileSync("mkdir", ["-p", d]);

  const out = { proof_root: proofRoot, dema_home: home, steps: {}, forced_fail: FORCE_FAIL || null };
  const repoCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  const repoTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: REPO, encoding: "utf8" }).trim();

  const mustNotRepeat = ["reopen C4D", "begin Node1", "begin federation", "activate signer systems"];
  const base = {
    season_id: SEASON,
    mission_id: "NODE0-RESURRECTION-CORRECTION-1B",
    mission_contract_hash: null,
    completed_steps: ["clean runtime checkout established"],
    must_not_repeat: mustNotRepeat,
    last_receipt_hash: null,
    repository_commit: repoCommit,
    repository_tree: repoTree,
  };

  // ── sequence 1: consent PENDING, never granted ─────────────────────────────
  const seq1 = saveState(home, {
    ...base,
    mission_phase: "READY_FOR_LOCAL_HEALTH_MISSION",
    next_safe_action: "RUN_LOCAL_HEALTH_SNAPSHOT",
    pending_consent: [{ phrase: CONSENT, scope: "write one health receipt under the isolated DEMA_HOME" }],
    saved_at: "2026-08-05T03:00:00Z",
  }, join(proofRoot, "seq1.json"));
  out.steps.sequence_1 = { ok: seq1.ok, state_hash: seq1.state_hash, receipt_hash: seq1.receipt_hash };

  // ── the REAL CLI health command ────────────────────────────────────────────
  const run = parse(cli(["mission", "run", "health", "--consent", CONSENT, "--json"], home).stdout);
  const receiptPath = run.path;
  const receiptHash = sha256File(receiptPath);
  out.steps.health_cli = {
    saved: run.saved,
    reason: run.reason,
    path: receiptPath,
    file_sha256: receiptHash,
    receipt_verification: run.receipt_verification,
    health_mission_verdict: run.health_mission_verdict,
    reached_health_branch: !String(run.reason_code ?? "").includes("file_not_found"),
  };

  // ── sequence 2 ─────────────────────────────────────────────────────────────
  const seq2 = saveState(home, {
    ...base,
    mission_phase: "LOCAL_HEALTH_RECEIPT_SAVED_AWAITING_PROCESS_RESTART",
    completed_steps: [...base.completed_steps, "health mission executed through the CLI under exact consent"],
    next_safe_action: "RESUME_AND_VERIFY_LOCAL_HEALTH_MISSION",
    pending_consent: [],
    last_receipt_hash: receiptHash,
    saved_at: "2026-08-05T03:01:00Z",
  }, join(proofRoot, "seq2.json"));
  out.steps.sequence_2 = { ok: seq2.ok, state_hash: seq2.state_hash, receipt_hash: seq2.receipt_hash };

  // ── PROCESS DEATH: resume runs in a scrubbed child, inheriting nothing ──────
  const before = healthReceipts(home).length;
  const child = spawnSync(
    "/usr/bin/env",
    ["-i", `PATH=${process.env.PATH}`, `HOME=${proofRoot}`, `DEMA_HOME=${home}`,
     "node", CLI, "season", "resume", "--season", SEASON,
     "--repo-commit", repoCommit, "--repo-tree", repoTree, "--dema-home", home, "--json"],
    { encoding: "utf8" },
  );
  const resumed = parse(child.stdout);
  const after = healthReceipts(home).length;
  const cont = resumed.continuation ?? {};
  out.steps.resume = {
    child_pid_reaped: child.pid,
    exit_code: child.status,
    executed: resumed.executed,
    mutated: resumed.mutated,
    consent_granted: resumed.consent_granted,
    state_sequence: cont.state_sequence,
    receipts_before: before,
    receipts_after: after,
  };

  // ── THE GATE. Everything below is verified BEFORE anything is promoted. ─────
  const report = new GateReport();
  report.check("health_cli_reached_branch", out.steps.health_cli.reached_health_branch === true,
    "`run health` must not fall through to the generic file branch");
  report.check("health_receipt_saved", run.saved === true && run.reason === "consent_verified", run.reason);
  report.check("receipt_verified", run.receipt_verification?.verdict === "VERIFIED",
    `${run.receipt_verification?.checks_passing}/${run.receipt_verification?.checks_total} checks`);
  report.check("health_verdict_reported", typeof run.health_mission_verdict === "string",
    `measured as ${run.health_mission_verdict}`);
  report.check("resume_exact_mission", cont.mission_id === base.mission_id, cont.mission_id);
  report.check("resume_exact_sequence", cont.state_sequence === 2, `sequence ${cont.state_sequence}`);
  report.check("resume_exact_commit", cont.repository_commit === repoCommit, "repository commit bound");
  report.check("resume_exact_tree", cont.repository_tree === repoTree, "repository tree bound");
  report.check("resume_receipt_hash", cont.last_receipt_hash === receiptHash, "last_receipt_hash matches the file");
  report.check("must_not_repeat_preserved",
    JSON.stringify(cont.must_not_repeat) === JSON.stringify(mustNotRepeat), "byte-exact and in order");
  report.check("resume_executed_nothing", resumed.executed === false, "executed=false");
  report.check("resume_mutated_nothing", resumed.mutated === false, "mutated=false");
  report.check("resume_granted_no_consent", resumed.consent_granted === false, "consent_granted=false");
  report.check("pending_consent_empty", Array.isArray(cont.pending_consent) && cont.pending_consent.length === 0,
    "consent was consumed, not carried");
  report.check("single_health_receipt", before === 1 && after === 1, `${before} before, ${after} after`);
  const matches = healthReceipts(home).filter((f) => sha256File(join(home, "receipts", f)) === cont.last_receipt_hash);
  report.check("receipt_located_by_resumed_hash", matches.length === 1, `${matches.length} file(s) matched`);
  const reverify = parse(cli(["mission", "verify", receiptPath, "--json"], home, { allowFail: true }).stdout);
  report.check("receipt_verified_after_restart", reverify.verdict === "VERIFIED",
    `${reverify.checks_passing}/${reverify.checks_total}`);

  out.gate = { checks: report.checks, violations: report.violations, passed: report.passed };

  // ── promotion is OWNED by the gate ─────────────────────────────────────────
  const promotion = promoteIfProven(home, {
    ...base,
    mission_phase: "LOCAL_SEASON_RESURRECTION_PROVEN",
    completed_steps: [...base.completed_steps,
      "health mission executed through the CLI under exact consent",
      "Process A terminated completely",
      "Process B reconstructed exact continuation from disk",
      "preserved health receipt verified after restart"],
    next_safe_action: "BEGIN_MUST_NOT_REPEAT_POLICY_GATE_1A",
    pending_consent: [],
    last_receipt_hash: receiptHash,
    saved_at: "2026-08-05T03:02:00Z",
  }, join(proofRoot, "seq3.json"), report);

  out.steps.sequence_3 = promotion;
  out.head_sequence = headSequence(home);
  out.ok = report.passed && promotion.promoted === true && out.head_sequence === 3;
  out.blocked_by = report.violations;

  writeFileSync(join(evidence, "resurrection-proof.json"), JSON.stringify(out, null, 2));
  if (!KEEP && !root) rmSync(proofRoot, { recursive: true, force: true });
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runResurrectionProof({ root: (process.argv.find((a) => a.startsWith("--root=")) ?? "").split("=")[1] });
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - NODE0-RESURRECTION-CORRECTION-1B");
    console.log(`  proof root: ${result.proof_root}`);
    for (const c of result.gate.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.item} — ${c.note}`);
    console.log(`  health verdict (as measured): ${result.steps.health_cli.health_mission_verdict}`);
    console.log(`  sequence 3 promoted: ${result.steps.sequence_3.promoted} (${result.steps.sequence_3.reason})`);
    console.log(`  HEAD sequence: ${result.head_sequence}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const v of result.blocked_by) console.log(`    ${v}`);
  }
  if (!result.ok) process.exit(1);
}
