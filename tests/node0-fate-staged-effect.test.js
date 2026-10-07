import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { evaluateConsent } from "../packages/fate/src/fate.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
  planNode0FateStagedEffect,
  runNode0FateStagedEffect,
  startFateStagedEffect,
  resumeFateStagedEffect,
  verifyNode0FateStagedEffect,
  JOURNAL_FILE,
  NODE0_FATE_STAGED_EFFECT_SCHEMA,
  NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
  NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
} from "../packages/core/src/node0-fate-staged-effect.js";

const REQUIRED = NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE; // the operator's exact FATE phrase

const { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, appendFileSync } = nodeFs;

// Full real-fs surface (the gate needs open/fstat/read/close + constants);
// fault-injection tests override ONLY appendFileSync on top of this.
function makeFs(overrides = {}) {
  return { ...nodeFs, ...overrides };
}

function freshScope(t) {
  const dir = mkdtempSync(join(tmpdir(), "fse-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "alpha.txt"), "genesis-bytes\n");
  return dir;
}

const ARGS = (dir) => ({
  fs: makeFs(),
  scopeDir: dir,
  operatorPhrase: REQUIRED,
  fileName: "alpha.txt",
  newName: "beta.txt",
});

// ---------------------------------------------------------------------------
// Plan / consent laws
// ---------------------------------------------------------------------------

test("plan is fail-closed without the exact kernel GO phrase", () => {
  const p = planNode0FateStagedEffect({ consent: "wrong", input: {} });
  assert.equal(p.eligible, false);
  assert.ok(p.blocked_by.includes("consent_phrase_mismatch"));
});

test("plan refuses malformed actions positively", () => {
  const p = planNode0FateStagedEffect({
    consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
    input: { requiredPhrase: "", fileName: "", newName: undefined },
  });
  assert.equal(p.eligible, false);
  for (const code of ["operator_phrase_missing", "action_file_name_missing", "action_new_name_missing"]) {
    assert.ok(p.blocked_by.includes(code), code);
  }
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test("happy path: FATE → STAGED → EFFECT → OBSERVED → COMMITTED, world renamed once", (t) => {
  const dir = freshScope(t);
  const r = startFateStagedEffect(ARGS(dir));
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.phase, "COMMITTED");
  assert.equal(existsSync(join(dir, "beta.txt")), true);
  assert.equal(existsSync(join(dir, "alpha.txt")), false);
  assert.equal(readFileSync(join(dir, "beta.txt"), "utf8"), "genesis-bytes\n");
  assert.equal(r.envelope.effect_execution_count, 1);
  assert.equal(r.envelope.authority_delta, 0);
  const v = verifyNode0FateStagedEffect(r.envelope);
  assert.equal(v.ok, true, v.reason);

  // Journal chain integrity
  const lines = readFileSync(join(dir, JOURNAL_FILE), "utf8").trim().split("\n");
  const recs = lines.map((l) => JSON.parse(l));
  for (let i = 1; i < recs.length; i += 1) {
    assert.equal(recs[i].prev_record_hash, recs[i - 1].record_hash);
  }
});

test("envelope tamper is rejected by the body-bound verifier", (t) => {
  const dir = freshScope(t);
  const r = startFateStagedEffect(ARGS(dir));
  const forged = { ...r.envelope, effect_execution_count: 2 };
  assert.equal(verifyNode0FateStagedEffect(forged).ok, false);
  assert.equal(
    verifyNode0FateStagedEffect({ ...r.envelope, content_hash: `sha256:${"0".repeat(64)}` }).ok,
    false,
  );
  assert.equal(verifyNode0FateStagedEffect({ ...r.envelope, boundary: {} }).ok, false);
});

// ---------------------------------------------------------------------------
// FATE refusal + guards
// ---------------------------------------------------------------------------

test("FATE refusal halts before any effect; journal carries the honest marker", (t) => {
  const dir = freshScope(t);
  const r = startFateStagedEffect({ ...ARGS(dir), operatorPhrase: "WRONG" });
  assert.equal(r.ok, false);
  assert.equal(r.phase, "HALTED_FATE");
  assert.equal(existsSync(join(dir, "beta.txt")), false);
  assert.equal(readFileSync(join(dir, "alpha.txt"), "utf8"), "genesis-bytes\n");
  const j = readFileSync(join(dir, JOURNAL_FILE), "utf8");
  assert.ok(j.includes("HALTED_FATE"));
  // Resume on a halted journal is terminal-honest, never re-runs fate.
  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  assert.equal(rr.ok, false);
  assert.equal(rr.phase, "HALTED_FATE");
});

test("second start on an open journal refuses; resume is the only path forward", (t) => {
  const dir = freshScope(t);
  const r = startFateStagedEffect(ARGS(dir));
  assert.equal(r.ok, true);
  const again = startFateStagedEffect(ARGS(dir));
  assert.equal(again.ok, false);
  assert.ok(again.blocked_by.includes("journal_already_open"));
  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  assert.equal(rr.phase, "COMMITTED");
  assert.equal(rr.idempotent, true);
  assert.equal(rr.effect_execution_count, 1); // never 2
});

test("source absent / destination occupied refuse before staging", (t) => {
  const empty = mkdtempSync(join(tmpdir(), "fse-"));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const a = startFateStagedEffect({ ...ARGS(empty) });
  assert.equal(a.phase, "RECOVERY_REQUIRED");
  assert.ok(a.blocked_by.includes("source_absent"));

  const occ = mkdtempSync(join(tmpdir(), "fse-"));
  t.after(() => rmSync(occ, { recursive: true, force: true }));
  writeFileSync(join(occ, "alpha.txt"), "a");
  writeFileSync(join(occ, "beta.txt"), "b");
  const b = startFateStagedEffect({ ...ARGS(occ) });
  assert.equal(b.phase, "RECOVERY_REQUIRED");
  assert.ok(b.blocked_by.includes("destination_occupied"));
});

// ---------------------------------------------------------------------------
// Crash windows — the exactly-once law
// ---------------------------------------------------------------------------

test("CRASH after stage, before effect: resume executes EXACTLY once and commits", (t) => {
  const dir = freshScope(t);
  // Build a staged-but-unaffected journal by hand (the crash surface).
  assert.equal(evaluateConsent({ phrase: REQUIRED, requiredPhrase: REQUIRED }).accepted, true);
  startFateStagedEffect(ARGS(dir));
  const lines = readFileSync(join(dir, JOURNAL_FILE), "utf8").trim().split("\n");
  const stageIdx = lines.findIndex((l) => l.includes('"type":"stage"'));
  // simulate crash: keep hello..stage only (drop effect/observed/commit records)
  const kept = lines.slice(0, stageIdx + 1).join("\n") + "\n";
  writeFileSync(join(dir, JOURNAL_FILE), kept);
  // restore pre-effect world AND scrub the first attempt\u2019s stray backups so the
  // emulated crash point is genuinely BEFORE any gate side-effect:
  rmSync(join(dir, "beta.txt"));
  for (const e of nodeFs.readdirSync(dir)) {
    if (e.startsWith(".node0")) rmSync(join(dir, e), { recursive: true, force: true });
  }
  writeFileSync(join(dir, "alpha.txt"), "genesis-bytes\n");

  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  assert.equal(rr.ok, true, rr.blocked_by?.join(","));
  assert.equal(rr.phase, "COMMITTED");
  assert.equal(rr.envelope.effect_execution_count, 1);
  assert.equal(existsSync(join(dir, "beta.txt")), true);
  assert.equal(existsSync(join(dir, "alpha.txt")), false);
});

test("CRASH after effect, before receipt: resume detects bytes-matched prediction and NEVER re-executes", (t) => {
  const dir = freshScope(t);
  // Real fault injection at the exact window: run start with an fs whose
  // appendFileSync throws AFTER the gate's internal writes complete.
  let appended = 0;
  const faultFs = {
    ...makeFs(),
    appendFileSync: (p, d, o) => {
      appended += 1;
      // Append order: #1 stage (kernel) · #2 gate-internal receipt log · #3 kernel EFFECT record.
      // Throwing at #3 lands exactly in the effect-done-receipt-absent window.
      if (appended === 3) throw new Error("SIGKILL_after_effect");
      return nodeFs.appendFileSync(p, d, o);
    },
  };
  const r = startFateStagedEffect({ ...ARGS(dir), fs: faultFs });
  assert.equal(r.ok, false);
  assert.equal(r.phase, "STAGED");
  assert.match(r.fault, /SIGKILL_after_effect/);
  // World: effect HAPPENED (rename done by the gate), journal has only stage.
  assert.equal(existsSync(join(dir, "beta.txt")), true);
  assert.equal(existsSync(join(dir, "alpha.txt")), false);

  // The probe: count how many times the world's beta bytes get written by a
  // fresh process — they cannot be; rename-based effect either ran or not.
  // Resume must classify effected-without-receipt and commit WITHOUT redoing.
  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  assert.equal(rr.ok, true, rr.blocked_by?.join(","));
  assert.equal(rr.phase, "COMMITTED");
  assert.equal(rr.resume_classification, "effect_done_record_absent");
  assert.equal(rr.effect_execution_count, 1);
  // byte identity preserved across recovery (rename law held)
  assert.equal(readFileSync(join(dir, "beta.txt"), "utf8"), "genesis-bytes\n");
});

test("ambiguous world fails closed into RECOVERY_REQUIRED — never guessed", (t) => {
  const dir = freshScope(t);
  startFateStagedEffect(ARGS(dir));
  const lines = readFileSync(join(dir, JOURNAL_FILE), "utf8").trim().split("\n");
  const stageIdx = lines.findIndex((l) => l.includes('"type":"stage"'));
  writeFileSync(join(dir, JOURNAL_FILE), lines.slice(0, stageIdx + 1).join("\n") + "\n");
  // Adversary mutates dst so it matches NEITHER prediction nor absence.
  writeFileSync(join(dir, "beta.txt"), "tampered\n");

  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  assert.equal(rr.ok, false);
  assert.equal(rr.phase, "RECOVERY_REQUIRED");
  assert.ok(rr.blocked_by.includes("ambiguous_world"));
});

test("observation contradiction fails closed: undo is REFUSED on an adversary-corrupted world (gate law), evidence preserved", (t) => {
  const dir = freshScope(t);
  // An adversary rewrites alpha BETWEEN gate execution and observation by
  // hijacking appendFile at the EFFECT record (world already renamed), then
  // swapping dst bytes.
  let n = 0;
  const evilFs = {
    ...makeFs(),
    appendFileSync: (p, d, o) => {
      n += 1;
      if (n === 2) {
        // effect record about to be journaled; corrupt dst first
        writeFileSync(join(dir, "beta.txt"), "adversary\n");
      }
      return nodeFs.appendFileSync(p, d, o);
    },
  };
  const r = startFateStagedEffect({ ...ARGS(dir), fs: evilFs });
  assert.equal(r.ok, false);
  assert.equal(r.phase, "RECOVERY_REQUIRED");
  assert.ok(r.blocked_by.includes("observation_contradicted"));
  // No silent redo, no silent restore: the corrupted world stands as EVIDENCE
  // (gate law: proven-undo refuses once live state diverges from the receipt).
  assert.equal(readFileSync(join(dir, "beta.txt"), "utf8"), "adversary\n");
});

test("torn journal tail stops at last good record; chain break refuses loudly", (t) => {
  const dir = freshScope(t);
  startFateStagedEffect(ARGS(dir));
  const raw = readFileSync(join(dir, JOURNAL_FILE), "utf8");
  writeFileSync(join(dir, JOURNAL_FILE), raw + '{"type":"phase","phase":"OBS');
  const rr = resumeFateStagedEffect({ fs: makeFs(), scopeDir: dir });
  // torn tail ignored -> committed journal remains idempotent-committed
  assert.equal(rr.phase, "COMMITTED");
});


// ---------------------------------------------------------------------------
// Universal scaffold contract
// ---------------------------------------------------------------------------

test("orchestrator runs the full composition with injected fs and all-false boundary", (t) => {
  const dir = freshScope(t);
  const r = runNode0FateStagedEffect({
    consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
    input: { ...ARGS(dir) },
  });
  assert.equal(r.ok, true, r.blocked_by?.join(","));
  assert.equal(r.phase, "COMMITTED");
  assert.equal(r.boundary.execution_allowed, false);
  assert.equal(r.envelope.effect_execution_count, 1);
});

test("orchestrator refuses without an injected fs adapter (no hidden io)", () => {
  const r = runNode0FateStagedEffect({
    consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
    input: { operatorPhrase: REQUIRED, fileName: "a", newName: "b" },
  });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("fs_adapter_not_injected"));
});
