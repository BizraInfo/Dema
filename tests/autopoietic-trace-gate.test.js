import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import {
  AUTOPOIETIC_TRACE_GATE_SCHEMA,
  AUTOPOIETIC_TRACE_GATE_TRUTH_LABEL,
  CONSENT_PHRASE,
  HHMM_PHASES,
  FORBIDDEN_OVERCLAIMS,
  parseChainText,
  mineChain,
  sealChainRecord,
  verifyChainLinkage,
  buildAutopoieticTraceGate,
  applyAutopoieticProposal,
  refuseOverclaim,
  verifyAutopoieticTraceGate,
  runAutopoieticTraceGateGate,
} from "../packages/core/src/autopoietic-trace-gate.js";

const FIXTURE_TERMINAL = `
{"type":"mission.start","prev":"GENESIS","hash":"a1"}
{"type":"lease.issue","prev":"a1","hash":"a2"}
{"type":"transition.applied","transition":"mkdir_workspace","prev":"a2","hash":"a3"}
{"type":"terminal.done","prev":"a3","hash":"a4"}
`.trim();

const FIXTURE_BLOCKED = `
{"type":"mission.start","prev":"GENESIS","hash":"b1"}
{"type":"lease.issue","prev":"b1","hash":"b2"}
{"type":"BLOCKED_FOR_HUMAN","cause":"outward","prev":"b2","hash":"b3"}
`.trim();

test("builds PREVIEW gate with authority_delta 0 and HHMM estate", () => {
  const { records, parse_errors } = parseChainText(FIXTURE_TERMINAL);
  const gate = buildAutopoieticTraceGate({
    records,
    parse_errors,
    source_ref: "fixture_terminal",
  });
  assert.equal(gate.schema, AUTOPOIETIC_TRACE_GATE_SCHEMA);
  assert.equal(gate.truth_label, AUTOPOIETIC_TRACE_GATE_TRUTH_LABEL);
  assert.equal(gate.authority_delta, 0);
  assert.equal(gate.mode, "PREVIEW_ONLY");
  assert.equal(gate.classification.outcome, "TERMINAL_DONE");
  assert.equal(gate.signal_estate.length, HHMM_PHASES.length);
  assert.equal(gate.proposal.applies_system_change, false);
  assert.equal(gate.proposal.requires_consent, true);
  assert.match(gate.gate_digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(gate), true);
  // Fake short hashes: type mining ok, promotion must NOT be authoritative
  assert.equal(gate.linkage.ok, false);
  assert.equal(gate.insight_promotion.level, "ADMISSIBLE_TRACE_ONLY");
});

test("process mining ranks BLOCKED_FOR_HUMAN as top SNR on blocker chain", () => {
  const { records } = parseChainText(FIXTURE_BLOCKED);
  const mine = mineChain(records);
  assert.equal(mine.top_signal.type, "BLOCKED_FOR_HUMAN");
  assert.ok(mine.graph_of_thoughts.edges.length >= 2);
  const gate = buildAutopoieticTraceGate({ records, source_ref: "fixture_blocked" });
  assert.equal(gate.classification.outcome, "BLOCKED_FOR_HUMAN");
  assert.equal(gate.classification.dema_fde, "OUTWARD_OR_NO_ADMISSIBLE");
  assert.equal(gate.proposal.kind, "DIAGNOSE_ONLY");
});

test("apply refuses without exact consent; consent still forbids mutation", () => {
  const { records } = parseChainText(FIXTURE_TERMINAL);
  const gate = buildAutopoieticTraceGate({ records });
  const denied = applyAutopoieticProposal(gate, "GO please");
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "CONSENT_MISSING_OR_MISMATCH");
  assert.equal(denied.applied, false);

  const ack = applyAutopoieticProposal(gate, CONSENT_PHRASE);
  assert.equal(ack.ok, true);
  assert.equal(ack.applied, false);
  assert.equal(ack.system_change, false);
  assert.equal(ack.authority_delta, 0);
});

test("refuses RSI/singularity overclaims", () => {
  for (const label of [
    "RSI_LIVE",
    "SINGULARITY_LIVE",
    "RSI_PRIMORDIAL_ACTIVATION",
  ]) {
    assert.equal(refuseOverclaim(label).ok, false, label);
  }
  assert.equal(refuseOverclaim("TMPK_PREVIEW_ONLY").ok, true);
  assert.ok(FORBIDDEN_OVERCLAIMS.includes("NODE0_CLOSED"));
});

test("verify + run gate pass on fixture", () => {
  const { records, parse_errors } = parseChainText(FIXTURE_TERMINAL);
  const run = runAutopoieticTraceGateGate({ records, parse_errors });
  assert.equal(run.ok, true);
  assert.equal(verifyAutopoieticTraceGate(run.gate).ok, true);
});

test("parse errors surface as completeness fail hypothesis", () => {
  const { records, parse_errors } = parseChainText(
    '{"type":"mission.start"}\nNOT_JSON\n{"type":"terminal.done"}'
  );
  assert.equal(parse_errors, 1);
  const gate = buildAutopoieticTraceGate({ records, parse_errors });
  const h = gate.hypotheses.find((x) => x.id === "H_chain_completeness");
  assert.equal(h.status, "FAIL");
});

test("sealed fixture promotes AUTHORITATIVE only when linkage corroborates", () => {
  const r0 = sealChainRecord("GENESIS", {
    type: "mission.start",
    mission: "T",
    t_ns: 1,
  });
  const r1 = sealChainRecord(r0.hash, {
    type: "terminal.done",
    mission: "T",
    t_ns: 2,
  });
  const records = [r0, r1];
  assert.equal(verifyChainLinkage(records).ok, true);
  const gate = buildAutopoieticTraceGate({
    records,
    parse_errors: 0,
    source_ref: "sealed_fixture",
  });
  assert.equal(gate.insight_promotion.level, "AUTHORITATIVE_DIAGNOSTIC");
  assert.equal(
    gate.hypotheses.find((h) => h.id === "H_chain_linkage").status,
    "ADMISSIBLE"
  );

  const tampered = records.map((r, i) =>
    i === 1 ? { ...r, type: "terminal.done_TAMPERED" } : r
  );
  assert.equal(verifyChainLinkage(tampered).ok, false);
  const gated = buildAutopoieticTraceGate({
    records: tampered,
    source_ref: "tampered",
  });
  assert.equal(gated.insight_promotion.level, "ADMISSIBLE_TRACE_ONLY");
  assert.equal(verifyAutopoieticTraceGate(gated).ok, true);
});

test("optional: mine measured TMPK happy chain when present on disk", () => {
  const path =
    "/data/bizra/logs/tmpk-runs/happy/truth_spine/receipts/chain.jsonl";
  if (!existsSync(path)) {
    return; // NOT_RUN path — hermetic fixtures cover the contract
  }
  const text = readFileSync(path, "utf8");
  const { records, parse_errors } = parseChainText(text);
  assert.equal(parse_errors, 0);
  assert.ok(records.length >= 4);
  const gate = buildAutopoieticTraceGate({
    records,
    parse_errors,
    source_ref: path,
  });
  assert.equal(gate.classification.outcome, "TERMINAL_DONE");
  assert.equal(gate.authority_delta, 0);
  assert.equal(gate.linkage.ok, true, JSON.stringify(gate.linkage));
  assert.equal(gate.insight_promotion.level, "AUTHORITATIVE_DIAGNOSTIC");
  const v = verifyAutopoieticTraceGate(gate);
  assert.equal(v.ok, true);
});
