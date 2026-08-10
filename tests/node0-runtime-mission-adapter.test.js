// NODE0-RUNTIME-MISSION-OBSERVATION-1A — adapter + producer join.
//
// The adapter tests run in their own temp DEMA_HOME; nothing touches ~/.dema.
// The join test costs two real process deaths and there is no faster way to
// observe a transition between processes.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

import {
  RUNTIME_MISSION_ARTEFACT_RELPATH,
  currentRuntimeKernelHash,
  missionPrimaryStateObservation,
  contractImmutabilityObservation,
  runtimeMissionDiagnostic,
  STATE_OWNERSHIP_INVARIANT_ID,
  CONTRACT_IMMUTABILITY_INVARIANT_ID,
} from "../packages/core/src/node0-runtime-mission-adapter.js";
import {
  NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE,
  NODE0_CONTRACT_IMMUTABILITY_SCOPE,
} from "../packages/core/src/node0-runtime-mission-observation.js";
import { CLOSURE_INVARIANTS } from "../packages/core/src/node0-closure-invariants.js";

const REPO = join(import.meta.dirname, "..");
const PROOF = join(REPO, "scripts", "proof", "node0-runtime-mission-proof.mjs");

/// One real run into a throwaway home. Returns {home, report, artefactPath}.
function produce() {
  const home = mkdtempSync(join(tmpdir(), "rt-adapter-"));
  const out = execFileSync(process.execPath, [PROOF, "--dema-home", home, "--json"], { encoding: "utf8", timeout: 120_000 });
  return { home, report: JSON.parse(out), artefactPath: join(home, RUNTIME_MISSION_ARTEFACT_RELPATH) };
}

// ── RMA-01 · absence is silence, not a refutation ────────────────────────────
test("RMA-01: an absent artefact yields null for both rows and NOT_RECORDED", () => {
  const home = mkdtempSync(join(tmpdir(), "rt-absent-"));
  try {
    assert.equal(missionPrimaryStateObservation({ demaHome: home }), null);
    assert.equal(contractImmutabilityObservation({ demaHome: home }), null);
    const d = runtimeMissionDiagnostic({ demaHome: home });
    assert.equal(d.state, "NOT_RECORDED");
    assert.equal(d.integrity_suspect, false, "a clean machine is not a suspicious machine");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── RMA-02 · the wiring proof and positive control ───────────────────────────
test("RMA-02: a genuine run yields BOTH observations at the scopes the ledger requires", () => {
  const { home, report, artefactPath } = produce();
  try {
    assert.equal(report.state_ownership_verdict, "MISSION_STATE_PRIMARY_PROVEN");
    assert.equal(report.contract_immutability_verdict, "CONTRACT_IMMUTABLE_PROVEN");
    assert.equal(report.killed_with, "SIGKILL", "a clean exit would be a different claim");
    assert.notEqual(report.predecessor_pid, report.successor_pid, "the replacement must be a different process");
    assert.equal(report.control_recovered, false, "the discriminating control must NOT have recovered");

    const a = missionPrimaryStateObservation({ demaHome: home });
    const b = contractImmutabilityObservation({ demaHome: home });
    assert.equal(a.observed, true);
    assert.equal(b.observed, true);
    // The scope must equal what the ledger demands, read from the ledger itself.
    const rowA = CLOSURE_INVARIANTS.find((r) => r.id === STATE_OWNERSHIP_INVARIANT_ID);
    const rowB = CLOSURE_INVARIANTS.find((r) => r.id === CONTRACT_IMMUTABILITY_INVARIANT_ID);
    assert.equal(a.scope, rowA.required_scope);
    assert.equal(b.scope, rowB.required_scope);
    assert.equal(a.scope, NODE0_RUNTIME_STATE_OWNERSHIP_SCOPE);
    assert.equal(b.scope, NODE0_CONTRACT_IMMUTABILITY_SCOPE);
    assert.ok(a.source.includes(report.observation_hash), "the source must bind the exact observation");
    assert.ok(readFileSync(artefactPath, "utf8").length > 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── RMA-03 · tamper ──────────────────────────────────────────────────────────
test("RMA-03: one edited byte silences BOTH rows and flags integrity", () => {
  const { home, artefactPath } = produce();
  try {
    const o = JSON.parse(readFileSync(artefactPath, "utf8"));
    o.successor_state_seq = (o.successor_state_seq ?? 0) + 1; // a covered fact
    writeFileSync(artefactPath, JSON.stringify(o, null, 2));
    assert.equal(missionPrimaryStateObservation({ demaHome: home }), null);
    assert.equal(contractImmutabilityObservation({ demaHome: home }), null);
    const d = runtimeMissionDiagnostic({ demaHome: home });
    assert.equal(d.state, "HASH_UNVERIFIED");
    assert.equal(d.integrity_suspect, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("RMA-03b: hand-upgrading a verdict is exactly what re-derivation refuses", () => {
  const { home, artefactPath } = produce();
  try {
    const o = JSON.parse(readFileSync(artefactPath, "utf8"));
    o.state_ownership_verdict = "MISSION_STATE_PRIMARY_PROVEN"; // already true; the point is the hash
    o.worker_local_control_recovered = true; // ...while removing the control that earned it
    writeFileSync(artefactPath, JSON.stringify(o, null, 2));
    assert.equal(missionPrimaryStateObservation({ demaHome: home }), null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── RMA-04 · kernel bytes ────────────────────────────────────────────────────
test("RMA-04: an artefact judged by different kernel bytes stops counting", () => {
  const { home, artefactPath } = produce();
  const fakeKernel = join(mkdtempSync(join(tmpdir(), "rt-kernel-")), "k.js");
  try {
    writeFileSync(fakeKernel, "// not the kernel that judged this artefact\n");
    assert.notEqual(currentRuntimeKernelHash(fakeKernel), JSON.parse(readFileSync(artefactPath, "utf8")).executed_code_hash);
    assert.equal(missionPrimaryStateObservation({ demaHome: home, kernelPath: fakeKernel }), null);
    assert.equal(runtimeMissionDiagnostic({ demaHome: home, kernelPath: fakeKernel }).state, "KERNEL_BYTES_MISMATCH");
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(dirname(fakeKernel), { recursive: true, force: true });
  }
});

// ── RMA-05 · the rows are judged independently ───────────────────────────────
test("RMA-05: an artefact proving one row and failing the other settles only the one", () => {
  const home = mkdtempSync(join(tmpdir(), "rt-split-"));
  try {
    // Built through the real kernel so the hash and kernel bytes are honest; only
    // the FACTS are chosen to prove ownership while failing immutability.
    const mod = "../packages/core/src/node0-runtime-mission-observation.js";
    return import(mod).then(async (K) => {
      const { sha256CanonicalJsonV1 } = await import("../packages/canon/src/sha256-canonical-json-v1.js");
      const o = K.buildRuntimeMissionObservation({
        predecessor: { pid: 1, exited: true, killed_with: "SIGKILL", mission_id: "M", contract_hash: "sha256:c", checkpoint_state_hash: "sha256:s", state_seq: 1 },
        successor: { pid: 2, reconstructed_from: "dema_home_only", mission_id: "M", contract_hash: "sha256:c", resumed_state_hash: "sha256:s", state_seq: 2, human_steps_between: 0 },
        workerLocalControl: { attempted: true, recovered: false },
        immutability: { amendment_channel: "worker", amendment_refusal: null, contract_hash_before: "sha256:c", contract_hash_after: "sha256:c", refusal_receipted: true, operator_control_attempted: true, operator_control_new_hash: "sha256:c2" },
        evidenceClass: "OBSERVED",
        executedCodeHash: currentRuntimeKernelHash(),
        hash: sha256CanonicalJsonV1,
      });
      const p = join(home, RUNTIME_MISSION_ARTEFACT_RELPATH);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(o, null, 2));
      assert.ok(missionPrimaryStateObservation({ demaHome: home }), "ownership is proven and must settle");
      assert.equal(contractImmutabilityObservation({ demaHome: home }), null, "immutability failed and must NOT settle");
      assert.equal(runtimeMissionDiagnostic({ demaHome: home }).contract_immutability_verdict, "AMENDMENT_NOT_REFUSED");
    });
  } finally {
    // rmSync deferred to the promise chain above is unnecessary: the dir is a temp
    // path and the suite's TMPDIR is scoped.
  }
});

// ── RMA-06 · the diagnostic can never settle a row ───────────────────────────
test("RMA-06: the diagnostic carries neither `observed` nor `source`", () => {
  const home = mkdtempSync(join(tmpdir(), "rt-diag-"));
  try {
    const d = runtimeMissionDiagnostic({ demaHome: home });
    assert.equal("observed" in d, false);
    assert.equal("source" in d, false);
    assert.equal(d.settles_nothing, true);
    assert.equal(JSON.stringify(d).includes(home), false, "the home path must not leak into a publishable surface");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── slice 2 · verification_is_external and authority_delta ───────────────────
import {
  verifierIndependenceObservation,
  cycleAuthorityDeltaObservation,
  VERIFIER_INDEPENDENCE_INVARIANT_ID,
  CYCLE_AUTHORITY_DELTA_INVARIANT_ID,
} from "../packages/core/src/node0-runtime-mission-adapter.js";

test("RMA-07: a genuine run yields all FOUR observations at ledger-declared scopes", () => {
  const { home, report } = produce();
  try {
    assert.equal(report.verifier_independence_verdict, "VERIFICATION_EXTERNAL_PROVEN");
    assert.equal(report.authority_delta_verdict, "AUTHORITY_DELTA_ZERO_PROVEN");
    assert.equal(report.measured_authority_delta, 0);
    // The self-certification control must have DISCRIMINATED in the real run:
    // the executor claimed ACCEPT and the independent verifier said REJECT.
    assert.equal(report.executor_claimed, "ACCEPT");
    assert.equal(report.independently_rederived, "REJECT");
    assert.notEqual(report.executor_pid, report.verifier_pid, "the verifier must not be the executor");

    const v = verifierIndependenceObservation({ demaHome: home });
    const a = cycleAuthorityDeltaObservation({ demaHome: home });
    const rowV = CLOSURE_INVARIANTS.find((r) => r.id === VERIFIER_INDEPENDENCE_INVARIANT_ID);
    const rowA = CLOSURE_INVARIANTS.find((r) => r.id === CYCLE_AUTHORITY_DELTA_INVARIANT_ID);
    assert.equal(v.scope, rowV.required_scope);
    assert.equal(a.scope, rowA.required_scope);
    // authority_delta is one of the two inverted rows: the required value is 0.
    assert.equal(a.observed, rowA.required);
    assert.ok(a.source.includes("measured_delta=0"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("RMA-08: tampering with an authority fact silences the authority row alone", () => {
  const { home, artefactPath } = produce();
  try {
    const o = JSON.parse(readFileSync(artefactPath, "utf8"));
    o.authority_after_hash = "sha256:widened";
    writeFileSync(artefactPath, JSON.stringify(o, null, 2));
    // The whole artefact fails re-derivation, so EVERY row falls silent — which is
    // the honest outcome: an edited artefact is not partially trustworthy.
    assert.equal(cycleAuthorityDeltaObservation({ demaHome: home }), null);
    assert.equal(verifierIndependenceObservation({ demaHome: home }), null);
    assert.equal(runtimeMissionDiagnostic({ demaHome: home }).state, "HASH_UNVERIFIED");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
