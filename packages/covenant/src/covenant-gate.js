/**
 * BIZRA Covenant Gate v0.1 — Verifiable Consent-and-Screening Gate (PROTOTYPE)
 *
 * This is the minimal solvable special case extracted from the Omnidirectional Audit.
 * It implements the kernel:
 *   Project Proposal → Screening Engine → Thought Packet → Micro-Consent → Signed Receipt → GraduationDecision
 *
 * [PROTOTYPE] — Implemented but not audited, not production cryptography, not Shariah or legal opinion.
 * [DESIGN] — Deterministic, local-only, receipt-backed state machine.
 * [DO NOT CLAIM] — No autonomous execution, no fund movement, no formal Shariah compliance, no real oracle.
 * Dema is the local face only. No runtime in this module.
 *
 * Exact-string micro-consent required before any receipt is emitted ("GO").
 */

import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const COVENANT_GATE_SCHEMA = 'bizra.dema.covenant_gate.v0.1';
export const GRADUATION_DECISION_SCHEMA = 'bizra.dema.graduation_decision.v0.1';
export const THOUGHT_PACKET_SCHEMA = 'bizra.dema.thought_packet.v0.1';
export const CONSENT_RECEIPT_SCHEMA = 'bizra.dema.consent_receipt.v0.1';

const PROHIBITED_SECTORS = new Set(['gambling', 'usury', 'alcohol', 'adult', 'weapons']);

/**
 * ThoughtPacket — structured, not raw hidden reasoning.
 * [PROTOTYPE] — Taxonomy and validation are v0.1.
 */
export function createThoughtPacket(type, claim, confidence, requiresHumanReview) {
  if (!['verification', 'risk', 'objection', 'proposal'].includes(type)) {
    throw new Error('Invalid thought packet type');
  }
  return Object.freeze({
    schema: THOUGHT_PACKET_SCHEMA,
    type,
    claim: String(claim),
    confidence: Number(confidence),
    requires_human_review: Boolean(requiresHumanReview),
  });
}

/**
 * ScreeningResult — deterministic rules only.
 */
export function screenProposal(proposal) {
  const projectId = String(proposal?.project_id || 'unknown');
  const packets = [];
  const proofGap = [];

  // Anti-scam / team disclosure
  const antiScam = proposal?.team_disclosure === true ? 'pass' : 'fail';
  if (antiScam === 'fail') {
    packets.push(createThoughtPacket('objection', 'Team disclosure is missing.', 0.9, true));
  }

  // Business activity (sector)
  const sector = String(proposal?.sector || '').toLowerCase();
  const businessActivity = PROHIBITED_SECTORS.has(sector) ? 'fail' : 'pass';
  if (businessActivity === 'fail') {
    packets.push(createThoughtPacket('objection', `Sector is prohibited by screening rule: ${sector}.`, 0.95, true));
  }

  // Financial screen (debt ratio as simple proxy for excessive leverage)
  const debtRatio = Number(proposal?.debt_ratio ?? 1.0);
  const financialScreen = debtRatio < 0.33 ? 'pass' : 'needs_review';
  if (financialScreen !== 'pass') {
    packets.push(createThoughtPacket('risk', 'Debt ratio exceeds configured screening threshold.', 0.75, true));
  }

  // Token mechanics — reject guaranteed yield
  const tokenMechanics = proposal?.guaranteed_apr === true ? 'fail' : 'pass';
  if (tokenMechanics === 'fail') {
    packets.push(createThoughtPacket('objection', 'Guaranteed APR detected.', 0.95, true));
  } else {
    packets.push(createThoughtPacket('verification', 'No guaranteed APR detected.', 0.9, false));
  }

  // Impact evidence
  const evidence = Array.isArray(proposal?.impact_evidence) ? proposal.impact_evidence : [];
  const impactEvidence = evidence.length > 0 ? 'partial' : 'missing';
  if (evidence.length === 0) {
    proofGap.push('No impact evidence submitted.');
    packets.push(createThoughtPacket('risk', 'No Proof-of-Impact evidence submitted.', 0.9, true));
  } else {
    proofGap.push('Impact evidence is not independently verified in v0.1.');
  }

  const screening = Object.freeze({
    anti_scam: antiScam,
    business_activity: businessActivity,
    financial_screen: financialScreen,
    token_mechanics: tokenMechanics,
    impact_evidence: impactEvidence,
  });

  let status = 'needs_human_consent';
  if (Object.values(screening).includes('fail')) {
    status = 'blocked';
  } else if (proofGap.length > 0) {
    status = 'needs_human_consent';
  }

  const createdAt = Math.floor(Date.now() / 1000);
  const decisionId = createDecisionHash(projectId, screening, packets, proofGap, createdAt);

  return Object.freeze({
    schema: GRADUATION_DECISION_SCHEMA,
    decision_id: decisionId,
    project_id: projectId,
    status,
    screening,
    thought_packets: Object.freeze(packets),
    proof_gap: Object.freeze(proofGap),
    created_at: createdAt,
    // Claim discipline (per Omnidirectional Audit)
    claim_labels: Object.freeze({
      screening: 'PROTOTYPE',
      thought_packets: 'PROTOTYPE',
      status: 'DESIGN',
      receipt: 'PROTOTYPE (demo HMAC only)',
    }),
  });
}

function createDecisionHash(projectId, screening, packets, proofGap, createdAt) {
  const canonical = JSON.stringify({
    project_id: projectId,
    screening,
    thought_packets: packets.map(p => ({ ...p })),
    proof_gap: proofGap,
    created_at: createdAt,
  }, Object.keys({}).sort()); // deterministic
  return 'sha256:' + createHmac('sha256', 'local-demo-only').update(canonical).digest('hex');
}

/**
 * Micro-consent + signed receipt (DEMO ONLY).
 * Requires exact-string "GO".
 */
export function signReceipt(decision, typedGo, secretKey = Buffer.from('local-demo-key-replace-me')) {
  if (typedGo !== 'GO') {
    throw new Error('Micro-consent failed: typed_go must equal "GO".');
  }

  const nonce = randomBytes(16).toString('hex');
  const payload = {
    schema: CONSENT_RECEIPT_SCHEMA,
    decision,
    micro_consent: {
      typed_go: true,
      nonce,
      signed_at: Math.floor(Date.now() / 1000),
    },
  };

  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = createHmac('sha256', secretKey).update(canonical).digest('hex');

  return Object.freeze({
    receipt_id: 'sha256:' + createHmac('sha256', secretKey).update(canonical).digest('hex'),
    payload,
    signature_scheme: 'hmac-sha256-demo',
    signature,
    warning: 'DEMO signature only. Replace with Ed25519 or wallet signature before any production use. [PROTOTYPE]',
  });
}

export default {
  screenProposal,
  signReceipt,
  COVENANT_GATE_SCHEMA,
  GRADUATION_DECISION_SCHEMA,
};

/**
 * Load the canonical example proposal from fixture (ultra micro for reproducible QA).
 * [PROTOTYPE] — Fixture-based example from audit for the elite blueprint's Covenant Gate QA.
 * This enables the delivery-check to use deterministic input without embedding.
 */
export function loadExampleProposal() {
  const proposalPath = path.resolve(__dirname, '../../../fixtures/covenant/example-impact-proposal.json');
  return JSON.parse(readFileSync(proposalPath, 'utf8'));
}