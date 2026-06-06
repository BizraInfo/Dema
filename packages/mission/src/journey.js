import { buildMissionDraftPreview } from "./mission-draft.js";

const SCHEMA = "bizra.dema.sovereign_journey_preview.v0.1";

const CHAPTERS = [
  {
    id: "first_launch",
    number: 0,
    title: "First launch",
    promise: "trust and safety before power",
    commands: ["dema setup", "dema ambient", "dema models"],
    outcome: "user sees what Dema can inspect and what it cannot touch",
  },
  {
    id: "mission_consent",
    number: 1,
    title: "Mission and consent",
    promise: "intent becomes a narrow ConsentPlan",
    commands: ['dema mission draft "<intent>"', 'dema consent plan "<intent>"'],
    outcome:
      "user reviews permissions, risk notes, and the preview-only boundary",
  },
  {
    id: "node0_handoff",
    number: 2,
    title: "Node0 handoff",
    promise: "governed runtime receives only committed scope",
    commands: ["dema diagnostics plan", "future: dema mission handoff --json"],
    outcome:
      "mission waits for explicit governed Node0 approval before effects",
  },
  {
    id: "receipts_impact",
    number: 3,
    title: "Receipts and impact",
    promise: "proof at the end, not vibes",
    commands: ["dema receipts", "dema report safety"],
    outcome: "user gets evidence, critique gaps, and impact-ready artifacts",
  },
];

const BOUNDARY = {
  scope: "preview-only",
  inference_invoked: false,
  approval_recorded: false,
  node0_handoff_performed: false,
  capability_minted: false,
  execution_enabled: false,
  mutation_performed: false,
  receipt_minted: false,
  impact_claimed: false,
};

export function buildSovereignJourneyPreview({
  intent,
  now = new Date(),
} = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  const missionDraft = naturalLanguage
    ? buildMissionDraftPreview({ intent: naturalLanguage, now })
    : null;

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    thesis:
      "One minimal entry point from first launch to consented mission to proof.",
    chapters: CHAPTERS,
    mission_draft: missionDraft,
    next_step: naturalLanguage
      ? "Review the mission draft, then narrow or reject every proposed permission before Node0 handoff."
      : 'Run `dema journey "<intent>"` or `dema mission draft "<intent>"` to shape a real mission.',
    boundary: BOUNDARY,
  };
}

function appendMission(lines, missionDraft) {
  if (!missionDraft) {
    lines.push("Mission preview: none yet");
    lines.push('  next: dema journey "<intent>"');
    return;
  }

  lines.push("Mission preview:");
  lines.push(`  mission_id: ${missionDraft.mission.id}`);
  lines.push(`  category: ${missionDraft.mission.category}`);
  lines.push(`  risk: ${missionDraft.mission.risk_level}`);
  lines.push(
    `  phase: ${missionDraft.mission.current_phase} -> ${missionDraft.phase_gate.next_phase}`,
  );
  lines.push("  permissions:");
  for (const permission of missionDraft.consent_plan.permissions) {
    lines.push(`    - ${permission.resource_id} ${permission.action}`);
  }
  if (missionDraft.consent_plan.permissions.length === 0) {
    lines.push("    - none detected");
  }
}

function appendChapters(lines, chapters) {
  for (const chapter of chapters) {
    lines.push("");
    lines.push(`Chapter ${chapter.number}: ${chapter.title}`);
    lines.push(`  promise: ${chapter.promise}`);
    lines.push(`  commands: ${chapter.commands.join(" | ")}`);
    lines.push(`  outcome: ${chapter.outcome}`);
  }
}

export function formatSovereignJourneyPreview(journey) {
  const lines = [
    "DEMA Sovereign Journey OS",
    "",
    `Mode: ${journey.mode}`,
    `Thesis: ${journey.thesis}`,
    "One minimal entry point: dema journey",
    "",
  ];

  appendMission(lines, journey.mission_draft);
  appendChapters(lines, journey.chapters);
  lines.push("");
  lines.push(`Next: ${journey.next_step}`);
  lines.push(
    "Boundary: preview-only; no approval; no handoff; no execution; no receipt minted.",
  );

  return lines.join("\n");
}
