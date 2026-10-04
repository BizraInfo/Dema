// NODE0-WORKER-HANDOFF-1A — why the row is UNKNOWN.
//
// The adapter refuses a bad artefact by returning null, which is correct: the
// ledger must score silence as UNKNOWN, never as satisfaction. But seven
// different refusals produce the SAME silence, so today these are indisting-
// uishable in the published ledger:
//
//   nothing was ever recorded            ← honest absence
//   the artefact's hash does not re-derive ← someone edited it
//   the artefact claims TEST_INJECTION     ← someone tried to inject a fixture
//   it was judged by different kernel bytes ← stale or forged rules
//
// The first is the system working. The last three are signals that something is
// wrong, and hiding them inside "unknown" is the inverse of the estate's own
// rule that an empty result from a broken query reads exactly like a clean pass.
//
// This adds a DIAGNOSTIC channel and nothing else. It is deliberately incapable
// of settling anything: it returns a reason, never an observation, and the
// evidence path is untouched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import { buildWorkerHandoffObservation } from "../packages/core/src/node0-worker-handoff.js";
import {
  workerHandoffObservation,
  workerHandoffDiagnostic,
  currentKernelHash,
  HANDOFF_ARTEFACT_RELPATH,
  HANDOFF_DIAGNOSTIC_STATES,
  HANDOFF_INTEGRITY_SUSPECT_STATES,
} from "../packages/core/src/node0-worker-handoff-adapter.js";

function provenArtefact(over = {}) {
  return buildWorkerHandoffObservation({
    evidenceClass: "OBSERVED",
    executedCodeHash: currentKernelHash(),
    observedAt: "2026-08-09T00:00:00.000Z",
    predecessor: {
      worker_id: "A", pid: 11, boot_identity_hash: "boot:x", exited: true,
      checkpoint_sequence: 3, checkpoint_head_hash: "head:3",
      fencing_token: "sha256:claim-A", season_id: "s1",
    },
    successor: {
      worker_id: "B", pid: 12, boot_identity_hash: "boot:x",
      claim_kind: "DEAD_OWNER_TAKEOVER", predecessor_fence_status: "STALE_OWNER_FENCED",
      fencing_token: "sha256:claim-B", predecessor_fencing_token: "sha256:claim-A",
      resumed_sequence: 4, resumed_from_head_hash: "head:3", season_id: "s1",
    },
    hash: sha256CanonicalJsonV1,
    ...over,
  });
}

/** Run `fn` against a temp DEMA_HOME containing `raw` (undefined = no artefact). */
function withHome(raw, fn) {
  const home = mkdtempSync(join(tmpdir(), "node0-handoff-diag-"));
  try {
    if (raw !== undefined) {
      const file = join(home, HANDOFF_ARTEFACT_RELPATH);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, typeof raw === "string" ? raw : JSON.stringify(raw));
    }
    return fn(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

const stateOf = (raw) => withHome(raw, (home) => workerHandoffDiagnostic({ demaHome: home }).state);

test("WHD-01 the diagnostic vocabulary is closed, and names which states are suspicious", () => {
  assert.ok(Object.isFrozen(HANDOFF_DIAGNOSTIC_STATES));
  assert.ok(Object.isFrozen(HANDOFF_INTEGRITY_SUSPECT_STATES));
  // Absence is NOT suspicious. Conflating "nobody ran it" with "someone edited
  // it" in either direction is the whole defect this closes.
  assert.equal(HANDOFF_INTEGRITY_SUSPECT_STATES.includes("NOT_RECORDED"), false);
  assert.equal(HANDOFF_INTEGRITY_SUSPECT_STATES.includes("ACCEPTED"), false);
  for (const s of HANDOFF_INTEGRITY_SUSPECT_STATES) {
    assert.ok(HANDOFF_DIAGNOSTIC_STATES.includes(s), `${s} must be a declared state`);
  }
});

test("WHD-02 every refusal path reports a DISTINCT reason", () => {
  // The point of the slice: these were all `null` and therefore all identical.
  assert.equal(stateOf(undefined), "NOT_RECORDED");
  assert.equal(stateOf("not json at all"), "UNREADABLE");
  assert.equal(stateOf({ ...provenArtefact(), schema: "bizra.dema.other.v0.1" }), "SCHEMA_MISMATCH");
  assert.equal(stateOf({ ...provenArtefact(), scope: "node0_bridge_readiness" }), "SCOPE_MISMATCH");
  assert.equal(stateOf({ ...provenArtefact(), checkpoint_sequence: 99 }), "HASH_UNVERIFIED");
  assert.equal(stateOf(provenArtefact({ evidenceClass: "TEST_INJECTION" })), "NOT_CLEAN_ELIGIBLE");
  assert.equal(stateOf(provenArtefact({ executedCodeHash: "sha256:not-the-kernel" })), "KERNEL_BYTES_MISMATCH");
  assert.equal(stateOf(provenArtefact()), "ACCEPTED");
});

test("WHD-03 tampering is flagged as suspicious; absence is not", () => {
  // A hand-edited artefact and an empty machine must never read the same.
  const tampered = withHome({ ...provenArtefact(), checkpoint_sequence: 99 },
    (h) => workerHandoffDiagnostic({ demaHome: h }));
  const empty = withHome(undefined, (h) => workerHandoffDiagnostic({ demaHome: h }));

  assert.equal(tampered.integrity_suspect, true);
  assert.equal(empty.integrity_suspect, false);
  assert.notEqual(tampered.state, empty.state);
});

test("WHD-04 the diagnostic can never settle an invariant", () => {
  // THE CONSTITUTIONAL CONSTRAINT. A diagnostic that could be mistaken for
  // evidence would be a second, weaker path to SATISFIED.
  for (const raw of [undefined, provenArtefact(), { ...provenArtefact(), checkpoint_sequence: 99 }]) {
    const d = withHome(raw, (h) => workerHandoffDiagnostic({ demaHome: h }));
    assert.equal("observed" in d, false, "a diagnostic must carry no `observed` field");
    assert.equal("source" in d, false, "a diagnostic must carry no `source` field");
    assert.equal(Object.isFrozen(d), true);
  }
});

test("WHD-05 the diagnostic does not leak the home path", () => {
  // The ledger is a publishable truth surface; the operator's filesystem layout
  // is not part of the claim.
  const d = withHome(provenArtefact(), (h) => workerHandoffDiagnostic({ demaHome: h }));
  assert.equal(JSON.stringify(d).includes(tmpdir()), false);
});

test("WHD-06 the observation path is unchanged by this slice", () => {
  // Regression guard: the diagnostic must be additive. ACCEPTED still yields an
  // observation; every other state still yields exactly null.
  withHome(provenArtefact(), (home) => {
    assert.ok(workerHandoffObservation({ demaHome: home }), "ACCEPTED must still observe");
  });
  for (const raw of [
    undefined,
    "not json at all",
    { ...provenArtefact(), checkpoint_sequence: 99 },
    provenArtefact({ evidenceClass: "TEST_INJECTION" }),
    provenArtefact({ executedCodeHash: "sha256:not-the-kernel" }),
  ]) {
    withHome(raw, (home) => {
      assert.equal(workerHandoffObservation({ demaHome: home }), null);
    });
  }
});

test("WHD-07 observation and diagnostic cannot drift apart", () => {
  // They share one classifier. If a future edit gives them separate logic, the
  // adapter could accept an artefact the diagnostic calls broken, or vice versa.
  for (const raw of [
    undefined,
    "not json at all",
    { ...provenArtefact(), scope: "node0_bridge_readiness" },
    { ...provenArtefact(), checkpoint_sequence: 99 },
    provenArtefact({ evidenceClass: "OPERATOR_ASSERTED" }),
    provenArtefact({ executedCodeHash: null }),
    provenArtefact(),
  ]) {
    withHome(raw, (home) => {
      const accepted = workerHandoffDiagnostic({ demaHome: home }).state === "ACCEPTED";
      const observed = workerHandoffObservation({ demaHome: home }) !== null;
      assert.equal(accepted, observed, "ACCEPTED must hold exactly when an observation is produced");
    });
  }
});
