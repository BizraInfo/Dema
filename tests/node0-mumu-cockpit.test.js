import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMumuLoop } from "../scripts/node0-mumu-loop.mjs";
import {
  buildMumuConsent,
  buildMumuJourney,
  JOURNEY_STAGES,
} from "../scripts/node0-mumu-cli.mjs";
import { renderNode0MumuCockpit } from "../packages/core/src/node0-mumu-cockpit.js";

function freshOut() {
  return mkdtempSync(join(tmpdir(), "n0-cockpit-out-"));
}

describe("node0 mumu cockpit TUI", () => {
  it("renders pipeline and inactive next command", () => {
    const out = freshOut();
    try {
      const j = buildMumuJourney({ outDir: out, operator: "Mumu" });
      const text = renderNode0MumuCockpit(j, { useColor: false });
      assert.match(text, /BIZRA NODE0 · MUMU CLOSED LOOP/);
      assert.match(text, /PROPOSE/);
      assert.match(text, /npm run node0/);
      assert.equal(j.stage, JOURNEY_STAGES.INACTIVE);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("shows micro-consent gate when awaiting consent", () => {
    const root = mkdtempSync(join(tmpdir(), "n0-cockpit-root-"));
    const out = freshOut();
    writeFileSync(join(root, "a.txt"), "x");
    try {
      const proposal = runMumuLoop({
        root,
        out,
        offline: true,
        metadataOnly: true,
        testMode: true,
        autoConsentTest: false,
        consent: null,
        maxFiles: 50000,
        maxDepth: 8,
      });
      const j = buildMumuJourney({ outDir: out });
      const c = buildMumuConsent({ outDir: out });
      const text = renderNode0MumuCockpit(j, { useColor: false });
      assert.equal(j.stage, JOURNEY_STAGES.AWAITING_CONSENT);
      assert.match(text, /MICRO-CONSENT GATE/);
      assert.match(text, new RegExp(proposal.expected_consent_phrase));
      assert.equal(c.expected_consent_phrase, proposal.expected_consent_phrase);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
