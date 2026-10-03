// NODE0-RECOVERY-OBSERVATION-1A — reader + real supervised recovery.
//
// Each test uses its own temp DEMA_HOME; nothing touches ~/.dema. The join test
// costs a real process death and a real autonomous replacement.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import {
  RECOVERY_ARTEFACT_RELPATH,
  recoveryAfterWorkerExitObservation,
  recoveryDiagnostic,
  RECOVERY_INVARIANT_ID,
} from "../packages/core/src/node0-recovery-adapter.js";
import { NODE0_RUNTIME_KILL_RESUME_SCOPE } from "../packages/core/src/node0-recovery-observation.js";
import { CLOSURE_INVARIANTS } from "../packages/core/src/node0-closure-invariants.js";

const PROOF = join(import.meta.dirname, "..", "scripts", "proof", "node0-recovery-proof.mjs");
const RECOVERY_PUBLISHERS = [
  join(import.meta.dirname, "..", "scripts", "proof", "node0-recovery-supervisor.mjs"),
  join(import.meta.dirname, "..", "scripts", "proof", "node0-recovery-worker.mjs"),
];

function produce() {
  const home = mkdtempSync(join(tmpdir(), "rec-ad-"));
  const out = execFileSync(process.execPath, [PROOF, "--dema-home", home, "--json"], { encoding: "utf8", timeout: 300_000 });
  return { home, report: JSON.parse(out), artefactPath: join(home, RECOVERY_ARTEFACT_RELPATH) };
}

test("RCA-01: an absent artefact is silence, and a clean machine is not suspicious", () => {
  const home = mkdtempSync(join(tmpdir(), "rec-absent-"));
  try {
    assert.equal(recoveryAfterWorkerExitObservation({ demaHome: home }), null);
    const d = recoveryDiagnostic({ demaHome: home });
    assert.equal(d.state, "NOT_RECORDED");
    assert.equal(d.integrity_suspect, false);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("RCA-02: a real supervised recovery settles the row, and every control discriminated", () => {
  const { home, report } = produce();
  try {
    assert.equal(report.recovery_verdict, "RECOVERY_AFTER_EXIT_PROVEN");
    // The load-bearing facts: nobody told the supervisor, and the harness did NOT start B.
    assert.equal(report.supervisor_told_about_kill, false);
    assert.equal(report.supervisor_detected_death, true);
    assert.equal(report.successor_started_by, "supervisor");
    assert.notEqual(report.predecessor_pid, report.successor_pid);
    assert.equal(report.stale_token_result, "STALE_OWNER_FENCED");
    assert.equal(report.certified_by, "independent_observer", "the supervisor must not certify its own recovery");
    // All three negative controls must have come out the discriminating way.
    assert.deepEqual(report.controls, { no_supervisor_recovered: false, harness_started_b_accepted: false, alive_a_triggered_b: false });

    const o = recoveryAfterWorkerExitObservation({ demaHome: home });
    const row = CLOSURE_INVARIANTS.find((r) => r.id === RECOVERY_INVARIANT_ID);
    assert.equal(o.scope, row.required_scope);
    assert.equal(o.scope, NODE0_RUNTIME_KILL_RESUME_SCOPE);
    assert.ok(o.source.includes(report.observation_hash));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("RCA-03: the governed Node0 boundary was exercised, not asserted", () => {
  const { home, report } = produce();
  try {
    // The proof reached the supervisor through the REAL shipped createNode0Adapter,
    // whose whole contract is three read/propose verbs.
    assert.equal(report.governed_boundary.adapter, "packages/node-adapter/src/node0-adapter.js createNode0Adapter");
    assert.equal(report.governed_boundary.status_schema, "bizra.dema.status.v0.1");
    assert.deepEqual(report.governed_boundary.reachable_verbs, ["status", "listReceipts", "proposeBoundedDiagnostic"]);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("RCA-04: one edited byte silences the row and flags integrity", () => {
  const { home, artefactPath } = produce();
  try {
    const o = JSON.parse(readFileSync(artefactPath, "utf8"));
    o.successor_started_by = "supervisor"; // unchanged value; the hash is the point
    o.supervisor_told_about_kill = true;   // ...while removing the fact that earned it
    writeFileSync(artefactPath, JSON.stringify(o, null, 2));
    assert.equal(recoveryAfterWorkerExitObservation({ demaHome: home }), null);
    const d = recoveryDiagnostic({ demaHome: home });
    assert.equal(d.state, "HASH_UNVERIFIED");
    assert.equal(d.integrity_suspect, true);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("RCA-05: the diagnostic carries neither `observed` nor `source` and leaks no path", () => {
  const home = mkdtempSync(join(tmpdir(), "rec-diag-"));
  try {
    const d = recoveryDiagnostic({ demaHome: home });
    assert.equal("observed" in d, false);
    assert.equal("source" in d, false);
    assert.equal(d.settles_nothing, true);
    assert.equal(JSON.stringify(d).includes(home), false);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("RCA-06: concurrent recovery publishers atomically replace JSON reports", () => {
  for (const publisher of RECOVERY_PUBLISHERS) {
    const source = readFileSync(publisher, "utf8");
    assert.match(source, /writeFileSync\(tmp, JSON\.stringify\(o, null, 2\)\)/);
    assert.match(source, /renameSync\(tmp, target\)/);
  }
});
