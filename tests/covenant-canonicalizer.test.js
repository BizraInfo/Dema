import test from "node:test";
import assert from "node:assert/strict";
import * as covenant from "../packages/covenant/src/covenant-gate.js";

const BASE_PROPOSAL = Object.freeze({
  project_id: "ocean-cleanup-dao",
  sector: "environmental",
  team_disclosure: true,
  guaranteed_apr: false,
  debt_ratio: 0.05,
  impact_evidence: Object.freeze([
    Object.freeze({
      type: "oracle_attestation",
      source: "demo_oracle_1",
      hash: "sha256:demo",
    }),
  ]),
});

function proposalHash() {
  assert.equal(typeof covenant.createProposalHash, "function");
  return covenant.createProposalHash;
}

function oldVacuousCanonical(value) {
  return JSON.stringify(value, Object.keys({}).sort());
}

test("C1: distinct proposals produce distinct proposal IDs", () => {
  const hash = proposalHash();
  const a = hash(BASE_PROPOSAL);
  const b = hash({ ...BASE_PROPOSAL, project_id: "mangrove-restoration-dao" });

  assert.match(a, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(a, b);
});

test("C1: same proposal content with different key order produces identical proposal ID", () => {
  const hash = proposalHash();
  const reordered = {
    impact_evidence: [
      {
        hash: "sha256:demo",
        source: "demo_oracle_1",
        type: "oracle_attestation",
      },
    ],
    debt_ratio: 0.05,
    guaranteed_apr: false,
    team_disclosure: true,
    sector: "environmental",
    project_id: "ocean-cleanup-dao",
  };

  assert.equal(hash(BASE_PROPOSAL), hash(reordered));
});

test("C1: nested field difference changes proposal ID", () => {
  const hash = proposalHash();
  const changedEvidence = {
    ...BASE_PROPOSAL,
    impact_evidence: [
      {
        type: "oracle_attestation",
        source: "demo_oracle_1",
        hash: "sha256:changed",
      },
    ],
  };

  assert.notEqual(hash(BASE_PROPOSAL), hash(changedEvidence));
});

test("C1: old vacuous JSON.stringify pattern collapses proposal state to empty object", () => {
  assert.equal(oldVacuousCanonical(BASE_PROPOSAL), "{}");
  assert.equal(
    oldVacuousCanonical({ ...BASE_PROPOSAL, project_id: "mangrove-restoration-dao" }),
    "{}",
  );
});
