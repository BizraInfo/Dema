// DEMA-RECOVERY-MISSION-GATHERER-1B — CLI adapter (orchestration only).
//
// Wires an injected read-only metadata gatherer (`gatherFiles` — the real
// implementation is apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js,
// the only fs surface for this slice) into the pure
// dema-recovery-mission-gatherer.js kernel and returns the candidate preview
// envelope. No fs/network import lives in this file — `gatherFiles` is always
// caller-injected, so this stays out of the kernel-purity scan by
// construction, not by allowlist. argv parsing and console output live in the
// CLI command file (apps/cli/src/commands/recovery.js), not here.
//
// READ-ONLY, no mutation, NO auto-selection: this previews candidates only —
// human revival is a separate governed step (dema-recovery-mission-engine.js
// HUMAN_REVIVAL event), out of scope for 1B.

import {
  runDemaRecoveryMissionGatherer,
  DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE,
  DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
  DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
} from "./dema-recovery-mission-gatherer.js";

export function runDemaRecoveryMissionPreview({
  consent,
  root,
  mission,
  exclude = [],
  maxFiles = 5000,
  nowIso,
  gatherFiles,
} = {}) {
  if (typeof gatherFiles !== "function") {
    return Object.freeze({
      ok: false,
      schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
      truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
      blocked_by: Object.freeze(["gather_files_not_injected"]),
    });
  }
  let files;
  try {
    files = gatherFiles({ root, exclude, maxFiles });
  } catch (err) {
    return Object.freeze({
      ok: false,
      schema: DEMA_RECOVERY_MISSION_GATHERER_SCHEMA,
      truth_label: DEMA_RECOVERY_MISSION_GATHERER_TRUTH_LABEL,
      blocked_by: Object.freeze([err && err.code === "max_files_exceeded" ? "max_files_exceeded" : "gather_failed"]),
    });
  }
  const input = {
    objective_text: mission,
    source_boundary: { roots: typeof root === "string" ? [root] : [], exclusions: [...exclude] },
    now_iso: nowIso,
    files,
    max_files: maxFiles,
  };
  return runDemaRecoveryMissionGatherer({ consent, input });
}

export function formatDemaRecoveryMissionPreviewText(result) {
  const lines = [];
  lines.push(`Dema recovery mission preview (${result.truth_label ?? "?"})`);
  lines.push(`  result: ${result.ok ? "PASS" : "FAIL"}`);
  if (!result.ok) {
    for (const code of result.blocked_by ?? []) lines.push(`    ${code}`);
    return lines.join("\n");
  }
  lines.push(`  candidates: ${result.candidates.length} (cap 7)`);
  for (const c of result.candidates) {
    lines.push(`    #${c.rank} ${c.asset_id} — ${c.limitations}`);
  }
  lines.push(`  not_accessed: ${result.not_accessed_report.length}`);
  lines.push(`  boundary all-false: ${Object.values(result.boundary).every((v) => v === false)}`);
  lines.push(`  content_hash: ${result.content_hash ? `${result.content_hash.slice(0, 16)}…` : "-"}`);
  lines.push("  READ-ONLY preview. No auto-selection — human revival is a separate governed step (not in 1B).");
  return lines.join("\n");
}

export { DEMA_RECOVERY_MISSION_GATHERER_GO_PHRASE };
