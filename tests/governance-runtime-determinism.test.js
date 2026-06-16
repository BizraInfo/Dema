import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const specPath = new URL(
  "../docs/02-architecture/bizra-agent-governance-runtime-spec-v0.1.md",
  import.meta.url,
);

function readSpec() {
  return readFileSync(specPath, "utf8");
}

function governanceFateVerdictHash({ proposal, state, fateInput }) {
  const verdict = {
    schema: "bizra.agent_governance.fate_verdict.v0.1",
    proposal_id: proposal.proposal_id,
    decision: "pass",
    ihsan_score: fateInput.ihsan_score,
    claim_risk: fateInput.claim_risk,
    blast_radius: proposal.blast_radius,
    requires_z3: fateInput.requires_z3,
    requires_human_consent: true,
    vetoes: [],
    revision_instructions: [],
    truth_label: "DECLARED_SPEC",
  };

  return sha256(
    stableStringify({
      schema: "bizra.agent_governance.replay_hash_input.v0.1",
      proposal,
      state,
      fateInput,
      verdict,
    }),
  );
}

test("governance spec PAT vote example uses canonical local PAT roles", () => {
  const spec = readSpec();

  assert.match(
    spec,
    /"agent": "Dema \| Guardian \| Reasoner \| Builder \| Critic \| Archivist \| Teacher"/,
  );
  assert.doesNotMatch(
    spec,
    /"agent": "Atlas \| Oracle \| Forge \| Judge \| Crown \| Herald \| Nexus"/,
  );
});

test("governance executable loop orders consent, pre-action receipt, execution, post-action receipt", () => {
  const spec = readSpec();
  const consentRequest = spec.indexOf("Dema presents micro-consent request");
  const consentCaptured = spec.indexOf(
    "Human consent is captured with exact consent rules",
  );
  const preActionReceipt = spec.indexOf("Pre-action receipt is generated");
  const boundedExecution = spec.indexOf(
    "Execution runs only inside bounded authority",
  );
  const postActionReceipt = spec.indexOf("Post-action receipt is generated");

  assert.ok(consentRequest > -1, "micro-consent request line is present");
  assert.ok(consentCaptured > consentRequest, "consent capture follows request");
  assert.ok(preActionReceipt > consentCaptured, "pre-action receipt follows consent");
  assert.ok(boundedExecution > preActionReceipt, "execution follows pre-action receipt");
  assert.ok(postActionReceipt > boundedExecution, "post-action receipt follows execution");
});

test("same proposal plus same state and canonical FATE inputs yield same verdict hash", () => {
  const proposal = {
    schema: "bizra.agent_governance.pat_proposal.v0.1",
    proposal_id: "proposal-governance-determinism-1a",
    mission_summary: "Verify governance replay determinism.",
    claim_boundary: {
      truth_label: "DECLARED",
      known: ["spec-only replay hash"],
      assumed_with_ihsan: [],
      unknown: [],
      forbidden_claims: ["runtime", "federation", "token"],
    },
    expected_action: {
      level: "L2",
      executes: false,
      writes: [],
      network: false,
      identity_bound: false,
      irreversible: false,
    },
    blast_radius: "repo",
    pat_votes: [
      {
        agent: "Dema",
        vote: "support",
        reason: "Spec-only deterministic replay test.",
      },
    ],
  };
  const state = {
    schema: "bizra.agent_governance.state.v0.1",
    mutable: {
      I: [0.95, 0.96, 0.95, 0.97, 0.95, 0.96, 0.95, 0.97],
      rho: 72,
      epsilon: 0.18,
      P: [0.2, 0.14, 0.14, 0.14, 0.14, 0.12, 0.12],
      R: { blast_radius: "repo" },
      Phi: "claim-ledger-digest-example",
    },
    frozen: {
      C0: "constitution-anchor-example",
      F0: "frozen-agent-standards-example",
    },
  };
  const fateInput = {
    ihsan_score: 0.97,
    claim_risk: "low",
    requires_z3: false,
  };

  const hashA = governanceFateVerdictHash({ proposal, state, fateInput });
  const hashB = governanceFateVerdictHash({
    fateInput: {
      requires_z3: false,
      claim_risk: "low",
      ihsan_score: 0.97,
    },
    state: {
      frozen: state.frozen,
      mutable: state.mutable,
      schema: state.schema,
    },
    proposal: {
      blast_radius: proposal.blast_radius,
      claim_boundary: proposal.claim_boundary,
      expected_action: proposal.expected_action,
      mission_summary: proposal.mission_summary,
      pat_votes: proposal.pat_votes,
      proposal_id: proposal.proposal_id,
      schema: proposal.schema,
    },
  });
  const changedHash = governanceFateVerdictHash({
    proposal,
    state,
    fateInput: { ...fateInput, claim_risk: "medium" },
  });

  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, changedHash);
});
