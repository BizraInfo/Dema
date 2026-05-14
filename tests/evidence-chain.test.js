import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidenceChain,
  validateEvidenceChain
} from "../packages/evidence/src/evidence-chain.js";

const EVENTS = [
  { type: "mission_draft", hash: "sha256:mission" },
  { type: "consent_scope", hash: "sha256:consent" }
];

test("EvidenceChain builds deterministic schema-tagged preview chains", () => {
  const first = buildEvidenceChain({ events: EVENTS });
  const second = buildEvidenceChain({ events: EVENTS });

  assert.equal(first.schema, "bizra.dema.evidence_chain.v0.1");
  assert.equal(first.mode, "PREVIEW_ONLY");
  assert.equal(first.boundary.receipt_minted, false);
  assert.equal(first.root_hash, second.root_hash);
  assert.equal(validateEvidenceChain(first).ok, true);
});

test("EvidenceChain rejects broken links and payload mutation", () => {
  const chain = buildEvidenceChain({ events: EVENTS });
  const brokenLink = JSON.parse(JSON.stringify(chain));
  brokenLink.entries[1].previous_hash = "sha256:wrong";

  const brokenPayload = JSON.parse(JSON.stringify(chain));
  brokenPayload.entries[0].payload.hash = "sha256:mutated";

  assert.equal(validateEvidenceChain(brokenLink).ok, false);
  assert.ok(validateEvidenceChain(brokenLink).findings.some((finding) => (
    finding.code === "previous_hash_mismatch"
  )));
  assert.equal(validateEvidenceChain(brokenPayload).ok, false);
  assert.ok(validateEvidenceChain(brokenPayload).findings.some((finding) => (
    finding.code === "payload_hash_mismatch"
  )));
});

test("EvidenceChain rejects root mutation and survives JSON round trip", () => {
  const chain = buildEvidenceChain({ events: EVENTS });
  const roundTrip = JSON.parse(JSON.stringify(chain));
  const tampered = JSON.parse(JSON.stringify(chain));
  tampered.root_hash = "sha256:wrong";

  assert.equal(roundTrip.schema, "bizra.dema.evidence_chain.v0.1");
  assert.equal(validateEvidenceChain(roundTrip).ok, true);
  assert.equal(validateEvidenceChain(tampered).ok, false);
  assert.ok(validateEvidenceChain(tampered).findings.some((finding) => (
    finding.code === "root_hash_mismatch"
  )));
});

test("EvidenceChain validates each link against the stored predecessor hash", () => {
  const chain = buildEvidenceChain({
    events: [...EVENTS, { type: "effect_cap", hash: "sha256:decision" }]
  });
  const tampered = JSON.parse(JSON.stringify(chain));
  tampered.entries[1].event_hash = "sha256:fake-middle";

  const verdict = validateEvidenceChain(tampered);
  assert.equal(verdict.ok, false);
  assert.ok(verdict.findings.some((finding) => (
    finding.code === "event_hash_mismatch" && finding.index === 1
  )));
  assert.ok(verdict.findings.some((finding) => (
    finding.code === "previous_hash_mismatch" && finding.index === 2
  )));
});
