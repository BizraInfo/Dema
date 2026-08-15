// AGENT-PERSONA-FACES-1A · One agent, three faces — presentation-only kernel tests.
//
// Contract (operator-designed 2026-08-15): every canonical agent keeps ONE
// stable identity (agent_id / agent_role — the surface keys, receipts and
// consent bind to) and gains two display faces: a mythic callsign for the
// sovereign UI and an occupational title (O*NET-style job description).
// SAT referees deliberately have no mythic skin — a verifier wears no mask.
// Occupation titles are DRAFT pending operator ratification; the module must
// say so rather than presenting them as settled.
//
// This layer is presentation-ONLY: nothing here may enter stable_profile_hash
// or the signing path. These tests prove the mapping, the fail-closed edges,
// and the honesty labels — not runtime behavior of any agent.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  resolvePersonaFace,
  listPersonaFaces,
  PERSONA_DISPLAY_MODES,
  OCCUPATION_STATUS,
} from "../packages/agents/src/agent-persona-faces.js";
import { CANONICAL_AGENTS } from "../packages/agents/src/agent-profile-registry.js";

describe("AGENT-PERSONA-FACES-1A · one agent, three faces", () => {
  it("all 7 PAT roles carry distinct mythic callsigns, none equal to the canonical role", () => {
    const pat = listPersonaFaces().filter((f) => f.agent_class === "PAT");
    assert.equal(pat.length, 7);
    const callsigns = pat.map((f) => f.mythic);
    assert.equal(new Set(callsigns).size, 7, "callsigns must be distinct");
    for (const f of pat) {
      assert.notEqual(f.mythic, f.canonical, `${f.canonical} must have a real skin`);
      assert.notEqual(f.professional, f.canonical, `${f.canonical} must have a real title`);
    }
  });

  it("Builder wears FORGE in mythic mode and a job title in professional mode", () => {
    const mythic = resolvePersonaFace({ agent_role: "Builder", mode: "mythic" });
    assert.equal(mythic.resolved, true);
    assert.equal(mythic.display, "FORGE");

    const pro = resolvePersonaFace({ agent_role: "Builder", mode: "professional" });
    assert.equal(pro.resolved, true);
    assert.equal(typeof pro.display, "string");
    assert.notEqual(pro.display, "Builder");
  });

  it("canonical mode always returns the frozen registry role name", () => {
    const c = resolvePersonaFace({ agent_role: "Builder", mode: "canonical" });
    assert.equal(c.display, "Builder");
  });

  it("SAT referees have no mythic skin — canonical name in every mode", () => {
    for (const mode of PERSONA_DISPLAY_MODES) {
      const v = resolvePersonaFace({ agent_role: "Verifier", mode });
      assert.equal(v.resolved, true);
      assert.equal(v.display, "Verifier", `SAT face must stay canonical in ${mode}`);
    }
  });

  it("unknown role fails closed", () => {
    const r = resolvePersonaFace({ agent_role: "Overlord", mode: "mythic" });
    assert.equal(r.resolved, false);
    assert.equal(r.error, "unknown_agent_role");
  });

  it("unknown display mode fails closed", () => {
    const r = resolvePersonaFace({ agent_role: "Builder", mode: "poetic" });
    assert.equal(r.resolved, false);
    assert.equal(r.error, "unknown_display_mode");
  });

  it("occupation titles are DRAFT — professional resolves carry the honesty label", () => {
    const pro = resolvePersonaFace({ agent_role: "Teacher", mode: "professional" });
    assert.equal(pro.occupation_status, OCCUPATION_STATUS);
    const mythic = resolvePersonaFace({ agent_role: "Teacher", mode: "mythic" });
    assert.equal(mythic.occupation_status, null, "label rides only the professional face");
  });

  it("roster covers all 12 canonical agents, frozen, in registry order", () => {
    const roster = listPersonaFaces();
    assert.equal(roster.length, CANONICAL_AGENTS.length);
    assert.ok(Object.isFrozen(roster));
    assert.ok(roster.every((f) => Object.isFrozen(f)));
    assert.deepEqual(
      roster.map((f) => f.agent_id),
      CANONICAL_AGENTS.map((a) => a.agent_id),
      "roster order must mirror the frozen registry",
    );
  });
});
