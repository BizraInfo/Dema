/**
 * BIZRA Node0 Agent DNA Constitution - Doc Conformance Test
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * TEST_BOUNDARY_ONLY
 *
 * This test verifies the structure and content of the Node0 Agent DNA Constitution.
 * It is a boundary/doc-conformance test only.
 * It asserts presence of all 12 sections, key DNA phrases (Human Mission Center, PAT-7/SAT-5/FATE, Third Fact Proof Chain, Seven Pillars, Ihsān, still-blocked invariants verbatim, prohibitions, Behavioral DoD, Local Node0 Posture), and the exact Next Micro.
 * It guards against promotion of forbidden runtime/economic/public/bridge/Node1/Shariah claims.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CONSTITUTION_PATH = path.join(REPO_ROOT, 'docs', 'constitution', 'BIZRA_NODE0_AGENT_DNA_CONSTITUTION.md');

const constitution = readFileSync(CONSTITUTION_PATH, 'utf8');

test('constitution file exists and is non-empty', () => {
  assert.ok(constitution && constitution.length > 2000, 'constitution document must be substantial');
});

test('contains all 12 mandatory sections', () => {
  const required = [
    '## 1. Human Mission Center',
    '## 2. Dema DNA',
    '## 3. PAT-7 DNA',
    '## 4. SAT-5 DNA',
    '## 5. FATE DNA',
    '## 6. Third Fact Proof Chain',
    '## 7. Seven Pillars',
    '## 8. Agent Prohibitions',
    '## 9. Local Node0 Posture',
    '## 10. Still-Blocked Invariants',
    '## 11. Behavioral DoD',
    '## 12. Next Micro'
  ];
  for (const section of required) {
    assert.ok(constitution.includes(section), `missing required section: ${section}`);
  }
});

test('still-blocked invariants present verbatim (Section 10)', () => {
  const blocked = [
    'No production scoring.',
    'No economic scoring.',
    'No reward eligibility implementation.',
    'No reward logic.',
    'No receipt minting.',
    'No public receipt writing.',
    'No publishing.',
    'No bridging.',
    'No contracts.',
    'No token logic.',
    'No marketplace.',
    'No public economic copy.',
    'No Node1.',
    'No public URP bridge.',
    'No Shariah-compliant claim.'
  ];
  for (const item of blocked) {
    assert.ok(constitution.includes(item), `missing still-blocked invariant: ${item}`);
  }
});

test('core DNA pillars and structures present', () => {
  assert.ok(constitution.includes('Human Mission Center'), 'Human Mission Center required');
  assert.ok(constitution.includes('Dema DNA'), 'Dema DNA section required');
  assert.ok(constitution.includes('PAT-7 DNA'), 'PAT-7 DNA required');
  assert.ok(constitution.includes('SAT-5 DNA'), 'SAT-5 DNA required');
  assert.ok(constitution.includes('FATE DNA'), 'FATE DNA required');
  assert.ok(constitution.includes('Third Fact Proof Chain'), 'Third Fact Proof Chain required');
  assert.ok(constitution.includes('Seven Pillars'), 'Seven Pillars required');
  assert.ok(constitution.includes('Ihsān'), 'Ihsān required');
  assert.ok(constitution.includes('Agent Prohibitions'), 'Agent Prohibitions required');
  assert.ok(constitution.includes('Local Node0 Posture'), 'Local Node0 Posture required');
  assert.ok(constitution.includes('Behavioral DoD'), 'Behavioral DoD required');
});

test('next micro is explicitly the test scaffold GO', () => {
  assert.ok(constitution.includes('GO: BIZRA NODE0 AGENT DNA CONSTITUTION TEST SCAFFOLD'), 'exact next micro GO string required');
});

test('forbidden runtime/economic/public/bridge/Node1/Shariah claims are not promoted', () => {
  const forbiddenPromotional = [
    /runtime (is|has|activated|enabled|ready|complete)/i,
    /PAT.*(runtime|invocation|activated)/i,
    /SAT.*(runtime|invocation|activated)/i,
    /FATE.*(runtime|activated)/i,
    /agent orchestration engine/i,
    /memory runtime/i,
    /Data Lake mutation/i,
    /Node1 (is|has|activated|enabled|ready)/i,
    /URP bridge (is|has|activated|enabled|ready)/i,
    /reward logic (is|has|implemented|enabled|ready)/i,
    /token logic (is|has|implemented|enabled|ready)/i,
    /contracts? (is|has|activated|enabled|ready)/i,
    /marketplace (is|has|activated|enabled|ready)/i,
    /public economic (copy|claim|release|is|has|ready)/i,
    /Shariah-compliant (claim|production|is|has|ready)/i
  ];
  for (const re of forbiddenPromotional) {
    assert.ok(!re.test(constitution), `forbidden promotional claim detected: ${re}`);
  }
});

test('references core canon and proof ladder (ADRs, LCC-6, G-Ladder, delivery-check, Third Fact, DNA siblings)', () => {
  assert.ok(constitution.includes('ADR-033') || constitution.includes('LCC-6'), 'LCC-6 / ADR-033 reference required');
  assert.ok(constitution.includes('ADR-034') || constitution.includes('G-Ladder'), 'G-Ladder / ADR-034 reference required');
  assert.ok(constitution.includes('Third Fact') || constitution.includes('BIZRA — The Third Fact'), 'Third Fact reference required');
  assert.ok(constitution.includes('BIZRA_AGENT_DNA_LAW_OF_ASSUMPTION') || constitution.includes('DEMA_AGENT_HARNESS'), 'sibling DNA docs reference required');
  assert.ok(constitution.includes('delivery-check') || constitution.includes('Delivery Spine'), 'delivery-check / spine reference recommended');
});

test('declares doctrine / boundary / no-implementation posture', () => {
  assert.ok(constitution.includes('doctrine') || constitution.includes('boundary') || constitution.includes('No Implementation') || constitution.includes('future slices'), 'doctrine/boundary/no-implementation posture declaration required');
});
