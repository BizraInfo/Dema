// NODE0-CLOSE-MEASUREMENT-RECEIPT-1A — soak + remote_write admission overlay.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  evaluateNode0ClosureInvariants,
  CLOSURE_INVARIANTS,
  REMOTE_WRITE_OBSERVATION_SCOPE,
} from "../packages/core/src/node0-closure-invariants.js";
import {
  buildNode0CloseMeasurementReceipt,
  evaluateSoakAdmission,
  normalizeRemoteWriteDiagnostic,
  resolveRemoteWriteBlockReason,
  NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA,
  SOAK_OBSERVATION_SCOPE,
  DEFAULT_SOAK_MIN_DURATION_SECONDS,
} from "../packages/core/src/node0-close-measurement-receipt.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";
import { gatherClosureReadout } from "../scripts/review/node0-closure-invariants-check.mjs";
import { discoverLongestEnduranceReceipt } from "../scripts/proof/node0-close-measurement-receipt.mjs";

function obs(invariant, observed) {
  return {
    observed,
    source: `test-fixture:${invariant.id}`,
    scope: invariant.required_scope,
  };
}

function allSatisfiedEvidence({ remoteWriteObserved = false } = {}) {
  const evidence = {};
  for (const inv of CLOSURE_INVARIANTS) {
    evidence[inv.id] = obs(inv, inv.required);
  }
  evidence.remote_write = obs(
    CLOSURE_INVARIANTS.find((i) => i.id === "remote_write"),
    remoteWriteObserved,
  );
  return evidence;
}

function healthySoak(overrides = {}) {
  return {
    observed: true,
    source: "test-fixture:soak",
    scope: SOAK_OBSERVATION_SCOPE,
    observed_duration_seconds: DEFAULT_SOAK_MIN_DURATION_SECONDS,
    ...overrides,
  };
}

describe("node0-close-measurement-receipt", () => {
  test("empty evidence ⇒ usable OPEN receipt with NODE0_CLOSED false", () => {
    const r = buildNode0CloseMeasurementReceipt({
      head_sha: "abc",
      measured_at: "2026-10-31T00:00:00.000Z",
    });
    assert.equal(r.schema, NODE0_CLOSE_MEASUREMENT_RECEIPT_SCHEMA);
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission_verdict, "OPEN");
    assert.equal(r.authority_delta, 0);
    assert.equal(isCanonicalBoundary(r.boundary), true);
    assert.equal(r.admission.soak_satisfied, false);
    assert.equal(r.admission.remote_write_satisfied, false);
    assert.ok(r.blocked_by.some((b) => b.id === "soak"));
    assert.ok(r.blocked_by.some((b) => b.id === "remote_write"));
  });

  test("ten satisfied without soak still refuses NODE0_CLOSED", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    assert.equal(ledger.verdict, "CLOSED");
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      // soak omitted
    });
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission.ledger_claims_closed, true);
    assert.equal(r.admission.remote_write_satisfied, true);
    assert.equal(r.admission.soak_satisfied, false);
    assert.ok(r.blocked_by.some((b) => b.id === "soak"));
  });

  test("soak short of 72h refuses even with closed ledger", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak({ observed_duration_seconds: 3600 }),
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.soak.status, "VIOLATED");
    assert.equal(r.soak.reason, "soak_duration_below_minimum");
  });

  test("closed ledger + healthy soak + remote_write ⇒ NODE0_CLOSED true", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.measurement_admits_closed, true);
    assert.equal(r.admission_verdict, "ADMITTED");
    assert.equal(r.blocked_by.length, 0);
  });

  test("remote_write VIOLATED (external path) blocks admission", () => {
    const ledger = evaluateNode0ClosureInvariants(
      allSatisfiedEvidence({ remoteWriteObserved: true }),
    );
    assert.equal(ledger.verdict, "OPEN");
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak(),
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.remote_write.status, "VIOLATED");
  });

  test("forged CLOSED ledger fails verify ⇒ ok false, NODE0_CLOSED false", () => {
    const open = evaluateNode0ClosureInvariants({});
    const forged = {
      ...open,
      verdict: "CLOSED",
    };
    Object.defineProperty(forged, "node0_closed", {
      value: true,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: forged,
      soak: healthySoak(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.measurement_admits_closed, false);
  });

  test("evaluateSoakAdmission rejects wrong scope", () => {
    const s = evaluateSoakAdmission({
      observed: true,
      source: "x",
      scope: "wrong",
      observed_duration_seconds: DEFAULT_SOAK_MIN_DURATION_SECONDS,
    });
    assert.equal(s.status, "UNKNOWN");
    assert.equal(s.reason, "observation_scope_mismatch");
    assert.equal(s.required_scope, SOAK_OBSERVATION_SCOPE);
  });


  test("cannot lower soak floor below 72h via min_soak_duration_seconds", () => {
    const ledger = evaluateNode0ClosureInvariants(allSatisfiedEvidence());
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak({ observed_duration_seconds: 1 }),
      min_soak_duration_seconds: 1,
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.admission.soak_min_duration_seconds, DEFAULT_SOAK_MIN_DURATION_SECONDS);
    assert.equal(r.soak.status, "VIOLATED");
  });
  test("soak scope constant is not the remote_write scope", () => {
    assert.notEqual(SOAK_OBSERVATION_SCOPE, REMOTE_WRITE_OBSERVATION_SCOPE);
  });

  test("stale remote_write diagnostic replaces ledger silence (no_evidence)", () => {
    const r = buildNode0CloseMeasurementReceipt({
      evidence: {},
      soak: healthySoak(),
      remote_write_diagnostic: {
        invariant_id: "remote_write",
        state: "OBSERVATION_STALE",
        integrity_suspect: false,
      },
    });
    assert.equal(r.measurement_admits_closed, false);
    assert.equal(r.remote_write.status, "UNKNOWN");
    assert.equal(r.remote_write.reason, "observation_stale");
    assert.equal(r.remote_write.diagnostic.state, "OBSERVATION_STALE");
    const block = r.blocked_by.find((b) => b.id === "remote_write");
    assert.equal(block.reason, "observation_stale");
  });

  test("one stale remote_write readout cannot pair stale diagnosis with settlement", () => {
    let captures = 0;
    const readout = gatherClosureReadout([
      {
        invariant_id: "remote_write",
        capture: () => {
          captures += 1;
          return {
            observation: null,
            diagnostic: {
              state: "OBSERVATION_STALE",
              remote_write_verdict: "NO_EXTERNAL_WRITE_PATH",
              integrity_suspect: false,
            },
          };
        },
        observe: () => assert.fail("paired capture must own the observation"),
        diagnose: () => assert.fail("paired capture must own the diagnostic"),
      },
    ]);
    const ledger = evaluateNode0ClosureInvariants(readout.evidence);
    const r = buildNode0CloseMeasurementReceipt({
      closure_ledger: ledger,
      soak: healthySoak(),
      remote_write_diagnostic: readout.diagnostics.remote_write,
    });
    assert.equal(captures, 1);
    assert.equal("remote_write" in readout.evidence, false);
    assert.equal(r.remote_write.status, "UNKNOWN");
    assert.equal(r.remote_write.diagnostic.state, "OBSERVATION_STALE");
    assert.equal(r.measurement_admits_closed, false);
  });

  test("NOT_RECORDED diagnostic keeps no_evidence silence", () => {
    const r = buildNode0CloseMeasurementReceipt({
      evidence: {},
      remote_write_diagnostic: {
        state: "NOT_RECORDED",
        integrity_suspect: false,
      },
    });
    assert.equal(r.remote_write.reason, "no_evidence");
    assert.equal(r.remote_write.diagnostic.state, "NOT_RECORDED");
  });

  test("diagnostic never upgrades remote_write to SATISFIED", () => {
    const r = buildNode0CloseMeasurementReceipt({
      evidence: {},
      soak: healthySoak(),
      remote_write_diagnostic: {
        state: "ACCEPTED",
        remote_write_verdict: "NO_EXTERNAL_WRITE_PATH",
        integrity_suspect: false,
      },
    });
    assert.equal(r.admission.remote_write_satisfied, false);
    assert.equal(r.measurement_admits_closed, false);
    assert.notEqual(r.remote_write.status, "SATISFIED");
  });

  test("normalizeRemoteWriteDiagnostic / resolveRemoteWriteBlockReason pure helpers", () => {
    assert.equal(normalizeRemoteWriteDiagnostic(null), null);
    assert.equal(normalizeRemoteWriteDiagnostic("x"), null);
    const n = normalizeRemoteWriteDiagnostic({
      state: "KERNEL_BYTES_MISMATCH",
      integrity_suspect: true,
      finding_count: 3,
    });
    assert.equal(n.state, "KERNEL_BYTES_MISMATCH");
    assert.equal(n.integrity_suspect, true);
    assert.equal(n.finding_count, 3);
    assert.equal(
      resolveRemoteWriteBlockReason("no_evidence", n),
      "kernel_bytes_mismatch",
    );
    assert.equal(
      resolveRemoteWriteBlockReason("observation_scope_mismatch", n),
      "observation_scope_mismatch",
    );
  });

  test("discoverLongestEnduranceReceipt prefers longest verified chain; skips unverified", async () => {
    assert.equal(discoverLongestEnduranceReceipt("/no/such/dema-home"), null);
    const {
      chainEnduranceRecord,
      buildEnduranceAnchor,
      ENDURANCE_HEADER_KIND,
      ENDURANCE_SAMPLE_KIND,
      ENDURANCE_EVIDENCE_CLASSES,
    } = await import("../packages/core/src/node0-endurance-chain.js");
    const home = mkdtempSync(join(tmpdir(), "dema-close-disc-"));
    const writeVerified = (runId, spanMs) => {
      const dir = join(home, "node0", "endurance", runId);
      mkdirSync(dir, { recursive: true });
      const codeHash = "sha256:" + "a".repeat(64);
      let prev = chainEnduranceRecord({
        prev: null,
        record: {
          kind: ENDURANCE_HEADER_KIND,
          run_id: runId,
          runner_code_hash: codeHash,
          evidence_class: ENDURANCE_EVIDENCE_CLASSES.ELAPSED,
          // Interval must cover the fixture span or re-derived judgment is BROKEN
          // (still discoverable — admission ranks by live observed_span_ms).
          interval_ms: Math.max(1000, spanMs),
          target_ms: spanMs,
          started_at_ms: 1_700_000_000_000,
        },
      });
      const records = [prev];
      prev = chainEnduranceRecord({
        prev,
        record: {
          kind: ENDURANCE_SAMPLE_KIND,
          run_id: runId,
          at_ms: 1_700_000_000_000,
          ok: true,
          mission_verdict: "CLEAN",
        },
      });
      records.push(prev);
      prev = chainEnduranceRecord({
        prev,
        record: {
          kind: ENDURANCE_SAMPLE_KIND,
          run_id: runId,
          at_ms: 1_700_000_000_000 + spanMs,
          ok: true,
          mission_verdict: "CLEAN",
        },
      });
      records.push(prev);
      writeFileSync(
        join(dir, "samples.jsonl"),
        records.map((r) => JSON.stringify(r)).join("\n") + "\n",
      );
      writeFileSync(
        join(dir, "anchor.json"),
        JSON.stringify(buildEnduranceAnchor({ head: prev, runId })) + "\n",
      );
      writeFileSync(
        join(dir, "endurance-receipt.json"),
        JSON.stringify({
          schema: "bizra.dema.node0_run_receipt.v0.1",
          run_id: runId,
          verdict: {
            schema: "bizra.dema.node0_endurance.v0.1",
            observed_span_ms: spanMs,
            failure_count: 0,
            continuously_observed: true,
            ok: true,
            verdict: "HEALTHY",
            target_met_by_elapsed_run: true,
          },
        }) + "\n",
      );
    };
    try {
      // Receipt-only forgery must not win discovery.
      const fake = join(home, "node0", "endurance", "forged-long");
      mkdirSync(fake, { recursive: true });
      writeFileSync(
        join(fake, "endurance-receipt.json"),
        JSON.stringify({
          schema: "bizra.dema.node0_run_receipt.v0.1",
          run_id: "forged-long",
          verdict: {
            schema: "bizra.dema.node0_endurance.v0.1",
            observed_span_ms: DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000 * 2,
            failure_count: 0,
            continuously_observed: true,
            ok: true,
            verdict: "HEALTHY",
            target_met_by_elapsed_run: true,
          },
        }),
      );
      writeVerified("probe-short", 8_000);
      writeVerified("soak-long", DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000);
      const found = discoverLongestEnduranceReceipt(home);
      assert.equal(found.run_id, "soak-long");
      assert.equal(
        found.observed_span_ms,
        DEFAULT_SOAK_MIN_DURATION_SECONDS * 1000,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
