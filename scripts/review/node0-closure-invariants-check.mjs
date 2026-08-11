#!/usr/bin/env node
// NODE0-CLOSURE-INVARIANTS-1A — review gate.
//
// WHAT THIS GATE ASSERTS. That the closure ledger is internally sound and that
// it reports its own state honestly. It does NOT assert that Node0 is closed —
// a gate that failed while closure was OPEN would be a gate demanding a lie.
//
// So the pass condition is the TRUTH surface, not the ACTION surface:
//   1. the ten are exactly the ten, in order;
//   2. the verdict re-derives from the rows (positive control);
//   3. a forged CLOSED report is refused (negative control) — without this,
//      step 2 would pass against a verifier that only ever says ok;
//   4. the published ledger state is printed, so `npm run check` shows the
//      operator how many invariants are actually settled and by what.
//
// Reads nothing, writes nothing, invokes no model, opens no socket.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluateNode0ClosureInvariants,
  verifyClosureVerdict,
  CLOSURE_INVARIANTS,
  INVARIANT_IDS,
  INVARIANT_STATUS,
  NODE0_CLOSURE_INVARIANTS_SCHEMA,
  NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL,
} from "../../packages/core/src/node0-closure-invariants.js";
import {
  acceptanceModelBlindObservation,
  ACCEPTANCE_MODEL_BLIND_INVARIANT_ID,
} from "../../packages/core/src/node0-acceptance-model-blind-adapter.js";
import { buildNode0ModelSwapInvariancePayload } from "../../packages/core/src/node0-model-swap-invariance.js";
import {
  workerHandoffObservation,
  workerHandoffDiagnostic,
  WORKER_HANDOFF_INVARIANT_ID,
} from "../../packages/core/src/node0-worker-handoff-adapter.js";
import {
  missionPrimaryStateObservation,
  contractImmutabilityObservation,
  runtimeMissionDiagnostic,
  verifierIndependenceObservation,
  cycleAuthorityDeltaObservation,
  STATE_OWNERSHIP_INVARIANT_ID,
  CONTRACT_IMMUTABILITY_INVARIANT_ID,
  VERIFIER_INDEPENDENCE_INVARIANT_ID,
  CYCLE_AUTHORITY_DELTA_INVARIANT_ID,
} from "../../packages/core/src/node0-runtime-mission-adapter.js";
import {
  recoveryAfterWorkerExitObservation,
  recoveryDiagnostic,
  RECOVERY_INVARIANT_ID,
} from "../../packages/core/src/node0-recovery-adapter.js";
import {
  transitionCoverageObservation,
  transitionCoverageDiagnostic,
  TRANSITION_COVERAGE_INVARIANT_ID,
} from "../../packages/core/src/node0-transition-coverage-adapter.js";
import {
  HISTORY_REPLAY_INVARIANT_ID,
  fullHistoryReplayableObservation,
  historyReplayDiagnostic,
} from "../../packages/core/src/node0-history-replay-adapter.js";

/// The probe task the acceptance adapter judges. It is a FIXTURE and says so in
/// its own `task_id`, which the attestation's content hash covers — so anyone
/// reading the published source string can see the observation came from this
/// gate exercising the shipped acceptance function, not from production traffic.
/// Two distinct models, one passing output and one failing one, under a contract
/// that actually imposes predicates: without a real swap and a non-vacuous
/// contract, model-independence holds vacuously and proves nothing.
const ACCEPTANCE_PROBE = Object.freeze({
  task: Object.freeze({
    task_id: "review-gate-acceptance-model-blindness-probe",
    acceptance_contract: Object.freeze({
      required_output_keys: ["answer"],
      forbidden_substrings: ["I cannot"],
      expected: Object.freeze({ answer: 42 }),
    }),
  }),
  candidates: Object.freeze([
    Object.freeze({ model_id: "probe-model-a", output: Object.freeze({ answer: 42 }) }),
    Object.freeze({ model_id: "probe-model-b", output: Object.freeze({ answer: 41 }) }),
  ]),
  // Carry everything: the adapter only accepts an attestation whose verifier
  // independently RE-RAN the acceptance decision, which requires the contract
  // and every output to travel.
  transport: Object.freeze({ carry_contract: true, carry_outputs: true }),
});

/// Every adapter the tree currently ships for a closure invariant. Eight of the
/// ten are absent because no instrument exists: five of those describe a RUNNING
/// LOOP observed across a worker exit, and `remote_write` has an instrument whose
/// scope review demoted it to `null`. An adapter registers here and the ledger
/// moves; nothing else does.
///
/// The two registered adapters answer in different ways, and the difference is
/// the point. `acceptance_is_model_blind` MEASURES here, because it is a pure
/// function and this gate can call it. `worker_is_replaceable` cannot be measured
/// by anything that does not kill a process, so its adapter READS a recorded
/// artefact instead — the execution happened in a producer and is disclosed in
/// the artefact, which is how the gate keeps `execution_allowed: false` honest
/// while still being able to learn the answer. With no producer run yet it
/// returns `null`, and the row stays UNKNOWN.
export const CLOSURE_EVIDENCE_ADAPTERS = Object.freeze([
  Object.freeze({
    invariant_id: ACCEPTANCE_MODEL_BLIND_INVARIANT_ID,
    observe: () =>
      acceptanceModelBlindObservation(
        buildNode0ModelSwapInvariancePayload(ACCEPTANCE_PROBE),
      ),
  }),
  Object.freeze({
    invariant_id: WORKER_HANDOFF_INVARIANT_ID,
    observe: () => workerHandoffObservation(),
    // Reason-only channel; see gatherAdapterDiagnostics. Never consulted by the
    // evaluator, so it cannot settle this row however it answers.
    diagnose: () => workerHandoffDiagnostic(),
  }),
  // NODE0-RUNTIME-MISSION-OBSERVATION-1A. ONE artefact, TWO independently judged
  // rows: an artefact can honestly prove state ownership and fail contract
  // immutability, so each adapter re-reads and re-judges rather than sharing a
  // verdict. Both emit only when the recorded run was OBSERVED, hash-verified,
  // and judged by the kernel bytes currently on disk.
  Object.freeze({
    invariant_id: STATE_OWNERSHIP_INVARIANT_ID,
    observe: () => missionPrimaryStateObservation(),
    diagnose: () => runtimeMissionDiagnostic(),
  }),
  Object.freeze({
    invariant_id: CONTRACT_IMMUTABILITY_INVARIANT_ID,
    observe: () => contractImmutabilityObservation(),
    diagnose: () => runtimeMissionDiagnostic(),
  }),
  Object.freeze({
    invariant_id: VERIFIER_INDEPENDENCE_INVARIANT_ID,
    observe: () => verifierIndependenceObservation(),
    diagnose: () => runtimeMissionDiagnostic(),
  }),
  Object.freeze({
    invariant_id: CYCLE_AUTHORITY_DELTA_INVARIANT_ID,
    observe: () => cycleAuthorityDeltaObservation(),
    diagnose: () => runtimeMissionDiagnostic(),
  }),
  // NODE0-RECOVERY-OBSERVATION-1A. Its own artefact, because the evidence comes
  // from a different experiment: a supervisor behind the governed Node0 boundary
  // that was never told about the kill. The observation is supplied by an
  // INDEPENDENT observer process, never by the supervisor that conducted it.
  Object.freeze({
    invariant_id: RECOVERY_INVARIANT_ID,
    observe: () => recoveryAfterWorkerExitObservation(),
    diagnose: () => recoveryDiagnostic(),
  }),
  // NODE0-TRANSITION-COVERAGE-1A. The FIRST adapter that can emit a refutation:
  // `observed:false` against `required:true` scores VIOLATED, not UNKNOWN. It
  // emits nothing unless the recorded verdict actually carries an observed value,
  // so an incomplete registry contributes silence rather than a false negative.
  Object.freeze({
    invariant_id: TRANSITION_COVERAGE_INVARIANT_ID,
    observe: () => transitionCoverageObservation(),
    diagnose: () => transitionCoverageDiagnostic(),
  }),
  // NODE0-HISTORY-REPLAY-1A. Its own artefact, because the evidence is the one
  // thing an in-process check can never supply: a reconstruction performed by an
  // interpreter that never saw the history being written. The producer spends its
  // own process to make that true, and records whether four specific corruptions
  // were REFUSED - a replayer that accepts a forgery is refuted, not merely
  // unproven, so this adapter can emit `observed:false` as well as silence.
  Object.freeze({
    invariant_id: HISTORY_REPLAY_INVARIANT_ID,
    observe: () => fullHistoryReplayableObservation(),
    diagnose: () => historyReplayDiagnostic(),
  }),
]);

/// Gathers whatever the registered adapters can honestly observe. An adapter
/// returning null contributes nothing — silence, which the kernel scores as
/// UNKNOWN, never as satisfaction.
export function gatherClosureEvidence(adapters = CLOSURE_EVIDENCE_ADAPTERS) {
  const evidence = {};
  for (const adapter of adapters) {
    const observation = adapter.observe();
    if (observation !== null && observation !== undefined) {
      evidence[adapter.invariant_id] = observation;
    }
  }
  return evidence;
}

/// Why each registered adapter fell silent.
///
/// An adapter returning null is correct behaviour, but seven different refusals
/// used to produce one identical silence — so "nobody ran the producer" and
/// "someone edited the artefact" rendered the same. This asks each adapter that
/// offers a `diagnose()` for its reason.
///
/// These are REASONS, never evidence. They are reported beside the ledger and
/// are structurally incapable of settling a row: `gatherClosureEvidence` above
/// is the only path into the evaluator, and it never reads this.
export function gatherAdapterDiagnostics(adapters = CLOSURE_EVIDENCE_ADAPTERS) {
  const out = [];
  for (const adapter of adapters) {
    if (typeof adapter.diagnose !== "function") continue;
    const d = adapter.diagnose();
    if (!d || typeof d !== "object") continue;
    out.push(
      Object.freeze({
        invariant_id: adapter.invariant_id,
        state: typeof d.state === "string" ? d.state : "UNKNOWN",
        integrity_suspect: d.integrity_suspect === true,
      }),
    );
  }
  return Object.freeze(out);
}

/// THE ONE file permitted to emit a node-scope closure flag. Everything else may
/// READ it; nothing else may PRODUCE it.
export const CLOSURE_AUTHORITY_OWNER =
  "packages/core/src/node0-closure-invariants.js";

/// Closure-SHAPED verdicts that are deliberately NOT node closure. Each carries
/// its own schema and its own scope, so none of them can be mistaken for the
/// node's closure decision — that separation is the thing this gate protects.
export const SUBORDINATE_CLOSURE_SCHEMAS = Object.freeze([
  "bizra.dema.mission_corridor_closure.v0.1",
  "bizra.dema.node0_local_closure_readiness.v0.1",
  "bizra.dema.omega0_mechanical_closure.v0.1",
]);

/// Emission, not mention. `node0_closed:` is an object key being PRODUCED;
/// `report.node0_closed` is a consumer READING the owner's verdict, which is
/// exactly what subordinate surfaces are supposed to do. A gate that failed on
/// mention would forbid reading the ledger at all.
const EMITS_NODE_SCOPE_CLOSURE = /(^|[^.\w])node0_closed\s*:/;

const SCAN_ROOTS = ["packages", "apps"];
const SKIP_DIR = /(^|\/)(node_modules|\.git|coverage|dist)(\/|$)/;

function* sourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (SKIP_DIR.test(full)) continue;
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(js|mjs|cjs|ts|tsx)$/.test(entry.name)) yield full;
  }
}

/// Fail-closed: an unreadable file is a finding, never a silent skip. A scan
/// that quietly dropped a file would report "single owner" from a partial look —
/// the exact shape TASK-060 was created to refuse.
export function findClosureAuthorityProducers(roots = SCAN_ROOTS) {
  const producers = [];
  const unreadable = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      let source;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        unreadable.push(file);
        continue;
      }
      if (EMITS_NODE_SCOPE_CLOSURE.test(source)) producers.push(file);
    }
  }
  return { producers: producers.sort(), unreadable: unreadable.sort() };
}

export function runNode0ClosureInvariantsCheck() {
  const blocked_by = [];

  // 0. SEMANTIC closure ownership, not lexical. Measured 2026-08-09: four
  //    closure-SHAPED verdict producers exist (corridor, local-readiness,
  //    omega0, invariants), each with its own schema and scope, and only the
  //    invariant ledger emits a node-scope flag. If a second surface ever
  //    starts producing one, two independent paths could proclaim the node
  //    closed and the ledger stops being the authority.
  const authority = findClosureAuthorityProducers();
  if (authority.unreadable.length > 0) blocked_by.push("closure_scan_incomplete");
  const foreign = authority.producers.filter((p) => p !== CLOSURE_AUTHORITY_OWNER);
  if (foreign.length > 0) blocked_by.push(`parallel_closure_authority:${foreign.join(",")}`);
  if (!authority.producers.includes(CLOSURE_AUTHORITY_OWNER)) {
    // Positive control: if the owner itself stopped emitting, the scan is broken
    // and its "no foreign producer" result would be vacuously clean.
    blocked_by.push("closure_owner_emits_nothing");
  }

  // 1. The set is the set.
  if (CLOSURE_INVARIANTS.length !== 10) blocked_by.push("invariant_count_not_ten");
  if (CLOSURE_INVARIANTS.some((i) => typeof i.required_scope !== "string" || !i.required_scope)) {
    blocked_by.push("invariant_missing_required_scope");
  }

  // 2. Positive control — the verifier can say ok, over a fully evidenced set.
  const fullySatisfied = {};
  for (const inv of CLOSURE_INVARIANTS) {
    fullySatisfied[inv.id] = {
      observed: inv.required,
      source: "review-gate-positive-control",
      scope: inv.required_scope,
    };
  }
  const controlReport = evaluateNode0ClosureInvariants(fullySatisfied);
  if (controlReport.verdict !== "CLOSED") blocked_by.push("positive_control_not_closed");
  if (verifyClosureVerdict(controlReport).ok !== true) {
    blocked_by.push("positive_control_not_verifiable");
  }

  // 3. Negative control — a forged CLOSED verdict over empty evidence is refused.
  const openReport = evaluateNode0ClosureInvariants({});
  const forged = { ...openReport, node0_closed: true, verdict: "CLOSED" };
  if (verifyClosureVerdict(forged).ok !== false) blocked_by.push("forged_verdict_accepted");

  // 4. The published state, from whatever adapters exist today.
  const report = evaluateNode0ClosureInvariants(gatherClosureEvidence());
  if (verifyClosureVerdict(report).ok !== true) blocked_by.push("published_ledger_not_verifiable");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_CLOSURE_INVARIANTS_SCHEMA,
    truth_label: NODE0_CLOSURE_INVARIANTS_TRUTH_LABEL,
    adapters_registered: CLOSURE_EVIDENCE_ADAPTERS.length,
    adapter_diagnostics: gatherAdapterDiagnostics(),
    closure_authority_owner: CLOSURE_AUTHORITY_OWNER,
    closure_authority_producers: Object.freeze(authority.producers),
    subordinate_closure_schemas: SUBORDINATE_CLOSURE_SCHEMAS,
    semantic_closure_owner: foreign.length === 0 && authority.unreadable.length === 0 ? "SINGLE" : "PARALLEL_OR_UNVERIFIED",
    verdict: report.verdict,
    satisfied_count: report.satisfied_count,
    violated_count: report.violated_count,
    unknown_count: report.unknown_count,
    total: report.total,
    invariants: report.invariants.map((row) =>
      Object.freeze({ id: row.id, status: row.status, source: row.source }),
    ),
    boundary: Object.freeze({
      execution_allowed: false,
      daemon_started: false,
      network_used: false,
      token_minted: false,
      wallet_accessed: false,
      live_execution_performed: false,
      file_mutation_performed: false,
      model_invocation_performed: false,
    }),
    what_this_proves:
      "The closure ledger is internally consistent, refuses a forged CLOSED verdict, and publishes its true settled count.",
    what_this_does_not_prove:
      "Does not prove Node0 is closed, that any invariant is satisfied, or that any observation was honestly measured.",
    blocked_by: Object.freeze(blocked_by),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0ClosureInvariantsCheck();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - NODE0-CLOSURE-INVARIANTS-1A");
    console.log(`  schema: ${result.schema}`);
    console.log(`  adapters registered: ${result.adapters_registered} of ${INVARIANT_IDS.length}`);
    console.log(`  semantic closure owner: ${result.semantic_closure_owner} (${result.closure_authority_producers.length} producer(s))`);
    console.log(
      `  ledger: ${result.verdict} - ${result.satisfied_count} satisfied, ` +
        `${result.violated_count} violated, ${result.unknown_count} unknown of ${result.total}`,
    );
    for (const d of result.adapter_diagnostics) {
      if (d.state === "ACCEPTED") continue;
      const flag = d.integrity_suspect ? "!! INTEGRITY" : "   no evidence";
      console.log(`  ${flag}: ${d.invariant_id} -> ${d.state}`);
    }
    for (const row of result.invariants) {
      const mark = row.status === INVARIANT_STATUS.SATISFIED ? "+" : " ";
      console.log(`   ${mark} ${row.status.padEnd(9)} ${row.id}${row.source ? ` <- ${row.source}` : ""}`);
    }
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    console.log("  note: PASS means the ledger is sound and honest, NOT that Node0 is closed.");
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }

  if (!result.ok) process.exit(1);
}
