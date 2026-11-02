import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
  HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
  DEFAULT_MAX_AOI_CONTEXT_TOKENS,
  auditHumanPainShieldProposal,
  extractFilenameRefsFromProse,
  humanPainShieldPreviewBoundary,
} from "../packages/core/src/human-pain-shield-preview.js";

const cleanPins = [
  {
    pin_id: "PIN-01-AUTH-MEMBRANE",
    description: "founder_override must remain false",
    epoch_locked: 1,
    regression_check_fn: (state) => state.founder_override === false,
  },
  {
    pin_id: "PIN-02-PARTY-SIZE",
    description: "pat_count must equal 7",
    epoch_locked: 2,
    regression_check_fn: (state) => state.pat_count === 7,
  },
];

function basePacket(over = {}) {
  return {
    mission_id: "TEST",
    context_tokens_loaded: 320,
    visible_artifacts: ["app.py"],
    referenced_in_diagnosis: ["app.py"],
    proposed_state_dict: { founder_override: false, pat_count: 7 },
    outbound_urp_summary: "RCPT-HASH-88A12F verified locally.",
    human_diff_lines: 6,
    ...over,
  };
}

describe("HUMAN-PAIN-SHIELD-PREVIEW-1A", () => {
  it("exports schema, preview truth label, and all-false boundary", () => {
    assert.equal(HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA, "bizra.dema.human_pain_shield_preview.v0.1");
    assert.equal(HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL, "HUMAN_PAIN_SHIELD_PREVIEW_ONLY");
    const b = humanPainShieldPreviewBoundary();
    for (const v of Object.values(b)) assert.equal(v, false);
  });

  it("blocks unseen config blame (explicit refs)", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({
        visible_artifacts: ["app.py", "schema.json"],
        referenced_in_diagnosis: ["app.py", "nginx_prod.conf"],
      }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_UNSEEN_CONFIG_SPECULATION");
    assert.ok(r.violations.some((v) => v.includes("nginx_prod.conf")));
  });

  it("blocks filenames mined from diagnosis prose not in visible set (I13)", () => {
    const prose = "The bug is clearly in nginx_prod.conf on the edge.";
    assert.deepEqual(extractFilenameRefsFromProse(prose), ["nginx_prod.conf"]);
    const r = auditHumanPainShieldProposal(
      basePacket({
        referenced_in_diagnosis: ["app.py"],
        diagnosis_prose: prose,
      }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_UNSEEN_CONFIG_SPECULATION");
  });

  it("blocks regression that breaks a soulbound pin", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({
        proposed_state_dict: { founder_override: true, pat_count: 7 },
      }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_REGRESSION_ON_PINNED_FEATURE");
    assert.ok(r.violations.some((v) => v.includes("PIN-01")));
  });

  it("blocks AoI token bloat above default ceiling", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({ context_tokens_loaded: 45_000 }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_CONTEXT_TOKEN_BLOAT");
    assert.equal(r.ceilings.max_aoi_context_tokens, DEFAULT_MAX_AOI_CONTEXT_TOKENS);
  });

  it("blocks outbound privacy leak (home path)", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({
        outbound_urp_summary: "Compiled from /Users/mumo/secret_vault/key.pem",
      }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_PRIVATE_DATA_LEAK");
  });

  it("blocks oversized human review dumps", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({ human_diff_lines: 500 }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_HUMAN_DIFF_FATIGUE");
  });

  it("passes a clean AoI-bounded pin-preserving packet", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({
        proposed_state_dict: { founder_override: false, pat_count: 7, new_feature: true },
      }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "SHIELD_PASSED");
    assert.deepEqual(r.violations, []);
    assert.equal(r.authority_delta, 0);
    assert.match(r.observation_hash, /^sha256:[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    const a = auditHumanPainShieldProposal(basePacket(), { pins: cleanPins });
    const b = auditHumanPainShieldProposal(basePacket(), { pins: cleanPins });
    assert.equal(a.observation_hash, b.observation_hash);
  });

  it("refuses malformed packets", () => {
    const r = auditHumanPainShieldProposal({ mission_id: "x" }, { pins: [] });
    assert.equal(r.verdict, "BLOCKED_MALFORMED_PACKET");
  });
});
