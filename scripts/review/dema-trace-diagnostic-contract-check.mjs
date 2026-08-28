#!/usr/bin/env node
// DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A — review gate: four-rail promotion contract
// provenance · consistency · disambiguation · corroboration — plus semantic rederivation.

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  runTraceDiagnosticContractGate,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA,
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL,
  buildTraceDiagnosticContract,
  verifyTraceDiagnosticContract,
  defaultTraceDiagnosticFixtureV2,
  buildTraceDiagnosticContractV2,
  verifyTraceDiagnosticContractV2,
} from "../../packages/core/src/dema-trace-diagnostic-contract.js";

const JSON_MODE = process.argv.includes("--json");

export function runDemaTraceDiagnosticContractCheck() {
  // Happy path: full contract authorizes insight
  const happy = runTraceDiagnosticContractGate();
  if (!happy.ok || happy.promotion_status !== "INSIGHT_AUTHORIZED") {
    return { ...happy, ok: false, blocked_by: [...(happy.blocked_by ?? []), "happy_path_not_authorized"] };
  }
  // Negative control: single-hypothesis must NOT authorize
  const single = buildTraceDiagnosticContract({
    trace_set: happy.report.trace_set,
    hypothesis_graph: [{ hypothesis_id: "H1_only", explains_traces: [happy.report.trace_set[0].trace_id] }],
    insight_candidate: happy.report.insight_candidate,
    verification: happy.report.verification,
  });
  if (single.promotion_status === "INSIGHT_AUTHORIZED") {
    return { ok: false, blocked_by: ["single_hypothesis_should_not_authorize"], report: single };
  }
  // Tamper probe: flipping promotion_status with recomputed hash must still fail verify
  const tampered = { ...happy.report, promotion_status: "REMAIN_TRACE" };
  const { diagnostic_hash: _omit, ...hb } = tampered;
  const stable = (v) => {
    if (Array.isArray(v)) return `[${v.map((x) => stable(x) ?? "null").join(",")}]`;
    if (v && typeof v === "object") {
      const entries = Object.keys(v).sort().flatMap((k) => {
        const ser = stable(v[k]);
        return ser === undefined ? [] : [`${JSON.stringify(k)}:${ser}`];
      });
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(v);
  };
  const rehashForTamper = `sha256:${createHash("sha256").update(stable(hb), "utf8").digest("hex")}`;
  const forged = { ...tampered, diagnostic_hash: rehashForTamper };
  const v = verifyTraceDiagnosticContract(forged);
  if (v.ok) {
    return { ok: false, blocked_by: ["tamper_probe_should_fail"], verified: v };
  }

  // ─── v0.2: adversarial evidence-laundering probe ──────────────────────
  // Attack: build a valid v0.2 report, then evict hypothesis coverage
  // for one cited evidence_ref. The re-derivation must detect the orphan
  // and refuse AUTHORIZED status.
  const v2input = defaultTraceDiagnosticFixtureV2();
  const v2built = buildTraceDiagnosticContractV2(v2input);
  if (v2built.promotion_status !== "INSIGHT_AUTHORIZED") {
    return { ok: false, blocked_by: ["v2_happy_path_not_authorized"], report: v2built };
  }
  // Evict: remove H2 so trace.runtime_harness_001 becomes orphan
  const attacked = {
    ...v2built,
    hypothesis_graph: [
      { hypothesis_id: "H1_inward_defect", explains_traces: ["trace.code_static_001"] },
    ],
  };
  const v2rederived = buildTraceDiagnosticContractV2({
    trace_set: attacked.trace_set,
    hypothesis_graph: attacked.hypothesis_graph,
    insight_candidate: attacked.insight_candidate,
    verification: attacked.verification,
  });
  if (v2rederived.promotion_status === "INSIGHT_AUTHORIZED") {
    return { ok: false, blocked_by: ["v2_evidence_laundering_probe_failed"], report: v2rederived };
  }
  // Verify the rederived report is still well-formed
  const v2verify = verifyTraceDiagnosticContractV2(v2rederived);
  if (!v2verify.ok) {
    return { ok: false, blocked_by: ["v2_rederived_report_invalid"], verified: v2verify };
  }

  return happy;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // Run full check logic
  const full = runDemaTraceDiagnosticContractCheck();
  if (JSON_MODE) {
    const { report: _r, ...json } = full;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA - TRACE-DIAGNOSTIC-CONTRACT-1A");
    console.log(`  schema: ${DEMA_TRACE_DIAGNOSTIC_CONTRACT_SCHEMA}`);
    console.log(`  truth:  ${DEMA_TRACE_DIAGNOSTIC_CONTRACT_TRUTH_LABEL}`);
    console.log(`  promotion: ${full.promotion_status}`);
    console.log(`  rails: provenance=${full.rails?.provenance?.ok} consistency=${full.rails?.consistency?.ok} disambiguation=${full.rails?.disambiguation?.ok} corroboration=${full.rails?.corroboration?.ok}`);
    console.log(`  result: ${full.ok ? "PASS" : "FAIL"}`);
    for (const c of full.blocked_by ?? []) console.log(`    ${c}`);
    if (full.verified && !full.verified.ok) {
      for (const c of full.verified.blocked_by) console.log(`    verify: ${c}`);
    }
  }
  if (!full.ok) process.exitCode = 1;
}
