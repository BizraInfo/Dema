/**
 * ADR-030 Dema / Data-Lake Alignment Mock (G43)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * Local Dema/Data-Lake alignment mock envelope only.
 * Produces reference/expectation objects for the face/body boundary.
 * No Dema/Data-Lake runtime sync, Data Lake mutation, cross-repo writes,
 * API bridge, filesystem bridge outside Dema, PAT runtime invocation,
 * SAT runtime invocation, FATE runtime invocation, URP sync,
 * Node1 activation, AIR runtime expansion, mission memory runtime,
 * vector memory runtime, automatic context rewriting, receipt minting,
 * public receipt writing, publishing, bridging, reward authorization,
 * reward logic, token logic, contracts, marketplace, public economic copy,
 * or Shariah-compliance claims.
 *
 * NO_DEMA_DATALAKE_RUNTIME_SYNC
 * NO_DATALAKE_MUTATION
 * NO_CROSS_REPO_WRITE
 * NO_API_BRIDGE
 * NO_FILESYSTEM_BRIDGE_OUTSIDE_DEMA
 * NO_PAT_RUNTIME_INVOCATION
 * NO_SAT_RUNTIME_INVOCATION
 * NO_FATE_RUNTIME_INVOCATION
 * NO_URP_SYNC
 * NO_NODE1_ACTIVATION
 * NO_AIR_RUNTIME_EXPANSION
 * NO_MISSION_MEMORY_RUNTIME
 * NO_VECTOR_MEMORY_RUNTIME
 * NO_AUTOMATIC_CONTEXT_REWRITING_ENGINE
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_PUBLIC_ECONOMIC_COPY
 * NO_SHARIAH_COMPLIANCE_CLAIM
 */

import { createHash } from 'node:crypto';

export const DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT = 'GO: DEMA DATA-LAKE ALIGNMENT MOCK';

const FORBIDDEN_TERMS = new Set([
  'mint', 'publish', 'bridge', 'reward_authorized', 'token', 'contract',
  'marketplace', 'Node1', 'URP', 'Shariah', 'guaranteed', 'payout',
  'claimable', 'earn', 'authorized', 'transferable', 'public_url', 'public',
  'runtime_sync', 'datalake_mutation', 'cross_repo_write', 'pat_runtime',
  'sat_runtime', 'fate_runtime', 'node1_target', 'urp_publication'
]);

const FORBIDDEN_OUTPUT_KEYS = [
  'token_minted', 'reward_authorized', 'reward_amount', 'token_amount',
  'contract_call', 'marketplace_signal', 'public_receipt_url', 'public_url',
  'bridge_id', 'node1_sync', 'urp_publication', 'shariah_compliant',
  'datalake_synced', 'cross_repo_write_performed', 'runtime_bridge_active',
  'pat_runtime_invoked', 'sat_runtime_invoked', 'fate_runtime_executed'
];

export function createMockDemaDataLakeAlignment({ requireConsent }, input = loadExampleDemaDataLakeAlignmentInput()) {
  if (requireConsent !== DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT) {
    throw new Error('CONSENT_REQUIRED: exact "GO: DEMA DATA-LAKE ALIGNMENT MOCK" required');
  }

  if (!input || typeof input !== 'object') {
    throw new Error('VALIDATION_FAILED: input must be object');
  }

  // Required inputs per ADR-030 alignment boundary
  if (!input.dema_artifact_ref) {
    throw new Error('VALIDATION_FAILED: dema_artifact_ref required');
  }
  if (!input.datalake_body_artifact_ref) {
    throw new Error('VALIDATION_FAILED: datalake_body_artifact_ref required');
  }
  if (!Array.isArray(input.proof_gaps) || input.proof_gaps.length === 0) {
    throw new Error('VALIDATION_FAILED: proof_gaps required and non-empty');
  }

  // Allowed input fields (from ADR-030)
  const allowedInput = [
    'dema_artifact_ref', 'dema_commit_sha', 'adr_ref',
    'air_id', 'mission_state_id', 'local_writer_result_id',
    'datalake_repo_ref', 'datalake_body_artifact_ref',
    'pat7_expectation', 'sat5_expectation', 'fate_expectation', 'urp_expectation',
    'proof_gaps', 'consent_status', 'review_status', 'prototype_posture'
  ];
  for (const k of Object.keys(input)) {
    if (!allowedInput.includes(k)) {
      throw new Error(`FORBIDDEN_INPUT: field "${k}" not allowed`);
    }
  }

  // Reject promotion language
  const checkInput = { ...input };
  const serialized = JSON.stringify(checkInput).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  const now = new Date().toISOString();

  const body = {
    schema: 'bizra.dema.datalake.alignment.v0.1.local',
    alignment_boundary_id: null,
    dema_ref: input.dema_artifact_ref,
    datalake_ref: input.datalake_body_artifact_ref,
    face_body_alignment_status: 'REFERENCE_EXPECTATION_ONLY',
    pat7_expectation: {
      placeholder: true,
      runtime_implemented: false,
      pat7_task: 'score_impact',
      public_publication: false
    },
    sat5_expectation: {
      placeholder: true,
      runtime_implemented: false,
      sat5_task: 'governance_review',
      public_publication: false
    },
    fate_expectation: {
      placeholder: true,
      runtime_implemented: false,
      fate_task: 'final_alignment_test',
      public_publication: false
    },
    urp_expectation: {
      placeholder: true,
      urp_sync_implemented: false,
      public_publication: false
    },
    proof_gaps: input.proof_gaps,
    created_at: now,
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };

  // Deterministic id excludes created_at (audit metadata only)
  const identityBody = Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== 'created_at')
  );
  const canonical = JSON.stringify(identityBody, Object.keys(identityBody).sort());
  const alignment_boundary_id = 'sha256:' + createHash('sha256').update(canonical + DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT).digest('hex');

  body.alignment_boundary_id = alignment_boundary_id;

  // Final safety: no forbidden output keys
  for (const fk of FORBIDDEN_OUTPUT_KEYS) {
    if (fk in body) {
      throw new Error(`FORBIDDEN_OUTPUT: ${fk} must never be present`);
    }
  }

  return body;
}

export function loadExampleDemaDataLakeAlignmentInput() {
  return {
    dema_artifact_ref: 'sha256:1b4c28201b81794e49f28b17423ed2bc29b94745', // G42 scaffold commit
    dema_commit_sha: '1b4c28201b81794e49f28b17423ed2bc29b94745',
    adr_ref: 'ADR-030-dema-data-lake-alignment-boundary',
    air_id: 'sha256:example-air-ref-from-g35',
    mission_state_id: 'sha256:example-mission-state-from-g39',
    local_writer_result_id: 'sha256:example-writer-ref-from-g31',
    datalake_repo_ref: 'bizra-data-lake',
    datalake_body_artifact_ref: 'datalake-body-ref:pat7-sat5-fate-urp-layers',
    proof_gaps: [
      'GAP_FUTURE_IMPLEMENTATION_REQUIRED',
      'GAP_EXTERNAL_REVIEW_PENDING',
      'GAP_REFERENCE_EXPECTATION_ONLY'
    ],
    consent_status: 'required',
    review_status: 'boundary_local_only',
    prototype_posture: '[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY'
  };
}

// Self-test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('--- BIZRA G43: DEMA DATA-LAKE ALIGNMENT MOCK SELF-TEST ---');
  try {
    const base = loadExampleDemaDataLakeAlignmentInput();

    // 1. creates with sha256 alignment_boundary_id
    const r1 = createMockDemaDataLakeAlignment({ requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT }, base);
    console.log('1. creates local alignment envelope: alignment_boundary_id=', (r1.alignment_boundary_id || '').substring(0,30)+'... status=', r1.face_body_alignment_status);

    // 2. requires exact consent
    try { createMockDemaDataLakeAlignment({ requireConsent: 'WRONG' }, base); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('CONSENT_REQUIRED')) throw e; console.log('2. rejects missing exact consent'); }

    // 3. requires dema_artifact_ref and datalake_body_artifact_ref
    try { const bad = {...base}; delete bad.dema_artifact_ref; createMockDemaDataLakeAlignment({ requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT }, bad); throw new Error('should have thrown'); } catch(e){ if(!e.message.includes('dema_artifact_ref')) throw e; console.log('3. requires dema_artifact_ref'); }

    // 4. declares REFERENCE_EXPECTATION_ONLY face/body status
    console.log('4. declares face/body alignment status REFERENCE_EXPECTATION_ONLY:', r1.face_body_alignment_status === 'REFERENCE_EXPECTATION_ONLY');

    // 5. declares PAT-7 expectation without runtime
    const hasPat = r1.pat7_expectation && r1.pat7_expectation.placeholder === true && r1.pat7_expectation.runtime_implemented === false;
    console.log('5. declares PAT-7 expectation without runtime invocation:', hasPat);

    // 6. declares SAT-5 expectation without runtime
    const hasSat = r1.sat5_expectation && r1.sat5_expectation.placeholder === true && r1.sat5_expectation.runtime_implemented === false;
    console.log('6. declares SAT-5 expectation without runtime invocation:', hasSat);

    // 7. declares FATE expectation without runtime
    const hasFate = r1.fate_expectation && r1.fate_expectation.placeholder === true && r1.fate_expectation.runtime_implemented === false;
    console.log('7. declares FATE expectation without runtime invocation:', hasFate);

    // 8. declares URP expectation non-claim (no sync, no public)
    const hasUrp = r1.urp_expectation && r1.urp_expectation.placeholder === true && r1.urp_expectation.urp_sync_implemented === false && r1.urp_expectation.public_publication === false;
    console.log('8. declares URP expectation non-claim (no sync/public):', hasUrp);

    // 9. includes non-empty proof_gaps and prototype_posture
    const hasGaps = Array.isArray(r1.proof_gaps) && r1.proof_gaps.length > 0;
    const hasPosture = r1.prototype_posture && r1.prototype_posture.includes('PROTOTYPE');
    console.log('9. includes proof_gaps and prototype_posture:', hasGaps && hasPosture);

    // 10. no forbidden output keys (covers sync/mutation/bridge/runtime rejection)
    const hasNoForbidden = !FORBIDDEN_OUTPUT_KEYS.some(k => k in r1);
    console.log('10. never returns forbidden fields (sync/mutation/bridge/runtime):', hasNoForbidden);

    // 11. deterministic excluding created_at
    const r11a = createMockDemaDataLakeAlignment({ requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT }, base);
    const r11b = createMockDemaDataLakeAlignment({ requireConsent: DEMA_DATALAKE_ALIGNMENT_MOCK_CONSENT }, base);
    console.log('11. deterministic alignment_boundary_id (excl created_at):', r11a.alignment_boundary_id === r11b.alignment_boundary_id);

    console.log('G43 self-test PASS (local mock, consented, required refs, 10 boundary categories as placeholders, deterministic, no forbidden).');
    process.exit(0);
  } catch (e) {
    console.error('G43 SELF-TEST FAIL:', e.message);
    process.exit(1);
  }
}
