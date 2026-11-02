#!/usr/bin/env node
// HUMAN-PAIN-SHIELD-PREVIEW-1A — review gate.
// Proves unseen-config + token-bloat + pin + privacy shields refuse, and a clean
// packet passes with verify re-derivation.

import { pathToFileURL } from "node:url";

import {
  auditHumanPainShieldProposal,
  humanPainShieldPreviewBoundary,
  verifyHumanPainShieldPreview,
  HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
  HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/human-pain-shield-preview.js";

const JSON_MODE = process.argv.includes("--json");

const pins = [
  {
    pin_id: "PIN-01",
    description: "founder_override false",
    epoch_locked: 1,
    regression_check_fn: (s) => s.founder_override === false,
  },
];

function base(over = {}) {
  return {
    mission_id: "REVIEW-GATE",
    context_tokens_loaded: 200,
    visible_artifacts: ["app.py"],
    referenced_in_diagnosis: ["app.py"],
    proposed_state_dict: { founder_override: false },
    outbound_urp_summary: "RCPT-HASH-OK",
    human_diff_lines: 4,
    ...over,
  };
}

export function runHumanPainShieldPreviewCheck() {
  const unseen = auditHumanPainShieldProposal(
    base({ referenced_in_diagnosis: ["app.py", "nginx.conf"] }),
    { pins },
  );
  const bloat = auditHumanPainShieldProposal(base({ context_tokens_loaded: 50_000 }), { pins });
  const leak = auditHumanPainShieldProposal(
    base({ outbound_urp_summary: "API key: sk-reviewgateleak01" }),
    { pins },
  );
  const cleanPkt = base();
  const clean = auditHumanPainShieldProposal(cleanPkt, { pins });
  const verified = verifyHumanPainShieldPreview(clean, cleanPkt, { pins });
  const forged = verifyHumanPainShieldPreview(
    { ...clean, verdict: "SHIELD_PASSED" },
    base({ context_tokens_loaded: 50_000 }),
    { pins },
  );
  const boundary = humanPainShieldPreviewBoundary();
  const boundary_all_false = Object.values(boundary).every((v) => v === false);
  const ok =
    unseen.verdict === "BLOCKED_UNSEEN_CONFIG_SPECULATION" &&
    bloat.verdict === "BLOCKED_CONTEXT_TOKEN_BLOAT" &&
    leak.verdict === "BLOCKED_PRIVATE_DATA_LEAK" &&
    clean.verdict === "SHIELD_PASSED" &&
    verified.ok === true &&
    forged.ok === false &&
    boundary_all_false &&
    clean.authority_delta === 0;

  return {
    schema: HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
    truth_label: HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
    preview_only: true,
    ok,
    unseen: unseen.verdict,
    bloat: bloat.verdict,
    leak: leak.verdict,
    clean: clean.verdict,
    verify_ok: verified.ok,
    forged_rejected: forged.ok === false,
    boundary_all_false,
    authority_delta: clean.authority_delta,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runHumanPainShieldPreviewCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      result.ok
        ? "human-pain-shield-preview-check: PASS"
        : "human-pain-shield-preview-check: FAIL",
    );
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(result.ok ? 0 : 1);
}
