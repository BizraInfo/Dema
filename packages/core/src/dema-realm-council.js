// UX-1D · Dema Realm Council Chamber (declared-only v0).
//
// Answers the operator's emotional question after UX-1A/1B/1C/2B:
//
//   "Who is with me?"
//
// Renders 5 council profiles -- Guardian, Reasoner, Builder, Critic, Archivist.
// Profiles are DECLARED, not RUNTIME-backed. Each card honestly states the role,
// doctrine, active ability, current_state, and boundary note. This is presence
// without false claims of autonomous agency.
//
// After URP-5SAT-1A launch: the 5 SAT are locked in the council if the launch receipt/state is present (always active, cannot be manipulated by PAT or Dema or Momo).
//
// NO model calls. NO autonomous agent runtime. NO memory mutation. NO tool
// execution. NO network. NO federation. NO PoI. NO mint. NO file write.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEMA_REALM_COUNCIL_CHAMBER_SCHEMA =
  "bizra.dema.realm_council_chamber.v0.1";

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

// 5 council profiles. Each carries the same shape: role, doctrine, active
// ability, current_state, truth_label, boundary note. Profiles are static
// data (not derived from runtime); the data IS the declaration.
const COUNCIL = Object.freeze([
  Object.freeze({
    name: "Guardian",
    role: "Boundary / consent / risk",
    doctrine:
      "Default-deny. Every act passes through a named boundary attestation; no act emerges without it.",
    active_ability:
      "Refuses any operation that would mutate state without exact-string consent or honest mutation_performed attestation.",
    current_state: "DECLARED",
    truth_label: "DECLARED_COUNCIL_PROFILE",
    boundary_note:
      "Wired in part: actuator-check + URP-4.1A consent kernel + URP writer forbidden-field gate. Not yet a unified agent runtime.",
  }),
  Object.freeze({
    name: "Reasoner",
    role: "SAPE / graph thinking",
    doctrine:
      "Decompose intent into structure-abstraction-proof-emergence before any commit; map the graph before walking it.",
    active_ability:
      "Produces brainstorms, specs, plans, decompositions. Refuses to ship before SAPE clears the four rails.",
    current_state: "DECLARED",
    truth_label: "DECLARED_COUNCIL_PROFILE",
    boundary_note:
      "Wired in part: superpowers:brainstorming + writing-plans + URP preflight docs. Not yet a unified agent runtime.",
  }),
  Object.freeze({
    name: "Builder",
    role: "Implementation / tests / commits",
    doctrine:
      "Smallest replayable seed. One slice per commit. Tests before claims, claims before pushes.",
    active_ability:
      "Writes the code, the tests, the docs, the smoke rows, the commit messages. Refuses to commit without local gates green.",
    current_state: "PARTIAL",
    truth_label: "DECLARED_COUNCIL_PROFILE",
    boundary_note:
      "Wired in practice: every URP and UX slice this session was Builder-shaped. Not yet a distinct runtime module.",
  }),
  Object.freeze({
    name: "Critic",
    role: "Self-review / red-team",
    doctrine:
      "Catch your own bugs before the harness does, and catch the harness's bugs before CI does. Trust nothing until it's replayable.",
    active_ability:
      "Runs every gate before push. Catches truth-label drift, boundary-block dishonesty, scope creep, false-positive vibe claims.",
    current_state: "DECLARED",
    truth_label: "DECLARED_COUNCIL_PROFILE",
    boundary_note:
      "Wired in part: npm run check + integration-check + actuator-check + URP-3.1D drift-guard probe. Not yet a unified agent runtime.",
  }),
  Object.freeze({
    name: "Archivist",
    role: "Receipts / memory / truth",
    doctrine:
      "Every act leaves a content-addressed trace. Every trace is replayable. The chain is the witness.",
    active_ability:
      "Persists authorship receipts, URP indexes, checkpoint journal, timeline events. Refuses to write without the canonical boundary block.",
    current_state: "PARTIAL",
    truth_label: "DECLARED_COUNCIL_PROFILE",
    boundary_note:
      "Wired in practice: H18 authorship + URP-3.1A→D + UX-2B checkpoint writer all carry the Archivist's discipline. Not yet a distinct runtime module.",
  }),
]);

const COUNCIL_TRUTH_LABEL = "DECLARED_COUNCIL_CHAMBER";

const COUNCIL_BOUNDARY = Object.freeze({
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
});

export function gatherDemaRealmCouncil({ now = new Date() } = {}) {
  let urp5satActive = false;
  let locked = false;
  try {
    const activePath = join(process.env.DEMA_HOME || join(homedir(), ".dema"), "urp", "5sat-active-locked.json");
    const active = JSON.parse(readFileSync(activePath, "utf8"));
    if (active.active && active.locked) {
      urp5satActive = true;
      locked = true;
    }
  } catch {}
  const profiles = locked
    ? COUNCIL.map((p) => ({
        ...p,
        current_state: "LOCKED",
        boundary_note:
          p.boundary_note +
          " | Locked by URP 5SAT launch (always active), cannot be manipulated by PAT or Dema or Momo.",
      }))
    : COUNCIL;
  return Object.freeze({
    schema: DEMA_REALM_COUNCIL_CHAMBER_SCHEMA,
    truth_label: COUNCIL_TRUTH_LABEL,
    rendered_at_iso: now.toISOString(),
    profile_count: profiles.length,
    profiles,
    urp_5sat_active: urp5satActive,
    urp_5sat_locked: locked,
    disclaimer:
      "Council profiles are DECLARED, not runtime-backed. UX-1D ships their presence; future slices may wire individual agents as discrete runtime modules. After URP-5SAT-1A launch the 5 SAT are locked and always active.",
    boundary: COUNCIL_BOUNDARY,
  });
}

function renderCouncilCard(p, useColor) {
  const stateColor = p.current_state === "PARTIAL" ? ANSI.gold : ANSI.ash;
  return [
    color(
      `╭─ ${p.name.toUpperCase().padEnd(10)} · ${p.role.padEnd(40)} ╮`,
      ANSI.gold,
      useColor,
    ),
    `  ${color("Doctrine:", ANSI.ash, useColor)} ${p.doctrine}`,
    `  ${color("Ability:", ANSI.ash, useColor)}  ${p.active_ability}`,
    `  ${color("State:", ANSI.ash, useColor)}    ${color(p.current_state, stateColor, useColor)} · ${color(p.truth_label, ANSI.gold, useColor)}`,
    `  ${color("Boundary:", ANSI.ash, useColor)} ${color(p.boundary_note, ANSI.dim + ANSI.ash, useColor)}`,
    "",
  ].join("\n");
}

export function renderDemaRealmCouncil(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · COUNCIL CHAMBER", ANSI.gold + ANSI.bold, useColor),
    color(
      `${state.profile_count} profiles · truth: ${state.truth_label}`,
      ANSI.dim + ANSI.ash,
      useColor,
    ),
    "",
  ];
  for (const profile of state.profiles) {
    lines.push(renderCouncilCard(profile, useColor));
  }
  lines.push(
    color(`Disclaimer: ${state.disclaimer}`, ANSI.dim + ANSI.ash, useColor),
  );
  return lines.join("\n");
}
