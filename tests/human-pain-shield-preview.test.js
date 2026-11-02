import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
  HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
  DEFAULT_MAX_AOI_CONTEXT_TOKENS,
  auditHumanPainShieldProposal,
  extractFilenameRefsFromProse,
  humanPainShieldPreviewBoundary,
  verifyHumanPainShieldPreview,
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
    assert.deepEqual(r.pin_ids_checked, []);
  });

  it("blocks filenames mined from diagnosis prose including .env", () => {
    assert.ok(extractFilenameRefsFromProse("check .env please").includes(".env"));
    const r = auditHumanPainShieldProposal(
      basePacket({
        referenced_in_diagnosis: ["app.py"],
        diagnosis_prose: "The bug is clearly in .env on the edge.",
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
    assert.deepEqual(r.pin_ids_checked, ["PIN-01-AUTH-MEMBRANE", "PIN-02-PARTY-SIZE"]);
  });

  it("blocks AoI token bloat above default ceiling", () => {
    const r = auditHumanPainShieldProposal(
      basePacket({ context_tokens_loaded: 45_000 }),
      { pins: cleanPins },
    );
    assert.equal(r.verdict, "BLOCKED_CONTEXT_TOKEN_BLOAT");
    assert.equal(r.ceilings.max_aoi_context_tokens, DEFAULT_MAX_AOI_CONTEXT_TOKENS);
    assert.deepEqual(r.pin_ids_checked, []);
  });

  it("blocks outbound privacy leak (home path and spaced API key)", () => {
    const home = auditHumanPainShieldProposal(
      basePacket({
        outbound_urp_summary: "Compiled from /Users/mumo/secret_vault/key.pem",
      }),
      { pins: cleanPins },
    );
    assert.equal(home.verdict, "BLOCKED_PRIVATE_DATA_LEAK");
    const api = auditHumanPainShieldProposal(
      basePacket({
        outbound_urp_summary: "API key: sk-testleakvalue012345",
      }),
      { pins: cleanPins },
    );
    assert.equal(api.verdict, "BLOCKED_PRIVATE_DATA_LEAK");
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
    assert.match(r.packet_commitment, /^sha256:[0-9a-f]{64}$/);
  });

  it("binds observation_hash to packet contents", () => {
    const a = auditHumanPainShieldProposal(basePacket(), { pins: cleanPins });
    const b = auditHumanPainShieldProposal(
      basePacket({ outbound_urp_summary: "different clean summary without secrets" }),
      { pins: cleanPins },
    );
    assert.notEqual(a.packet_commitment, b.packet_commitment);
    assert.notEqual(a.observation_hash, b.observation_hash);
  });

  it("rejects malformed pins instead of failing open", () => {
    const r = auditHumanPainShieldProposal(basePacket(), {
      pins: [{ pin_id: "PIN-BROKEN", description: "x" }],
    });
    assert.equal(r.verdict, "BLOCKED_MALFORMED_PACKET");
    assert.ok(r.violations.some((v) => v.includes("pin_predicate_not_function")));
  });

  it("rejects non-boolean pin predicates (async fail-open hole)", () => {
    const r = auditHumanPainShieldProposal(basePacket(), {
      pins: [
        {
          pin_id: "PIN-ASYNC",
          description: "async",
          regression_check_fn: async () => false,
        },
      ],
    });
    assert.equal(r.verdict, "BLOCKED_MALFORMED_PACKET");
  });

  it("verify re-derives and rejects a forged clean verdict", () => {
    const packet = basePacket({ context_tokens_loaded: 45_000 });
    const real = auditHumanPainShieldProposal(packet, { pins: cleanPins });
    assert.equal(real.verdict, "BLOCKED_CONTEXT_TOKEN_BLOAT");
    const ok = verifyHumanPainShieldPreview(real, packet, { pins: cleanPins });
    assert.equal(ok.ok, true);
    const forged = { ...real, verdict: "SHIELD_PASSED", observation_hash: real.observation_hash };
    const bad = verifyHumanPainShieldPreview(forged, packet, { pins: cleanPins });
    // same hash but verdict field lied — re-derive compares hash of full body via re-audit
    // Forged verdict with OLD hash: re-audit produces different hash → mismatch
    assert.equal(bad.ok, false);
    const forgedClean = auditHumanPainShieldProposal(basePacket(), { pins: cleanPins });
    const swapped = {
      ...forgedClean,
      verdict: "SHIELD_PASSED",
      // keep clean hash but claim it for a bloated packet
    };
    const againstBloat = verifyHumanPainShieldPreview(swapped, packet, { pins: cleanPins });
    assert.equal(againstBloat.ok, false);
    assert.equal(againstBloat.reason, "observation_hash_mismatch");
  });

  it("refuses malformed packets", () => {
    const r = auditHumanPainShieldProposal({ mission_id: "x" }, { pins: [] });
    assert.equal(r.verdict, "BLOCKED_MALFORMED_PACKET");
  });
});
