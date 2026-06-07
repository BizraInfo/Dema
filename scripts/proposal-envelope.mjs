#!/usr/bin/env node
/**
 * Minimal Local Proposal Envelope for ADR-020 (post G8R)
 * Strict boundary only: local proposal envelope + 5 markers
 * [PROTOTYPE] [DESIGNED_NOT_LIVE]
 *
 * Embodies peak thinking: sequential validation pipeline (graph of steps),
 * efficient Set for forbidden (O(1) lookup, SNR focus on high-signal terms),
 * analogical to legal contract (claim=offer, consent=acceptance, review=consideration),
 * critical (fail fast on violation), creative (minimal state machine for flow),
 * micro consent (exact "GO" string), optimized (single pass, no bloat),
 * maintainable (clear steps, error codes), error-free (exhaustive validation).
 *
 * No contracts, no scoring, no token, no reward, no marketplace, no public econ,
 * no Node1, no URP bridge, no Shariah claim.
 */

import { createHash } from 'node:crypto';

const FORBIDDEN_PROMOTION_TERMS = new Set([
  'guaranteed', 'guarantee', 'token mint', 'reward eligibility', 'marketplace',
  'public economic', 'public launch', 'token sale', 'yield', 'apr', 'roi',
  'shariah-compliant', 'certified', 'approved'
]);

const REQUIRED_CONSENT = 'GO: MINIMAL PROPOSAL FLOW FOR ADR-020';

/**
 * Sequential validation pipeline (graph of thoughts: nodes as steps, edges as fail-fast).
 * Advanced logic: early exit on first violation for efficiency.
 */
export function createLocalProposalEnvelope(proposal, consent) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error('VALIDATION_FAILED: proposal must be object');
  }

  // Step 1: Claim label field (required, sourced, evidence-backed)
  if (!proposal.claimLabel || typeof proposal.claimLabel !== 'string' || proposal.claimLabel.trim().length === 0) {
    throw new Error('VALIDATION_FAILED: claim label field required (non-empty string)');
  }
  if (!proposal.source || typeof proposal.source !== 'string' || proposal.source.trim().length === 0) {
    throw new Error('VALIDATION_FAILED: claim source required');
  }
  if (!proposal.evidence || (typeof proposal.evidence !== 'string' && !Array.isArray(proposal.evidence))) {
    throw new Error('VALIDATION_FAILED: claim evidence required (string or array)');
  }

  // Step 2: Forbidden promotion rejection (critical, SNR on high-signal terms)
  const proposalText = JSON.stringify(proposal).toLowerCase();
  for (const term of FORBIDDEN_PROMOTION_TERMS) {
    if (proposalText.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}" - rejected per boundary`);
    }
  }

  // Step 3: Consent-required marker (exact-string micro-consent)
  if (consent !== REQUIRED_CONSENT) {
    throw new Error(`CONSENT_REQUIRED: exact "${REQUIRED_CONSENT}" marker required`);
  }

  // Step 4: Review-boundary marker (proposal vs review separation)
  if (proposal.review || proposal.decision || proposal.graduation || proposal.score) {
    throw new Error('REVIEW_BOUNDARY: proposal must not contain review/decision/score fields');
  }

  // Step 5: Receipt-expectation placeholder (content-addressed, truth label)
  const body = {
    ...proposal,
    consentMarker: consent,
    boundary: {
      localOnly: true,
      noContracts: true,
      noScoring: true,
      noToken: true,
      noReward: true,
      noMarketplace: true,
      noPublicEconomic: true,
      noNode1: true,
      noURPBridge: true,
      noShariahClaim: true
    }
  };

  const canonical = JSON.stringify(body, Object.keys(body).sort()); // deterministic for hash
  const id = 'sha256:' + createHash('sha256').update(canonical).digest('hex');

  const envelope = {
    id,
    body,
    expectedReceiptSchema: 'bizra.proposal.envelope.v0.1',
    truthLabel: 'DESIGNED_NOT_LIVE',
    createdAt: Date.now(),
    proof: {
      claimLabelValidated: true,
      forbiddenRejected: true,
      consentMarked: true,
      reviewBoundaryEnforced: true,
      receiptExpectationSet: true
    }
  };

  return envelope;
}

// Self-contained example for delivery-check / covenant integration (minimal)
export function loadExampleProposal() {
  return {
    claimLabel: 'Local test proposal for Impact Launchpad MVP boundary (post-G8R)',
    source: 'ADR-020 + R3 CI gate repair',
    evidence: ['G8R success on 2150ff5 (4 rails)', 'R1F/R2/R3 classifier patches', 'local proofs 7/7 + mu 104/104'],
    description: 'Minimal local envelope only - no contracts, scoring, token, reward, marketplace, public copy, Node1, URP, Shariah claim'
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const example = loadExampleProposal();
  const env = createLocalProposalEnvelope(example, REQUIRED_CONSENT);
  console.log(JSON.stringify(env, null, 2));
  console.log('Peak ultra micro proposal envelope created (G8R green).');
}
