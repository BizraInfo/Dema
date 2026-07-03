import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AWAY_CONTRACT_SCHEMA,
  validateAwayContract,
} from "../packages/core/src/away-contract-schema.js";
import { verifyAwayContract } from "../packages/core/src/away-contract-verify.js";
import {
  expectedAwayContractReceiptConsent,
  writeAwayContractReceipt,
} from "../packages/core/src/away-contract-receipt.js";
import {
  ABSENCE_STEWARD_READINESS_SCHEMA,
  ABSENCE_STEWARD_READINESS_TRUTH_LABEL,
  ABSENCE_STEWARD_PREVIEW_STATES,
  deriveAbsenceStewardReadiness,
} from "../packages/core/src/absence-steward-readiness.js";

// ABSENCE-STEWARD-PREVIEW-CHECK-1A — deterministic read-only readiness gate
// over receipted Away Contracts (spec §4/§13). Readiness is a REPORT: no
// transition executes work, nothing starts, PREVIEW_READY grants nothing.

const NOW_ISO = "2026-07-04T02:00:00.000Z";

function validContract(overrides = {}) {
  return {
    schema: AWAY_CONTRACT_SCHEMA,
    contract_id: "away-2026-07-04-0001",
    operator_id: "mumu",
    node_id: "NODE0",
    mission_scope: "docs-only: readiness fixture",
    allowed_actions: ["READ_ONLY", "DOCS_ONLY", "TEST_ONLY"],
    forbidden_actions: ["PUSH_ALLOWED", "MODEL_ALLOWED", "NETWORK_ALLOWED"],
    data_scope: "repo:docs/**",
    model_policy: "forbidden",
    tool_policy: "npm test only",
    commit_policy: "none",
    push_policy: "forbidden",
    network_policy: "forbidden",
    mobile_escalation_policy: "LEVEL_1_SUMMARY_ONLY",
    risk_ceiling: 1,
    expires_at: "2026-07-04T12:00:00.000Z",
    stop_conditions: ["test failure"],
    receipt_required: true,
    review_required_on_return: true,
    ...overrides,
  };
}

async function receiptedTrio(overrides = {}) {
  const home = mkdtempSync(join(tmpdir(), "steward-readiness-"));
  try {
    const contract = validContract(overrides);
    const validation_result = validateAwayContract(contract, { now_iso: NOW_ISO });
    const verify_result = verifyAwayContract({ contract, validation_result }, { now_iso: NOW_ISO });
    const written = await writeAwayContractReceipt(
      {
        contract,
        validation_result,
        verify_result,
        typed_go: expectedAwayContractReceiptConsent(verify_result),
      },
      { dema_home: home, now_iso: NOW_ISO },
    );
    assert.equal(written.written, true, "fixture receipt must write");
    const receipt = JSON.parse(readFileSync(written.receipt_path, "utf8"));
    return { contract, validation_result, receipt };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function thaw(value) {
  return JSON.parse(JSON.stringify(value));
}

test("receipted, bound, unexpired trio derives PREVIEW_READY", async () => {
  const trio = await receiptedTrio();
  const report = deriveAbsenceStewardReadiness({ ...trio, now_iso: NOW_ISO });

  assert.equal(report.schema, ABSENCE_STEWARD_READINESS_SCHEMA);
  assert.equal(report.truth_label, ABSENCE_STEWARD_READINESS_TRUTH_LABEL);
  assert.equal(report.state, "PREVIEW_READY");
  assert.equal(report.contract_id, "away-2026-07-04-0001");
  assert.match(report.contract_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(report.blocked_by, []);
  assert.equal(report.ready, true);
  assert.ok(ABSENCE_STEWARD_PREVIEW_STATES.includes(report.state));
});

test("missing contract derives NOT_CONFIGURED; verified pair without receipt derives CONTRACT_VERIFIED", async () => {
  const none = deriveAbsenceStewardReadiness({ now_iso: NOW_ISO });
  assert.equal(none.state, "NOT_CONFIGURED");
  assert.equal(none.ready, false);

  const contract = validContract();
  const validation_result = validateAwayContract(contract, { now_iso: NOW_ISO });
  const verifiedOnly = deriveAbsenceStewardReadiness({
    contract,
    validation_result,
    now_iso: NOW_ISO,
  });
  assert.equal(verifiedOnly.state, "CONTRACT_VERIFIED");
  assert.equal(verifiedOnly.ready, false);
});

test("expired contract derives EXPIRED even with a bound receipt", async () => {
  const trio = await receiptedTrio();
  const report = deriveAbsenceStewardReadiness({
    ...trio,
    now_iso: "2026-07-04T13:00:00.000Z",
  });
  assert.equal(report.state, "EXPIRED");
  assert.equal(report.ready, false);
});

test("laundered contract derives REFUSED with blocked_by", async () => {
  const trio = await receiptedTrio();
  const drifted = { ...thaw(trio.contract), mission_scope: "docs-only PLUS push everything" };
  const report = deriveAbsenceStewardReadiness({
    contract: drifted,
    validation_result: trio.validation_result,
    receipt: trio.receipt,
    now_iso: NOW_ISO,
  });
  assert.equal(report.state, "REFUSED");
  assert.equal(report.ready, false);
  assert.ok(report.blocked_by.length > 0);
});

test("tampered receipt (forged hash, wrong consent, hot boundary) derives REFUSED", async () => {
  const trio = await receiptedTrio();

  // A body edit without recompute trips the self-excluding hash gate first.
  const forgedHash = thaw(trio.receipt);
  forgedHash.receipt_hash = "sha256:" + "0".repeat(64);
  const r1 = deriveAbsenceStewardReadiness({ ...trio, receipt: forgedHash, now_iso: NOW_ISO });
  assert.equal(r1.state, "REFUSED");
  assert.ok(r1.blocked_by.includes("receipt_hash_mismatch"));

  // Forge-AND-recompute probes: a self-consistent hash over a tampered body
  // must still refuse via the deeper binding checks.
  const { createHash } = await import("node:crypto");
  function recompute(receipt) {
    const { receipt_hash, ...body } = receipt;
    function stable(v) {
      if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
      if (v && typeof v === "object")
        return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
      return JSON.stringify(v);
    }
    receipt.receipt_hash =
      "sha256:" + createHash("sha256").update(stable(body), "utf8").digest("hex");
    return receipt;
  }

  const wrongPhrase = recompute({
    ...thaw(trio.receipt),
    consent_phrase: "GO: write away-contract receipt other 000000000000",
  });
  const r2 = deriveAbsenceStewardReadiness({ ...trio, receipt: wrongPhrase, now_iso: NOW_ISO });
  assert.equal(r2.state, "REFUSED");
  assert.ok(r2.blocked_by.includes("receipt_consent_phrase_mismatch"));

  const hotBoundary = thaw(trio.receipt);
  hotBoundary.boundary.contract_started = true;
  recompute(hotBoundary);
  const r3 = deriveAbsenceStewardReadiness({ ...trio, receipt: hotBoundary, now_iso: NOW_ISO });
  assert.equal(r3.state, "REFUSED");
  assert.ok(r3.blocked_by.includes("receipt_boundary_not_all_false"));
});

test("receipt bound to a DIFFERENT contract derives REFUSED", async () => {
  const trio = await receiptedTrio();
  const other = await receiptedTrio({
    contract_id: "away-2026-07-04-0002",
    mission_scope: "docs-only: a different mission",
  });
  const report = deriveAbsenceStewardReadiness({
    contract: trio.contract,
    validation_result: trio.validation_result,
    receipt: other.receipt,
    now_iso: NOW_ISO,
  });
  assert.equal(report.state, "REFUSED");
  assert.ok(report.blocked_by.includes("receipt_contract_mismatch"));
});

test("missing now_iso refuses — clock injected, never read", async () => {
  const trio = await receiptedTrio();
  const report = deriveAbsenceStewardReadiness({ ...trio });
  assert.equal(report.state, "REFUSED");
  assert.ok(report.blocked_by.includes("now_iso_required"));
});

test("readiness is a report, never a grant: boundary all-false with steward_started on every path", async () => {
  const trio = await receiptedTrio();
  const paths = [
    deriveAbsenceStewardReadiness({ ...trio, now_iso: NOW_ISO }),
    deriveAbsenceStewardReadiness({ now_iso: NOW_ISO }),
    deriveAbsenceStewardReadiness({ ...trio, now_iso: "2026-07-04T13:00:00.000Z" }),
  ];
  for (const report of paths) {
    assert.deepEqual(report.boundary, {
      steward_started: false,
      execution_attempted: false,
      contract_started: false,
      receipt_written: false,
      model_invocation: false,
      network: false,
      token_mint: false,
      activation: false,
      daemon_started: false,
    });
  }
});

test("kernel source stays pure: no fs, no clock, no writer reach", () => {
  const source = readFileSync(
    new URL("../packages/core/src/absence-steward-readiness.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|fs\/promises/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)/);
  assert.doesNotMatch(source, /writeAwayContractReceipt/);
});
