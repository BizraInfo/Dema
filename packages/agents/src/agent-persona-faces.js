// AGENT-PERSONA-FACES-1A · One agent, three faces.
//
// Presentation layer over the frozen AGENT-PROFILE-1A registry: every canonical
// agent keeps ONE stable identity (agent_id + agent_role — the surface keys,
// receipts and consent bind to) and gains two display faces:
//
//   mythic       — callsign shown in the sovereign UI (NEXUS, FORGE, …)
//   professional — occupational title (O*NET-style job description)
//
// SAT referees deliberately have no mythic skin: a verifier wears no mask, so
// SAT roles resolve to their canonical name in every display mode.
//
// This module is presentation-ONLY. It is not imported by the signing path and
// contributes nothing to stable_profile_hash or profile_proof_hash — flipping a
// callsign can never change a signed identity.
//
// Occupation titles are DRAFT_PENDING_OPERATOR_RATIFICATION (operator design
// session 2026-08-15). O*NET occupation_ref codes are deliberately ABSENT: the
// planned offline O*NET snapshot (/data/bizra/reference/onet/) will bind them;
// inventing codes from memory would be a fabricated reference.
//
// Reuses (no duplication): CANONICAL_AGENTS from agent-profile-registry.js is
// the single source of agent identity and ordering.

import { CANONICAL_AGENTS } from "./agent-profile-registry.js";

export const PERSONA_FACES_SCHEMA = "bizra.dema.agent_persona_faces.v0.1";

/// Honesty label carried by every professional-face resolve until the operator
/// ratifies the title mapping against the O*NET snapshot.
export const OCCUPATION_STATUS = "DRAFT_PENDING_OPERATOR_RATIFICATION";

export const PERSONA_DISPLAY_MODES = Object.freeze([
  "canonical",
  "mythic",
  "professional",
]);

// ── PAT three-faces table (operator's edit surface) ───────────────────
// Keyed by the frozen registry role names. SAT roles are intentionally
// absent: no mask for referees.
const PAT_FACES = Object.freeze({
  Dema: Object.freeze({
    callsign: "NEXUS",
    occupation: "Computer & Information Systems Manager",
  }),
  Reasoner: Object.freeze({
    callsign: "ORACLE",
    occupation: "Data Scientist",
  }),
  Builder: Object.freeze({
    callsign: "FORGE",
    occupation: "Software Developer",
  }),
  Critic: Object.freeze({
    callsign: "JUDGE",
    occupation: "Quality Assurance Engineer",
  }),
  Guardian: Object.freeze({
    callsign: "CROWN",
    occupation: "Information Security Analyst",
  }),
  Archivist: Object.freeze({
    callsign: "ATLAS",
    occupation: "Project Management Specialist",
  }),
  Teacher: Object.freeze({
    callsign: "HERALD",
    occupation: "Technical Writer",
  }),
});

const KNOWN_ROLES = new Set(CANONICAL_AGENTS.map((a) => a.agent_role));

/**
 * Resolve the display face for one canonical agent role.
 *
 * Fails closed: an unknown role or unknown mode is an error, never a guess.
 * SAT roles resolve to their canonical name in every mode.
 */
export function resolvePersonaFace({ agent_role, mode = "canonical" } = {}) {
  if (!PERSONA_DISPLAY_MODES.includes(mode)) {
    return Object.freeze({ resolved: false, error: "unknown_display_mode" });
  }
  if (!KNOWN_ROLES.has(agent_role)) {
    return Object.freeze({ resolved: false, error: "unknown_agent_role" });
  }
  const faces = PAT_FACES[agent_role] ?? null;
  let display = agent_role;
  if (faces && mode === "mythic") display = faces.callsign;
  if (faces && mode === "professional") display = faces.occupation;
  return Object.freeze({
    resolved: true,
    agent_role,
    mode,
    display,
    occupation_status: faces && mode === "professional" ? OCCUPATION_STATUS : null,
  });
}

/**
 * Full three-face card for every canonical agent, in frozen registry order —
 * the UI roster source. Presentation data only; settles nothing.
 */
export function listPersonaFaces() {
  return Object.freeze(
    CANONICAL_AGENTS.map((a) => {
      const faces = PAT_FACES[a.agent_role] ?? null;
      return Object.freeze({
        agent_id: a.agent_id,
        agent_class: a.agent_class,
        canonical: a.agent_role,
        mythic: faces ? faces.callsign : a.agent_role,
        professional: faces ? faces.occupation : a.agent_role,
        occupation_status: faces ? OCCUPATION_STATUS : null,
      });
    }),
  );
}
