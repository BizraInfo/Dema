#!/usr/bin/env node
/**
 * Emit one experience-handoff card as a HISTORICAL snapshot of a prior session
 * (fixed SHAs below). Preview-only; does not mutate DEMA_HOME; does not claim
 * to re-measure the live HEAD.
 */
import {
  buildExperienceHandoffCard,
  formatExperienceHandoffCard,
} from "../../packages/core/src/dema-experience-handoff.js";

const wantJson = process.argv.includes("--json");

const card = buildExperienceHandoffCard({
  session_id: "slice-health-snapshot-bridge-1a-goal-20261101",
  base_sha: "f9726b6b82e3048f0091601128754b10f3bfbe03",
  head_sha: "aa517a8bb2c94cf6bfb0ce582bb168ae8df3ae68",
  new_behavior: {
    label: "ax_liftoff_plus_t0_focused",
    passed: 6,
    failed: 0,
    total: 6,
  },
  regression: {
    label: "prior_endurance_docs_integration_proxy",
    passed: null,
    failed: null,
    total: null,
  },
  structural_changes: [
    "dema-ax-liftoff.js (FLOW/NEEDS_YOU strip)",
    "dema-experience-handoff.js (refinery card)",
    "TASK-094 first-look season_ambiguous candidates",
    "T0 soak_runtime + sprint soak pulse",
  ],
  cost_usd: null,
  observed_facts: [
    "PR #512 pushed to aa517a8b; soak-72h-20261101-2314 running CLEAN freeze drift 0",
    "remote_write findings 36→5 after measurement window; residual avahi+tailscaled need sudo",
    "Dema-clean dirty node0-run/health-snapshot are FREEZE PIN bytes (da2e16d9), not safeguard removal",
    "four seasons verified OK; season_ambiguous correctly refuses auto-select",
  ],
  inferences: [
    "Autopilot misread freeze-pin as regression because working tree differs from HEAD hardenings",
    "Strict vs Core lesson: feature-only green is not whole-task success",
  ],
  untested_advice: [
    "Rerun full prior regression before merge",
    "Do not promote HHMM/RAG until repeated independent trials",
  ],
  open_questions: [
    "Which season ID should continue?",
    "Will sudo stop of avahi+tailscaled yield NO_EXTERNAL_WRITE_PATH (fe80:546 may remain)?",
  ],
});

if (wantJson) {
  console.log(JSON.stringify({
    preview_only: true,
    historical_snapshot: true,
    note: "Fixed SHAs below are a past session receipt, not a live HEAD re-measure.",
    card,
  }, null, 2));
} else {
  console.log("HISTORICAL SNAPSHOT (not live HEAD)");
  console.log(formatExperienceHandoffCard(card));
}
process.exitCode = card.ok ? 0 : 1;
