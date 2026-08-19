// DEMA-FOUNDER-RELIEF-CANDIDATE-REPAIR-0F — turns a detected finding into a
// candidate repair the operator can authorize with a lease. It builds a repair
// TASK, runs it through the capsule with NO lease, and confirms it lands
// WAITING_SOVEREIGN with the executor NEVER called — so the morning briefing can
// say "1 candidate repair identified, needs your lease grant to auto-fix" rather
// than silently fixing (or silently ignoring) real work. PURE — no io.
//
// This is the bridge from OBSERVE (0B shifts find things) to REMOVE-WORK (0E
// capsule fixes things): a finding becomes a bounded, authority-gated proposal.

import { createTask } from "./dema-task-lifecycle.js";
import { runRepairCapsule } from "./dema-repair-capsule.js";

export const CANDIDATE_REPAIR_SCHEMA = "bizra.dema.candidate_repair.v0.1";

// finding.kind -> the bounded capability + effect a repair would require
const FINDING_CAPABILITY = Object.freeze({
  whitespace: { capability_id: "repo.patch_bounded", effect_class: "reversible_local" },
  trailing_newline: { capability_id: "repo.patch_bounded", effect_class: "reversible_local" },
});

export function buildCandidateRepair(finding, { now = null } = {}) {
  if (!finding || typeof finding !== "object" || typeof finding.kind !== "string") {
    return Object.freeze({ error: "finding_malformed" });
  }
  const map = FINDING_CAPABILITY[finding.kind];
  if (!map) return Object.freeze({ error: `unknown_finding_kind:${finding.kind}` });
  const scope = typeof finding.scope === "string" ? finding.scope : null;
  const task = createTask({
    task_id: `repair:${finding.kind}:${scope || "?"}`,
    mission_id: finding.mission_id || null,
    recurrence_policy: { kind: "once" },
    now,
  });
  return Object.freeze({ task, capability_id: map.capability_id, effect_class: map.effect_class, scope });
}

/**
 * Surface candidate repairs from findings. Each is run through the capsule with
 * NO standing lease, so it lands WAITING_SOVEREIGN and the injected executor is
 * never called. Returns the candidates + the exact lease each would need.
 */
export function surfaceCandidateRepairs({ findings = [], now = null } = {}) {
  const candidates = [];
  const tasks = []; // the driven task objects, for durable persistence in the mission store
  const refused = [];
  for (const f of Array.isArray(findings) ? findings : []) {
    const c = buildCandidateRepair(f, { now });
    if (c.error) { refused.push(Object.freeze({ finding: f && f.kind, reason: c.error })); continue; }
    const r = runRepairCapsule({
      task: c.task,
      authority: {
        effect_class: c.effect_class, capability_id: c.capability_id, exact_scope: c.scope,
        standing_lease: null, measured_blast_radius: (f && f.blast) || null, machine_state: { ready: true },
      },
      reversible_plan: null,
      // a lease-less candidate must NEVER reach execution — throwing proves it:
      executeReversible: () => { throw new Error("must_not_execute_without_lease"); },
      verifyReceipt: () => ({ ok: true }),
      now,
    });
    candidates.push(Object.freeze({
      task_id: c.task.task_id, capability_id: c.capability_id, scope: c.scope,
      state: r.task.state, verdict: r.verdict.verdict, reason: r.verdict.reason,
      needed_lease: Object.freeze({ capability_id: c.capability_id, scope: c.scope, effect_class: c.effect_class }),
    }));
    tasks.push(r.task); // WAITING_SOVEREIGN task, valid for mission-store upsert
  }
  return Object.freeze({
    schema: CANDIDATE_REPAIR_SCHEMA,
    candidates: Object.freeze(candidates),
    tasks: Object.freeze(tasks),
    refused: Object.freeze(refused),
    needs_lease_count: candidates.filter((x) => x.state === "WAITING_SOVEREIGN").length,
    authority_delta: 0,
  });
}
