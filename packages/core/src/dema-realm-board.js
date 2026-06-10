// UX-1B · Dema Realm Mission Board (static TUI v0).
//
// Renders the 6-column BIZRA lifecycle Quest Board:
//   SEED · PREFLIGHT · FORGE · VERIFY · CLOSEOUT · ARCHIVE
//
// Reads from `$DEMA_HOME/realm/quest-board.json` if present (operator-curated),
// else falls back to a built-in default reflecting the actual session ledger
// (the slices we've actually shipped + the ones that are next/blocked).
//
// Truth-label discipline carried over from UX-1A and the URP track:
//   status: DONE (in ARCHIVE) · ACTIVE (current FORGE) · NEXT (FORGE-ready)
//           READY (SEED) · BLOCKED (with blockers[] array)
//   truth_label: LOCAL_REALM_QUEST_BOARD     when built-in default is used
//                LOCAL_OPERATOR_QUEST_BOARD  when $DEMA_HOME/realm/quest-board.json present
//
// NO file write. NO network. NO mutation. Pure read-and-render.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export const DEMA_REALM_QUEST_BOARD_SCHEMA =
  "bizra.dema.realm_quest_board.v0.1";

export const STAGES = Object.freeze([
  "SEED",
  "PREFLIGHT",
  "FORGE",
  "VERIFY",
  "CLOSEOUT",
  "ARCHIVE",
]);

// ANSI palette (mirrors UX-1A; kept module-local so each realm slice is
// self-contained until UX-3A decides a framework or extracts a shared theme).
const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gold: "\x1b[38;2;212;175;55m",
  emerald: "\x1b[38;2;16;185;129m",
  crimson: "\x1b[38;2;239;68;68m",
  ash: "\x1b[38;2;156;163;175m",
});

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

// Built-in default quest board: the actual session ledger, honestly labeled.
// This is the self-referential beauty -- when an operator with a fresh
// DEMA_HOME types `dema realm board`, they see the real shipped state of
// the project as their starting point.
const BUILT_IN_QUESTS = Object.freeze([
  // ARCHIVE -- closed slices (sorted by ship order)
  {
    id: "URP-3.1A",
    title: "Local resource wallet index builder",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "URP-3.1B",
    title: "Local index writer",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "URP-3.1C",
    title: "Local index write CLI",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "URP-3.1C+",
    title: "Local index read surface (list)",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "URP-3.1C-ter",
    title: "Local index verify-by-path",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Critic",
    blockers: [],
  },
  {
    id: "URP-3.1D",
    title: "Stage 3 closeout + drift-guard probe",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Archivist",
    blockers: [],
  },
  {
    id: "URP-4.0",
    title: "Stage 4 Choose preflight",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Reasoner",
    blockers: [],
  },
  {
    id: "URP-4.1A",
    title: "Pure choose-decision kernel",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Guardian",
    blockers: [],
  },
  {
    id: "UX-1A",
    title: "Dema Realm Home static TUI",
    stage: "ARCHIVE",
    status: "DONE",
    assigned_agent: "Builder",
    blockers: [],
  },

  // FORGE -- in progress + next ready
  {
    id: "UX-1B",
    title: "Dema Realm Mission Board",
    stage: "FORGE",
    status: "ACTIVE",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "URP-4.1B",
    title: "Durable choose-receipt writer",
    stage: "FORGE",
    status: "NEXT",
    assigned_agent: "Builder",
    blockers: [],
  },

  // SEED -- declared, not yet brainstormed in depth
  {
    id: "UX-1C",
    title: "Checkpoint Journal",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Archivist",
    blockers: ["needs UX-2B persistence design"],
  },
  {
    id: "UX-1D",
    title: "Council Chamber (5 character cards)",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Builder",
    blockers: ["needs agent runtime declarations"],
  },
  {
    id: "UX-2A",
    title: "Live status wiring (Realm widgets from existing commands)",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Builder",
    blockers: [],
  },
  {
    id: "UX-2B",
    title: "Local task/session JSON persistence",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Archivist",
    blockers: [],
  },
  {
    id: "UX-2C",
    title: "Mission dependencies and blockers",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Guardian",
    blockers: ["needs UX-2B"],
  },
  {
    id: "UX-3A",
    title: "Framework decision (Textual/BubbleTea/Ratatui or stay stdlib)",
    stage: "SEED",
    status: "READY",
    assigned_agent: "Reasoner",
    blockers: ["deferred to last per Mumu's roadmap"],
  },

  // PREFLIGHT -- nothing yet
  // VERIFY  -- nothing yet (URP-4.1B will move here after CI verifies)
  // CLOSEOUT -- nothing yet (URP-4.1D will land here at Stage 4 close)
]);

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function validateQuest(q) {
  return (
    q &&
    typeof q === "object" &&
    typeof q.id === "string" &&
    typeof q.title === "string" &&
    STAGES.includes(q.stage) &&
    typeof q.status === "string"
  );
}

export async function gatherDemaRealmBoard({
  demaHome,
  now = new Date(),
} = {}) {
  const home = demaHome || process.env.DEMA_HOME || join(homedir(), ".dema");
  const boardPath = join(home, "realm", "quest-board.json");

  const overrideRaw = await readJsonOrNull(boardPath);
  let quests;
  let source;
  let truthLabel;

  if (
    overrideRaw &&
    Array.isArray(overrideRaw.quests) &&
    overrideRaw.quests.every(validateQuest)
  ) {
    quests = overrideRaw.quests.map((q) =>
      Object.freeze({
        id: q.id,
        title: q.title,
        stage: q.stage,
        status: q.status,
        assigned_agent: q.assigned_agent ?? null,
        blockers: Object.freeze(
          Array.isArray(q.blockers) ? [...q.blockers] : [],
        ),
      }),
    );
    source = "OPERATOR_LOCAL_FILE";
    truthLabel = "LOCAL_OPERATOR_QUEST_BOARD";
  } else {
    quests = BUILT_IN_QUESTS.map((q) =>
      Object.freeze({ ...q, blockers: Object.freeze([...q.blockers]) }),
    );
    source = "BUILT_IN_SESSION_LEDGER";
    truthLabel = "LOCAL_REALM_QUEST_BOARD";
  }

  // Bucket by stage (preserve quest order within each stage)
  const buckets = {};
  for (const s of STAGES) buckets[s] = [];
  for (const q of quests) buckets[q.stage].push(q);

  const stageCounts = {};
  for (const s of STAGES) stageCounts[s] = buckets[s].length;

  return Object.freeze({
    schema: DEMA_REALM_QUEST_BOARD_SCHEMA,
    truth_label: truthLabel,
    rendered_at_iso: now.toISOString(),
    dema_home: home,
    source,
    board_path: boardPath,
    stages: STAGES,
    stage_counts: Object.freeze(stageCounts),
    quests: Object.freeze(quests),
    buckets: Object.freeze(
      Object.fromEntries(STAGES.map((s) => [s, Object.freeze(buckets[s])])),
    ),
    boundary: Object.freeze({
      file_write_performed: false,
      network_used: false,
      federation_used: false,
      share_decision_made: false,
      poi_score_calculated: false,
      token_minted: false,
      economic_claim_made: false,
      private_key_loaded: false,
      raw_artifact_included: false,
      mutation_performed: false,
    }),
  });
}

function statusColor(status) {
  if (status === "DONE") return ANSI.emerald;
  if (status === "ACTIVE") return ANSI.gold + ANSI.bold;
  if (status === "NEXT") return ANSI.gold;
  if (status === "READY") return ANSI.ash;
  if (status === "BLOCKED") return ANSI.crimson;
  return ANSI.ash;
}

function renderQuestLine(q, useColor) {
  const id = color(q.id.padEnd(13), ANSI.gold, useColor);
  const status = color(q.status, statusColor(q.status), useColor);
  const blockerHint =
    q.blockers && q.blockers.length > 0
      ? color(
          ` · blocked: ${q.blockers.join("; ")}`,
          ANSI.crimson + ANSI.dim,
          useColor,
        )
      : "";
  const agent = q.assigned_agent
    ? color(` [${q.assigned_agent}]`, ANSI.ash + ANSI.dim, useColor)
    : "";
  return `  ${id} ${status.padEnd(8)}  ${q.title}${agent}${blockerHint}`;
}

export function renderDemaRealmBoard(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · MISSION BOARD", ANSI.gold + ANSI.bold, useColor),
    color(
      `source: ${state.source}  ·  ${state.quests.length} quests across 6 stages`,
      ANSI.dim + ANSI.ash,
      useColor,
    ),
    "",
  ];

  // ULTRA-MICRO REALM PARTY ROSTER (peak SNR integration of vision + giants)
  // Stands on: AgentCraft (WoW/RTS "units on map" for agent orchestration to fight cognitive overload),
  // Hermes (rich grouped TUI with presence + streaming), Agent Zero (visible process groups + "world" canvas),
  // OpenClaw (multi-agent team "hatch"/presence in TUI), current board (assigned_agent) + council (declared profiles).
  // Embodies user vision: "Agent Party" table, "Majlis/Shura", "who walks with me", human-centric "walk through intelligence system".
  // One-line "thought packet" style status (structured, not raw CoT). No runtime. Declared-only.
  // HHMM echo: stages as hidden states; party "diffuses" across FORGE→VERIFY. Graph: assigned agents as nodes on quest map.
  // Islamic: Mufti-Advisor (Shariah declared) standing companion for ethical flows (per Mudarabah/Musharakah vision).
  // Micro: pure, reuses ANSI, <20 lines, no new files, no side effects, boundary-honest.
  const partyLines = renderActivePartyRoster(state, useColor);
  if (partyLines.length) {
    lines.push(...partyLines);
    lines.push("");
  }

  for (const stage of STAGES) {
    const bucket = state.buckets[stage];
    const count = bucket.length;
    const header = `${stage}  (${count})`;
    lines.push(color(header, ANSI.gold + ANSI.bold, useColor));
    if (count === 0) {
      lines.push(color("  —", ANSI.ash, useColor));
    } else {
      for (const q of bucket) {
        lines.push(renderQuestLine(q, useColor));
      }
    }
    lines.push("");
  }

  lines.push(
    color(
      `truth: ${state.truth_label}  ·  ${state.source === "BUILT_IN_SESSION_LEDGER" ? "(override via " + state.board_path + ")" : "(operator-curated)"}`,
      ANSI.dim + ANSI.ash,
      useColor,
    ),
  );

  return lines.join("\n");
}

// Peak ultra-micro helper: extracts active companions from assigned_agent + vision roles.
// Human-centric: shows "who is walking with you" for the current FORGE mission.
// WoW/AgentCraft flavor: "PARTY ROSTER" like RTS units. Majlis flavor: deliberation status.
function renderActivePartyRoster(state, useColor) {
  const active = (state.quests || []).filter(
    (q) => q.stage !== "ARCHIVE" && q.assigned_agent,
  );
  if (active.length === 0) return [];

  const unique = [...new Set(active.map((q) => q.assigned_agent))];
  // Map to vision roles (polymath analogical: Builder=Builder, Guardian=Guardian, add Mufti for Shariah per Islamic primitives).
  const roles = unique.map((a) => {
    if (a === "Builder") return "Builder (Code/Implementation)";
    if (a === "Guardian") return "Guardian (Boundary/Consent)";
    if (a === "Reasoner") return "Reasoner (SAPE/Graph)";
    if (a === "Critic") return "Critic (Self-review)";
    if (a === "Archivist") return "Archivist (Memory/Proof)";
    return a;
  });
  // Standing Mufti-Advisor (Shariah declared) per vision "Mufti-Advisor" class + finance quests (e.g. tokenomics in ledger).
  if (!roles.some((r) => r.includes("Mufti"))) {
    roles.push("Mufti-Advisor (Shariah declared)");
  }

  const roster = roles.join(" | ");
  const status = color(
    " · deliberation (Shura/Majlis active — thought packets flowing)",
    ANSI.ash + ANSI.dim,
    useColor,
  );

  return [
    color(
      "ACTIVE PARTY / MAJLIS (Realm vision · WoW units + Hermes presence)",
      ANSI.gold,
      useColor,
    ),
    `  ${roster}${status}`,
  ];
}
