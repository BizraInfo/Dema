import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cockpitUrl = new URL(
  "../docs/demo/bizra-doxology-gate-proof-cockpit.html",
  import.meta.url,
);

function readCockpit() {
  return readFileSync(cockpitUrl, "utf8");
}

describe("BIZRA doxology gate proof cockpit artifact", () => {
  it("ships as a single offline HTML artifact", () => {
    const html = readCockpit();

    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<title>BIZRA Doxology Gate Micro-Consent Proof Cockpit<\/title>/);
    assert.doesNotMatch(html, /https?:\/\//i);
    assert.doesNotMatch(html, /\bfetch\s*\(/);
    assert.doesNotMatch(html, /\blocalStorage\b/);
    assert.match(html, /COCKPIT_LOCAL_DEMO/);
    assert.match(html, /IN_MEMORY_ONLY/);
  });

  it("binds the eight doxology lines to executable gate definitions", () => {
    const html = readCockpit();
    const lines = [
      "If the code failed, patch the code.",
      "If the proof failed, repair the proof.",
      "If the world failed, repair the environment.",
      "If consent is missing, stop.",
      "If impact is simulated, do not mint.",
      "If cost is measured, do not call it value.",
      "If CI is unavailable, do not call it code failure.",
      "If the phone is not registered, do not pretend it is connected.",
    ];

    for (const line of lines) {
      assert.match(html, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(html, /const DOXOLOGY_GATES = \[/);
    assert.match(html, /async function runGateChain/);
    assert.match(html, /function buildFdeDiagnosis/);
  });

  it("implements exact micro-consent, Web Crypto hashing, and receipt chaining", () => {
    const html = readCockpit();

    assert.match(html, /crypto\.subtle\.digest\("SHA-256"/);
    assert.match(html, /I CONSENT: SEAL MISSION/);
    assert.match(html, /Broad phrases are never consent/);
    assert.match(html, /previous_hash/);
    assert.match(html, /current_hash/);
    assert.match(html, /verifyChainIntegrity/);
    assert.match(html, /READY_LOCAL/);
    assert.match(html, /READY_REMOTE_LOCKED/);
  });
});
