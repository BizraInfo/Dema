// DEMA-FOUNDER-RELIEF-LOOP-0B (v0.2 — capability-typed). The tick-runner turns
// the Safe Work Queue into receipted A0 work. AUTHORITY NOW DERIVES FROM THE
// CAPABILITY REGISTRY, not a caller-supplied label: each queue unit names a
// registered `op` (+ validated args); the runner resolves it to an argv the
// caller never chose and to a DECLARED effect. A caller cannot smuggle a
// mutating command — there is no command input. Dangerous acts (git.push,
// authorship migration) are simply not registered, so they resolve to
// `unknown_operation` and are refused, never run.
//
// The command executor is INJECTED (`runOp(file, argv)`) so orchestration is
// pure and unit-tested off-host; the real wrapper passes a spawn(shell:false)
// runner. A0 (read_only subject_effect) runs unattended; reversible_local (A1)
// defers to the gated worktree loop (0C); anything else queues for the sovereign.

import { createHash } from "node:crypto";
import { resolveOperation } from "./dema-relief-capabilities.js";
import { buildReliefBriefing } from "./dema-founder-relief-loop.js";

export const RELIEF_RECEIPT_SCHEMA = "bizra.dema.founder_relief_work_receipt.v0.2";

const sha256 = (s) => `sha256:${createHash("sha256").update(String(s)).digest("hex")}`;

// effect (from the registry) -> unattended disposition. This is the FLOOR; the
// capability-lease layer (scope + standing authority + blast radius) refines it.
function dispositionFor(subject_effect) {
  if (subject_effect === "read_only") return { disposition: "AUTONOMOUS", authority: "A0" };
  if (subject_effect === "reversible_local") return { disposition: "AUTONOMOUS_BOUNDED", authority: "A1" };
  return { disposition: "QUEUE_SOVEREIGN", authority: "A2" };
}

/** Pure: build a receipt for one executed A0 op, binding BOTH effect surfaces. */
export function buildWorkReceipt({ unit, resolved, result, now = null }) {
  const out = (result && (result.stdout ?? "")) + ((result && result.stderr) || "");
  const code = result && Number.isFinite(result.code) ? result.code : null;
  return Object.freeze({
    schema: RELIEF_RECEIPT_SCHEMA,
    unit_id: (unit && unit.id) || resolved.op,
    op: resolved.op,
    argv: resolved.argv,
    subject_effect: resolved.subject_effect,
    control_plane_effect: resolved.control_plane_effect,
    authority: "A0",
    exit_code: code,
    ok: code === 0,
    observation_sha256: sha256(out),
    output_bytes: out.length,
    at: typeof now === "string" ? now : null,
    authority_delta: 0,
  });
}

/**
 * Run one relief shift over a Safe Work Queue of typed ops. Resolves each unit's
 * op through the registry; executes only A0; queues A1/A2; refuses unknown/invalid.
 * `runOp(file, argv) -> { code, stdout, stderr }` is injected (real: shell:false).
 */
export function runReliefShift({ queue = [], runOp, now = null } = {}) {
  if (typeof runOp !== "function") {
    return Object.freeze({ schema: RELIEF_RECEIPT_SCHEMA, error: "run_op_required", authority_delta: 0 });
  }
  const items = Array.isArray(queue) ? queue : [];
  const completed = [];
  const failed_safely = [];
  const sovereign_queue = [];
  const refused = [];
  for (const unit of items) {
    const id = (unit && unit.id) || (unit && unit.op) || "unit";
    const resolved = resolveOperation(unit && unit.op, unit && unit.args);
    if (resolved.error) {
      // unknown/malformed/invalid op — includes every UNregistered dangerous act
      refused.push(Object.freeze({ unit_id: id, op: (unit && unit.op) || null, reason: resolved.error }));
      continue;
    }
    const d = dispositionFor(resolved.subject_effect);
    if (d.authority === "A0") {
      let result;
      try { result = runOp(resolved.file, resolved.argv); }
      catch (e) { result = { code: null, stdout: "", stderr: String((e && e.message) || e) }; }
      const receipt = buildWorkReceipt({ unit, resolved, result, now });
      (receipt.ok ? completed : failed_safely).push(receipt);
    } else if (d.authority === "A1") {
      sovereign_queue.push(Object.freeze({ id, op: resolved.op, authority: "A1", reason: "a1_deferred_to_gated_worktree_loop" }));
    } else {
      sovereign_queue.push(Object.freeze({ id, op: resolved.op, authority: "A2", reason: `sovereign_subject_effect:${resolved.subject_effect}` }));
    }
  }
  const briefing = buildReliefBriefing({ completed, failed_safely, sovereign_queue, now });
  return Object.freeze({
    schema: RELIEF_RECEIPT_SCHEMA,
    completed: Object.freeze(completed),
    failed_safely: Object.freeze(failed_safely),
    sovereign_queue: Object.freeze(sovereign_queue),
    refused: Object.freeze(refused),
    briefing,
    authority_delta: 0,
  });
}
